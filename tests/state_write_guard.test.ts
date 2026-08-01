import { describe, it, expect, beforeAll } from 'vitest';
import { globalWorld, setRecorderWriteContext } from '../src/engine/worldState';

describe('State Write Guard Protection Tests', () => {
  it('Write Guard 1: Direct mutation on globalWorld.characters without WriteContext throws error', () => {
    expect(() => {
      globalWorld.characters.set('pc-player-illegal', {} as any);
    }).toThrow('[Write Guard Violation]');
  });

  it('Write Guard 2: Direct mutation on globalWorld.snapshot.epoch without WriteContext throws error', () => {
    expect(() => {
      globalWorld.snapshot.epoch = 9999;
    }).toThrow('[Write Guard Violation]');
  });

  it('Write Guard 3: Direct deletion on globalWorld.locations without WriteContext throws error', () => {
    expect(() => {
      globalWorld.locations.delete('loc-tavern');
    }).toThrow('[Write Guard Violation]');
  });

  it('Write Guard 4: Mutations with setRecorderWriteContext(true) succeed', () => {
    setRecorderWriteContext(true);
    try {
      const origEpoch = globalWorld.snapshot.epoch;
      globalWorld.snapshot.epoch = origEpoch;
      expect(globalWorld.snapshot.epoch).toBe(origEpoch);
    } finally {
      setRecorderWriteContext(false);
    }
  });
});
