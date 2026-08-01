import React from 'react';
import { HiddenTruth } from '../types';
import { Eye, ShieldCheck, Key, Lock, Search, Sparkles } from 'lucide-react';

interface HiddenTruthsBoardProps {
  truths: HiddenTruth[];
  onCollectEvidence: (truthId: string, evidenceName: string) => void;
  onRevealTruth: (truthId: string) => void;
}

export const HiddenTruthsBoard: React.FC<HiddenTruthsBoardProps> = ({
  truths,
  onCollectEvidence,
  onRevealTruth,
}) => {
  const layers = [
    { key: 'layer_1_personal_secrets', label: 'Layer 1: 个人秘密 (Personal Secrets)', badge: 'bg-indigo-500/20 text-indigo-300' },
    { key: 'layer_2_organization_conspiracies', label: 'Layer 2: 组织阴谋 (Org Conspiracies)', badge: 'bg-amber-500/20 text-amber-300' },
    { key: 'layer_3_world_lies', label: 'Layer 3: 世界谎言 (World Lies)', badge: 'bg-rose-500/20 text-rose-300' },
    { key: 'layer_4_cosmic_illusions', label: 'Layer 4: 宇宙假象 (Cosmic Illusions)', badge: 'bg-purple-500/20 text-purple-300' },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold text-slate-100 flex items-center gap-2">
              <Eye className="w-5 h-5 text-amber-400" />
              4层隐秘真相侦查案卷 (Hidden Truths Board)
            </h2>
            <p className="text-xs text-slate-400 mt-1">
              世人所见的表象皆为迷雾。通过搜集关键物证与线索，打破四个阶层的虚妄真相！
            </p>
          </div>
          <span className="text-xs px-3 py-1 rounded-full bg-indigo-500/10 text-indigo-300 border border-indigo-500/20 font-mono">
            已锁死 4 个全域真相
          </span>
        </div>
      </div>

      {/* 4 Layer Grid */}
      <div className="space-y-6">
        {layers.map((layerInfo) => {
          const layerTruths = truths.filter((t) => t.layer === layerInfo.key);

          return (
            <div key={layerInfo.key} className="space-y-4">
              <div className="flex items-center gap-2 pb-2 border-b border-slate-800">
                <span className={`px-2.5 py-0.5 rounded text-xs font-bold font-mono border border-slate-700 ${layerInfo.badge}`}>
                  {layerInfo.label}
                </span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {layerTruths.map((truth) => {
                  const isReadyToReveal = truth.evidence_required.every((e) =>
                    truth.evidence_collected.includes(e)
                  );

                  return (
                    <div
                      key={truth.id}
                      className={`bg-slate-900 border rounded-2xl p-5 shadow-xl transition-all ${
                        truth.revealed
                          ? 'border-emerald-500/40 bg-emerald-950/10'
                          : 'border-slate-800 hover:border-slate-700'
                      }`}
                    >
                      {/* Title & Revealed Badge */}
                      <div className="flex items-center justify-between pb-3 border-b border-slate-800">
                        <div className="flex items-center gap-2">
                          <h3 className="font-bold text-slate-100 text-sm">{truth.title}</h3>
                        </div>
                        {truth.revealed ? (
                          <span className="px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 text-xs font-bold border border-emerald-500/30 flex items-center gap-1">
                            <ShieldCheck className="w-3.5 h-3.5" />
                            真相已完全被打破
                          </span>
                        ) : (
                          <span className="px-2.5 py-0.5 rounded-full bg-slate-800 text-slate-400 text-xs flex items-center gap-1">
                            <Lock className="w-3.5 h-3.5" />
                            封存锁死
                          </span>
                        )}
                      </div>

                      {/* Content */}
                      <div className="mt-3">
                        {truth.revealed ? (
                          <div className="bg-emerald-950/40 border border-emerald-500/30 p-3 rounded-xl">
                            <span className="text-xs font-bold text-emerald-300 block mb-1">已刺破的底牌真相:</span>
                            <p className="text-xs text-slate-200 leading-relaxed">{truth.true_nature}</p>
                          </div>
                        ) : (
                          <div className="bg-slate-950 p-3 rounded-xl border border-slate-800">
                            <p className="text-xs text-slate-400 italic">
                              真相被重重迷雾包围... 需搜集下列表象物证以揭露真相。
                            </p>
                          </div>
                        )}

                        {/* Required Evidence Items */}
                        <div className="mt-4">
                          <span className="text-xs font-semibold text-slate-300 block mb-2">所需物证/线索:</span>
                          <div className="space-y-2">
                            {truth.evidence_required.map((ev, idx) => {
                              const hasIt = truth.evidence_collected.includes(ev);
                              return (
                                <div
                                  key={idx}
                                  className="flex items-center justify-between bg-slate-950/60 p-2 rounded-lg text-xs border border-slate-800"
                                >
                                  <span className={`font-medium ${hasIt ? 'text-emerald-300' : 'text-slate-400'}`}>
                                    {hasIt ? '✓ ' : '○ '} {ev}
                                  </span>
                                  {!hasIt && !truth.revealed && (
                                    <button
                                      onClick={() => onCollectEvidence(truth.id, ev)}
                                      className="px-2 py-1 rounded bg-indigo-600/30 hover:bg-indigo-600/50 text-indigo-200 text-[11px] font-medium transition cursor-pointer"
                                    >
                                      搜集线索
                                    </button>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      </div>

                      {/* Action */}
                      {!truth.revealed && (
                        <div className="mt-4 pt-3 border-t border-slate-800 flex justify-end">
                          <button
                            onClick={() => onRevealTruth(truth.id)}
                            disabled={!isReadyToReveal}
                            className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs flex items-center gap-1.5 transition cursor-pointer disabled:opacity-40"
                          >
                            <Key className="w-3.5 h-3.5" />
                            {isReadyToReveal ? '立即打破并揭露真相！' : '集齐物证后可揭露'}
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
