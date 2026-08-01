import { describe, it, expect, beforeAll, vi } from 'vitest';
import { WorldBootstrap } from '../src/engine/world/worldBootstrap';
import { WorldRepository } from '../src/engine/world/worldRepository';
import { recorder } from '../src/engine/recorder/recorder';
import { globalWorld } from '../src/engine/worldState';
import { StateChangeProposal } from '../src/engine/recorder/changeSchemas';

describe('Recorder Persist Stage Rollback Test', () => {
  const worldId = `world-rollback-${Date.now()}`;

  beforeAll(async () => {
    await WorldBootstrap.bootstrap(worldId);
  });

  it('rolls back database transaction when an error occurs during Persist stage', async () => {
    const initialPlayer = await WorldRepository.getCharacter(worldId, 'pc-player');
    const initialGold = initialPlayer?.resources.gold || 100;
    const initialLogsCount = (await WorldRepository.getChangeLogs(worldId, 100)).length;

    const proposalA: StateChangeProposal = {
      id: 'prop-rollback-1',
      operation: 'CHANGE_RESOURCE',
      entityType: 'CHARACTER',
      entityId: 'pc-player',
      payload: { characterId: 'pc-player', goldDelta: 100 },
      effectiveEpoch: 1,
      preconditions: [],
      source: { type: 'SYSTEM' },
    };

    const proposalB: StateChangeProposal = {
      id: 'prop-rollback-2',
      operation: 'UPDATE_LOCATION',
      entityType: 'LOCATION',
      entityId: 'loc-dawnfall',
      payload: { locationId: 'loc-dawnfall', name: 'Altered Dawnfall Name' },
      effectiveEpoch: 1,
      preconditions: [],
      source: { type: 'SYSTEM' },
    };

    // Spy on WorldRepository.saveLocation to throw an error during Persist
    const originalSaveLocation = WorldRepository.saveLocation;
    vi.spyOn(WorldRepository, 'saveLocation').mockImplementationOnce(async () => {
      throw new Error('Database disk I/O error during saveLocation simulation');
    });

    const result = await recorder.commit(worldId, [proposalA, proposalB]);

    // Restore original saveLocation
    WorldRepository.saveLocation = originalSaveLocation;

    // Verify commit result failure
    expect(result.success).toBe(false);
    expect(result.errors.length).toBeGreaterThan(0);
    expect(result.errors[0]).toContain('Database disk I/O error');

    // Verify DB rollback: character gold should NOT have increased
    const playerAfterFail = await WorldRepository.getCharacter(worldId, 'pc-player');
    expect(playerAfterFail?.resources.gold).toBe(initialGold);

    // Verify location name was NOT changed in DB
    const locAfterFail = await WorldRepository.getLocation(worldId, 'loc-dawnfall');
    expect(locAfterFail?.name).not.toBe('Altered Dawnfall Name');

    // Verify change logs were NOT added
    const logsAfterFail = await WorldRepository.getChangeLogs(worldId, 100);
    expect(logsAfterFail.length).toBe(initialLogsCount);

    // Verify globalWorld in-memory cache was NOT modified
    const cachedPlayer = globalWorld.characters.get('pc-player');
    if (cachedPlayer) {
      expect(cachedPlayer.resources.gold).toBe(initialGold);
    }
  });
});
