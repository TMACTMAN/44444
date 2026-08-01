import { WorldCondition, StateChangeProposal } from './changeSchemas';
import { WorldRepository } from '../world/worldRepository';
import { globalWorld } from '../worldState';

export class PreconditionEvaluator {
  public static evaluateCondition(condition: WorldCondition, entity: any): boolean {
    if (!entity) {
      return condition.operator === 'NEQ' || condition.operator === 'EXISTS' ? condition.value === false : false;
    }

    const val = entity[condition.field];

    switch (condition.operator) {
      case 'EQ':
        return val === condition.value;
      case 'NEQ':
        return val !== condition.value;
      case 'GT':
        return typeof val === 'number' && val > condition.value;
      case 'GTE':
        return typeof val === 'number' && val >= condition.value;
      case 'LT':
        return typeof val === 'number' && val < condition.value;
      case 'LTE':
        return typeof val === 'number' && val <= condition.value;
      case 'IN':
        return Array.isArray(condition.value) && condition.value.includes(val);
      case 'EXISTS':
        return val !== undefined && val !== null;
      default:
        return false;
    }
  }

  public static async evaluatePreconditions(
    worldId: string,
    conditions: WorldCondition[]
  ): Promise<{ passed: boolean; failedConditions: string[] }> {
    const failedConditions: string[] = [];

    for (const cond of conditions) {
      let entity: any = null;

      if (cond.subjectType === 'CHARACTER') {
        entity = globalWorld.characters.get(cond.subjectId) || (await WorldRepository.getCharacter(worldId, cond.subjectId));
      } else if (cond.subjectType === 'LOCATION') {
        entity = globalWorld.locations.get(cond.subjectId) || (await WorldRepository.getLocation(worldId, cond.subjectId));
      } else if (cond.subjectType === 'ORGANIZATION') {
        entity = globalWorld.organizations.get(cond.subjectId);
      } else if (cond.subjectType === 'SEED') {
        entity = globalWorld.seeds.get(cond.subjectId);
      } else if (cond.subjectType === 'TRUTH') {
        entity = globalWorld.hiddenTruths.get(cond.subjectId);
      }

      const passed = this.evaluateCondition(cond, entity);
      if (!passed) {
        failedConditions.push(
          `Precondition failed: ${cond.subjectType} ${cond.subjectId}.${cond.field} expected ${cond.operator} ${JSON.stringify(cond.value)}, got ${JSON.stringify(entity?.[cond.field])}`
        );
      }
    }

    return {
      passed: failedConditions.length === 0,
      failedConditions,
    };
  }
}

export class ObservedHistoryValidator {
  public static async validateProposalAgainstObservedHistory(
    worldId: string,
    proposal: StateChangeProposal
  ): Promise<{ valid: boolean; reason?: string }> {
    const observedIntervals = await WorldRepository.getObservedIntervals(worldId);
    if (observedIntervals.length === 0) return { valid: true };

    const proposalEpoch = proposal.effectiveEpoch;

    // Check if proposal tries to write an event or change state in a past interval that player directly observed
    for (const interval of observedIntervals) {
      const isPastEpoch = proposalEpoch >= interval.from_epoch && (interval.to_epoch ? proposalEpoch <= interval.to_epoch : true);
      if (isPastEpoch) {
        if (proposal.operation === 'CREATE_EVENT' && proposal.payload.isMajorEvent) {
          return {
            valid: false,
            reason: `Observed History Lock: Cannot insert major event into observed interval [Epoch ${interval.from_epoch} - ${interval.to_epoch || 'present'}] at location ${interval.location_id}`,
          };
        }
      }
    }

    return { valid: true };
  }
}
