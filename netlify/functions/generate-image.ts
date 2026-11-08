import type { Handler, HandlerEvent } from '@netlify/functions';
import { runGeminiStyling } from './utils/gemini';
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

    // Build prompt instructions
    const garmentDescriptions: string[] = [];
    const garmentList: Array<{ slot: string; dataUrl: string; name?: string }> = [];

    if (garments && typeof garments === 'object') {
      for (const [slotKey, garment] of Object.entries(garments as Record<string, any>)) {
        if (garment && garment.data) {
          const slotLabel = slotKey.toUpperCase();
          garmentDescriptions.push(
            `Adapt the ${slotLabel} (${garment.name || 'reference clothing'}) naturally onto the model, preserving its fabric drape, silhouette, and visible details.`
          );
          garmentList.push({ slot: slotKey, dataUrl: garment.data, name: garment.name });
        }
      }
    }

    const colorInstructions: string[] = [];
    if (customization.colors?.shirt) colorInstructions.push(`Shirt color: ${customization.colors.shirt}`);
    if (customization.colors?.pants) colorInstructions.push(`Pants color: ${customization.colors.pants}`);
    if (customization.colors?.shoes) colorInstructions.push(`Shoes color: ${customization.colors.shoes}`);
    if (customization.colors?.accessories) colorInstructions.push(`Accessories color: ${customization.colors.accessories}`);

    let styleAtmosphere = 'Authentic commercial realism, natural skin texture, realistic cloth wrinkles and draping.';
    if (mode === 'STUDIO') {
      styleAtmosphere = 'Editorial studio fashion photography, controlled softbox lighting, clean studio background, crisp focus.';
    } else if (mode === 'CREATIVE') {
      styleAtmosphere = 'Contemporary creative high-fashion aesthetic, rich tonal contrast, expressive styling.';
    }

    const customPrompt = customization.customPrompt?.trim();
    const faceText = customization.faceExpression && customization.faceExpression !== 'Original'
      ? `Facial expression: ${customization.faceExpression}. Maintain recognizable facial characteristics as much as the model allows.`
      : 'Maintain the recognizable facial identity and expression of the model.';

    const hairText = customization.hairStyle && customization.hairStyle !== 'Original'
      ? `Hairstyle: ${customization.hairStyle}${customization.hairColor ? ` in ${customization.hairColor}` : ''}.`
      : 'Preserve original natural hairstyle and hair color.';

    const poseText = customization.pose && customization.pose !== 'Original'
      ? `Subject pose: ${customization.pose}.`
      : 'Preserve the natural posture of the model.';

    const prompt = `
VIRTUAL STYLING TASK:
Reference 1 is the primary identity source. Preserve the person's identity, facial features, and original appearance as much as possible.
${garmentDescriptions.length > 0 ? garmentDescriptions.join(' ') : 'Fit the specified stylish outfit naturally onto the person.'}
Style Atmosphere: ${styleAtmosphere}
${faceText}
${hairText}
${poseText}
${colorInstructions.length > 0 ? `Color overrides: ${colorInstructions.join(', ')}.` : ''}
${customPrompt ? `Directive: ${customPrompt}` : ''}
Isolate subject cleanly against a uniform flat neutral studio background suitable for transparent alpha cutout.
`.trim();

    const count = Math.min(Math.max(variationsCount || 1, 1), 4);
    const results: Array<{ imageUrl: string; index: number; label: string }> = [];

    // Run Google Gemini API Image Generation
    for (let i = 0; i < count; i++) {
      const variationPrompt = i === 0
        ? prompt
        : `${prompt}\nVariation ${i + 1}: Subtle alternative cloth styling and angle nuance while maintaining subject identity.`;

      const geminiResult = await runGeminiStyling({
        prompt: variationPrompt,
        playerBase64: player.data,
        garmentList,
        aspectRatio,
      });

      if (!geminiResult.success) {
        updateJob(jobId, {
          status: 'failed',
          error: geminiResult.error,
          isQuotaExhausted: geminiResult.isQuotaExhausted,
          requiresCredentials: geminiResult.requiresCredentials,
        });

        const statusCode = geminiResult.isQuotaExhausted ? 429 : geminiResult.requiresCredentials ? 401 : 500;
        return {
          statusCode,
          headers: defaultHeaders,
          body: JSON.stringify({
            error: geminiResult.error,
            isQuotaExhausted: geminiResult.isQuotaExhausted,
            requiresCredentials: geminiResult.requiresCredentials,
            modelUsed: geminiResult.modelUsed,
            jobId,
          }),
        };
      }

      if (geminiResult.imageDataUrl) {
        results.push({
          imageUrl: geminiResult.imageDataUrl,
          index: i,
          label: i === 0 ? 'Primary Look' : `Variation 0${i + 1}`,
        });
      }
    }

    if (results.length === 0) {
      updateJob(jobId, { status: 'failed', error: 'No image data returned by Gemini API.' });
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
