import { z } from 'zod';

import { APP_VERSION } from '../shared/app-metadata.js';

const nodeEnvironmentSchema = z.enum(['development', 'test', 'production']);

const logLevelSchema = z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent']);

const environmentSchema = z.object({
  NODE_ENV: nodeEnvironmentSchema,
  APP_VERSION: z.string().trim().min(1).default(APP_VERSION),
  LOG_LEVEL: logLevelSchema.default('info'),
  PORT: z.coerce.number().int().min(1).max(65535).default(3000),
});

export interface AppConfig {
  readonly environment: z.infer<typeof nodeEnvironmentSchema>;
  readonly appVersion: string;
  readonly logLevel: z.infer<typeof logLevelSchema>;
  readonly port: number;
}

export function loadConfig(environmentVariables: NodeJS.ProcessEnv = process.env): AppConfig {
  const result = environmentSchema.safeParse(environmentVariables);

  if (!result.success) {
    const details = result.error.issues
      .map((issue) => {
        const path = issue.path.length > 0 ? issue.path.join('.') : 'environment';
        return `${path}: ${issue.message}`;
      })
      .join('; ');

    throw new Error(`Invalid application configuration: ${details}`);
  }

  return Object.freeze({
    environment: result.data.NODE_ENV,
    appVersion: result.data.APP_VERSION,
    logLevel: result.data.LOG_LEVEL,
    port: result.data.PORT,
  });
}
