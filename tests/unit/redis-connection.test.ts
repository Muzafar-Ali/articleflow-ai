import { describe, expect, it } from '@jest/globals';
import { getRedisConnectionOptions } from '../../src/queue/redis-connection.js';

describe('Redis connection policies', () => {
  it('configures dispatcher commands to fail fast', () => {
    const options = getRedisConnectionOptions('dispatcher');

    expect(options.maxRetriesPerRequest).toBe(1);
    expect(options.enableOfflineQueue).toBe(false);
    expect(options.lazyConnect).toBe(true);
  });

  it('configures worker connections for recovery', () => {
    const options = getRedisConnectionOptions('worker');

    expect(options.maxRetriesPerRequest).toBeNull();
    expect(options.enableOfflineQueue).toBe(true);
    expect(options.lazyConnect).toBe(true);
  });
});
