import { dbManager } from '../persistence/database';
import { WorldRepository } from './worldRepository';
import { globalWorld, setRecorderWriteContext } from '../worldState';

export class WorldBootstrap {
  public static async bootstrap(worldId = 'world-snapshot-001'): Promise<void> {
    await dbManager.initialize();

    const existingSnapshot = await WorldRepository.getWorldSnapshot(worldId);
    const chars = existingSnapshot ? await WorldRepository.getAllCharacters(worldId) : [];

    if (!existingSnapshot || chars.length === 0) {
      console.log(`[WorldBootstrap] No persistent world or empty characters found for ${worldId}. Seeding initial default world to DB...`);
      setRecorderWriteContext(true);
      try {
        globalWorld.initDefaultWorld();
        globalWorld.snapshot.id = worldId;
      } finally {
        setRecorderWriteContext(false);
      }
      await this.saveAllToDatabase(worldId);
      console.log(`[WorldBootstrap] Initial world ${worldId} seeded and saved to SQLite!`);
    } else {
      console.log(`[WorldBootstrap] Loading persistent world ${worldId} (Epoch ${existingSnapshot.epoch}) from SQLite...`);
      await this.loadFromDatabase(worldId);
      setRecorderWriteContext(true);
      try {
        globalWorld.snapshot.id = worldId;
      } finally {
        setRecorderWriteContext(false);
      }
      console.log(`[WorldBootstrap] Successfully restored world state from SQLite! (${globalWorld.characters.size} characters, ${globalWorld.locations.size} locations, ${globalWorld.organizations.size} organizations)`);
    }
  }

  public static async loadFromDatabase(worldId = 'world-snapshot-001'): Promise<void> {
    const snapshot = await WorldRepository.getWorldSnapshot(worldId);
    if (!snapshot) return;

    setRecorderWriteContext(true);
    try {
      globalWorld.snapshot = snapshot;

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

  public static async saveAllToDatabase(worldId = 'world-snapshot-001'): Promise<void> {
    globalWorld.updateStats();
    await WorldRepository.saveWorldSnapshot(globalWorld.snapshot);

    for (const char of globalWorld.characters.values()) {
      await WorldRepository.saveCharacter(worldId, char);
    }

    for (const loc of globalWorld.locations.values()) {
      await WorldRepository.saveLocation(worldId, loc);
    }

    for (const org of globalWorld.organizations.values()) {
      await WorldRepository.saveOrganization(worldId, org);
    }

    for (const fact of globalWorld.facts.values()) {
      await WorldRepository.saveFact(worldId, fact);
    }

    for (const truth of globalWorld.hiddenTruths.values()) {
      await WorldRepository.saveHiddenTruth(worldId, truth);
    }

    for (const seed of globalWorld.seeds.values()) {
      await WorldRepository.saveSeed(worldId, seed);
    }

    for (const evt of globalWorld.events) {
      await WorldRepository.saveEvent(worldId, evt);
    }
  }
}
