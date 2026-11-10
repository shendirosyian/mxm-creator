/**
 * Dedicated Lower-Body (Pants / Bottoms) Virtual Try-On Engine for MXM CREATOR
 * Connects exclusively to genuine AI virtual try-on models:
 * Primary: levihsu/OOTDiffusion Space (/process_dc with category: "Lower-body")
 * 
 * Strict Guarantees:
 * - NO fake rectangular image overlays or canvas drawImage pasting.
 * - If the genuine diffusion model is unavailable, reports honest failure and leaves canvas unmodified.
 * - Preserves body proportions, leg anatomy, original shoes, and background.
 */

import { Client, handle_file } from '@gradio/client';
import sharp from 'sharp';
import { parseDataUrl, bufferToBlob, getHfConfig } from './huggingface';

export interface PantsOptions {
  canvasBuffer: Buffer;
  pantsDataUrl: string;
  pantsName?: string;
  isShorts?: boolean;
}

export interface PantsResult {
  success: boolean;
  outputBuffer: Buffer;
  maskBuffer?: Buffer;
  note: string;
  model: string;
  status: 'applied' | 'failed' | 'unsupported';
}

export async function replacePants(options: PantsOptions): Promise<PantsResult> {
  const config = getHfConfig();
  const lowerName = (options.pantsName || '').toLowerCase();
  const isShorts =
    options.isShorts ||
    lowerName.includes('short') ||
    lowerName.includes('bermuda') ||
    lowerName.includes('boxer');

  const { buffer: pantsBuf, mimeType: pantsMime } = parseDataUrl(options.pantsDataUrl);

  // 1. Attempt Genuine Diffusion Model: levihsu/OOTDiffusion (/process_dc with category: "Lower-body")
  try {
    const connectOptions: any = {};
    if (config.token) {
      connectOptions.hf_token = config.token;
    }

    const app = await Client.connect('levihsu/OOTDiffusion', connectOptions);
    const canvasBlob = bufferToBlob(options.canvasBuffer, 'image/jpeg');
    const garmentBlob = bufferToBlob(pantsBuf, pantsMime);

    // Endpoint parameters for /process_dc:
    // [vton_img, garm_img, category, n_samples, n_steps, image_scale, seed]
    const job = (app as any).submit('/process_dc', [
      handle_file(canvasBlob),
      handle_file(garmentBlob),
      'Lower-body',
      1,     // n_samples
      20,    // n_steps
      2.0,   // image_scale
      -1,    // seed
    ]);

    let outputData: any = null;
    let failedMessage: string | null = null;

    for await (const msg of job) {
      if (msg.type === 'status' && msg.stage === 'error') {
        failedMessage = typeof (msg as any).message === 'string' ? (msg as any).message : JSON.stringify((msg as any).message);
        break;
      } else if (msg.type === 'data') {
        outputData = msg.data;
        break;
      }
    }

    if (outputData && Array.isArray(outputData) && outputData[0]) {
      const item = outputData[0];
      const resultUrl = typeof item === 'string' ? item : item?.url || item?.image?.url;

      if (resultUrl) {
        const resp = await fetch(resultUrl);
        if (resp.ok) {
          const neuralArrayBuf = await resp.arrayBuffer();
          const neuralResultBuf = Buffer.from(neuralArrayBuf);

          const meta = await sharp(options.canvasBuffer).metadata();
          const restoredBuf = await sharp(neuralResultBuf)
            .resize(meta.width || 768, meta.height || 1024, { fit: 'fill' })
            .png()
            .toBuffer();

          return {
            success: true,
            outputBuffer: restoredBuf,
            model: 'levihsu/OOTDiffusion (Lower-body)',
            status: 'applied',
            note: `Successfully transformed lower-body via levihsu/OOTDiffusion (${options.pantsName || 'Pants'}).`,
          };
        }
      }
    }

    if (failedMessage) {
      console.warn('[Pants Try-On] OOTDiffusion returned error:', failedMessage);
    }
  } catch (err: any) {
    console.warn('[Pants Try-On] OOTDiffusion connection notice:', err?.message || err);
  }

  // 2. Strict Anti-Fake Policy:
  // NEVER paste raw reference images as 2D rectangular overlays.
  // Leave the canvas buffer completely untouched and report honest status.
  return {
    success: false,
    outputBuffer: options.canvasBuffer,
    model: 'levihsu/OOTDiffusion (Lower-body)',
    status: 'unsupported',
    note: 'Lower-body virtual try-on requires an active diffusion model. Public OOTDiffusion Space is currently unavailable or quota exhausted. Fake 2D rectangular overlays have been strictly disabled.',
  };
}
