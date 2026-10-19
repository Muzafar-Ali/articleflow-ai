import type { RequestHandler } from 'express';

import type { AcceptArticleCommand } from '../../application/ports/article-acceptance.repository.js';
import type { AcceptanceResult } from '../../application/use-cases/accept-article-request.js';
import type { ParsedTelegramUpdate } from '../../integrations/telegram/parse-telegram-update.js';

export type ArticleAcceptanceHandler = (command: AcceptArticleCommand) => Promise<AcceptanceResult>;

export function createTelegramWebhookController(
  acceptArticle: ArticleAcceptanceHandler,
): RequestHandler {
  return async (_req, res, next) => {
    const update = res.locals['telegramUpdate'] as ParsedTelegramUpdate | undefined;

    if (!update) {
      next(new Error('Validated Telegram update was not available'));
      return;
    }

    // Other Telegram commands are handled in later milestones.
    if (update.kind !== 'article') {
      res.status(200).json({ status: 'ignored' });
      return;
    }

    const command: AcceptArticleCommand = {
      updateId: update.updateId,
      telegramUserId: update.telegramUserId,
      chatId: update.chatId,
      brief: update.brief,
    };

    try {
      // The request is accepted only after PostgreSQL commits
      // the user, update, job and outbox event.
      const result = await acceptArticle(command);

      // Telegram supports a Bot API method in the webhook
      // response. No separate outbound API call is required.
      res.status(200).json({
        method: 'sendMessage',
        chat_id: command.chatId.toString(),
        text:
          'Article request accepted.\n' +
          `Job ID: ${result.jobId}\n` +
          'Status: awaiting processing.',
      });
    } catch (error) {
      next(error);
    }
  };
}
