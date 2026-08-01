import { describe, it, expect, beforeAll } from 'vitest';
import { dbManager } from '../src/engine/persistence/database';
import { WorldBootstrap } from '../src/engine/world/worldBootstrap';
import { WorldRepository } from '../src/engine/world/worldRepository';
import { recorder } from '../src/engine/recorder/recorder';
import { globalWorld } from '../src/engine/worldState';
import { StateChangeProposal } from '../src/engine/recorder/changeSchemas';
import { Character } from '../src/types';

describe('Aetheria World Engine - Phase 1 Persistence & Phase 2 Recorder', () => {
  const worldId = `world-test-${Date.now()}`;

  beforeAll(async () => {
    // Initialize DB and bootstrap
    await WorldBootstrap.bootstrap(worldId);
  });

  it('Phase 1: DB connection and tables initialized successfully', async () => {
    const snapshot = await WorldRepository.getWorldSnapshot(worldId);
    expect(snapshot).not.toBeNull();
    expect(snapshot?.world_name).toBeDefined();
    expect(snapshot?.epoch).toBeGreaterThanOrEqual(1);
  });

  it('Phase 1: Persists and retrieves characters from SQLite', async () => {
    const chars = await WorldRepository.getAllCharacters(worldId);
    expect(chars.length).toBeGreaterThan(0);
    const player = chars.find((c) => c.id === 'pc-player');
    expect(player).toBeDefined();
    expect(player?.id).toBe('pc-player');
  });

  it('Phase 2: Recorder commits valid state change proposal authoritatively', async () => {
    const initialGold = globalWorld.characters.get('pc-player')?.resources.gold || 100;

    const proposals: StateChangeProposal[] = [
      {
        id: 'test-prop-gold-1',
        operation: 'CHANGE_RESOURCE',
        entityType: 'CHARACTER',
        entityId: 'pc-player',
        payload: { characterId: 'pc-player', goldDelta: 50 },
        effectiveEpoch: 1,
        preconditions: [],
        source: { type: 'SYSTEM' },
      },
    ];

    const result = await recorder.commit(worldId, proposals);
    expect(result.success).toBe(true);
    expect(result.committedCount).toBe(1);

    const updatedPlayer = globalWorld.characters.get('pc-player');
    expect(updatedPlayer?.resources.gold).toBe(initialGold + 50);

    // Verify DB log entry
    const logs = await WorldRepository.getChangeLogs(worldId, 10);
    const testLog = logs.find((l) => l.operation === 'CHANGE_RESOURCE');
    expect(testLog).toBeDefined();
  });

  it('Phase 2: Recorder rejects proposal violating invariants (e.g. negative balance or non-existent location)', async () => {
    // 1. Invalid gold delta causing negative gold
    const invalidGoldProposal: StateChangeProposal[] = [
      {
        id: 'test-prop-gold-inv',
        operation: 'CHANGE_RESOURCE',
        entityType: 'CHARACTER',
        entityId: 'pc-player',
        payload: { characterId: 'pc-player', goldDelta: -999999 },
        effectiveEpoch: 1,
        preconditions: [],
        source: { type: 'SYSTEM' },
      },
    ];

    const resultGold = await recorder.commit(worldId, invalidGoldProposal);
    expect(resultGold.success).toBe(false);
    expect(resultGold.errors.length).toBeGreaterThan(0);

    // 2. Move to non-existent location
    const invalidMoveProposal: StateChangeProposal[] = [
      {
        id: 'test-prop-move-inv',
        operation: 'MOVE_CHARACTER',
        entityType: 'CHARACTER',
        entityId: 'pc-player',
        payload: { characterId: 'pc-player', targetLocationId: 'loc-non-existent-999' },
        effectiveEpoch: 1,
        preconditions: [],
        source: { type: 'SYSTEM' },
      },
    ];

    const resultMove = await recorder.commit(worldId, invalidMoveProposal);
    expect(resultMove.success).toBe(false);
    expect(resultMove.errors.some((e) => e.includes('does not exist'))).toBe(true);
  });

  it('Phase 2: Recorder rejects proposal when dead character attempts to move', async () => {
    // Add a test character as DEAD via recorder.commit
    const baseChar = JSON.parse(JSON.stringify(globalWorld.characters.get('npc-elder')!));
    const deadChar: Character = {
      ...baseChar,
      id: 'npc-dead-test',
      status: 'DEAD' as const,
      current_action: { type: 'IDLE', description: 'Deceased', started_at_epoch: 1, estimated_end_epoch: 1 },
    };

    const resultCreate = await recorder.commit(worldId, [
      {
        id: 'prop-create-dead-test',
        operation: 'CREATE_CHARACTER',
        entityType: 'CHARACTER',
        payload: { character: deadChar },
        effectiveEpoch: 1,
        preconditions: [],
        source: { type: 'SYSTEM' },
      },
    ]);
    expect(resultCreate.success).toBe(true);

    const deadMoveProposal: StateChangeProposal[] = [
      {
        id: 'test-prop-dead-move',
        operation: 'MOVE_CHARACTER',
        entityType: 'CHARACTER',
        entityId: 'npc-dead-test',
        payload: { characterId: 'npc-dead-test', targetLocationId: 'loc-dawnfall' },
        effectiveEpoch: 1,
        preconditions: [],
        source: { type: 'SYSTEM' },
      },
    ];

    const resultDead = await recorder.commit(worldId, deadMoveProposal);
    expect(resultDead.success).toBe(false);
    expect(resultDead.errors.some((e) => e.includes('Dead character'))).toBe(true);
  });
});
