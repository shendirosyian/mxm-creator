import type { Handler, HandlerEvent } from '@netlify/functions';
import { runHfDiagnostic } from './utils/huggingface';

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

  try {
    const diagnostic = await runHfDiagnostic();
    const responseStatus = diagnostic.statusCode || (diagnostic.success ? 200 : 503);

    return {
      statusCode: responseStatus,
      headers: defaultHeaders,
      body: JSON.stringify({
        ...diagnostic,
        timestamp: new Date().toISOString(),
      }),
    };
  } catch (err: any) {
    return {
      statusCode: 500,
      headers: defaultHeaders,
      body: JSON.stringify({
        success: false,
        error: 'Diagnostic failed to run.',
        sanitizedMessage: err?.message || 'Internal server error running diagnostic.',
      }),
    };
  }
};
