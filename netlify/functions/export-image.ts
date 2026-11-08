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
    const { image, format = 'transparent_png', resolution = 2048, filename = 'mxm_look' } = JSON.parse(event.body || '{}');

    if (!image) {
      return {
        statusCode: 400,
        headers: defaultHeaders,
        body: JSON.stringify({ error: 'Missing image payload for export.' }),
      };
    }

    const mime = format.includes('png') ? 'image/png' : 'image/jpeg';
    const ext = format.includes('png') ? 'png' : 'jpg';

    return {
      statusCode: 200,
      headers: defaultHeaders,
      body: JSON.stringify({
        success: true,
        downloadName: `${filename}_${resolution}px.${ext}`,
        mimeType: mime,
        resolution,
        alphaPreserved: format.includes('png'),
      }),
    };
  } catch (err: any) {
    return {
      statusCode: 500,
      headers: defaultHeaders,
      body: JSON.stringify({ error: err?.message || 'Failed to prepare export.' }),
    };
  }
};
