import { randomUUID } from 'node:crypto';

import { afterAll, afterEach, describe, expect, it } from '@jest/globals';

import { UniqueConstraintConflictError } from '../../src/application/errors/unique-constraint-conflict.error.js';
import type { AcceptArticleCommand } from '../../src/application/ports/article-acceptance.repository.js';
import { createAcceptArticleRequest } from '../../src/application/use-cases/accept-article-request.js';
import { createPrismaClient } from '../../src/database/prisma.js';
import { PrismaArticleAcceptanceRepository } from '../../src/database/repositories/prisma-article-acceptance.repository.js';

const databaseUrl = process.env['DATABASE_URL'];

if (!databaseUrl) {
  throw new Error('DATABASE_URL is required for database tests');
}

if (process.env['NODE_ENV'] !== 'test') {
  throw new Error('Database tests require NODE_ENV=test');
}

const databaseName = new URL(databaseUrl).pathname.slice(1);

if (!['articleflow_test', 'articleflow_ci'].includes(databaseName)) {
  throw new Error('Database tests require an approved test database');
}

// Construct the actual database infrastructure and application use case.
const prisma = createPrismaClient(databaseUrl);
const repository = new PrismaArticleAcceptanceRepository(prisma);
const acceptArticleRequest = createAcceptArticleRequest(repository);

const testUsers: bigint[] = [];

function uniqueTelegramId(): bigint {
  const hex = randomUUID().replaceAll('-', '').slice(0, 13);
  return BigInt(`0x${hex}`);
}

function makeRequest(): AcceptArticleCommand {
  const telegramUserId = uniqueTelegramId();

  testUsers.push(telegramUserId);

  return {
    updateId: uniqueTelegramId(),
    telegramUserId,
    chatId: telegramUserId,
    brief: 'Write an article about fintech architecture',
  };
}

// Clean up only records created for this test's users.
afterEach(async () => {
  try {
    for (const telegramUserId of testUsers) {
      const user = await prisma.user.findUnique({
        where: { telegramUserId },
        select: { id: true },
      });

      if (!user) {
        continue;
      }

      await prisma.$transaction(async (tx) => {
        const jobs = await tx.agentJob.findMany({
          where: { userId: user.id },
          select: { id: true },
        });

        await tx.outboxEvent.deleteMany({
          where: {
            aggregateId: {
              in: jobs.map((job) => job.id),
            },
          },
        });

        await tx.agentJob.deleteMany({
          where: { userId: user.id },
        });

        await tx.telegramUpdate.deleteMany({
          where: { userId: user.id },
        });

        await tx.user.delete({
          where: { id: user.id },
        });
      });
    }
  } finally {
    testUsers.length = 0;
  }
});

afterAll(async () => {
  await prisma.$disconnect();
});

describe('acceptArticleRequest', () => {
  it('atomically creates a user, update, job and outbox event', async () => {
    const input = makeRequest();

    const result = await acceptArticleRequest(input);

    expect(result.kind).toBe('created');

    const user = await prisma.user.findUnique({
      where: { telegramUserId: input.telegramUserId },
    });

    const update = await prisma.telegramUpdate.findUnique({
      where: { updateId: input.updateId },
    });

    const job = await prisma.agentJob.findUnique({
      where: { id: result.jobId },
    });

    const events = await prisma.outboxEvent.findMany({
      where: { aggregateId: result.jobId },
    });

    expect(user).not.toBeNull();
    expect(update).not.toBeNull();

    expect(job).toMatchObject({
      id: result.jobId,
      status: 'CREATED',
      idempotencyKey: `telegram:article:${input.updateId.toString()}`,
      requestJson: {
        kind: 'article',
        brief: input.brief,
      },
    });

    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({
      eventType: 'AgentJobCreated',
      status: 'PENDING',
      payload: {
        jobId: result.jobId,
      },
    });
  });

  it('returns the same job for a repeated Telegram update', async () => {
    const input = makeRequest();

    const first = await acceptArticleRequest(input);
    const second = await acceptArticleRequest(input);

    expect(first.kind).toBe('created');

    expect(second).toEqual({
      kind: 'duplicate',
      jobId: first.jobId,
    });

    expect(
      await prisma.agentJob.count({
        where: {
          idempotencyKey: `telegram:article:${input.updateId.toString()}`,
        },
      }),
    ).toBe(1);

    expect(
      await prisma.outboxEvent.count({
        where: { aggregateId: first.jobId },
      }),
    ).toBe(1);
  });

  it('creates only one job during concurrent duplicate delivery', async () => {
    const input = makeRequest();

    const results = await Promise.all(Array.from({ length: 5 }, () => acceptArticleRequest(input)));

    const firstResult = results[0];

    if (!firstResult) {
      throw new Error('Expected at least one acceptance result');
    }

    expect(results.filter((result) => result.kind === 'created')).toHaveLength(1);

    expect(results.filter((result) => result.kind === 'duplicate')).toHaveLength(4);

    expect(new Set(results.map((result) => result.jobId)).size).toBe(1);

    expect(
      await prisma.telegramUpdate.count({
        where: { updateId: input.updateId },
      }),
    ).toBe(1);

    expect(
      await prisma.outboxEvent.count({
        where: { aggregateId: firstResult.jobId },
      }),
    ).toBe(1);
  });

  it('accepts distinct updates from the same user', async () => {
    const firstInput = makeRequest();

    const secondInput: AcceptArticleCommand = {
      ...firstInput,
      updateId: uniqueTelegramId(),
      brief: 'Write an article about payment systems',
    };

    const results = await Promise.all([
      acceptArticleRequest(firstInput),
      acceptArticleRequest(secondInput),
    ]);

    expect(results.map((result) => result.kind)).toEqual(['created', 'created']);

    expect(new Set(results.map((result) => result.jobId)).size).toBe(2);

    expect(
      await prisma.telegramUpdate.count({
        where: {
          updateId: {
            in: [firstInput.updateId, secondInput.updateId],
          },
        },
      }),
    ).toBe(2);
  });

  it('rejects a conflicting Telegram update from a different user', async () => {
    const firstInput = makeRequest();
    const conflictingInput = makeRequest();

    const firstResult = await acceptArticleRequest(firstInput);

    // Simulate the same update ID arriving with a different sender.
    const secondRequest: AcceptArticleCommand = {
      ...conflictingInput,
      updateId: firstInput.updateId,
    };

    await expect(acceptArticleRequest(secondRequest)).rejects.toBeInstanceOf(
      UniqueConstraintConflictError,
    );

    // Only the original accepted job must exist.
    expect(
      await prisma.agentJob.count({
        where: {
          idempotencyKey: `telegram:article:${firstInput.updateId.toString()}`,
        },
      }),
    ).toBe(1);

    expect(
      await prisma.outboxEvent.count({
        where: { aggregateId: firstResult.jobId },
      }),
    ).toBe(1);

    // The conflicting transaction must not persist a second user.
    expect(
      await prisma.user.findUnique({
        where: { telegramUserId: conflictingInput.telegramUserId },
      }),
    ).toBeNull();
  });
});
