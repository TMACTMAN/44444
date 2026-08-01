import { HiddenTruth, Event } from '../types';
import { globalWorld } from './worldState';
import { recorder } from './recorder/recorder';
import { StateChangeProposal } from './recorder/changeSchemas';

export class TruthsEngine {
  public static async addEvidenceToTruth(truthId: string, evidenceName: string): Promise<{
    truth: HiddenTruth | undefined;
    isNowReadyToReveal: boolean;
  }> {
    const truth = globalWorld.hiddenTruths.get(truthId);
    if (!truth) return { truth: undefined, isNowReadyToReveal: false };

    const currentEpoch = globalWorld.snapshot.epoch;
    const proposal: StateChangeProposal = {
      id: `prop-evid-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      operation: 'COLLECT_EVIDENCE',
      entityType: 'TRUTH',
      entityId: truthId,
      payload: { truthId, evidenceName },
      effectiveEpoch: currentEpoch,
      preconditions: [],
      source: { type: 'SYSTEM', id: 'truthsEngine' },
    };

    await recorder.commit('world-snapshot-001', [proposal]);

    const updatedTruth = globalWorld.hiddenTruths.get(truthId);
    const isReady = updatedTruth
      ? updatedTruth.evidence_required.every((e) => updatedTruth.evidence_collected.includes(e))
      : false;

    return { truth: updatedTruth, isNowReadyToReveal: isReady };
  }

  public static async revealTruth(truthId: string, revealerId: string = 'pc-player'): Promise<{
    success: boolean;
    truth?: HiddenTruth;
    event?: Event;
    chainReactions: string[];
  }> {
    const truth = globalWorld.hiddenTruths.get(truthId);
    if (!truth) {
      return { success: false, chainReactions: ['未找到对应隐藏真相'] };
    }

    if (truth.revealed) {
      return { success: false, truth, chainReactions: ['真相已经被揭露过'] };
    }

    const currentEpoch = globalWorld.snapshot.epoch;
    const proposals: StateChangeProposal[] = [];
    const chainReactions: string[] = [];

    // Main reveal proposal
    proposals.push({
      id: `prop-reveal-${Date.now()}`,
      operation: 'REVEAL_TRUTH',
      entityType: 'TRUTH',
      entityId: truthId,
      payload: { truthId, revealerId },
      effectiveEpoch: currentEpoch,
      preconditions: [],
      source: { type: 'SYSTEM', id: 'truthsEngine' },
    });

    // Layer Specific Chain Reactions via proposals
    if (truth.layer === 'layer_1_personal_secrets') {
      chainReactions.push('矮人老洛得到了救赎契机，对玩家信任度大幅提升 (+25)');
      proposals.push({
        id: `prop-rel-${Date.now()}`,
        operation: 'CHANGE_RELATIONSHIP',
        entityType: 'CHARACTER',
        entityId: 'npc-old-lo',
        payload: { sourceCharacterId: 'npc-old-lo', targetCharacterId: revealerId, trustDelta: 25 },
        effectiveEpoch: currentEpoch,
        preconditions: [],
        source: { type: 'SYSTEM' },
      });
    } else if (truth.layer === 'layer_2_organization_conspiracies') {
      chainReactions.push('黑鸦商会的魔导仪式阴谋暴露，黑鸦与骑士团陷入全面战争！');
      chainReactions.push('圣光守卫团开启全城戒严，阴影巷犯罪率下降 20%');
      const alley = globalWorld.locations.get('loc-alley');
      if (alley) {
        proposals.push({
          id: `prop-loc-${Date.now()}`,
          operation: 'UPDATE_LOCATION',
          entityType: 'LOCATION',
          entityId: 'loc-alley',
          payload: { locationId: 'loc-alley', security: { crime_rate: Math.max(0, alley.security.crime_rate - 20) } },
          effectiveEpoch: currentEpoch,
          preconditions: [],
          source: { type: 'SYSTEM' },
        });
      }
    } else if (truth.layer === 'layer_3_world_lies') {
      chainReactions.push('迷雾森林古老沉睡巨兽的真相震惊整个王国，迷雾区域法力异动！');
      proposals.push({
        id: `prop-loc-forest-${Date.now()}`,
        operation: 'UPDATE_LOCATION',
        entityType: 'LOCATION',
        entityId: 'loc-forest',
        payload: { locationId: 'loc-forest', population_trend: 'STABLE' },
        effectiveEpoch: currentEpoch,
        preconditions: [],
        source: { type: 'SYSTEM' },
      });
    } else if (truth.layer === 'layer_4_cosmic_illusions') {
      chainReactions.push('【宇宙阶层震荡】时空因果树重启机制被侦测，全域魔法与力量爆发！');
    }

    const commitRes = await recorder.commit('world-snapshot-001', proposals);

    const updatedTruth = globalWorld.hiddenTruths.get(truthId);
    const createdEvent = commitRes.eventsGenerated.find((e) => e.type === 'TRUTH_REVEALED');

    return {
      success: commitRes.success,
      truth: updatedTruth,
      event: createdEvent,
      chainReactions,
    };
  }
}
