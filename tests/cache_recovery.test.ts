import { describe, it, expect, beforeAll } from 'vitest';
import { WorldBootstrap } from '../src/engine/world/worldBootstrap';
import { WorldRepository } from '../src/engine/world/worldRepository';
import { WorldCacheLoader } from '../src/engine/world/worldCacheLoader';
import { globalWorld, setRecorderWriteContext } from '../src/engine/worldState';

describe('Cache Recovery Tests', () => {
  const worldId = 'world-cache-recovery-test';

  beforeAll(async () => {
    await WorldBootstrap.bootstrap(worldId);
  });

  it('Cache Recovery 1: WorldCacheLoader reloads clean state from DB', async () => {
    // 1. Manually corrupt globalWorld in write context
    setRecorderWriteContext(true);
    try {
      globalWorld.snapshot.epoch = 999;
      globalWorld.characters.clear();
    } finally {
      setRecorderWriteContext(false);
    }

    expect(globalWorld.characters.size).toBe(0);

    // 2. Perform WorldCacheLoader reload
    await WorldCacheLoader.reload(worldId);

    // 3. Verify state restored accurately from SQLite DB
    const dbSnapshot = await WorldRepository.getWorldSnapshot(worldId);
    expect(globalWorld.snapshot.epoch).toBe(dbSnapshot?.epoch);

    const dbChars = await WorldRepository.getAllCharacters(worldId);
    expect(globalWorld.characters.size).toBe(dbChars.length);
    expect(globalWorld.characters.has('pc-player')).toBe(true);
  });
});
