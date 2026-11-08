import type { Handler, HandlerEvent } from '@netlify/functions';

const defaultHeaders: Record<string, string> = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

export const handler: Handler = async (event: HandlerEvent) => {
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
    const { image, options = {} } = JSON.parse(event.body || '{}');
    if (!image) {
      return {
        statusCode: 400,
        headers: defaultHeaders,
        body: JSON.stringify({ error: 'Missing image payload for processing.' }),
      };
    }

    return {
      statusCode: 200,
      headers: defaultHeaders,
      body: JSON.stringify({
        success: true,
        message: 'Image ready for high-resolution 32-bit alpha segmentation.',
        format: 'image/png',
        alphaChannel: true,
        tolerance: options.tolerance || 30,
        feather: options.feather || 2,
      }),
    };
  } catch (err: any) {
    return {
      statusCode: 500,
      headers: defaultHeaders,
      body: JSON.stringify({ error: err?.message || 'Failed to process image.' }),
    };
  }
};
