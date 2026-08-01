import { GoogleGenAI } from '@google/genai';
import { CausalityPressure, Event } from '../types';
import { globalWorld } from './worldState';
import { recorder } from './recorder/recorder';
import { StateChangeProposal } from './recorder/changeSchemas';
import { GlobalTimeline } from './timeline/globalTimeline';

let genAIClient: GoogleGenAI | null = null;

function getGenAI(): GoogleGenAI | null {
  if (!genAIClient && process.env.GEMINI_API_KEY) {
    genAIClient = new GoogleGenAI({
      apiKey: process.env.GEMINI_API_KEY,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        },
      },
    });
  }
  return genAIClient;
}

export class CausalityEngine {
  public static evaluatePressures(): CausalityPressure[] {
    const pressures: CausalityPressure[] = [];

    // 1. Evaluate Org Goal Pressures
    globalWorld.organizations.forEach((org) => {
      org.goals.forEach((goal) => {
        if (goal.status === 'ACTIVE') {
          const pressureVal = Math.min(100, Math.round((1 - goal.progress) * 70 + org.resources.military_power * 0.3));
          pressures.push({
            source: 'ORG_GOAL_PROGRESSION',
            entity_id: org.id,
            description: `${org.name} 试图推进目标: ${goal.description}`,
            pressure: pressureVal,
          });
        }
      });
    });

    // 2. Evaluate NPC Personal Motive Pressures
    globalWorld.characters.forEach((npc) => {
      if (npc.type !== 'PC' && npc.status === 'ALIVE' && npc.goal.primary) {
        pressures.push({
          source: 'NPC_PERSONAL_MOTIVE',
          entity_id: npc.id,
          description: `${npc.name} 的个人执念: ${npc.goal.primary}`,
          pressure: 55,
        });
      }
    });

    return pressures;
  }

  public static async tickSeeds(): Promise<Event[]> {
    const currentEpoch = globalWorld.snapshot.epoch;

    // Process timeline progression up to current epoch
    await GlobalTimeline.processUntil(globalWorld.snapshot.id || 'world-snapshot-001', currentEpoch);

    const proposals: StateChangeProposal[] = [];

    globalWorld.seeds.forEach((seed) => {
      if (seed.status !== 'IN_PROGRESS') return;

      const actor = seed.visible_layer.actor_ids[0]
        ? globalWorld.characters.get(seed.visible_layer.actor_ids[0])
        : null;

      let increment = 0.15;
      if (actor && actor.skills) {
        if (actor.skills['锻造'] || actor.skills['潜行'] || actor.skills['交涉']) {
          increment += 0.05;
        }
      }

      const newProgress = Math.min(1.0, seed.progress + increment);
      const isCompleted = newProgress >= 1.0;

      proposals.push({
        id: `prop-seed-${seed.id}-${Date.now()}`,
        operation: 'UPDATE_SEED',
        entityType: 'SEED',
        entityId: seed.id,
        payload: {
          seedId: seed.id,
          progress: newProgress,
          status: isCompleted ? 'COMPLETED' : 'IN_PROGRESS',
        },
        effectiveEpoch: currentEpoch,
        preconditions: [],
        source: { type: 'SIMULATION', id: 'causalityEngine' },
      });

      if (isCompleted) {
        const evtDesc = `【Seed 事件完成】${seed.visible_layer.description} (进度 100%)。其引发的连锁涟漪已扩散至周围区域。`;
        proposals.push({
          id: `prop-seed-evt-${seed.id}-${Date.now()}`,
          operation: 'CREATE_EVENT',
          entityType: 'EVENT',
          payload: {
            type: 'DISCOVERY',
            description: evtDesc,
            location_id: seed.visible_layer.location_id,
            involved_entity_ids: [...seed.visible_layer.actor_ids],
            effects: [
              {
                type: 'FACT_CHANGE',
                description: `Seed [${seed.type}] 执行完毕，引起局势动荡。`,
                target_type: 'LOCATION',
                target_id: seed.visible_layer.location_id,
                changes: {},
              },
            ],
          },
          effectiveEpoch: currentEpoch,
          preconditions: [],
          source: { type: 'SIMULATION', id: 'causalityEngine' },
        });

        // Relationship updates for actors
        const actorIds = seed.visible_layer.actor_ids;
        for (let i = 0; i < actorIds.length; i++) {
          for (let j = i + 1; j < actorIds.length; j++) {
            proposals.push({
              id: `prop-seed-rel-${actorIds[i]}-${actorIds[j]}-${Date.now()}`,
              operation: 'CHANGE_RELATIONSHIP',
              entityType: 'CHARACTER',
              entityId: actorIds[i],
              payload: {
                sourceCharacterId: actorIds[i],
                targetCharacterId: actorIds[j],
                trustDelta: 8,
                favorDelta: 5,
              },
              effectiveEpoch: currentEpoch,
              preconditions: [],
              source: { type: 'SIMULATION' },
            });
          }
        }
      }
    });

    if (proposals.length === 0) return [];

    const commitRes = await recorder.commit('world-snapshot-001', proposals);
    return commitRes.eventsGenerated;
  }

  public static async generateDeepCausalityEvaluation(): Promise<string> {
    const ai = getGenAI();
    if (!ai) {
      return 'AI 密钥未配置，使用标准规则推演世界因果：当前铁冠城局势处于微妙平衡，圣光守卫团与黑鸦商会在古矿坑外围胶着。';
    }

    try {
      globalWorld.totalLLMCalls++;
      globalWorld.llmCallsThisEpoch++;

      const activeSeeds = Array.from(globalWorld.seeds.values()).map((s) => ({
        type: s.type,
        desc: s.visible_layer.description,
        progress: s.progress,
      }));

      const response = await ai.models.generateContent({
        model: 'gemini-3.6-flash',
        contents: `你是一个 AI-Native 永恒世界 RPG 的【因果律推演引擎】。
当前世界: 艾尔德兰 (Eldlan)
当前纪元 (Epoch): ${globalWorld.snapshot.epoch}
活跃种子 Seed: ${JSON.stringify(activeSeeds, null, 2)}
主要势力: 黑鸦商会 (黑市/走私), 圣光守卫团 (治安/秩序), 矮人老洛 (锻造)

请以写实、严谨、充满奇幻魔导工业风格的语气，推演 1-2 段本纪元因果树的深层涟漪 (200字以内)。`,
      });

      return response.text || '因果树在静默中伸展枝桠...';
    } catch (err: any) {
      console.error('Gemini Causality Error:', err);
      return '因果推演引擎遇到微弱扰动，局势依然在按轨迹发展。';
    }
  }
}
