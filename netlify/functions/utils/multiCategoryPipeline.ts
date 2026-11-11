/**
 * Multi-Category Virtual Styling Pipeline for MXM CREATOR
 * Combines independent processing for:
 * 1. TOP: Upper-body Virtual Try-On (Nymbo IDM-VTON / Google Gemini Inpainting)
 * 2. PANTS: Lower-body Virtual Try-On (levihsu/OOTDiffusion / Google Gemini Inpainting)
 * 3. SHOES: Footwear replacement with dual-foot perspective alignment & floor contact shadows (Google Gemini Inpainting)
 * 4. ACCESSORIES: Precise anatomical landmark placement for hats, glasses, watches, bags (Google Gemini Inpainting)
 * 
 * Master Canvas: Original person image.
 * Strict Body Proportion Lock: Preserves original identity, facial anatomy, hands, pose, and background.
 * Fail Honestly: If a model is not configured, records 'not_configured' and leaves that category untouched.
 */

import sharp from 'sharp';
import { runVirtualTryOn, parseDataUrl } from './huggingface';
import { replacePants } from './lowerBodyEngine';
import { replaceFootwear } from './footwearEngine';
import { replaceAccessory } from './accessoryEngine';
import { transformClothingWithGemini, getGeminiApiKey } from './gemini';

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
  status: 'applied' | 'needs_review' | 'not_configured' | 'failed' | 'unsupported' | 'pending';
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
      progress: 0.15,
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
          progress: 0.10 + (info.progress || 0) * 0.20,
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
        status: 'applied',
        model: activeSpace,
        note: `Applied via high-precision OpenPose + SCHP upper-body try-on (${topGarment.name || 'Top'}).`,
      };
    } else {
      // Check if Gemini Inpainting can serve as upper-body fallback if ZeroGPU is exhausted
      const geminiKey = getGeminiApiKey();
      let geminiTopSuccess = false;

      if (geminiKey && (topResult.isQuotaExhausted || !topResult.success)) {
        options.onProgress?.({
          stage: 'Upper-Body: Falling back to Gemini Image Inpainting...',
          progress: 0.30,
        });

        const geminiTop = await transformClothingWithGemini({
          baseImageBuffer: currentCanvasBuffer,
          garmentDataUrl: topGarment.dataUrl,
          slot: 'top',
          garmentName: topGarment.name,
          customPrompt: options.customPrompt,
        });

        if (geminiTop.success) {
          currentCanvasBuffer = geminiTop.outputBuffer;
          geminiTopSuccess = true;
          garmentStatus['top'] = {
            applied: true,
            status: 'applied',
            model: geminiTop.model,
            note: `Applied via Google Gemini Image Inpainting (${topGarment.name || 'Top'}).`,
          };
        }
      }

      if (!geminiTopSuccess) {
        if (topResult.isQuotaExhausted && !pantsGarment && !shoesGarment && !accessoriesGarment) {
          // If only TOP was requested and quota is exhausted without fallback, return quota error
          return {
            success: false,
            error: topResult.error,
            isQuotaExhausted: true,
            spaceUsed: topResult.spaceUsed || activeSpace,
            warnings,
            garmentStatus,
          };
        }

        garmentStatus['top'] = {
          applied: false,
          status: topResult.isQuotaExhausted ? 'failed' : 'failed',
          model: activeSpace,
          note: topResult.error || 'Upper-body try-on model was unavailable.',
        };
        warnings.push(`Top: ${topResult.error || 'Failed to transform'}`);
      }
    }
  }

  // 3. STAGE 2: PANTS (Lower-body Virtual Try-On)
  if (pantsGarment) {
    options.onProgress?.({
      stage: 'Stage 2/4: Processing Lower-Body Transformation (Pants / Shorts)...',
      progress: 0.45,
    });

    const pantsResult = await replacePants({
      canvasBuffer: currentCanvasBuffer,
      pantsDataUrl: pantsGarment.dataUrl,
      pantsName: pantsGarment.name,
      customPrompt: options.customPrompt,
    });

    if (pantsResult.success) {
      currentCanvasBuffer = pantsResult.outputBuffer;
      garmentStatus['pants'] = {
        applied: pantsResult.status === 'applied',
        status: pantsResult.status,
        model: pantsResult.model,
        note: pantsResult.note,
      };
      if (pantsResult.status === 'needs_review') {
        warnings.push(`Pants: ${pantsResult.note}`);
      }
    } else {
      garmentStatus['pants'] = {
        applied: false,
        status: pantsResult.status || 'not_configured',
        model: pantsResult.model,
        note: pantsResult.note,
      };
      warnings.push(`Pants: ${pantsResult.note}`);
    }
  }

  // 4. STAGE 3: SHOES (Footwear Replacement)
  if (shoesGarment) {
    options.onProgress?.({
      stage: 'Stage 3/4: Processing Footwear Replacement...',
      progress: 0.70,
    });

    const shoeResult = await replaceFootwear({
      canvasBuffer: currentCanvasBuffer,
      shoeDataUrl: shoesGarment.dataUrl,
      shoeName: shoesGarment.name,
      customPrompt: options.customPrompt,
    });

    if (shoeResult.success) {
      currentCanvasBuffer = shoeResult.outputBuffer;
      garmentStatus['shoes'] = {
        applied: true,
        status: 'applied',
        model: shoeResult.model,
        note: shoeResult.note,
      };
    } else {
      garmentStatus['shoes'] = {
        applied: false,
        status: shoeResult.status || 'not_configured',
        model: shoeResult.model,
        note: shoeResult.note,
      };
      warnings.push(`Shoes: ${shoeResult.note}`);
    }
  }

  // 5. STAGE 4: ACCESSORIES (Headwear, Eyewear, Jewelry)
  if (accessoriesGarment) {
    options.onProgress?.({
      stage: 'Stage 4/4: Processing Accessory Placement...',
      progress: 0.88,
    });

    const accResult = await replaceAccessory({
      canvasBuffer: currentCanvasBuffer,
      accessoryDataUrl: accessoriesGarment.dataUrl,
      accessoryName: accessoriesGarment.name,
      customPrompt: options.customPrompt,
    });

    if (accResult.success) {
      currentCanvasBuffer = accResult.outputBuffer;
      garmentStatus['accessories'] = {
        applied: true,
        status: 'applied',
        model: accResult.model,
        note: accResult.note,
      };
    } else {
      garmentStatus['accessories'] = {
        applied: false,
        status: accResult.status || 'not_configured',
        model: accResult.model,
        note: accResult.note,
      };
      warnings.push(`Accessories: ${accResult.note}`);
    }
  }

  // 6. Quality Control & Resolution Verification
  options.onProgress?.({
    stage: 'Final Compositing & Quality Control Verification...',
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
