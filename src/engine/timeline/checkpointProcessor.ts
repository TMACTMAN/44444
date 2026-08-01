import { WorldRepository } from '../world/worldRepository';
import { recorder } from '../recorder/recorder';
import { StateChangeProposal } from '../recorder/changeSchemas';
import { EventType, ScheduledCheckpoint } from '../../types';
import { TransactionService } from './transactionService';
import { TimelineError } from './timelineErrors';

export interface CheckpointProcessResult {
  processedCount: number;
  completedTransactions: string[];
  failedTransactions: string[];
  eventsGenerated: any[];
}

export class CheckpointProcessor {
  public static async processDueCheckpoints(
    worldId: string,
    currentEpoch: number
  ): Promise<CheckpointProcessResult> {
    const dueCheckpoints = await WorldRepository.getDueCheckpoints(worldId, currentEpoch);
    if (dueCheckpoints.length === 0) {
      return {
        processedCount: 0,
        completedTransactions: [],
        failedTransactions: [],
        eventsGenerated: [],
      };
    }

    // Sort strictly by epoch ASC, sequence ASC
    dueCheckpoints.sort((a, b) => {
      if (a.epoch !== b.epoch) return a.epoch - b.epoch;
      return (a.sequence || 0) - (b.sequence || 0);
    });

    let processedCount = 0;
    const completedTransactions: string[] = [];
    const failedTransactions: string[] = [];
    const eventsGenerated: any[] = [];

    for (const cp of dueCheckpoints) {
      // 1. Idempotency Lock Check: only process PENDING checkpoints
      if (cp.status !== 'PENDING') continue;

      const tx = await WorldRepository.getWorldTransaction(worldId, cp.transaction_id);
      if (!tx || (tx.status !== 'IN_PROGRESS' && tx.status !== 'PLANNED')) {
        // Mark checkpoint as CANCELLED since parent transaction is inactive or missing
        await recorder.commit(worldId, [
          {
            id: `prop-cp-stale-${cp.id}`,
            operation: 'UPDATE_SCHEDULED_CHECKPOINT',
            entityType: 'CHECKPOINT',
            entityId: cp.id,
            payload: { checkpointId: cp.id, status: 'CANCELLED', processed_at_epoch: currentEpoch },
            effectiveEpoch: currentEpoch,
            preconditions: [],
            source: { type: 'SCHEDULER', id: 'checkpointProcessor' },
          },
        ]);
        continue;
      }

      // 2. Check Actor Death during transit
      let actorDied = false;
      let deadActorName = '';
      for (const actorId of tx.actor_ids) {
        const actor = await WorldRepository.getCharacter(worldId, actorId);
        if (actor && actor.status === 'DEAD') {
          actorDied = true;
          deadActorName = actor.name || actorId;
          break;
        }
      }

      if (actorDied) {
        const reason = `Actor [${deadActorName}] died during transit`;
        const failProposals = await TransactionService.buildFailTransactionProposals(
          worldId,
          tx.id,
          reason,
          currentEpoch
        );
        const failResult = await recorder.commit(worldId, failProposals);
        if (failResult.success) {
          failedTransactions.push(tx.id);
          eventsGenerated.push(...failResult.eventsGenerated);
        } else {
          console.error('[CheckpointProcessor] Actor death failResult failed:', failResult.errors);
        }
        continue;
      }

      // 3. Dynamic Edge Closure Check
      const fromLocId = cp.payload?.fromLocationId || tx.last_valid_location_id || tx.origin_location_id;
      const targetLocId = cp.payload?.locationId || tx.destination_location_id;

      if (fromLocId && targetLocId) {
        const edges = await WorldRepository.getAllLocationEdges(worldId);
        const matchingEdges = edges.filter(
          (e) =>
            (e.from_location_id === fromLocId && e.to_location_id === targetLocId) ||
            (e.from_location_id === targetLocId && e.to_location_id === fromLocId)
        );
        const blockedEdge = matchingEdges.find((e) => e.status && e.status !== 'OPEN');

        if (blockedEdge) {
          const reason = `Route segment from [${fromLocId}] to [${targetLocId}] is closed/blocked (${blockedEdge.status})`;
          const failProposals = await TransactionService.buildFailTransactionProposals(
            worldId,
            tx.id,
            reason,
            currentEpoch
          );
          const failResult = await recorder.commit(worldId, failProposals);
          if (failResult.success) {
            failedTransactions.push(tx.id);
            eventsGenerated.push(...failResult.eventsGenerated);
          } else {
            console.error('[CheckpointProcessor] Road closure failResult failed:', failResult.errors);
          }
          continue;
        }
      }

      // 4. Destination / Target Location Existence Check
      if (targetLocId) {
        const destLoc = await WorldRepository.getLocation(worldId, targetLocId);
        if (!destLoc) {
          const reason = `Location [${targetLocId}] no longer exists or is invalid`;
          const failProposals = await TransactionService.buildFailTransactionProposals(
            worldId,
            tx.id,
            reason,
            currentEpoch
          );
          const failResult = await recorder.commit(worldId, failProposals);
          if (failResult.success) {
            failedTransactions.push(tx.id);
            eventsGenerated.push(...failResult.eventsGenerated);
          }
          continue;
        }
      }

      // 5. Construct proposals for successful checkpoint processing
      const proposals: StateChangeProposal[] = [
        {
          id: `prop-cp-proc-${cp.id}`,
          operation: 'UPDATE_SCHEDULED_CHECKPOINT',
          entityType: 'CHECKPOINT',
          entityId: cp.id,
          payload: { checkpointId: cp.id, status: 'PROCESSED', processed_at_epoch: currentEpoch },
          effectiveEpoch: currentEpoch,
          preconditions: [],
          source: { type: 'SCHEDULER', id: 'checkpointProcessor' },
        },
      ];

      if (cp.type === 'DESTINATION_ARRIVAL') {
        const destLocId = cp.payload?.locationId || tx.destination_location_id!;
        const destLoc = await WorldRepository.getLocation(worldId, destLocId);
        const destName = destLoc ? destLoc.name : destLocId;

        proposals.push({
          id: `prop-tx-complete-${tx.id}`,
          operation: 'COMPLETE_TRANSACTION',
          entityType: 'TRANSACTION',
          entityId: tx.id,
          payload: { transactionId: tx.id },
          effectiveEpoch: currentEpoch,
          preconditions: [],
          source: { type: 'SCHEDULER', id: 'checkpointProcessor' },
        });

        for (const actorId of tx.actor_ids) {
          proposals.push({
            id: `prop-actor-arrived-${actorId}`,
            operation: 'SET_CHARACTER_PRESENCE',
            entityType: 'CHARACTER',
            entityId: actorId,
            payload: {
              characterId: actorId,
              presence_state: 'AT_LOCATION',
              location_id: destLocId,
              current_transaction_id: null,
            },
            effectiveEpoch: currentEpoch,
            preconditions: [],
            source: { type: 'SCHEDULER', id: 'checkpointProcessor' },
          });

          const actor = await WorldRepository.getCharacter(worldId, actorId);
          const actorName = actor ? actor.name : actorId;

          proposals.push({
            id: `prop-actor-idle-${actorId}`,
            operation: 'SET_CHARACTER_ACTION',
            entityType: 'CHARACTER',
            entityId: actorId,
            payload: {
              characterId: actorId,
              action: {
                type: 'IDLE',
                description: `已到达【${destName}】`,
                started_at_epoch: currentEpoch,
              },
            },
            effectiveEpoch: currentEpoch,
            preconditions: [],
            source: { type: 'SCHEDULER', id: 'checkpointProcessor' },
          });

          proposals.push({
            id: `prop-evt-arrived-${tx.id}-${actorId}`,
            operation: 'CREATE_EVENT',
            entityType: 'EVENT',
            payload: {
              type: 'TRAVEL_COMPLETED' as EventType,
              description: `【${actorName}】顺畅抵达目的地【${destName}】`,
              location_id: destLocId,
              involved_entity_ids: [actorId],
            },
            effectiveEpoch: currentEpoch,
            preconditions: [],
            source: { type: 'SCHEDULER', id: 'checkpointProcessor' },
          });
        }

        completedTransactions.push(tx.id);
      } else {
        // 'PROGRESS' intermediate checkpoint
        const stepLocId = cp.payload?.locationId;
        const stepLoc = stepLocId ? await WorldRepository.getLocation(worldId, stepLocId) : null;
        const stepLocName = stepLoc ? stepLoc.name : stepLocId || '途经点';

        proposals.push({
          id: `prop-tx-progress-${tx.id}-${cp.sequence}`,
          operation: 'UPDATE_WORLD_TRANSACTION',
          entityType: 'TRANSACTION',
          entityId: tx.id,
          payload: {
            transactionId: tx.id,
            current_checkpoint_index: cp.sequence,
            last_valid_location_id: stepLocId, // Spatial continuity update
          },
          effectiveEpoch: currentEpoch,
          preconditions: [],
          source: { type: 'SCHEDULER', id: 'checkpointProcessor' },
        });

        for (const actorId of tx.actor_ids) {
          const actor = await WorldRepository.getCharacter(worldId, actorId);
          const actorName = actor ? actor.name : actorId;

          proposals.push({
            id: `prop-evt-progress-${tx.id}-${cp.sequence}`,
            operation: 'CREATE_EVENT',
            entityType: 'EVENT',
            payload: {
              type: 'TRAVEL_PROGRESS' as EventType,
              description: `【${actorName}】旅途中行至【${stepLocName}】（进度 ${cp.payload?.stepIndex}/${cp.payload?.totalSteps}）`,
              location_id: stepLocId,
              involved_entity_ids: [actorId],
            },
            effectiveEpoch: currentEpoch,
            preconditions: [],
            source: { type: 'SCHEDULER', id: 'checkpointProcessor' },
          });
        }
      }

      const commitResult = await recorder.commit(worldId, proposals);
      if (commitResult.success) {
        processedCount++;
        eventsGenerated.push(...commitResult.eventsGenerated);
      } else {
        console.error(`[CheckpointProcessor] Failed to commit checkpoint ${cp.id}:`, commitResult.errors);
      }
    }

    return {
      processedCount,
      completedTransactions,
      failedTransactions,
      eventsGenerated,
    };
  }
}
