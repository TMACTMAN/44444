import { WorldRepository } from './worldRepository';
import { globalWorld, setRecorderWriteContext } from '../worldState';

export class WorldCacheLoader {
  public static async reload(worldId = 'world-snapshot-001'): Promise<void> {
    const snapshot = await WorldRepository.getWorldSnapshot(worldId);
    if (!snapshot) return;

    setRecorderWriteContext(true);
    try {
      globalWorld.snapshot.epoch = snapshot.epoch;
      globalWorld.snapshot.world_name = snapshot.world_name;
      globalWorld.snapshot.world_description = snapshot.world_description;
      globalWorld.snapshot.seed = snapshot.seed;
      globalWorld.snapshot.completed_epochs = snapshot.completed_epochs;

      const chars = await WorldRepository.getAllCharacters(worldId);
      globalWorld.characters.clear();
      chars.forEach((c) => globalWorld.characters.set(c.id, c));

      const locs = await WorldRepository.getAllLocations(worldId);
      globalWorld.locations.clear();
      locs.forEach((l) => globalWorld.locations.set(l.id, l));

      const orgs = await WorldRepository.getAllOrganizations(worldId);
      globalWorld.organizations.clear();
      orgs.forEach((o) => globalWorld.organizations.set(o.id, o));

      const facts = await WorldRepository.getAllFacts(worldId);
      globalWorld.facts.clear();
      facts.forEach((f) => globalWorld.facts.set(f.id, f));

      const truths = await WorldRepository.getAllHiddenTruths(worldId);
      globalWorld.hiddenTruths.clear();
      truths.forEach((t) => globalWorld.hiddenTruths.set(t.id, t));

      const seeds = await WorldRepository.getAllSeeds(worldId);
      globalWorld.seeds.clear();
      seeds.forEach((s) => globalWorld.seeds.set(s.id, s));

      const events = await WorldRepository.getRecentEvents(worldId, 100);
      globalWorld.events = events;

      globalWorld.updateStats();
    } finally {
      setRecorderWriteContext(false);
    }
  }
}
