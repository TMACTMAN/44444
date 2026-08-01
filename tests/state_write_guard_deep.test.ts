import { describe, it, expect } from 'vitest';
import { globalWorld, setRecorderWriteContext } from '../src/engine/worldState';

describe('Deep State Write Guard Violation Tests', () => {
  it('Deep Guard 1: Direct gold mutation throws Write Guard Violation', () => {
    expect(() => {
      const pc = globalWorld.characters.get('pc-player');
      if (pc) {
        pc.resources.gold += 1;
      }
    }).toThrow('[Write Guard Violation]');
  });

  it('Deep Guard 2: Direct relationships array push throws Write Guard Violation', () => {
    expect(() => {
      const pc = globalWorld.characters.get('pc-player');
      if (pc) {
        pc.relationships.push({
          target_id: 'test-target',
          target_name: 'Test Target',
          type: 'NEUTRAL',
          trust: 50,
          fear: 0,
          favor: 50,
          last_interaction_epoch: 1,
        });
      }
    }).toThrow('[Write Guard Violation]');
  });

  it('Deep Guard 3: Direct connected_to array push throws Write Guard Violation', () => {
    expect(() => {
      const loc = globalWorld.locations.get('loc-tavern');
      if (loc) {
        loc.connected_to.push('loc-illegal-connection');
      }
    }).toThrow('[Write Guard Violation]');
  });

  it('Deep Guard 4: Direct seed progress mutation throws Write Guard Violation', () => {
    expect(() => {
      const seed = globalWorld.seeds.get('seed-caravan-01');
      if (seed) {
        seed.progress += 0.1;
      }
    }).toThrow('[Write Guard Violation]');
  });

  it('Deep Guard 5: Direct evidence_collected array push throws Write Guard Violation', () => {
    expect(() => {
      const truth = globalWorld.hiddenTruths.get('truth-old-lo');
      if (truth) {
        truth.evidence_collected.push('illegal-evidence');
      }
    }).toThrow('[Write Guard Violation]');
  });

  it('Deep Guard 6: Direct events array unshift throws Write Guard Violation', () => {
    expect(() => {
      globalWorld.events.unshift({
        id: 'evt-illegal',
        type: 'SOCIAL',
        description: 'Illegal event',
        involved_entity_ids: [],
        cause: { type: 'SYSTEM' },
        effects: [],
        epoch: 1,
        resolved: true,
        resolution_epoch: 1,
        created_at_epoch: 1,
      });
    }).toThrow('[Write Guard Violation]');
  });

  it('Deep Guard 7: Direct snapshot property mutation throws Write Guard Violation', () => {
    expect(() => {
      globalWorld.snapshot.epoch += 1;
    }).toThrow('[Write Guard Violation]');
  });

  it('Deep Guard 8: Operations succeed when setRecorderWriteContext(true) is active', () => {
    setRecorderWriteContext(true);
    try {
      const pc = globalWorld.characters.get('pc-player');
      if (pc) {
        const origGold = pc.resources.gold;
        pc.resources.gold = origGold;
        expect(pc.resources.gold).toBe(origGold);
      }
    } finally {
      setRecorderWriteContext(false);
    }
  });
});
