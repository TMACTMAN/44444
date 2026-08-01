import React, { useState } from 'react';
import { Event } from '../types';
import { Scroll, Filter, Sparkles, AlertCircle, Bookmark } from 'lucide-react';

interface EventsTimelineProps {
  events: Event[];
}

export const EventsTimeline: React.FC<EventsTimelineProps> = ({ events }) => {
  const [filterType, setFilterType] = useState<string>('ALL');

  const filteredEvents = events.filter((e) => {
    if (filterType === 'ALL') return true;
    return e.type === filterType;
  });

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-slate-800">
        <div>
          <h2 className="text-lg font-bold text-slate-100 flex items-center gap-2">
            <Scroll className="w-5 h-5 text-amber-400" />
            世界纪元历史事件编年史 (World Chronicle Log)
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            记录所有因果树演绎、Seed 结算、NPC 抉择与玩家破局的历史事件。
          </p>
        </div>

        {/* Filter Badges */}
        <div className="flex items-center gap-1.5 text-xs">
          {['ALL', 'DISCOVERY', 'TRUTH_REVEALED', 'SOCIAL', 'BATTLE'].map((f) => (
            <button
              key={f}
              onClick={() => setFilterType(f)}
              className={`px-3 py-1.5 rounded-lg border transition font-medium cursor-pointer ${
                filterType === f
                  ? 'bg-amber-500/20 border-amber-500/40 text-amber-300'
                  : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-slate-200'
              }`}
            >
              {f === 'ALL' ? '全部事件' : f}
            </button>
          ))}
        </div>
      </div>

      {/* Events Stream List */}
      <div className="mt-6 space-y-4 max-h-[600px] overflow-y-auto pr-2">
        {filteredEvents.map((evt) => {
          const isTruth = evt.type === 'TRUTH_REVEALED';
          return (
            <div
              key={evt.id}
              className={`p-4 rounded-xl border shadow-md transition-all ${
                isTruth
                  ? 'bg-amber-950/20 border-amber-500/40'
                  : 'bg-slate-950/70 border-slate-800/80 hover:border-slate-700'
              }`}
            >
              <div className="flex items-center justify-between text-xs mb-2">
                <div className="flex items-center gap-2">
                  <span className="font-mono font-bold text-amber-400 px-2 py-0.5 rounded bg-slate-900 border border-slate-800">
                    Epoch {evt.epoch}
                  </span>
                  <span
                    className={`px-2 py-0.5 rounded font-mono font-bold ${
                      isTruth
                        ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                        : 'bg-indigo-500/10 text-indigo-300 border border-indigo-500/20'
                    }`}
                  >
                    {evt.type}
                  </span>
                </div>
                <span className="text-[11px] text-slate-500 font-mono">ID: #{evt.id.slice(-6)}</span>
              </div>

              <p className="text-xs text-slate-200 leading-relaxed font-medium">{evt.description}</p>

              {/* Effects summary if any */}
              {evt.effects && evt.effects.length > 0 && (
                <div className="mt-2 pt-2 border-t border-slate-800/60 text-[11px] text-slate-400">
                  {evt.effects.map((eff, idx) => (
                    <p key={idx}>• 因果波及: {eff.description}</p>
                  ))}
                </div>
              )}
            </div>
          );
        })}

        {filteredEvents.length === 0 && (
          <div className="text-center py-12 text-slate-500 text-xs">暂无此类型历史事件记录</div>
        )}
      </div>
    </div>
  );
};
