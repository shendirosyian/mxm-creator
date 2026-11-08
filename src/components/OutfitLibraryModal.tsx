import React, { useState } from 'react';
import { X, Plus, Trash2, Check, Bookmark, Layers } from 'lucide-react';
import { SavedOutfit, GarmentAsset, GarmentSlotId, ColorCustomization } from '../types';

interface OutfitLibraryModalProps {
  isOpen: boolean;
  onClose: () => void;
  savedOutfits: SavedOutfit[];
  currentGarments: Partial<Record<GarmentSlotId, GarmentAsset>>;
  currentColors?: ColorCustomization;
  onSaveCurrentAsOutfit: (name: string) => void;
  onApplyOutfit: (outfit: SavedOutfit) => void;
  onDeleteOutfit: (id: string) => void;
}

export const OutfitLibraryModal: React.FC<OutfitLibraryModalProps> = ({
  isOpen,
  onClose,
  savedOutfits,
  currentGarments,
  currentColors,
  onSaveCurrentAsOutfit,
  onApplyOutfit,
  onDeleteOutfit,
}) => {
  const [newOutfitName, setNewOutfitName] = useState('');
  const [showSaveInput, setShowSaveInput] = useState(false);

  if (!isOpen) return null;

  const activeGarmentsCount = Object.keys(currentGarments).filter(
    (k) => currentGarments[k as GarmentSlotId]
  ).length;

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newOutfitName.trim()) return;
    onSaveCurrentAsOutfit(newOutfitName.trim());
    setNewOutfitName('');
    setShowSaveInput(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm">
      <div className="relative flex max-h-[85vh] w-full max-w-2xl flex-col overflow-hidden rounded-xl border border-white/10 bg-[#121417] shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-white/[0.08] px-6 py-4">
          <div className="flex items-center gap-2">
            <Bookmark className="h-4 w-4 text-[#00e599]" />
            <h2 className="text-sm font-bold uppercase tracking-wider text-white">
              Outfit Library
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded p-1 text-neutral-400 hover:text-white transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Save current outfit section */}
          <div className="rounded-lg border border-white/[0.08] bg-[#16181b] p-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-xs font-semibold text-white">
                  Save Current Combination
                </h3>
                <p className="text-[11px] text-neutral-400">
                  {activeGarmentsCount > 0
                    ? `${activeGarmentsCount} active garment slot${activeGarmentsCount > 1 ? 's' : ''}`
                    : 'No garments currently staged'}
                </p>
              </div>

              {!showSaveInput ? (
                <button
                  type="button"
                  disabled={activeGarmentsCount === 0}
                  onClick={() => setShowSaveInput(true)}
                  className="flex items-center gap-1.5 rounded bg-[#00e599] px-3 py-1.5 text-xs font-semibold text-black hover:bg-[#00ffaa] transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  <Plus className="h-3.5 w-3.5" />
                  <span>Save Look</span>
                </button>
              ) : null}
            </div>

            {showSaveInput && (
              <form onSubmit={handleSave} className="mt-3 flex items-center gap-2">
                <input
                  type="text"
                  autoFocus
                  placeholder='e.g. "Look A: Olive Bomber & Dark Denim"'
                  value={newOutfitName}
                  onChange={(e) => setNewOutfitName(e.target.value)}
                  className="flex-1 rounded border border-white/20 bg-[#1e2227] px-3 py-1.5 text-xs text-white placeholder-neutral-500 focus:border-[#00e599] focus:outline-hidden"
                />
                <button
                  type="submit"
                  className="rounded bg-[#00e599] px-3.5 py-1.5 text-xs font-semibold text-black hover:bg-[#00ffaa]"
                >
                  Save
                </button>
                <button
                  type="button"
                  onClick={() => setShowSaveInput(false)}
                  className="rounded px-2.5 py-1.5 text-xs text-neutral-400 hover:text-white"
                >
                  Cancel
                </button>
              </form>
            )}
          </div>

          {/* Saved List */}
          <div className="space-y-3">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-neutral-400">
              Saved Outfits ({savedOutfits.length})
            </h3>

            {savedOutfits.length === 0 ? (
              <p className="text-xs text-neutral-500 italic py-6 text-center">
                No outfits saved yet. Build an outfit combination in the workspace and save it for instant reuse.
              </p>
            ) : (
              <div className="space-y-2.5">
                {savedOutfits.map((outfit) => {
                  const slots = Object.keys(outfit.garments) as GarmentSlotId[];
                  return (
                    <div
                      key={outfit.id}
                      className="flex items-center justify-between rounded-lg border border-white/[0.08] bg-[#16181b] p-3 transition-colors hover:border-white/20"
                    >
                      <div className="flex items-center gap-3">
                        {/* Slot thumbnails */}
                        <div className="flex -space-x-2 overflow-hidden">
                          {slots.map((slot) => {
                            const g = outfit.garments[slot];
                            return g?.dataUrl ? (
                              <img
                                key={slot}
                                src={g.dataUrl}
                                alt={g.name}
                                className="inline-block h-9 w-9 rounded-md border border-white/20 object-cover bg-black"
                              />
                            ) : null;
                          })}
                        </div>

                        <div>
                          <h4 className="text-xs font-semibold text-white">
                            {outfit.name}
                          </h4>
                          <p className="text-[10px] text-neutral-400">
                            {slots.map((s) => s.toUpperCase()).join(' · ')}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            onApplyOutfit(outfit);
                            onClose();
                          }}
                          className="flex items-center gap-1.5 rounded bg-[#1e2329] px-3 py-1.5 text-xs font-medium text-[#00e599] hover:bg-[#282f37] transition-colors"
                        >
                          <Check className="h-3 w-3" />
                          <span>Apply to Model</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => onDeleteOutfit(outfit.id)}
                          className="rounded p-1.5 text-neutral-400 hover:text-red-400 hover:bg-white/[0.04] transition-colors"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
