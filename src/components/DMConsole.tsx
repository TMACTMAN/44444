import { Sparkles, Send, Dices, MapPin, Heart, Coins, Shield, Flame, Compass, RefreshCw, Image as ImageIcon } from 'lucide-react';
import React, { useState, useRef, useEffect } from 'react';
import { Character, Location } from '../types';

export interface DMConsoleMessage {
  id: string;
  sender: 'PLAYER' | 'DM';
  text: string;
  diceRoll?: { skill: string; roll: number; target: number; success: boolean };
  stateUpdates?: string[];
  timestamp: string;
  epoch: number;
}

interface DMConsoleProps {
  playerCharacter: Character;
  currentLocation?: Location;
  npcsHere: Character[];
  onPlayerActionSubmit: (actionText: string) => Promise<{
    dmNarration: string;
    diceRoll?: { skill: string; roll: number; target: number; success: boolean };
    stateUpdatesSummary: string[];
    currentLocationName: string;
    epoch: number;
  }>;
  onRefreshWorld: () => void;
  isDMProcessing: boolean;
  messages: DMConsoleMessage[];
  setMessages: React.Dispatch<React.SetStateAction<DMConsoleMessage[]>>;
  onGenerateArtForNarration?: (locationName: string, narrationSummary: string) => void;
  artQuotas?: number;
}

export const DMConsole: React.FC<DMConsoleProps> = ({
  playerCharacter,
  currentLocation,
  npcsHere,
  onPlayerActionSubmit,
  onRefreshWorld,
  isDMProcessing,
  messages,
  setMessages,
  onGenerateArtForNarration,
  artQuotas,
}) => {
  const [inputAction, setInputAction] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const hasName = Boolean(
    playerCharacter.name &&
      playerCharacter.name !== '未知旅人' &&
      playerCharacter.name !== '无名者' &&
      playerCharacter.name !== '罗兰 (Roland)'
  );

  const hasTitle = Boolean(
    playerCharacter.title &&
      playerCharacter.title !== '未定职业' &&
      playerCharacter.title !== '荒野流浪者' &&
      playerCharacter.title !== '流浪者' &&
      playerCharacter.title !== '未知' &&
      playerCharacter.title !== '无业'
  );

  const hasSkills = Array.isArray(playerCharacter.skills)
    ? playerCharacter.skills.length > 0
    : Object.keys(playerCharacter.skills || {}).length > 0 &&
      !Object.keys(playerCharacter.skills || {}).includes('通用');

  // 必须同时具备【姓名】、【职业身份】与【擅长特质技能】三大要素才算创角完成
  const isCharacterCreated = hasName && hasTitle && hasSkills;
  const [showQuickPills, setShowQuickPills] = useState(!isCharacterCreated);

  useEffect(() => {
    if (isCharacterCreated) {
      setShowQuickPills(false);
    }
  }, [isCharacterCreated]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isDMProcessing]);

  const handleSend = async (actionTextToSend?: string) => {
    const text = actionTextToSend || inputAction;
    if (!text.trim() || isDMProcessing) return;

    const playerMsg: DMConsoleMessage = {
      id: `p-${Date.now()}`,
      sender: 'PLAYER',
      text: text,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      epoch: 0,
    };

    setMessages((prev) => [...prev, playerMsg]);
    if (!actionTextToSend) setInputAction('');

    try {
      const res = await onPlayerActionSubmit(text);

      const dmMsg: DMConsoleMessage = {
        id: `dm-${Date.now()}`,
        sender: 'DM',
        text: res.dmNarration,
        diceRoll: res.diceRoll,
        stateUpdates: res.stateUpdatesSummary,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        epoch: res.epoch,
      };

      setMessages((prev) => [...prev, dmMsg]);
      onRefreshWorld();
    } catch (err) {
      console.error('Failed to get DM response:', err);
    }
  };

  const worldPresets = [
    { label: '🏰 蒸汽与魔导', text: '【选择世界观】蒸汽与魔导纪元（工业革命与魔导遗迹，位于红叶雇佣兵酒馆）' },
    { label: '🏙️ 赛博朋克', text: '【选择世界观】赛博朋克 • 霓虹深渊（义体改造与巨企统治，位于地下黑客酒吧）' },
    { label: '☯️ 东方修仙', text: '【选择世界观】东方修仙 • 苍穹道界（宗门林立与大道争锋，位于云来客栈）' },
    { label: '☢️ 废土余晖', text: '【选择世界观】废土废墟 • 末日余晖（辐射风暴与变异异种，位于拾荒者驿站）' },
  ];

  const step1Names = [
    '叫我【李飞】，称号【破晓游侠】',
    '叫我【卡尔】，称号【孤胆猎魔人】',
    '叫我【陆沉】，称号【蜀山剑客】',
    '叫我【V】，称号【赛博浪客】',
  ];

  const step2Jobs = [
    '我是一名独立游浪的荒野雇佣兵',
    '我是一名擅长法术与解密的魔导法师',
    '我是一名修仙宗门的散修剑客',
    '我是一名出没于黑市的地下黑客',
  ];

  const step3Skills = [
    '我擅长【敏捷剑术】与【暗杀偷袭】',
    '我擅长【火系爆裂魔法】与【解密】',
    '我擅长【御剑术】与【三昧真火】',
    '我擅长【赛博黑客】与【枪斗术】',
  ];

  const step4Styles = [
    '偏好蒸汽轰鸣与魔导工业革命风格',
    '偏好高天巨企与霓虹近未来赛博风',
    '偏好灵气复苏与仙魔争锋玄幻风',
    '偏好废土辐射与末日生存遗迹风',
  ];

  const characterPresets = [
    { label: '🗡️ 艾尔德兰猎魔人', text: '我的名字叫卡尔，职业是【孤胆猎魔人】，精通双剑与暗杀技巧，性格冷酷利落，崇尚自由。' },
    { label: '🏙️ 赛博黑客浪客', text: '我的名字叫 V，职业是【黑客浪客】，精通赛博潜入与高阶黑枪斗术，在下层区追寻真相。' },
    { label: '☯️ 蜀山散修剑客', text: '我的名字叫陆沉，职业是【散修剑客】，精通御剑术与三昧真火，誓要在苍穹道界踏寻仙途。' },
  ];

  const quickActions = [
    '📜 询问老村长：“村里有什么雇佣兵委托任务？”',
    '🗺️ 询问流浪商人：“这附近有什么危险荒野或古遗迹？”',
    '🎒 询问 DM：“检查我当前的属性、背包物品与金币”',
    '🌲 离开营地，小心翼翼地前往风蚀荒野探索',
  ];

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl flex flex-col h-[calc(100vh-160px)] min-h-[500px] sm:h-[680px] overflow-hidden">
      {/* Console Top Header */}
      <div className="bg-slate-950 px-3 sm:px-6 py-2.5 sm:py-4 border-b border-slate-800 flex items-center justify-between">
        <div className="flex items-center gap-2.5 sm:gap-3">
          <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-gradient-to-tr from-amber-500 to-indigo-600 p-0.5 shadow-lg flex items-center justify-center shrink-0">
            <Sparkles className="w-4 h-4 sm:w-5 sm:h-5 text-slate-950" />
          </div>
          <div>
            <h2 className="text-xs sm:text-sm font-bold text-slate-100 flex items-center gap-1.5 sm:gap-2">
              AI 地下城主 (DM) 主控台
              <span className="px-1.5 sm:px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 text-[9px] sm:text-[10px] font-mono border border-amber-500/30">
                Gemini 3.6 Flash
              </span>
            </h2>
            <p className="text-[10px] sm:text-[11px] text-slate-400 hidden xs:block">自然语言自由行动或询问（如“我当前属性”、“附近委托”）• DM 实时判断</p>
          </div>
        </div>
      </div>

      {/* Messages Stream Log */}
      <div className="flex-1 p-3 sm:p-6 overflow-y-auto space-y-4 sm:space-y-6 bg-slate-950/40">
        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`flex flex-col ${msg.sender === 'PLAYER' ? 'items-end' : 'items-start'}`}
          >
            {/* Sender Badge */}
            <div className="flex items-center gap-1.5 sm:gap-2 mb-1 text-[10px] sm:text-[11px] text-slate-400 font-mono">
              <span className={msg.sender === 'DM' ? 'text-amber-400 font-bold' : 'text-indigo-400 font-bold'}>
                {msg.sender === 'DM' ? '🎲 AI Dungeon Master' : `👤 ${playerCharacter.name}`}
              </span>
              <span>• {msg.timestamp}</span>
              {msg.epoch > 0 && <span className="hidden xs:inline">• Epoch {msg.epoch}</span>}
            </div>

            {/* Message Box */}
            <div
              className={`max-w-[92%] sm:max-w-2xl rounded-2xl p-3 sm:p-4 shadow-xl border text-xs leading-relaxed ${
                msg.sender === 'PLAYER'
                  ? 'bg-indigo-600/20 border-indigo-500/40 text-indigo-100 rounded-tr-none'
                  : 'bg-slate-900/90 border-slate-800 text-slate-200 rounded-tl-none font-serif'
              }`}
            >
              <p className="whitespace-pre-wrap">{msg.text}</p>

              {/* Dice Roll Display */}
              {msg.diceRoll && (
                <div className="mt-3 bg-slate-950/80 border border-slate-800 p-2.5 rounded-xl flex items-center justify-between text-[11px] font-mono">
                  <span className="text-slate-400 flex items-center gap-1.5">
                    <Dices className="w-4 h-4 text-amber-400 animate-bounce" />
                    技能检定【{msg.diceRoll.skill}】(1d100)
                  </span>
                  <div className="flex items-center gap-2">
                    <span className="text-slate-400">掷出: {msg.diceRoll.roll} / 难度: {msg.diceRoll.target}</span>
                    <span
                      className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                        msg.diceRoll.success
                          ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                          : 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                      }`}
                    >
                      {msg.diceRoll.success ? '成功 PASS' : '失败 FAIL'}
                    </span>
                  </div>
                </div>
              )}

              {/* World State Updates Log */}
              {msg.stateUpdates && msg.stateUpdates.length > 0 && (
                <div className="mt-3 pt-2 border-t border-slate-800/80 space-y-1 text-[11px]">
                  <span className="text-amber-400 font-mono font-bold block mb-1">⚡ 世界因果响动 (World State Mutated):</span>
                  {msg.stateUpdates.map((upd, idx) => (
                    <div key={idx} className="text-slate-300 font-mono flex items-center gap-1.5">
                      <span>{upd}</span>
                    </div>
                  ))}
                </div>
              )}

              {/* Generate AI Art Card for DM narration */}
              {msg.sender === 'DM' && onGenerateArtForNarration && (
                <div className="mt-3 pt-2 border-t border-slate-800/60 flex items-center justify-between text-[11px]">
                  <span className="text-slate-500 font-mono">🎨 会员专属AI 场景画卷功能</span>
                  <button
                    onClick={() => onGenerateArtForNarration(currentLocation?.name || '未知区域', msg.text)}
                    className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-indigo-950 hover:bg-indigo-900 text-indigo-300 border border-indigo-500/30 font-bold transition cursor-pointer hover:border-indigo-400"
                  >
                    <ImageIcon className="w-3.5 h-3.5 text-indigo-400" />
                    <span>生成当前场景画卷</span>
                  </button>
                </div>
              )}
            </div>
          </div>
        ))}

        {isDMProcessing && (
          <div className="flex flex-col items-start">
            <div className="flex items-center gap-2 text-[11px] text-amber-400 font-mono mb-1">
              <Sparkles className="w-3.5 h-3.5 animate-spin" />
              <span>DM 正结合艾尔德兰永恒因果律推演剧情中...</span>
            </div>
            <div className="bg-slate-900 border border-slate-800 p-4 rounded-2xl rounded-tl-none text-xs text-slate-400 animate-pulse">
              地下城主正在投掷暗骰、调取 NPC 动机、推进因果压力...
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Character Creation & Quick Action Pills */}
      {!isCharacterCreated ? (
        <div className="px-3 sm:px-6 py-2 sm:py-2.5 bg-slate-950/95 border-t border-slate-800/80 space-y-1.5 sm:space-y-2 text-[10px] sm:text-[11px]">
          {/* World Preset Selection Row */}
          <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-none pb-1">
            <span className="text-amber-400 font-bold whitespace-nowrap font-mono flex items-center gap-1 mr-0.5 shrink-0">
              <Compass className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-amber-400 animate-pulse" />
              1. 优先选世界观:
            </span>
            {worldPresets.map((wp, idx) => (
              <button
                key={`wp-${idx}`}
                onClick={() => handleSend(wp.text)}
                disabled={isDMProcessing}
                className="px-2.5 py-0.5 sm:px-3 sm:py-1 rounded-md bg-amber-500/15 hover:bg-amber-500/25 text-amber-300 border border-amber-500/30 transition whitespace-nowrap cursor-pointer disabled:opacity-50 font-medium"
              >
                {wp.label}
              </button>
            ))}
          </div>

          {/* Onboarding Steps Shortcuts */}
          <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-none pt-1 border-t border-slate-800/60 pb-0.5">
            <span className="text-slate-300 font-bold whitespace-nowrap font-mono flex items-center gap-1 mr-0.5 shrink-0">
              <Sparkles className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-indigo-400" />
              2. 创角要素逐步选:
            </span>
            {step1Names.map((item, idx) => (
              <button
                key={`s1-${idx}`}
                onClick={() => handleSend(item)}
                disabled={isDMProcessing}
                className="px-2 py-0.5 sm:px-2.5 sm:py-1 rounded-md bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 border border-amber-500/20 transition whitespace-nowrap cursor-pointer disabled:opacity-50"
              >
                1. {item}
              </button>
            ))}
            {step2Jobs.map((item, idx) => (
              <button
                key={`s2-${idx}`}
                onClick={() => handleSend(item)}
                disabled={isDMProcessing}
                className="px-2 py-0.5 sm:px-2.5 sm:py-1 rounded-md bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-300 border border-indigo-500/20 transition whitespace-nowrap cursor-pointer disabled:opacity-50"
              >
                2. {item}
              </button>
            ))}
            {step3Skills.map((item, idx) => (
              <button
                key={`s3-${idx}`}
                onClick={() => handleSend(item)}
                disabled={isDMProcessing}
                className="px-2 py-0.5 sm:px-2.5 sm:py-1 rounded-md bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-300 border border-emerald-500/20 transition whitespace-nowrap cursor-pointer disabled:opacity-50"
              >
                3. {item}
              </button>
            ))}
            {step4Styles.map((item, idx) => (
              <button
                key={`s4-${idx}`}
                onClick={() => handleSend(item)}
                disabled={isDMProcessing}
                className="px-2 py-0.5 sm:px-2.5 sm:py-1 rounded-md bg-sky-500/10 hover:bg-sky-500/20 text-sky-300 border border-sky-500/20 transition whitespace-nowrap cursor-pointer disabled:opacity-50"
              >
                4. {item}
              </button>
            ))}
          </div>

          {/* Full Templates */}
          <div className="flex items-center gap-1.5 sm:gap-2 overflow-x-auto scrollbar-none pt-1 border-t border-slate-800/60">
            <span className="text-slate-400 whitespace-nowrap font-mono flex items-center gap-1 shrink-0">
              <Compass className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-indigo-400" />
              一键创角模版:
            </span>
            {characterPresets.map((preset, idx) => (
              <button
                key={`p-${idx}`}
                onClick={() => handleSend(preset.text)}
                disabled={isDMProcessing}
                title={preset.text}
                className="px-2.5 sm:px-3 py-0.5 sm:py-1 rounded-full bg-slate-900 hover:bg-slate-800 text-amber-300 border border-amber-500/30 hover:border-amber-400 transition whitespace-nowrap cursor-pointer disabled:opacity-50 font-medium shrink-0"
              >
                {preset.label}
              </button>
            ))}
          </div>
        </div>
      ) : (
        /* Game Started Mode: Clean Bar with optional toggle for quick exploration actions */
        <div className="px-3 sm:px-6 py-1.5 bg-slate-950/90 border-t border-slate-800/80 text-[10px] sm:text-[11px] flex flex-col gap-1.5">
          <div className="flex items-center justify-between text-slate-400">
            <span className="flex items-center gap-1 text-emerald-400 font-medium">
              <Sparkles className="w-3 h-3 text-emerald-400" />
              创角已完成 • 自由推演中（直接在下方与 DM 对话）
            </span>
            <button
              onClick={() => setShowQuickPills(!showQuickPills)}
              className="text-slate-400 hover:text-amber-300 font-mono text-[10px] underline underline-offset-2 cursor-pointer transition"
            >
              {showQuickPills ? '隐藏常用动作' : '💡 展开常用动作快捷键'}
            </button>
          </div>

          {showQuickPills && (
            <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-none pt-1 border-t border-slate-800/60">
              <span className="text-slate-400 whitespace-nowrap font-mono flex items-center gap-1 shrink-0">
                <Compass className="w-3 h-3 text-indigo-400" />
                常用动作:
              </span>
              {quickActions.map((act, i) => (
                <button
                  key={`q-${i}`}
                  onClick={() => handleSend(act)}
                  disabled={isDMProcessing}
                  className="px-2.5 py-0.5 rounded-full bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-800 hover:border-indigo-500/40 transition whitespace-nowrap cursor-pointer disabled:opacity-50 shrink-0"
                >
                  {act}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Command Input Bar */}
      <div className="p-2.5 sm:p-4 bg-slate-950 border-t border-slate-800">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSend();
          }}
          className="flex items-center gap-2 sm:gap-3"
        >
          <input
            type="text"
            value={inputAction}
            onChange={(e) => setInputAction(e.target.value)}
            placeholder="对 DM 输入行动 (如: 向掌柜打听矿坑怪事...)"
            disabled={isDMProcessing}
            className="flex-1 bg-slate-900 border border-slate-800 focus:border-amber-500/50 rounded-xl px-3 sm:px-4 py-2 sm:py-3 text-xs text-slate-100 placeholder-slate-500 outline-none transition"
          />
          <button
            type="submit"
            disabled={isDMProcessing || !inputAction.trim()}
            className="px-3.5 sm:px-5 py-2 sm:py-3 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs flex items-center gap-1.5 sm:gap-2 transition cursor-pointer disabled:opacity-40 shadow-lg shadow-amber-500/10 shrink-0"
          >
            <Send className="w-3.5 h-3.5" />
            <span className="hidden xs:inline">发送行动</span>
          </button>
        </form>
      </div>
    </div>
  );
};
