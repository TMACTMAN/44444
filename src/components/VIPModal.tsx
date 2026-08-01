import React from 'react';
import { Crown, Sparkles, Check, Play, Zap, ShieldCheck, X } from 'lucide-react';
import { UserCommercialState } from '../types';

interface VIPModalProps {
  isOpen: boolean;
  onClose: () => void;
  commercialState: UserCommercialState;
  onActivateVIP: () => void;
  onWatchAdForArtQuota: () => void;
  onRechargeArtQuota: (count: number) => void;
}

export const VIPModal: React.FC<VIPModalProps> = ({
  isOpen,
  onClose,
  commercialState,
  onActivateVIP,
  onWatchAdForArtQuota,
  onRechargeArtQuota,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div className="bg-slate-900 border border-amber-500/30 rounded-2xl max-w-lg w-full overflow-hidden shadow-2xl relative text-slate-100 flex flex-col max-h-[90vh]">
        {/* Modal Header */}
        <div className="bg-gradient-to-r from-amber-950 via-slate-900 to-indigo-950 p-5 border-b border-amber-500/20 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/20 border border-amber-500/40 text-amber-400 flex items-center justify-center shadow-lg shadow-amber-500/10">
              <Crown className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-base font-bold text-amber-200 flex items-center gap-2">
                商业化特权 & AI 绘图中心
                {commercialState.isVIP && (
                  <span className="px-2 py-0.5 rounded-full bg-amber-500/30 text-amber-300 text-[10px] font-mono border border-amber-500/40">
                    👑 VIP 会员已激活
                  </span>
                )}
              </h2>
              <p className="text-xs text-slate-400">广告免打扰 • 3次AI画卷额度 • 多通道补充</p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-200 bg-slate-800/80 hover:bg-slate-800 transition cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Scrollable Content */}
        <div className="p-5 overflow-y-auto space-y-5 bg-slate-950/40 text-xs">
          {/* VIP Main Card */}
          <div className="relative rounded-2xl p-5 bg-gradient-to-br from-amber-950/50 via-slate-900 to-indigo-950/60 border border-amber-500/40 shadow-xl space-y-4">
            <div className="flex items-start justify-between">
              <div>
                <span className="px-2.5 py-1 rounded-full bg-amber-500 text-slate-950 text-[10px] font-bold font-mono">
                  推荐性价比首选
                </span>
                <h3 className="text-lg font-bold text-amber-200 mt-1 flex items-center gap-1.5">
                  <Crown className="w-5 h-5 text-amber-400" />
                  VIP 尊享月卡
                </h3>
              </div>
              <div className="text-right">
                <span className="text-2xl font-black text-amber-400 font-mono">¥9.9</span>
                <span className="text-[10px] text-slate-400 font-normal"> / 30 天</span>
              </div>
            </div>

            <ul className="space-y-2 text-slate-300">
              <li className="flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
                <span><strong className="text-amber-300">全流程广告免打扰</strong>: 自动跨过每20轮及跨天行程的插屏广告</span>
              </li>
              <li className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-indigo-400 shrink-0" />
                <span><strong className="text-indigo-300">AI 冒险画卷生图额度</strong>: 激活即赠送 <strong className="text-amber-400 font-mono">3 次</strong> 高品质 AI 场景叙事画卷生成额度</span>
              </li>
              <li className="flex items-center gap-2">
                <Zap className="w-4 h-4 text-amber-400 shrink-0" />
                <span><strong className="text-slate-200">高优先算力通道</strong>: AI DM 记忆与因果推演引擎算力优先分配</span>
              </li>
            </ul>

            <button
              onClick={() => {
                onActivateVIP();
              }}
              className="w-full py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-amber-400 hover:from-amber-400 hover:to-amber-300 text-slate-950 font-bold text-xs transition shadow-lg shadow-amber-500/20 cursor-pointer flex items-center justify-center gap-2"
            >
              <Crown className="w-4 h-4" />
              {commercialState.isVIP ? '续费 VIP 尊享月卡 (¥9.9)' : '立即开通 VIP 尊享月卡 (¥9.9)'}
            </button>
          </div>

          {/* AI Art Quota Management Section */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 space-y-3">
            <div className="flex items-center justify-between">
              <span className="font-bold text-slate-200 flex items-center gap-1.5">
                <Sparkles className="w-4 h-4 text-indigo-400" />
                当前 AI 场景画卷生成额度:
              </span>
              <span className="px-3 py-1 rounded-full bg-indigo-500/20 text-indigo-300 font-bold font-mono text-sm border border-indigo-500/30">
                {commercialState.artQuotas} 次
              </span>
            </div>
            <p className="text-[11px] text-slate-400 leading-relaxed">
              因为大模型生图成本较高，额度用于为当前的冒险故事、场景与奇遇生成高精度的 AI 场景画卷。
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-1">
              {/* Option A: Watch Ad */}
              <button
                onClick={() => {
                  onWatchAdForArtQuota();
                  onClose();
                }}
                className="p-3 rounded-xl bg-slate-950 border border-indigo-500/30 hover:border-indigo-400 text-left transition cursor-pointer flex flex-col justify-between space-y-1 hover:bg-indigo-950/20"
              >
                <div className="flex items-center gap-1.5 text-indigo-300 font-bold">
                  <Play className="w-3.5 h-3.5 text-indigo-400" />
                  看广告领额度
                </div>
                <div className="text-[10px] text-slate-400">观看 30 秒广告获得 <strong className="text-indigo-300 font-mono">+1 次</strong> 生图额度</div>
              </button>

              {/* Option B: Recharge 1 RMB for 2 Quotas */}
              <button
                onClick={() => {
                  onRechargeArtQuota(2);
                }}
                className="p-3 rounded-xl bg-slate-950 border border-amber-500/30 hover:border-amber-400 text-left transition cursor-pointer flex flex-col justify-between space-y-1 hover:bg-amber-950/20"
              >
                <div className="flex items-center gap-1.5 text-amber-300 font-bold">
                  <Zap className="w-3.5 h-3.5 text-amber-400" />
                  充值画卷包 (¥1.00)
                </div>
                <div className="text-[10px] text-slate-400">直接购买获 <strong className="text-amber-400 font-mono">+2 次</strong> 高精画卷额度</div>
              </button>
            </div>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="px-5 py-3 bg-slate-950 border-t border-slate-800 text-[10px] text-slate-500 text-center">
          💡 提示：所有广告与特权购买收益将用于持续支持本开放世界 AI DM 算力与画卷渲染
        </div>
      </div>
    </div>
  );
};
