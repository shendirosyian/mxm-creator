import React, { useRef } from 'react';
import { Shirt, Footprints, Watch, Plus, X, RefreshCw, Layers } from 'lucide-react';
import { GarmentAsset, GarmentSlotId } from '../types';
import { SAMPLE_GARMENTS } from '../constants/samples';

interface OutfitUploadProps {
  garments: Partial<Record<GarmentSlotId, GarmentAsset>>;
  onUpdateGarment: (slot: GarmentSlotId, asset: GarmentAsset | null) => void;
  onOpenOutfitLibrary?: () => void;
  savedOutfitsCount?: number;
}

interface SlotConfig {
  id: GarmentSlotId;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  hint: string;
  isSupportedNow: boolean;
  statusBadge: string;
}

const SLOTS: SlotConfig[] = [
  {
    id: 'top',
    label: 'Top / Shirt',
    icon: Shirt,
    hint: 'Tee, jacket, shirt, hoodie',
    isSupportedNow: true,
    statusBadge: 'IDM-VTON / Gemini',
  },
  {
    id: 'pants',
    label: 'Pants / Bottom',
    icon: Layers,
    hint: 'Jeans, cargo, shorts, trousers',
    isSupportedNow: true,
    statusBadge: 'OOTDiff / Gemini',
  },
  {
    id: 'shoes',
    label: 'Shoes / Footwear',
    icon: Footprints,
    hint: 'Sneakers, boots, shoes',
    isSupportedNow: true,
    statusBadge: 'Gemini Inpainting',
  },
  {
    id: 'accessories',
    label: 'Accessories',
    icon: Watch,
    hint: 'Caps, hats, eyewear, glasses',
    isSupportedNow: true,
    statusBadge: 'Gemini Inpainting',
  },
];

export const OutfitUpload: React.FC<OutfitUploadProps> = ({
  garments,
  onUpdateGarment,
  onOpenOutfitLibrary,
  savedOutfitsCount = 0,
}) => {
  const fileInputs = {
    top: useRef<HTMLInputElement>(null),
    pants: useRef<HTMLInputElement>(null),
    shoes: useRef<HTMLInputElement>(null),
    accessories: useRef<HTMLInputElement>(null),
  };

  const handleFile = (slot: GarmentSlotId, file: File) => {
    if (!file.type.match(/^image\/(jpeg|jpg|png|webp)$/i)) {
      alert('Please upload a valid JPG, PNG, or WEBP garment image.');
      return;
    }
    const reader = new FileReader();
    reader.onload = (e) => {
      onUpdateGarment(slot, {
        slot,
        dataUrl: e.target?.result as string,
        fileName: file.name,
        name: file.name.replace(/\.[^/.]+$/, ''),
        isSample: false,
      });
    };
    reader.readAsDataURL(file);
  };

  const loadSampleGarment = async (slot: GarmentSlotId, sampleId: string) => {
    const sample = SAMPLE_GARMENTS.find((g) => g.id === sampleId);
    if (!sample) return;

    try {
      const resp = await fetch(sample.url);
      const blob = await resp.blob();
      const reader = new FileReader();
      reader.onloadend = () => {
        onUpdateGarment(slot, {
          slot,
          dataUrl: reader.result as string,
          fileName: `${sample.name.toLowerCase().replace(/\s+/g, '_')}.jpg`,
          name: sample.name,
          isSample: true,
          analysis: {
            garmentType: sample.name,
            shapeDetected: true,
            colorsDetected: [sample.colorHex],
            patternLogos: sample.description,
            status: 'GOOD',
          },
        });
      };
      reader.readAsDataURL(blob);
    } catch (e) {
      console.error('Failed to load sample garment:', e);
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-xs font-semibold uppercase tracking-wider text-neutral-200">
            Upload Outfit
          </h3>
          <p className="text-[11px] text-neutral-400">
            Optional garment slots · Flat-lay, folded, hanger, or model photos
          </p>
        </div>

        {onOpenOutfitLibrary && (
          <button
            type="button"
            onClick={onOpenOutfitLibrary}
            className="text-[11px] font-medium text-[#00e599] hover:underline"
          >
            Outfit Library {savedOutfitsCount > 0 && `(${savedOutfitsCount})`}
          </button>
        )}
      </div>

      {/* 4 Garment Slots */}
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-2">
        {SLOTS.map((slot) => {
          const current = garments[slot.id];
          const Icon = slot.icon;

          return (
            <div
              key={slot.id}
              className="relative flex flex-col rounded-lg border border-white/[0.08] bg-[#121417] p-2.5 transition-colors hover:border-white/20"
            >
              <input
                ref={fileInputs[slot.id]}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) handleFile(slot.id, file);
                  e.target.value = '';
                }}
              />

              <div className="mb-2 flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <Icon className="h-3.5 w-3.5 text-neutral-400" />
                  <span className="text-[11px] font-semibold uppercase tracking-wider text-neutral-300">
                    {slot.label.split('/')[0]}
                  </span>
                  <span
                    className={`font-mono text-[9px] px-1 py-0.2 rounded border ${
                      slot.isSupportedNow
                        ? 'border-[#00e599]/40 bg-[#00e599]/10 text-[#00e599]'
                        : 'border-white/10 bg-white/5 text-neutral-400'
                    }`}
                  >
                    {slot.statusBadge}
                  </span>
                </div>

                {current && (
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => fileInputs[slot.id].current?.click()}
                      title="Replace garment"
                      className="rounded p-0.5 text-neutral-400 hover:text-white transition-colors"
                    >
                      <RefreshCw className="h-3 w-3" />
                    </button>
                    <button
                      type="button"
                      onClick={() => onUpdateGarment(slot.id, null)}
                      title="Remove garment"
                      className="rounded p-0.5 text-neutral-400 hover:text-red-400 transition-colors"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                )}
              </div>

              {current ? (
                <div className="relative aspect-square w-full overflow-hidden rounded bg-[#181b1f] border border-white/10">
                  <img
                    src={current.dataUrl}
                    alt={current.name || slot.label}
                    className="h-full w-full object-cover"
                  />
                  <div className="absolute bottom-0 inset-x-0 bg-black/75 px-1.5 py-1 text-[10px] text-neutral-200 truncate backdrop-blur-xs">
                    {current.name || current.fileName}
                  </div>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => fileInputs[slot.id].current?.click()}
                  className="flex aspect-square w-full flex-col items-center justify-center rounded border border-dashed border-white/10 bg-[#16181b] p-2 text-center transition-colors hover:border-[#00e599]/50 hover:bg-[#1a1e22]"
                >
                  <Plus className="h-4 w-4 text-neutral-400 mb-1" />
                  <span className="text-[10px] font-medium text-neutral-300">Add {slot.label.split('/')[0]}</span>
                  <span className="text-[9px] text-neutral-400 mt-0.5 leading-tight line-clamp-1">{slot.hint}</span>
                </button>
              )}
            </div>
          );
        })}
      </div>

      {/* Quick sample garments */}
      <div className="flex items-center justify-between pt-1 border-t border-white/[0.06] text-[11px] text-neutral-400">
        <span>Sample references:</span>
        <div className="flex items-center gap-1.5">
          {SAMPLE_GARMENTS.map((sg) => (
            <button
              key={sg.id}
              type="button"
              onClick={() => loadSampleGarment(sg.slot, sg.id)}
              className="rounded bg-[#1a1d22] px-2 py-0.5 text-[10px] text-neutral-300 hover:bg-[#23282f] hover:text-white transition-colors"
            >
              + {sg.name.split(' ')[0]}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};
