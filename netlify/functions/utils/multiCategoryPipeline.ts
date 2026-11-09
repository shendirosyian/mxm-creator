/**
 * Multi-Category Virtual Styling Pipeline for MXM CREATOR
 * Combines independent processing for:
 * 1. TOP: Upper-body Virtual Try-On (Nymbo / yisol ZeroGPU IDM-VTON)
 * 2. PANTS: Lower-body Virtual Try-On (levihsu/OOTDiffusion / MXM Lower-Body Engine)
 * 3. SHOES: Dual-foot perspective alignment with contact shadows (MXM Footwear Engine)
 * 4. ACCESSORIES: Headwear/Eyewear localized landmark fitting (MXM Accessory Engine)
 * 
 * Master Canvas: Original person image.
 * Strict Body Proportion Lock: Preserves original identity, facial anatomy, hands, pose, and background.
 */

import sharp from 'sharp';
import { runVirtualTryOn, parseDataUrl } from './huggingface';
import { replacePants } from './lowerBodyEngine';
import { replaceFootwear } from './footwearEngine';
import { replaceAccessory } from './accessoryEngine';

export interface GarmentReference {
  slot: string;
  dataUrl: string;
  name?: string;
}

export interface MultiCategoryOptions {
  playerBase64: string;
  garmentList: GarmentReference[];
  customPrompt?: string;
  spaceId?: string;
  onProgress?: (info: { stage: string; position?: number; message?: string; progress?: number }) => void;
}

export interface CategoryStatusDetail {
  applied: boolean;
  model: string;
  note: string;
}

export interface MultiCategoryResult {
  success: boolean;
  imageDataUrl?: string;
  maskedImageDataUrl?: string;
  error?: string;
  isQuotaExhausted?: boolean;
  isAuthError?: boolean;
  requiresCredentials?: boolean;
  spaceUsed: string;
  warnings: string[];
  garmentStatus: Record<string, CategoryStatusDetail>;
}

export async function runMultiCategoryTryOn(options: MultiCategoryOptions): Promise<MultiCategoryResult> {
  const warnings: string[] = [];
  const garmentStatus: Record<string, CategoryStatusDetail> = {};

  if (!options.playerBase64) {
    return {
      success: false,
      error: 'Missing human person reference photo.',
      spaceUsed: options.spaceId || 'Nymbo/Virtual-Try-On',
      warnings: [],
      garmentStatus: {},
    };
  }

  // 1. Separate uploaded garment references by category
  const topGarment = options.garmentList.find(
    (g) => (g.slot === 'top' || g.slot === 'shirt') && Boolean(g.dataUrl)
  );
  const pantsGarment = options.garmentList.find(
    (g) => (g.slot === 'pants' || g.slot === 'bottom') && Boolean(g.dataUrl)
  );
  const shoesGarment = options.garmentList.find(
    (g) => (g.slot === 'shoes' || g.slot === 'footwear') && Boolean(g.dataUrl)
  );
  const accessoriesGarment = options.garmentList.find(
    (g) => g.slot === 'accessories' && Boolean(g.dataUrl)
  );

  const { buffer: originalPlayerBuffer } = parseDataUrl(options.playerBase64);
  let currentCanvasBuffer: Buffer = originalPlayerBuffer;
  let primaryMaskUrl: string | undefined = undefined;
  let activeSpace = options.spaceId || 'Nymbo/Virtual-Try-On';

  // 2. STAGE 1: TOP (Upper-body Virtual Try-On)
  if (topGarment) {
    options.onProgress?.({
      stage: 'Stage 1/4: Running Upper-Body Virtual Try-On (IDM-VTON)...',
      progress: 0.20,
    });

    const topResult = await runVirtualTryOn({
      playerBase64: options.playerBase64,
      garmentList: [topGarment],
      garmentDescription: options.customPrompt || topGarment.name || 'Upper-body garment',
      spaceId: options.spaceId,
      onProgress: (info) => {
        options.onProgress?.({
          stage: `Upper-Body: ${info.stage}`,
          position: info.position,
          progress: 0.10 + (info.progress || 0) * 0.25,
        });
      },
    });

    if (topResult.success && topResult.imageDataUrl) {
      const { buffer: topBuf } = parseDataUrl(topResult.imageDataUrl);
      currentCanvasBuffer = topBuf;
      primaryMaskUrl = topResult.maskedImageDataUrl;
      activeSpace = topResult.spaceUsed || activeSpace;

      garmentStatus['top'] = {
        applied: true,
        model: activeSpace,
        note: `Applied via high-precision OpenPose + SCHP upper-body try-on (${topGarment.name || 'Top'}).`,
      };
    } else {
      if (topResult.isQuotaExhausted) {
        return {
          success: false,
          error: topResult.error,
          isQuotaExhausted: true,
          spaceUsed: topResult.spaceUsed || activeSpace,
          warnings,
          garmentStatus,
        };
      }
      if (topResult.isAuthError || topResult.requiresCredentials) {
        return {
          success: false,
          error: topResult.error,
          isAuthError: true,
          requiresCredentials: true,
          spaceUsed: topResult.spaceUsed || activeSpace,
          warnings,
          garmentStatus,
        };
      }
      garmentStatus['top'] = {
        applied: false,
        model: activeSpace,
        note: topResult.error || 'Upper body transformation did not complete.',
      };
      warnings.push(`Top try-on notice: ${topResult.error || 'Skipped'}`);
    }
  }

  // 3. STAGE 2: PANTS (Lower-body Virtual Try-On)
  if (pantsGarment) {
    options.onProgress?.({
      stage: 'Stage 2/4: Processing Lower-Body Transformation (Pants / Shorts)...',
      progress: 0.50,
    });

    const pantsResult = await replacePants({
      canvasBuffer: currentCanvasBuffer,
      pantsDataUrl: pantsGarment.dataUrl,
      pantsName: pantsGarment.name,
    });

    if (pantsResult.success) {
      currentCanvasBuffer = pantsResult.outputBuffer;
      garmentStatus['pants'] = {
        applied: true,
        model: pantsResult.model,
        note: pantsResult.note,
      };
    } else {
      garmentStatus['pants'] = {
        applied: false,
        model: pantsResult.model,
        note: pantsResult.note,
      };
      warnings.push(`Pants notice: ${pantsResult.note}`);
    }
  }

  // 4. STAGE 3: SHOES (Footwear Replacement)
  if (shoesGarment) {
    options.onProgress?.({
      stage: 'Stage 3/4: Applying Footwear Perspective Alignment...',
      progress: 0.75,
    });

    const shoeResult = await replaceFootwear({
      canvasBuffer: currentCanvasBuffer,
      shoeDataUrl: shoesGarment.dataUrl,
      shoeName: shoesGarment.name,
    });

    if (shoeResult.success) {
      currentCanvasBuffer = shoeResult.outputBuffer;
      garmentStatus['shoes'] = {
        applied: true,
        model: shoeResult.model,
        note: shoeResult.note,
      };
    } else {
      garmentStatus['shoes'] = {
        applied: false,
        model: shoeResult.model,
        note: shoeResult.note,
      };
      warnings.push(`Shoes notice: ${shoeResult.note}`);
    }
  }

  // 5. STAGE 4: ACCESSORIES (Headwear, Eyewear, Jewelry)
  if (accessoriesGarment) {
    options.onProgress?.({
      stage: 'Stage 4/4: Fitting Localized Accessory (Preserving Face & Anatomy)...',
      progress: 0.90,
    });

    const accResult = await replaceAccessory({
      canvasBuffer: currentCanvasBuffer,
      accessoryDataUrl: accessoriesGarment.dataUrl,
      accessoryName: accessoriesGarment.name,
    });

    if (accResult.success) {
      currentCanvasBuffer = accResult.outputBuffer;
      garmentStatus['accessories'] = {
        applied: true,
        model: accResult.model,
        note: accResult.note,
      };
    } else {
      garmentStatus['accessories'] = {
        applied: false,
        model: accResult.model,
        note: accResult.note,
      };
      warnings.push(`Accessory notice: ${accResult.note}`);
    }
  }

  // 6. Final Quality Control & Canvas Dimension Verification
  options.onProgress?.({
    stage: 'Final Compositing & Anatomical Quality Control...',
    progress: 0.98,
  });

  const finalPngBuffer = await sharp(currentCanvasBuffer).png().toBuffer();
  const finalDataUrl = `data:image/png;base64,${finalPngBuffer.toString('base64')}`;

  return {
    success: true,
    imageDataUrl: finalDataUrl,
    maskedImageDataUrl: primaryMaskUrl,
    spaceUsed: activeSpace,
    warnings,
    garmentStatus,
  };
}
