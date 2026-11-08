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

    // Map diagnostic result to HTTP status code:
    // If the diagnostic succeeded, return 200.
    // If credentials are missing or unauthenticated, return 401.
    // If quota is exhausted, return 429.
    // Otherwise return diagnostic status code or 500.
    let responseStatus = 200;
    if (!diagnostic.success) {
      if (!diagnostic.hasApiKey || diagnostic.statusCode === 401) {
        responseStatus = 401;
      } else if (diagnostic.statusCode === 429) {
        responseStatus = 429;
      } else {
        responseStatus = diagnostic.statusCode >= 400 && diagnostic.statusCode < 600 ? diagnostic.statusCode : 500;
      }
    }

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
