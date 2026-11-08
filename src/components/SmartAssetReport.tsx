import React, { useState } from 'react';
import { ChevronDown, ChevronUp, ShieldCheck, AlertCircle, Info, Sparkles } from 'lucide-react';
import { PlayerAsset, GarmentAsset, GarmentSlotId } from '../types';

interface SmartAssetReportProps {
  playerAsset: PlayerAsset | null;
  garments: Partial<Record<GarmentSlotId, GarmentAsset>>;
  isAnalyzing?: boolean;
}

export const SmartAssetReport: React.FC<SmartAssetReportProps> = ({
  playerAsset,
  garments,
  isAnalyzing = false,
}) => {
  const [isExpanded, setIsExpanded] = useState(false);

  const activeGarments = Object.entries(garments).filter(([_, g]) => g !== null && g !== undefined);

  if (!playerAsset && activeGarments.length === 0) {
    return null;
  }

  const pAnalysis = playerAsset?.analysis;

  // Derive simple overall status
  const isAllGood =
    (!pAnalysis || pAnalysis.quality === 'GOOD') &&
    activeGarments.every(([_, g]) => !g?.analysis || g.analysis.status === 'GOOD');

  return (
    <div className="rounded-lg border border-white/[0.08] bg-[#121417] text-xs">
      <button
        type="button"
        onClick={() => setIsExpanded(!isExpanded)}
        className="flex w-full items-center justify-between p-2.5 text-left text-neutral-300 hover:text-white transition-colors"
      >
        <div className="flex items-center gap-2">
          {isAnalyzing ? (
            <Sparkles className="h-3.5 w-3.5 text-[#00e599] animate-pulse" />
          ) : isAllGood ? (
            <ShieldCheck className="h-3.5 w-3.5 text-[#00e599]" />
          ) : (
            <AlertCircle className="h-3.5 w-3.5 text-amber-400" />
          )}
          <span className="font-semibold uppercase tracking-wider text-[11px]">
            Smart Asset Intelligence
          </span>
          <span className="text-[10px] text-neutral-400">
            {isAnalyzing ? 'Analyzing assets...' : isAllGood ? 'Verified' : 'Review suggested'}
          </span>
        </div>

        <div className="flex items-center gap-1.5 text-neutral-400">
          <span className="text-[10px] font-mono">
            {isExpanded ? 'Hide' : 'Details'}
          </span>
          {isExpanded ? (
            <ChevronUp className="h-3.5 w-3.5" />
          ) : (
            <ChevronDown className="h-3.5 w-3.5" />
          )}
        </div>
      </button>

      {isExpanded && (
        <div className="border-t border-white/[0.06] p-2.5 space-y-2.5 text-[11px]">
          {/* Player assessment */}
          {playerAsset && (
            <div className="space-y-1">
              <div className="flex items-center justify-between text-neutral-400">
                <span className="font-medium text-neutral-300 uppercase text-[10px] tracking-wider">
                  Player Identity
                </span>
                <span className="text-[#00e599] font-mono text-[10px]">
                  {pAnalysis?.quality || 'GOOD'}
                </span>
              </div>
              <div className="text-neutral-400 space-y-0.5">
                <p>
                  Visibility: <span className="text-neutral-200">{pAnalysis?.bodyVisibility || 'Upper body detected'}</span>
                </p>
                {pAnalysis?.lighting && (
                  <p>
                    Lighting: <span className="text-neutral-200">{pAnalysis.lighting}</span>
                  </p>
                )}
                {pAnalysis?.pose && (
                  <p>
                    Pose: <span className="text-neutral-200">{pAnalysis.pose}</span>
                  </p>
                )}
              </div>
            </div>
          )}

          {/* Garments assessment */}
          {activeGarments.length > 0 && (
            <div className="space-y-1 pt-1.5 border-t border-white/[0.06]">
              <span className="font-medium text-neutral-300 uppercase text-[10px] tracking-wider block">
                Garment References
              </span>
              {activeGarments.map(([slot, garment]) => {
                const gAnalysis = garment?.analysis;
                return (
                  <div key={slot} className="flex items-start justify-between text-neutral-400 py-0.5">
                    <div>
                      <span className="uppercase text-[10px] text-neutral-300">{slot}: </span>
                      <span>{garment?.name || garment?.fileName}</span>
                    </div>
                    <span className="font-mono text-[10px] text-[#00e599]">
                      {gAnalysis?.status || 'GOOD'}
                    </span>
                  </div>
                );
              })}
            </div>
          )}

          <div className="pt-1 text-[10px] text-neutral-500 italic">
            AI automatically enhances low-res inputs and reconstructs natural fabric folds.
          </div>
        </div>
      )}
    </div>
  );
};
