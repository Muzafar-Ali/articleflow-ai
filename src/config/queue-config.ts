import { z } from 'zod';

const redisUrlSchema = z
  .string()
  .min(1)
  .refine((value) => {
    try {
      const url = new URL(value);

      return ['redis:', 'rediss:'].includes(url.protocol) && url.hostname.length > 0;
    } catch {
      return false;
    }
  });

export interface QueueConfig {
  readonly redisUrl: string;
}

export function loadQueueConfig(env: NodeJS.ProcessEnv = process.env): QueueConfig {
  const result = redisUrlSchema.safeParse(env['REDIS_URL']);

  if (!result.success) {
    throw new Error('REDIS_URL must be a valid redis:// or rediss:// URL');
  }

  return Object.freeze({
    redisUrl: result.data,
  });
}
