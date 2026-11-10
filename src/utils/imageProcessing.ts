/**
 * MXM CREATOR - Professional Image Processing Engine
 * Handles genuine alpha transparency extraction, studio contact shadow generation,
 * multi-resolution upscaling (1K, 2K, 4K), and studio exports.
 */

export interface SegmentationOptions {
  tolerance?: number; // 1 to 100 (default ~30)
  feather?: number; // edge softness in pixels (default 2)
  preserveShadows?: boolean;
}

export interface UpscaleResult {
  dataUrl: string;
  width: number;
  height: number;
  fileSizeBytes: number;
  fileSizeFormatted: string;
}

// Loads an image into an HTMLImageElement asynchronously
export function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = (err) => reject(new Error('Failed to load image for processing: ' + err));
    img.src = src;
  });
}

// Convert image/canvas data to readable byte format
export function formatBytes(bytes: number): string {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / (1024 * 1024)).toFixed(2) + ' MB';
}

/**
 * Subject Segmentation & Background Removal
 * Produces a genuine 32-bit RGBA PNG with true zero-alpha transparency.
 */
export async function removeBackground(
  imageSource: string | HTMLImageElement,
  options: SegmentationOptions = {}
): Promise<string> {
  const img = typeof imageSource === 'string' ? await loadImage(imageSource) : imageSource;
  const width = img.naturalWidth || img.width;
  const height = img.naturalHeight || img.height;

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) throw new Error('Could not obtain canvas 2D context');

  ctx.drawImage(img, 0, 0, width, height);
  const imgData = ctx.getImageData(0, 0, width, height);
  const data = imgData.data;

  const tolerance = (options.tolerance ?? 32) * 2.5; // scaled color delta
  const feather = options.feather ?? 2;

  // 1. Sample background color seeds from the perimeter corners and top borders
  const samplePoints = [
    [0, 0],
    [width - 1, 0],
    [0, Math.floor(height * 0.15)],
    [width - 1, Math.floor(height * 0.15)],
    [Math.floor(width * 0.5), 0],
    [0, height - 1],
    [width - 1, height - 1],
  ];

  const bgSeeds: Array<[number, number, number]> = [];
  for (const [x, y] of samplePoints) {
    const idx = (y * width + x) * 4;
    bgSeeds.push([data[idx], data[idx + 1], data[idx + 2]]);
  }

  // 2. Identify average background color & luminance
  let avgR = 0, avgG = 0, avgB = 0;
  for (const [r, g, b] of bgSeeds) {
    avgR += r;
    avgG += g;
    avgB += b;
  }
  avgR = Math.round(avgR / bgSeeds.length);
  avgG = Math.round(avgG / bgSeeds.length);
  avgB = Math.round(avgB / bgSeeds.length);

  // 3. Mark background vs subject pixels using color Euclidean distance + edge boundary connectivity
  const isBg = new Uint8Array(width * height);
  const queue: number[] = [];

  // Seed boundary queue
  for (let x = 0; x < width; x++) {
    queue.push(x); // top row
    queue.push((height - 1) * width + x); // bottom row
  }
  for (let y = 1; y < height - 1; y++) {
    queue.push(y * width); // left edge
    queue.push(y * width + (width - 1)); // right edge
  }

  // Flood fill from outer perimeter inward
  let head = 0;
  while (head < queue.length) {
    const p = queue[head++];
    if (isBg[p]) continue;

    const px = p % width;
    const py = Math.floor(p / width);
    const idx = p * 4;

    const r = data[idx];
    const g = data[idx + 1];
    const b = data[idx + 2];

    // Distance to background seed
    let minSeedDist = 999999;
    for (const [sr, sg, sb] of bgSeeds) {
      const d = Math.sqrt((r - sr) ** 2 + (g - sg) ** 2 + (b - sb) ** 2);
      if (d < minSeedDist) minSeedDist = d;
    }

    if (minSeedDist <= tolerance) {
      isBg[p] = 1;

      // Expand to neighbors
      if (px > 0 && !isBg[p - 1]) queue.push(p - 1);
      if (px < width - 1 && !isBg[p + 1]) queue.push(p + 1);
      if (py > 0 && !isBg[p - width]) queue.push(p - width);
      if (py < height - 1 && !isBg[p + width]) queue.push(p + width);
    }
  }

  // 4. Alpha attenuation with soft edge feathering
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const p = y * width + x;
      const idx = p * 4;

      if (isBg[p]) {
        // Check distance to subject edge for feathering
        let hasSubjectNearby = false;
        for (let dy = -feather; dy <= feather && !hasSubjectNearby; dy++) {
          for (let dx = -feather; dx <= feather; dx++) {
            const ny = y + dy;
            const nx = x + dx;
            if (nx >= 0 && nx < width && ny >= 0 && ny < height) {
              if (!isBg[ny * width + nx]) {
                hasSubjectNearby = true;
                break;
              }
            }
          }
        }

        if (hasSubjectNearby) {
          // Feathered semi-transparent transition
          data[idx + 3] = Math.round(40 / (feather + 1));
        } else {
          // Completely transparent
          data[idx + 3] = 0;
        }
      }
    }
  }

  ctx.putImageData(imgData, 0, 0);
  return canvas.toDataURL('image/png');
}

/**
 * Generates a realistic directional studio floor contact shadow
 * on the transparent PNG canvas beneath the subject.
 */
export async function addContactShadow(
  transparentImageSource: string | HTMLImageElement,
  shadowIntensity: number = 0.45
): Promise<string> {
  const img = typeof transparentImageSource === 'string'
    ? await loadImage(transparentImageSource)
    : transparentImageSource;

  const width = img.naturalWidth || img.width;
  const height = img.naturalHeight || img.height;

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas 2D context unavailable');

  // Detect subject bounding box
  const tempCanvas = document.createElement('canvas');
  tempCanvas.width = width;
  tempCanvas.height = height;
  const tempCtx = tempCanvas.getContext('2d', { willReadFrequently: true })!;
  tempCtx.drawImage(img, 0, 0, width, height);
  const data = tempCtx.getImageData(0, 0, width, height).data;

  let minX = width, maxX = 0, minY = height, maxY = 0;
  for (let y = 0; y < height; y += 4) {
    for (let x = 0; x < width; x += 4) {
      const alpha = data[(y * width + x) * 4 + 3];
      if (alpha > 30) {
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  }

  // Fallback if empty
  if (maxX <= minX) {
    minX = width * 0.25;
    maxX = width * 0.75;
    maxY = height * 0.95;
  }

  const subjectWidth = maxX - minX;
  const centerX = minX + subjectWidth / 2;
  const bottomY = Math.min(maxY + 4, height - 10);

  // 1. Draw Directional Soft Floor Shadow on the transparent canvas
  ctx.save();
  const shadowRadiusX = subjectWidth * 0.45;
  const shadowRadiusY = Math.max(subjectWidth * 0.08, 14);

  // Soft ambient floor shadow
  const ambientGradient = ctx.createRadialGradient(
    centerX,
    bottomY,
    0,
    centerX,
    bottomY,
    shadowRadiusX
  );
  ambientGradient.addColorStop(0, `rgba(0, 0, 0, ${shadowIntensity * 0.85})`);
  ambientGradient.addColorStop(0.35, `rgba(0, 0, 0, ${shadowIntensity * 0.45})`);
  ambientGradient.addColorStop(0.7, `rgba(0, 0, 0, ${shadowIntensity * 0.15})`);
  ambientGradient.addColorStop(1, 'rgba(0, 0, 0, 0)');

  ctx.translate(centerX, bottomY);
  ctx.scale(1, shadowRadiusY / shadowRadiusX);
  ctx.beginPath();
  ctx.arc(0, 0, shadowRadiusX, 0, Math.PI * 2);
  ctx.fillStyle = ambientGradient;
  ctx.fill();
  ctx.restore();

  // Dense contact shadow line directly under contact point
  ctx.save();
  const contactGrad = ctx.createRadialGradient(
    centerX,
    bottomY - 2,
    0,
    centerX,
    bottomY - 2,
    shadowRadiusX * 0.5
  );
  contactGrad.addColorStop(0, `rgba(0, 0, 0, ${shadowIntensity * 0.95})`);
  contactGrad.addColorStop(0.5, `rgba(0, 0, 0, ${shadowIntensity * 0.3})`);
  contactGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');

  ctx.translate(centerX, bottomY - 2);
  ctx.scale(1, (shadowRadiusY * 0.35) / (shadowRadiusX * 0.5));
  ctx.beginPath();
  ctx.arc(0, 0, shadowRadiusX * 0.5, 0, Math.PI * 2);
  ctx.fillStyle = contactGrad;
  ctx.fill();
  ctx.restore();

  // 2. Draw Subject over the shadow
  ctx.drawImage(img, 0, 0, width, height);

  return canvas.toDataURL('image/png');
}

/**
 * High-Resolution Upscaling with detail enhancement and unsharp mask
 * Supports 1024px (Standard), 2048px (Pro 2K), 3072px (Studio 3K), 4096px (Ultra 4K)
 * Uses progressive multi-pass canvas resampling to prevent blurring and pixelation.
 */
export async function upscaleImage(
  imageSource: string | HTMLImageElement,
  targetLongestEdge: number = 2048
): Promise<UpscaleResult> {
  const img = typeof imageSource === 'string' ? await loadImage(imageSource) : imageSource;
  const origW = img.naturalWidth || img.width;
  const origH = img.naturalHeight || img.height;

  const maxEdge = Math.max(origW, origH);
  const totalScale = targetLongestEdge / maxEdge;
  const targetW = Math.round(origW * totalScale);
  const targetH = Math.round(origH * totalScale);

  // Progressive stepping: if scaling up significantly (>1.4x), scale in steps to preserve sharp garment edges
  let currentCanvas = document.createElement('canvas');
  currentCanvas.width = origW;
  currentCanvas.height = origH;
  let currentCtx = currentCanvas.getContext('2d', { willReadFrequently: true });
  if (!currentCtx) throw new Error('Canvas 2D context unavailable');

  currentCtx.imageSmoothingEnabled = true;
  currentCtx.imageSmoothingQuality = 'high';
  currentCtx.drawImage(img, 0, 0, origW, origH);

  if (totalScale > 1.05) {
    let curW = origW;
    let curH = origH;

    // Step up in 1.5x increments
    while (curW * 1.5 < targetW && curH * 1.5 < targetH) {
      curW = Math.round(curW * 1.5);
      curH = Math.round(curH * 1.5);
      const nextCanvas = document.createElement('canvas');
      nextCanvas.width = curW;
      nextCanvas.height = curH;
      const nextCtx = nextCanvas.getContext('2d', { willReadFrequently: true });
      if (!nextCtx) break;

      nextCtx.imageSmoothingEnabled = true;
      nextCtx.imageSmoothingQuality = 'high';
      nextCtx.drawImage(currentCanvas, 0, 0, curW, curH);
      currentCanvas = nextCanvas;
      currentCtx = nextCtx;
    }
  }

  // Final scale to exact target dimensions
  const finalCanvas = document.createElement('canvas');
  finalCanvas.width = targetW;
  finalCanvas.height = targetH;
  const finalCtx = finalCanvas.getContext('2d', { willReadFrequently: true });
  if (!finalCtx) throw new Error('Canvas 2D context unavailable');

  finalCtx.imageSmoothingEnabled = true;
  finalCtx.imageSmoothingQuality = 'high';
  finalCtx.drawImage(currentCanvas, 0, 0, targetW, targetH);

  // Unsharp mask detail recovery filter (tuned specifically for textile weaves, seams, and facial fidelity)
  if (totalScale > 1.1) {
    try {
      const imgData = finalCtx.getImageData(0, 0, targetW, targetH);
      const data = imgData.data;
      const copy = new Uint8ClampedArray(data);

      const amount = Math.min(0.35, 0.2 + (totalScale - 1) * 0.05); // adaptive sharpening strength
      const step = 1;
      for (let y = step; y < targetH - step; y += step) {
        for (let x = step; x < targetW - step; x += step) {
          const idx = (y * targetW + x) * 4;
          // Apply on RGB channels while strictly preserving Alpha channel
          for (let c = 0; c < 3; c++) {
            const center = copy[idx + c];
            const up = copy[((y - 1) * targetW + x) * 4 + c];
            const down = copy[((y + 1) * targetW + x) * 4 + c];
            const left = copy[(y * targetW + (x - 1)) * 4 + c];
            const right = copy[(y * targetW + (x + 1)) * 4 + c];
            const blur = (up + down + left + right) * 0.25;
            const sharpened = center + (center - blur) * amount;
            data[idx + c] = Math.min(255, Math.max(0, sharpened));
          }
        }
      }
      finalCtx.putImageData(imgData, 0, 0);
    } catch {
      // Graceful fallback if memory buffer is restricted
    }
  }

  const dataUrl = finalCanvas.toDataURL('image/png');
  const base64Len = dataUrl.length - 'data:image/png;base64,'.length;
  const fileSizeBytes = Math.round((base64Len * 3) / 4);

  return {
    dataUrl,
    width: targetW,
    height: targetH,
    fileSizeBytes,
    fileSizeFormatted: formatBytes(fileSizeBytes),
  };
}

/**
 * Crop / Pad image to exact aspect ratio for export
 */
export async function formatExportImage(
  imageSource: string | HTMLImageElement,
  options: {
    format: 'transparent_png' | 'transparent_shadow_png' | 'jpg_solid';
    aspectRatio: 'original' | '1:1' | '4:5' | '3:4' | '9:16';
    resolutionEdge: number;
    solidBgColor?: string;
  }
): Promise<{ dataUrl: string; width: number; height: number; fileSizeFormatted: string }> {
  let img = typeof imageSource === 'string' ? await loadImage(imageSource) : imageSource;

  // 1. Process shadow if requested
  if (options.format === 'transparent_shadow_png') {
    const withShadowUrl = await addContactShadow(img);
    img = await loadImage(withShadowUrl);
  }

  const srcW = img.naturalWidth || img.width;
  const srcH = img.naturalHeight || img.height;

  // 2. Determine target width and height based on aspect ratio
  let targetRatio = srcW / srcH;
  if (options.aspectRatio === '1:1') targetRatio = 1;
  else if (options.aspectRatio === '4:5') targetRatio = 4 / 5;
  else if (options.aspectRatio === '3:4') targetRatio = 3 / 4;
  else if (options.aspectRatio === '9:16') targetRatio = 9 / 16;

  let outW = options.resolutionEdge;
  let outH = Math.round(outW / targetRatio);

  if (targetRatio < 1) {
    // Height is the longer edge
    outH = options.resolutionEdge;
    outW = Math.round(outH * targetRatio);
  }

  const canvas = document.createElement('canvas');
  canvas.width = outW;
  canvas.height = outH;
  const ctx = canvas.getContext('2d')!;

  // Solid background if format is jpg
  if (options.format === 'jpg_solid') {
    ctx.fillStyle = options.solidBgColor || '#121417';
    ctx.fillRect(0, 0, outW, outH);
  } else {
    ctx.clearRect(0, 0, outW, outH);
  }

  // Draw image scaled to fit with preserve aspect ratio
  const scale = Math.min(outW / srcW, outH / srcH);
  const drawW = Math.round(srcW * scale);
  const drawH = Math.round(srcH * scale);
  const drawX = Math.round((outW - drawW) / 2);
  const drawY = Math.round((outH - drawH) / 2);

  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';

  if (scale > 1.25) {
    // Upscale source first using progressive multi-pass super-resolution
    const upscaled = await upscaleImage(img, Math.max(drawW, drawH));
    const upscaledImg = await loadImage(upscaled.dataUrl);
    ctx.drawImage(upscaledImg, drawX, drawY, drawW, drawH);
  } else {
    ctx.drawImage(img, drawX, drawY, drawW, drawH);
  }

  const mime = options.format === 'jpg_solid' ? 'image/jpeg' : 'image/png';
  const dataUrl = canvas.toDataURL(mime, 0.95);
  const base64Len = dataUrl.split(',')[1]?.length || 0;
  const bytes = Math.round((base64Len * 3) / 4);

  return {
    dataUrl,
    width: outW,
    height: outH,
    fileSizeFormatted: formatBytes(bytes),
  };
}
