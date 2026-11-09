import React, { useState, useRef } from 'react';
import {
  Maximize2,
  ZoomIn,
  ZoomOut,
  Layers,
  Sparkles,
  Download,
  Brush,
  Eye,
  Columns,
  Grid,
  Check,
  Key,
  ExternalLink,
} from 'lucide-react';
import { LookVariation, PlayerAsset } from '../types';

interface CenterPreviewProps {
  playerAsset: PlayerAsset | null;
  generatedImage: string | null;
  transparentImage: string | null;
  shadowImage: string | null;
  variations: LookVariation[];
  activeVariationIndex: number;
  onSelectVariation: (idx: number) => void;
  isGenerating: boolean;
  generatingStage?: string;
  pipelineWarnings?: string[];
  garmentStatusMap?: Record<string, { applied: boolean; note: string }>;
  onOpenExport: () => void;
  onOpenBrushTool?: () => void;
  hasMask?: boolean;
  requiresCredentials?: boolean;
  isQuotaError?: boolean;
  setupErrorMessage?: string | null;
  onRetry?: () => void;
  onDismissError?: () => void;
  onOpenSettings?: () => void;
}

type ViewMode = 'split' | 'generated' | 'original' | 'transparent' | 'sideBySide';
type CheckerboardMode = 'dark' | 'light' | 'solid';

export const CenterPreview: React.FC<CenterPreviewProps> = ({
  playerAsset,
  generatedImage,
  transparentImage,
  shadowImage,
  variations,
  activeVariationIndex,
  onSelectVariation,
  isGenerating,
  generatingStage,
  pipelineWarnings = [],
  garmentStatusMap = {},
  onOpenExport,
  onOpenBrushTool,
  hasMask = false,
  requiresCredentials = false,
  isQuotaError = false,
  setupErrorMessage,
  onRetry,
  onDismissError,
  onOpenSettings,
}) => {
  const [viewMode, setViewMode] = useState<ViewMode>('split');
  const [sliderPos, setSliderPos] = useState<number>(50); // percentage
  const [zoomLevel, setZoomLevel] = useState<number>(1); // 1 = fit, 1.5, 2
  const [checkerboard, setCheckerboard] = useState<CheckerboardMode>('dark');
  const [showShadowWithTransparent, setShowShadowWithTransparent] = useState(false);
  const [diagnosticResult, setDiagnosticResult] = useState<{
    loading: boolean;
    data?: any;
    error?: string;
  } | null>(null);

  const handleRunDiagnostic = async () => {
    setDiagnosticResult({ loading: true });
    try {
      const res = await fetch('/.netlify/functions/hf-diagnostic');
      const data = await res.json();
      setDiagnosticResult({ loading: false, data });
    } catch (err: any) {
      setDiagnosticResult({
        loading: false,
        error: err?.message || 'Failed to connect to Hugging Face diagnostic endpoint.',
      });
    }
  };

  const containerRef = useRef<HTMLDivElement>(null);
  const isDraggingSlider = useRef(false);

  // Handle slider drag
  const handleSliderMove = (clientX: number) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const x = clientX - rect.left;
    const percent = Math.min(Math.max((x / rect.width) * 100, 0), 100);
    setSliderPos(percent);
  };

  const handleMouseDown = () => {
    isDraggingSlider.current = true;
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (isDraggingSlider.current) {
      handleSliderMove(e.clientX);
    }
  };

  const handleMouseUp = () => {
    isDraggingSlider.current = false;
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (e.touches.length > 0) {
      handleSliderMove(e.touches[0].clientX);
    }
  };

  const displayedTransparent = showShadowWithTransparent && shadowImage
    ? shadowImage
    : transparentImage || generatedImage;

  // External Service Configuration Setup State
  if (requiresCredentials && !generatedImage) {
    return (
      <div className="flex h-full min-h-[500px] flex-col items-center justify-center rounded-xl border border-amber-500/30 bg-[#0e1012] p-8 text-center">
        <div className="relative mb-4 flex h-16 w-16 items-center justify-center rounded-2xl border border-amber-500/40 bg-amber-500/10 text-amber-400 shadow-[0_0_25px_rgba(245,158,11,0.15)]">
          <Layers className="h-8 w-8 text-amber-400" />
        </div>
        <h2 className="text-base font-bold text-white uppercase tracking-wider">
          Hugging Face ZeroGPU Space Access
        </h2>
        <p className="mt-2 max-w-md text-xs text-neutral-300 leading-relaxed">
          MXM CREATOR connects to Hugging Face ZeroGPU (<span className="font-mono text-neutral-200">Nymbo/Virtual-Try-On</span>) via Netlify Functions.
        </p>

        <div className="mt-5 w-full max-w-md rounded-lg border border-white/[0.08] bg-[#14171a] p-4 text-left text-xs text-neutral-300 space-y-2.5">
          <p className="font-semibold text-white uppercase text-[11px] tracking-wider">
            Environment Setup (Optional for higher quota):
          </p>
          <div className="flex items-start gap-2.5">
            <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-white/10 font-mono text-[10px] text-white">1</span>
            <div>
              <span className="font-mono text-[#00e599] text-[11px]">HF_TOKEN</span>
              <p className="text-[10px] text-neutral-400">Optional user access token in Netlify site settings (Site configuration &gt; Environment variables).</p>
            </div>
          </div>
          <div className="flex items-start gap-2.5">
            <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-white/10 font-mono text-[10px] text-white">2</span>
            <div>
              <span className="font-mono text-neutral-300 text-[11px]">HF_SPACE_ID</span>
              <p className="text-[10px] text-neutral-400">Default: <span className="font-mono text-neutral-200">Nymbo/Virtual-Try-On</span>.</p>
            </div>
          </div>
          <div className="flex items-start gap-2.5">
            <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-white/10 font-mono text-[10px] text-white">3</span>
            <p className="text-[11px]">Click <strong className="text-[#00e599]">Retry Generation</strong> to try again.</p>
          </div>
        </div>

        {/* Diagnostic Connection Test Result */}
        {diagnosticResult && (
          <div
            className={`mt-4 w-full max-w-md rounded-lg border p-3 text-left text-xs ${
              diagnosticResult.loading
                ? 'border-white/10 bg-[#16181b] text-neutral-300'
                : diagnosticResult.data?.success
                ? 'border-[#00e599]/30 bg-[#00e599]/10 text-[#00e599]'
                : 'border-rose-500/30 bg-rose-500/10 text-rose-300'
            }`}
          >
            {diagnosticResult.loading ? (
              <div className="flex items-center gap-2">
                <Sparkles className="h-4 w-4 animate-spin text-[#00e599]" />
                <span>Checking ZeroGPU Space connection...</span>
              </div>
            ) : (
              <div className="space-y-1">
                <div className="flex items-center justify-between font-mono text-[11px] font-semibold">
                  <span>Status: {diagnosticResult.data?.spaceStatus || (diagnosticResult.error ? 'Error' : '500')}</span>
                  <span>Hardware: {diagnosticResult.data?.hardware || 'zero-a10g'}</span>
                </div>
                <p className="text-[11px] leading-relaxed">
                  {diagnosticResult.data?.sanitizedMessage || diagnosticResult.error}
                </p>
                {diagnosticResult.data?.spaceId && (
                  <p className="font-mono text-[10px] text-neutral-400">
                    Space: {diagnosticResult.data.spaceId}
                  </p>
                )}
              </div>
            )}
          </div>
        )}

        <div className="mt-5 flex items-center gap-3">
          {onOpenSettings && (
            <button
              type="button"
              onClick={onOpenSettings}
              className="flex items-center gap-1.5 rounded-lg border border-white/15 bg-[#181b1f] px-3 py-2 text-xs font-semibold text-white hover:bg-white/10 transition-colors"
            >
              <Sparkles className="h-3 w-3 text-[#00e599]" />
              <span>Space Settings</span>
            </button>
          )}
          {onRetry && (
            <button
              type="button"
              onClick={onRetry}
              disabled={isGenerating}
              className="flex items-center gap-2 rounded-lg bg-[#00e599] px-4 py-2 text-xs font-bold uppercase tracking-wider text-black hover:bg-[#00ffaa] transition-colors"
            >
              <Sparkles className="h-3.5 w-3.5" />
              <span>Retry Generation</span>
            </button>
          )}
          {onDismissError && (
            <button
              type="button"
              onClick={onDismissError}
              className="rounded-lg border border-white/10 bg-[#16181b] px-4 py-2 text-xs font-medium text-neutral-300 hover:text-white transition-colors"
            >
              Back to Staged Assets
            </button>
          )}
        </div>
      </div>
    );
  }

  // ZeroGPU Quota Exhaustion Notice State
  if (isQuotaError && !generatedImage) {
    const handleSwitchSpaceAndRetry = (newSpace: string) => {
      localStorage.setItem('mxm_hf_space_id', newSpace);
      onRetry?.();
    };

    return (
      <div className="flex h-full min-h-[500px] flex-col items-center justify-center rounded-xl border border-amber-500/30 bg-[#0e1012] p-6 text-center">
        <div className="relative mb-3 flex h-14 w-14 items-center justify-center rounded-2xl border border-amber-500/40 bg-amber-500/10 text-amber-400 shadow-[0_0_25px_rgba(245,158,11,0.15)]">
          <Layers className="h-7 w-7 text-amber-400" />
        </div>
        <h2 className="text-base font-bold text-white uppercase tracking-wider">
          Hugging Face ZeroGPU Limit Reached
        </h2>
        <p className="mt-2 max-w-lg text-xs text-neutral-300 leading-relaxed">
          {setupErrorMessage || 'The ZeroGPU public quota has temporarily been reached. ZeroGPU quotas automatically replenish after a short cooling period.'}
        </p>

        {/* Server Environment Variable Configuration Guidance */}
        <div className="mt-4 w-full max-w-md rounded-xl border border-white/10 bg-[#16181b] p-4 text-left shadow-lg space-y-2.5">
          <div className="flex items-center justify-between border-b border-white/[0.06] pb-2">
            <span className="text-xs font-semibold text-white flex items-center gap-1.5">
              <Key className="h-3.5 w-3.5 text-[#00e599]" />
              <span>Use Personal ZeroGPU Account Quota</span>
            </span>
            <a
              href="https://huggingface.co/settings/tokens"
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 text-[11px] text-[#00e599] hover:underline"
            >
              <span>Get Free HF Token</span>
              <ExternalLink className="h-2.5 w-2.5" />
            </a>
          </div>

          <div className="space-y-1.5 text-xs text-neutral-300">
            <p className="text-[11px] text-neutral-400 leading-relaxed">
              To bypass communal IP rate limits, set your personal Hugging Face token securely as a Netlify server environment variable:
            </p>
            <ol className="list-decimal pl-4 space-y-1 text-[11px] text-neutral-300">
              <li>Create a token on Hugging Face with <strong className="text-white">"Read"</strong> role (no write permissions needed).</li>
              <li>In Netlify, open <strong className="text-white">Site configuration &gt; Environment variables</strong>.</li>
              <li>Add variable: Key = <code className="text-[#00e599] font-mono">HF_TOKEN</code>, Value = your token.</li>
              <li>Click <em>Retry Try-On</em> once deployed.</li>
            </ol>
            <p className="text-[10px] text-neutral-400 pt-1 border-t border-white/[0.04]">
              Note: Personal tokens provide individual account ZeroGPU quota (~90s per window). ZeroGPU compute limits still apply once your account quota is exhausted.
            </p>
          </div>
        </div>

        {/* Quick Space Alternatives & Actions */}
        <div className="mt-5 flex flex-wrap items-center justify-center gap-2">
          {onRetry && (
            <button
              type="button"
              onClick={onRetry}
              disabled={isGenerating}
              className="flex items-center gap-2 rounded-lg bg-[#00e599] px-4 py-2 text-xs font-bold uppercase tracking-wider text-black hover:bg-[#00ffaa] transition-colors shadow-sm"
            >
              <Sparkles className="h-3.5 w-3.5" />
              <span>Retry Try-On</span>
            </button>
          )}
          <button
            type="button"
            onClick={() => handleSwitchSpaceAndRetry('yisol/IDM-VTON')}
            disabled={isGenerating}
            className="flex items-center gap-1.5 rounded-lg border border-white/15 bg-[#1c2026] px-3 py-2 text-xs font-medium text-neutral-200 hover:bg-[#252b33] hover:text-white transition-colors"
          >
            <span>Try Alternate Space (yisol/IDM-VTON)</span>
          </button>
          {onOpenSettings && (
            <button
              type="button"
              onClick={onOpenSettings}
              className="flex items-center gap-1.5 rounded-lg border border-white/15 bg-[#181b1f] px-3 py-2 text-xs font-medium text-neutral-200 hover:bg-white/10 transition-colors"
            >
              <span>API Settings</span>
            </button>
          )}
          {onDismissError && (
            <button
              type="button"
              onClick={onDismissError}
              className="rounded-lg border border-white/10 bg-[#16181b] px-3 py-2 text-xs font-medium text-neutral-400 hover:text-white transition-colors"
            >
              Back to Staged Assets
            </button>
          )}
        </div>
      </div>
    );
  }

  // Empty state when no player is uploaded
  if (!playerAsset && !generatedImage) {
    return (
      <div className="flex h-full min-h-[500px] flex-col items-center justify-center rounded-xl border border-white/[0.06] bg-[#0e1012] p-8 text-center">
        <div className="relative mb-4 flex h-16 w-16 items-center justify-center rounded-full border border-white/10 bg-[#14171a]">
          <Layers className="h-7 w-7 text-neutral-500" />
          <span className="absolute -bottom-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-[#00e599] text-black">
            <Sparkles className="h-3 w-3" />
          </span>
        </div>
        <h2 className="text-base font-bold text-white uppercase tracking-wider">
          Visual Production Canvas
        </h2>
        <p className="mt-1.5 max-w-sm text-xs text-neutral-400 leading-relaxed">
          Upload a person's photo on the left to activate the styling workspace.
          AI adapts imperfect garments and reconstructs natural fabric drapes.
        </p>
      </div>
    );
  }

  return (
    <div
      className="relative flex h-full flex-col overflow-hidden rounded-xl border border-white/[0.08] bg-[#0c0e10]"
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
    >
      {/* Top Workspace Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/[0.06] bg-[#121417] px-4 py-2">
        {/* Left: View Mode Segmented Controls */}
        <div className="flex items-center gap-1 rounded bg-[#181b1f] p-0.5 border border-white/[0.06]">
          {generatedImage && playerAsset && (
            <button
              type="button"
              onClick={() => setViewMode('split')}
              className={`flex items-center gap-1.5 rounded px-2.5 py-1 text-[11px] font-medium transition-colors ${
                viewMode === 'split'
                  ? 'bg-white/10 text-white'
                  : 'text-neutral-400 hover:text-neutral-200'
              }`}
            >
              <Columns className="h-3 w-3" />
              <span>Split Slider</span>
            </button>
          )}

          {generatedImage && (
            <button
              type="button"
              onClick={() => setViewMode('generated')}
              className={`flex items-center gap-1.5 rounded px-2.5 py-1 text-[11px] font-medium transition-colors ${
                viewMode === 'generated'
                  ? 'bg-white/10 text-white'
                  : 'text-neutral-400 hover:text-neutral-200'
              }`}
            >
              <Eye className="h-3 w-3" />
              <span>Look</span>
            </button>
          )}

          {playerAsset && (
            <button
              type="button"
              onClick={() => setViewMode('original')}
              className={`flex items-center gap-1.5 rounded px-2.5 py-1 text-[11px] font-medium transition-colors ${
                viewMode === 'original'
                  ? 'bg-white/10 text-white'
                  : 'text-neutral-400 hover:text-neutral-200'
              }`}
            >
              <span>Original</span>
            </button>
          )}

          {generatedImage && (
            <button
              type="button"
              onClick={() => setViewMode('transparent')}
              className={`flex items-center gap-1.5 rounded px-2.5 py-1 text-[11px] font-medium transition-colors ${
                viewMode === 'transparent'
                  ? 'bg-[#00e599]/20 text-[#00e599]'
                  : 'text-neutral-400 hover:text-neutral-200'
              }`}
            >
              <Grid className="h-3 w-3" />
              <span>Alpha PNG</span>
            </button>
          )}
        </div>

        {/* Right: Workspace Utilities (Zoom, Checkerboard, Mask, Export) */}
        <div className="flex items-center gap-2">
          {/* Transparent shadow toggle */}
          {viewMode === 'transparent' && shadowImage && (
            <button
              type="button"
              onClick={() => setShowShadowWithTransparent(!showShadowWithTransparent)}
              className={`rounded px-2 py-1 text-[10px] font-medium border transition-colors ${
                showShadowWithTransparent
                  ? 'bg-[#00e599]/15 border-[#00e599]/40 text-[#00e599]'
                  : 'bg-[#181b1f] border-white/10 text-neutral-400 hover:text-neutral-200'
              }`}
            >
              + Studio Shadow
            </button>
          )}

          {/* Checkerboard style toggle */}
          {viewMode === 'transparent' && (
            <div className="flex items-center rounded bg-[#181b1f] p-0.5 border border-white/[0.06]">
              <button
                type="button"
                onClick={() => setCheckerboard('dark')}
                title="Dark Checkerboard"
                className={`rounded px-1.5 py-0.5 text-[10px] font-mono ${
                  checkerboard === 'dark' ? 'bg-white/15 text-white' : 'text-neutral-500'
                }`}
              >
                Dark
              </button>
              <button
                type="button"
                onClick={() => setCheckerboard('light')}
                title="Light Checkerboard"
                className={`rounded px-1.5 py-0.5 text-[10px] font-mono ${
                  checkerboard === 'light' ? 'bg-white/15 text-white' : 'text-neutral-500'
                }`}
              >
                Light
              </button>
            </div>
          )}

          {/* Zoom controls */}
          <div className="flex items-center gap-1 text-neutral-400">
            <button
              type="button"
              onClick={() => setZoomLevel((z) => Math.max(z - 0.25, 0.75))}
              className="rounded p-1 hover:bg-white/[0.06] hover:text-white transition-colors"
              title="Zoom out"
            >
              <ZoomOut className="h-3.5 w-3.5" />
            </button>
            <span className="font-mono text-[10px] tabular-nums text-neutral-300 w-8 text-center">
              {Math.round(zoomLevel * 100)}%
            </span>
            <button
              type="button"
              onClick={() => setZoomLevel((z) => Math.min(z + 0.25, 2.5))}
              className="rounded p-1 hover:bg-white/[0.06] hover:text-white transition-colors"
              title="Zoom in"
            >
              <ZoomIn className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              onClick={() => setZoomLevel(1)}
              className="rounded p-1 hover:bg-white/[0.06] hover:text-white transition-colors"
              title="Reset zoom to fit"
            >
              <Maximize2 className="h-3.5 w-3.5" />
            </button>
          </div>

          {/* Selective edit brush button */}
          {onOpenBrushTool && generatedImage && (
            <button
              type="button"
              onClick={onOpenBrushTool}
              className={`flex items-center gap-1.5 rounded px-2.5 py-1 text-[11px] font-medium border transition-colors ${
                hasMask
                  ? 'bg-[#00e599]/20 border-[#00e599]/40 text-[#00e599]'
                  : 'bg-[#181b1f] border-white/10 text-neutral-300 hover:text-white'
              }`}
            >
              <Brush className="h-3 w-3" />
              <span>{hasMask ? 'Mask Active' : 'Brush Mask'}</span>
            </button>
          )}

          {/* Quick Export button */}
          {generatedImage && (
            <button
              type="button"
              onClick={onOpenExport}
              className="flex items-center gap-1.5 rounded bg-[#00e599] px-3 py-1 text-[11px] font-semibold text-black hover:bg-[#00ffaa] transition-colors"
            >
              <Download className="h-3 w-3 stroke-[2.5]" />
              <span>Export</span>
            </button>
          )}
        </div>
      </div>

      {/* Main Visual Display Area */}
      <div
        ref={containerRef}
        className={`relative flex flex-1 select-none items-center justify-center overflow-hidden p-4 sm:p-6 ${
          viewMode === 'transparent'
            ? checkerboard === 'light'
              ? 'bg-checkerboard-light'
              : 'bg-checkerboard'
            : 'bg-[#0b0d0e]'
        }`}
      >
        {/* Loading Overlay with multi-stage progress */}
        {isGenerating && (
          <div className="absolute inset-0 z-30 flex flex-col items-center justify-center bg-black/80 backdrop-blur-xs px-6 text-center">
            <div className="relative mb-4 flex h-14 w-14 items-center justify-center rounded-full border border-white/20 bg-[#16181a]">
              <Sparkles className="h-6 w-6 animate-spin text-[#00e599]" />
            </div>
            <p className="text-sm font-bold uppercase tracking-wider text-white">
              {generatingStage || 'Processing Neural Virtual Try-On...'}
            </p>
            <p className="mt-1.5 font-mono text-xs text-[#00e599]">
              Preserving original body proportions · Locking height-to-width ratio & facial identity
            </p>
            <div className="mt-4 flex items-center gap-2 text-[11px] text-neutral-400">
              <span className="inline-block h-1.5 w-1.5 rounded-full bg-[#00e599] animate-pulse" />
              <span>ZeroGPU Neural Pipeline</span>
            </div>
          </div>
        )}

        {/* View Mode 1: Split Slider */}
        {viewMode === 'split' && generatedImage && playerAsset ? (
          <div
            className="relative mx-auto flex items-center justify-center transition-transform duration-150"
            style={{ transform: `scale(${zoomLevel})` }}
          >
            <div className="relative max-h-[72vh] max-w-full overflow-hidden rounded-lg border border-white/10 shadow-2xl flex items-center justify-center bg-black">
              {/* After: Generated Look */}
              <img
                src={generatedImage}
                alt="Generated styling look"
                className="block max-h-[72vh] w-auto max-w-full object-contain pointer-events-none"
              />

              {/* Before: Original Player (Clipped by slider percentage - object-contain preserves 100% natural proportions) */}
              <div
                className="absolute inset-0 overflow-hidden flex items-center justify-center"
                style={{ clipPath: `inset(0 ${100 - sliderPos}% 0 0)` }}
              >
                <img
                  src={playerAsset.dataUrl}
                  alt="Original player reference"
                  className="block max-h-[72vh] w-auto max-w-full object-contain pointer-events-none"
                />
                <span className="absolute left-3 top-3 rounded bg-black/70 px-2 py-0.5 text-[10px] font-mono uppercase tracking-wider text-neutral-200 backdrop-blur-xs border border-white/10">
                  Original
                </span>
              </div>

              <span className="absolute right-3 top-3 rounded bg-black/70 px-2 py-0.5 text-[10px] font-mono uppercase tracking-wider text-[#00e599] backdrop-blur-xs border border-[#00e599]/30">
                Transformed
              </span>

              {/* Slider Handle Line */}
              <div
                className="absolute top-0 bottom-0 z-20 w-0.5 bg-white cursor-ew-resize shadow-[0_0_10px_rgba(0,0,0,0.8)]"
                style={{ left: `${sliderPos}%` }}
                onMouseDown={handleMouseDown}
                onTouchMove={handleTouchMove}
              >
                <div className="absolute top-1/2 -left-3.5 -translate-y-1/2 flex h-7 w-7 items-center justify-center rounded-full border border-white/40 bg-black text-white shadow-lg">
                  <div className="flex gap-0.5">
                    <div className="h-3 w-0.5 bg-white/80" />
                    <div className="h-3 w-0.5 bg-white/80" />
                  </div>
                </div>
              </div>
            </div>
          </div>
        ) : viewMode === 'transparent' && displayedTransparent ? (
          /* View Mode 2: Transparent PNG on Checkerboard */
          <div
            className="relative mx-auto flex items-center justify-center transition-transform duration-150"
            style={{ transform: `scale(${zoomLevel})` }}
          >
            <div className="relative max-h-[72vh] max-w-full overflow-hidden rounded-lg">
              <img
                src={displayedTransparent}
                alt="Transparent PNG character cutout"
                className="block max-h-[72vh] w-auto max-w-full object-contain"
              />
              <span className="absolute bottom-3 left-3 rounded bg-black/70 px-2 py-1 text-[10px] font-mono text-[#00e599] border border-white/10 backdrop-blur-xs">
                32-Bit Alpha PNG · Genuine Transparency
              </span>
            </div>
          </div>
        ) : viewMode === 'original' && playerAsset ? (
          /* View Mode 3: Original Player Only */
          <div
            className="relative mx-auto flex items-center justify-center transition-transform duration-150"
            style={{ transform: `scale(${zoomLevel})` }}
          >
            <div className="relative max-h-[72vh] max-w-full overflow-hidden rounded-lg border border-white/10 shadow-2xl">
              <img
                src={playerAsset.dataUrl}
                alt="Original player"
                className="block max-h-[72vh] w-auto max-w-full object-contain"
              />
              <span className="absolute bottom-3 left-3 rounded bg-black/70 px-2 py-1 text-[10px] font-mono text-neutral-300 border border-white/10 backdrop-blur-xs">
                Identity Reference
              </span>
            </div>
          </div>
        ) : (
          /* View Mode 4: Generated Look */
          <div
            className="relative mx-auto flex items-center justify-center transition-transform duration-150"
            style={{ transform: `scale(${zoomLevel})` }}
          >
            <div className="relative max-h-[72vh] max-w-full overflow-hidden rounded-lg border border-white/10 shadow-2xl">
              <img
                src={generatedImage || playerAsset?.dataUrl}
                alt="Virtual look"
                className="block max-h-[72vh] w-auto max-w-full object-contain"
              />
            </div>
          </div>
        )}
      </div>

      {/* Quality Control & Garment Replacement Status Strip */}
      {generatedImage && (Object.keys(garmentStatusMap).length > 0 || pipelineWarnings.length > 0) && (
        <div className="border-t border-white/[0.06] bg-[#121417] px-4 py-2 text-xs">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-[10px] uppercase font-semibold text-neutral-400 tracking-wider mr-1">
                Outfit Status:
              </span>
              {Object.entries(garmentStatusMap).map(([slot, stat]) => (
                <span
                  key={slot}
                  className={`inline-flex items-center gap-1 rounded-sm px-2 py-0.5 font-mono text-[10px] border ${
                    stat.applied
                      ? 'border-[#00e599]/40 bg-[#00e599]/10 text-[#00e599]'
                      : 'border-amber-500/30 bg-amber-500/10 text-amber-300'
                  }`}
                  title={stat.note}
                >
                  <span className="uppercase font-bold">{slot}</span>
                  <span>{stat.applied ? '✓ Applied' : 'Preserved'}</span>
                </span>
              ))}
            </div>

            {pipelineWarnings.length > 0 && (
              <div className="flex items-center gap-1 text-[11px] text-amber-400 font-medium">
                <span className="text-[10px]">ℹ</span>
                <span className="line-clamp-1">{pipelineWarnings[0]}</span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Bottom Variations Strip (Multiple Looks) */}
      {variations.length > 1 && (
        <div className="border-t border-white/[0.08] bg-[#121417] px-4 py-2.5">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-neutral-400">
              Generated Looks ({variations.length})
            </span>
            <span className="text-[10px] text-neutral-400">
              Click to select variation for export or adjustment
            </span>
          </div>

          <div className="mt-2 flex items-center gap-3 overflow-x-auto pb-1 no-scrollbar">
            {variations.map((v, idx) => (
              <button
                key={v.id || idx}
                type="button"
                onClick={() => onSelectVariation(idx)}
                className={`group relative flex items-center gap-2.5 rounded-lg border p-1.5 transition-all ${
                  activeVariationIndex === idx
                    ? 'border-[#00e599] bg-[#00e599]/10'
                    : 'border-white/10 bg-[#16181b] hover:border-white/20'
                }`}
              >
                <div className="h-12 w-10 shrink-0 overflow-hidden rounded border border-white/10 bg-black">
                  <img
                    src={v.imageUrl}
                    alt={v.label}
                    className="h-full w-full object-cover object-top"
                  />
                </div>
                <div className="text-left pr-2">
                  <div className="flex items-center gap-1.5">
                    <span className="font-mono text-xs font-semibold text-white">
                      0{idx + 1}
                    </span>
                    {activeVariationIndex === idx && (
                      <Check className="h-3 w-3 text-[#00e599]" />
                    )}
                  </div>
                  <span className="text-[10px] text-neutral-400 block line-clamp-1">
                    {v.label}
                  </span>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
