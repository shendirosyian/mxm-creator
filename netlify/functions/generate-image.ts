import type { Handler, HandlerEvent } from '@netlify/functions';
import { runCloudflareFlux } from './utils/cloudflare';
import { createJob, updateJob } from './utils/jobs';

const defaultHeaders: Record<string, string> = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
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
      variationsCount = 1,
    } = payload;

    if (!player || !player.data) {
      return {
        statusCode: 400,
        headers: defaultHeaders,
        body: JSON.stringify({ error: 'Player photo reference is mandatory.' }),
      };
    }

    const jobId = `job_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    createJob(jobId);

    // Build prompt
    const garmentDescriptions: string[] = [];
    const garmentList: Array<{ slot: string; dataUrl: string }> = [];

    if (garments && typeof garments === 'object') {
      for (const [slotKey, garment] of Object.entries(garments as Record<string, any>)) {
        if (garment && garment.data) {
          const slotLabel = slotKey.toUpperCase();
          garmentDescriptions.push(
            `Fit and drape the ${slotLabel} (${garment.name || 'garment'}) realistically on the model, preserving its fabric drape, seams, and visible graphics.`
          );
          garmentList.push({ slot: slotKey, dataUrl: garment.data });
        }
      }
    }

    const colorInstructions: string[] = [];
    if (customization.colors?.shirt) colorInstructions.push(`Shirt color: ${customization.colors.shirt}`);
    if (customization.colors?.pants) colorInstructions.push(`Pants color: ${customization.colors.pants}`);
    if (customization.colors?.shoes) colorInstructions.push(`Shoes color: ${customization.colors.shoes}`);
    if (customization.colors?.accessories) colorInstructions.push(`Accessories color: ${customization.colors.accessories}`);

    let styleAtmosphere = 'Photorealistic commercial lookbook, natural skin texture, realistic cloth wrinkles and draping.';
    if (mode === 'STUDIO') {
      styleAtmosphere = 'High-end studio fashion photography, controlled softbox lighting, clean studio background, crisp focus.';
    } else if (mode === 'CREATIVE') {
      styleAtmosphere = 'Editorial high-fashion styling, contemporary aesthetic, rich tonal depth, preserving original facial identity.';
    }

    const customPrompt = customization.customPrompt?.trim();
    const faceText = customization.faceExpression && customization.faceExpression !== 'Original'
      ? `Facial expression: ${customization.faceExpression}. Maintain recognizable facial structure and eyes.`
      : 'Maintain the exact recognizable facial identity and expression of the model.';

    const hairText = customization.hairStyle && customization.hairStyle !== 'Original'
      ? `Hairstyle: ${customization.hairStyle}${customization.hairColor ? ` in ${customization.hairColor}` : ''}.`
      : 'Preserve original natural hairstyle and hair color.';

    const poseText = customization.pose && customization.pose !== 'Original'
      ? `Subject pose: ${customization.pose}.`
      : 'Preserve the natural posture of the model.';

    const prompt = `
Photographic virtual fashion transformation of the person in the reference image.
${garmentDescriptions.length > 0 ? garmentDescriptions.join(' ') : 'Fit the specified stylish outfit naturally onto the person.'}
Atmosphere: ${styleAtmosphere}
${faceText}
${hairText}
${poseText}
${colorInstructions.length > 0 ? `Colors: ${colorInstructions.join(', ')}.` : ''}
${customPrompt ? `Directive: ${customPrompt}` : ''}
Isolate subject cleanly against a uniform flat neutral studio background suitable for transparent cutout. Highly detailed, 8k quality, authentic fabric texture.
`.trim();

    // Determine dimensions (default 1024x1024 or based on ratio)
    let width = 1024;
    let height = 1024;
    if (aspectRatio === '3:4') {
      width = 896;
      height = 1152;
    } else if (aspectRatio === '9:16') {
      width = 768;
      height = 1344;
    } else if (aspectRatio === '16:9') {
      width = 1344;
      height = 768;
    }

    const count = Math.min(Math.max(variationsCount || 1, 1), 4);
    const results: Array<{ imageUrl: string; index: number; label: string }> = [];

    // Run Cloudflare Workers AI with @cf/black-forest-labs/flux-2-klein-4b
    for (let i = 0; i < count; i++) {
      const variationPrompt = i === 0
        ? prompt
        : `${prompt} Look variation ${i + 1} with subtle alternative cloth styling and posture.`;

      const cfResult = await runCloudflareFlux({
        prompt: variationPrompt,
        playerBase64: player.data,
        garmentBase64List: garmentList,
        width,
        height,
      });

      if (!cfResult.success) {
        updateJob(jobId, {
          status: 'failed',
          error: cfResult.error,
          isQuotaExhausted: cfResult.isQuotaExhausted,
          requiresCredentials: cfResult.requiresCredentials,
        });

        const statusCode = cfResult.isQuotaExhausted ? 429 : cfResult.requiresCredentials ? 401 : 500;
        return {
          statusCode,
          headers: defaultHeaders,
          body: JSON.stringify({
            error: cfResult.error,
            isQuotaExhausted: cfResult.isQuotaExhausted,
            requiresCredentials: cfResult.requiresCredentials,
            jobId,
          }),
        };
      }

      if (cfResult.imageDataUrl) {
        results.push({
          imageUrl: cfResult.imageDataUrl,
          index: i,
          label: i === 0 ? 'Primary Look' : `Variation 0${i + 1}`,
        });
      }
    }

    if (results.length === 0) {
      updateJob(jobId, { status: 'failed', error: 'No image was generated by Cloudflare Workers AI.' });
      return {
        statusCode: 500,
        headers: defaultHeaders,
        body: JSON.stringify({ error: 'No image was returned by the AI provider.', jobId }),
      };
    }

    const jobResult = {
      images: results,
      primaryImage: results[0].imageUrl,
      mode,
      aspectRatio,
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
      body: JSON.stringify({ error: err?.message || 'Server error during look generation.' }),
    };
  }
};
