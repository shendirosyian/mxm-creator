import type { Handler, HandlerEvent } from '@netlify/functions';
import { runMultiCategoryTryOn } from './utils/multiCategoryPipeline';
import { getJob, updateJob, getJobInput, saveJobResult, cleanupJobInputs } from './utils/jobStorage';

const defaultHeaders: Record<string, string> = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

/**
 * Netlify Background Function for Long-Running Virtual Try-On.
 * Naming convention `*-background.ts` enables 15-minute execution limit on Netlify.
 * 
 * Payload Constraint Enforced:
 * Receives ONLY lightweight `{ jobId }` (< 1KB), strictly conforming to Netlify's 256 KB background payload ceiling.
 * Actual heavy Base64 images are loaded from private temporary server storage.
 */
export const handler: Handler = async (event: HandlerEvent) => {
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers: defaultHeaders,
      body: '',
    };
  }

  let jobId: string | undefined;

  try {
    const payload = JSON.parse(event.body || '{}');
    jobId = payload.jobId;
  } catch {
    jobId = event.queryStringParameters?.jobId;
  }

  if (!jobId) {
    console.error('[Background-TryOn] Missing jobId parameter in invocation.');
    return {
      statusCode: 400,
      headers: defaultHeaders,
      body: JSON.stringify({ error: 'Missing jobId in background payload.' }),
    };
  }

  const job = getJob(jobId);
  if (!job) {
    console.error(`[Background-TryOn] Job ${jobId} not found in storage.`);
    return {
      statusCode: 404,
      headers: defaultHeaders,
      body: JSON.stringify({ error: `Job ${jobId} not found.` }),
    };
  }

  // Idempotency: Skip execution if already processing or completed
  if (job.status === 'completed') {
    console.log(`[Background-TryOn] Job ${jobId} is already completed. Skipping.`);
    return {
      statusCode: 200,
      headers: defaultHeaders,
      body: JSON.stringify({ success: true, message: 'Job already completed.' }),
    };
  }

  if (job.status === 'processing' && Date.now() - job.updatedAt < 60000) {
    console.log(`[Background-TryOn] Job ${jobId} is actively being processed by another worker. Skipping.`);
    return {
      statusCode: 200,
      headers: defaultHeaders,
      body: JSON.stringify({ success: true, message: 'Job already in progress.' }),
    };
  }

  // Retrieve stored image references from private temporary storage
  const jobInput = getJobInput(jobId);
  if (!jobInput || !jobInput.player || !jobInput.player.data) {
    updateJob(jobId, {
      status: 'failed',
      error: 'Stored image data was expired or unreadable in server temporary storage.',
    });
    cleanupJobInputs(jobId);
    return {
      statusCode: 400,
      headers: defaultHeaders,
      body: JSON.stringify({ error: 'Stored job input not found.' }),
    };
  }

  console.log(`[Background-TryOn] Starting execution for job ${jobId}...`);

  updateJob(jobId, {
    status: 'processing',
    stage: 'Connecting to Hugging Face ZeroGPU Space...',
    progress: 0.1,
  });

  try {
    const garmentList: Array<{ slot: string; dataUrl: string; name?: string }> = [];

    if (jobInput.garments && typeof jobInput.garments === 'object') {
      for (const [slotKey, garment] of Object.entries(jobInput.garments)) {
        if (garment && garment.data) {
          garmentList.push({
            slot: slotKey,
            dataUrl: garment.data,
            name: garment.name,
          });
        }
      }
    }

    const customPrompt = jobInput.customization?.customPrompt?.trim();
    const startTime = Date.now();

    // Execute Multi-Category Virtual Styling Pipeline
    const tryOnResult = await runMultiCategoryTryOn({
      playerBase64: jobInput.player.data,
      garmentList,
      customPrompt,
      spaceId: jobInput.spaceId,
      onProgress: (info) => {
        updateJob(jobId!, {
          status: 'processing',
          stage: info.stage,
          queuePosition: info.position,
          queueMessage: info.message,
          progress: info.progress,
        });
      },
    });

    const durationMs = Date.now() - startTime;
    console.log(`[Background-TryOn] Pipeline finished for job ${jobId} in ${durationMs}ms with success=${tryOnResult.success}`);

    if (!tryOnResult.success) {
      updateJob(jobId, {
        status: 'failed',
        error: tryOnResult.error || 'Virtual Try-On generation failed.',
        isQuotaExhausted: tryOnResult.isQuotaExhausted,
        isAuthError: tryOnResult.isAuthError,
        requiresCredentials: tryOnResult.requiresCredentials,
        spaceUsed: tryOnResult.spaceUsed,
      });
      cleanupJobInputs(jobId);

      return {
        statusCode: 200,
        headers: defaultHeaders,
        body: JSON.stringify({ success: false, error: tryOnResult.error }),
      };
    }

    if (!tryOnResult.imageDataUrl) {
      updateJob(jobId, {
        status: 'failed',
        error: 'No image data returned from Hugging Face ZeroGPU space.',
      });
      cleanupJobInputs(jobId);

      return {
        statusCode: 200,
        headers: defaultHeaders,
        body: JSON.stringify({ success: false, error: 'Empty output from model.' }),
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
      mode: jobInput.mode || 'REALISTIC',
      aspectRatio: jobInput.aspectRatio || '3:4',
      warnings: tryOnResult.warnings,
      garmentStatus: tryOnResult.garmentStatus,
    };

    saveJobResult(jobId, jobResult, tryOnResult.spaceUsed);

    return {
      statusCode: 200,
      headers: defaultHeaders,
      body: JSON.stringify({ success: true, jobId, status: 'completed' }),
    };
  } catch (err: any) {
    console.error(`[Background-TryOn] Unhandled exception for job ${jobId}:`, err);

    updateJob(jobId, {
      status: 'failed',
      error: err?.message || 'Server error during background virtual try-on.',
    });
    cleanupJobInputs(jobId);

    return {
      statusCode: 500,
      headers: defaultHeaders,
      body: JSON.stringify({ error: err?.message || 'Internal background worker failure.' }),
    };
  }
};
