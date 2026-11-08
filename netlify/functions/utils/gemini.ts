/**
 * Google Gemini AI Native Provider for MXM CREATOR
 * Uses the official Google Generative Language Developer API:
 * Endpoint: https://generativelanguage.googleapis.com/v1beta/models/{MODEL_NAME}:generateContent
 * Native Authentication Header: x-goog-api-key: process.env.GEMINI_API_KEY
 * 
 * Strict Authentication Rules:
 * - NO 'Authorization: Bearer' headers (which trigger ACCESS_TOKEN_TYPE_UNSUPPORTED).
 * - NO Vertex AI / OAuth mode.
 * - API key kept strictly server-side in Netlify Functions.
 */

export interface GeminiCredentials {
  apiKey: string;
  model: string;
}

export function cleanApiKey(raw?: string): string {
  if (!raw) return '';
  let key = raw.trim();
  // Strip enclosing quotes if present (e.g. from .env files or Netlify env copy-paste)
  if ((key.startsWith('"') && key.endsWith('"')) || (key.startsWith("'") && key.endsWith("'"))) {
    key = key.substring(1, key.length - 1).trim();
  }
  return key;
}

export function getGeminiConfig(): GeminiCredentials | null {
  // Read API key exclusively from GEMINI_API_KEY as strictly instructed.
  // Do not fall back to or allow conflicting GOOGLE_API_KEY to corrupt the credential.
  const apiKey = cleanApiKey(process.env.GEMINI_API_KEY);
  if (!apiKey) return null;

  // Make the image model configurable, defaulting to the free image editing model
  const model = cleanApiKey(process.env.GEMINI_IMAGE_MODEL) || 'gemini-3.1-flash-lite-image';
  return { apiKey, model };
}

// Helper to mask API key for safe debugging without leaking secrets
export function getMaskedApiKey(key: string): string {
  if (!key) return 'NOT_CONFIGURED';
  if (key.length <= 8) return '********';
  return `${key.substring(0, 4)}...${key.substring(key.length - 4)} (${key.length} chars)`;
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

/**
 * Execute image-to-image styling generation on official Gemini v1beta endpoint
 */
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
  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(modelToUse)}:generateContent`;

  try {
    const parts: any[] = [];

    // Part 1: Player Reference Photo (Primary Identity Source)
    const { data: playerData, mimeType: playerMime } = parseBase64Image(options.playerBase64);
    parts.push({
      inlineData: {
        mimeType: playerMime,
        data: playerData,
      },
    });

    // Parts 2..N: Uploaded Garment References
    if (options.garmentList && options.garmentList.length > 0) {
      for (const garment of options.garmentList) {
        if (garment && garment.dataUrl) {
          const { data: gData, mimeType: gMime } = parseBase64Image(garment.dataUrl);
          parts.push({
            inlineData: {
              mimeType: gMime,
              data: gData,
            },
          });
        }
      }
    }

    // Part N+1: Direct styling instruction prompt
    parts.push({
      text: options.prompt,
    });

    // Supported aspect ratios
    const validRatios = ['1:1', '3:4', '4:3', '9:16', '16:9'];
    const chosenRatio = validRatios.includes(options.aspectRatio || '') ? options.aspectRatio : '3:4';

    const requestBody = {
      contents: [
        {
          parts,
        },
      ],
      generationConfig: {
        imageConfig: {
          aspectRatio: chosenRatio,
        },
      },
    };

    // Official native Gemini API request:
    // Uses x-goog-api-key header exclusively.
    // NEVER sends 'Authorization: Bearer' which triggers 401 ACCESS_TOKEN_TYPE_UNSUPPORTED.
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-goog-api-key': config.apiKey,
        'User-Agent': 'aistudio-build',
      },
      body: JSON.stringify(requestBody),
    });

    const responseJson = await response.json();

    if (!response.ok) {
      const err = responseJson?.error;
      const status = response.status;
      const code = err?.code || status;
      const reason = err?.details?.[0]?.reason || err?.status || '';
      const message = err?.message || 'Gemini API call failed';

      // 401 / Authentication error handling
      if (status === 401 || reason === 'ACCESS_TOKEN_TYPE_UNSUPPORTED' || reason === 'CREDENTIALS_MISSING') {
        return {
          success: false,
          requiresCredentials: true,
          modelUsed: modelToUse,
          error: `Authentication failed (HTTP 401: ${reason || 'UNAUTHENTICATED'}). Ensure GEMINI_API_KEY is a valid Google AI Studio Developer Key.`,
        };
      }

      // 400 with API_KEY_INVALID
      if (status === 400 && (reason === 'API_KEY_INVALID' || message.includes('API key not valid'))) {
        return {
          success: false,
          requiresCredentials: true,
          modelUsed: modelToUse,
          error: 'The provided GEMINI_API_KEY is invalid. Please verify the key in your Netlify site configuration.',
        };
      }

      // 429 Quota Exceeded
      if (status === 429 || reason === 'RESOURCE_EXHAUSTED' || message.includes('quota') || message.includes('limit: 0')) {
        return {
          success: false,
          isQuotaExhausted: true,
          modelUsed: modelToUse,
          error: 'Google Gemini Free Tier request quota exceeded for this model. Quotas reset daily. Please wait for the daily quota reset or check your limits at https://aistudio.google.com/docs/rate-limits.',
        };
      }

      return {
        success: false,
        modelUsed: modelToUse,
        error: `Gemini API error (HTTP ${status}): ${message}`,
      };
    }

    // Inspect candidates for generated image part
    const candidate = responseJson?.candidates?.[0];
    const candidateParts = candidate?.content?.parts || [];

    for (const part of candidateParts) {
      const inlineData = part?.inlineData || part?.inline_data;
      if (inlineData?.data) {
        const base64 = inlineData.data;
        const mime = inlineData.mimeType || inlineData.mime_type || 'image/png';
        return {
          success: true,
          imageDataUrl: `data:${mime};base64,${base64}`,
          modelUsed: modelToUse,
        };
      }
    }

    // If candidate contains text explanation or safety refusal
    const textPart = candidateParts.find((p: any) => p?.text)?.text;
    return {
      success: false,
      modelUsed: modelToUse,
      error: textPart || 'The model processed the request but returned no image data.',
    };
  } catch (err: any) {
    return {
      success: false,
      modelUsed: modelToUse,
      error: `Network/connection error calling Gemini API: ${err?.message || err}`,
    };
  }
}

/**
 * Diagnostic Verification Function:
 * 1. Checks if GEMINI_API_KEY exists without revealing its value.
 * 2. Makes a real authenticated test request using x-goog-api-key to the official Gemini API.
 * 3. Does NOT generate an image (uses lightweight text ping to conserve quota).
 * 4. Returns safe, sanitized status details.
 */
export async function runGeminiDiagnostic(): Promise<{
  success: boolean;
  hasApiKey: boolean;
  maskedKey: string;
  statusCode: number;
  statusText: string;
  authMethod: string;
  endpointTested: string;
  modelTested: string;
  sanitizedMessage: string;
}> {
  const config = getGeminiConfig();
  const hasApiKey = Boolean(config?.apiKey);
  const maskedKey = config ? getMaskedApiKey(config.apiKey) : 'NOT_CONFIGURED';
  const testModel = 'gemini-3.8-flash';
  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${testModel}:generateContent`;

  if (!hasApiKey || !config) {
    return {
      success: false,
      hasApiKey: false,
      maskedKey,
      statusCode: 401,
      statusText: 'API Key Missing',
      authMethod: 'x-goog-api-key',
      endpointTested: endpoint,
      modelTested: testModel,
      sanitizedMessage: 'GEMINI_API_KEY is not defined in the server environment.',
    };
  }

  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-goog-api-key': config.apiKey,
        'User-Agent': 'aistudio-build',
      },
      body: JSON.stringify({
        contents: [
          {
            parts: [{ text: 'ping' }],
          },
        ],
        generationConfig: {
          maxOutputTokens: 2,
        },
      }),
    });

    const statusCode = response.status;
    const statusText = response.statusText;
    const bodyJson = await response.json().catch(() => null);

    if (response.ok) {
      return {
        success: true,
        hasApiKey: true,
        maskedKey,
        statusCode: 200,
        statusText: 'OK',
        authMethod: 'x-goog-api-key',
        endpointTested: endpoint,
        modelTested: testModel,
        sanitizedMessage: 'Authentication successful. Official Gemini Developer API connected using x-goog-api-key.',
      };
    }

    const err = bodyJson?.error;
    const reason = err?.details?.[0]?.reason || err?.status || 'UNKNOWN';
    const message = err?.message || statusText;

    let safeExplanation = `API returned HTTP ${statusCode}: ${reason}.`;
    if (statusCode === 401) {
      if (reason === 'ACCESS_TOKEN_TYPE_UNSUPPORTED') {
        safeExplanation = 'HTTP 401: ACCESS_TOKEN_TYPE_UNSUPPORTED. The configured key is not a standard Google AI Studio Developer API key (valid Gemini keys start with "AIzaSy..."). Please obtain a key from aistudio.google.com/app/apikey and configure GEMINI_API_KEY in Netlify.';
      } else {
        safeExplanation = `HTTP 401: Authentication failed (${reason}). Ensure GEMINI_API_KEY is an authorized Google AI Studio key.`;
      }
    } else if (statusCode === 400 && reason === 'API_KEY_INVALID') {
      safeExplanation = 'HTTP 400: API_KEY_INVALID. The provided API key is malformed or invalid.';
    } else if (statusCode === 429) {
      safeExplanation = 'HTTP 429: Free Tier quota limit reached. Connection and credentials are valid, but rate limit is active.';
    }

    return {
      success: false,
      hasApiKey: true,
      maskedKey,
      statusCode,
      statusText,
      authMethod: 'x-goog-api-key',
      endpointTested: endpoint,
      modelTested: testModel,
      sanitizedMessage: safeExplanation,
    };
  } catch (fetchErr: any) {
    return {
      success: false,
      hasApiKey: true,
      maskedKey,
      statusCode: 503,
      statusText: 'Connection Failed',
      authMethod: 'x-goog-api-key',
      endpointTested: endpoint,
      modelTested: testModel,
      sanitizedMessage: `Failed to connect to Google Generative Language endpoint: ${fetchErr?.message || fetchErr}`,
    };
  }
}

