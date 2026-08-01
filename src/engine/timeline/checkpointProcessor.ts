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
      // 1. Idempotency Lock Check: DB-level atomic claim lock (PENDING -> PROCESSING)
      if (cp.status !== 'PENDING') continue;
      const claimed = await WorldRepository.claimCheckpointForProcessing(worldId, cp.id);
      if (!claimed) continue;

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

      // 3. Dynamic Edge Closure Check with DELAYED & Max Delays logic
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
          const MAX_DELAYS = 3;
          const currentDelayCount =
            tx.result && typeof tx.result === 'object' && typeof tx.result.delayCount === 'number'
              ? tx.result.delayCount
              : 0;

          if (currentDelayCount < MAX_DELAYS) {
            const newDelayCount = currentDelayCount + 1;
            const allTxCps = await WorldRepository.getCheckpointsForTransaction(worldId, tx.id);

            // Reschedule current checkpoint + future pending checkpoints by +1 epoch
            const delayProposals: StateChangeProposal[] = [
              {
                id: `prop-cp-delay-${cp.id}-${Date.now()}`,
                operation: 'UPDATE_SCHEDULED_CHECKPOINT',
                entityType: 'CHECKPOINT',
                entityId: cp.id,
                payload: { checkpointId: cp.id, status: 'PENDING', epoch: currentEpoch + 1 },
                effectiveEpoch: currentEpoch,
                preconditions: [],
                source: { type: 'SCHEDULER', id: 'checkpointProcessor' },
              },
              {
                id: `prop-tx-delay-${tx.id}-${Date.now()}`,
                operation: 'UPDATE_WORLD_TRANSACTION',
                entityType: 'TRANSACTION',
                entityId: tx.id,
                payload: {
                  transactionId: tx.id,
                  expected_end_epoch: tx.expected_end_epoch + 1,
                  result: { ...(tx.result || {}), delayCount: newDelayCount, delayReason: blockedEdge.status },
                },
                effectiveEpoch: currentEpoch,
                preconditions: [],
                source: { type: 'SCHEDULER', id: 'checkpointProcessor' },
              },
            ];

            for (const otherCp of allTxCps) {
              if (otherCp.id !== cp.id && otherCp.status === 'PENDING') {
                delayProposals.push({
                  id: `prop-cp-shift-${otherCp.id}-${Date.now()}`,
                  operation: 'UPDATE_SCHEDULED_CHECKPOINT',
                  entityType: 'CHECKPOINT',
                  entityId: otherCp.id,
                  payload: { checkpointId: otherCp.id, epoch: otherCp.epoch + 1 },
                  effectiveEpoch: currentEpoch,
                  preconditions: [],
                  source: { type: 'SCHEDULER', id: 'checkpointProcessor' },
                });
              }
            }

            const primaryActorId = tx.actor_ids[0];
            const actor = primaryActorId ? await WorldRepository.getCharacter(worldId, primaryActorId) : null;
            const actorName = actor ? actor.name : primaryActorId || '旅行者';

            delayProposals.push({
              id: `prop-evt-delayed-${tx.id}-${Date.now()}`,
              operation: 'CREATE_EVENT',
              entityType: 'EVENT',
              payload: {
                type: 'TRAVEL_DELAYED' as EventType,
                description: `【${actorName}】在从【${fromLocId}】前往【${targetLocId}】的途中遭遇道路阻塞（${blockedEdge.status}），行程延后 1 周期（已延迟 ${newDelayCount}/${MAX_DELAYS} 次）`,
                location_id: fromLocId,
                involved_entity_ids: tx.actor_ids,
              },
              effectiveEpoch: currentEpoch,
              preconditions: [],
              source: { type: 'SCHEDULER', id: 'checkpointProcessor' },
            });

            const delayResult = await recorder.commit(worldId, delayProposals);
            if (delayResult.success) {
              eventsGenerated.push(...delayResult.eventsGenerated);
            }
            continue;
          } else {
            // Max delays reached -> Fail transaction
            const reason = `Route segment from [${fromLocId}] to [${targetLocId}] remained closed/blocked (${blockedEdge.status}) after maximum ${MAX_DELAYS} delays`;
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
      }

      // 4. Destination / Target Location Existence & Validity Check
      if (targetLocId) {
        const destLoc = await WorldRepository.getLocation(worldId, targetLocId);
        const isLocInvalid =
          !destLoc ||
          destLoc.features?.some((f) => f.state === 'DESTROYED' || f.state === 'BLOCKED') ||
          (destLoc as any).status === 'DESTROYED' ||
          (destLoc as any).status === 'BLOCKED' ||
          (destLoc as any).status === 'INACCESSIBLE';

        if (isLocInvalid) {
          const reason = `Location [${targetLocId}] no longer exists or is invalid/destroyed/inaccessible`;
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
