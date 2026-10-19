import { randomUUID } from 'node:crypto';
import type { RequestHandler } from 'express';

export const assignTelegramRequestId: RequestHandler = (_req, res, next) => {
  const requestId = randomUUID();

  res.locals['requestId'] = requestId;
  res.setHeader('X-Request-Id', requestId);

  next();
};
