import { describe, expect, it } from '@jest/globals';
import express from 'express';
import request from 'supertest';

import { createTelegramWebhookAuth } from '../../src/api/middleware/telegram-webhook-auth.js';
import {
  requireTelegramJson,
  telegramBodyErrorHandler,
  telegramJsonBodyParser,
  validateTelegramUpdate,
} from '../../src/api/middleware/telegram-request-body.js';

const SECRET = 'A'.repeat(40);
const SECRET_HEADER = 'X-Telegram-Bot-Api-Secret-Token';

const validUpdate = {
  update_id: 123456,
  message: {
    message_id: 10,
    from: { id: 987654321 },
    chat: { id: 987654321 },
    text: '/article Write about fintech',
  },
};

function createTestApp() {
  const app = express();

  app.post(
    '/webhooks/telegram',
    createTelegramWebhookAuth(SECRET),
    requireTelegramJson,
    telegramJsonBodyParser,
    validateTelegramUpdate,
    (_req, res) => {
      // Test-only acknowledgement. No production webhook is mounted yet.
      res.sendStatus(204);
    },
  );

  app.use(telegramBodyErrorHandler);

  return app;
}

describe('Telegram HTTP request boundary', () => {
  it('accepts a valid authenticated JSON update', async () => {
    const response = await request(createTestApp())
      .post('/webhooks/telegram')
      .set(SECRET_HEADER, SECRET)
      .send(validUpdate);

    expect(response.status).toBe(204);
  });

  it('rejects unauthenticated requests before JSON parsing', async () => {
    const response = await request(createTestApp())
      .post('/webhooks/telegram')
      .set('Content-Type', 'application/json')
      .send('{"invalid":');

    expect(response.status).toBe(401);
    expect(response.body).toEqual({
      error: 'Unauthorized',
    });
  });

  it('rejects malformed JSON', async () => {
    const response = await request(createTestApp())
      .post('/webhooks/telegram')
      .set(SECRET_HEADER, SECRET)
      .set('Content-Type', 'application/json')
      .send('{"update_id":');

    expect(response.status).toBe(400);
    expect(response.body).toEqual({
      error: 'Malformed JSON',
    });
  });

  it('rejects an invalid Telegram update structure', async () => {
    const response = await request(createTestApp())
      .post('/webhooks/telegram')
      .set(SECRET_HEADER, SECRET)
      .send({
        update_id: 'invalid',
      });

    expect(response.status).toBe(400);
    expect(response.body).toEqual({
      error: 'Invalid Telegram update',
    });
  });

  it('rejects JSON payloads larger than 64 KB', async () => {
    const response = await request(createTestApp())
      .post('/webhooks/telegram')
      .set(SECRET_HEADER, SECRET)
      .send({
        ...validUpdate,
        padding: 'x'.repeat(70 * 1024),
      });

    expect(response.status).toBe(413);
    expect(response.body).toEqual({
      error: 'Payload Too Large',
    });
  });

  it('rejects unsupported content types', async () => {
    const response = await request(createTestApp())
      .post('/webhooks/telegram')
      .set(SECRET_HEADER, SECRET)
      .set('Content-Type', 'text/plain')
      .send('not-json');

    expect(response.status).toBe(415);
    expect(response.body).toEqual({
      error: 'Unsupported Media Type',
    });
  });

  it('rejects an empty JSON request body', async () => {
    const response = await request(createTestApp())
      .post('/webhooks/telegram')
      .set(SECRET_HEADER, SECRET)
      .set('Content-Type', 'application/json');

    expect(response.status).toBe(400);
    expect(response.body).toEqual({
      error: 'Invalid Telegram update',
    });
  });
});
