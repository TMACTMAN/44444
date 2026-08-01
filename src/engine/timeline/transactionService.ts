import { WorldRepository } from '../world/worldRepository';
import { recorder } from '../recorder/recorder';
import { StateChangeProposal } from '../recorder/changeSchemas';
import { EventType, WorldTransaction, ScheduledCheckpoint } from '../../types';
import { TravelPlanRequest, TravelPlanResult } from './timelineTypes';
import { TransactionValidator } from './transactionValidator';
import { RoutePlanner } from './routePlanner';
import { TransactionStateMachine } from './transactionStateMachine';
import { TimelineError } from './timelineErrors';

export class TransactionService {
  public static async planTravel(req: TravelPlanRequest): Promise<TravelPlanResult> {
    // 1. Validation
    await TransactionValidator.validateTravelPlanRequest(req);

    // 2. Fetch actor and origin
    const actor = (await WorldRepository.getCharacter(req.worldId, req.actorId))!;
    const originId = actor.location_id!;

    // 3. Route Calculation
    const route = await RoutePlanner.findRoute(
      req.worldId,
      originId,
      req.destinationLocationId,
      req.speedMultiplier ?? 1.0
    );

    const txId = `tx-travel-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
    const expectedEndEpoch = req.startEpoch + route.totalEpochs;

    // Build Scheduled Checkpoints
    const checkpoints: ScheduledCheckpoint[] = [];
    let accumEpochs = 0;

    for (let i = 1; i < route.path.length; i++) {
      const edge = route.edges[i - 1];
      const stepEpochs = Math.max(1, Math.ceil((edge.travel_time_epochs || 1) / (req.speedMultiplier ?? 1.0)));
      accumEpochs += stepEpochs;

      const isFinal = i === route.path.length - 1;
      const cpEpoch = req.startEpoch + accumEpochs;
      const cpId = `cp-${txId}-step-${i}`;

      checkpoints.push({
        id: cpId,
        world_id: req.worldId,
        transaction_id: txId,
        epoch: cpEpoch,
        type: isFinal ? 'DESTINATION_ARRIVAL' : 'PROGRESS',
        status: 'PENDING',
        sequence: i,
        payload: {
          stepIndex: i,
          totalSteps: route.path.length - 1,
          locationId: route.path[i],
          fromLocationId: route.path[i - 1],
          distance: edge.distance,
        },
        created_at_epoch: req.startEpoch,
        processed_at_epoch: null,
      });
    }

    // Build WorldTransaction
    const transaction: WorldTransaction = {
      id: txId,
      world_id: req.worldId,
      type: 'TRAVEL',
      status: 'IN_PROGRESS',
      actor_ids: [req.actorId],
      origin_location_id: originId,
      destination_location_id: req.destinationLocationId,
      route_location_ids: route.path,
      start_epoch: req.startEpoch,
      expected_end_epoch: expectedEndEpoch,
      completed_epoch: null,
      current_checkpoint_index: 0,
      checkpoints,
      preconditions: [],
      dependency_ids: [],
      parent_seed_id: req.parentSeedId ?? null,
      parent_organization_id: req.parentOrganizationId ?? null,
      created_at_epoch: req.startEpoch,
      updated_at_epoch: req.startEpoch,
    };

    // Construct Recorder State Proposals
    const proposals: StateChangeProposal[] = [
      {
        id: `prop-tx-create-${txId}`,
        operation: 'CREATE_WORLD_TRANSACTION',
        entityType: 'TRANSACTION',
        entityId: txId,
        payload: { transaction },
        effectiveEpoch: req.startEpoch,
        preconditions: [],
        source: { type: 'TIMELINE', id: req.actorId },
      },
    ];

    for (const cp of checkpoints) {
      proposals.push({
        id: `prop-cp-create-${cp.id}`,
        operation: 'CREATE_SCHEDULED_CHECKPOINT',
        entityType: 'CHECKPOINT',
        entityId: cp.id,
        payload: { checkpoint: cp },
        effectiveEpoch: req.startEpoch,
        preconditions: [],
        source: { type: 'TIMELINE', id: req.actorId },
      });
    }

    proposals.push({
      id: `prop-actor-presence-${req.actorId}`,
      operation: 'SET_CHARACTER_PRESENCE',
      entityType: 'CHARACTER',
      entityId: req.actorId,
      payload: {
        characterId: req.actorId,
        presence_state: 'IN_TRANSIT',
        location_id: null,
        current_transaction_id: txId,
      },
      effectiveEpoch: req.startEpoch,
      preconditions: [],
      source: { type: 'TIMELINE', id: req.actorId },
    });

    const destLoc = await WorldRepository.getLocation(req.worldId, req.destinationLocationId);
    const destName = destLoc ? destLoc.name : req.destinationLocationId;

    proposals.push({
      id: `prop-actor-action-${req.actorId}`,
      operation: 'SET_CHARACTER_ACTION',
      entityType: 'CHARACTER',
      entityId: req.actorId,
      payload: {
        characterId: req.actorId,
        action: {
          type: 'TRAVEL',
          description: `从【${originId}】启程前往【${destName}】`,
          started_at_epoch: req.startEpoch,
          estimated_end_epoch: expectedEndEpoch,
        },
      },
      effectiveEpoch: req.startEpoch,
      preconditions: [],
      source: { type: 'TIMELINE', id: req.actorId },
    });

    proposals.push({
      id: `prop-evt-travel-start-${txId}`,
      operation: 'CREATE_EVENT',
      entityType: 'EVENT',
      payload: {
        type: 'TRAVEL_STARTED' as EventType,
        description: `【${actor.name}】启程前往【${destName}】（预计耗时 ${route.totalEpochs} 周期）`,
        location_id: originId,
        involved_entity_ids: [req.actorId],
      },
      effectiveEpoch: req.startEpoch,
      preconditions: [],
      source: { type: 'TIMELINE', id: req.actorId },
    });

    const commitResult = await recorder.commit(req.worldId, proposals);
    if (!commitResult.success) {
      throw new TimelineError(
        'RECORDER_COMMIT_FAILED',
        `Failed to commit travel transaction: ${commitResult.errors.join('; ')}`
      );
    }

    return {
      transaction,
      checkpoints,
      totalDistance: route.totalDistance,
      totalEpochs: route.totalEpochs,
      route: route.path,
    };
  }

  public static async cancelTransaction(
    worldId: string,
    transactionId: string,
    reason: string,
    epoch: number
  ): Promise<void> {
    const tx = await WorldRepository.getWorldTransaction(worldId, transactionId);
    if (!tx) {
      throw new TimelineError('TRANSACTION_NOT_FOUND', `Transaction [${transactionId}] not found`);
    }

    TransactionStateMachine.assertCanTransition(tx, 'CANCELLED');

    const pendingCheckpoints = await WorldRepository.getCheckpointsForTransaction(worldId, transactionId);
    const duePending = pendingCheckpoints.filter((cp) => cp.status === 'PENDING');

    const proposals: StateChangeProposal[] = [
      {
        id: `prop-tx-cancel-${transactionId}`,
        operation: 'CANCEL_TRANSACTION',
        entityType: 'TRANSACTION',
        entityId: transactionId,
        payload: { transactionId, reason },
        effectiveEpoch: epoch,
        preconditions: [],
        source: { type: 'TIMELINE', id: transactionId },
      },
    ];

    for (const cp of duePending) {
      proposals.push({
        id: `prop-cp-cancel-${cp.id}`,
        operation: 'UPDATE_SCHEDULED_CHECKPOINT',
        entityType: 'CHECKPOINT',
        entityId: cp.id,
        payload: { checkpointId: cp.id, status: 'CANCELLED', processed_at_epoch: epoch },
        effectiveEpoch: epoch,
        preconditions: [],
        source: { type: 'TIMELINE', id: transactionId },
      });
    }

    for (const actorId of tx.actor_ids) {
      const fallbackLocId = tx.origin_location_id || 'loc-tavern';
      proposals.push({
        id: `prop-actor-reset-${actorId}`,
        operation: 'SET_CHARACTER_PRESENCE',
        entityType: 'CHARACTER',
        entityId: actorId,
        payload: {
          characterId: actorId,
          presence_state: 'AT_LOCATION',
          location_id: fallbackLocId,
          current_transaction_id: null,
        },
        effectiveEpoch: epoch,
        preconditions: [],
        source: { type: 'TIMELINE', id: transactionId },
      });
    }

    proposals.push({
      id: `prop-evt-cancel-${transactionId}`,
      operation: 'CREATE_EVENT',
      entityType: 'EVENT',
      payload: {
        type: 'TRANSACTION_CANCELLED' as EventType,
        description: `旅行行程 [${transactionId}] 已取消：${reason}`,
        involved_entity_ids: tx.actor_ids,
      },
      effectiveEpoch: epoch,
      preconditions: [],
      source: { type: 'TIMELINE', id: transactionId },
    });

    const commitResult = await recorder.commit(worldId, proposals);
    if (!commitResult.success) {
      throw new TimelineError(
        'RECORDER_COMMIT_FAILED',
        `Failed to commit transaction cancellation: ${commitResult.errors.join('; ')}`
      );
    }
  }

  public static async failTransaction(
    worldId: string,
    transactionId: string,
    reason: string,
    epoch: number
  ): Promise<void> {
    const tx = await WorldRepository.getWorldTransaction(worldId, transactionId);
    if (!tx) {
      throw new TimelineError('TRANSACTION_NOT_FOUND', `Transaction [${transactionId}] not found`);
    }

    TransactionStateMachine.assertCanTransition(tx, 'FAILED');

    const pendingCheckpoints = await WorldRepository.getCheckpointsForTransaction(worldId, transactionId);
    const duePending = pendingCheckpoints.filter((cp) => cp.status === 'PENDING');

    const proposals: StateChangeProposal[] = [
      {
        id: `prop-tx-fail-${transactionId}`,
        operation: 'FAIL_TRANSACTION',
        entityType: 'TRANSACTION',
        entityId: transactionId,
        payload: { transactionId, invalidation_reason: reason },
        effectiveEpoch: epoch,
        preconditions: [],
        source: { type: 'TIMELINE', id: transactionId },
      },
    ];

    for (const cp of duePending) {
      proposals.push({
        id: `prop-cp-fail-${cp.id}`,
        operation: 'UPDATE_SCHEDULED_CHECKPOINT',
        entityType: 'CHECKPOINT',
        entityId: cp.id,
        payload: { checkpointId: cp.id, status: 'FAILED', processed_at_epoch: epoch },
        effectiveEpoch: epoch,
        preconditions: [],
        source: { type: 'TIMELINE', id: transactionId },
      });
    }

    for (const actorId of tx.actor_ids) {
      const fallbackLocId = tx.origin_location_id || 'loc-tavern';
      proposals.push({
        id: `prop-actor-fail-reset-${actorId}`,
        operation: 'SET_CHARACTER_PRESENCE',
        entityType: 'CHARACTER',
        entityId: actorId,
        payload: {
          characterId: actorId,
          presence_state: 'AT_LOCATION',
          location_id: fallbackLocId,
          current_transaction_id: null,
        },
        effectiveEpoch: epoch,
        preconditions: [],
        source: { type: 'TIMELINE', id: transactionId },
      });
    }

    proposals.push({
      id: `prop-evt-fail-${transactionId}`,
      operation: 'CREATE_EVENT',
      entityType: 'EVENT',
      payload: {
        type: 'TRAVEL_FAILED' as EventType,
        description: `旅行行程 [${transactionId}] 中途中断失败：${reason}`,
        involved_entity_ids: tx.actor_ids,
      },
      effectiveEpoch: epoch,
      preconditions: [],
      source: { type: 'TIMELINE', id: transactionId },
    });

    const commitResult = await recorder.commit(worldId, proposals);
    if (!commitResult.success) {
      throw new TimelineError(
        'RECORDER_COMMIT_FAILED',
        `Failed to commit transaction failure: ${commitResult.errors.join('; ')}`
      );
    }
  }
}
