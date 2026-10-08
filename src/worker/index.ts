import { loadConfig } from '../config/environment.js';
import { createLogger } from '../observability/logger.js';

type ShutdownSignal = 'SIGINT' | 'SIGTERM';

const config = loadConfig();
const logger = createLogger(config, 'articleflow-worker');

logger.info({ environment: config.environment }, 'ArticleFlow worker initialized');

// Bootstrap-only heartbeat.
// Keeps the process alive until BullMQ is introduced in M3.
const heartbeat = setInterval(() => {
  logger.debug('Worker idle: awaiting BullMQ integration');
}, 60_000);

let shuttingDown = false;

function shutdown(signal: ShutdownSignal): void {
  if (shuttingDown) {
    return;
  }

  shuttingDown = true;

  logger.info({ signal }, 'Worker shutdown initiated');

  clearInterval(heartbeat);

  // Future BullMQ and database connections will be
  // closed here before completing shutdown.

  logger.info('Worker shutdown completed');
}

process.once('SIGINT', () => {
  shutdown('SIGINT');
});

process.once('SIGTERM', () => {
  shutdown('SIGTERM');
});
