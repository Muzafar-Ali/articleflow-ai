import { Router } from 'express';
import { createTelegramWebhookController } from '../controllers/telegram-webhook.controller.js';
import type { ArticleAcceptanceHandler } from '../controllers/telegram-webhook.controller.js';
import { createApiErrorHandler } from '../middleware/api-error-handler.js';
import type { ApiErrorReporter } from '../middleware/api-error-handler.js';
import { createTelegramWebhookAuth } from '../middleware/telegram-webhook-auth.js';
import { assignTelegramRequestId } from '../middleware/telegram-request-id.js';
import {
  requireTelegramJson,
  telegramBodyErrorHandler,
  telegramJsonBodyParser,
  validateTelegramUpdate,
} from '../middleware/telegram-request-body.js';

export interface TelegramWebhookDependencies {
  secret: string;
  acceptArticle: ArticleAcceptanceHandler;
  onError: ApiErrorReporter;
}

export function createTelegramWebhookRouter(dependencies: TelegramWebhookDependencies) {
  const router = Router();

  // Generate correlation ID before authentication and parsing.
  router.use(assignTelegramRequestId);

  router.post(
    '/',
    createTelegramWebhookAuth(dependencies.secret),
    requireTelegramJson,
    telegramJsonBodyParser,
    validateTelegramUpdate,
    createTelegramWebhookController(dependencies.acceptArticle),
  );

  // Preserve existing JSON parser error classification.
  router.use(telegramBodyErrorHandler);

  // Handle remaining application and infrastructure errors.
  router.use(createApiErrorHandler(dependencies.onError));

  return router;
}
