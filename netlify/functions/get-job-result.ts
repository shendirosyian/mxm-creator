import type { Handler, HandlerEvent } from '@netlify/functions';
import { getJob } from './utils/jobStorage';

const defaultHeaders: Record<string, string> = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
};

/**
 * Result Retrieval Endpoint for MXM CREATOR.
 * Retrieves final high-resolution look images and category status for completed background jobs.
 */
export const handler: Handler = async (event: HandlerEvent) => {
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers: defaultHeaders,
      body: '',
    };
  }

  const jobId = event.queryStringParameters?.jobId ||
    (event.body ? JSON.parse(event.body)?.jobId : undefined);

  if (!jobId) {
    return {
      statusCode: 400,
      headers: defaultHeaders,
      body: JSON.stringify({ error: 'Missing jobId parameter.' }),
    };
  }

  const job = getJob(jobId);
  if (!job) {
    return {
      statusCode: 404,
      headers: defaultHeaders,
      body: JSON.stringify({ error: `Job ${jobId} not found or expired.` }),
    };
  }

  if (job.status === 'failed') {
    return {
      statusCode: job.isAuthError ? 401 : job.isQuotaExhausted ? 429 : 500,
      headers: defaultHeaders,
      body: JSON.stringify({
        jobId: job.id,
        status: 'failed',
        error: job.error || 'Generation failed.',
        isQuotaExhausted: job.isQuotaExhausted,
        isAuthError: job.isAuthError,
        requiresCredentials: job.requiresCredentials,
        spaceUsed: job.spaceUsed,
      }),
    };
  }

  if (job.status !== 'completed' || !job.result) {
    return {
      statusCode: 202,
      headers: defaultHeaders,
      body: JSON.stringify({
        jobId: job.id,
        status: job.status,
        stage: job.stage || 'Processing in background...',
        progress: job.progress || 0,
      }),
    };
  }

  return {
    statusCode: 200,
    headers: defaultHeaders,
    body: JSON.stringify({
      success: true,
      jobId: job.id,
      status: 'completed',
      ...job.result,
      spaceUsed: job.spaceUsed,
    }),
  };
};
