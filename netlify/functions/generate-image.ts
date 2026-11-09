import type { Handler, HandlerEvent } from '@netlify/functions';
import { createAndStoreJob } from './utils/jobStorage';
import { handler as backgroundHandler } from './generate-image-background';

const defaultHeaders: Record<string, string> = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, x-hf-space-id, X-Hf-Space-Id',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

/**
 * Job Creation & Asset Staging Endpoint for MXM CREATOR.
 * 
 * Asynchronous Architecture (Eliminates HTTP 504 Gateway Timeout):
 * 1. Accepts full-resolution player photo and garment references.
 * 2. Writes heavy images to private temporary server storage.
 * 3. Dispatches background worker with lightweight `{ jobId }` payload (< 1KB).
 * 4. Returns HTTP 202 Accepted immediately with unique jobId.
 */
export const handler: Handler = async (event: HandlerEvent) => {
  // CORS preflight
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers: defaultHeaders,
      body: '',
    };
  }

  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers: defaultHeaders,
      body: JSON.stringify({ error: 'Method Not Allowed. Use POST.' }),
    };
  }

  try {
    const payload = JSON.parse(event.body || '{}');
    const {
      player,
      garments,
      customization = {},
      mode = 'REALISTIC',
      aspectRatio = '3:4',
      spaceId,
    } = payload;

    const userSpaceId = (
      (event.headers?.['x-hf-space-id'] as string) ||
      (event.headers?.['X-Hf-Space-Id'] as string) ||
      spaceId ||
      ''
    )?.trim();

    if (!player || !player.data) {
      return {
        statusCode: 400,
        headers: defaultHeaders,
        body: JSON.stringify({ error: 'Player photo reference is mandatory.' }),
      };
    }

    // Validate that at least one garment has been staged
    let hasGarment = false;
    if (garments && typeof garments === 'object') {
      for (const garment of Object.values(garments as Record<string, any>)) {
        if (garment && garment.data) {
          hasGarment = true;
          break;
        }
      }
    }

    if (!hasGarment) {
      return {
        statusCode: 400,
        headers: defaultHeaders,
        body: JSON.stringify({
          error: 'Please upload at least one garment image (Shirt/Top prioritized for virtual try-on).',
        }),
      };
    }

    // 1. Generate unique, collision-resistant job ID
    const jobId = `job_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;

    // 2. Persist heavy Base64 payload to private temporary server storage
    createAndStoreJob(jobId, {
      player,
      garments: garments || {},
      customization,
      mode,
      aspectRatio,
      spaceId: userSpaceId || undefined,
    });

    console.log(`[Job Creation] Job ${jobId} created and staged to server temporary storage. Triggering background worker...`);

    // 3. Trigger Netlify Background Worker with minimal payload (< 1KB)
    // Attempt HTTP trigger for Netlify Background Functions infrastructure
    const host = event.headers?.host || event.headers?.Host;
    const proto = event.headers?.['x-forwarded-proto'] || 'https';
    if (host) {
      const backgroundUrl = `${proto}://${host}/.netlify/functions/generate-image-background`;
      fetch(backgroundUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jobId }),
      }).catch((fetchErr) => {
        // Non-blocking trigger notice (fallback in-process runner ensures execution)
        console.warn(`[Job Creation] Remote background trigger notice for ${jobId}:`, fetchErr?.message || fetchErr);
      });
    }

    // In-process asynchronous dispatch to ensure job execution in all runtimes (local dev server, Node, etc.)
    setImmediate(async () => {
      try {
        await backgroundHandler(
          {
            httpMethod: 'POST',
            headers: defaultHeaders,
            body: JSON.stringify({ jobId }),
          } as HandlerEvent,
          {} as any
        );
      } catch (bgErr: any) {
        console.error(`[Job Creation] In-process background handler error for ${jobId}:`, bgErr?.message || bgErr);
      }
    });

    // 4. Return HTTP 202 Accepted immediately to client
    return {
      statusCode: 202,
      headers: defaultHeaders,
      body: JSON.stringify({
        success: true,
        jobId,
        status: 'queued',
        stage: 'Queued for background virtual try-on...',
        message: 'Job created. Background processing initiated.',
      }),
    };
  } catch (err: any) {
    console.error('[Job Creation Error]', err);
    return {
      statusCode: 500,
      headers: defaultHeaders,
      body: JSON.stringify({ error: err?.message || 'Server error creating virtual try-on job.' }),
    };
  }
};
