import { describe, it, expect, beforeAll } from 'vitest';
import { WorldBootstrap } from '../src/engine/world/worldBootstrap';
import { recorder } from '../src/engine/recorder/recorder';
import { globalWorld } from '../src/engine/worldState';
import { StateChangeProposal } from '../src/engine/recorder/changeSchemas';

describe('DM & Scheduler Recorder Integration Tests', () => {
  const worldId = 'world-dm-integration-test';

  beforeAll(async () => {
    await WorldBootstrap.bootstrap(worldId);
  });

  it('Integration 1: DM proposal updates character gold and generates event', async () => {
    const proposals: StateChangeProposal[] = [
      {
        id: 'dm-prop-reward-1',
        operation: 'CHANGE_RESOURCE',
        entityType: 'CHARACTER',
        entityId: 'pc-player',
        payload: { characterId: 'pc-player', goldDelta: 150 },
        effectiveEpoch: 1,
        preconditions: [],
        source: { type: 'DM_ACTION', id: 'dm-narrator' },
      },
      {
        id: 'dm-prop-evt-1',
        operation: 'CREATE_EVENT',
        entityType: 'EVENT',
        payload: {
          type: 'SOCIAL',
          description: 'DM 奖励玩家 150 金币',
          involved_entity_ids: ['pc-player'],
        },
        effectiveEpoch: 1,
        preconditions: [],
        source: { type: 'DM_ACTION', id: 'dm-narrator' },
      },
    ];

    const result = await recorder.commit(worldId, proposals);
    expect(result.success).toBe(true);
    expect(result.committedCount).toBe(2);
    expect(result.eventsGenerated.length).toBe(1);

    expect(globalWorld.events.some((e) => e.description.includes('DM 奖励玩家 150 金币'))).toBe(true);
  });
});
