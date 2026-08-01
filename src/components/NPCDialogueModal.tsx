import React, { useState } from 'react';
import { Character } from '../types';
import { MessageSquare, Heart, Shield, Sparkles, Brain, Lock, Send, User } from 'lucide-react';

interface NPCDialogueModalProps {
  npc: Character;
  onSendMessage: (message: string) => Promise<void>;
  isLoading: boolean;
  onClose: () => void;
  playerCharacter: Character;
}

export const NPCDialogueModal: React.FC<NPCDialogueModalProps> = ({
  npc,
  onSendMessage,
  isLoading,
  onClose,
  playerCharacter,
}) => {
  const [inputText, setInputText] = useState('');
  const [chatLog, setChatLog] = useState<{ sender: string; text: string; time?: string }[]>([
    {
      sender: npc.name,
      text: `${npc.name} 看了你一眼：“有什么事吗？在铁冠城说话最好小心点。”`,
    },
  ]);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim() || isLoading) return;

    const userMsg = inputText.trim();
    setInputText('');

    setChatLog((prev) => [...prev, { sender: playerCharacter.name, text: userMsg }]);

    await onSendMessage(userMsg);
  };

  // Find relationship with player PC
  const relWithPC = npc.relationships.find((r) => r.target_id === playerCharacter.id) || {
    trust: 50,
    favor: 50,
    fear: 0,
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-4xl h-[650px] shadow-2xl flex flex-col md:flex-row overflow-hidden">
        {/* Left NPC Status & Personality Inspector */}
        <div className="w-full md:w-80 bg-slate-950 border-r border-slate-800 p-5 flex flex-col justify-between overflow-y-auto">
          <div>
            {/* Header */}
            <div className="flex items-center gap-3 pb-4 border-b border-slate-800">
              <div className="w-12 h-12 rounded-xl bg-gradient-to-tr from-indigo-500 to-amber-500 p-0.5 shadow-lg">
                <div className="w-full h-full bg-slate-900 rounded-[10px] flex items-center justify-center font-bold text-amber-300 text-lg">
                  {npc.name[0]}
                </div>
              </div>
              <div>
                <h3 className="font-bold text-slate-100 text-base">{npc.name}</h3>
                <p className="text-xs text-amber-400">{npc.title}</p>
                <span className="text-[10px] text-slate-400 font-mono">
                  {npc.species} • {npc.age}岁 • {npc.status}
                </span>
              </div>
            </div>

            {/* Personality Traits */}
            <div className="mt-4">
              <span className="text-xs font-semibold text-slate-400 block mb-1.5">性格羁绊:</span>
              <div className="flex flex-wrap gap-1.5">
                {npc.personality.map((trait, idx) => (
                  <span key={idx} className="px-2 py-0.5 rounded bg-slate-800 text-slate-300 text-[11px] border border-slate-700">
                    {trait}
                  </span>
                ))}
              </div>
            </div>

            {/* Relationship Bars */}
            <div className="mt-4 space-y-2 bg-slate-900/60 p-3 rounded-xl border border-slate-800 text-xs">
              <div>
                <div className="flex justify-between text-slate-400 mb-1">
                  <span>对你的信任度 (Trust):</span>
                  <span className="text-emerald-400 font-bold font-mono">{relWithPC.trust}/100</span>
                </div>
                <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden">
                  <div className="h-full bg-emerald-500 rounded-full" style={{ width: `${relWithPC.trust}%` }} />
                </div>
              </div>

              <div>
                <div className="flex justify-between text-slate-400 mb-1">
                  <span>对你的好感度 (Favor):</span>
                  <span className="text-amber-400 font-bold font-mono">{relWithPC.favor}/100</span>
                </div>
                <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden">
                  <div className="h-full bg-amber-500 rounded-full" style={{ width: `${relWithPC.favor}%` }} />
                </div>
              </div>
            </div>

            {/* Goal & Fear */}
            <div className="mt-4 space-y-2 text-xs">
              <div className="bg-slate-900/40 p-2.5 rounded-lg border border-slate-800">
                <span className="text-amber-300 font-medium block">核心动机:</span>
                <p className="text-slate-400 mt-0.5">{npc.goal.primary}</p>
              </div>
              <div className="bg-slate-900/40 p-2.5 rounded-lg border border-slate-800">
                <span className="text-rose-400 font-medium block">内心忌惮:</span>
                <p className="text-slate-400 mt-0.5">{npc.fear}</p>
              </div>
            </div>

            {/* Memory Logs */}
            <div className="mt-4">
              <span className="text-xs font-semibold text-slate-400 flex items-center gap-1 mb-1.5">
                <Brain className="w-3.5 h-3.5 text-indigo-400" />
                检索到的重要记忆:
              </span>
              <div className="space-y-1 max-h-32 overflow-y-auto pr-1">
                {npc.memory.short_term.map((mem, idx) => (
                  <p key={idx} className="text-[11px] text-slate-400 bg-slate-900/80 p-1.5 rounded border border-slate-800/80">
                    • {mem.text}
                  </p>
                ))}
              </div>
            </div>
          </div>

          <button
            onClick={onClose}
            className="mt-4 w-full py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium transition cursor-pointer"
          >
            离开对话
          </button>
        </div>

        {/* Right Interactive AI Dialogue Console */}
        <div className="flex-1 flex flex-col justify-between p-5 bg-slate-900">
          {/* Header */}
          <div className="flex items-center justify-between pb-3 border-b border-slate-800">
            <div className="flex items-center gap-2">
              <MessageSquare className="w-4 h-4 text-amber-400" />
              <span className="font-bold text-slate-200 text-sm">与 {npc.name} 进行沉浸式 RPG AI 对话</span>
            </div>
            <span className="text-xs text-indigo-300 flex items-center gap-1 font-mono">
              <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
              Gemini 3.6 Flash Server-Side
            </span>
          </div>

          {/* Chat Messages Log */}
          <div className="flex-1 overflow-y-auto my-4 space-y-3 pr-2 font-sans">
            {chatLog.map((msg, idx) => {
              const isNPC = msg.sender === npc.name;
              return (
                <div key={idx} className={`flex gap-3 ${isNPC ? 'justify-start' : 'justify-end'}`}>
                  {isNPC && (
                    <div className="w-8 h-8 rounded-lg bg-amber-500/20 text-amber-300 flex items-center justify-center font-bold text-xs shrink-0">
                      {npc.name[0]}
                    </div>
                  )}

                  <div
                    className={`max-w-[80%] rounded-2xl p-3 text-xs leading-relaxed shadow-md ${
                      isNPC
                        ? 'bg-slate-950 border border-slate-800 text-slate-200 rounded-tl-none'
                        : 'bg-indigo-600 text-indigo-50 rounded-tr-none'
                    }`}
                  >
                    <div className="font-semibold text-[11px] mb-1 opacity-75">{msg.sender}</div>
                    <p className="whitespace-pre-wrap">{msg.text}</p>
                  </div>

                  {!isNPC && (
                    <div className="w-8 h-8 rounded-lg bg-indigo-500/20 text-indigo-300 flex items-center justify-center font-bold text-xs shrink-0">
                      <User className="w-4 h-4" />
                    </div>
                  )}
                </div>
              );
            })}
            {isLoading && (
              <div className="flex gap-3 items-center text-slate-400 text-xs italic">
                <Sparkles className="w-4 h-4 text-indigo-400 animate-spin" />
                {npc.name} 正在思考并沉吟回复...
              </div>
            )}
          </div>

          {/* Message Input Box */}
          <form onSubmit={handleSend} className="flex gap-2">
            <input
              type="text"
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              placeholder={`对 ${npc.name} 说话... (例如: 你对黑鸦商会的走私了解多少？)`}
              disabled={isLoading}
              className="flex-1 bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-xs text-slate-100 focus:outline-none focus:border-amber-400 transition"
            />
            <button
              type="submit"
              disabled={isLoading || !inputText.trim()}
              className="px-5 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs flex items-center gap-1.5 transition cursor-pointer disabled:opacity-50"
            >
              <Send className="w-4 h-4" />
              发送
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};
