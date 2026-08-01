import { StateChangeProposal } from './changeSchemas';
import { globalWorld } from '../worldState';
import { WorldRepository } from '../world/worldRepository';

export class InvariantValidator {
  public static async validateProposalInvariants(
    worldId: string,
    proposal: StateChangeProposal
  ): Promise<{ passed: boolean; error?: string }> {
    const { operation, entityId, payload } = proposal;

    // Rule 1: Dead character cannot act / move
    if (operation === 'UPDATE_CHARACTER' || operation === 'MOVE_CHARACTER' || operation === 'CHANGE_RESOURCE') {
      const charId = (entityId || payload.characterId || payload.id) as string;
      if (charId) {
        const char = globalWorld.characters.get(charId) || (await WorldRepository.getCharacter(worldId, charId));
        if (char && char.status === 'DEAD') {
          return {
            passed: false,
            error: `Invariant Violation: Dead character (${char.name} [${char.id}]) cannot act, move, or change status.`,
          };
        }
      }
    }

    // Rule 2 & Rule 3: Character position & Destination location existence
    if (operation === 'MOVE_CHARACTER') {
      const charId = (entityId || payload.characterId) as string;
      const targetLocId = (payload.targetLocationId || payload.locationId) as string;

      if (!targetLocId) {
        return { passed: false, error: 'Invariant Violation: MOVE_CHARACTER requires a target Location ID.' };
      }

      const targetLoc = globalWorld.locations.get(targetLocId) || (await WorldRepository.getLocation(worldId, targetLocId));
      if (!targetLoc) {
        return {
          passed: false,
          error: `Invariant Violation: Target location ${targetLocId} does not exist in world.`,
        };
      }

      if (charId) {
        const char = globalWorld.characters.get(charId) || (await WorldRepository.getCharacter(worldId, charId));
        if (char) {
          const currentLoc = globalWorld.locations.get(char.location_id);
          // Check location edge connectivity
          if (currentLoc && !currentLoc.connected_to.includes(targetLocId) && currentLoc.id !== targetLocId) {
            const edgeExists = currentLoc.connected_to.includes(targetLocId);
            if (!edgeExists && !payload.bypassConnectivity) {
              return {
                passed: false,
                error: `Invariant Violation: Cannot move directly from ${currentLoc.name} (${currentLoc.id}) to ${targetLoc.name} (${targetLoc.id}) because locations are not connected.`,
              };
            }
          }
        }
      }
    }

    // Rule 4: Immutable Hidden Truths cannot be modified
    if (operation === 'REVEAL_TRUTH' || operation === 'COLLECT_EVIDENCE') {
      const truthId = (entityId || payload.truthId) as string;
      if (truthId) {
        const truth = globalWorld.hiddenTruths.get(truthId);
        if (truth && truth.never_changes && payload.modifyTrueNature) {
          return {
            passed: false,
            error: `Invariant Violation: Hidden Truth ${truthId} is locked and immutable. True nature cannot be modified.`,
          };
        }
      }
    }

    // Rule 5: Resources cannot drop below 0
    if (operation === 'CHANGE_RESOURCE') {
      const charId = (entityId || payload.characterId) as string;
      const goldDelta = Number(payload.goldDelta || 0);
      if (charId && goldDelta < 0) {
        const char = globalWorld.characters.get(charId);
        if (char && char.resources.gold + goldDelta < 0) {
          return {
            passed: false,
            error: `Invariant Violation: Insufficient gold for character ${char.name}. Current: ${char.resources.gold}, Delta: ${goldDelta}.`,
          };
        }
      }
    }

    // Rule 8: Event Epoch cannot regress into locked past
    if (operation === 'CREATE_EVENT') {
      const eventEpoch = proposal.effectiveEpoch;
      if (eventEpoch < globalWorld.snapshot.epoch - 5) {
        return {
          passed: false,
          error: `Invariant Violation: Cannot insert event at Epoch ${eventEpoch}, which is prior to locked historical epoch horizon (${globalWorld.snapshot.epoch - 5}).`,
        };
      }
    }

    return { passed: true };
  }
}
