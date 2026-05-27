import { Hono, type Context, type Next } from 'hono';
import { timingSafeCompare, rateLimiter } from '../src/app/api/utils/security';
import { processRobustCSV } from '../src/app/api/utils/csvProcessor';

const botWebhook = new Hono();

/**
 * 🤖 Middleware de API Key (Timing Safe)
 * Validates the 'x-api-key' header against process.env.BOT_API_KEY
 */
const apiKeyMiddleware = async (c: Context, next: Next) => {
  const apiKey = c.req.header('x-api-key');
  const secretKey = process.env.BOT_API_KEY;

  if (!apiKey || !secretKey || !timingSafeCompare(apiKey, secretKey)) {
    console.warn(`[Bot Webhook] Unauthorized access attempt from IP: ${c.req.header('x-forwarded-for')}`);
    return c.json({ error: 'Unauthorized - Invalid or missing API Key' }, 401);
  }
  await next();
};

/**
 * 🛑 Rate Limiter (Defensa DoS)
 * Limits to 10 requests per minute
 */
const botRateLimiter = rateLimiter({
  windowMs: 60 * 1000,
  max: 10,
  message: 'Too many requests from this Bot / IP. Please wait 1 minute.'
});

/**
 * ⚙️ The Endpoint: POST /api/webhooks/bot/import-csv
 */
botWebhook.post('/import-csv', botRateLimiter, apiKeyMiddleware, async (c: Context) => {
  try {
    const body = await c.req.parseBody();
    const file = body.file;

    if (!file || !(file instanceof File)) {
      return c.json({ error: 'No CSV file uploaded' }, 400);
    }

    const csvText = await file.text();
    
    // Reuse the same robust logic as manual import
    const results = await processRobustCSV(csvText, {
      userId: 'M2M_BOT', 
      createMissingLocations: true // Bot often brings new locations
    } as any);

    return c.json({
      success: true,
      message: 'M2M Bot Import Processed Successfully',
      ...results
    });

  } catch (error: any) {
    console.error('[Bot Webhook Error]:', error?.message || error);
    return c.json({
      error: 'Processing Failed',
      details: error?.message || 'Unknown error'
    }, 500);
  }
});

export default botWebhook;
