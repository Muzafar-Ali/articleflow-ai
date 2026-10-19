import { UniqueConstraintConflictError } from '../errors/unique-constraint-conflict.error.js';
import type {
  AcceptArticleCommand,
  ArticleAcceptanceRepository,
} from '../ports/article-acceptance.repository.js';

export interface AcceptanceResult {
  readonly kind: 'created' | 'duplicate';
  readonly jobId: string;
}

export function createAcceptArticleRequest(
  repository: ArticleAcceptanceRepository,
): (command: AcceptArticleCommand) => Promise<AcceptanceResult> {
  return async (command) => {
    const idempotencyKey = `telegram:article:${command.updateId.toString()}`;

    try {
      const jobId = await repository.createAcceptedArticle(command, idempotencyKey);

      return {
        kind: 'created',
        jobId,
      };
    } catch (error) {
      if (!(error instanceof UniqueConstraintConflictError)) {
        throw error;
      }

      const existing = await repository.findByIdempotencyKey(idempotencyKey);

      // A database conflict is not automatically proof
      // that this request is an accepted duplicate.
      if (
        !existing ||
        existing.updateId !== command.updateId ||
        existing.telegramUserId !== command.telegramUserId ||
        existing.chatId !== command.chatId
      ) {
        throw error;
      }

      return {
        kind: 'duplicate',
        jobId: existing.jobId,
      };
    }
  };
}
