import React, { useState } from 'react';
import { Sparkles, MapPin, Calendar, Download, Share2, Plus, X, Image as ImageIcon } from 'lucide-react';
import { AdventureArtCard } from '../types';

interface AdventureGalleryModalProps {
  isOpen: boolean;
  onClose: () => void;
  artCards: AdventureArtCard[];
  artQuotas: number;
  onGenerateNewArt: () => void;
  onOpenVIPModal: () => void;
}

export const AdventureGalleryModal: React.FC<AdventureGalleryModalProps> = ({
  isOpen,
  onClose,
  artCards,
  artQuotas,
  onGenerateNewArt,
  onOpenVIPModal, }) => {
  const [selectedCard, setSelectedCard] = useState<AdventureArtCard | null>(null);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-md p-3 sm:p-4 animate-in fade-in duration-200">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-4xl w-full overflow-hidden shadow-2xl relative text-slate-100 flex flex-col max-h-[92vh]">
        {/* Gallery Header */}
        <div className="bg-slate-950 px-4 sm:px-6 py-3 sm:py-4 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-amber-500 to-indigo-600 p-0.5 shadow-lg flex items-center justify-center shrink-0">
              <ImageIcon className="w-5 h-5 text-slate-950" />
            </div>
            <div>
              <h2 className="text-sm sm:text-base font-bold text-slate-100 flex items-center gap-2">
                🎨 冒险历史 AI 叙事画卷册
                <span className="px-2 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 text-[10px] font-mono border border-indigo-500/30">
                  {artCards.length} 张保存
                </span>
              </h2>
              <p className="text-[11px] text-slate-400">结合 DM 当前剧情场景与地图演化自动生成的记录</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                if (artQuotas > 0) {
                  onGenerateNewArt();
                } else {
                  onOpenVIPModal();
                }
              }}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold transition shadow-lg shadow-indigo-600/30 cursor-pointer"
            >
              <Sparkles className="w-3.5 h-3.5 text-amber-300" />
              <span>生成新画卷 ({artQuotas}次)</span>
            </button>

            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-slate-400 hover:text-slate-200 bg-slate-800 hover:bg-slate-700 transition cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Gallery Content Grid */}
        <div className="p-4 sm:p-6 overflow-y-auto flex-1 bg-slate-950/50">
          {artCards.length === 0 ? (
            <div className="py-16 text-center space-y-4 max-w-md mx-auto">
              <div className="w-16 h-16 rounded-2xl bg-slate-900 border border-slate-800 text-slate-500 flex items-center justify-center mx-auto">
                <ImageIcon className="w-8 h-8" />
              </div>
              <h3 className="text-sm font-bold text-slate-300">画卷册为空</h3>
              <p className="text-xs text-slate-400 leading-relaxed">
                你还没有为当前的冒险故事生成画卷。点击【生成新画卷】可以根据当前所在地图与 DM 的叙事，现场渲染一张精美的高清冒险场景！
              </p>
              <button
                onClick={() => {
                  if (artQuotas > 0) {
                    onGenerateNewArt();
                  } else {
                    onOpenVIPModal();
                  }
                }}
                className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-bold transition shadow-lg shadow-amber-500/20 cursor-pointer inline-flex items-center gap-2"
              >
                <Sparkles className="w-4 h-4" />
                生成第一张场景画卷 (可用额度: {artQuotas}次)
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
              {artCards.map((card) => (
                <div
                  key={card.id}
                  onClick={() => setSelectedCard(card)}
                  className="bg-slate-900 border border-slate-800 hover:border-amber-500/50 rounded-2xl overflow-hidden shadow-lg hover:shadow-xl transition cursor-pointer group flex flex-col justify-between"
                >
                  <div className="relative aspect-video bg-slate-950 overflow-hidden">
                    <img
                      src={card.imageUrl}
                      alt={card.title}
                      referrerPolicy="no-referrer"
                      className="w-full h-full object-cover group-hover:scale-105 transition duration-300"
                    />
                    <div className="absolute top-2 left-2 px-2 py-0.5 rounded bg-slate-950/80 backdrop-blur text-[10px] text-amber-300 border border-amber-500/30 font-mono flex items-center gap-1">
                      <MapPin className="w-3 h-3 text-amber-400" />
                      {card.locationName}
                    </div>
                  </div>

                  <div className="p-3 space-y-1.5 flex-1 flex flex-col justify-between">
                    <div>
                      <h4 className="text-xs font-bold text-slate-100 group-hover:text-amber-300 transition line-clamp-1">
                        {card.title}
                      </h4>
                      <p className="text-[11px] text-slate-400 line-clamp-2 mt-1">
                        {card.narrationSummary}
                      </p>
                    </div>

                    <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between text-[10px] text-slate-500 font-mono">
                      <span className="flex items-center gap-1">
                        <Calendar className="w-3 h-3 text-indigo-400" />
                        Epoch {card.epoch}
                      </span>
                      <span>{card.timestamp}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Full Image Viewer Overlay */}
        {selectedCard && (
          <div className="absolute inset-0 z-10 bg-slate-950/95 backdrop-blur-md p-4 flex flex-col justify-between animate-in fade-in duration-200">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-amber-300">{selectedCard.title}</span>
                <span className="text-[10px] px-2 py-0.5 rounded bg-slate-800 text-slate-300">
                  {selectedCard.locationName} • Epoch {selectedCard.epoch}
                </span>
              </div>
              <button
                onClick={() => setSelectedCard(null)}
                className="p-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="flex-1 my-3 flex items-center justify-center overflow-hidden">
              <img
                src={selectedCard.imageUrl}
                alt={selectedCard.title}
                referrerPolicy="no-referrer"
                className="max-h-[60vh] max-w-full rounded-xl object-contain border border-slate-800 shadow-2xl"
              />
            </div>

            <div className="bg-slate-900 border border-slate-800 rounded-xl p-3 space-y-2 text-xs">
              <p className="text-slate-300 font-serif italic text-xs leading-relaxed">
                “{selectedCard.narrationSummary}”
              </p>
              <div className="text-[10px] font-mono text-slate-500 truncate">
                Prompt: {selectedCard.prompt}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
