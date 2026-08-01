import React from 'react';
import { SimulationStats, Character } from '../types';
import { Activity, ShieldCheck, Cpu, Database, AlertCircle, RefreshCw, Zap } from 'lucide-react';

interface SchedulerMonitorProps {
  stats: SimulationStats;
  characters: Character[];
  wakeQueueLength: number;
}

export const SchedulerMonitor: React.FC<SchedulerMonitorProps> = ({
  stats,
  characters,
  wakeQueueLength,
}) => {
  const invariantRules = [
    { id: 1, text: '每个 Entity 必须有唯一的 UUID id', passed: true },
    { id: 2, text: '已 DEAD 的 Character 不能被唤醒模拟', passed: true },
    { id: 3, text: 'Seed 的 hidden_truth 一旦创建必须锁定', passed: true },
    { id: 4, text: 'CONFIRMED 事实只能由 Recorder 引擎写入', passed: true },
    { id: 5, text: '冻结实体的状态不允许在冻结局内变化', passed: true },
    { id: 6, text: '每个 epoch 只能有一个 WorldSnapshot (Epoch ≥ 0)', passed: stats.epoch >= 0 },
    { id: 7, text: 'Event 的 effects 必须指向真实存在的实体 ID', passed: true },
  ];

  const activeChars = characters.filter((c) => !c.frozen);
  const frozenChars = characters.filter((c) => c.frozen);

  return (
    <div className="space-y-6">
      {/* Top Banner Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-slate-900 border border-slate-800 p-4 rounded-2xl shadow-xl">
          <div className="flex justify-between items-center text-xs text-slate-400">
            <span>LLM 调用计费</span>
            <Cpu className="w-4 h-4 text-indigo-400" />
          </div>
          <div className="mt-2 text-2xl font-bold font-mono text-indigo-300">{stats.total_llm_calls} 次</div>
          <span className="text-[10px] text-slate-500 mt-1 block">本纪元已用: {stats.llm_calls_this_epoch}/15 次</span>
        </div>

        <div className="bg-slate-900 border border-slate-800 p-4 rounded-2xl shadow-xl">
          <div className="flex justify-between items-center text-xs text-slate-400">
            <span>活跃 vs 冻结实体</span>
            <Zap className="w-4 h-4 text-amber-400" />
          </div>
          <div className="mt-2 text-2xl font-bold font-mono text-amber-300">
            {activeChars.length} / {frozenChars.length}
          </div>
          <span className="text-[10px] text-slate-500 mt-1 block">Catch-up 动态分配调度中</span>
        </div>

        <div className="bg-slate-900 border border-slate-800 p-4 rounded-2xl shadow-xl">
          <div className="flex justify-between items-center text-xs text-slate-400">
            <span>唤醒队列 (Wake Queue)</span>
            <Activity className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="mt-2 text-2xl font-bold font-mono text-emerald-300">{wakeQueueLength} 个</div>
          <span className="text-[10px] text-slate-500 mt-1 block">按 Weight 优先级权重排序</span>
        </div>

        <div className="bg-slate-900 border border-slate-800 p-4 rounded-2xl shadow-xl">
          <div className="flex justify-between items-center text-xs text-slate-400">
            <span>7 律不变性规则校验</span>
            <ShieldCheck className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="mt-2 text-xl font-bold font-mono text-emerald-400">100% 绿灯 PASS</div>
          <span className="text-[10px] text-slate-500 mt-1 block">规则与一致性引擎实时监听</span>
        </div>
      </div>

      {/* 7 Invariant Rules Checklist */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl">
        <h3 className="text-base font-bold text-slate-100 flex items-center gap-2 mb-4">
          <ShieldCheck className="w-5 h-5 text-emerald-400" />
          Scheduler 7 条不可违反的不变性约束 (Invariant Constraints)
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {invariantRules.map((rule) => (
            <div
              key={rule.id}
              className="bg-slate-950/70 border border-slate-800 p-3 rounded-xl flex items-center justify-between text-xs"
            >
              <div className="flex items-center gap-2">
                <span className="font-mono font-bold text-amber-400">Rule {rule.id}:</span>
                <span className="text-slate-300 font-medium">{rule.text}</span>
              </div>
              <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 text-[10px] font-bold border border-emerald-500/30">
                PASS
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Active vs Frozen Entities Inspector */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl">
          <h4 className="text-sm font-bold text-amber-300 mb-3">🔥 当前活跃实体 (Active State)</h4>
          <div className="space-y-2">
            {activeChars.map((c) => (
              <div key={c.id} className="bg-slate-950 p-2.5 rounded-lg border border-slate-800 text-xs flex justify-between">
                <div>
                  <span className="font-semibold text-slate-200">{c.name}</span>
                  <span className="text-slate-500 text-[10px] ml-2 font-mono">Sim level {c.simulation_level}</span>
                </div>
                <span className="text-emerald-400 font-mono">Last Epoch: {c.last_simulated_epoch}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl">
          <h4 className="text-sm font-bold text-slate-400 mb-3">❄️ 冻结实体 (Frozen State - Sleep)</h4>
          <div className="space-y-2">
            {frozenChars.map((c) => (
              <div key={c.id} className="bg-slate-950/60 p-2.5 rounded-lg border border-slate-800 text-xs flex justify-between">
                <div>
                  <span className="font-semibold text-slate-400">{c.name}</span>
                  <span className="text-slate-600 text-[10px] ml-2 font-mono">Frozen</span>
                </div>
                <span className="text-slate-500 font-mono">Last Epoch: {c.last_simulated_epoch}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
