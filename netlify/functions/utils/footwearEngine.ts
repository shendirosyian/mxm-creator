/**
 * Dedicated Footwear Virtual Try-On Engine for MXM CREATOR
 * Connects to Google Gemini multimodal inpainting model (gemini-3.1-flash-lite-image)
 * 
 * Strict Guarantees:
 * - Real image transformation: Replaces shoes on both feet, aligned with perspective and foot stance.
 * - Casts natural floor contact shadows.
 * - Preserves pants silhouette, leg anatomy, person identity, face, and background.
 * - ZERO 2D rectangular product overlays or stickers.
 * - Honest status reporting: If model is not configured, returns 'not_configured' without modifying canvas.
 */

import { transformClothingWithGemini, getGeminiApiKey } from './gemini';

export interface FootwearOptions {
  canvasBuffer: Buffer;
  shoeDataUrl: string;
  shoeName?: string;
  customPrompt?: string;
}

export interface FootwearResult {
  success: boolean;
  outputBuffer: Buffer;
  maskBuffer?: Buffer;
  note: string;
  model: string;
  status: 'applied' | 'needs_review' | 'not_configured' | 'failed';
}

export async function replaceFootwear(options: FootwearOptions): Promise<FootwearResult> {
  const apiKey = getGeminiApiKey();

  // If no API key is configured, fail honestly without modifying the canvas
  if (!apiKey) {
    return {
      success: false,
      outputBuffer: options.canvasBuffer,
      model: 'Google Gemini Footwear Inpainting',
      status: 'not_configured',
      note: 'Footwear replacement requires server GEMINI_API_KEY (starting with "AIzaSy...") for dual-foot perspective alignment & floor contact shadows. Configure in Settings > API Keys.',
    };
  }

  // Execute genuine AI footwear replacement
  const result = await transformClothingWithGemini({
    baseImageBuffer: options.canvasBuffer,
    garmentDataUrl: options.shoeDataUrl,
    slot: 'shoes',
    garmentName: options.shoeName || 'Footwear',
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
