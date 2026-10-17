import { describe, expect, it } from '@jest/globals';
import { parseTelegramUpdate } from '../../src/integrations/telegram/parse-telegram-update.js';

function makeUpdate(text?: string) {
  return {
    update_id: 123456,
    message: {
      message_id: 10,
      from: { id: 987654321 },
      chat: { id: -1001234567890 },
      ...(text === undefined ? {} : { text }),
    },
  };
}

describe('parseTelegramUpdate', () => {
  it('parses a valid article request', () => {
    expect(parseTelegramUpdate(makeUpdate('/article Write about AI agents'))).toEqual({
      kind: 'article',
      updateId: 123456n,
      telegramUserId: 987654321n,
      chatId: -1001234567890n,
      brief: 'Write about AI agents',
    });
  });

  it('preserves large safe Telegram identifiers', () => {
    const input = {
      ...makeUpdate('/article Test'),
      message: {
        ...makeUpdate('/article Test').message,
        from: {
          id: Number.MAX_SAFE_INTEGER,
        },
      },
    };

    const result = parseTelegramUpdate(input);

    expect(result).toMatchObject({
      kind: 'article',
      telegramUserId: 9007199254740991n,
    });
  });

  it('supports multiline article briefs', () => {
    const result = parseTelegramUpdate(
      makeUpdate('/article Write about fintech\nInclude payment architecture'),
    );

    expect(result).toMatchObject({
      kind: 'article',
      brief: 'Write about fintech\nInclude payment architecture',
    });
  });

  it('rejects article commands without a brief', () => {
    expect(parseTelegramUpdate(makeUpdate('/article   '))).toMatchObject({
      kind: 'invalid_article',
      reason: 'missing_brief',
    });
  });

  it('recognizes the start command', () => {
    expect(parseTelegramUpdate(makeUpdate('/start'))).toMatchObject({
      kind: 'command',
      command: 'start',
    });
  });

  it('recognizes the help command', () => {
    expect(parseTelegramUpdate(makeUpdate('/help'))).toMatchObject({
      kind: 'command',
      command: 'help',
    });
  });

  it('ignores unsupported commands', () => {
    expect(parseTelegramUpdate(makeUpdate('/unknown'))).toMatchObject({
      kind: 'ignored',
      reason: 'unsupported_command',
    });
  });

  it('does not accept commands addressed to another bot', () => {
    expect(parseTelegramUpdate(makeUpdate('/article@OtherBot Write an article'))).toMatchObject({
      kind: 'ignored',
      reason: 'unsupported_command',
    });
  });

  it('ignores non-message updates', () => {
    expect(
      parseTelegramUpdate({
        update_id: 123456,
        edited_message: {},
      }),
    ).toEqual({
      kind: 'ignored',
      updateId: 123456n,
      reason: 'unsupported_update',
    });
  });

  it('ignores messages without text', () => {
    expect(parseTelegramUpdate(makeUpdate())).toMatchObject({
      kind: 'ignored',
      reason: 'non_text',
    });
  });

  it('rejects unsafe Telegram identifiers', () => {
    const input = {
      ...makeUpdate('/article Test'),
      message: {
        ...makeUpdate('/article Test').message,
        from: {
          id: Number.MAX_SAFE_INTEGER + 1,
        },
      },
    };

    expect(() => parseTelegramUpdate(input)).toThrow();
  });

  it('rejects malformed Telegram message structures', () => {
    expect(() =>
      parseTelegramUpdate({
        update_id: 123456,
        message: {
          from: { id: 123 },
          text: '/article Test',
          // Required message_id and chat are missing.
        },
      }),
    ).toThrow();
  });
});
