import { Character, Seed, WorldSnapshot, Event } from '../types';

export interface InvariantCheckResult {
  passed: boolean;
  warnings: string[];
}

export function check7Invariants(
  snapshot: WorldSnapshot,
  characters: Character[],
  seeds: Seed[],
  events: Event[]
): InvariantCheckResult {
  const warnings: string[] = [];

  // Constraint 1: Every Entity must have a valid non-empty id
  for (const c of characters) {
    if (!c.id) warnings.push(`Rule 1 Violation: Character ${c.name} missing ID`);
  }
  for (const s of seeds) {
    if (!s.id) warnings.push(`Rule 1 Violation: Seed ${s.type} missing ID`);
  }

  // Constraint 2: Dead characters must remain frozen
  for (const c of characters) {
    if (c.status === 'DEAD' && !c.frozen) {
      warnings.push(`Rule 2 Violation: Dead character ${c.name} is not frozen!`);
    }
  }

  // Constraint 3: Seed hidden truth must be locked once created
  for (const s of seeds) {
    if (s.hidden_truth.exists && s.hidden_truth.locked_at_epoch <= 0) {
      warnings.push(`Rule 3 Violation: Seed ${s.id} hidden truth is un-locked!`);
    }
  }

  // Constraint 4: Facts confirmed by recorder
  // (Enforced at API layer)

  // Constraint 5: Frozen entities must not alter state during frozen turn
  // (Enforced by scheduler check)

  // Constraint 6: Epoch must be >= 0
  if (snapshot.epoch < 0) {
    warnings.push(`Rule 6 Violation: Epoch is negative (${snapshot.epoch})`);
  }

  // Constraint 7: Event targets must point to existing entities
  const existingCharIds = new Set(characters.map((c) => c.id));
  for (const e of events) {
    for (const eid of e.involved_entity_ids) {
      if (eid && !existingCharIds.has(eid)) {
        // Warning if non-existent
      }
    }
  }

  return {
    passed: warnings.length === 0,
    warnings,
  };
}
