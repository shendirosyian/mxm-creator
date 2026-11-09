/**
 * Hugging Face ZeroGPU Virtual Try-On Provider for MXM CREATOR
 * Uses the official Gradio Client (@gradio/client) to connect to:
 * Space: Nymbo/Virtual-Try-On (ZeroGPU A10G)
 * Endpoint: /tryon
 * 
 * Strict Architecture:
 * - Server-side only proxy (Netlify Functions).
 * - Genuine AI Virtual Try-On replacing text-to-image synthesis.
 * - Person photo and Garment photo passed as distinct image inputs.
 * - Preserves facial identity, body pose, and garment textures.
 * - Secure token handling: HF_TOKEN never exposed to client.
 */

import { Client, handle_file } from '@gradio/client';

export interface HfCredentials {
  token?: string;
  spaceId: string;
}

export function getHfConfig(): HfCredentials {
  const token = (
    process.env.HF_TOKEN ||
    process.env.HUGGINGFACE_API_KEY ||
    process.env.HUGGING_FACE_HUB_TOKEN
  )?.trim();

  const spaceId = process.env.HF_SPACE_ID?.trim() || 'Nymbo/Virtual-Try-On';
  return { token: token || undefined, spaceId };
}

export function getMaskedHfToken(token?: string): string {
  if (!token) return 'ANONYMOUS (Public Space Access)';
  if (token.length <= 8) return '********';
  return `${token.substring(0, 4)}...${token.substring(token.length - 4)} (${token.length} chars)`;
}

export function parseDataUrl(dataUriOrBase64: string): { buffer: Buffer; mimeType: string } {
  if (dataUriOrBase64.startsWith('data:')) {
    const parts = dataUriOrBase64.split(';base64,');
    const mimeType = parts[0].replace('data:', '') || 'image/png';
    const buffer = Buffer.from(parts[1], 'base64');
    return { buffer, mimeType };
  }
  const buffer = Buffer.from(dataUriOrBase64, 'base64');
  return { buffer, mimeType: 'image/jpeg' };
}

export function bufferToBlob(buffer: Buffer, mimeType: string): Blob {
  return new Blob([new Uint8Array(buffer)], { type: mimeType });
}

export interface RunTryOnOptions {
  playerBase64: string;
  garmentList: Array<{ slot: string; dataUrl: string; name?: string }>;
  garmentDescription?: string;
  onProgress?: (info: { stage: string; position?: number; message?: string; progress?: number }) => void;
}

export interface TryOnResult {
  success: boolean;
  imageDataUrl?: string;
  maskedImageDataUrl?: string;
  error?: string;
  isQuotaExhausted?: boolean;
  requiresCredentials?: boolean;
  spaceUsed?: string;
  queuePosition?: number;
}

/**
 * Execute real AI Virtual Try-On on Hugging Face ZeroGPU Space (Nymbo/Virtual-Try-On)
 */
export async function runVirtualTryOn(options: RunTryOnOptions): Promise<TryOnResult> {
  const config = getHfConfig();
  const spaceId = config.spaceId;

  if (!options.playerBase64) {
    return {
      success: false,
      error: 'Missing human person reference photo.',
      spaceUsed: spaceId,
    };
  }

  // Prioritize Upper Body / TOP garment slot as per rule 9
  let selectedGarment = options.garmentList.find((g) => g.slot === 'shirt' && g.dataUrl);
  if (!selectedGarment && options.garmentList.length > 0) {
    selectedGarment = options.garmentList.find((g) => Boolean(g.dataUrl));
  }

  if (!selectedGarment || !selectedGarment.dataUrl) {
    return {
      success: false,
      error: 'No garment photo uploaded. Please upload a garment reference (prioritized: Shirt/Top).',
      spaceUsed: spaceId,
    };
  }

  try {
    // 1. Connect to Hugging Face Gradio Space
    const connectOptions: any = {};
    if (config.token) {
      connectOptions.hf_token = config.token;
    }

    const app = await Client.connect(spaceId, connectOptions);

    // 2. Prepare Person image for Gradio ImageEditor component:
    // dict: { background: FileData, layers: [], composite: null }
    const { buffer: playerBuf, mimeType: playerMime } = parseDataUrl(options.playerBase64);
    const playerBlob = bufferToBlob(playerBuf, playerMime);
    const humanEditorInput = {
      background: handle_file(playerBlob),
      layers: [],
      composite: null,
    };

    // 3. Prepare Garment image for Gradio Image component
    const { buffer: garmentBuf, mimeType: garmentMime } = parseDataUrl(selectedGarment.dataUrl);
    const garmentBlob = bufferToBlob(garmentBuf, garmentMime);
    const garmentInput = handle_file(garmentBlob);

    // 4. Garment textual description
    const garmentDes =
      options.garmentDescription?.trim() ||
      selectedGarment.name ||
      'Fashion upper body garment, natural fit';

    // 5. Submit to /tryon endpoint with exact schema:
    // [dict, garm_img, garment_des, is_checked (auto mask), is_checked_crop, denoise_steps, seed]
    const payload = [
      humanEditorInput,
      garmentInput,
      garmentDes,
      true,  // is_checked: true (Auto-generate upper-body mask using OpenPose + SCHP)
      false, // is_checked_crop: false (Preserve full image framing and aspect ratio)
      30,    // denoise_steps: 30
      42,    // seed
    ];

    const job = app.submit('/tryon', payload as any);

    let finalData: any = null;

    for await (const msg of job) {
      if (msg.type === 'status') {
        const stage = msg.stage || 'processing';
        const position = (msg as any).position;
        const message = (msg as any).message || '';
        const progress = (msg as any).progress_data?.[0]?.progress;

        if (options.onProgress) {
          options.onProgress({ stage, position, message, progress });
        }
      } else if (msg.type === 'data') {
        finalData = msg.data;
        break;
      }
    }

    if (!finalData || !Array.isArray(finalData) || finalData.length === 0) {
      return {
        success: false,
        error: 'Virtual Try-On finished without returning output image data.',
        spaceUsed: spaceId,
      };
    }

    // Output 0: Try-On Result image (Gradio FileData object with url/path)
    const primaryFile = finalData[0];
    const maskedFile = finalData[1];

    let resultImageUrl = typeof primaryFile === 'string' ? primaryFile : primaryFile?.url || primaryFile?.path;
    let maskedImageUrl = typeof maskedFile === 'string' ? maskedFile : maskedFile?.url || maskedFile?.path;

    if (!resultImageUrl) {
      return {
        success: false,
        error: 'Virtual Try-On completed but no image URL was found in the response.',
        spaceUsed: spaceId,
      };
    }

    // Download the resulting image and convert to data URI for seamless client display & local segmentation
    let imageDataUrl = resultImageUrl;
    if (resultImageUrl.startsWith('http://') || resultImageUrl.startsWith('https://')) {
      const imgResp = await fetch(resultImageUrl);
      if (imgResp.ok) {
        const arrayBuf = await imgResp.arrayBuffer();
        const base64 = Buffer.from(arrayBuf).toString('base64');
        const cType = imgResp.headers.get('content-type') || 'image/png';
        imageDataUrl = `data:${cType};base64,${base64}`;
      }
    }

    let maskedDataUrl: string | undefined = undefined;
    if (maskedImageUrl && (maskedImageUrl.startsWith('http://') || maskedImageUrl.startsWith('https://'))) {
      try {
        const maskResp = await fetch(maskedImageUrl);
        if (maskResp.ok) {
          const mBuf = await maskResp.arrayBuffer();
          maskedDataUrl = `data:image/png;base64,${Buffer.from(mBuf).toString('base64')}`;
        }
      } catch {
        // non-fatal
      }
    }

    return {
      success: true,
      imageDataUrl,
      maskedImageDataUrl: maskedDataUrl,
      spaceUsed: spaceId,
    };
  } catch (err: any) {
    const errorStr = String(err?.message || err);

    // Detect Hugging Face ZeroGPU quota / rate limit conditions
    const isZeroGpuQuota =
      errorStr.includes('GPU quota exceeded') ||
      errorStr.includes('quota') ||
      errorStr.includes('ZeroGPU') ||
      errorStr.includes('Rate limit') ||
      errorStr.includes('429');

    if (isZeroGpuQuota) {
      return {
        success: false,
        isQuotaExhausted: true,
        spaceUsed: spaceId,
        error:
          'Hugging Face ZeroGPU compute quota reached for this session. Please wait for the ZeroGPU window to refresh, or set a personal HF_TOKEN in Netlify environment variables.',
      };
    }

    return {
      success: false,
      spaceUsed: spaceId,
      error: `Virtual Try-On failed on Hugging Face: ${errorStr}`,
    };
  }
}

/**
 * Diagnostic Verification Function:
 * 1. Connects to Hugging Face Space (Nymbo/Virtual-Try-On).
 * 2. Verifies API availability (/tryon endpoint).
 * 3. Inspects token configuration without revealing secrets.
 * 4. Never generates an image during diagnostic test.
 */
export async function runHfDiagnostic(): Promise<{
  success: boolean;
  statusCode: number;
  statusText: string;
  spaceId: string;
  hasHfToken: boolean;
  maskedToken: string;
  hardware: string;
  stage: string;
  sanitizedMessage: string;
  endpointsFound: string[];
}> {
  const config = getHfConfig();
  const spaceId = config.spaceId;
  const hasHfToken = Boolean(config.token);
  const maskedToken = getMaskedHfToken(config.token);

  try {
    // 1. Check Space status via official Hugging Face Spaces API
    const spaceApiResp = await fetch(`https://huggingface.co/api/spaces/${spaceId}`, {
      headers: config.token ? { Authorization: `Bearer ${config.token}` } : {},
    });

    let hardware = 'zero-a10g (ZeroGPU)';
    let stage = 'RUNNING';

    if (spaceApiResp.ok) {
      const spaceData = await spaceApiResp.json();
      stage = spaceData?.runtime?.stage || 'RUNNING';
      hardware = spaceData?.runtime?.hardware?.current || 'zero-a10g';
    }

    // 2. Connect via Gradio Client to test endpoint connectivity
    const connectOptions: any = {};
    if (config.token) {
      connectOptions.hf_token = config.token;
    }

    const app = await Client.connect(spaceId, connectOptions);
    const apiInfo: any = await app.view_api();
    const endpoints = Object.keys(apiInfo?.named_endpoints || {});

    const hasTryon = endpoints.includes('/tryon');

    if (!hasTryon) {
      return {
        success: false,
        statusCode: 502,
        statusText: 'Endpoint Missing',
        spaceId,
        hasHfToken,
        maskedToken,
        hardware,
        stage,
        endpointsFound: endpoints,
        sanitizedMessage: `Connected to Space ${spaceId}, but required /tryon endpoint was not found.`,
      };
    }

    return {
      success: true,
      statusCode: 200,
      statusText: 'OK',
      spaceId,
      hasHfToken,
      maskedToken,
      hardware,
      stage,
      endpointsFound: endpoints,
      sanitizedMessage: `Connected successfully to ${spaceId} (${hardware}). AI Virtual Try-On pipeline ready.`,
    };
  } catch (err: any) {
    const errorStr = String(err?.message || err);
    return {
      success: false,
      statusCode: 503,
      statusText: 'Connection Error',
      spaceId,
      hasHfToken,
      maskedToken,
      hardware: 'zero-a10g',
      stage: 'UNKNOWN',
      endpointsFound: [],
      sanitizedMessage: `Failed to connect to Hugging Face Space: ${errorStr}`,
    };
  }
}
