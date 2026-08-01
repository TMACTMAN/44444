import { WorldTransaction, ScheduledCheckpoint, LocationEdge } from '../../types';

export interface TravelPlanRequest {
  worldId: string;
  actorId: string;
  destinationLocationId: string;
  startEpoch: number;
  parentSeedId?: string;
  parentOrganizationId?: string;
  speedMultiplier?: number;
}

export interface RoutePathResult {
  path: string[];
  edges: LocationEdge[];
  totalDistance: number;
  totalCost: number;
  totalEpochs: number;
}

export interface TravelPlanResult {
  transaction: WorldTransaction;
  checkpoints: ScheduledCheckpoint[];
  totalDistance: number;
  totalEpochs: number;
  route: string[];
}
