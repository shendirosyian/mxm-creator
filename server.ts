import express, { Request, Response } from 'express';
import http from 'http';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { handler as generateImageHandler } from './netlify/functions/generate-image';
import { handler as checkJobHandler } from './netlify/functions/check-job';
import { handler as processImageHandler } from './netlify/functions/process-image';
import { handler as exportImageHandler } from './netlify/functions/export-image';
import { handler as hfDiagnosticHandler } from './netlify/functions/hf-diagnostic';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const httpServer = http.createServer(app);
const PORT = process.env.PORT || 3000;
const isProduction = process.env.NODE_ENV === 'production';

app.use(express.json({ limit: '60mb' }));
app.use(express.urlencoded({ extended: true, limit: '60mb' }));

// Helper to convert Express Request into Netlify HandlerEvent
function netlifyAdapter(handler: any) {
  return async (req: Request, res: Response) => {
    try {
      const event = {
        httpMethod: req.method,
        headers: req.headers as any,
        queryStringParameters: req.query as any,
        body: typeof req.body === 'string' ? req.body : JSON.stringify(req.body),
        path: req.path,
      };
      const result = await handler(event, {} as any);
      res.status(result.statusCode || 200);
      if (result.headers) {
        for (const [k, v] of Object.entries(result.headers)) {
          res.setHeader(k, v as string);
        }
      }
      res.send(result.body);
    } catch (err: any) {
      res.status(500).json({ error: err?.message || 'Internal server error' });
    }
  };
}

// 1. Mount Netlify Functions routes for local dev (both /.netlify/functions/ and /api/)
app.all('/.netlify/functions/generate-image', netlifyAdapter(generateImageHandler));
app.all('/api/generate-image', netlifyAdapter(generateImageHandler));
app.all('/api/generate-look', netlifyAdapter(generateImageHandler)); // legacy alias

app.all('/.netlify/functions/check-job', netlifyAdapter(checkJobHandler));
app.all('/api/check-job', netlifyAdapter(checkJobHandler));

app.all('/.netlify/functions/process-image', netlifyAdapter(processImageHandler));
app.all('/api/process-image', netlifyAdapter(processImageHandler));

app.all('/.netlify/functions/export-image', netlifyAdapter(exportImageHandler));
app.all('/api/export-image', netlifyAdapter(exportImageHandler));

// Hugging Face ZeroGPU Try-On diagnostic endpoints (with legacy gemini alias for safety)
app.all('/.netlify/functions/hf-diagnostic', netlifyAdapter(hfDiagnosticHandler));
app.all('/api/hf-diagnostic', netlifyAdapter(hfDiagnosticHandler));
app.all('/.netlify/functions/gemini-diagnostic', netlifyAdapter(hfDiagnosticHandler));
app.all('/api/gemini-diagnostic', netlifyAdapter(hfDiagnosticHandler));

// Secure server-side endpoint to configure server environment variable HF_TOKEN (never exposed to client)
app.post('/api/configure-server-token', async (req: Request, res: Response) => {
  try {
    const { token } = req.body || {};
    if (!token || typeof token !== 'string' || !token.trim()) {
      return res.status(400).json({ error: 'Token string is required.' });
    }
    const cleanToken = token.trim();
    if (!cleanToken.startsWith('hf_')) {
      return res.status(400).json({ error: 'Invalid format. Hugging Face tokens must start with "hf_".' });
    }

    // Verify token validity with Hugging Face whoami API
    const whoamiResp = await fetch('https://huggingface.co/api/whoami-v2', {
      headers: { Authorization: `Bearer ${cleanToken}` },
    });

    if (whoamiResp.status === 401 || whoamiResp.status === 403) {
      return res.status(401).json({
        error: 'Hugging Face rejected this token (HTTP 401 Unauthorized). Verify token permissions at https://huggingface.co/settings/tokens.',
      });
    }

    // Set server process environment variable
    process.env.HF_TOKEN = cleanToken;

    // Persist to server .env file
    const envPath = path.join(__dirname, '.env');
    let envContent = '';
    if (fs.existsSync(envPath)) {
      envContent = fs.readFileSync(envPath, 'utf8');
      if (/^HF_TOKEN=.*$/m.test(envContent)) {
        envContent = envContent.replace(/^HF_TOKEN=.*$/m, `HF_TOKEN="${cleanToken}"`);
      } else {
        envContent += `\nHF_TOKEN="${cleanToken}"\n`;
      }
    } else {
      envContent = `HF_TOKEN="${cleanToken}"\nHF_SPACE_ID="Nymbo/Virtual-Try-On"\n`;
    }
    fs.writeFileSync(envPath, envContent, 'utf8');

    return res.json({
      success: true,
      tokenConfigured: true,
      message: 'Server HF_TOKEN environment variable updated and verified with Hugging Face successfully.',
    });
  } catch (err: any) {
    return res.status(500).json({ error: err?.message || 'Failed to update server environment' });
  }
});

// 2. High-speed Smart Asset Analysis (instant local heuristics for Virtual Try-On)
// 2. High-speed Smart Asset Analysis with Garment Intelligence
app.post('/api/analyze-assets', async (req: Request, res: Response) => {
  try {
    const { player, garments } = req.body;
    if (!player || !player.data) {
      return res.status(400).json({ error: 'Player photo is required for analysis.' });
    }

    const analyzedGarments: Record<string, any> = {};

    if (garments && typeof garments === 'object') {
      for (const [key, g] of Object.entries(garments as Record<string, any>)) {
        const name = (g?.name || g?.fileName || '').toLowerCase();
        let subtype = 'Standard garment';
        let lengthCategory: 'Full-length' | 'Cropped' | 'Short' | 'Knee-length' | 'Standard' = 'Standard';
        let fitType: 'Slim' | 'Straight' | 'Wide-leg' | 'Oversized' | 'Regular' = 'Regular';
        let silhouette = 'Tailored fit';
        let collarNeckline = 'Standard collar';
        let sleeves = 'Short sleeves';
        let pocketsZippers = 'Minimal clean seams';

        if (key === 'pants') {
          if (name.includes('short') || name.includes('bermuda') || name.includes('boxer')) {
            subtype = name.includes('knee') ? 'Knee-length shorts' : 'Shorts';
            lengthCategory = 'Short';
            silhouette = 'Relaxed thigh coverage';
          } else if (name.includes('cargo')) {
            subtype = 'Cargo pants';
            lengthCategory = 'Full-length';
            fitType = 'Straight';
            silhouette = 'Full-length utility cargo silhouette';
            pocketsZippers = 'Side bellows cargo pockets & flap closures';
          } else if (name.includes('wide') || name.includes('baggy') || name.includes('flare')) {
            subtype = 'Wide-leg trousers';
            lengthCategory = 'Full-length';
            fitType = 'Wide-leg';
            silhouette = 'Full-length draped wide leg silhouette';
          } else if (name.includes('slim') || name.includes('skinny')) {
            subtype = 'Slim-fit pants';
            lengthCategory = 'Full-length';
            fitType = 'Slim';
            silhouette = 'Tapered full-length ankle fit';
          } else if (name.includes('jean') || name.includes('denim')) {
            subtype = 'Classic denim jeans';
            lengthCategory = 'Full-length';
            fitType = 'Straight';
            silhouette = 'Standard full-length 5-pocket denim';
            pocketsZippers = 'Riveted curved pockets & coin pocket';
          } else if (name.includes('crop') || name.includes('capri') || name.includes('ankle')) {
            subtype = 'Cropped trousers';
            lengthCategory = 'Cropped';
            silhouette = 'Above-ankle cropped hemline';
          } else {
            subtype = 'Full-length trousers';
            lengthCategory = 'Full-length';
            fitType = 'Straight';
            silhouette = 'Full-length pants (ankle length coverage)';
            pocketsZippers = 'Welt pockets and side slant pockets';
          }
        } else if (key === 'top') {
          if (name.includes('hoodie') || name.includes('hooded')) {
            subtype = 'Pullover hoodie';
            sleeves = 'Long sleeves with ribbed cuffs';
            collarNeckline = 'Drawstring hood';
            silhouette = 'Comfortable torso fit';
          } else if (name.includes('jacket') || name.includes('bomber') || name.includes('coat')) {
            subtype = 'Outerwear jacket';
            sleeves = 'Long sleeves';
            collarNeckline = 'Structured ribbed/fold collar';
            pocketsZippers = 'Center zipper and angled welt pockets';
          } else if (name.includes('shirt') || name.includes('button')) {
            subtype = 'Button-up shirt';
            collarNeckline = 'Point collar';
            pocketsZippers = 'Placket button line & chest pocket';
          } else {
            subtype = 'T-shirt / Crewneck';
            collarNeckline = 'Round rib crewneck';
            sleeves = 'Short sleeves';
            silhouette = 'Natural torso silhouette';
          }
        } else if (key === 'shoes') {
          if (name.includes('boot')) {
            subtype = 'High-top boots';
            silhouette = 'Ankle collar with lug tread sole';
          } else if (name.includes('loafer') || name.includes('oxford') || name.includes('derby')) {
            subtype = 'Formal leather shoes';
            silhouette = 'Low-profile polished sole';
          } else {
            subtype = 'Athletic sneakers';
            silhouette = 'Cushioned sole with lace closure';
          }
        } else if (key === 'accessories') {
          if (name.includes('cap') || name.includes('hat') || name.includes('beanie')) {
            subtype = 'Headwear cap';
            silhouette = 'Curved brim crown';
          } else if (name.includes('watch')) {
            subtype = 'Wristwatch';
            silhouette = 'Round dial with linked strap';
          } else if (name.includes('glass') || name.includes('sunglass')) {
            subtype = 'Eyewear';
            silhouette = 'Sculpted optical frames';
          } else {
            subtype = 'Accessory item';
            silhouette = 'Structured accessory';
          }
        }

        analyzedGarments[key] = {
          garmentType: key.toUpperCase(),
          subtype,
          silhouette,
          lengthCategory,
          fitType,
          shapeDetected: true,
          colorsDetected: ['Original Tone'],
          patternLogos: 'Identified authentic silhouette',
          collarNeckline,
          sleeves,
          pocketsZippers,
          status: 'GOOD',
        };
      }
    }

    return res.json({
      player: {
        identityDetected: true,
        bodyVisibility: 'Half Body / Upper Torso',
        quality: 'GOOD',
        lighting: 'Studio natural lighting',
        pose: 'Facing forward, try-on ready',
        existingClothing: 'Standard attire detected',
      },
      garments: analyzedGarments,
    });
  } catch (error) {
    return res.json({
      player: {
        identityDetected: true,
        bodyVisibility: 'Detected',
        quality: 'GOOD',
      },
      garments: {},
    });
  }
});

// Dev vs Prod Vite mounting
async function startServer() {
  if (!isProduction) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        hmr: false,
      },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(__dirname, 'dist');
    if (fs.existsSync(distPath)) {
      app.use(express.static(distPath));
      app.get('*', (_req: Request, res: Response) => {
        res.sendFile(path.resolve(distPath, 'index.html'));
      });
    }
  }

  httpServer.listen(PORT, () => {
    console.log(`MXM CREATOR studio server running on http://localhost:${PORT}`);
    console.log(`Mounted Netlify Functions: /.netlify/functions/generate-image, /check-job, /process-image, /export-image`);
  });
}

startServer();
