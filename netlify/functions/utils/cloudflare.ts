/**
 * Cloudflare Workers AI Provider for MXM CREATOR
 * Model: @cf/black-forest-labs/flux-2-klein-4b
 *
 * Uses ultra-fast 4-step distilled FLUX.2 image model with multipart/form-data.
 */

export interface CloudflareCredentials {
  accountId: string;
  apiToken: string;
}

export function getCloudflareCredentials(): CloudflareCredentials | null {
  const accountId = process.env.CLOUDFLARE_ACCOUNT_ID?.trim();
  const apiToken = process.env.CLOUDFLARE_API_TOKEN?.trim();

  if (!accountId || !apiToken) {
    return null;
  }
  return { accountId, apiToken };
}

// Convert base64 / data URL string to Buffer and mime type
export function parseBase64Image(dataUriOrBase64: string): { buffer: Buffer; mimeType: string } {
  if (dataUriOrBase64.startsWith('data:')) {
    const parts = dataUriOrBase64.split(';base64,');
    const mimeType = parts[0].replace('data:', '');
    const buffer = Buffer.from(parts[1], 'base64');
    return { buffer, mimeType };
  }
  return { buffer: Buffer.from(dataUriOrBase64, 'base64'), mimeType: 'image/jpeg' };
}

export interface RunFluxOptions {
  prompt: string;
  playerBase64?: string;
  garmentBase64List?: Array<{ slot: string; dataUrl: string }>;
  width?: number;
  height?: number;
  steps?: number;
}

export async function runCloudflareFlux(options: RunFluxOptions): Promise<{
  success: boolean;
  imageDataUrl?: string;
  error?: string;
  isQuotaExhausted?: boolean;
  requiresCredentials?: boolean;
}> {
  const creds = getCloudflareCredentials();
  if (!creds) {
    return {
      success: false,
      requiresCredentials: true,
      error:
        'Cloudflare Workers AI credentials missing. Please configure CLOUDFLARE_ACCOUNT_ID and CLOUDFLARE_API_TOKEN in your Netlify environment variables or .env file.',
    };
  }

  const endpoint = `https://api.cloudflare.com/client/v4/accounts/${creds.accountId}/ai/run/@cf/black-forest-labs/flux-2-klein-4b`;

  try {
    const formData = new FormData();
    formData.append('prompt', options.prompt);
    formData.append('width', String(options.width || 1024));
    formData.append('height', String(options.height || 1024));

    // Append primary player image if provided
    if (options.playerBase64) {
      const { buffer, mimeType } = parseBase64Image(options.playerBase64);
      const blob = new Blob([new Uint8Array(buffer)], { type: mimeType });
      formData.append('image', blob, 'player_reference.jpg');
    }

    // Append garment images if provided (supports up to 4 images)
    if (options.garmentBase64List && options.garmentBase64List.length > 0) {
      options.garmentBase64List.slice(0, 3).forEach((item, idx) => {
        try {
          const { buffer, mimeType } = parseBase64Image(item.dataUrl);
          const blob = new Blob([new Uint8Array(buffer)], { type: mimeType });
          formData.append(`image_${idx + 1}`, blob, `garment_${item.slot}.jpg`);
        } catch {
          // ignore non-critical parsing error on optional garment
        }
      });
    }

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${creds.apiToken}`,
      },
      body: formData,
    });

    if (response.status === 429) {
      return {
        success: false,
        isQuotaExhausted: true,
        error:
          'Cloudflare Workers AI free allocation quota reached. Please wait a few moments before retrying.',
      };
    }

    if (response.status === 401 || response.status === 403) {
      return {
        success: false,
        requiresCredentials: true,
        error:
          'Invalid Cloudflare API token or unauthorized account ID. Please verify your Cloudflare credentials.',
      };
    }

    if (!response.ok) {
      let errorDetail = `Cloudflare HTTP ${response.status}`;
      try {
        const errJson = await response.json();
        errorDetail = errJson?.errors?.[0]?.message || errJson?.messages?.[0] || JSON.stringify(errJson);
      } catch {
        errorDetail = await response.text();
      }

      const isQuota =
        response.status === 429 ||
        errorDetail.toLowerCase().includes('quota') ||
        errorDetail.toLowerCase().includes('rate limit');

      return {
        success: false,
        isQuotaExhausted: isQuota,
        error: `Cloudflare Workers AI generation failed: ${errorDetail}`,
      };
    }

    // Cloudflare returns binary image (JPEG/PNG) or JSON
    const contentType = response.headers.get('content-type') || '';

    if (contentType.includes('image/')) {
      const arrayBuffer = await response.arrayBuffer();
      const base64 = Buffer.from(arrayBuffer).toString('base64');
      const mime = contentType.split(';')[0] || 'image/jpeg';
      return {
        success: true,
        imageDataUrl: `data:${mime};base64,${base64}`,
      };
    }

    // If returned JSON
    const data = await response.json();
    if (data.result?.image) {
      return {
        success: true,
        imageDataUrl: `data:image/jpeg;base64,${data.result.image}`,
      };
    }

    return {
      success: false,
      error: 'Unexpected response format from Cloudflare Workers AI.',
    };
  } catch (err: any) {
    return {
      success: false,
      error: `Network error connecting to Cloudflare Workers AI: ${err?.message || err}`,
    };
  }
}
