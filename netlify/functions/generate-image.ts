import type { Handler, HandlerEvent } from '@netlify/functions';
import { runMultiCategoryTryOn } from './utils/multiCategoryPipeline';
import { createJob, updateJob } from './utils/jobs';

const defaultHeaders: Record<string, string> = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, x-hf-space-id, X-Hf-Space-Id',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

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

    const jobId = `job_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    createJob(jobId);

    // Extract staged garment assets
    const garmentList: Array<{ slot: string; dataUrl: string; name?: string }> = [];

    if (garments && typeof garments === 'object') {
      for (const [slotKey, garment] of Object.entries(garments as Record<string, any>)) {
        if (garment && garment.data) {
          garmentList.push({ slot: slotKey, dataUrl: garment.data, name: garment.name });
        }
      }
    }

    if (garmentList.length === 0) {
      return {
        statusCode: 400,
        headers: defaultHeaders,
        body: JSON.stringify({
          error: 'Please upload at least one garment image (Shirt/Top prioritized for virtual try-on).',
        }),
      };
    }

    // Determine garment description text for the pipeline
    // Priority: user custom prompt > specific top garment name > fallback generic description
    const customPrompt = customization.customPrompt?.trim();
    const topGarment = garmentList.find((g) => g.slot === 'top' || g.slot === 'shirt') || garmentList[0];
    const garmentDescription = customPrompt || topGarment.name || 'Fashion garment, natural fit';

    console.log(`[Generate-Image] Job ${jobId} initialized: ${garmentList.length} garments staged. Selected master: ${topGarment.name} (${topGarment.slot}) (Space: ${userSpaceId || 'default'})`);

    updateJob(jobId, {
      status: 'processing',
      stage: 'Connecting to Hugging Face ZeroGPU Space...',
    });

    const startTime = Date.now();

    // Execute genuine Multi-Category Virtual Styling Pipeline
    const tryOnResult = await runMultiCategoryTryOn({
      playerBase64: player.data,
      garmentList,
      customPrompt,
      spaceId: userSpaceId || undefined,
      onProgress: (info) => {
        updateJob(jobId, {
          status: 'processing',
          stage: info.stage,
          queuePosition: info.position,
          queueMessage: info.message,
          progress: info.progress,
        });
      },
    });

    const durationMs = Date.now() - startTime;
    console.log(`[Generate-Image] Job ${jobId} finished in ${durationMs}ms with success=${tryOnResult.success}`);

    if (!tryOnResult.success) {
      updateJob(jobId, {
        status: 'failed',
        error: tryOnResult.error,
        isQuotaExhausted: tryOnResult.isQuotaExhausted,
        isAuthError: tryOnResult.isAuthError,
        requiresCredentials: tryOnResult.requiresCredentials,
      });

      const statusCode = tryOnResult.isAuthError
        ? 401
        : tryOnResult.isQuotaExhausted
        ? 429
        : 500;

      return {
        statusCode,
        headers: defaultHeaders,
        body: JSON.stringify({
          error: tryOnResult.error,
          isQuotaExhausted: tryOnResult.isQuotaExhausted,
          isAuthError: tryOnResult.isAuthError,
          requiresCredentials: tryOnResult.requiresCredentials,
          spaceUsed: tryOnResult.spaceUsed,
          jobId,
        }),
      };
    }

    if (!tryOnResult.imageDataUrl) {
      updateJob(jobId, { status: 'failed', error: 'No try-on image returned from ZeroGPU space.' });
      return {
        statusCode: 500,
        headers: defaultHeaders,
        body: JSON.stringify({ error: 'No image was returned by Hugging Face ZeroGPU.', jobId }),
      };
    }

    const results = [
      {
        imageUrl: tryOnResult.imageDataUrl,
        index: 0,
        label: 'Virtual Try-On Look',
      },
    ];

    const jobResult = {
      images: results,
      primaryImage: results[0].imageUrl,
      maskedImage: tryOnResult.maskedImageDataUrl,
      mode,
      aspectRatio,
      warnings: tryOnResult.warnings,
      garmentStatus: tryOnResult.garmentStatus,
    };

    updateJob(jobId, {
      status: 'completed',
      result: jobResult,
    });

    return {
      statusCode: 200,
      headers: defaultHeaders,
      body: JSON.stringify({
        success: true,
        jobId,
        status: 'completed',
        ...jobResult,
      }),
    };
  } catch (err: any) {
    return {
      statusCode: 500,
      headers: defaultHeaders,
      body: JSON.stringify({ error: err?.message || 'Server error during virtual try-on processing.' }),
    };
  }
};
