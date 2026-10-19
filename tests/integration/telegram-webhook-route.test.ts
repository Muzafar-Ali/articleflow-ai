import { describe, expect, it } from '@jest/globals';
import request from 'supertest';

import { createApp } from '../../src/api/app.js';
import type { ApiErrorContext } from '../../src/api/middleware/api-error-handler.js';
import { DependencyUnavailableError } from '../../src/application/errors/dependency-unavailable.error.js';
import type { AcceptArticleCommand } from '../../src/application/ports/article-acceptance.repository.js';

const SECRET = 'A'.repeat(40);
const HEADER = 'X-Telegram-Bot-Api-Secret-Token';

const validUpdate = {
  update_id: 123456,
  message: {
    message_id: 10,
    from: { id: 987654321 },
    chat: { id: 987654321 },
    text: '/article Write about fintech',
  },
};

interface ErrorReport {
  error: unknown;
  context: ApiErrorContext;
}

describe('Telegram webhook route', () => {
  it('returns the job ID after successful acceptance', async () => {
    const accepted: AcceptArticleCommand[] = [];
    const errors: unknown[] = [];

    const app = createApp({
      telegram: {
        secret: SECRET,

        acceptArticle: (command) => {
          accepted.push(command);

          return Promise.resolve({
            kind: 'created' as const,
            jobId: 'job-123',
          });
        },

        onError: (error) => {
          errors.push(error);
        },
      },
    });

    const response = await request(app)
      .post('/webhooks/telegram')
      .set(HEADER, SECRET)
      .send(validUpdate);

    expect(response.status).toBe(200);

    expect(response.body).toEqual({
      method: 'sendMessage',
      chat_id: '987654321',
      text: 'Article request accepted.\n' + 'Job ID: job-123\n' + 'Status: awaiting processing.',
    });

    expect(accepted).toHaveLength(1);

    expect(accepted[0]).toEqual({
      updateId: 123456n,
      telegramUserId: 987654321n,
      chatId: 987654321n,
      brief: 'Write about fintech',
    });

    expect(errors).toHaveLength(0);
    expect(typeof response.headers['x-request-id']).toBe('string');
  });

  it('returns the existing job ID for a duplicate', async () => {
    const app = createApp({
      telegram: {
        secret: SECRET,

        acceptArticle: () =>
          Promise.resolve({
            kind: 'duplicate' as const,
            jobId: 'existing-job-123',
          }),

        onError: () => {},
      },
    });

    const response = await request(app)
      .post('/webhooks/telegram')
      .set(HEADER, SECRET)
      .send(validUpdate);

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      method: 'sendMessage',
      chat_id: '987654321',
      text:
        'Article request accepted.\n' +
        'Job ID: existing-job-123\n' +
        'Status: awaiting processing.',
    });
  });

  it('returns HTTP 500 for an unexpected acceptance failure', async () => {
    const reports: ErrorReport[] = [];

    const app = createApp({
      telegram: {
        secret: SECRET,

        acceptArticle: () => Promise.reject(new Error('Simulated unexpected database failure')),

        onError: (error, context) => {
          reports.push({ error, context });
        },
      },
    });

    const response = await request(app)
      .post('/webhooks/telegram')
      .set(HEADER, SECRET)
      .send(validUpdate);

    expect(response.status).toBe(500);
    expect(response.body).not.toHaveProperty('method');

    const requestId: unknown = response.headers['x-request-id'];

    expect(typeof requestId).toBe('string');

    expect(response.body).toEqual({
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Request processing failed',
        requestId,
      },
    });

    expect(reports).toHaveLength(1);
    expect(reports[0]?.error).toBeInstanceOf(Error);

    expect(reports[0]?.context).toEqual({
      requestId,
      statusCode: 500,
      errorCode: 'INTERNAL_ERROR',
    });

    // Internal exception details must not leak to the client.
    expect(JSON.stringify(response.body)).not.toContain('Simulated unexpected database failure');
  });

  it('returns HTTP 503 for a recognized PostgreSQL outage', async () => {
    const reports: ErrorReport[] = [];

    const app = createApp({
      telegram: {
        secret: SECRET,

        acceptArticle: () => Promise.reject(new DependencyUnavailableError('postgresql')),

        onError: (error, context) => {
          reports.push({ error, context });
        },
      },
    });

    const response = await request(app)
      .post('/webhooks/telegram')
      .set(HEADER, SECRET)
      .send(validUpdate);

    expect(response.status).toBe(503);
    expect(response.body).not.toHaveProperty('method');

    const requestId: unknown = response.headers['x-request-id'];

    expect(typeof requestId).toBe('string');

    expect(response.body).toEqual({
      error: {
        code: 'DEPENDENCY_UNAVAILABLE',
        message: 'Service temporarily unavailable',
        requestId,
      },
    });

    expect(reports).toHaveLength(1);

    expect(reports[0]?.error).toBeInstanceOf(DependencyUnavailableError);

    expect(reports[0]?.context).toEqual({
      requestId,
      statusCode: 503,
      errorCode: 'DEPENDENCY_UNAVAILABLE',
    });

    // Do not expose internal dependency details to the client.
    expect(JSON.stringify(response.body)).not.toContain('postgresql');
  });

  it('rejects requests without the webhook secret', async () => {
    const accepted: AcceptArticleCommand[] = [];

    const app = createApp({
      telegram: {
        secret: SECRET,

        acceptArticle: (command) => {
          accepted.push(command);

          return Promise.resolve({
            kind: 'created' as const,
            jobId: 'job-123',
          });
        },

        onError: () => {},
      },
    });

    const response = await request(app).post('/webhooks/telegram').send(validUpdate);

    expect(response.status).toBe(401);

    expect(response.body).toEqual({
      error: 'Unauthorized',
    });

    expect(accepted).toHaveLength(0);
  });

  it('rejects requests with an invalid webhook secret', async () => {
    const accepted: AcceptArticleCommand[] = [];

    const app = createApp({
      telegram: {
        secret: SECRET,

        acceptArticle: (command) => {
          accepted.push(command);

          return Promise.resolve({
            kind: 'created' as const,
            jobId: 'job-123',
          });
        },

        onError: () => {},
      },
    });

    const response = await request(app)
      .post('/webhooks/telegram')
      .set(HEADER, 'incorrect-webhook-secret')
      .send(validUpdate);

    expect(response.status).toBe(401);

    // Same response for missing and invalid credentials.
    expect(response.body).toEqual({
      error: 'Unauthorized',
    });

    expect(accepted).toHaveLength(0);
  });

  it('does not create jobs for unrelated Telegram commands', async () => {
    const accepted: AcceptArticleCommand[] = [];

    const app = createApp({
      telegram: {
        secret: SECRET,

        acceptArticle: (command) => {
          accepted.push(command);

          return Promise.resolve({
            kind: 'created' as const,
            jobId: 'job-123',
          });
        },

        onError: () => {},
      },
    });

    const response = await request(app)
      .post('/webhooks/telegram')
      .set(HEADER, SECRET)
      .send({
        ...validUpdate,
        message: {
          ...validUpdate.message,
          text: '/help',
        },
      });

    expect(response.status).toBe(200);

    expect(response.body).toEqual({
      status: 'ignored',
    });

    expect(accepted).toHaveLength(0);
  });
});
