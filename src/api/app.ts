import express from 'express';

import type { Express } from 'express';

export function createApp(): Express {
  const app = express();

  app.disable('x-powered-by');

  app.get('/health/live', (_req, res) => {
    res.status(200).json({
      status: 'ok',
      service: 'articleflow-api',
    });
  });

  return app;
}
