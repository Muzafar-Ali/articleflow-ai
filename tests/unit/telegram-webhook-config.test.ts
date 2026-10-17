import { describe, expect, it } from '@jest/globals';
import { loadTelegramWebhookConfig } from '../../src/config/telegram-webhook-config.js';

describe('loadTelegramWebhookConfig', () => {
  it('accepts a valid Telegram webhook secret', () => {
    const secret = 'A'.repeat(40);

    expect(
      loadTelegramWebhookConfig({
        TELEGRAM_WEBHOOK_SECRET: secret,
      }),
    ).toEqual({
      secret,
    });
  });

  it('rejects a missing secret', () => {
    expect(() => loadTelegramWebhookConfig({})).toThrow(
      'Invalid Telegram webhook secret configuration',
    );
  });

  it('rejects a secret shorter than 32 characters', () => {
    expect(() =>
      loadTelegramWebhookConfig({
        TELEGRAM_WEBHOOK_SECRET: 'too-short',
      }),
    ).toThrow('Invalid Telegram webhook secret configuration');
  });

  it('rejects unsupported characters', () => {
    expect(() =>
      loadTelegramWebhookConfig({
        TELEGRAM_WEBHOOK_SECRET: `${'A'.repeat(40)}!`,
      }),
    ).toThrow('Invalid Telegram webhook secret configuration');
  });

  it('does not expose an invalid secret in errors', () => {
    const invalidSecret = `${'A'.repeat(40)}!`;

    expect(() =>
      loadTelegramWebhookConfig({
        TELEGRAM_WEBHOOK_SECRET: invalidSecret,
      }),
    ).toThrow('Invalid Telegram webhook secret configuration');

    try {
      loadTelegramWebhookConfig({
        TELEGRAM_WEBHOOK_SECRET: invalidSecret,
      });
    } catch (error) {
      expect((error as Error).message).not.toContain(invalidSecret);
    }
  });
});
