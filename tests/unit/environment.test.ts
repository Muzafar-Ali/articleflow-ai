import { describe, expect, it } from '@jest/globals';

import { loadConfig } from '../../src/config/environment.js';

describe('loadConfig', () => {
  it('loads valid application configuration', () => {
    const config = loadConfig({
      NODE_ENV: 'production',
      APP_VERSION: '1.2.3',
      LOG_LEVEL: 'warn',
    });

    expect(config).toEqual({
      environment: 'production',
      appVersion: '1.2.3',
      logLevel: 'warn',
      port: 3000,
    });
  });

  it('uses safe defaults for optional configuration', () => {
    const config = loadConfig({
      NODE_ENV: 'development',
    });

    expect(config.appVersion).toBe('1.0.0');
    expect(config.logLevel).toBe('info');
  });

  it('rejects an invalid NODE_ENV value', () => {
    expect(() =>
      loadConfig({
        NODE_ENV: 'staging',
      }),
    ).toThrow('NODE_ENV');
  });

  it('rejects configuration when NODE_ENV is missing', () => {
    expect(() => loadConfig({})).toThrow('Invalid application configuration');
  });

  it('returns immutable configuration', () => {
    const config = loadConfig({
      NODE_ENV: 'test',
    });

    expect(Object.isFrozen(config)).toBe(true);
  });

  it('rejects an invalid HTTP port', () => {
    expect(() =>
      loadConfig({
        NODE_ENV: 'development',
        PORT: '70000',
      }),
    ).toThrow('PORT');
  });

  it('accepts a valid configured HTTP port', () => {
    const config = loadConfig({
      NODE_ENV: 'test',
      PORT: '4000',
    });

    expect(config.port).toBe(4000);
  });
});
