import { WakeSignal, Character } from '../types';
import { globalWorld } from './worldState';
import { check7Invariants } from './invariants';
import { recorder } from './recorder/recorder';
import { StateChangeProposal } from './recorder/changeSchemas';
import { GlobalTimeline } from './timeline/globalTimeline';

export const WAKE_WEIGHTS: Record<string, number> = {
  PLAYER_APPROACH: 0,
  PLAYER_INVESTIGATE: 1,
  DEADLINE: 2,
  DEPENDENCY_WAKE: 3,
  ORGANIZATION_REQUIRES: 4,
  REGIONAL_SIMULATION: 5,
  CAUSALITY_PRESSURE: 6,
  PERIODIC_REFRESH: 7,
};

export const WAKE_COSTS: Record<string, number> = {
  PLAYER_APPROACH: 50,
  PLAYER_INVESTIGATE: 30,
  DEADLINE: 40,
  DEPENDENCY_WAKE: 20,
  ORGANIZATION_REQUIRES: 35,
  REGIONAL_SIMULATION: 60,
  CAUSALITY_PRESSURE: 25,
  PERIODIC_REFRESH: 10,
};

export class SchedulerEngine {
  public static pushWakeSignal(signal: WakeSignal) {
    signal.weight = WAKE_WEIGHTS[signal.reason] ?? 7;
    globalWorld.wakeQueue = globalWorld.wakeQueue.filter((s) => s.entity_id !== signal.entity_id);
    globalWorld.wakeQueue.push(signal);
    globalWorld.wakeQueue.sort((a, b) => a.weight - b.weight);
  }

  public static async processEpochTick(): Promise<{
    epoch: number;
    woken_entities: string[];
    events_generated: number;
    catchup_performed: number;
    warnings: string[];
  }> {
    const proposals: StateChangeProposal[] = [];
    const targetEpoch = globalWorld.snapshot.epoch + 1;

    // Advance Epoch proposal
    proposals.push({
      id: `prop-epoch-${Date.now()}`,
      operation: 'ADVANCE_WORLD_EPOCH',
      entityType: 'WORLD',
      payload: { advanceBy: 1 },
      effectiveEpoch: targetEpoch,
      preconditions: [],
      source: { type: 'SCHEDULER', id: 'schedulerEngine' },
    });

    const wokenEntities: string[] = [];
    let catchupCount = 0;

    // 1. Resolve and Allocate Wake Signals
    const budget = 1000;
    let allocatedBudget = 0;
    const signalsToProcess = [...globalWorld.wakeQueue];
    globalWorld.wakeQueue = [];

    for (const signal of signalsToProcess) {
      const cost = WAKE_COSTS[signal.reason] ?? 20;
      if (allocatedBudget + cost <= budget) {
        allocatedBudget += cost;
        const char = globalWorld.characters.get(signal.entity_id);
        if (char && char.status !== 'DEAD') {
          const elapsed = targetEpoch - char.last_simulated_epoch;
          if (elapsed > 1) {
            this.buildCatchUpProposals(char, elapsed, targetEpoch, proposals);
            catchupCount++;
          }
          proposals.push({
            id: `prop-sim-${char.id}-${Date.now()}`,
            operation: 'SET_ENTITY_SIMULATION_STATE',
            entityType: 'CHARACTER',
            entityId: char.id,
            payload: {
              entityType: 'CHARACTER',
              entityId: char.id,
              frozen: false,
              lastSimulatedEpoch: targetEpoch,
            },
            effectiveEpoch: targetEpoch,
            preconditions: [],
            source: { type: 'SCHEDULER' },
          });
          wokenEntities.push(char.name);
        }
      } else {
        globalWorld.wakeQueue.push(signal);
      }
    }

    // Auto-wake NPCs in same location as Player PC
    const pc = globalWorld.characters.get('pc-player');
    if (pc) {
      globalWorld.characters.forEach((char) => {
        if (char.id !== pc.id && char.location_id === pc.location_id && char.status !== 'DEAD') {
          if (char.frozen) {
            const elapsed = targetEpoch - char.last_simulated_epoch;
            if (elapsed > 1) {
              this.buildCatchUpProposals(char, elapsed, targetEpoch, proposals);
              catchupCount++;
            }
            proposals.push({
              id: `prop-autowake-${char.id}-${Date.now()}`,
              operation: 'SET_ENTITY_SIMULATION_STATE',
              entityType: 'CHARACTER',
              entityId: char.id,
              payload: {
                entityType: 'CHARACTER',
                entityId: char.id,
                frozen: false,
                lastSimulatedEpoch: targetEpoch,
              },
              effectiveEpoch: targetEpoch,
              preconditions: [],
              source: { type: 'SCHEDULER' },
            });
            if (!wokenEntities.includes(char.name)) {
              wokenEntities.push(char.name);
            }
          }
        } else if (char.type !== 'PC' && char.status !== 'DEAD' && char.location_id !== pc.location_id) {
          proposals.push({
            id: `prop-freeze-${char.id}-${Date.now()}`,
            operation: 'SET_ENTITY_SIMULATION_STATE',
            entityType: 'CHARACTER',
            entityId: char.id,
            payload: {
              entityType: 'CHARACTER',
              entityId: char.id,
              frozen: true,
            },
            effectiveEpoch: targetEpoch,
            preconditions: [],
            source: { type: 'SCHEDULER' },
          });
        }
      });
    }

    // Commit all proposals via Recorder
    await recorder.commit('world-snapshot-001', proposals);

    // Process global timeline up to current epoch in database
    const worldId = globalWorld.snapshot.id || 'world-snapshot-001';
    await GlobalTimeline.processUntil(worldId, globalWorld.snapshot.epoch);

    // 4. Run safety 7 Invariant Checks
    const invariantRes = check7Invariants(
      globalWorld.snapshot,
      Array.from(globalWorld.characters.values()),
      Array.from(globalWorld.seeds.values()),
      globalWorld.events
    );

    return {
      epoch: globalWorld.snapshot.epoch,
      woken_entities: wokenEntities,
      events_generated: 0,
      catchup_performed: catchupCount,
      warnings: invariantRes.warnings,
    };
  }

  private static buildCatchUpProposals(
    character: Character,
    elapsed: number,
    targetEpoch: number,
    proposals: StateChangeProposal[]
  ) {
    if (elapsed > 5) {
      const summaryEpochs = elapsed - 5;
      proposals.push({
        id: `prop-mem-${character.id}-${Date.now()}`,
        operation: 'UPDATE_CHARACTER_MEMORY',
        entityType: 'CHARACTER',
        entityId: character.id,
        payload: {
          characterId: character.id,
          memoryItem: {
            text: `[Catch-up 摘要] 在过去 ${summaryEpochs} 个纪元里，${character.name} 在 ${character.location_id} 保持常态，静观变局。`,
            importance: 2,
            epoch: targetEpoch,
          },
        },
        effectiveEpoch: targetEpoch,
        preconditions: [],
        source: { type: 'SIMULATION' },
      });
    }
  }
}
