import express from 'express';

import type { Express } from 'express';
import type { TelegramWebhookDependencies } from './routes/telegram-webhook.routes.js';

import { createTelegramWebhookRouter } from './routes/telegram-webhook.routes.js';

interface AppOptions {
  telegram?: TelegramWebhookDependencies;
}

export function createApp(options: AppOptions = {}): Express {
  const app = express();

  app.disable('x-powered-by');

  app.get('/health/live', (_req, res) => {
    res.status(200).json({
      status: 'ok',
      service: 'articleflow-api',
    });
  });

  if (options.telegram) {
    app.use('/webhooks/telegram', createTelegramWebhookRouter(options.telegram));
  }

  return app;
}
