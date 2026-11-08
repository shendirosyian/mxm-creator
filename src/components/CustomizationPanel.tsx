import React, { useState } from 'react';
import {
  Palette,
  Smile,
  Scissors,
  Camera,
  Sun,
  FileText,
  ChevronDown,
  ChevronUp,
  RotateCcw,
  Sparkles,
  Sliders,
  Layers,
} from 'lucide-react';
import { CustomizationSettings, GenerationMode } from '../types';
import {
  PRESET_SWATCHES,
  EXPRESSION_PRESETS,
  HAIRSTYLE_PRESETS,
  HAIR_COLOR_PRESETS,
  POSE_PRESETS,
  LIGHTING_PRESETS,
} from '../constants/samples';

interface CustomizationPanelProps {
  customization: CustomizationSettings;
  onChangeCustomization: (settings: CustomizationSettings) => void;
  mode: GenerationMode;
  onChangeMode: (mode: GenerationMode) => void;
  variationsCount: number;
  onChangeVariationsCount: (count: number) => void;
  isGenerating: boolean;
  onGenerate: () => void;
  canGenerate: boolean;
  validationNotice?: string;
  hasPlayer: boolean;
}

export const CustomizationPanel: React.FC<CustomizationPanelProps> = ({
  customization,
  onChangeCustomization,
  mode,
  onChangeMode,
  variationsCount,
  onChangeVariationsCount,
  isGenerating,
  onGenerate,
  canGenerate,
  validationNotice,
  hasPlayer,
}) => {
  // Accordion state
  const [openSection, setOpenSection] = useState<string | null>('prompt'); // Default open prompt

  const toggleSection = (id: string) => {
    setOpenSection(openSection === id ? null : id);
  };

  const updateColor = (category: 'shirt' | 'pants' | 'shoes' | 'accessories', color?: string) => {
    onChangeCustomization({
      ...customization,
      colors: {
        ...customization.colors,
        [category]: color || undefined,
      },
    });
  };

  const resetAllCustomizations = () => {
    onChangeCustomization({
      colors: {},
      faceExpression: 'Original',
      hairStyle: 'Original',
      hairColor: 'Original',
      facialHair: 'Original',
      pose: 'Original',
      lighting: 'Original',
      customPrompt: '',
      editTarget: 'Overall',
    });
  };

  const hasAnyCustomization =
    Boolean(customization.customPrompt) ||
    Object.keys(customization.colors).length > 0 ||
    customization.faceExpression !== 'Original' ||
    customization.hairStyle !== 'Original' ||
    customization.pose !== 'Original' ||
    customization.lighting !== 'Original';

  return (
    <div className="flex h-full flex-col justify-between space-y-4">
      {/* Top: Mode Selector */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <label className="text-xs font-semibold uppercase tracking-wider text-neutral-200">
            Style Atmosphere
          </label>
          {hasAnyCustomization && (
            <button
              type="button"
              onClick={resetAllCustomizations}
              className="flex items-center gap-1 text-[11px] text-neutral-400 hover:text-white transition-colors"
            >
              <RotateCcw className="w-3 h-3" />
              <span>Reset Options</span>
            </button>
          )}
        </div>

        {/* 3 Modes: REALISTIC, STUDIO, CREATIVE */}
        <div className="grid grid-cols-3 gap-1.5 rounded-lg bg-[#121417] p-1 border border-white/[0.06]">
          {(['REALISTIC', 'STUDIO', 'CREATIVE'] as GenerationMode[]).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => onChangeMode(m)}
              className={`rounded py-2 text-center text-[11px] font-semibold transition-all ${
                mode === m
                  ? 'bg-[#1e2329] text-white shadow-sm border border-white/10'
                  : 'text-neutral-400 hover:text-neutral-200'
              }`}
            >
              {m.charAt(0) + m.slice(1).toLowerCase()}
            </button>
          ))}
        </div>

        {/* Collapsible Sections */}
        <div className="space-y-2 text-xs">
          {/* 1. CUSTOM PROMPT EDITOR (Key differentiator) */}
          <div className="rounded-lg border border-white/[0.08] bg-[#121417]">
            <button
              type="button"
              onClick={() => toggleSection('prompt')}
              className="flex w-full items-center justify-between p-3 text-left font-medium text-neutral-200 hover:text-white transition-colors"
            >
              <div className="flex items-center gap-2">
                <FileText className="h-4 w-4 text-[#00e599]" />
                <span className="uppercase text-[11px] tracking-wider font-semibold">
                  Custom Edit Prompt
                </span>
                {customization.customPrompt && (
                  <span className="h-1.5 w-1.5 rounded-full bg-[#00e599]" />
                )}
              </div>
              {openSection === 'prompt' ? (
                <ChevronUp className="h-4 w-4 text-neutral-400" />
              ) : (
                <ChevronDown className="h-4 w-4 text-neutral-400" />
              )}
            </button>

            {openSection === 'prompt' && (
              <div className="border-t border-white/[0.06] p-3 space-y-2.5">
                <div className="flex items-center justify-between text-[11px] text-neutral-400">
                  <span>Describe exactly what you want to change:</span>
                  <span className="text-[10px] text-neutral-400">EN / ID</span>
                </div>

                <textarea
                  rows={3}
                  value={customization.customPrompt}
                  onChange={(e) =>
                    onChangeCustomization({
                      ...customization,
                      customPrompt: e.target.value,
                    })
                  }
                  placeholder='e.g. "Change the shirt to dark navy blue. Preserve its original logo and stitching. Make the pants slightly loose fit. Give the person a confident expression. Keep original face."'
                  className="w-full rounded border border-white/10 bg-[#16191d] p-2.5 text-xs text-neutral-200 placeholder-neutral-600 focus:border-[#00e599] focus:outline-hidden"
                />

                {/* Target selector */}
                <div className="flex items-center gap-1.5 pt-1">
                  <span className="text-[10px] text-neutral-400 uppercase tracking-wider">
                    Focus:
                  </span>
                  {(['Overall', 'Clothing', 'Face', 'Hair', 'Accessories'] as const).map(
                    (target) => (
                      <button
                        key={target}
                        type="button"
                        onClick={() =>
                          onChangeCustomization({
                            ...customization,
                            editTarget: target,
                          })
                        }
                        className={`rounded px-2 py-0.5 text-[10px] transition-colors ${
                          customization.editTarget === target
                            ? 'bg-[#00e599]/20 text-[#00e599] font-medium'
                            : 'text-neutral-400 hover:text-neutral-200 bg-[#181b1f]'
                        }`}
                      >
                        {target}
                      </button>
                    )
                  )}
                </div>
              </div>
            )}
          </div>

          {/* 2. CLOTHING COLOR */}
          <div className="rounded-lg border border-white/[0.08] bg-[#121417]">
            <button
              type="button"
              onClick={() => toggleSection('colors')}
              className="flex w-full items-center justify-between p-3 text-left font-medium text-neutral-200 hover:text-white transition-colors"
            >
              <div className="flex items-center gap-2">
                <Palette className="h-4 w-4 text-neutral-400" />
                <span className="uppercase text-[11px] tracking-wider font-semibold">
                  Garment Colors
                </span>
                {Object.keys(customization.colors).length > 0 && (
                  <span className="h-1.5 w-1.5 rounded-full bg-[#00e599]" />
                )}
              </div>
              {openSection === 'colors' ? (
                <ChevronUp className="h-4 w-4 text-neutral-400" />
              ) : (
                <ChevronDown className="h-4 w-4 text-neutral-400" />
              )}
            </button>

            {openSection === 'colors' && (
              <div className="border-t border-white/[0.06] p-3 space-y-3">
                <p className="text-[11px] text-neutral-400 leading-tight">
                  Independent color overrides. Garment logos, patterns, and fabric texture are preserved.
                </p>

                {(['shirt', 'pants', 'shoes', 'accessories'] as const).map((cat) => {
                  const currentColor = customization.colors[cat];
                  return (
                    <div key={cat} className="space-y-1.5">
                      <div className="flex items-center justify-between text-[11px]">
                        <span className="capitalize text-neutral-300 font-medium">
                          {cat}
                        </span>
                        {currentColor && (
                          <button
                            type="button"
                            onClick={() => updateColor(cat, undefined)}
                            className="text-[10px] text-neutral-400 hover:text-white"
                          >
                            Reset
                          </button>
                        )}
                      </div>

                      <div className="flex items-center gap-2">
                        {/* Custom color input */}
                        <div className="relative flex items-center">
                          <input
                            type="color"
                            value={currentColor || '#111315'}
                            onChange={(e) => updateColor(cat, e.target.value)}
                            className="h-6 w-6 cursor-pointer rounded border border-white/20 bg-transparent"
                          />
                        </div>

                        {/* Presets */}
                        <div className="flex flex-wrap items-center gap-1">
                          {PRESET_SWATCHES.slice(0, 6).map((swatch) => (
                            <button
                              key={swatch.name}
                              type="button"
                              title={swatch.name}
                              onClick={() => updateColor(cat, swatch.hex)}
                              className={`h-5 w-5 rounded-full border transition-transform ${
                                currentColor === swatch.hex
                                  ? 'border-[#00e599] scale-110'
                                  : 'border-white/10 hover:scale-105'
                              }`}
                              style={{ backgroundColor: swatch.hex }}
                            />
                          ))}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* 3. FACE & EXPRESSION */}
          <div className="rounded-lg border border-white/[0.08] bg-[#121417]">
            <button
              type="button"
              onClick={() => toggleSection('face')}
              className="flex w-full items-center justify-between p-3 text-left font-medium text-neutral-200 hover:text-white transition-colors"
            >
              <div className="flex items-center gap-2">
                <Smile className="h-4 w-4 text-neutral-400" />
                <span className="uppercase text-[11px] tracking-wider font-semibold">
                  Face & Expression
                </span>
                {customization.faceExpression !== 'Original' && (
                  <span className="h-1.5 w-1.5 rounded-full bg-[#00e599]" />
                )}
              </div>
              {openSection === 'face' ? (
                <ChevronUp className="h-4 w-4 text-neutral-400" />
              ) : (
                <ChevronDown className="h-4 w-4 text-neutral-400" />
              )}
            </button>

            {openSection === 'face' && (
              <div className="border-t border-white/[0.06] p-3 space-y-2">
                <p className="text-[11px] text-neutral-400 leading-tight">
                  Adjust expression while strictly retaining facial identity and recognizable features.
                </p>

                <div className="flex flex-wrap gap-1.5 pt-1">
                  {EXPRESSION_PRESETS.map((expr) => (
                    <button
                      key={expr}
                      type="button"
                      onClick={() =>
                        onChangeCustomization({
                          ...customization,
                          faceExpression: expr,
                        })
                      }
                      className={`rounded px-2.5 py-1 text-[11px] transition-colors ${
                        customization.faceExpression === expr
                          ? 'bg-[#00e599] text-black font-semibold'
                          : 'bg-[#181b1f] text-neutral-300 hover:bg-[#20252b]'
                      }`}
                    >
                      {expr}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* 4. HAIR & GROOMING */}
          <div className="rounded-lg border border-white/[0.08] bg-[#121417]">
            <button
              type="button"
              onClick={() => toggleSection('hair')}
              className="flex w-full items-center justify-between p-3 text-left font-medium text-neutral-200 hover:text-white transition-colors"
            >
              <div className="flex items-center gap-2">
                <Scissors className="h-4 w-4 text-neutral-400" />
                <span className="uppercase text-[11px] tracking-wider font-semibold">
                  Hair & Grooming
                </span>
                {customization.hairStyle !== 'Original' && (
                  <span className="h-1.5 w-1.5 rounded-full bg-[#00e599]" />
                )}
              </div>
              {openSection === 'hair' ? (
                <ChevronUp className="h-4 w-4 text-neutral-400" />
              ) : (
                <ChevronDown className="h-4 w-4 text-neutral-400" />
              )}
            </button>

            {openSection === 'hair' && (
              <div className="border-t border-white/[0.06] p-3 space-y-2.5">
                <div>
                  <span className="text-[10px] uppercase tracking-wider text-neutral-400 block mb-1">
                    Hairstyle:
                  </span>
                  <div className="flex flex-wrap gap-1.5">
                    {HAIRSTYLE_PRESETS.map((hs) => (
                      <button
                        key={hs}
                        type="button"
                        onClick={() =>
                          onChangeCustomization({
                            ...customization,
                            hairStyle: hs,
                          })
                        }
                        className={`rounded px-2.5 py-1 text-[11px] transition-colors ${
                          customization.hairStyle === hs
                            ? 'bg-[#00e599] text-black font-semibold'
                            : 'bg-[#181b1f] text-neutral-300 hover:bg-[#20252b]'
                        }`}
                      >
                        {hs}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <span className="text-[10px] uppercase tracking-wider text-neutral-400 block mb-1">
                    Hair Color:
                  </span>
                  <div className="flex flex-wrap gap-1.5">
                    {HAIR_COLOR_PRESETS.map((hc) => (
                      <button
                        key={hc}
                        type="button"
                        onClick={() =>
                          onChangeCustomization({
                            ...customization,
                            hairColor: hc,
                          })
                        }
                        className={`rounded px-2.5 py-1 text-[11px] transition-colors ${
                          customization.hairColor === hc
                            ? 'bg-[#00e599] text-black font-semibold'
                            : 'bg-[#181b1f] text-neutral-300 hover:bg-[#20252b]'
                        }`}
                      >
                        {hc}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* 5. POSE & LIGHTING */}
          <div className="rounded-lg border border-white/[0.08] bg-[#121417]">
            <button
              type="button"
              onClick={() => toggleSection('pose')}
              className="flex w-full items-center justify-between p-3 text-left font-medium text-neutral-200 hover:text-white transition-colors"
            >
              <div className="flex items-center gap-2">
                <Camera className="h-4 w-4 text-neutral-400" />
                <span className="uppercase text-[11px] tracking-wider font-semibold">
                  Pose & Lighting
                </span>
                {(customization.pose !== 'Original' || customization.lighting !== 'Original') && (
                  <span className="h-1.5 w-1.5 rounded-full bg-[#00e599]" />
                )}
              </div>
              {openSection === 'pose' ? (
                <ChevronUp className="h-4 w-4 text-neutral-400" />
              ) : (
                <ChevronDown className="h-4 w-4 text-neutral-400" />
              )}
            </button>

            {openSection === 'pose' && (
              <div className="border-t border-white/[0.06] p-3 space-y-2.5">
                <div>
                  <span className="text-[10px] uppercase tracking-wider text-neutral-400 block mb-1">
                    Pose:
                  </span>
                  <div className="flex flex-wrap gap-1.5">
                    {POSE_PRESETS.map((p) => (
                      <button
                        key={p}
                        type="button"
                        onClick={() =>
                          onChangeCustomization({
                            ...customization,
                            pose: p,
                          })
                        }
                        className={`rounded px-2.5 py-1 text-[11px] transition-colors ${
                          customization.pose === p
                            ? 'bg-[#00e599] text-black font-semibold'
                            : 'bg-[#181b1f] text-neutral-300 hover:bg-[#20252b]'
                        }`}
                      >
                        {p}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <span className="text-[10px] uppercase tracking-wider text-neutral-400 block mb-1">
                    Lighting:
                  </span>
                  <div className="flex flex-wrap gap-1.5">
                    {LIGHTING_PRESETS.map((l) => (
                      <button
                        key={l}
                        type="button"
                        onClick={() =>
                          onChangeCustomization({
                            ...customization,
                            lighting: l,
                          })
                        }
                        className={`rounded px-2.5 py-1 text-[11px] transition-colors ${
                          customization.lighting === l
                            ? 'bg-[#00e599] text-black font-semibold'
                            : 'bg-[#181b1f] text-neutral-300 hover:bg-[#20252b]'
                        }`}
                      >
                        {l}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Variations Setting (Multiple Looks) */}
        <div className="flex items-center justify-between rounded-lg border border-white/[0.08] bg-[#121417] p-2.5 text-xs">
          <div>
            <span className="font-semibold uppercase tracking-wider text-[11px] text-neutral-300 block">
              Multiple Looks
            </span>
            <span className="text-[10px] text-neutral-400">
              Generate 1 to 4 variations
            </span>
          </div>

          <div className="flex items-center gap-1 rounded bg-[#181b1f] p-0.5 border border-white/10">
            {[1, 2, 3, 4].map((cnt) => (
              <button
                key={cnt}
                type="button"
                onClick={() => onChangeVariationsCount(cnt)}
                className={`h-6 w-6 rounded font-mono text-[11px] font-semibold transition-colors ${
                  variationsCount === cnt
                    ? 'bg-[#00e599] text-black'
                    : 'text-neutral-400 hover:text-white'
                }`}
              >
                {cnt}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Bottom: Primary Action & Validation */}
      <div className="space-y-2 pt-2 border-t border-white/[0.08]">
        {!hasPlayer && (
          <p className="text-[11px] text-neutral-400 text-center">
            Upload or pick a player photo to begin.
          </p>
        )}

        {hasPlayer && !canGenerate && validationNotice && (
          <div className="rounded border border-amber-500/20 bg-amber-500/[0.06] p-2 text-[11px] text-amber-300 leading-normal">
            {validationNotice}
          </div>
        )}

        <button
          type="button"
          disabled={!canGenerate || isGenerating}
          onClick={onGenerate}
          className={`group relative flex w-full items-center justify-center gap-2 rounded-lg py-3 text-xs font-bold uppercase tracking-wider transition-all ${
            canGenerate && !isGenerating
              ? 'bg-[#00e599] text-black hover:bg-[#00ffaa] hover:shadow-[0_0_20px_rgba(0,229,153,0.35)] active:scale-[0.99] cursor-pointer'
              : 'bg-[#181b1f] text-neutral-500 border border-white/[0.06] cursor-not-allowed'
          }`}
        >
          {isGenerating ? (
            <>
              <Sparkles className="h-4 w-4 animate-spin text-[#00e599]" />
              <span className="text-white">Synthesizing Look...</span>
            </>
          ) : (
            <>
              <Sparkles className="h-4 w-4 text-black group-hover:scale-110 transition-transform" />
              <span>
                Generate Look {variationsCount > 1 ? `(${variationsCount} Variations)` : ''}
              </span>
            </>
          )}
        </button>
      </div>
    </div>
  );
};
