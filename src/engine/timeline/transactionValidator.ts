import { WorldRepository } from '../world/worldRepository';
import { TimelineError } from './timelineErrors';
import { TravelPlanRequest } from './timelineTypes';

export class TransactionValidator {
  public static async validateTravelPlanRequest(req: TravelPlanRequest): Promise<void> {
    const { worldId, actorId, destinationLocationId, startEpoch } = req;

    // 1. Actor Existence and Status
    const actor = await WorldRepository.getCharacter(worldId, actorId);
    if (!actor) {
      throw new TimelineError('ACTOR_BUSY', `Actor [${actorId}] does not exist in world [${worldId}]`);
    }

    if (actor.status === 'DEAD' || actor.presence_state === 'DEAD') {
      throw new TimelineError('ACTOR_DEAD', `Actor [${actorId}] is DEAD and cannot initiate travel`);
    }

    // Check if actor is already IN_TRANSIT
    if (actor.presence_state === 'IN_TRANSIT' || actor.current_transaction_id) {
      throw new TimelineError(
        'ACTOR_BUSY',
        `Actor [${actorId}] is already in transit (Transaction: ${actor.current_transaction_id})`
      );
    }

    // Check if actor has active IN_PROGRESS or PLANNED transactions
    const activeTxList = await WorldRepository.getTransactionsForActor(worldId, actorId);
    const pendingTx = activeTxList.find((t) => t.status === 'PLANNED' || t.status === 'IN_PROGRESS');
    if (pendingTx) {
      throw new TimelineError(
        'ACTOR_BUSY',
        `Actor [${actorId}] already has active transaction [${pendingTx.id}] with status [${pendingTx.status}]`
      );
    }

    // 2. Location & Origin
    if (!actor.location_id) {
      throw new TimelineError('ORIGIN_MISMATCH', `Actor [${actorId}] has no location_id set`);
    }

    const originLoc = await WorldRepository.getLocation(worldId, actor.location_id);
    if (!originLoc) {
      throw new TimelineError('ORIGIN_MISMATCH', `Origin location [${actor.location_id}] does not exist`);
    }

    const destLoc = await WorldRepository.getLocation(worldId, destinationLocationId);
    if (!destLoc) {
      throw new TimelineError('DESTINATION_BLOCKED', `Destination location [${destinationLocationId}] does not exist`);
    }

    if (actor.location_id === destinationLocationId) {
      throw new TimelineError(
        'INVALID_ROUTE',
        `Actor [${actorId}] is already at destination [${destinationLocationId}]`
      );
    }
  }
}
