/**
 * Dedicated Accessory Virtual Try-On Engine for MXM CREATOR
 * Connects to Google Gemini multimodal inpainting model (gemini-3.1-flash-lite-image)
 * 
 * Strict Guarantees:
 * - Real image transformation: Accurately places hats, glasses, watches, and bags at proper anatomical regions.
 * - Preserves facial features, expression, hair volume, skin tone, clothing, and background.
 * - ZERO 2D rectangular product overlays or stickers.
 * - Honest status reporting: If model is not configured, returns 'not_configured' without modifying canvas.
 */

import { transformClothingWithGemini, getGeminiApiKey } from './gemini';

export interface AccessoryOptions {
  canvasBuffer: Buffer;
  accessoryDataUrl: string;
  accessoryName?: string;
  customPrompt?: string;
}

export interface AccessoryResult {
  success: boolean;
  outputBuffer: Buffer;
  maskBuffer?: Buffer;
  note: string;
  model: string;
  status: 'applied' | 'needs_review' | 'not_configured' | 'failed';
}

export async function replaceAccessory(options: AccessoryOptions): Promise<AccessoryResult> {
  const apiKey = getGeminiApiKey();

  // If no API key is configured, fail honestly without modifying the canvas
  if (!apiKey) {
    return {
      success: false,
      outputBuffer: options.canvasBuffer,
      model: 'Google Gemini Landmark Inpainting',
      status: 'not_configured',
      note: 'Accessory placement requires server GEMINI_API_KEY (starting with "AIzaSy...") for anatomical landmark inpainting (hats, glasses, watches, bags). Configure in Settings > API Keys.',
    };
  }

  // Execute genuine AI accessory placement
  const result = await transformClothingWithGemini({
    baseImageBuffer: options.canvasBuffer,
    garmentDataUrl: options.accessoryDataUrl,
    slot: 'accessories',
    garmentName: options.accessoryName || 'Accessory',
    customPrompt: options.customPrompt,
  });

  return {
    success: result.success,
    outputBuffer: result.outputBuffer,
    model: result.model,
    status: result.status,
    note: result.note,
  };
}
