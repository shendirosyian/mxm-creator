import React, { useRef, useState, useEffect } from 'react';
import { X, Brush, Eraser, RotateCcw, Check, Sparkles } from 'lucide-react';

interface SelectiveBrushModalProps {
  isOpen: boolean;
  onClose: () => void;
  baseImage: string;
  initialMask?: string;
  onSaveMask: (maskDataUrl: string | undefined) => void;
}

export const SelectiveBrushModal: React.FC<SelectiveBrushModalProps> = ({
  isOpen,
  onClose,
  baseImage,
  initialMask,
  onSaveMask,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [tool, setTool] = useState<'brush' | 'eraser'>('brush');
  const [brushSize, setBrushSize] = useState<number>(30);
  const [isDrawing, setIsDrawing] = useState(false);
  const historyRef = useRef<ImageData[]>([]);

  useEffect(() => {
    if (!isOpen) return;

    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) return;

    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      canvas.width = img.naturalWidth || 800;
      canvas.height = img.naturalHeight || 1000;
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      if (initialMask) {
        const maskImg = new Image();
        maskImg.onload = () => {
          ctx.drawImage(maskImg, 0, 0, canvas.width, canvas.height);
          saveState();
        };
        maskImg.src = initialMask;
      } else {
        saveState();
      }
    };
    img.src = baseImage;
  }, [isOpen, baseImage]);

  const saveState = () => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d', { willReadFrequently: true });
    if (canvas && ctx) {
      if (historyRef.current.length > 10) historyRef.current.shift();
      historyRef.current.push(ctx.getImageData(0, 0, canvas.width, canvas.height));
    }
  };

  const handleUndo = () => {
    if (historyRef.current.length > 1) {
      historyRef.current.pop(); // remove current
      const prevState = historyRef.current[historyRef.current.length - 1];
      const canvas = canvasRef.current;
      const ctx = canvas?.getContext('2d');
      if (canvas && ctx && prevState) {
        ctx.putImageData(prevState, 0, 0);
      }
    }
  };

  const handleClear = () => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (canvas && ctx) {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      saveState();
    }
  };

  const getCanvasCoords = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    return {
      x: (e.clientX - rect.left) * scaleX,
      y: (e.clientY - rect.top) * scaleY,
    };
  };

  const startDraw = (e: React.MouseEvent<HTMLCanvasElement>) => {
    setIsDrawing(true);
    draw(e);
  };

  const draw = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDrawing) return;
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;

    const { x, y } = getCanvasCoords(e);
    ctx.lineWidth = brushSize;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    if (tool === 'brush') {
      ctx.globalCompositeOperation = 'source-over';
      ctx.strokeStyle = 'rgba(0, 229, 153, 0.65)';
    } else {
      ctx.globalCompositeOperation = 'destination-out';
    }

    ctx.lineTo(x, y);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(x, y);
  };

  const stopDraw = () => {
    if (isDrawing) {
      setIsDrawing(false);
      const canvas = canvasRef.current;
      const ctx = canvas?.getContext('2d');
      if (ctx) ctx.beginPath();
      saveState();
    }
  };

  const handleSave = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const dataUrl = canvas.toDataURL('image/png');
    onSaveMask(dataUrl);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 p-4 backdrop-blur-sm">
      <div className="relative flex max-h-[92vh] w-full max-w-4xl flex-col overflow-hidden rounded-xl border border-white/10 bg-[#121417] shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-white/[0.08] px-6 py-3.5">
          <div>
            <h3 className="text-sm font-bold uppercase tracking-wider text-white">
              Selective Area Edit Mask
            </h3>
            <p className="text-[11px] text-neutral-400">
              Paint a mask over the shirt, hair, or face to focus AI modifications
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded p-1 text-neutral-400 hover:text-white transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Toolbar */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/[0.06] bg-[#16181b] px-6 py-2.5 text-xs">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setTool('brush')}
              className={`flex items-center gap-1.5 rounded px-3 py-1.5 font-medium transition-colors ${
                tool === 'brush'
                  ? 'bg-[#00e599] text-black font-semibold'
                  : 'bg-[#1e2227] text-neutral-300 hover:text-white'
              }`}
            >
              <Brush className="h-3.5 w-3.5" />
              <span>Paint Mask</span>
            </button>

            <button
              type="button"
              onClick={() => setTool('eraser')}
              className={`flex items-center gap-1.5 rounded px-3 py-1.5 font-medium transition-colors ${
                tool === 'eraser'
                  ? 'bg-[#00e599] text-black font-semibold'
                  : 'bg-[#1e2227] text-neutral-300 hover:text-white'
              }`}
            >
              <Eraser className="h-3.5 w-3.5" />
              <span>Eraser</span>
            </button>

            <div className="ml-2 flex items-center gap-2 text-neutral-400">
              <span className="text-[11px]">Size:</span>
              <input
                type="range"
                min="5"
                max="80"
                value={brushSize}
                onChange={(e) => setBrushSize(Number(e.target.value))}
                className="w-24 accent-[#00e599]"
              />
              <span className="font-mono text-[10px] w-6">{brushSize}px</span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleUndo}
              className="flex items-center gap-1 rounded bg-[#1e2227] px-2.5 py-1 text-neutral-300 hover:text-white transition-colors"
            >
              <RotateCcw className="h-3 w-3" />
              <span>Undo</span>
            </button>
            <button
              type="button"
              onClick={handleClear}
              className="rounded bg-[#1e2227] px-2.5 py-1 text-neutral-300 hover:text-white transition-colors"
            >
              Clear
            </button>
          </div>
        </div>

        {/* Canvas Display */}
        <div className="relative flex flex-1 items-center justify-center overflow-auto bg-[#0b0d0e] p-4 min-h-[50vh]">
          <div className="relative max-h-[62vh] max-w-full">
            {/* Background base image */}
            <img
              src={baseImage}
              alt="Base for masking"
              className="block max-h-[62vh] w-auto max-w-full select-none object-contain pointer-events-none rounded"
            />
            {/* Mask overlay canvas */}
            <canvas
              ref={canvasRef}
              onMouseDown={startDraw}
              onMouseMove={draw}
              onMouseUp={stopDraw}
              onMouseLeave={stopDraw}
              className="absolute inset-0 h-full w-full cursor-crosshair rounded"
            />
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between border-t border-white/[0.08] px-6 py-3.5">
          <button
            type="button"
            onClick={() => {
              onSaveMask(undefined);
              onClose();
            }}
            className="text-xs text-neutral-400 hover:text-red-400 transition-colors"
          >
            Remove Mask
          </button>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded px-4 py-2 text-xs font-medium text-neutral-300 hover:bg-white/[0.06] transition-colors"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSave}
              className="flex items-center gap-1.5 rounded bg-[#00e599] px-4 py-2 text-xs font-semibold text-black hover:bg-[#00ffaa] transition-colors"
            >
              <Check className="h-3.5 w-3.5" />
              <span>Apply Selective Mask</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
