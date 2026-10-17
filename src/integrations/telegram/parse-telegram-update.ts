import { z } from 'zod';

// Telegram identifiers arrive as JSON numbers.
// Reject values outside JavaScript's safe integer range.
const safeIntegerSchema = z.number().int().refine(Number.isSafeInteger, {
  message: 'Expected a safe integer',
});

const telegramMessageSchema = z.object({
  message_id: safeIntegerSchema.nonnegative(),

  from: z
    .object({
      id: safeIntegerSchema.positive(),
    })
    .optional(),

  chat: z.object({
    // Group and supergroup chat IDs can be negative.
    id: safeIntegerSchema.refine((value) => value !== 0),
  }),

  text: z.string().max(4096).optional(),
});

export const telegramUpdateSchema = z.object({
  update_id: safeIntegerSchema.nonnegative(),
  message: telegramMessageSchema.optional(),
});

type MessageContext = {
  updateId: bigint;
  telegramUserId: bigint;
  chatId: bigint;
};

export type ParsedTelegramUpdate =
  | (MessageContext & {
      kind: 'article';
      brief: string;
    })
  | (MessageContext & {
      kind: 'command';
      command: 'start' | 'help';
    })
  | (MessageContext & {
      kind: 'invalid_article';
      reason: 'missing_brief';
    })
  | {
      kind: 'ignored';
      updateId: bigint;
      reason: 'unsupported_update' | 'missing_sender' | 'non_text' | 'unsupported_command';
    };

export function parseTelegramUpdate(input: unknown): ParsedTelegramUpdate {
  const update = telegramUpdateSchema.parse(input);
  const updateId = BigInt(update.update_id);
  const message = update.message;

  if (!message) {
    return {
      kind: 'ignored',
      updateId,
      reason: 'unsupported_update',
    };
  }

  if (!message.from) {
    return {
      kind: 'ignored',
      updateId,
      reason: 'missing_sender',
    };
  }

  if (message.text === undefined) {
    return {
      kind: 'ignored',
      updateId,
      reason: 'non_text',
    };
  }

  const context: MessageContext = {
    updateId,
    telegramUserId: BigInt(message.from.id),
    chatId: BigInt(message.chat.id),
  };

  const text = message.text.trim();

  if (text === '/start' || text === '/help') {
    return {
      ...context,
      kind: 'command',
      command: text === '/start' ? 'start' : 'help',
    };
  }

  const articleMatch = /^\/article(?:\s+([\s\S]*))?$/.exec(text);

  if (articleMatch) {
    const brief = articleMatch[1]?.trim() ?? '';

    if (brief.length === 0) {
      return {
        ...context,
        kind: 'invalid_article',
        reason: 'missing_brief',
      };
    }

    return {
      ...context,
      kind: 'article',
      brief,
    };
  }

  return {
    kind: 'ignored',
    updateId,
    reason: 'unsupported_command',
  };
}
