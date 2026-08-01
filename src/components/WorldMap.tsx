import React from 'react';
import { Location, Character } from '../types';
import { MapPin, Shield, DollarSign, Users, AlertTriangle, ArrowRight, Home } from 'lucide-react';

interface WorldMapProps {
  locations: Location[];
  characters: Character[];
  currentLocationId: string;
  onTravel: (locationId: string) => void;
  onSelectNPC: (npcId: string) => void;
}

export const WorldMap: React.FC<WorldMapProps> = ({
  locations,
  characters,
  currentLocationId,
  onTravel,
  onSelectNPC,
}) => {
  const currentLocation = locations.find((l) => l.id === currentLocationId);

  // Helper to find characters at a location
  const getNPCsAtLocation = (locId: string) => {
    return characters.filter((c) => c.location_id === locId);
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* Visual Interactive Map Canvas */}
      <div className="lg:col-span-2 bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl relative overflow-hidden flex flex-col justify-between min-h-[500px]">
        {/* Background Grid Pattern */}
        <div className="absolute inset-0 opacity-10 pointer-events-none bg-[radial-gradient(#6366f1_1px,transparent_1px)] [background-size:16px_16px]" />

        {/* Map Header */}
        <div className="flex items-center justify-between z-10 mb-4">
          <div>
            <h2 className="text-lg font-bold text-slate-100 flex items-center gap-2">
              <MapPin className="w-5 h-5 text-amber-400" />
              开放世界区域导引图
            </h2>
            <p className="text-xs text-slate-400">点击地图节点可查看地貌详情与移动驻留</p>
          </div>
          <span className="text-xs font-mono px-3 py-1 rounded-full bg-slate-800 text-slate-300 border border-slate-700">
            已探索 {locations.length}/{locations.length} 区域
          </span>
        </div>

        {/* Node Layout Canvas */}
        <div className="relative my-6 h-[380px] bg-slate-950/70 border border-slate-800/80 rounded-xl p-4 overflow-hidden">
          {/* Connection Lines (SVG) */}
          <svg className="absolute inset-0 w-full h-full pointer-events-none stroke-slate-700/60 stroke-2">
            {/* Tavern -> Dawnfall */}
            <line x1="30%" y1="65%" x2="45%" y2="35%" strokeDasharray="4 4" />
            {/* Tavern -> Wilds */}
            <line x1="30%" y1="65%" x2="70%" y2="65%" strokeDasharray="4 4" />
            {/* Dawnfall -> Wilds */}
            <line x1="45%" y1="35%" x2="70%" y2="65%" strokeDasharray="4 4" />
            {/* Dawnfall -> Ruins */}
            <line x1="45%" y1="35%" x2="75%" y2="25%" strokeDasharray="4 4" />
            {/* Wilds -> Ruins */}
            <line x1="70%" y1="65%" x2="75%" y2="25%" strokeDasharray="4 4" />
          </svg>

          {/* Location Nodes */}
          {locations.map((loc, idx) => {
            const isCurrent = loc.id === currentLocationId;
            const npcs = getNPCsAtLocation(loc.id);

            // Node coordinates styling
            const posMap: Record<string, { top: string; left: string }> = {
              'loc-tavern': { top: '65%', left: '30%' },
              'loc-dawnfall': { top: '35%', left: '45%' },
              'loc-wilds': { top: '65%', left: '70%' },
              'loc-ruins': { top: '25%', left: '75%' },
            };

            const fallbackCoords = [
              { top: '65%', left: '30%' },
              { top: '35%', left: '45%' },
              { top: '65%', left: '70%' },
              { top: '25%', left: '75%' },
            ];

            const coords = posMap[loc.id] || fallbackCoords[idx % fallbackCoords.length];

            return (
              <div
                key={loc.id}
                className="absolute transform -translate-x-1/2 -translate-y-1/2 z-20 group"
                style={{ top: coords.top, left: coords.left }}
              >
                <button
                  onClick={() => onTravel(loc.id)}
                  className={`p-3 rounded-2xl border transition-all flex flex-col items-center gap-1 shadow-2xl cursor-pointer ${
                    isCurrent
                      ? 'bg-amber-500/20 border-amber-400 text-amber-200 ring-4 ring-amber-500/20 scale-105'
                      : 'bg-slate-900/90 hover:bg-slate-800 border-slate-700 text-slate-200 hover:scale-105'
                  }`}
                >
                  <div className="flex items-center gap-1.5 font-bold text-xs">
                    {isCurrent && <span className="w-2 h-2 rounded-full bg-amber-400 animate-ping" />}
                    {loc.name.split(' ')[0]}
                  </div>

                  {/* Badges */}
                  <div className="flex items-center gap-1.5 text-[10px] text-slate-400">
                    <span className="flex items-center gap-0.5 text-indigo-300">
                      <Users className="w-3 h-3" />
                      {npcs.length}
                    </span>
                    <span className="flex items-center gap-0.5 text-amber-400">
                      <Shield className="w-3 h-3" />
                      {loc.security.guard_presence}%
                    </span>
                  </div>
                </button>

                {/* Hover Quick Card */}
                <div className="opacity-0 group-hover:opacity-100 transition-opacity absolute top-full left-1/2 -translate-x-1/2 mt-2 w-48 bg-slate-950 border border-slate-800 rounded-xl p-2.5 shadow-2xl text-xs pointer-events-none z-30">
                  <p className="font-semibold text-slate-200">{loc.name}</p>
                  <p className="text-[11px] text-slate-400 line-clamp-2 mt-0.5">{loc.description}</p>
                  <div className="mt-2 text-[10px] text-slate-300">
                    驻留 NPC: {npcs.map((n) => n.name).join(', ') || '无'}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Selected Location Inspector */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl flex flex-col justify-between">
        <div>
          <div className="flex items-center justify-between pb-3 border-b border-slate-800">
            <h3 className="font-bold text-slate-100 flex items-center gap-2">
              <Home className="w-4 h-4 text-amber-400" />
              驻留区域详情
            </h3>
            <span className="text-xs px-2.5 py-0.5 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/20">
              {currentLocation?.type}
            </span>
          </div>

          {currentLocation && (
            <div className="mt-4 space-y-4">
              <div>
                <h4 className="text-base font-bold text-amber-300">{currentLocation.name}</h4>
                <p className="text-xs text-slate-400 mt-1 leading-relaxed">{currentLocation.description}</p>
              </div>

              {/* Status Bars */}
              <div className="space-y-2 bg-slate-950/60 p-3 rounded-xl border border-slate-800/80 text-xs">
                <div>
                  <div className="flex justify-between text-slate-400 mb-1">
                    <span>卫队守护强度:</span>
                    <span className="text-indigo-400 font-mono font-bold">{currentLocation.security.guard_presence}%</span>
                  </div>
                  <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden">
                    <div className="h-full bg-indigo-500 rounded-full" style={{ width: `${currentLocation.security.guard_presence}%` }} />
                  </div>
                </div>

                <div>
                  <div className="flex justify-between text-slate-400 mb-1">
                    <span>黑市/犯罪警示:</span>
                    <span className="text-rose-400 font-mono font-bold">{currentLocation.security.crime_rate}%</span>
                  </div>
                  <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden">
                    <div className="h-full bg-rose-500 rounded-full" style={{ width: `${currentLocation.security.crime_rate}%` }} />
                  </div>
                </div>
              </div>

              {/* Features */}
              <div>
                <span className="text-xs font-semibold text-slate-300 block mb-2">地标地貌:</span>
                <div className="space-y-1.5">
                  {currentLocation.features.map((feat, idx) => (
                    <div key={idx} className="bg-slate-950/40 border border-slate-800 p-2 rounded-lg text-xs">
                      <span className="font-medium text-amber-200">{feat.name}</span>
                      <p className="text-[11px] text-slate-400 mt-0.5">{feat.description}</p>
                    </div>
                  ))}
                </div>
              </div>

              {/* NPCs here */}
              <div>
                <span className="text-xs font-semibold text-slate-300 block mb-2">驻留角色 (NPCs):</span>
                <div className="flex flex-wrap gap-2">
                  {getNPCsAtLocation(currentLocation.id).map((npc) => (
                    <button
                      key={npc.id}
                      onClick={() => onSelectNPC(npc.id)}
                      className="px-3 py-1.5 rounded-lg bg-indigo-500/10 hover:bg-indigo-500/20 border border-indigo-500/30 text-indigo-300 text-xs font-medium flex items-center gap-1.5 transition cursor-pointer"
                    >
                      <Users className="w-3.5 h-3.5 text-indigo-400" />
                      {npc.name} ({npc.title.slice(0, 6)})
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
