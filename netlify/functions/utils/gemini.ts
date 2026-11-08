/**
 * Google Gemini AI Provider for MXM CREATOR
 * Uses the official @google/genai SDK for image editing and virtual styling.
 * Default Model: gemini-3.1-flash-lite-image (configurable via GEMINI_IMAGE_MODEL)
 */

import { GoogleGenAI } from '@google/genai';

export interface GeminiCredentials {
  apiKey: string;
  model: string;
}

export function getGeminiConfig(): GeminiCredentials | null {
  const apiKey = process.env.GEMINI_API_KEY?.trim();
  if (!apiKey) return null;

  // Make the image model configurable, defaulting to the free image editing model
  const model = process.env.GEMINI_IMAGE_MODEL?.trim() || 'gemini-3.1-flash-lite-image';
  return { apiKey, model };
}

// Strip data URI prefix to get raw base64 data and mimeType
export function parseBase64Image(dataUriOrBase64: string): { data: string; mimeType: string } {
  if (dataUriOrBase64.startsWith('data:')) {
    const parts = dataUriOrBase64.split(';base64,');
    const mimeType = parts[0].replace('data:', '');
    return { data: parts[1], mimeType };
  }
  return { data: dataUriOrBase64, mimeType: 'image/jpeg' };
}

export interface RunGeminiStylingOptions {
  prompt: string;
  playerBase64: string;
  garmentList?: Array<{ slot: string; dataUrl: string; name?: string }>;
  aspectRatio?: string;
}

export async function runGeminiStyling(options: RunGeminiStylingOptions): Promise<{
  success: boolean;
  imageDataUrl?: string;
  error?: string;
  isQuotaExhausted?: boolean;
  requiresCredentials?: boolean;
  modelUsed?: string;
}> {
  const config = getGeminiConfig();
  if (!config) {
    return {
      success: false,
      requiresCredentials: true,
      error:
        'GEMINI_API_KEY is not configured. Please set GEMINI_API_KEY in your Netlify site settings (Site configuration > Environment variables) or in AI Studio Secrets.',
    };
  }

  const modelToUse = config.model;

  // Initialize official Google Gen AI client with User-Agent telemetry
  const ai = new GoogleGenAI({
    apiKey: config.apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });

  try {
    const parts: any[] = [];

    // Part 1: Player Reference Photo (Primary Identity Source)
    const { data: playerData, mimeType: playerMime } = parseBase64Image(options.playerBase64);
    parts.push({
      inlineData: {
        data: playerData,
        mimeType: playerMime,
      },
    });

    // Parts 2..N: Uploaded Garment References
    if (options.garmentList && options.garmentList.length > 0) {
      for (const garment of options.garmentList) {
        if (garment && garment.dataUrl) {
          const { data: gData, mimeType: gMime } = parseBase64Image(garment.dataUrl);
          parts.push({
            inlineData: {
              data: gData,
              mimeType: gMime,
            },
          });
        }
      }
    }

    // Part N+1: Instruction prompt
    parts.push({
      text: options.prompt,
    });

    // Supported aspect ratios
    const validRatios = ['1:1', '3:4', '4:3', '9:16', '16:9'];
    const chosenRatio = validRatios.includes(options.aspectRatio || '') ? options.aspectRatio : '3:4';

    const response = await ai.models.generateContent({
      model: modelToUse,
      contents: { parts },
      config: {
        imageConfig: {
          aspectRatio: chosenRatio as any,
        },
      },
    });

    // Iterate parts to locate generated image
    for (const part of response.candidates?.[0]?.content?.parts ?? []) {
      if (part.inlineData?.data) {
        const base64 = part.inlineData.data;
        const mime = part.inlineData.mimeType || 'image/png';
        return {
          success: true,
          imageDataUrl: `data:${mime};base64,${base64}`,
          modelUsed: modelToUse,
        };
      }
    }

    // If model returned text instead of image (e.g. refusal or safety filter)
    const textPart = response.candidates?.[0]?.content?.parts?.find((p) => p.text)?.text;
    return {
      success: false,
      error: textPart || 'The Gemini model completed the request but did not return image data.',
      modelUsed: modelToUse,
    };
  } catch (err: any) {
    const errorStr = String(err?.message || err);
    const isQuota =
      err?.status === 'RESOURCE_EXHAUSTED' ||
      err?.status === 429 ||
      err?.code === 429 ||
      errorStr.includes('RESOURCE_EXHAUSTED') ||
      errorStr.includes('quota') ||
      errorStr.includes('limit: 0');

    if (isQuota) {
      return {
        success: false,
        isQuotaExhausted: true,
        modelUsed: modelToUse,
        error:
          'Google Gemini Free Tier request quota exceeded for this model. Please wait for the daily quota reset or check your rate limits at https://aistudio.google.com/docs/rate-limits.',
      };
    }

    const isAuth =
      err?.status === 400 ||
      err?.status === 403 ||
      errorStr.includes('API_KEY_INVALID') ||
      errorStr.includes('PERMISSION_DENIED');

    if (isAuth) {
      return {
        success: false,
        requiresCredentials: true,
        modelUsed: modelToUse,
        error:
          'Invalid or unauthorized GEMINI_API_KEY. Please verify your Gemini API key in Netlify environment variables or AI Studio Secrets.',
      };
    }

    return {
      success: false,
      modelUsed: modelToUse,
      error: `Gemini API image generation failed: ${err?.message || err}`,
    };
  }
}
