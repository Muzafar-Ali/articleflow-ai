import { describe, expect, it } from '@jest/globals';
import { loadQueueConfig } from '../../src/config/queue-config.js';

describe('Queue configuration', () => {
  it('accepts a Redis URL', () => {
    expect(
      loadQueueConfig({
        REDIS_URL: 'redis://127.0.0.1:6379',
      }),
    ).toEqual({
      redisUrl: 'redis://127.0.0.1:6379',
    });
  });

  it('accepts a TLS Redis URL', () => {
    expect(
      loadQueueConfig({
        REDIS_URL: 'rediss://redis.example.com:6379',
      }).redisUrl,
    ).toBe('rediss://redis.example.com:6379');
  });

  it('rejects a missing Redis URL', () => {
    expect(() => loadQueueConfig({})).toThrow(
      'REDIS_URL must be a valid redis:// or rediss:// URL',
    );
  });

  it('rejects unsupported protocols', () => {
    expect(() =>
      loadQueueConfig({
        REDIS_URL: 'https://example.com',
      }),
    ).toThrow();
  });
});
