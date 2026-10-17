import { timingSafeEqual } from 'node:crypto';
import type { RequestHandler } from 'express';
import { TELEGRAM_WEBHOOK_SECRET_PATTERN } from '../../config/telegram-webhook-config.js';

const TELEGRAM_SECRET_HEADER = 'x-telegram-bot-api-secret-token';

export function createTelegramWebhookAuth(secret: string): RequestHandler {
  if (!TELEGRAM_WEBHOOK_SECRET_PATTERN.test(secret)) {
    throw new Error('Invalid Telegram webhook secret configuration');
  }

  const expected = Buffer.from(secret, 'utf8');

  return (req, res, next) => {
    const received = req.get(TELEGRAM_SECRET_HEADER);

    if (!received) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const actual = Buffer.from(received, 'utf8');

    if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    next();
  };
}
