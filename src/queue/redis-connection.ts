import { Redis } from 'ioredis';
import type { RedisOptions } from 'ioredis';

export type RedisConnectionRole = 'dispatcher' | 'worker';

export function getRedisConnectionOptions(role: RedisConnectionRole) {
  const isWorker = role === 'worker';

  return {
    lazyConnect: true,
    connectTimeout: 5_000,

    maxRetriesPerRequest: isWorker ? null : 1,
    enableOfflineQueue: isWorker,

    retryStrategy: (attempt: number) => Math.min(attempt * 200, 2_000),
  } satisfies RedisOptions;
}

export function createRedisConnection(redisUrl: string, role: RedisConnectionRole): Redis {
  return new Redis(redisUrl, getRedisConnectionOptions(role));
}
