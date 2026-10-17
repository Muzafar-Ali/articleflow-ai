import express from 'express';
import { ZodError } from 'zod';
import { parseTelegramUpdate } from '../../integrations/telegram/parse-telegram-update.js';
import type { ErrorRequestHandler, RequestHandler } from 'express';

// Require Telegram webhook requests to use JSON.
export const requireTelegramJson: RequestHandler = (req, res, next) => {
  if (!req.is('application/json')) {
    res.status(415).json({
      error: 'Unsupported Media Type',
    });
    return;
  }

  next();
};

// Apply a bounded parser only to the Telegram webhook route.
export const telegramJsonBodyParser = express.json({
  limit: '64kb',
  strict: true,
  type: 'application/json',
});

// Validate the request and store its normalized representation
// for the subsequent durable acceptance handler.
export const validateTelegramUpdate: RequestHandler = (req, res, next) => {
  try {
    const parsed = parseTelegramUpdate(req.body as unknown);

    res.locals['telegramUpdate'] = parsed;
    next();
  } catch (error) {
    if (error instanceof ZodError) {
      res.status(400).json({
        error: 'Invalid Telegram update',
      });
      return;
    }

    next(error);
  }
};

// Identify known JSON parser errors without exposing request bodies.
export const telegramBodyErrorHandler: ErrorRequestHandler = (error: unknown, _req, res, next) => {
  if (typeof error === 'object' && error !== null && 'type' in error) {
    if (error.type === 'entity.too.large') {
      res.status(413).json({
        error: 'Payload Too Large',
      });
      return;
    }

    if (error.type === 'entity.parse.failed') {
      res.status(400).json({
        error: 'Malformed JSON',
      });
      return;
    }

    if (error.type === 'encoding.unsupported' || error.type === 'charset.unsupported') {
      res.status(415).json({
        error: 'Unsupported Media Type',
      });
      return;
    }
  }

  next(error);
};
