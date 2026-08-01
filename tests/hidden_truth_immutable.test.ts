import { describe, it, expect, beforeAll } from 'vitest';
import { WorldBootstrap } from '../src/engine/world/worldBootstrap';
import { WorldRepository } from '../src/engine/world/worldRepository';
import { recorder } from '../src/engine/recorder/recorder';
import { StateChangeProposal } from '../src/engine/recorder/changeSchemas';

describe('Hidden Truth Immutable Field Protection Tests', () => {
  const worldId = `world-truth-immutable-${Date.now()}`;

  beforeAll(async () => {
    await WorldBootstrap.bootstrap(worldId);
  });

  it('Rejects illegal modification of true_nature on immutable truth', async () => {
    const truth = await WorldRepository.getHiddenTruth(worldId, 'truth-old-lo');
    expect(truth).toBeDefined();

    const proposal: StateChangeProposal[] = [
      {
        id: 'prop-truth-nature',
        operation: 'REVEAL_TRUTH',
        entityType: 'HIDDEN_TRUTH',
        entityId: 'truth-old-lo',
        payload: { truthId: 'truth-old-lo', true_nature: 'Altered Nature' },
        effectiveEpoch: 1,
        preconditions: [],
        source: { type: 'SYSTEM' },
      },
    ];

    const result = await recorder.commit(worldId, proposal);
    expect(result.success).toBe(false);
    expect(result.errors.some((e) => e.includes('immutable'))).toBe(true);
  });

  it('Rejects illegal modification of true_owner_id on immutable truth', async () => {
    const proposal: StateChangeProposal[] = [
      {
        id: 'prop-truth-owner',
        operation: 'REVEAL_TRUTH',
        entityType: 'HIDDEN_TRUTH',
        entityId: 'truth-old-lo',
        payload: { truthId: 'truth-old-lo', true_owner_id: 'char-fake-owner' },
        effectiveEpoch: 1,
        preconditions: [],
        source: { type: 'SYSTEM' },
      },
    ];

    const result = await recorder.commit(worldId, proposal);
    expect(result.success).toBe(false);
    expect(result.errors.some((e) => e.includes('immutable'))).toBe(true);
  });

  it('Rejects illegal modification of true_goal on immutable truth', async () => {
    const proposal: StateChangeProposal[] = [
      {
        id: 'prop-truth-goal',
        operation: 'REVEAL_TRUTH',
        entityType: 'HIDDEN_TRUTH',
        entityId: 'truth-old-lo',
        payload: { truthId: 'truth-old-lo', true_goal: 'Altered Goal' },
        effectiveEpoch: 1,
        preconditions: [],
        source: { type: 'SYSTEM' },
      },
    ];

    const result = await recorder.commit(worldId, proposal);
    expect(result.success).toBe(false);
    expect(result.errors.some((e) => e.includes('immutable'))).toBe(true);
  });

  it('Rejects illegal modification of locked_at_epoch on immutable truth', async () => {
    const proposal: StateChangeProposal[] = [
      {
        id: 'prop-truth-epoch',
        operation: 'REVEAL_TRUTH',
        entityType: 'HIDDEN_TRUTH',
        entityId: 'truth-old-lo',
        payload: { truthId: 'truth-old-lo', locked_at_epoch: 9999 },
        effectiveEpoch: 1,
        preconditions: [],
        source: { type: 'SYSTEM' },
      },
    ];

    const result = await recorder.commit(worldId, proposal);
    expect(result.success).toBe(false);
    expect(result.errors.some((e) => e.includes('immutable'))).toBe(true);
  });

  it('Rejects illegal modification of never_changes setting on immutable truth', async () => {
    const proposal: StateChangeProposal[] = [
      {
        id: 'prop-truth-never',
        operation: 'REVEAL_TRUTH',
        entityType: 'HIDDEN_TRUTH',
        entityId: 'truth-old-lo',
        payload: { truthId: 'truth-old-lo', never_changes: false },
        effectiveEpoch: 1,
        preconditions: [],
        source: { type: 'SYSTEM' },
      },
    ];

    const result = await recorder.commit(worldId, proposal);
    expect(result.success).toBe(false);
    expect(result.errors.some((e) => e.includes('immutable'))).toBe(true);
  });
});
