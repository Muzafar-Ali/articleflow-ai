import { loadConfig } from '../config/environment.js';
import { createLogger } from '../observability/logger.js';
import { createApp } from './app.js';

const config = loadConfig();
const logger = createLogger(config, 'articleflow-api');

const app = createApp();

const server = app.listen(config.port, () => {
  logger.info({ port: config.port }, 'ArticleFlow API started');
});

server.on('error', (error: Error) => {
  logger.fatal({ err: error }, 'HTTP server error');
  process.exitCode = 1;
});

let shuttingDown = false;

function shutdown(signal: 'SIGINT' | 'SIGTERM'): void {
  if (shuttingDown) return;

  shuttingDown = true;

  logger.info({ signal }, 'API shutdown initiated');

  const timeout = setTimeout(() => {
    logger.fatal('API graceful shutdown timed out');
    process.exit(1);
  }, 10_000);

  timeout.unref();

  server.close((error) => {
    clearTimeout(timeout);

    if (error) {
      logger.error({ err: error }, 'API shutdown failed');
      process.exitCode = 1;
      return;
    }

    logger.info('API shutdown completed');
  });
}

process.once('SIGINT', () => {
  shutdown('SIGINT');
});

process.once('SIGTERM', () => {
  shutdown('SIGTERM');
});
