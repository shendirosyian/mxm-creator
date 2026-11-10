import React, { useState, useEffect } from 'react';
import { X, Download, Sparkles, Check, Grid, RefreshCw, Archive } from 'lucide-react';
import JSZip from 'jszip';
import { formatExportImage, upscaleImage } from '../utils/imageProcessing';
import { LookVariation } from '../types';

interface ExportStudioModalProps {
  isOpen: boolean;
  onClose: () => void;
  sourceImage: string; // generated image
  transparentImage?: string; // segmented transparent png
  shadowImage?: string; // transparent png with contact shadow
  projectName?: string;
  batchVariations?: LookVariation[];
}

type ExportFormat = 'transparent_png' | 'transparent_shadow_png' | 'jpg_solid';
type AspectRatio = 'original' | '1:1' | '4:5' | '3:4' | '9:16';
type ResolutionTier = 1024 | 2048 | 3072 | 4096;

export const ExportStudioModal: React.FC<ExportStudioModalProps> = ({
  isOpen,
  onClose,
  sourceImage,
  transparentImage,
  shadowImage,
  projectName = 'mxm_look',
  batchVariations = [],
}) => {
  const [format, setFormat] = useState<ExportFormat>('transparent_png');
  const [aspectRatio, setAspectRatio] = useState<AspectRatio>('original');
  const [resolutionTier, setResolutionTier] = useState<ResolutionTier>(2048);
  const [solidBgColor, setSolidBgColor] = useState<string>('#121417');

  const [isProcessing, setIsProcessing] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string>('');
  const [dimensions, setDimensions] = useState<{ width: number; height: number }>({ width: 0, height: 0 });
  const [fileSize, setFileSize] = useState<string>('');

  // Batch ZIP packaging state
  const [isBatchZipping, setIsBatchZipping] = useState(false);
  const [batchZipProgress, setBatchZipProgress] = useState<string>('');

  useEffect(() => {
    if (!isOpen) return;

    let isMounted = true;
    setIsProcessing(true);

    const updateExportPreview = async () => {
      try {
        // Base image choice based on format
        let baseImg = sourceImage;
        if (format === 'transparent_png') {
          baseImg = transparentImage || sourceImage;
        } else if (format === 'transparent_shadow_png') {
          baseImg = shadowImage || transparentImage || sourceImage;
        }

        const result = await formatExportImage(baseImg, {
          format,
          aspectRatio,
          resolutionEdge: resolutionTier,
          solidBgColor,
        });

        if (isMounted) {
          setPreviewUrl(result.dataUrl);
          setDimensions({ width: result.width, height: result.height });
          setFileSize(result.fileSizeFormatted);
          setIsProcessing(false);
        }
      } catch (err) {
        console.error('Export formatting failed:', err);
        if (isMounted) setIsProcessing(false);
      }
    };

    updateExportPreview();

    return () => {
      isMounted = false;
    };
  }, [isOpen, format, aspectRatio, resolutionTier, solidBgColor, sourceImage, transparentImage, shadowImage]);

  if (!isOpen) return null;

  const handleDownloadSingle = () => {
    if (!previewUrl) return;
    const link = document.createElement('a');
    const ext = format === 'jpg_solid' ? 'jpg' : 'png';
    link.download = `${projectName}_${resolutionTier}px_${format}.${ext}`;
    link.href = previewUrl;
    link.click();
  };

  const handleDownloadBatchZip = async () => {
    if (!batchVariations || batchVariations.length === 0) return;

    setIsBatchZipping(true);
    setBatchZipProgress(`Initializing ZIP package for ${batchVariations.length} looks...`);

    try {
      const zip = new JSZip();
      const folder = zip.folder(`mxm_batch_looks_${resolutionTier}px`) || zip;
      const ext = format === 'jpg_solid' ? 'jpg' : 'png';

      for (let i = 0; i < batchVariations.length; i++) {
        const variation = batchVariations[i];
        setBatchZipProgress(`Exporting high-res look ${i + 1} of ${batchVariations.length}...`);

        let baseImg = variation.imageUrl;
        if (format === 'transparent_png' && variation.transparentUrl) {
          baseImg = variation.transparentUrl;
        } else if (format === 'transparent_shadow_png' && (variation.shadowTransparentUrl || variation.transparentUrl)) {
          baseImg = variation.shadowTransparentUrl || variation.transparentUrl || variation.imageUrl;
        }

        const formatted = await formatExportImage(baseImg, {
          format,
          aspectRatio,
          resolutionEdge: resolutionTier,
          solidBgColor,
        });

        // Strip data:image/...;base64, prefix
        const base64Data = formatted.dataUrl.split(',')[1];
        const cleanName = (variation.label || `look_${i + 1}`)
          .toLowerCase()
          .replace(/[^a-z0-9_-]/g, '_')
          .replace(/_+/g, '_');

        const fileName = `look_${String(i + 1).padStart(2, '0')}_${cleanName}_${resolutionTier}px.${ext}`;
        folder.file(fileName, base64Data, { base64: true });
      }

      setBatchZipProgress('Compressing master ZIP archive...');
      const blob = await zip.generateAsync({
        type: 'blob',
        compression: 'DEFLATE',
        compressionOptions: { level: 6 },
      });

      const downloadUrl = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = downloadUrl;
      link.download = `mxm_batch_looks_${batchVariations.length}_people_${resolutionTier}px.zip`;
      link.click();

      setTimeout(() => URL.revokeObjectURL(downloadUrl), 5000);
      setBatchZipProgress('Complete!');
      setTimeout(() => {
        setIsBatchZipping(false);
        setBatchZipProgress('');
      }, 1500);
    } catch (err) {
      console.error('Batch ZIP export failed:', err);
      setIsBatchZipping(false);
      setBatchZipProgress('');
      alert('Failed to package batch looks into ZIP archive.');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm">
      <div className="relative flex max-h-[90vh] w-full max-w-4xl flex-col overflow-hidden rounded-xl border border-white/10 bg-[#121417] shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-white/[0.08] px-6 py-4">
          <div>
            <h2 className="text-sm font-bold uppercase tracking-wider text-white">
              Export Studio
            </h2>
            <p className="text-[11px] text-neutral-400">
              High-resolution asset export with genuine alpha transparency & multi-person batch archive
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded p-1 text-neutral-400 hover:bg-white/[0.06] hover:text-white transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="grid flex-1 grid-cols-1 overflow-y-auto md:grid-cols-2">
          {/* Left: Interactive Preview */}
          <div
            className={`flex flex-col items-center justify-center p-6 border-b md:border-b-0 md:border-r border-white/[0.08] ${
              format.includes('transparent') ? 'bg-checkerboard' : 'bg-[#0b0d0e]'
            }`}
          >
            <div className="relative flex max-h-[46vh] w-full items-center justify-center">
              {isProcessing ? (
                <div className="flex flex-col items-center justify-center gap-2 py-16 text-neutral-400">
                  <RefreshCw className="h-6 w-6 animate-spin text-[#00e599]" />
                  <span className="font-mono text-xs">Upscaling & Processing...</span>
                </div>
              ) : previewUrl ? (
                <img
                  src={previewUrl}
                  alt="Export preview"
                  className="max-h-[46vh] max-w-full rounded object-contain shadow-2xl"
                />
              ) : null}
            </div>

            {/* Live Technical Metadata */}
            <div className="mt-4 flex w-full flex-wrap items-center justify-around gap-2 rounded border border-white/[0.08] bg-[#16181b] p-2 text-center font-mono text-[11px] text-neutral-300">
              <div>
                <span className="text-[10px] text-neutral-500 uppercase block">Format</span>
                <span className="text-white font-semibold">
                  {format === 'jpg_solid' ? 'JPG Studio' : '32-Bit Alpha PNG'}
                </span>
              </div>
              <div>
                <span className="text-[10px] text-neutral-500 uppercase block">Dimensions</span>
                <span className="text-[#00e599] font-semibold">
                  {dimensions.width} × {dimensions.height}
                </span>
              </div>
              <div>
                <span className="text-[10px] text-neutral-500 uppercase block">Single Size</span>
                <span className="text-white font-semibold">{fileSize || '~2.4 MB'}</span>
              </div>
              <div>
                <span className="text-[10px] text-neutral-500 uppercase block">Alpha Channel</span>
                <span className={format.includes('transparent') ? 'text-[#00e599]' : 'text-neutral-500'}>
                  {format.includes('transparent') ? 'Genuine 0-Alpha' : 'Flattened'}
                </span>
              </div>
            </div>
          </div>

          {/* Right: Export Controls */}
          <div className="space-y-4 p-6 text-xs text-neutral-300">
            {/* Format Selector */}
            <div className="space-y-2">
              <label className="text-[11px] font-semibold uppercase tracking-wider text-neutral-400 block">
                Export Target
              </label>
              <div className="space-y-1.5">
                {[
                  {
                    id: 'transparent_png' as ExportFormat,
                    title: 'Transparent PNG (Default)',
                    desc: 'Clean cutout ready for Photoshop, Illustrator & After Effects.',
                  },
                  {
                    id: 'transparent_shadow_png' as ExportFormat,
                    title: 'Transparent PNG + Studio Shadow',
                    desc: 'Realistic floor contact shadow on the transparent canvas.',
                  },
                  {
                    id: 'jpg_solid' as ExportFormat,
                    title: 'JPG with Studio Backdrop',
                    desc: 'Solid background for digital lookbooks and web galleries.',
                  },
                ].map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setFormat(item.id)}
                    className={`flex w-full items-start gap-3 rounded-lg border p-2 text-left transition-all ${
                      format === item.id
                        ? 'border-[#00e599] bg-[#00e599]/10'
                        : 'border-white/10 bg-[#16181b] hover:border-white/20'
                    }`}
                  >
                    <div
                      className={`mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full border ${
                        format === item.id ? 'border-[#00e599] bg-[#00e599]' : 'border-neutral-500'
                      }`}
                    >
                      {format === item.id && <Check className="h-2.5 w-2.5 text-black stroke-[3]" />}
                    </div>
                    <div>
                      <p className="font-medium text-white">{item.title}</p>
                      <p className="text-[11px] text-neutral-400 leading-tight">{item.desc}</p>
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {/* Solid background color picker (if JPG selected) */}
            {format === 'jpg_solid' && (
              <div className="space-y-1.5 pt-1">
                <span className="text-[10px] text-neutral-400 uppercase tracking-wider block">
                  Backdrop Tone:
                </span>
                <div className="flex items-center gap-2">
                  {[
                    { label: 'Pure Black', hex: '#000000' },
                    { label: 'Studio Dark', hex: '#121417' },
                    { label: 'Neutral Grey', hex: '#2A2D32' },
                    { label: 'Studio White', hex: '#F8F9FA' },
                  ].map((bg) => (
                    <button
                      key={bg.hex}
                      type="button"
                      onClick={() => setSolidBgColor(bg.hex)}
                      className={`flex items-center gap-1.5 rounded px-2.5 py-1 text-[11px] border transition-colors ${
                        solidBgColor === bg.hex ? 'border-[#00e599] text-white' : 'border-white/10 text-neutral-400'
                      }`}
                    >
                      <span className="h-3 w-3 rounded-full border border-white/20" style={{ backgroundColor: bg.hex }} />
                      <span>{bg.label}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Resolution Tier (1K, 2K, 3K, 4K) */}
            <div className="space-y-1.5">
              <label className="text-[11px] font-semibold uppercase tracking-wider text-neutral-400 block">
                Resolution Quality
              </label>
              <div className="grid grid-cols-4 gap-1.5">
                {[
                  { tier: 1024 as ResolutionTier, label: '1K', res: '1024 px' },
                  { tier: 2048 as ResolutionTier, label: '2K Pro', res: '2048 px' },
                  { tier: 3072 as ResolutionTier, label: '3K Master', res: '3072 px' },
                  { tier: 4096 as ResolutionTier, label: '4K Ultra', res: '4096 px' },
                ].map((r) => (
                  <button
                    key={r.tier}
                    type="button"
                    onClick={() => setResolutionTier(r.tier)}
                    className={`rounded-lg border p-1.5 text-center transition-all ${
                      resolutionTier === r.tier
                        ? 'border-[#00e599] bg-[#00e599]/15 text-white'
                        : 'border-white/10 bg-[#16181b] text-neutral-400 hover:text-white'
                    }`}
                  >
                    <span className="font-semibold block text-white text-[11px]">{r.label}</span>
                    <span className="font-mono text-[9px] text-neutral-500">{r.res}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Aspect Ratio */}
            <div className="space-y-1.5">
              <label className="text-[11px] font-semibold uppercase tracking-wider text-neutral-400 block">
                Canvas Aspect Ratio
              </label>
              <div className="flex flex-wrap gap-1.5">
                {[
                  { id: 'original' as AspectRatio, label: 'Original' },
                  { id: '1:1' as AspectRatio, label: '1:1 Square' },
                  { id: '4:5' as AspectRatio, label: '4:5 Portrait' },
                  { id: '3:4' as AspectRatio, label: '3:4 Editorial' },
                  { id: '9:16' as AspectRatio, label: '9:16 Vertical' },
                ].map((ar) => (
                  <button
                    key={ar.id}
                    type="button"
                    onClick={() => setAspectRatio(ar.id)}
                    className={`rounded px-2.5 py-1 text-[11px] font-medium border transition-colors ${
                      aspectRatio === ar.id
                        ? 'border-[#00e599] bg-[#00e599]/20 text-[#00e599]'
                        : 'border-white/10 bg-[#16181b] text-neutral-400 hover:text-white'
                    }`}
                  >
                    {ar.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Download Actions */}
            <div className="space-y-2 pt-2">
              {/* Single Image Download */}
              <button
                type="button"
                disabled={isProcessing || !previewUrl || isBatchZipping}
                onClick={handleDownloadSingle}
                className="flex w-full items-center justify-center gap-2 rounded-lg bg-[#00e599] py-2.5 text-xs font-bold uppercase tracking-wider text-black transition-all hover:bg-[#00ffaa] hover:shadow-[0_0_20px_rgba(0,229,153,0.35)] active:scale-[0.99] disabled:opacity-50"
              >
                <Download className="h-4 w-4 stroke-[2.5]" />
                <span>
                  Download Active Look ({resolutionTier}px)
                </span>
              </button>

              {/* Batch ZIP Download CTA */}
              {batchVariations && batchVariations.length > 0 && (
                <button
                  type="button"
                  disabled={isBatchZipping || isProcessing}
                  onClick={handleDownloadBatchZip}
                  className="flex w-full items-center justify-center gap-2 rounded-lg border border-[#00e599]/40 bg-[#161e1b] py-2.5 text-xs font-bold uppercase tracking-wider text-[#00e599] transition-all hover:bg-[#00e599]/15 hover:border-[#00e599] active:scale-[0.99] disabled:opacity-50"
                >
                  {isBatchZipping ? (
                    <>
                      <RefreshCw className="h-4 w-4 animate-spin text-[#00e599]" />
                      <span className="font-mono text-[11px] normal-case">{batchZipProgress}</span>
                    </>
                  ) : (
                    <>
                      <Archive className="h-4 w-4 stroke-[2]" />
                      <span>Download All Batch Looks as ZIP ({batchVariations.length} People)</span>
                    </>
                  )}
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
