import { WorldBootstrap } from '../src/engine/world/worldBootstrap';
import { WorldRepository } from '../src/engine/world/worldRepository';
import { TransactionService } from '../src/engine/timeline/transactionService';
import { CheckpointProcessor } from '../src/engine/timeline/checkpointProcessor';
import { TransactionStateMachine } from '../src/engine/timeline/transactionStateMachine';
import { RoutePlanner } from '../src/engine/timeline/routePlanner';
import { globalWorld } from '../src/engine/worldState';
import { recorder } from '../src/engine/recorder/recorder';
import { CausalityEngine } from '../src/engine/causality';

async function runPhase3Tests() {
  console.log('=== Starting Phase 3 Timeline Integration Tests ===');
  const worldId = `world-p3-test-${Date.now()}`;

  // Step 1: Bootstrap world and persistence
  await WorldBootstrap.bootstrap(worldId);
  console.log('✔ World bootstrapped successfully');

  // Step 2: Route planning test
  const route = await RoutePlanner.findRoute(worldId, 'loc-tavern', 'loc-ruins');
  console.log(`✔ Route planned from loc-tavern to loc-ruins: ${route.path.join(' -> ')} (Total Epochs: ${route.totalEpochs})`);
  if (route.path.length < 2) {
    throw new Error('Route planning failed to find path');
  }

  // Step 3: Plan Travel
  const travelResult = await TransactionService.planTravel({
    worldId,
    actorId: 'pc-player',
    destinationLocationId: 'loc-ruins',
    startEpoch: 1,
    speedMultiplier: 1.0,
  });
  console.log(`✔ Travel planned successfully. Transaction ID: ${travelResult.transaction.id}, Checkpoints: ${travelResult.checkpoints.length}`);

  // Step 4: Verify Actor Presence State IN_TRANSIT
  const charInTransit = await WorldRepository.getCharacter(worldId, 'pc-player');
  console.log(`✔ Actor presence state: ${charInTransit?.presence_state}, Transaction ID: ${charInTransit?.current_transaction_id}`);
  if (charInTransit?.presence_state !== 'IN_TRANSIT') {
    throw new Error('Actor should be IN_TRANSIT');
  }

  // Step 5: Test Invalid State Transitions on Transaction
  try {
    TransactionStateMachine.assertCanTransition(travelResult.transaction, 'PLANNED');
    console.error('❌ Should have thrown error when transitioning IN_PROGRESS -> PLANNED');
  } catch (err: any) {
    console.log(`✔ TransactionStateMachine correctly blocked illegal state transition: ${err.message}`);
  }

  // Step 6: Advance Epoch & Process Checkpoints
  console.log('--- Advancing World Epoch to trigger Checkpoints ---');
  let currentEpoch = 1;
  while (currentEpoch <= travelResult.transaction.expected_end_epoch) {
    currentEpoch++;
    await recorder.commit(worldId, [
      {
        id: `prop-advance-epoch-${currentEpoch}`,
        operation: 'ADVANCE_WORLD_EPOCH',
        entityType: 'WORLD',
        payload: { advanceBy: 1 },
        effectiveEpoch: currentEpoch,
        preconditions: [],
        source: { type: 'SYSTEM' },
      },
    ]);

    const processRes = await CheckpointProcessor.processDueCheckpoints(worldId, currentEpoch);
    console.log(`Epoch ${currentEpoch}: Processed ${processRes.processedCount} checkpoints. Completed txs: ${processRes.completedTransactions.length}`);
  }

  // Step 7: Verify Actor Arrival State AT_LOCATION
  const charArrived = await WorldRepository.getCharacter(worldId, 'pc-player');
  const completedTx = await WorldRepository.getWorldTransaction(worldId, travelResult.transaction.id);

  console.log(`✔ Actor presence state after arrival: ${charArrived?.presence_state}, Location: ${charArrived?.location_id}`);
  console.log(`✔ Transaction final status: ${completedTx?.status}`);

  if (charArrived?.presence_state !== 'AT_LOCATION') {
    throw new Error('Actor should be AT_LOCATION after travel completion');
  }
  if (charArrived?.location_id !== 'loc-ruins') {
    throw new Error('Actor location should be loc-ruins');
  }
  if (completedTx?.status !== 'COMPLETED') {
    throw new Error('Transaction should be COMPLETED');
  }

  // Step 8: Test Cancellation
  console.log('--- Testing Travel Cancellation ---');
  const travel2 = await TransactionService.planTravel({
    worldId,
    actorId: 'pc-player',
    destinationLocationId: 'loc-dawnfall',
    startEpoch: currentEpoch,
  });

  console.log(`✔ Created travel transaction ${travel2.transaction.id} for cancellation test`);
  await TransactionService.cancelTransaction(worldId, travel2.transaction.id, 'Player aborted journey', currentEpoch);

  const cancelledTx = await WorldRepository.getWorldTransaction(worldId, travel2.transaction.id);
  const charAfterCancel = await WorldRepository.getCharacter(worldId, 'pc-player');

  console.log(`✔ Cancelled transaction status: ${cancelledTx?.status}`);
  console.log(`✔ Actor presence after cancel: ${charAfterCancel?.presence_state}`);

  if (cancelledTx?.status !== 'CANCELLED') {
    throw new Error('Transaction status should be CANCELLED');
  }
  if (charAfterCancel?.presence_state !== 'AT_LOCATION') {
    throw new Error('Actor presence should reset to AT_LOCATION');
  }

  console.log('=== All Phase 3 Integration Tests Passed Successfully! ===');
}

runPhase3Tests().catch((err) => {
  console.error('❌ Integration Test Failed:', err);
  process.exit(1);
});
