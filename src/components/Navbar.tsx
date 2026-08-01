import React from 'react';
import {
  Compass,
  MapPin,
  Clock,
  Sparkles,
  Users,
  Eye,
  Scroll,
  Activity,
  Zap,
  RotateCcw,
  ShieldAlert,
  Crown,
  Image as ImageIcon,
} from 'lucide-react';
import { UserCommercialState } from '../types';

interface NavbarProps {
  epoch: number;
  onTick: () => void;
  isTicking: boolean;
  autoTick: boolean;
  setAutoTick: (val: boolean) => void;
  onReset: () => void;
  onAIDeduce: () => void;
  isDeducing: boolean;
  showInspector: boolean;
  setShowInspector: (val: boolean) => void;
  commercialState: UserCommercialState;
  onOpenVIPModal: () => void;
  onOpenGalleryModal: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  epoch,
  onTick,
  isTicking,
  autoTick,
  setAutoTick,
  onReset,
  onAIDeduce,
  isDeducing,
  showInspector,
  setShowInspector,
  commercialState,
  onOpenVIPModal,
  onOpenGalleryModal,
}) => {
  return (
    <header className="bg-slate-900 border-b border-slate-800 text-slate-100 sticky top-0 z-40 shadow-xl">
      {/* Top Banner */}
      <div className="max-w-7xl mx-auto px-3 sm:px-4 py-2.5 sm:py-3 flex flex-col sm:flex-row items-center justify-between gap-3 sm:gap-4">
        {/* Brand */}
        <div className="flex items-center justify-between w-full sm:w-auto gap-3">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-xl bg-gradient-to-tr from-amber-600 to-indigo-600 p-0.5 shadow-lg shadow-indigo-900/40 shrink-0">
              <div className="w-full h-full bg-slate-950 rounded-[10px] flex items-center justify-center">
                <Compass className="w-4 h-4 sm:w-5 sm:h-5 text-amber-400 animate-spin-slow" />
              </div>
            </div>
            <div>
              <h1 className="font-bold text-xs xs:text-sm sm:text-lg tracking-wide text-slate-100 flex items-center gap-1 sm:gap-2">
                <span className="whitespace-nowrap">艾尔德兰</span>
                <span className="text-[9px] sm:text-xs font-mono px-1 sm:px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30 whitespace-nowrap">
                  AI DM
                </span>
              </h1>
              <p className="text-[10px] sm:text-xs text-slate-400 hidden sm:block">蒸汽与魔导纪元 • 全进程 AI 叙事驱动</p>
            </div>
          </div>

          <div className="flex items-center gap-1 sm:gap-2 shrink-0">
            <button
              onClick={onOpenVIPModal}
              className={`flex items-center gap-1 px-2 py-1 sm:px-2.5 sm:py-1 rounded-lg text-[10px] sm:text-[11px] font-bold border transition cursor-pointer shrink-0 whitespace-nowrap ${
                commercialState.isVIP
                  ? 'bg-gradient-to-r from-amber-500/20 to-amber-600/30 text-amber-300 border-amber-500/40'
                  : 'bg-amber-500 hover:bg-amber-400 text-slate-950 border-amber-500 shadow-md shadow-amber-500/20'
              }`}
            >
              <Crown className="w-3 h-3 sm:w-3.5 sm:h-3.5 shrink-0" />
              <span>{commercialState.isVIP ? 'VIP' : '👑VIP'}</span>
            </button>

            <button
              onClick={onOpenGalleryModal}
              className="flex items-center gap-1 px-2 py-1 sm:px-2.5 sm:py-1 rounded-lg bg-indigo-950/80 hover:bg-indigo-900/80 text-indigo-200 border border-indigo-500/40 text-[10px] sm:text-[11px] font-mono shrink-0 cursor-pointer whitespace-nowrap"
            >
              <ImageIcon className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-indigo-400 shrink-0" />
              <span className="hidden xs:inline">画卷:</span>
              <span className="font-bold text-indigo-300">{commercialState.artQuotas}次</span>
            </button>

            <div className="flex items-center gap-1 bg-slate-950/80 px-2 py-1 sm:px-2.5 sm:py-1 rounded-lg border border-slate-800 text-[10px] sm:text-xs shrink-0 whitespace-nowrap">
              <Clock className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-amber-400 shrink-0" />
              <span className="text-slate-400 hidden sm:inline">纪元:</span>
              <span className="font-mono font-bold text-amber-400">Epoch {epoch}</span>
            </div>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-1.5 sm:gap-2 w-full sm:w-auto overflow-x-auto scrollbar-none py-0.5">
          <button
            onClick={onAIDeduce}
            disabled={isDeducing}
            className="flex items-center gap-1 px-2.5 sm:px-3 py-1.5 rounded-lg bg-indigo-600/30 hover:bg-indigo-600/50 text-indigo-200 border border-indigo-500/40 text-[11px] sm:text-xs font-medium transition cursor-pointer disabled:opacity-50 whitespace-nowrap shrink-0"
          >
            <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
            <span>{isDeducing ? '推演中...' : 'DM深层推演'}</span>
          </button>

          <button
            onClick={onTick}
            disabled={isTicking}
            className="flex items-center gap-1 px-3 sm:px-3.5 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 text-[11px] sm:text-xs font-bold transition shadow-lg shadow-amber-500/20 cursor-pointer disabled:opacity-50 whitespace-nowrap shrink-0"
          >
            <Zap className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
            <span>{isTicking ? '推进中' : '推进纪元'}</span>
          </button>

          <button
            onClick={() => setAutoTick(!autoTick)}
            className={`px-2.5 sm:px-3 py-1.5 rounded-lg text-[11px] sm:text-xs font-medium border transition cursor-pointer whitespace-nowrap shrink-0 ${
              autoTick
                ? 'bg-emerald-500/20 border-emerald-500/40 text-emerald-300'
                : 'bg-slate-800 border-slate-700 text-slate-400 hover:text-slate-200'
            }`}
          >
            {autoTick ? '⏱ 自动:开' : '⏱ 自动:关'}
          </button>

          <button
            onClick={() => setShowInspector(!showInspector)}
            className={`flex items-center gap-1 px-2.5 sm:px-3 py-1.5 rounded-lg text-[11px] sm:text-xs font-medium border transition cursor-pointer whitespace-nowrap shrink-0 ${
              showInspector
                ? 'bg-indigo-500/20 border-indigo-500/40 text-indigo-300'
                : 'bg-slate-800 border-slate-700 text-slate-400 hover:text-slate-200'
            }`}
          >
            <Activity className="w-3.5 h-3.5" />
            <span>{showInspector ? '隐藏上帝视角' : '⚙️ 上帝视角'}</span>
          </button>

          <button
            onClick={onReset}
            title="重置世界"
            className="p-1.5 rounded-lg bg-slate-800 hover:bg-red-500/20 text-slate-400 hover:text-red-300 border border-slate-700 transition cursor-pointer shrink-0"
          >
            <RotateCcw className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
          </button>
        </div>
      </div>
    </header>
  );
};

