import { describe, it, expect, beforeAll } from 'vitest';
import { WorldBootstrap } from '../src/engine/world/worldBootstrap';
import { recorder } from '../src/engine/recorder/recorder';
import { globalWorld } from '../src/engine/worldState';
import { StateChangeProposal } from '../src/engine/recorder/changeSchemas';
import { Character, Location, Seed } from '../src/types';

describe('Recorder Operations & Error Handling Tests', () => {
  const worldId = `world-ops-${Date.now()}`;

  beforeAll(async () => {
    await WorldBootstrap.bootstrap(worldId);
  });

  it('Operation 1: Non-existent character immediately throws CHARACTER_NOT_FOUND', async () => {
    const proposals: StateChangeProposal[] = [
      {
        id: 'prop-non-existent-char',
        operation: 'CHANGE_RESOURCE',
        entityType: 'CHARACTER',
        entityId: 'char-does-not-exist-999',
        payload: { characterId: 'char-does-not-exist-999', goldDelta: 10 },
        effectiveEpoch: 1,
        preconditions: [],
        source: { type: 'SYSTEM' },
      },
    ];

    const result = await recorder.commit(worldId, proposals);
    expect(result.success).toBe(false);
    expect(result.proposalResults[0].status).toBe('REJECTED');
    expect(result.proposalResults[0].errorCode).toBe('CHARACTER_NOT_FOUND');
  });

  it('Operation 2: Non-existent location immediately throws LOCATION_NOT_FOUND', async () => {
    const proposals: StateChangeProposal[] = [
      {
        id: 'prop-non-existent-loc',
        operation: 'UPDATE_LOCATION',
        entityType: 'LOCATION',
        entityId: 'loc-does-not-exist-999',
        payload: { locationId: 'loc-does-not-exist-999', name: 'New Name' },
        effectiveEpoch: 1,
        preconditions: [],
        source: { type: 'SYSTEM' },
      },
    ];

    const result = await recorder.commit(worldId, proposals);
    expect(result.success).toBe(false);
    expect(result.proposalResults[0].status).toBe('REJECTED');
    expect(result.proposalResults[0].errorCode).toBe('LOCATION_NOT_FOUND');
  });

  it('Operation 3: Cannot mutate immutable Hidden Truth (never_changes = true)', async () => {
    const proposals: StateChangeProposal[] = [
      {
        id: 'prop-mutate-immutable-truth',
        operation: 'REVEAL_TRUTH',
        entityType: 'HIDDEN_TRUTH',
        entityId: 'truth-old-lo',
        payload: { truthId: 'truth-old-lo', true_nature: 'Altered true nature' },
        effectiveEpoch: 1,
        preconditions: [],
        source: { type: 'SYSTEM' },
      },
    ];

    const result = await recorder.commit(worldId, proposals);
    expect(result.success).toBe(false);
    expect(result.errors.some((e) => e.includes('immutable'))).toBe(true);
  });

  it('Operation 4: CREATE_CHARACTER & CREATE_LOCATION in same batch', async () => {
    const newLoc: Location = {
      id: 'loc-batch-created-1',
      name: 'Batch Created Location',
      type: 'TOWN',
      description: 'A location created inside batch',
      child_ids: [],
      connected_to: ['loc-dawnfall'],
      population: 10,
      population_trend: 'STABLE',
      economy: { primary_industry: 'TRADE', wealth_level: 1, trade_goods: [], trade_routes: [] },
      security: { guard_presence: 10, crime_rate: 0 },
      active_events: [],
      features: [],
      frozen: false,
      simulation_level: 3,
      last_simulated_epoch: 1,
      created_at_epoch: 1,
      updated_at_epoch: 1,
    };

    const newChar: Character = {
      id: 'char-batch-created-1',
      type: 'NPC',
      name: 'Batch Character',
      title: 'Tester',
      species: 'Human',
      age: 25,
      location_id: 'loc-batch-created-1', // Reference location created in SAME batch!
      status: 'ALIVE',
      goal: { primary: 'Test', secondary: [] },
      fear: 'None',
      personality: ['Neutral'],
      attributes: { hp: 50, max_hp: 50, mp: 20, max_mp: 20, strength: 10, dexterity: 10, intelligence: 10, charisma: 10 },
      skills: {},
      resources: { gold: 50, reputation: 0 },
      inventory: [],
      knowledge: { known_facts: [], known_characters: [], known_locations: ['loc-batch-created-1'] },
      relationships: [],
      memory: { short_term: [], compressed: '', important_events: [] },
      current_action: { type: 'IDLE', description: 'Idle', started_at_epoch: 1, estimated_end_epoch: 1 },
      frozen: false,
      simulation_level: 3,
      last_simulated_epoch: 1,
      created_at_epoch: 1,
      updated_at_epoch: 1,
    };

    const proposals: StateChangeProposal[] = [
      {
        id: 'prop-create-loc',
        operation: 'CREATE_LOCATION',
        entityType: 'LOCATION',
        payload: { location: newLoc },
        effectiveEpoch: 1,
        preconditions: [],
        source: { type: 'SYSTEM' },
      },
      {
        id: 'prop-create-char',
        operation: 'CREATE_CHARACTER',
        entityType: 'CHARACTER',
        payload: { character: newChar },
        effectiveEpoch: 1,
        preconditions: [],
        source: { type: 'SYSTEM' },
      },
    ];

    const result = await recorder.commit(worldId, proposals);
    expect(result.success).toBe(true);

    expect(globalWorld.locations.has('loc-batch-created-1')).toBe(true);
    expect(globalWorld.characters.has('char-batch-created-1')).toBe(true);
  });

  it('Operation 5: ADVANCE_WORLD_EPOCH updates epoch atomically', async () => {
    const currentEpoch = globalWorld.snapshot.epoch;

    const proposals: StateChangeProposal[] = [
      {
        id: 'prop-advance-epoch-test',
        operation: 'ADVANCE_WORLD_EPOCH',
        entityType: 'WORLD',
        payload: { advanceBy: 1 },
        effectiveEpoch: currentEpoch + 1,
        preconditions: [],
        source: { type: 'SCHEDULER' },
      },
    ];

    const result = await recorder.commit(worldId, proposals);
    expect(result.success).toBe(true);
    expect(globalWorld.snapshot.epoch).toBe(currentEpoch + 1);
  });
});
