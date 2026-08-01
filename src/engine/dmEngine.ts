import { GoogleGenAI } from '@google/genai';
import { globalWorld } from './worldState';
import { SchedulerEngine } from './scheduler';
import { CausalityEngine } from './causality';
import { TruthsEngine } from './truthsEngine';
import { Location } from '../types';
import { recorder } from './recorder/recorder';
import { StateChangeProposal } from './recorder/changeSchemas';

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

export interface DMResponse {
  dmNarration: string;
  diceRoll?: { skill: string; roll: number; target: number; success: boolean };
  stateUpdatesSummary: string[];
  currentLocationName: string;
  epoch: number;
}

export class DMEngine {
  public static async processPlayerAction(playerActionText: string): Promise<DMResponse> {
    if (
      playerActionText.includes('世界观') ||
      playerActionText.includes('preset-') ||
      playerActionText.includes('赛博朋克') ||
      playerActionText.includes('东方修仙') ||
      playerActionText.includes('废土') ||
      playerActionText.includes('蒸汽')
    ) {
      globalWorld.initDefaultWorld();
    }

    const pc = globalWorld.characters.get('pc-player');
    const currentLocation = pc ? globalWorld.locations.get(pc.location_id) : null;
    const npcsHere = Array.from(globalWorld.characters.values()).filter(
      (c) => c.type === 'NPC' && c.location_id === pc?.location_id
    );
    const activeSeeds = Array.from(globalWorld.seeds.values()).filter((s) => s.status === 'IN_PROGRESS');
    const hiddenTruths = Array.from(globalWorld.hiddenTruths.values());

    const ai = getGenAI();

    if (!ai) {
      const fallbackNarration = `【DM 提示】(未检测到 GEMINI_API_KEY，使用基础规则DM反馈)
你尝试执行了动作：“${playerActionText}”。在 ${currentLocation?.name} 的空气中弥漫着蒸汽与煤烟，周围的 ${npcsHere.map((n) => n.name).join('、')} 警惕地看着你。局势依然在暗流涌动。`;

      await SchedulerEngine.processEpochTick();
      await CausalityEngine.tickSeeds();

      return {
        dmNarration: fallbackNarration,
        stateUpdatesSummary: ['纪元自动推进到 Epoch ' + globalWorld.snapshot.epoch],
        currentLocationName: currentLocation?.name || '未知',
        epoch: globalWorld.snapshot.epoch,
      };
    }

    try {
      globalWorld.totalLLMCalls++;
      globalWorld.llmCallsThisEpoch++;

      const knownLocations = Array.from(globalWorld.locations.values()).map((l) => ({
        id: l.id,
        name: l.name,
        type: l.type,
        description: l.description,
        connectedTo: l.connected_to,
      }));

      const systemPrompt = `你是一个跑团/AI Native 永恒世界 RPG 的全知【DM (Dungeon Master) 地下城主】。
设计核心哲学: 类似于《塞尔达传说: 荒野之息》的开放世界沙盒。精髓在于【世界推演】而非固定脚本剧本！
- 没有固定强制的线性剧情主线，由玩家自由决定道路与世界方向。
- 玩家可以通过接受雇佣兵/黑客/修仙/拾荒者悬赏任务、探索遗迹/废墟/荒区、偶遇打劫匪徒或遭遇派系冲突来逐步开启遭遇。
- 这些遭遇事件幕后可能潜伏着共同的幕后黑手或暗流，也可能只是世态常情，完全由玩家的探索与判断决定。
- 玩家随时可以自定义或补充世界观设定（例如设定某种特殊技术、宗门仙法、派系势力或大地理布局），你必须欣然接纳并将其融汇入世界大地图中！

当前纪元 (Epoch): ${globalWorld.snapshot.epoch}
当前主世界观: 【${globalWorld.snapshot.world_name}】 (${globalWorld.snapshot.world_description})

【后台完整世界状态与玩家数据 Context】:
1. 玩家角色卡:
   - 姓名: ${pc?.name} (${pc?.title})
   - 状态: HP ${pc?.attributes.hp}/${pc?.attributes.max_hp}, MP ${pc?.attributes.mp}/${pc?.attributes.max_mp}, 金币 ${pc?.resources.gold}G
   - 基础属性: STR ${pc?.attributes.strength}, DEX ${pc?.attributes.dexterity}, INT ${pc?.attributes.intelligence}, CHA ${pc?.attributes.charisma}
   - 技能列表: ${JSON.stringify(pc?.skills)}
   - 背包物品: ${JSON.stringify(pc?.inventory)}
   - 当前所在位置: 【${currentLocation?.name}】(${currentLocation?.description})

2. 世界地图已知地点 (Known Locations):
   - ${JSON.stringify(knownLocations)}

3. 本区域与全域 NPCs 状态:
   - 当前地点 NPC: ${JSON.stringify(npcsHere.map((n) => ({ id: n.id, name: n.name, title: n.title, goal: n.goal.primary, trust: n.relationships.find((r) => r.target_id === pc?.id)?.trust || 50 })))}

4. 活跃因果种子 (Seeds & Pressure):
   - 活跃 Seeds: ${JSON.stringify(activeSeeds.map((s) => ({ id: s.id, type: s.type, desc: s.visible_layer.description, progress: (s.progress * 100).toFixed(0) + '%' })))}

5. 4层隐藏真相板 (Hidden Truths):
   - ${JSON.stringify(hiddenTruths.map((t) => ({ layer: t.layer, title: t.title, revealed: t.revealed, evidence_collected: t.evidence_collected, evidence_required: t.evidence_required, true_nature: t.revealed ? t.true_nature : '未揭露' })))}

【玩家的输入/行动/询问】: "${playerActionText}"

【DM 的行为准则与响应要求】:
1. 一切世界推进与信息传达全凭你与玩家的对话！
2. 尊重玩家的世界观自定义与行动选择：如果玩家提出了对世界观的补充（如设定风土人情、派系规则、特殊术语），请顺应并将其织入故事中；如果玩家询问“有什么任务/附近有什么”，请以当前地点（如酒馆/客栈/黑市/驿站）告示板或NPC口述形式提供多样化的委托供玩家挑选！
3. 地图地点是无限扩展的！如果玩家探索未标记区域、走入新设施、进入神秘遗迹或前往新地点，你可以根据故事发展自由创作并生成新地点！
4. 如果玩家询问【个人状态、位置、背包物品、NPC关系、世界观真相、近况纪元】，请以 DM 沉浸专业且完全准确的态度，直接结合 Context 在对话中如实答复！
5. 【创角与逐步引导规则 (极其重要)】:
   - 创角完成的必要充分条件是同时具备三大核心要素：【1. 姓名(name)】、【2. 职业/身份背景(title)】、【3. 擅长技能/特点(skills)】。
   - 必须完全匹配当前选择的世界观【${globalWorld.snapshot.world_name}】与所在地点【${currentLocation?.name}】的氛围进行沉浸式描述和举例！
   - 如果玩家仅回答了部分信息（例如仅告知了姓名“叫我李飞”，但尚未说明职业与特长技能）：
     - 请仅在 characterUpdate 中更新已提供的字段（如 name: "李飞"）。
     - 严禁直接宣布创角完成或分配委托任务！
     - 必须在 dmNarration 中结合【${globalWorld.snapshot.world_name}】风格热情确认，并自然且明确地抛出下一个创角提问（针对当前世界观给予恰当的职业与技能举例）。
   - 只有当玩家通过逐步对话补齐了【姓名 + 职业 + 技能特点】，或者玩家直接选择了【一键创角模版】/一次性给出了全套资料时，方可判定创角完成，并在 dmNarration 中给出【创角完成，旅程开启】的沉浸式描述，引导玩家在当前地点【${currentLocation?.name}】正式展开冒险！
6. 如果玩家的行动触发了后端状态改变（包括创角/设定角色、开辟新地点、位置移动、生命/金币增减、搜集线索、NPC好感变化），请在返回 JSON 的结构化属性中准确写入，系统会自动同步后台引擎：
   - characterUpdate: 包含 name, title, skills 等键值的对象 (如果玩家设定/更改了角色名字、职业、称号或技能)
   - newLocation: { id: string (如 "loc-redleaf-inn"), name: string, type: "CITY"|"TOWN"|"FOREST"|"DUNGEON", description: string, connectedTo: string[] } (如果生成了新地点)
   - targetLocationId: string (如果玩家移动了位置，可以是已知地点ID或新生成的地点ID)
   - hpDelta: 整数 (如 -10 或 +15)
   - mpDelta: 整数
   - goldDelta: 整数
   - npcAffinityDelta: { npcId: string, trustDelta: number, favorDelta: number }
   - collectedEvidence: { truthId: string, evidenceName: string }
   - advanceEpoch: boolean (默认 true)
   - diceRoll: { skill: string, roll: number, target: number, success: boolean }

必须严格返回合法 JSON 格式:
{
  "dmNarration": "DM叙述或对玩家提问/创角设定的答复内容...",
  "diceRoll": { "skill": "侦察", "roll": 42, "target": 65, "success": true },
  "characterUpdate": null,
  "newLocation": null,
  "targetLocationId": null,
  "hpDelta": 0,
  "mpDelta": 0,
  "goldDelta": 0,
  "npcAffinityDelta": null,
  "collectedEvidence": null,
  "advanceEpoch": true
}`;

      const response = await ai.models.generateContent({
        model: 'gemini-3.6-flash',
        contents: systemPrompt,
        config: {
          responseMimeType: 'application/json',
        },
      });

      const rawText = response.text || '';
      const parsed = JSON.parse(rawText);

      const updatesSummary: string[] = [];
      const proposals: StateChangeProposal[] = [];
      const currentEpoch = globalWorld.snapshot.epoch;

      // Handle character updates
      if (pc && parsed.characterUpdate) {
        proposals.push({
          id: `prop-char-${Date.now()}`,
          operation: 'UPDATE_CHARACTER',
          entityType: 'CHARACTER',
          entityId: pc.id,
          payload: parsed.characterUpdate,
          effectiveEpoch: currentEpoch,
          preconditions: [],
          source: { type: 'LLM', id: 'dmEngine' },
        });
        updatesSummary.push(`👤 角色设定已生效: ${parsed.characterUpdate.name || pc.name} (${parsed.characterUpdate.title || pc.title})`);
      }

      // Handle LLM dynamic new location creation
      if (parsed.newLocation && parsed.newLocation.name) {
        const newLocId = parsed.newLocation.id || `loc-dyn-${Date.now()}`;
        const connectedLocs = Array.isArray(parsed.newLocation.connectedTo) && parsed.newLocation.connectedTo.length > 0
          ? parsed.newLocation.connectedTo
          : [pc?.location_id || 'loc-capital'];

        const newLocObj: Location = {
          id: newLocId,
          name: parsed.newLocation.name,
          type: parsed.newLocation.type || 'TOWN',
          description: parsed.newLocation.description || '由 DM 在探索中演化生成的新领域。',
          connected_to: connectedLocs,
          child_ids: [],
          population: 80,
          population_trend: 'STABLE',
          economy: { primary_industry: 'TRADE', wealth_level: 3, trade_goods: [], trade_routes: [] },
          security: { guard_presence: 40, crime_rate: 30 },
          active_events: [],
          features: [],
          frozen: false,
          simulation_level: 3,
          last_simulated_epoch: globalWorld.snapshot.epoch,
          created_at_epoch: globalWorld.snapshot.epoch,
          updated_at_epoch: globalWorld.snapshot.epoch,
        };

        proposals.push({
          id: `prop-newloc-${Date.now()}`,
          operation: 'CREATE_LOCATION',
          entityType: 'LOCATION',
          entityId: newLocId,
          payload: { location: newLocObj },
          effectiveEpoch: currentEpoch,
          preconditions: [],
          source: { type: 'LLM' },
        });

        connectedLocs.forEach((existingLocId: string) => {
          proposals.push({
            id: `prop-conn-${existingLocId}-${newLocId}-${Date.now()}`,
            operation: 'CONNECT_LOCATIONS',
            entityType: 'LOCATION',
            payload: { locationIdA: existingLocId, locationIdB: newLocId },
            effectiveEpoch: currentEpoch,
            preconditions: [],
            source: { type: 'LLM' },
          });
        });

        if (pc) {
          proposals.push({
            id: `prop-knowloc-${Date.now()}`,
            operation: 'UPDATE_CHARACTER_KNOWLEDGE',
            entityType: 'CHARACTER',
            entityId: pc.id,
            payload: { characterId: pc.id, knownLocation: newLocId },
            effectiveEpoch: currentEpoch,
            preconditions: [],
            source: { type: 'LLM' },
          });
        }

        if (parsed.targetLocationId === parsed.newLocation.id || !parsed.targetLocationId) {
          parsed.targetLocationId = newLocId;
        }

        updatesSummary.push(`🗺️ DM 动态演化出新地图领域: 【${newLocObj.name}】`);
      }

      // Apply location move via proposal
      if (parsed.targetLocationId && pc) {
        proposals.push({
          id: `prop-move-${Date.now()}`,
          operation: 'MOVE_CHARACTER',
          entityType: 'CHARACTER',
          entityId: pc.id,
          payload: { characterId: pc.id, targetLocationId: parsed.targetLocationId, bypassConnectivity: true },
          effectiveEpoch: currentEpoch,
          preconditions: [],
          source: { type: 'PLAYER_ACTION' },
        });
        const locName = globalWorld.locations.get(parsed.targetLocationId)?.name || parsed.targetLocationId;
        updatesSummary.push(`📍 移动到了区域: 【${locName}】`);
      }

      // Apply HP/MP/Gold deltas
      if (pc) {
        if (parsed.hpDelta || parsed.mpDelta) {
          proposals.push({
            id: `prop-attr-${Date.now()}`,
            operation: 'UPDATE_CHARACTER_ATTRIBUTES',
            entityType: 'CHARACTER',
            entityId: pc.id,
            payload: { characterId: pc.id, hpDelta: parsed.hpDelta || 0, mpDelta: parsed.mpDelta || 0 },
            effectiveEpoch: currentEpoch,
            preconditions: [],
            source: { type: 'LLM' },
          });
          if (parsed.hpDelta) updatesSummary.push(`❤️ 生命值 HP ${parsed.hpDelta > 0 ? '+' : ''}${parsed.hpDelta}`);
          if (parsed.mpDelta) updatesSummary.push(`✨ 魔力值 MP ${parsed.mpDelta > 0 ? '+' : ''}${parsed.mpDelta}`);
        }

        if (parsed.goldDelta) {
          proposals.push({
            id: `prop-gold-${Date.now()}`,
            operation: 'CHANGE_RESOURCE',
            entityType: 'CHARACTER',
            entityId: pc.id,
            payload: { characterId: pc.id, goldDelta: parsed.goldDelta },
            effectiveEpoch: currentEpoch,
            preconditions: [],
            source: { type: 'LLM' },
          });
          updatesSummary.push(`🪙 金币 ${parsed.goldDelta > 0 ? '+' : ''}${parsed.goldDelta}`);
        }
      }

      // Apply NPC relationship changes
      if (parsed.npcAffinityDelta && parsed.npcAffinityDelta.npcId && pc) {
        proposals.push({
          id: `prop-npc-rel-${Date.now()}`,
          operation: 'CHANGE_RELATIONSHIP',
          entityType: 'CHARACTER',
          entityId: parsed.npcAffinityDelta.npcId,
          payload: {
            sourceCharacterId: parsed.npcAffinityDelta.npcId,
            targetCharacterId: pc.id,
            trustDelta: parsed.npcAffinityDelta.trustDelta || 0,
            favorDelta: parsed.npcAffinityDelta.favorDelta || 0,
          },
          effectiveEpoch: currentEpoch,
          preconditions: [],
          source: { type: 'LLM' },
        });
        const npc = globalWorld.characters.get(parsed.npcAffinityDelta.npcId);
        updatesSummary.push(`🤝 对 ${npc ? npc.name : 'NPC'} 的信任度 ${parsed.npcAffinityDelta.trustDelta > 0 ? '+' : ''}${parsed.npcAffinityDelta.trustDelta || 0}`);
      }

      // Record DM turn event proposal
      proposals.push({
        id: `prop-dm-evt-${Date.now()}`,
        operation: 'CREATE_EVENT',
        entityType: 'EVENT',
        payload: {
          type: 'SOCIAL',
          description: `【DM 跑团回合】玩家推演: "${playerActionText}" -> DM: "${parsed.dmNarration.slice(0, 80)}..."`,
          location_id: pc?.location_id,
          involved_entity_ids: [pc?.id || ''],
        },
        effectiveEpoch: currentEpoch,
        preconditions: [],
        source: { type: 'LLM', id: 'dmEngine' },
      });

      // Commit all proposals authoritatively via Recorder
      if (proposals.length > 0) {
        const commitRes = await recorder.commit('world-snapshot-001', proposals);
        if (!commitRes.success) {
          console.warn('[DMEngine] Recorder commit warnings/errors:', commitRes.errors);
        }
      }

      // Apply Evidence Collection via TruthsEngine (which uses Recorder)
      if (parsed.collectedEvidence && parsed.collectedEvidence.truthId && parsed.collectedEvidence.evidenceName) {
        const res = await TruthsEngine.addEvidenceToTruth(
          parsed.collectedEvidence.truthId,
          parsed.collectedEvidence.evidenceName
        );
        updatesSummary.push(`🔍 搜集到了突破真相物证: 《${parsed.collectedEvidence.evidenceName}》`);
        if (res.isNowReadyToReveal) {
          updatesSummary.push(`🔑 【线索集齐警告】对应真相《${res.truth?.title}》物证已集齐，可随时手动打破！`);
        }
      }

      // Advance Epoch Tick if requested (uses Recorder inside Scheduler & Causality engines)
      if (parsed.advanceEpoch !== false) {
        await SchedulerEngine.processEpochTick();
        const seedEvents = await CausalityEngine.tickSeeds();
        updatesSummary.push(`⚡ 纪元推进至 Epoch ${globalWorld.snapshot.epoch}`);
        if (seedEvents.length > 0) {
          updatesSummary.push(`🌱 引发了 ${seedEvents.length} 个事件 Seed 结算波纹`);
        }
      }

      const updatedLoc = pc ? globalWorld.locations.get(pc.location_id) : null;

      return {
        dmNarration: parsed.dmNarration || '地下城主沉默片刻，世界在继续流转...',
        diceRoll: parsed.diceRoll || undefined,
        stateUpdatesSummary: updatesSummary,
        currentLocationName: updatedLoc?.name || '未知区域',
        epoch: globalWorld.snapshot.epoch,
      };
    } catch (err: any) {
      console.error('DM Engine Error:', err);
      return {
        dmNarration: `【DM 提示】你在风暴中静立片刻，隐隐察觉四周变局... (动作解析遇到微弱扰动)`,
        stateUpdatesSummary: ['纪元推进至 Epoch ' + globalWorld.snapshot.epoch],
        currentLocationName: currentLocation?.name || '未知',
        epoch: globalWorld.snapshot.epoch,
      };
    }
  }
}
