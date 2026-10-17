import { describe, expect, it } from '@jest/globals';
import express from 'express';
import request from 'supertest';

import { createTelegramWebhookAuth } from '../../src/api/middleware/telegram-webhook-auth.js';

const VALID_SECRET = 'A'.repeat(40);
const SECRET_HEADER = 'X-Telegram-Bot-Api-Secret-Token';

function createTestApp() {
  const app = express();

  // This is a test-only endpoint, not our production webhook.
  app.post('/webhooks/telegram', createTelegramWebhookAuth(VALID_SECRET), (_req, res) => {
    res.sendStatus(204);
  });

  return app;
}

describe('Telegram webhook authentication', () => {
  it('allows requests with the correct secret', async () => {
    const response = await request(createTestApp())
      .post('/webhooks/telegram')
      .set(SECRET_HEADER, VALID_SECRET);

    expect(response.status).toBe(204);
  });

  it('rejects requests without a secret', async () => {
    const response = await request(createTestApp()).post('/webhooks/telegram');

    expect(response.status).toBe(401);
    expect(response.body).toEqual({
      error: 'Unauthorized',
    });
  });

  it('rejects an incorrect secret of the same length', async () => {
    const response = await request(createTestApp())
      .post('/webhooks/telegram')
      .set(SECRET_HEADER, 'B'.repeat(40));

    expect(response.status).toBe(401);
  });

  it('rejects an incorrect secret of a different length', async () => {
    const response = await request(createTestApp())
      .post('/webhooks/telegram')
      .set(SECRET_HEADER, 'invalid-secret');

    expect(response.status).toBe(401);
  });

  it('rejects an invalid configured secret', () => {
    expect(() => {
      createTelegramWebhookAuth('too-short');
    }).toThrow('Invalid Telegram webhook secret configuration');
  });
});
