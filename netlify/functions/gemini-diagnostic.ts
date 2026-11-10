import type { Handler, HandlerEvent } from '@netlify/functions';
import { runGeminiDiagnostic } from './utils/gemini';

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
    const diagnostic = await runGeminiDiagnostic();
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
        error: 'Gemini diagnostic failed.',
        sanitizedMessage: err?.message || 'Internal server error running Gemini diagnostic.',
      }),
    };
  }
};
