import { DependencyUnavailableError } from '../../application/errors/dependency-unavailable.error.js';
import { UniqueConstraintConflictError } from '../../application/errors/unique-constraint-conflict.error.js';
import type {
  AcceptArticleCommand,
  AcceptedArticleRecord,
  ArticleAcceptanceRepository,
} from '../../application/ports/article-acceptance.repository.js';
import type { PrismaClient } from '../../generated/prisma/client.js';

const POSTGRES_UNAVAILABLE_CODES = new Set([
  'P1001',
  'P1002',
  'P1008',
  'P1017',
  'P2024',
  'ECONNREFUSED',
  'ECONNRESET',
  'ETIMEDOUT',
  'EHOSTUNREACH',
  'ENETUNREACH',
  'ENOTFOUND',
]);

function isPrismaUniqueConstraintError(error: unknown): boolean {
  return typeof error === 'object' && error !== null && 'code' in error && error.code === 'P2002';
}

export function isPostgresUnavailableError(error: unknown): boolean {
  let current: unknown = error;

  for (let depth = 0; depth < 6; depth++) {
    if (current === null || typeof current !== 'object') {
      return false;
    }

    const code = 'code' in current && typeof current.code === 'string' ? current.code : undefined;

    const message =
      'message' in current && typeof current.message === 'string' ? current.message : undefined;

    // Recognize only the observed Prisma transaction
    // startup timeout, not every P2028 error.
    if (code === 'P2028' && message?.includes('Unable to start a transaction in the given time')) {
      return true;
    }

    if (code !== undefined && POSTGRES_UNAVAILABLE_CODES.has(code)) {
      return true;
    }

    current = 'cause' in current ? current.cause : undefined;
  }

  return false;
}

function translatePersistenceError(error: unknown): unknown {
  if (isPrismaUniqueConstraintError(error)) {
    return new UniqueConstraintConflictError();
  }

  if (isPostgresUnavailableError(error)) {
    return new DependencyUnavailableError('postgresql', {
      cause: error,
    });
  }

  return error;
}

export class PrismaArticleAcceptanceRepository implements ArticleAcceptanceRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async createAcceptedArticle(
    command: AcceptArticleCommand,
    idempotencyKey: string,
  ): Promise<string> {
    try {
      return await this.prisma.$transaction(async (tx) => {
        const user = await tx.user.upsert({
          where: {
            telegramUserId: command.telegramUserId,
          },
          create: {
            telegramUserId: command.telegramUserId,
          },
          update: {
            telegramUserId: command.telegramUserId,
          },
        });

        const update = await tx.telegramUpdate.create({
          data: {
            updateId: command.updateId,
            userId: user.id,
            chatId: command.chatId,
          },
        });

        const job = await tx.agentJob.create({
          data: {
            userId: user.id,
            sourceUpdateId: update.id,
            idempotencyKey,
            status: 'CREATED',
            requestJson: {
              kind: 'article',
              brief: command.brief,
            },
            approvalRequired: false,
          },
        });

        await tx.outboxEvent.create({
          data: {
            aggregateType: 'agent_job',
            aggregateId: job.id,
            eventType: 'AgentJobCreated',
            payload: {
              jobId: job.id,
            },
          },
        });

        return job.id;
      });
    } catch (error) {
      throw translatePersistenceError(error);
    }
  }

  async findByIdempotencyKey(idempotencyKey: string): Promise<AcceptedArticleRecord | null> {
    try {
      const existing = await this.prisma.agentJob.findUnique({
        where: {
          idempotencyKey,
        },
        select: {
          id: true,
          user: {
            select: {
              telegramUserId: true,
            },
          },
          sourceUpdate: {
            select: {
              updateId: true,
              chatId: true,
            },
          },
        },
      });

      if (!existing) {
        return null;
      }

      return {
        jobId: existing.id,
        updateId: existing.sourceUpdate.updateId,
        telegramUserId: existing.user.telegramUserId,
        chatId: existing.sourceUpdate.chatId,
      };
    } catch (error) {
      throw translatePersistenceError(error);
    }
  }
}
