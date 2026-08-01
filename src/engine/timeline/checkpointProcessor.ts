import { WorldRepository } from '../world/worldRepository';
import { recorder } from '../recorder/recorder';
import { StateChangeProposal } from '../recorder/changeSchemas';
import { EventType, ScheduledCheckpoint } from '../../types';
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

    // Sort by epoch ASC, sequence ASC
    dueCheckpoints.sort((a, b) => {
      if (a.epoch !== b.epoch) return a.epoch - b.epoch;
      return a.sequence - b.sequence;
    });

    let processedCount = 0;
    const completedTransactions: string[] = [];
    const failedTransactions: string[] = [];
    const eventsGenerated: any[] = [];

    for (const cp of dueCheckpoints) {
      if (cp.status !== 'PENDING') continue;

      const tx = await WorldRepository.getWorldTransaction(worldId, cp.transaction_id);
      if (!tx || (tx.status !== 'IN_PROGRESS' && tx.status !== 'PLANNED')) {
        // Mark checkpoint as CANCELLED since parent transaction is inactive
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
        const destLocId = cp.payload?.locationId || tx.destination_location_id;
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
        // 'PROGRESS' checkpoint
        const stepLocId = cp.payload?.locationId;
        const stepLoc = stepLocId ? await WorldRepository.getLocation(worldId, stepLocId) : null;
        const stepLocName = stepLoc ? stepLoc.name : stepLocId || '途经点';

        proposals.push({
          id: `prop-tx-progress-${tx.id}`,
          operation: 'UPDATE_WORLD_TRANSACTION',
          entityType: 'TRANSACTION',
          entityId: tx.id,
          payload: { transactionId: tx.id, current_checkpoint_index: cp.sequence },
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
