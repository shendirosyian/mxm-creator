import React, { useRef, useState } from 'react';
import { Upload, X, RefreshCw, UserCheck, Users, Plus, Check } from 'lucide-react';
import { PlayerAsset } from '../types';
import { SAMPLE_PLAYERS } from '../constants/samples';

interface PlayerUploadProps {
  players: PlayerAsset[];
  activePlayerIndex: number;
  onSelectActivePlayer: (index: number) => void;
  onAddPlayers: (assets: PlayerAsset[]) => void;
  onRemovePlayer: (index: number) => void;
  onClearAllPlayers: () => void;
  isAnalyzing?: boolean;
}

export const PlayerUpload: React.FC<PlayerUploadProps> = ({
  players,
  activePlayerIndex,
  onSelectActivePlayer,
  onAddPlayers,
  onRemovePlayer,
  onClearAllPlayers,
  isAnalyzing = false,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDragOver, setIsDragOver] = useState(false);

  const activePlayer = players[activePlayerIndex] || players[0] || null;

  const handleFiles = (fileList: FileList | File[]) => {
    const validFiles = Array.from(fileList).filter((f) =>
      f.type.match(/^image\/(jpeg|jpg|png|webp)$/i)
    );

    if (validFiles.length === 0) {
      alert('Please upload valid JPG, PNG, or WEBP images.');
      return;
    }

    const readers: Promise<PlayerAsset>[] = validFiles.map((file) => {
      return new Promise((resolve) => {
        const reader = new FileReader();
        reader.onload = (e) => {
          resolve({
            dataUrl: e.target?.result as string,
            fileName: file.name,
            isSample: false,
          });
        };
        reader.readAsDataURL(file);
      });
    });

    Promise.all(readers).then((newAssets) => {
      onAddPlayers(newAssets);
    });

    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      handleFiles(e.target.files);
    }
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
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFiles(e.dataTransfer.files);
    }
  };

  const loadSampleSingle = async (sampleId: string) => {
    const sample = SAMPLE_PLAYERS.find((p) => p.id === sampleId);
    if (!sample) return;

    try {
      const resp = await fetch(sample.url);
      const blob = await resp.blob();
      const reader = new FileReader();
      reader.onloadend = () => {
        onAddPlayers([
          {
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
          },
        ]);
      };
      reader.readAsDataURL(blob);
    } catch (e) {
      console.error('Failed to load sample player:', e);
    }
  };

  const loadAllSamplesBatch = async () => {
    try {
      const loaded: PlayerAsset[] = [];
      for (const sample of SAMPLE_PLAYERS) {
        const resp = await fetch(sample.url);
        const blob = await resp.blob();
        await new Promise<void>((resolve) => {
          const reader = new FileReader();
          reader.onloadend = () => {
            loaded.push({
              dataUrl: reader.result as string,
              fileName: `${sample.name.toLowerCase().replace(' ', '_')}.jpg`,
              isSample: true,
              analysis: {
                identityDetected: true,
                bodyVisibility: sample.bodyVisibility,
                quality: 'GOOD',
                lighting: 'Studio look',
                pose: 'Natural portrait',
              },
            });
            resolve();
          };
          reader.readAsDataURL(blob);
        });
      }
      onAddPlayers(loaded);
    } catch (e) {
      console.error('Failed to load sample batch:', e);
    }
  };

  return (
    <div className="space-y-3">
      {/* Header with Title and Mode Indicator */}
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-1.5">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-neutral-200">
              Player Photo{players.length > 1 ? `s (${players.length})` : ''}
            </h3>
            {players.length > 1 && (
              <span className="flex items-center gap-1 rounded bg-[#00e599]/15 border border-[#00e599]/30 px-1.5 py-0.2 font-mono text-[9px] text-[#00e599]">
                <Users className="w-2.5 h-2.5" />
                <span>BATCH ROSTER</span>
              </span>
            )}
          </div>
          <p className="text-[11px] text-neutral-400">
            {players.length > 1
              ? 'Shared Outfit Kit applies across all people in batch'
              : 'Primary identity source (portrait or full body)'}
          </p>
        </div>

        {players.length > 0 && (
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              title="Add more photos to batch"
              className="inline-flex items-center gap-1 rounded bg-white/[0.06] hover:bg-white/10 px-2 py-0.5 text-[10px] font-medium text-neutral-300 hover:text-white transition-colors"
            >
              <Plus className="w-3 h-3 text-[#00e599]" />
              <span>Add</span>
            </button>
            <button
              type="button"
              onClick={onClearAllPlayers}
              title="Clear all uploaded people"
              className="text-[10px] text-neutral-500 hover:text-red-400 transition-colors"
            >
              Clear
            </button>
          </div>
        )}
      </div>

      {/* Hidden Multi-file input */}
      <input
        ref={fileInputRef}
        type="file"
        multiple
        accept="image/jpeg,image/png,image/webp"
        className="hidden"
        onChange={handleFileChange}
      />

      {/* Empty State: Dropzone */}
      {players.length === 0 ? (
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
            Drop photo(s) here or <span className="text-[#00e599]">browse</span>
          </p>
          <p className="mt-1 text-[11px] text-neutral-500">
            Upload 1 photo or select a multi-person batch (10+ people)
          </p>

          {/* Quick sample model buttons */}
          <div
            className="mt-4 flex flex-wrap items-center justify-center gap-1.5 pt-3 border-t border-white/[0.06]"
            onClick={(e) => e.stopPropagation()}
          >
            <span className="text-[10px] uppercase tracking-wider text-neutral-500 mr-1">
              Sample:
            </span>
            {SAMPLE_PLAYERS.map((s) => (
              <button
                key={s.id}
                type="button"
                onClick={() => loadSampleSingle(s.id)}
                className="inline-flex items-center gap-1 rounded bg-[#1e2227] px-2 py-0.5 text-[10px] font-medium text-neutral-300 hover:bg-[#282d34] hover:text-white transition-colors"
              >
                <span>{s.name}</span>
              </button>
            ))}
            <button
              type="button"
              onClick={loadAllSamplesBatch}
              className="inline-flex items-center gap-1 rounded bg-[#00e599]/10 border border-[#00e599]/30 px-2 py-0.5 text-[10px] font-medium text-[#00e599] hover:bg-[#00e599]/20 transition-colors"
            >
              <Users className="w-3 h-3" />
              <span>Load 3-Person Batch</span>
            </button>
          </div>
        </div>
      ) : (
        /* Loaded Roster State */
        <div className="space-y-2">
          {/* Active Person Spotlight Card */}
          {activePlayer && (
            <div className="relative rounded-lg border border-white/[0.08] bg-[#121417] p-2.5">
              <div className="flex items-start gap-3">
                <div className="relative h-18 w-14 shrink-0 overflow-hidden rounded bg-[#1a1d22] border border-white/10">
                  <img
                    src={activePlayer.dataUrl}
                    alt={activePlayer.fileName}
                    className="h-full w-full object-cover object-top"
                  />
                  {isAnalyzing && (
                    <div className="absolute inset-0 flex items-center justify-center bg-black/60 backdrop-blur-xs">
                      <RefreshCw className="w-4 h-4 text-[#00e599] animate-spin" />
                    </div>
                  )}
                </div>

                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-1">
                    <p className="truncate text-xs font-semibold text-white">
                      {activePlayer.fileName}
                    </p>
                    <span className="shrink-0 rounded bg-white/10 px-1.5 py-0.2 font-mono text-[9px] text-neutral-300">
                      Person {activePlayerIndex + 1}/{players.length}
                    </span>
                  </div>

                  <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[10px] text-neutral-400">
                    <span className="text-[#00e599] font-medium">Active Preview</span>
                    <span aria-hidden="true">·</span>
                    <span>{activePlayer.analysis?.bodyVisibility || 'Identity Source'}</span>
                  </div>

                  <div className="mt-1.5 flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="text-[10px] text-neutral-400 hover:text-white transition-colors"
                    >
                      + Add More
                    </button>
                    <span className="text-neutral-600">·</span>
                    <button
                      type="button"
                      onClick={() => onRemovePlayer(activePlayerIndex)}
                      className="text-[10px] text-neutral-400 hover:text-red-400 transition-colors"
                    >
                      Remove This Photo
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Multi-Person Batch Thumbnail Tray */}
          {players.length > 1 && (
            <div className="rounded-lg border border-white/[0.06] bg-[#0e1012] p-2">
              <div className="mb-1.5 flex items-center justify-between text-[10px] text-neutral-400">
                <span className="font-semibold uppercase tracking-wider">
                  Batch Roster ({players.length} People)
                </span>
                <span className="text-neutral-500">Click to preview</span>
              </div>

              <div className="flex items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar">
                {players.map((person, idx) => (
                  <div
                    key={`${person.fileName}_${idx}`}
                    onClick={() => onSelectActivePlayer(idx)}
                    className={`group relative h-12 w-10 shrink-0 cursor-pointer overflow-hidden rounded border transition-all ${
                      activePlayerIndex === idx
                        ? 'border-[#00e599] ring-2 ring-[#00e599]/30'
                        : 'border-white/10 opacity-70 hover:opacity-100 hover:border-white/25'
                    }`}
                  >
                    <img
                      src={person.dataUrl}
                      alt={person.fileName}
                      className="h-full w-full object-cover object-top"
                    />
                    <span className="absolute bottom-0 inset-x-0 bg-black/80 text-center font-mono text-[8px] text-neutral-200">
                      #{idx + 1}
                    </span>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onRemovePlayer(idx);
                      }}
                      className="absolute top-0 right-0 hidden h-3.5 w-3.5 items-center justify-center rounded-bl bg-black/80 text-neutral-400 hover:text-red-400 group-hover:flex"
                    >
                      <X className="w-2.5 h-2.5" />
                    </button>
                  </div>
                ))}

                {/* Add more button tile in tray */}
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  title="Add more people to batch"
                  className="flex h-12 w-10 shrink-0 items-center justify-center rounded border border-dashed border-white/15 bg-white/[0.02] text-neutral-400 hover:border-[#00e599] hover:text-[#00e599] transition-colors"
                >
                  <Plus className="w-3.5 h-3.5" />
                </button>
              </div>

              <div className="mt-1.5 flex items-center gap-1.5 text-[10px] text-[#00e599] font-medium pt-1 border-t border-white/[0.04]">
                <Check className="w-3 h-3" />
                <span>Shared Outfit Kit below will be applied to all {players.length} people</span>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
