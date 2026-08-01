import { GoogleGenAI } from '@google/genai';
import { Character, CharacterMemoryItem } from '../types';
import { globalWorld } from './worldState';

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

export class NPCCognitionEngine {
  public static addMemory(characterId: string, text: string, importance: number = 3) {
    const npc = globalWorld.characters.get(characterId);
    if (!npc) return;

    npc.memory.short_term.push({
      text,
      importance,
      epoch: globalWorld.snapshot.epoch,
    });

    // Auto forge / compress if memory grows beyond 15 items
    if (npc.memory.short_term.length > 15) {
      this.forgeMemory(npc);
    }
  }

  public static forgeMemory(npc: Character) {
    if (npc.memory.short_term.length === 0) return;
    const itemsText = npc.memory.short_term.map((m) => m.text).join(' | ');
    npc.memory.compressed = npc.memory.compressed
      ? `${npc.memory.compressed} [纪元归档: ${itemsText}]`
      : itemsText;
    // Keep top 5 important memories
    npc.memory.short_term.sort((a, b) => b.importance - a.importance);
    npc.memory.short_term = npc.memory.short_term.slice(0, 5);
  }

  public static recallMemories(npc: Character, query: string): string[] {
    const results: string[] = [];
    const lowerQ = query.toLowerCase();

    for (const m of npc.memory.short_term) {
      if (m.text.toLowerCase().includes(lowerQ) || results.length < 3) {
        results.push(m.text);
      }
    }
    if (npc.memory.compressed && results.length < 5) {
      results.push(`【过往档案】: ${npc.memory.compressed}`);
    }
    return results;
  }

  public static async generateNPCDialogue(
    npcId: string,
    playerMessage: string,
    playerCharacterName: string = '卡尔'
  ): Promise<{
    reply: string;
    trustDelta: number;
    favorDelta: number;
    actionTriggered?: string;
  }> {
    const npc = globalWorld.characters.get(npcId);
    if (!npc) {
      return { reply: 'NPC不存在。', trustDelta: 0, favorDelta: 0 };
    }

    const ai = getGenAI();
    const recalledMemories = this.recallMemories(npc, playerMessage);

    if (!ai) {
      // Rule-based fallback if no Gemini key
      const fallbackReplies: Record<string, string> = {
        'npc-old-lo': `${npc.name} 抹了抹手上的铁屑，粗声说道：“小伙子，铁冠城现在不太平静。古矿坑的震动和阴影巷的黑鸦都不是好惹的... 你有事要找我打铁，还是想打听那批货？”`,
        'npc-lilith': `${npc.name} 优雅地把玩着黑匕首，嘴角微微勾起：“游浪者${playerCharacterName}，黑鸦商会欢迎聪明人。你在老洛店里看到的，最好留在心里。”`,
        'npc-elwin': `${npc.name} 握紧战锤，目光如炬：“${playerCharacterName}，守卫团正在全力维持秩序。如果你有阴影巷走私的新线索，立即禀报！”`,
      };

      const reply =
        fallbackReplies[npcId] ||
        `${npc.name} 仔细端详着你：“有什么事吗？在铁冠城说话最好小心点。”`;

      this.addMemory(npcId, `与玩家${playerCharacterName}交谈: "${playerMessage}" -> 回复了对方`, 2);

      return {
        reply,
        trustDelta: playerMessage.includes('帮忙') || playerMessage.includes('合作') ? 2 : 0,
        favorDelta: playerMessage.includes('老洛') || playerMessage.includes('朋友') ? 3 : 0,
      };
    }

    try {
      globalWorld.totalLLMCalls++;
      globalWorld.llmCallsThisEpoch++;

      const systemPrompt = `你是在 AI-Native RPG 世界【艾尔德兰】中扮演 NPC 的深度角色扮演引擎。
扮演角色信息:
- 姓名: ${npc.name} (${npc.title})
- 种族/年龄: ${npc.species}, ${npc.age}岁
- 身份/阵营: 位于 ${npc.location_id}
- 主要目标: ${npc.goal.primary}
- 内心恐惧: ${npc.fear}
- 性格标签: ${npc.personality.join(', ')}
- 当前检索到的重要记忆: ${recalledMemories.join('; ')}

玩家名称: ${playerCharacterName}
玩家说: "${playerMessage}"

请完全以 ${npc.name} 第一人称口吻进行沉浸式 RPG 回复！
要求:
1. 符合 NPC 的性格特征、语气口吻和个人利益。
2. 可以展示心理活动（放在括号中）。
3. 字数在 80-180 字之间。
4. 返回 JSON 格式，结构为:
{
  "reply": "NPC对话内容...",
  "trustDelta": 0, (整数 -5 到 5)
  "favorDelta": 0 (整数 -5 到 5)
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

      const trustDelta = typeof parsed.trustDelta === 'number' ? parsed.trustDelta : 0;
      const favorDelta = typeof parsed.favorDelta === 'number' ? parsed.favorDelta : 0;
      const reply = parsed.reply || `${npc.name} 沉吟了片刻...`;

      // Update relationships
      const playerChar = globalWorld.characters.get('pc-player');
      if (playerChar) {
        let rel = npc.relationships.find((r) => r.target_id === playerChar.id);
        if (!rel) {
          rel = {
            target_id: playerChar.id,
            target_name: playerChar.name,
            type: 'NEUTRAL',
            trust: 50,
            fear: 0,
            favor: 50,
            last_interaction_epoch: globalWorld.snapshot.epoch,
          };
          npc.relationships.push(rel);
        }
        rel.trust = Math.max(0, Math.min(100, rel.trust + trustDelta));
        rel.favor = Math.max(0, Math.min(100, rel.favor + favorDelta));
        rel.last_interaction_epoch = globalWorld.snapshot.epoch;
      }

      this.addMemory(npcId, `与${playerCharacterName}交谈: "${playerMessage}"`, 3);

      return {
        reply,
        trustDelta,
        favorDelta,
      };
    } catch (err: any) {
      console.error('NPC Gemini Dialogue Error:', err);
      return {
        reply: `${npc.name} 看了你一眼，缓缓说道：“现在铁冠城暗流涌动，我们要警惕四周...”`,
        trustDelta: 0,
        favorDelta: 0,
      };
    }
  }
}
