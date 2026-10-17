import { z } from 'zod';

// Telegram allows letters, digits, underscores and hyphens.
// ArticleFlow requires a secret length of 32–256 characters.
export const TELEGRAM_WEBHOOK_SECRET_PATTERN = /^[A-Za-z0-9_-]{32,256}$/;

const telegramWebhookConfigSchema = z.object({
  TELEGRAM_WEBHOOK_SECRET: z.string().regex(TELEGRAM_WEBHOOK_SECRET_PATTERN),
});

export interface TelegramWebhookConfig {
  readonly secret: string;
}

export function loadTelegramWebhookConfig(
  env: NodeJS.ProcessEnv = process.env,
): TelegramWebhookConfig {
  const result = telegramWebhookConfigSchema.safeParse(env);

  if (!result.success) {
    // Never include the configured secret in error messages.
    throw new Error('Invalid Telegram webhook secret configuration');
  }

  return Object.freeze({
    secret: result.data.TELEGRAM_WEBHOOK_SECRET,
  });
}
