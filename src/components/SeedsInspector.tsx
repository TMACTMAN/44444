import React from 'react';
import { Seed, CausalityPressure } from '../types';
import { Zap, ShieldAlert, Target, Play, CheckCircle, Flame } from 'lucide-react';

interface SeedsInspectorProps {
  seeds: Seed[];
  pressures: CausalityPressure[];
  onTriggerOpportunity: (seedId: string) => void;
}

export const SeedsInspector: React.FC<SeedsInspectorProps> = ({
  seeds,
  pressures,
  onTriggerOpportunity,
}) => {
  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold text-slate-100 flex items-center gap-2">
              <Zap className="w-5 h-5 text-amber-400" />
              因果种子 (Event Seeds) 与 世界因果压力
            </h2>
            <p className="text-xs text-slate-400 mt-1">
              世界并非静态，而是由【因果压力】驱动生成【事件种子】，在冻结与唤醒间自动演绎。
            </p>
          </div>
          <span className="text-xs px-3 py-1 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/20 font-mono font-bold">
            {seeds.length} 个活跃 Seeds
          </span>
        </div>

        {/* Causality Pressure Bar Chart */}
        <div className="mt-6 pt-4 border-t border-slate-800">
          <h3 className="text-xs font-semibold text-slate-300 flex items-center gap-1.5 mb-3">
            <Flame className="w-4 h-4 text-orange-400" />
            当前世界积聚的因果压力 (Causality Pressures):
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {pressures.map((press, idx) => (
              <div key={idx} className="bg-slate-950/70 border border-slate-800 p-3 rounded-xl">
                <div className="flex justify-between items-center text-xs mb-1">
                  <span className="font-semibold text-amber-200">{press.description}</span>
                  <span className="font-mono font-bold text-amber-400">{press.pressure} PSI</span>
                </div>
                <div className="w-full h-2 bg-slate-800 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-amber-500 to-rose-500 rounded-full"
                    style={{ width: `${Math.min(100, press.pressure)}%` }}
                  />
                </div>
                <div className="flex justify-between text-[10px] text-slate-400 mt-1">
                  <span>来源: {press.source}</span>
                  <span>实体: {press.entity_id}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Active Seeds List */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {seeds.map((seed) => {
          const isCompleted = seed.progress >= 1.0;
          return (
            <div
              key={seed.id}
              className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl flex flex-col justify-between"
            >
              <div>
                {/* Seed Header */}
                <div className="flex items-center justify-between pb-3 border-b border-slate-800">
                  <div className="flex items-center gap-2">
                    <span className="px-2.5 py-0.5 rounded bg-indigo-500/20 text-indigo-300 text-xs font-mono font-bold border border-indigo-500/30">
                      {seed.type}
                    </span>
                    <h3 className="font-bold text-slate-200 text-sm">Seed #{seed.id.slice(-6)}</h3>
                  </div>
                  <span className="text-xs text-amber-400 font-mono font-bold">重要度: {seed.importance}</span>
                </div>

                {/* Visible Layer Description */}
                <div className="mt-3">
                  <p className="text-xs text-slate-300 font-medium leading-relaxed">
                    {seed.visible_layer.description}
                  </p>
                  <div className="flex items-center gap-3 text-[11px] text-slate-400 mt-2 font-mono">
                    <span>地点: {seed.visible_layer.location_id}</span>
                    <span>预计周期: {seed.visible_layer.start_epoch} ~ {seed.visible_layer.estimated_end_epoch} Epochs</span>
                  </div>
                </div>

                {/* Progress Bar */}
                <div className="mt-4 bg-slate-950 p-3 rounded-xl border border-slate-800">
                  <div className="flex justify-between items-center text-xs mb-1.5">
                    <span className="text-slate-400 font-medium">种子演绎进度 (Progression):</span>
                    <span className="font-mono font-bold text-amber-300">{(seed.progress * 100).toFixed(0)}%</span>
                  </div>
                  <div className="w-full h-2.5 bg-slate-800 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-emerald-500 to-amber-400 rounded-full transition-all"
                      style={{ width: `${seed.progress * 100}%` }}
                    />
                  </div>
                </div>

                {/* Opportunity */}
                {seed.player_opportunity && seed.player_opportunity.exists && (
                  <div className="mt-4 bg-amber-500/10 border border-amber-500/30 p-3 rounded-xl">
                    <div className="flex items-center gap-1.5 text-xs font-bold text-amber-300 mb-1">
                      <Target className="w-4 h-4 text-amber-400" />
                      玩家介入契机 (Player Opportunity):
                    </div>
                    <p className="text-xs text-slate-300">{seed.player_opportunity.description}</p>
                    <p className="text-[11px] text-slate-400 mt-1">触发条件: {seed.player_opportunity.discovery_condition}</p>
                  </div>
                )}
              </div>

              {/* Action */}
              <div className="mt-5 pt-3 border-t border-slate-800 flex justify-end">
                <button
                  onClick={() => onTriggerOpportunity(seed.id)}
                  disabled={isCompleted}
                  className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-indigo-50 font-bold text-xs flex items-center gap-1.5 transition cursor-pointer disabled:opacity-50"
                >
                  <Play className="w-3.5 h-3.5" />
                  介入调查此 Seed
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
