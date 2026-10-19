import { DependencyUnavailableError } from '../application/errors/dependency-unavailable.error.js';
import { createAcceptArticleRequest } from '../application/use-cases/accept-article-request.js';
import { loadConfig } from '../config/environment.js';
import { loadTelegramWebhookConfig } from '../config/telegram-webhook-config.js';
import { createPrismaClient } from '../database/prisma.js';
import { PrismaArticleAcceptanceRepository } from '../database/repositories/prisma-article-acceptance.repository.js';
import { createLogger } from '../observability/logger.js';
import { createApp } from './app.js';

type ShutdownSignal = 'SIGINT' | 'SIGTERM';

function getErrorField(value: unknown, field: string): unknown {
  if (typeof value !== 'object' || value === null) {
    return undefined;
  }

  const record = value as Record<string, unknown>;

  return record[field];
}

function getErrorString(value: unknown, field: string): string | undefined {
  const result = getErrorField(value, field);

  return typeof result === 'string' ? result : undefined;
}

const config = loadConfig();
const telegramConfig = loadTelegramWebhookConfig();
const logger = createLogger(config, 'articleflow-api');

const databaseUrl = process.env['DATABASE_URL'];

if (!databaseUrl) {
  throw new Error('DATABASE_URL is required for API startup');
}

// Composition root: assemble infrastructure and application dependencies.
const prisma = createPrismaClient(databaseUrl);
const repository = new PrismaArticleAcceptanceRepository(prisma);
const acceptArticle = createAcceptArticleRequest(repository);

const app = createApp({
  telegram: {
    secret: telegramConfig.secret,
    acceptArticle,

    onError: (error, context) => {
      const meta = getErrorField(error, 'meta');
      const adapterError = getErrorField(meta, 'driverAdapterError');
      const adapterCause = getErrorField(adapterError, 'cause');
      const directCause = getErrorField(error, 'cause');

      logger.error(
        {
          requestId: context.requestId,
          errorCode: context.errorCode,
          httpStatus: context.statusCode,

          errorName: error instanceof Error ? error.name : 'UnknownError',

          // Machine-readable diagnostics only.
          prismaCode: getErrorString(error, 'code'),
          prismaMetaCode: getErrorString(meta, 'code'),
          prismaMetaKeys: typeof meta === 'object' && meta !== null ? Object.keys(meta) : undefined,

          adapterCauseKind: getErrorString(adapterCause, 'kind'),
          adapterOriginalCode: getErrorString(adapterCause, 'originalCode'),

          directCauseCode: getErrorString(directCause, 'code'),

          dependency: error instanceof DependencyUnavailableError ? error.dependency : undefined,
        },
        'Telegram webhook acceptance failed',
      );
    },
  },
});

const server = app.listen(config.port, () => {
  logger.info({ port: config.port }, 'ArticleFlow API started');
});

server.on('error', (error: Error) => {
  logger.fatal({ err: error }, 'HTTP server error');
  process.exitCode = 1;

  void prisma.$disconnect().catch((disconnectError: unknown) => {
    logger.error({ err: disconnectError }, 'Database cleanup failed');
  });
});

let shuttingDown = false;

function shutdown(signal: ShutdownSignal): void {
  if (shuttingDown) {
    return;
  }

  shuttingDown = true;

  logger.info({ signal }, 'API shutdown initiated');

  const timeout = setTimeout(() => {
    logger.fatal('API graceful shutdown timed out');
    process.exit(1);
  }, 10_000);

  timeout.unref();

  // Stop accepting new HTTP requests and allow existing
  // requests to finish before disconnecting PostgreSQL.
  server.close((closeError) => {
    void (async () => {
      try {
        if (closeError) {
          logger.error({ err: closeError }, 'HTTP server shutdown failed');
          process.exitCode = 1;
        }

        await prisma.$disconnect();

        if (!closeError) {
          logger.info('API shutdown completed');
        }
      } catch (error) {
        logger.error({ err: error }, 'Database disconnect failed');
        process.exitCode = 1;
      } finally {
        clearTimeout(timeout);
      }
    })();
  });
}

process.once('SIGINT', () => {
  shutdown('SIGINT');
});

process.once('SIGTERM', () => {
  shutdown('SIGTERM');
});
