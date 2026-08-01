import React from 'react';
import { Character } from '../types';
import { Shield, Zap, Sword, Heart, UserCheck, Briefcase, Award } from 'lucide-react';

interface CharacterSheetProps {
  character: Character;
  onSelectNPCDialogue?: (npcId: string) => void;
}

export const CharacterSheet: React.FC<CharacterSheetProps> = ({
  character,
  onSelectNPCDialogue,
}) => {
  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-slate-800">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-tr from-amber-500 to-indigo-600 p-0.5 shadow-lg">
            <div className="w-full h-full bg-slate-950 rounded-[10px] flex items-center justify-center font-bold text-amber-300 text-lg">
              {character.name[0]}
            </div>
          </div>
          <div>
            <h3 className="font-bold text-slate-100 text-base flex items-center gap-2">
              {character.name}
              <span className="text-xs font-normal text-amber-400">({character.title})</span>
            </h3>
            <p className="text-xs text-slate-400">
              {character.species} • {character.age}岁 • {character.type}
            </p>
          </div>
        </div>

        {character.type === 'NPC' && onSelectNPCDialogue && (
          <button
            onClick={() => onSelectNPCDialogue(character.id)}
            className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs transition cursor-pointer shadow-lg"
          >
            与 {character.name} 开始 AI 对话
          </button>
        )}
      </div>

      {/* Grid Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-6">
        {/* Attributes */}
        <div className="bg-slate-950 p-4 rounded-xl border border-slate-800">
          <h4 className="text-xs font-bold text-slate-300 flex items-center gap-1.5 mb-3">
            <Shield className="w-4 h-4 text-indigo-400" />
            基础属性 (Attributes)
          </h4>
          <div className="space-y-2 text-xs">
            <div className="flex justify-between">
              <span className="text-slate-400">HP (生命值):</span>
              <span className="font-mono font-bold text-red-400">
                {character.attributes.hp} / {character.attributes.max_hp}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">MP (魔力值):</span>
              <span className="font-mono font-bold text-indigo-400">
                {character.attributes.mp} / {character.attributes.max_mp}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">STR (力量):</span>
              <span className="font-mono font-bold text-amber-300">{character.attributes.strength}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">DEX (敏捷):</span>
              <span className="font-mono font-bold text-emerald-300">{character.attributes.dexterity}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">INT (智力):</span>
              <span className="font-mono font-bold text-cyan-300">{character.attributes.intelligence}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">CHA (魅力):</span>
              <span className="font-mono font-bold text-purple-300">{character.attributes.charisma}</span>
            </div>
          </div>
        </div>

        {/* Skills */}
        <div className="bg-slate-950 p-4 rounded-xl border border-slate-800">
          <h4 className="text-xs font-bold text-slate-300 flex items-center gap-1.5 mb-3">
            <Sword className="w-4 h-4 text-amber-400" />
            技能等级 (Skills)
          </h4>
          <div className="space-y-2 text-xs">
            {Object.entries(character.skills).map(([skillName, level]) => (
              <div key={skillName}>
                <div className="flex justify-between text-slate-400 mb-1">
                  <span>{skillName}</span>
                  <span className="font-mono font-bold text-amber-300">{level} PT</span>
                </div>
                <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden">
                  <div className="h-full bg-amber-400 rounded-full" style={{ width: `${level}%` }} />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Inventory */}
        <div className="bg-slate-950 p-4 rounded-xl border border-slate-800">
          <h4 className="text-xs font-bold text-slate-300 flex items-center gap-1.5 mb-3">
            <Briefcase className="w-4 h-4 text-emerald-400" />
            携带物品 (Inventory)
          </h4>
          <div className="space-y-1.5 max-h-40 overflow-y-auto pr-1">
            {character.inventory.map((item, idx) => (
              <div
                key={idx}
                className="bg-slate-900 p-2 rounded-lg border border-slate-800 flex justify-between text-xs"
              >
                <span className="font-medium text-slate-200">{item.name}</span>
                <span className="font-mono text-amber-400">x{item.quantity}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
