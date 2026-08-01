import { describe, it, expect, beforeAll } from 'vitest';
import { WorldBootstrap } from '../src/engine/world/worldBootstrap';
import { WorldRepository } from '../src/engine/world/worldRepository';
import { recorder } from '../src/engine/recorder/recorder';
import { globalWorld, setRecorderWriteContext } from '../src/engine/worldState';
import { StateChangeProposal } from '../src/engine/recorder/changeSchemas';
import { Character, Location, Seed, HiddenTruth } from '../src/types';

describe('WorkingSet Repository-First Authority & Protection Tests', () => {
  const worldId = `world-authority-${Date.now()}`;

  beforeAll(async () => {
    await WorldBootstrap.bootstrap(worldId);
  });

  it('Database Authority: Contaminated globalWorld cache does NOT affect DB delta calculation', async () => {
    // 1. Set DB character pc-player gold to 100
    const dbPlayer = await WorldRepository.getCharacter(worldId, 'pc-player');
    expect(dbPlayer).toBeDefined();
    dbPlayer!.resources.gold = 100;
    await WorldRepository.saveCharacter(worldId, dbPlayer!);

    // 2. Artificially contaminate globalWorld cache to 999
    setRecorderWriteContext(true);
    try {
      const cachedPlayer = globalWorld.characters.get('pc-player');
      if (cachedPlayer) {
        cachedPlayer.resources.gold = 999;
      }
    } finally {
      setRecorderWriteContext(false);
    }

    expect(globalWorld.characters.get('pc-player')?.resources.gold).toBe(999);

    // 3. Submit proposal to add 10 gold
    const proposals: StateChangeProposal[] = [
      {
        id: 'prop-gold-auth-1',
        operation: 'CHANGE_RESOURCE',
        entityType: 'CHARACTER',
        entityId: 'pc-player',
        payload: { characterId: 'pc-player', goldDelta: 10 },
        effectiveEpoch: 1,
        preconditions: [],
        source: { type: 'SYSTEM' },
      },
    ];

    const result = await recorder.commit(worldId, proposals);
    expect(result.success).toBe(true);

    // 4. Verify DB was updated to 110 (100 + 10), ignoring the 999 in cache
    const finalDbPlayer = await WorldRepository.getCharacter(worldId, 'pc-player');
    expect(finalDbPlayer?.resources.gold).toBe(110);

    // 5. Verify globalWorld cache was updated to 110
    expect(globalWorld.characters.get('pc-player')?.resources.gold).toBe(110);
  });

  it('Duplicate ID Protection: Rejects duplicate Character creation', async () => {
    const existingPlayer = await WorldRepository.getCharacter(worldId, 'pc-player');
    expect(existingPlayer).toBeDefined();

    const dupProposal: StateChangeProposal[] = [
      {
        id: 'prop-dup-char',
        operation: 'CREATE_CHARACTER',
        entityType: 'CHARACTER',
        payload: { character: { ...existingPlayer, id: 'pc-player' } },
        effectiveEpoch: 1,
        preconditions: [],
        source: { type: 'SYSTEM' },
      },
    ];

    const result = await recorder.commit(worldId, dupProposal);
    expect(result.success).toBe(false);
    expect(result.errors.some((e) => e.includes('DUPLICATE_ENTITY_ID') || e.includes('already exists'))).toBe(true);
  });

  it('Duplicate ID Protection: Rejects duplicate Location creation', async () => {
    const existingLoc = await WorldRepository.getLocation(worldId, 'loc-tavern');
    expect(existingLoc).toBeDefined();

    const dupProposal: StateChangeProposal[] = [
      {
        id: 'prop-dup-loc',
        operation: 'CREATE_LOCATION',
        entityType: 'LOCATION',
        payload: { location: { ...existingLoc, id: 'loc-tavern' } },
        effectiveEpoch: 1,
        preconditions: [],
        source: { type: 'SYSTEM' },
      },
    ];

    const result = await recorder.commit(worldId, dupProposal);
    expect(result.success).toBe(false);
    expect(result.errors.some((e) => e.includes('DUPLICATE_ENTITY_ID') || e.includes('already exists'))).toBe(true);
  });

  it('Hidden Truth Immutable Protection: Prevents changing immutable fields', async () => {
    const truth = await WorldRepository.getHiddenTruth(worldId, 'truth-old-lo');
    expect(truth).toBeDefined();
    expect(truth?.never_changes).toBe(true);

    const invalidTruthProposal: StateChangeProposal[] = [
      {
        id: 'prop-mutate-truth',
        operation: 'REVEAL_TRUTH',
        entityType: 'HIDDEN_TRUTH',
        entityId: 'truth-old-lo',
        payload: { truthId: 'truth-old-lo', true_nature: 'Completely fake new nature' },
        effectiveEpoch: 1,
        preconditions: [],
        source: { type: 'SYSTEM' },
      },
    ];

    const result = await recorder.commit(worldId, invalidTruthProposal);
    expect(result.success).toBe(false);
    expect(result.errors.some((e) => e.includes('immutable') || e.includes('Immutable'))).toBe(true);
  });
});
