import React, { useState, useEffect } from 'react';
import { Play, Sparkles, Crown, CheckCircle2, ShieldAlert, X, Volume2, FastForward } from 'lucide-react';

interface AdModalProps {
  isOpen: boolean;
  onClose: () => void;
  onUpgradeVIP: () => void;
  isVIP: boolean;
  rewardType?: 'AD_TRIGGER' | 'ART_QUOTA'; // AD_TRIGGER for 20-turn travel ad, ART_QUOTA for watching ad to get art quota
  onRewardGranted?: () => void;
}

export const AdModal: React.FC<AdModalProps> = ({
  isOpen,
  onClose,
  onUpgradeVIP,
  isVIP,
  rewardType = 'AD_TRIGGER',
  onRewardGranted,
}) => {
  const [countdown, setCountdown] = useState(60);
  const [canSkip, setCanSkip] = useState(false);

  useEffect(() => {
    if (!isOpen) {
      setCountdown(60);
      setCanSkip(false);
      return;
    }

    // Allow fast skip after 5 seconds for smooth playability in preview,
    // while presenting a realistic 60s interactive ad container
    const timer = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          setCanSkip(true);
          return 0;
        }
        if (prev <= 55) {
          setCanSkip(true); // Enable skip option after 5s in preview mode
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [isOpen]);

  if (!isOpen) return null;

  const handleFinishAd = () => {
    if (rewardType === 'ART_QUOTA' && onRewardGranted) {
      onRewardGranted();
    }
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-md p-4 animate-in fade-in duration-200">
      <div className="bg-slate-900 border border-amber-500/30 rounded-2xl max-w-lg w-full overflow-hidden shadow-2xl relative text-slate-100 flex flex-col">
        {/* Ad Header */}
        <div className="bg-gradient-to-r from-amber-950 via-slate-900 to-indigo-950 px-5 py-3 border-b border-amber-500/20 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="px-2 py-0.5 rounded bg-amber-500 text-slate-950 font-bold text-[10px]">
              商业广告投放
            </span>
            <span className="text-xs text-slate-300 font-medium">
              {rewardType === 'ART_QUOTA' ? '📺 观看广告获取 AI 画卷额度' : '⏳ 20轮/跨天行程 节点休整'}
            </span>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs font-mono text-amber-400 font-bold bg-slate-950/80 px-2.5 py-1 rounded-full border border-amber-500/30 flex items-center gap-1">
              <Volume2 className="w-3.5 h-3.5 text-amber-400" />
              {countdown > 0 ? `${countdown}s` : '可关闭'}
            </span>
          </div>
        </div>

        {/* Ad Content Simulation */}
        <div className="p-6 space-y-5 text-center bg-slate-950/60">
          <div className="relative rounded-xl overflow-hidden border border-indigo-500/30 bg-gradient-to-br from-indigo-900/40 to-slate-900 p-6 space-y-3">
            <div className="w-12 h-12 rounded-full bg-amber-500/20 border border-amber-500/40 text-amber-400 flex items-center justify-center mx-auto shadow-lg shadow-amber-500/10">
              <Sparkles className="w-6 h-6" />
            </div>
            <h3 className="text-base font-bold text-amber-200">
              【艾尔德兰·魔法工坊】极品装备与神秘药剂特卖
            </h3>
            <p className="text-xs text-slate-300 leading-relaxed">
              支持全自由 AI DM 剧情演化！开通 <span className="text-amber-400 font-bold">9.9元/月 尊享 VIP</span> 即可永久豁免跨天/移动插屏广告，并赠送 <span className="text-indigo-300 font-bold">3次高精 AI 冒险画卷生成额度</span>！
            </p>

            <div className="pt-2 flex justify-center gap-2 text-[11px] text-slate-400">
              <span className="flex items-center gap-1"><CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" /> 广告收益支持服务器算力</span>
              <span className="flex items-center gap-1"><CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" /> VIP 一键极速免打扰</span>
            </div>
          </div>

          {/* Upgrade Banner in Ad */}
          <div className="bg-gradient-to-r from-amber-500/20 via-indigo-500/20 to-amber-500/20 border border-amber-500/40 rounded-xl p-3.5 flex items-center justify-between">
            <div className="text-left">
              <div className="text-xs font-bold text-amber-300 flex items-center gap-1">
                <Crown className="w-4 h-4 text-amber-400" />
                9.9 元/月 升级 VIP 会员
              </div>
              <div className="text-[10px] text-slate-400">立享无广告推演 + 3次AI绘图额度</div>
            </div>
            <button
              onClick={() => {
                onUpgradeVIP();
                onClose();
              }}
              className="px-3 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-bold transition shadow-lg shadow-amber-500/20 cursor-pointer"
            >
              一键开通 VIP
            </button>
          </div>
        </div>

        {/* Ad Footer Actions */}
        <div className="px-6 py-4 bg-slate-950 border-t border-slate-800 flex items-center justify-between">
          <button
            onClick={() => {
              setCountdown(0);
              setCanSkip(true);
            }}
            className="text-[11px] text-slate-400 hover:text-slate-200 flex items-center gap-1 cursor-pointer"
          >
            <FastForward className="w-3.5 h-3.5 text-amber-400" />
            演示快速跳过广告
          </button>

          <button
            onClick={handleFinishAd}
            disabled={!canSkip}
            className={`px-5 py-2 rounded-xl text-xs font-bold transition cursor-pointer ${
              canSkip
                ? 'bg-indigo-600 hover:bg-indigo-500 text-white shadow-lg shadow-indigo-600/30'
                : 'bg-slate-800 text-slate-500 cursor-not-allowed'
            }`}
          >
            {canSkip ? (rewardType === 'ART_QUOTA' ? '领额度并关闭广告' : '跳过广告，继续冒险') : `观看中 (${countdown}s)`}
          </button>
        </div>
      </div>
    </div>
  );
};
