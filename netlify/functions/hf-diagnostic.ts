import type { Handler } from '@netlify/functions';
import { handler as diagnosticHandler } from './gemini-diagnostic';

export const handler: Handler = async (event, context) => {
  const res = await diagnosticHandler(event, context);
  if (!res) {
    return {
      statusCode: 200,
      body: JSON.stringify({ success: true }),
    };
  }
  return res;
};
