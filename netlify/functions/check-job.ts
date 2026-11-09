import type { Handler, HandlerEvent } from '@netlify/functions';
import { getJob } from './utils/jobs';

const defaultHeaders: Record<string, string> = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
};

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

    return {
      statusCode: 200,
      headers: defaultHeaders,
      body: JSON.stringify({
        jobId: job.id,
        status: job.status,
        stage: job.stage,
        queuePosition: job.queuePosition,
        queueMessage: job.queueMessage,
        progress: job.progress,
        result: job.result,
        error: job.error,
        isQuotaExhausted: job.isQuotaExhausted,
        requiresCredentials: job.requiresCredentials,
        updatedAt: job.updatedAt,
      }),
    };
};
