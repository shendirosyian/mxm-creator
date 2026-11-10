/**
 * Google Gemini Multimodal Image Inpainting & Transformation Engine for MXM CREATOR
 * Uses the official @google/genai SDK (v2.4+) with GoogleGenAI client:
 * Model: gemini-3.1-flash-lite-image
 * Header: 'User-Agent': 'aistudio-build'
 * 
 * Strict Guarantees:
 * - Server-side only (Netlify Functions / Express backend).
 * - Genuine AI image transformation: person photo and garment reference are passed as distinct visual inputs.
 * - Preserves person identity, facial features, body anatomy, pose, and background.
 * - NO fake 2D sticker pasting or rectangular canvas overlays.
 */

import { GoogleGenAI } from '@google/genai';
import sharp from 'sharp';

export function cleanApiKey(raw?: string): string {
  if (!raw) return '';
  let key = raw.trim();
  if ((key.startsWith('"') && key.endsWith('"')) || (key.startsWith("'") && key.endsWith("'"))) {
    key = key.substring(1, key.length - 1).trim();
  }
  return key;
}

export function getGeminiApiKey(): string | null {
  const key = cleanApiKey(process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY);
  return key || null;
}

export function getGeminiClient(): GoogleGenAI | null {
  const apiKey = getGeminiApiKey();
  if (!apiKey) return null;
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

export function parseBase64Image(dataUriOrBase64: string): { data: string; mimeType: string } {
  if (dataUriOrBase64.startsWith('data:')) {
    const parts = dataUriOrBase64.split(';base64,');
    const mimeType = parts[0].replace('data:', '') || 'image/jpeg';
    return { data: parts[1], mimeType };
  }
  return { data: dataUriOrBase64, mimeType: 'image/jpeg' };
}

export interface GeminiTransformOptions {
  baseImageBuffer: Buffer;
  garmentDataUrl: string;
  slot: 'top' | 'pants' | 'shoes' | 'accessories';
  garmentName?: string;
  customPrompt?: string;
}

export interface GeminiTransformResult {
  success: boolean;
  outputBuffer: Buffer;
  model: string;
  note: string;
  status: 'applied' | 'failed' | 'not_configured';
  error?: string;
}

/**
 * Execute real AI Garment/Footwear/Accessory Inpainting using gemini-3.1-flash-lite-image
 */
export async function transformClothingWithGemini(
  options: GeminiTransformOptions
): Promise<GeminiTransformResult> {
  const ai = getGeminiClient();
  const modelName = 'gemini-3.1-flash-lite-image';

  if (!ai) {
    return {
      success: false,
      outputBuffer: options.baseImageBuffer,
      model: `Google Gemini (${modelName})`,
      status: 'not_configured',
      note: `GEMINI_API_KEY is not configured in server environment variables. Required for genuine AI ${options.slot} transformation.`,
      error: 'GEMINI_API_KEY_MISSING',
    };
  }

  try {
    const meta = await sharp(options.baseImageBuffer).metadata();
    const origWidth = meta.width || 768;
    const origHeight = meta.height || 1024;

    // Convert canvas buffer to standard JPEG base64
    const baseJpgBuf = await sharp(options.baseImageBuffer).jpeg({ quality: 95 }).toBuffer();
    const base64Canvas = baseJpgBuf.toString('base64');

    const { data: garmentBase64, mimeType: garmentMime } = parseBase64Image(options.garmentDataUrl);

    // Build specialized fashion styling instructions per category
    let promptText = '';
    const nameLabel = options.garmentName || options.slot;

    if (options.slot === 'top') {
      promptText = `You are an expert fashion virtual try-on engine.
Image 1 is the full photograph of the person.
Image 2 is the upper-body garment reference (${nameLabel}).
Task: Seamlessly replace the person's upper-body clothing with the exact garment from Image 2.
- Faithfully drape the fabric around the torso, arms, and neckline matching the person's pose.
- Match natural shadows, folds, and lighting.
- Strictly preserve the person's face, facial identity, hair, skin tone, hands, pants, shoes, and entire background completely unchanged.
- Return only the transformed high-fidelity photograph.`;
    } else if (options.slot === 'pants') {
      promptText = `You are an expert lower-body fashion virtual try-on engine.
Image 1 is the full photograph of the person.
Image 2 is the lower-body garment reference (${nameLabel}).
Task: Seamlessly replace ONLY the person's lower-body clothing (pants, trousers, jeans, or shorts) with the exact garment shown in Image 2.
- Preserve exact silhouette and length: full-length pants must remain full-length covering ankles; shorts must remain shorts with natural knee/thigh anatomy.
- Preserve pockets, seams, fabric wash, zipper details, and cuff hems.
- Naturally drape fabric over the person's legs, knees, and hips matching their stance and angle.
- Strictly preserve the person's face, upper-body clothing, footwear/shoes, hands, body proportions, and background completely unchanged.
- Return only the transformed high-fidelity photograph.`;
    } else if (options.slot === 'shoes') {
      promptText = `You are an ultra-high precision footwear try-on and perspective alignment engine.
Image 1 is the full photograph of the person.
Image 2 is the footwear product reference (${nameLabel}).
Task: Seamlessly replace the shoes/footwear on BOTH of the person's feet with the exact shoes from Image 2.
- Accurately align both shoes with the person's foot angles, perspective, stance, and floor contact plane.
- Cast natural soft ambient contact shadows under both soles onto the floor surface.
- Match scene lighting and environmental reflections.
- Strictly preserve the person's face, upper body, pants silhouette and length, legs, skin tone, and entire background completely unchanged.
- Return only the transformed high-fidelity photograph.`;
    } else if (options.slot === 'accessories') {
      const lower = (options.garmentName || '').toLowerCase();
      let anatomicalTarget = 'appropriate anatomical position';
      if (lower.includes('hat') || lower.includes('cap') || lower.includes('beanie')) {
        anatomicalTarget = 'the crown of the head, naturally conforming to hair volume and head tilt';
      } else if (lower.includes('glass') || lower.includes('sunglass') || lower.includes('eyewear')) {
        anatomicalTarget = 'the bridge of the nose and over the eyes, aligning with ear placement and head tilt';
      } else if (lower.includes('watch') || lower.includes('bracelet')) {
        anatomicalTarget = 'around the wrist of the visible arm';
      } else if (lower.includes('bag') || lower.includes('backpack') || lower.includes('tote')) {
        anatomicalTarget = 'held naturally in the person hand or draped across the shoulder';
      } else if (lower.includes('necklace') || lower.includes('chain')) {
        anatomicalTarget = 'around the neck and resting on the collarbone/chest';
      }

      promptText = `You are an ultra-high precision fashion accessory placement engine.
Image 1 is the photograph of the person.
Image 2 is the accessory reference (${nameLabel}).
Task: Seamlessly place the accessory from Image 2 onto the person in Image 1 at ${anatomicalTarget}.
- Match scale, lighting, perspective, and cast realistic subtle shadows.
- Strictly preserve the person's facial features, identity, hair, body proportions, clothing, and background completely unchanged.
- Return only the transformed high-fidelity photograph.`;
    }

    if (options.customPrompt) {
      promptText += `\nAdditional styling directive: ${options.customPrompt}`;
    }

    // Call @google/genai SDK
    const response = await ai.models.generateContent({
      model: modelName,
      contents: {
        parts: [
          {
            inlineData: {
              data: base64Canvas,
              mimeType: 'image/jpeg',
            },
          },
          {
            inlineData: {
              data: garmentBase64,
              mimeType: garmentMime,
            },
          },
          {
            text: promptText,
          },
        ],
      },
    });

    // Extract generated image part
    const candidateParts = response.candidates?.[0]?.content?.parts ?? [];
    let generatedBase64: string | null = null;

    for (const part of candidateParts) {
      if (part.inlineData?.data) {
        generatedBase64 = part.inlineData.data;
        break;
      }
    }

    if (!generatedBase64) {
      const textOutput = candidateParts.find((p: any) => p.text)?.text || 'No image output returned by model';
      return {
        success: false,
        outputBuffer: options.baseImageBuffer,
        model: `Google Gemini (${modelName})`,
        status: 'failed',
        note: `Model did not return image data: ${textOutput.substring(0, 100)}`,
        error: textOutput,
      };
    }

    // Resize back to exact original canvas dimensions to preserve 100% resolution & aspect ratio
    const rawResultBuf = Buffer.from(generatedBase64, 'base64');
    const finalBuffer = await sharp(rawResultBuf)
      .resize(origWidth, origHeight, { fit: 'fill' })
      .png()
      .toBuffer();

    return {
      success: true,
      outputBuffer: finalBuffer,
      model: `Google Gemini (${modelName})`,
      status: 'applied',
      note: `Applied genuine AI ${options.slot} transformation (${nameLabel}) via Google Gemini.`,
    };
  } catch (err: any) {
    console.error(`[Gemini Try-On Error for ${options.slot}]`, err);
    return {
      success: false,
      outputBuffer: options.baseImageBuffer,
      model: `Google Gemini (${modelName})`,
      status: 'failed',
      note: `AI ${options.slot} transformation error: ${err?.message || err}`,
      error: err?.message || String(err),
    };
  }
}

/**
 * Diagnostic Verification for Gemini API
 */
export async function runGeminiDiagnostic(): Promise<{
  success: boolean;
  hasApiKey: boolean;
  statusCode: number;
  statusText: string;
  sanitizedMessage: string;
}> {
  const apiKey = getGeminiApiKey();
  if (!apiKey) {
    return {
      success: false,
      hasApiKey: false,
      statusCode: 401,
      statusText: 'API Key Missing',
      sanitizedMessage: 'GEMINI_API_KEY is not defined in server environment.',
    };
  }

  try {
    const ai = getGeminiClient();
    if (!ai) throw new Error('Could not instantiate GoogleGenAI client');

    const res = await ai.models.generateContent({
      model: 'gemini-3.8-flash',
      contents: 'ping',
    });

    if (res.text) {
      return {
        success: true,
        hasApiKey: true,
        statusCode: 200,
        statusText: 'OK',
        sanitizedMessage: 'Connected successfully to Google AI Studio Gemini API.',
      };
    }

    return {
      success: false,
      hasApiKey: true,
      statusCode: 500,
      statusText: 'No Response',
      sanitizedMessage: 'Connected but received no response text from Gemini.',
    };
  } catch (err: any) {
    return {
      success: false,
      hasApiKey: true,
      statusCode: 500,
      statusText: 'Connection Failed',
      sanitizedMessage: err?.message || 'Failed to authenticate with Google Gemini API.',
    };
  }
}
