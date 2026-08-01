import { describe, it, expect, beforeEach } from 'vitest';
import { WorldBootstrap } from '../src/engine/world/worldBootstrap';
import { WorldRepository } from '../src/engine/world/worldRepository';
import { TransactionService } from '../src/engine/timeline/transactionService';
import { CheckpointProcessor } from '../src/engine/timeline/checkpointProcessor';
import { GlobalTimeline } from '../src/engine/timeline/globalTimeline';
import { RoutePlanner } from '../src/engine/timeline/routePlanner';
import { TransactionStateMachine } from '../src/engine/timeline/transactionStateMachine';
import { TimelineError } from '../src/engine/timeline/timelineErrors';
import { recorder } from '../src/engine/recorder/recorder';

describe('Phase 3 Timeline Integration Suite', () => {
  let testWorldId: string;

  beforeEach(async () => {
    testWorldId = `world-p3-vitest-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
    await WorldBootstrap.bootstrap(testWorldId);
  });

  it('1. Route Planning: calculates shortest path and rejects identical origin/destination', async () => {
    // Valid route calculation
    const route = await RoutePlanner.findRoute(testWorldId, 'loc-tavern', 'loc-ruins');
    expect(route.path.length).toBe(3); // ['loc-tavern', 'loc-dawnfall', 'loc-ruins']
    expect(route.path[0]).toBe('loc-tavern');
    expect(route.path[route.path.length - 1]).toBe('loc-ruins');
    expect(route.totalEpochs).toBe(2);

    // Identical origin and destination rejection
    await expect(
      RoutePlanner.findRoute(testWorldId, 'loc-tavern', 'loc-tavern')
    ).rejects.toThrowError(TimelineError);
  });

  it('2. Travel Initialization: sets IN_TRANSIT, clears location_id, sets transaction and last_valid_location_id', async () => {
    const travelResult = await TransactionService.planTravel({
      worldId: testWorldId,
      actorId: 'pc-player',
      destinationLocationId: 'loc-ruins',
      startEpoch: 1,
    });

    expect(travelResult.transaction.status).toBe('IN_PROGRESS');
    expect(travelResult.transaction.last_valid_location_id).toBe('loc-tavern');

    const actor = await WorldRepository.getCharacter(testWorldId, 'pc-player');
    expect(actor?.presence_state).toBe('IN_TRANSIT');
    expect(actor?.location_id).toBeNull();
    expect(actor?.current_transaction_id).toBe(travelResult.transaction.id);
  });

  it('3. Sequential Progression & Arrival: advances through checkpoints and arrives at target', async () => {
    const travelResult = await TransactionService.planTravel({
      worldId: testWorldId,
      actorId: 'pc-player',
      destinationLocationId: 'loc-ruins',
      startEpoch: 1,
    });

    // Advance timeline using GlobalTimeline up to epoch 3
    const summary = await GlobalTimeline.processUntil(testWorldId, 3);
    expect(summary.processedCheckpoints).toBe(2);

    const actor = await WorldRepository.getCharacter(testWorldId, 'pc-player');
    expect(actor?.presence_state).toBe('AT_LOCATION');
    expect(actor?.location_id).toBe('loc-ruins');
    expect(actor?.current_transaction_id).toBeNull();

    const tx = await WorldRepository.getWorldTransaction(testWorldId, travelResult.transaction.id);
    expect(tx?.status).toBe('COMPLETED');
  });

  it('4. Spatial Continuity: resets character to last_valid_location_id on cancellation', async () => {
    const travelResult = await TransactionService.planTravel({
      worldId: testWorldId,
      actorId: 'pc-player',
      destinationLocationId: 'loc-ruins',
      startEpoch: 1,
    });

    // Process epoch 2 to trigger intermediate PROGRESS checkpoint at loc-dawnfall
    await CheckpointProcessor.processDueCheckpoints(testWorldId, 2);

    const txAfterStep = await WorldRepository.getWorldTransaction(testWorldId, travelResult.transaction.id);
    expect(txAfterStep?.last_valid_location_id).toBe('loc-dawnfall');

    // Cancel transaction at epoch 2
    await TransactionService.cancelTransaction(
      testWorldId,
      travelResult.transaction.id,
      'User changed mind mid-route',
      2
    );

    const actor = await WorldRepository.getCharacter(testWorldId, 'pc-player');
    expect(actor?.presence_state).toBe('AT_LOCATION');
    expect(actor?.location_id).toBe('loc-dawnfall');

    const cancelledTx = await WorldRepository.getWorldTransaction(testWorldId, travelResult.transaction.id);
    expect(cancelledTx?.status).toBe('CANCELLED');
  });

  it('5. Actor Death during Transit: fails transaction and sets status', async () => {
    const travelResult = await TransactionService.planTravel({
      worldId: testWorldId,
      actorId: 'pc-player',
      destinationLocationId: 'loc-ruins',
      startEpoch: 1,
    });

    // Set actor status to DEAD
    await recorder.commit(testWorldId, [
      {
        id: 'prop-kill-actor',
        operation: 'UPDATE_CHARACTER',
        entityType: 'CHARACTER',
        entityId: 'pc-player',
        payload: { characterId: 'pc-player', status: 'DEAD' },
        effectiveEpoch: 2,
        preconditions: [],
        source: { type: 'SIMULATION', id: 'test' },
      },
    ]);

    // Process due checkpoints
    const procRes = await CheckpointProcessor.processDueCheckpoints(testWorldId, 2);
    expect(procRes.failedTransactions).toContain(travelResult.transaction.id);

    const failedTx = await WorldRepository.getWorldTransaction(testWorldId, travelResult.transaction.id);
    expect(failedTx?.status).toBe('FAILED');
    expect(failedTx?.invalidation_reason).toContain('died during transit');
  });

  it('6. Destination Invalidation: fails transaction if destination disappears', async () => {
    const travelMissingDest = await TransactionService.planTravel({
      worldId: testWorldId,
      actorId: 'npc-elder',
      destinationLocationId: 'loc-ruins',
      startEpoch: 1,
    });

    // Artificially change destination checkpoint payload to invalid location
    const checkpoints = await WorldRepository.getCheckpointsForTransaction(testWorldId, travelMissingDest.transaction.id);
    const destCp = checkpoints.find((c) => c.type === 'DESTINATION_ARRIVAL');
    if (destCp) {
      await recorder.commit(testWorldId, [
        {
          id: `prop-tamper-cp-${destCp.id}`,
          operation: 'UPDATE_SCHEDULED_CHECKPOINT',
          entityType: 'CHECKPOINT',
          entityId: destCp.id,
          payload: { checkpointId: destCp.id, locationId: 'loc-nonexistent-999' },
          effectiveEpoch: 2,
          preconditions: [],
          source: { type: 'SIMULATION', id: 'test' },
        },
      ]);
    }

    const procRes = await CheckpointProcessor.processDueCheckpoints(testWorldId, 2);
    expect(procRes.failedTransactions).toContain(travelMissingDest.transaction.id);
  });

  it('7. Dynamic Road Closure: fails transaction if edge is BLOCKED', async () => {
    const travelResult = await TransactionService.planTravel({
      worldId: testWorldId,
      actorId: 'pc-player',
      destinationLocationId: 'loc-ruins',
      startEpoch: 1,
    });

    // Close location edge between loc-tavern and loc-dawnfall
    await WorldRepository.saveLocationEdge(testWorldId, {
      id: 'edge-loc-tavern-loc-dawnfall',
      world_id: testWorldId,
      from_location_id: 'loc-tavern',
      to_location_id: 'loc-dawnfall',
      distance: 1.0,
      travel_cost: 1.0,
      travel_time_epochs: 1,
      status: 'CLOSED',
    });

    const procRes = await CheckpointProcessor.processDueCheckpoints(testWorldId, 2);
    expect(procRes.failedTransactions).toContain(travelResult.transaction.id);

    const failedTx = await WorldRepository.getWorldTransaction(testWorldId, travelResult.transaction.id);
    expect(failedTx?.status).toBe('FAILED');
    expect(failedTx?.invalidation_reason).toContain('closed/blocked');
  });

  it('8. Idempotency Lock: double processing does not duplicate actions', async () => {
    await TransactionService.planTravel({
      worldId: testWorldId,
      actorId: 'pc-player',
      destinationLocationId: 'loc-ruins',
      startEpoch: 1,
    });

    const proc1 = await CheckpointProcessor.processDueCheckpoints(testWorldId, 2);
    expect(proc1.processedCount).toBe(1);

    // Second processing on same epoch should process 0 checkpoints
    const proc2 = await CheckpointProcessor.processDueCheckpoints(testWorldId, 2);
    expect(proc2.processedCount).toBe(0);
  });

  it('9. State Machine Enforces Legal Transitions', () => {
    const mockTx: any = {
      id: 'tx-test',
      status: 'COMPLETED',
    };

    expect(() => {
      TransactionStateMachine.assertCanTransition(mockTx, 'PLANNED');
    }).toThrowError(TimelineError);

    expect(() => {
      TransactionStateMachine.assertCanTransition(mockTx, 'CANCELLED');
    }).toThrowError(TimelineError);
  });
});
