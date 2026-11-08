import React, { useRef, useState } from 'react';
import { Upload, X, RefreshCw, UserCheck, Sparkles } from 'lucide-react';
import { PlayerAsset } from '../types';
import { SAMPLE_PLAYERS } from '../constants/samples';

interface PlayerUploadProps {
  playerAsset: PlayerAsset | null;
  onSelectPlayer: (asset: PlayerAsset | null) => void;
  isAnalyzing?: boolean;
}

export const PlayerUpload: React.FC<PlayerUploadProps> = ({
  playerAsset,
  onSelectPlayer,
  isAnalyzing = false,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDragOver, setIsDragOver] = useState(false);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) processFile(file);
    // Reset so same file can be re-selected if removed
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const processFile = (file: File) => {
    if (!file.type.match(/^image\/(jpeg|jpg|png|webp)$/i)) {
      alert('Please upload a valid JPG, PNG, or WEBP image.');
      return;
    }
    const reader = new FileReader();
    reader.onload = (event) => {
      const dataUrl = event.target?.result as string;
      onSelectPlayer({
        dataUrl,
        fileName: file.name,
        isSample: false,
      });
    };
    reader.readAsDataURL(file);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  };

  const handleDragLeave = () => {
    setIsDragOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file) processFile(file);
  };

  const loadSample = async (sampleId: string) => {
    const sample = SAMPLE_PLAYERS.find((p) => p.id === sampleId);
    if (!sample) return;

    try {
      const resp = await fetch(sample.url);
      const blob = await resp.blob();
      const reader = new FileReader();
      reader.onloadend = () => {
        onSelectPlayer({
          dataUrl: reader.result as string,
          fileName: `${sample.name.toLowerCase().replace(' ', '_')}.jpg`,
          isSample: true,
          analysis: {
            identityDetected: true,
            bodyVisibility: sample.bodyVisibility,
            quality: 'GOOD',
            lighting: 'Natural studio look',
            pose: 'Natural portrait',
          },
        });
      };
      reader.readAsDataURL(blob);
    } catch (e) {
      console.error('Failed to load sample player:', e);
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-xs font-semibold uppercase tracking-wider text-neutral-200">
            Player Photo
          </h3>
          <p className="text-[11px] text-neutral-400">
            Primary identity source (portrait, half, or full body)
          </p>
        </div>
        {playerAsset && (
          <span className="flex items-center gap-1.5 text-[11px] font-medium text-[#00e599]">
            <UserCheck className="w-3.5 h-3.5" />
            <span>Identity Loaded</span>
          </span>
        )}
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        className="hidden"
        onChange={handleFileChange}
      />

      {!playerAsset ? (
        <div
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
          className={`group relative flex cursor-pointer flex-col items-center justify-center rounded-lg border border-dashed p-6 text-center transition-all ${
            isDragOver
              ? 'border-[#00e599] bg-[#00e599]/[0.05]'
              : 'border-white/[0.12] bg-[#121417] hover:border-white/25 hover:bg-[#15181c]'
          }`}
        >
          <div className="mb-2 flex h-10 w-10 items-center justify-center rounded-full border border-white/10 bg-[#181b1f] text-neutral-300 transition-transform group-hover:scale-105">
            <Upload className="h-4 w-4" />
          </div>
          <p className="text-xs font-medium text-neutral-200">
            Drop photo here or <span className="text-[#00e599]">browse</span>
          </p>
          <p className="mt-1 text-[11px] text-neutral-500">
            JPG, PNG, WEBP · Casual phone shots or studio photos
          </p>

          {/* Quick sample model buttons */}
          <div
            className="mt-4 flex flex-wrap items-center justify-center gap-2 pt-3 border-t border-white/[0.06]"
            onClick={(e) => e.stopPropagation()}
          >
            <span className="text-[10px] uppercase tracking-wider text-neutral-500">
              Quick Test:
            </span>
            {SAMPLE_PLAYERS.map((s) => (
              <button
                key={s.id}
                type="button"
                onClick={() => loadSample(s.id)}
                className="inline-flex items-center gap-1 rounded bg-[#1e2227] px-2.5 py-1 text-[11px] font-medium text-neutral-300 hover:bg-[#282d34] hover:text-white transition-colors"
              >
                <span>{s.name}</span>
              </button>
            ))}
          </div>
        </div>
      ) : (
        <div className="relative rounded-lg border border-white/[0.08] bg-[#121417] p-2.5">
          <div className="flex items-start gap-3">
            <div className="relative h-20 w-16 shrink-0 overflow-hidden rounded bg-[#1a1d22] border border-white/10">
              <img
                src={playerAsset.dataUrl}
                alt="Player reference"
                className="h-full w-full object-cover object-top"
              />
              {isAnalyzing && (
                <div className="absolute inset-0 flex items-center justify-center bg-black/60 backdrop-blur-xs">
                  <RefreshCw className="w-4 h-4 text-[#00e599] animate-spin" />
                </div>
              )}
            </div>

            <div className="min-w-0 flex-1">
              <div className="flex items-start justify-between gap-2">
                <p className="truncate text-xs font-medium text-white">
                  {playerAsset.fileName}
                </p>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    title="Replace player photo"
                    className="rounded p-1 text-neutral-400 hover:bg-white/[0.06] hover:text-white transition-colors"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => onSelectPlayer(null)}
                    title="Remove player photo"
                    className="rounded p-1 text-neutral-400 hover:bg-red-500/20 hover:text-red-400 transition-colors"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] text-neutral-400">
                <span>
                  {playerAsset.analysis?.bodyVisibility || 'Identity Source'}
                </span>
                <span aria-hidden="true">·</span>
                <span className="font-mono text-[10px] text-neutral-500">
                  {playerAsset.isSample ? 'Studio Sample' : 'Custom Upload'}
                </span>
              </div>

              {playerAsset.analysis?.lighting && (
                <p className="mt-1 text-[10px] text-neutral-500 line-clamp-1">
                  Lighting: {playerAsset.analysis.lighting}
                </p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
