import { describe, it, expect, beforeAll } from 'vitest';
import { dbManager } from '../src/engine/persistence/database';
import { WorldBootstrap } from '../src/engine/world/worldBootstrap';
import { WorldRepository } from '../src/engine/world/worldRepository';
import { recorder } from '../src/engine/recorder/recorder';
import { globalWorld } from '../src/engine/worldState';
import { StateChangeProposal } from '../src/engine/recorder/changeSchemas';
import { CachePublisher } from '../src/engine/recorder/cachePublisher';

describe('Recorder Atomicity Tests (Phase 2 Core Directive)', () => {
  const worldId = 'world-atomicity-test';

  beforeAll(async () => {
    await WorldBootstrap.bootstrap(worldId);
  });

  it('Atomicity 1: Prepare Phase Failure -> DB, Change Log, Cache ALL untouched', async () => {
    const initialGold = globalWorld.characters.get('pc-player')?.resources.gold || 100;
    const initialLogs = await WorldRepository.getChangeLogs(worldId, 100);

    // Proposal batch containing a valid proposal and an invalid proposal (negative gold)
    const proposals: StateChangeProposal[] = [
      {
        id: 'prop-valid-1',
        operation: 'CHANGE_RESOURCE',
        entityType: 'CHARACTER',
        entityId: 'pc-player',
        payload: { characterId: 'pc-player', goldDelta: 50 },
        effectiveEpoch: 1,
        preconditions: [],
        source: { type: 'SYSTEM' },
      },
      {
        id: 'prop-invalid-2',
        operation: 'CHANGE_RESOURCE',
        entityType: 'CHARACTER',
        entityId: 'pc-player',
        payload: { characterId: 'pc-player', goldDelta: -999999 }, // Will fail Prepare phase
        effectiveEpoch: 1,
        preconditions: [],
        source: { type: 'SYSTEM' },
      },
    ];

    const result = await recorder.commit(worldId, proposals);

    // 1. Commit failed
    expect(result.success).toBe(false);

    // 2. Cache remains unchanged
    expect(globalWorld.characters.get('pc-player')?.resources.gold).toBe(initialGold);

    // 3. DB records remain unchanged
    const playerFromDb = await WorldRepository.getCharacter(worldId, 'pc-player');
    expect(playerFromDb?.resources.gold).toBe(initialGold);

    // 4. Change logs count remains unchanged
    const logsAfter = await WorldRepository.getChangeLogs(worldId, 100);
    expect(logsAfter.length).toBe(initialLogs.length);
  });

  it('Atomicity 2: Successful Commit -> DB, Change Log, Cache ALL atomically updated', async () => {
    const initialGold = globalWorld.characters.get('pc-player')?.resources.gold || 100;

    const proposals: StateChangeProposal[] = [
      {
        id: 'prop-atomic-success-1',
        operation: 'CHANGE_RESOURCE',
        entityType: 'CHARACTER',
        entityId: 'pc-player',
        payload: { characterId: 'pc-player', goldDelta: 100 },
        effectiveEpoch: 1,
        preconditions: [],
        source: { type: 'SYSTEM' },
      },
    ];

    const result = await recorder.commit(worldId, proposals);
    expect(result.success).toBe(true);

    // 1. Cache updated
    expect(globalWorld.characters.get('pc-player')?.resources.gold).toBe(initialGold + 100);

    // 2. DB updated
    const playerFromDb = await WorldRepository.getCharacter(worldId, 'pc-player');
    expect(playerFromDb?.resources.gold).toBe(initialGold + 100);

    // 3. Change Log recorded
    const logs = await WorldRepository.getChangeLogs(worldId, 10);
    const logged = logs.find((l) => l.entity_id === 'pc-player' && l.operation === 'CHANGE_RESOURCE');
    expect(logged).toBeDefined();
  });

  it('Atomicity 3: Cache Publish Failure -> Triggers Cache Reload from DB', async () => {
    // Mock CachePublisher.publish to throw an artificial error
    const originalPublish = CachePublisher.publish;
    CachePublisher.publish = () => {
      throw new Error('Simulated Cache Publish Crash');
    };

    const initialGold = globalWorld.characters.get('pc-player')?.resources.gold || 100;

    const proposals: StateChangeProposal[] = [
      {
        id: 'prop-publish-fail-1',
        operation: 'CHANGE_RESOURCE',
        entityType: 'CHARACTER',
        entityId: 'pc-player',
        payload: { characterId: 'pc-player', goldDelta: 25 },
        effectiveEpoch: 1,
        preconditions: [],
        source: { type: 'SYSTEM' },
      },
    ];

    try {
      const result = await recorder.commit(worldId, proposals);

      // Cache reload is triggered, returning cacheRecovered = true
      expect(result.cacheRecovered).toBe(true);
      expect(result.success).toBe(true);

      // DB and recovered Cache should both reflect +25
      const playerFromDb = await WorldRepository.getCharacter(worldId, 'pc-player');
      expect(playerFromDb?.resources.gold).toBe(initialGold + 25);
      expect(globalWorld.characters.get('pc-player')?.resources.gold).toBe(initialGold + 25);
    } finally {
      CachePublisher.publish = originalPublish;
    }
  });
});
