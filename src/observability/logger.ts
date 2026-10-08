import pino from 'pino';

import type { Logger } from 'pino';
import type { AppConfig } from '../config/environment.js';

type ServiceName = 'articleflow-api' | 'articleflow-worker';

export function createLogger(config: AppConfig, service: ServiceName): Logger {
  return pino({
    level: config.logLevel,

    base: {
      service,
      appVersion: config.appVersion,
    },

    redact: {
      paths: [
        'req.headers.authorization',
        'req.headers.cookie',
        'req.headers["x-telegram-bot-api-secret-token"]',
      ],
      censor: '[REDACTED]',
    },
  });
}
