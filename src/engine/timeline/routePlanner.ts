import { WorldRepository } from '../world/worldRepository';
import { LocationEdge, Location } from '../../types';
import { RoutePathResult } from './timelineTypes';
import { TimelineError } from './timelineErrors';

export class RoutePlanner {
  public static async findRoute(
    worldId: string,
    originId: string,
    destinationId: string,
    speedMultiplier = 1.0
  ): Promise<RoutePathResult> {
    if (originId === destinationId) {
      return {
        path: [originId],
        edges: [],
        totalDistance: 0,
        totalCost: 0,
        totalEpochs: 0,
      };
    }

    // 1. Fetch edges from DB
    let edges = await WorldRepository.getAllLocationEdges(worldId);

    // Fallback if no edges in DB: construct virtual edges from Location connected_to
    if (edges.length === 0) {
      const locations = await WorldRepository.getAllLocations(worldId);
      const locMap = new Map<string, Location>(locations.map((l) => [l.id, l]));
      const generatedEdges: LocationEdge[] = [];
      for (const loc of locations) {
        for (const connId of loc.connected_to) {
          generatedEdges.push({
            id: `edge-${loc.id}-${connId}`,
            world_id: worldId,
            from_location_id: loc.id,
            to_location_id: connId,
            distance: 1.0,
            travel_cost: 1.0,
            travel_time_epochs: 1,
            status: 'OPEN',
          });
        }
      }
      edges = generatedEdges;
    }

    // Build adjacency graph for OPEN edges
    const graph = new Map<string, { to: string; edge: LocationEdge; weight: number }[]>();
    for (const edge of edges) {
      if (edge.status && edge.status !== 'OPEN') continue; // Skip blocked/closed edges

      const weight = Math.max(1, Math.ceil((edge.travel_time_epochs || 1) / speedMultiplier));
      if (!graph.has(edge.from_location_id)) {
        graph.set(edge.from_location_id, []);
      }
      graph.get(edge.from_location_id)!.push({
        to: edge.to_location_id,
        edge,
        weight,
      });
    }

    // Check if origin & destination exist in locations
    const originExists = await WorldRepository.getLocation(worldId, originId);
    const destExists = await WorldRepository.getLocation(worldId, destinationId);

    if (!originExists) {
      throw new TimelineError('INVALID_ROUTE', `Origin location [${originId}] does not exist`);
    }
    if (!destExists) {
      throw new TimelineError('DESTINATION_BLOCKED', `Destination location [${destinationId}] does not exist`);
    }

    // Dijkstra algorithm
    const distances = new Map<string, number>();
    const previous = new Map<string, { node: string; edge: LocationEdge; weight: number }>();
    const unvisited = new Set<string>();

    distances.set(originId, 0);

    // Collect all reachable nodes
    const allNodes = new Set<string>();
    allNodes.add(originId);
    allNodes.add(destinationId);
    for (const [fromNode, edgeList] of graph.entries()) {
      allNodes.add(fromNode);
      for (const e of edgeList) allNodes.add(e.to);
    }

    for (const node of allNodes) {
      if (node !== originId) distances.set(node, Infinity);
      unvisited.add(node);
    }

    while (unvisited.size > 0) {
      // Find smallest unvisited
      let current: string | null = null;
      let smallestDist = Infinity;
      for (const node of unvisited) {
        const dist = distances.get(node) ?? Infinity;
        if (dist < smallestDist) {
          smallestDist = dist;
          current = node;
        }
      }

      if (!current || smallestDist === Infinity) break;
      if (current === destinationId) break; // Found shortest path to target

      unvisited.delete(current);

      const neighbors = graph.get(current) || [];
      for (const neighbor of neighbors) {
        if (!unvisited.has(neighbor.to)) continue;

        const alt = smallestDist + neighbor.weight;
        if (alt < (distances.get(neighbor.to) ?? Infinity)) {
          distances.set(neighbor.to, alt);
          previous.set(neighbor.to, { node: current, edge: neighbor.edge, weight: neighbor.weight });
        }
      }
    }

    if (!previous.has(destinationId) && originId !== destinationId) {
      throw new TimelineError(
        'INVALID_ROUTE',
        `No open route found between [${originId}] and [${destinationId}]`
      );
    }

    // Reconstruct path
    const path: string[] = [destinationId];
    const pathEdges: LocationEdge[] = [];
    let curr = destinationId;
    let totalDistance = 0;
    let totalCost = 0;
    let totalEpochs = 0;

    while (previous.has(curr)) {
      const prevInfo = previous.get(curr)!;
      path.unshift(prevInfo.node);
      pathEdges.unshift(prevInfo.edge);
      totalDistance += prevInfo.edge.distance ?? 1.0;
      totalCost += prevInfo.edge.travel_cost ?? 1.0;
      totalEpochs += prevInfo.weight;
      curr = prevInfo.node;
    }

    return {
      path,
      edges: pathEdges,
      totalDistance,
      totalCost,
      totalEpochs,
    };
  }
}
