import { randomUUID } from 'node:crypto';
import { afterAll, describe, expect, it } from '@jest/globals';
import { createPrismaClient } from '../../src/database/prisma.js';

const databaseUrl = process.env['DATABASE_URL'];

if (!databaseUrl) {
  throw new Error('DATABASE_URL is required for database integration tests');
}

if (process.env['NODE_ENV'] !== 'test') {
  throw new Error('Database integration tests require NODE_ENV=test');
}

const databaseName = new URL(databaseUrl).pathname.slice(1);

if (!['articleflow_test', 'articleflow_ci'].includes(databaseName)) {
  throw new Error('Database integration tests require an approved test database');
}

const prisma = createPrismaClient(databaseUrl);

afterAll(async () => {
  await prisma.$disconnect();
});

function uniqueTelegramId(): bigint {
  const hex = randomUUID().replaceAll('-', '').slice(0, 15);
  return BigInt(`0x${hex}`);
}

describe('PostgreSQL constraints and transactions', () => {
  it('rejects duplicate Telegram updates and rolls back', async () => {
    const telegramUserId = uniqueTelegramId();
    const updateId = uniqueTelegramId();

    await expect(
      prisma.$transaction(async (tx) => {
        const user = await tx.user.create({
          data: { telegramUserId },
        });

        const data = {
          updateId,
          userId: user.id,
          chatId: telegramUserId,
        };

        await tx.telegramUpdate.create({ data });

        // The same Telegram update cannot be inserted twice.
        await tx.telegramUpdate.create({ data });
      }),
    ).rejects.toMatchObject({
      code: 'P2002',
    });

    expect(
      await prisma.telegramUpdate.count({
        where: { updateId },
      }),
    ).toBe(0);

    expect(
      await prisma.user.count({
        where: { telegramUserId },
      }),
    ).toBe(0);
  });

  it('rejects duplicate job idempotency keys', async () => {
    const telegramUserId = uniqueTelegramId();
    const idempotencyKey = `test:${randomUUID()}`;

    await expect(
      prisma.$transaction(async (tx) => {
        const user = await tx.user.create({
          data: { telegramUserId },
        });

        const firstUpdate = await tx.telegramUpdate.create({
          data: {
            updateId: uniqueTelegramId(),
            chatId: telegramUserId,
            userId: user.id,
          },
        });

        const secondUpdate = await tx.telegramUpdate.create({
          data: {
            updateId: uniqueTelegramId(),
            chatId: telegramUserId,
            userId: user.id,
          },
        });

        await tx.agentJob.create({
          data: {
            userId: user.id,
            sourceUpdateId: firstUpdate.id,
            idempotencyKey,
            requestJson: { topic: 'First article' },
          },
        });

        await tx.agentJob.create({
          data: {
            userId: user.id,
            sourceUpdateId: secondUpdate.id,
            idempotencyKey,
            requestJson: { topic: 'Duplicate article' },
          },
        });
      }),
    ).rejects.toMatchObject({
      code: 'P2002',
    });

    expect(
      await prisma.agentJob.count({
        where: { idempotencyKey },
      }),
    ).toBe(0);
  });

  it('rolls back job acceptance if outbox insertion fails', async () => {
    const telegramUserId = uniqueTelegramId();
    const updateId = uniqueTelegramId();
    const idempotencyKey = `test:${randomUUID()}`;
    const eventId = randomUUID();

    await expect(
      prisma.$transaction(async (tx) => {
        const user = await tx.user.create({
          data: { telegramUserId },
        });

        const update = await tx.telegramUpdate.create({
          data: {
            updateId,
            chatId: telegramUserId,
            userId: user.id,
          },
        });

        const job = await tx.agentJob.create({
          data: {
            userId: user.id,
            sourceUpdateId: update.id,
            idempotencyKey,
            requestJson: {
              topic: 'Atomic transaction verification',
            },
          },
        });

        const eventData = {
          id: eventId,
          aggregateType: 'agent_job',
          aggregateId: job.id,
          eventType: 'AgentJobCreated',
          payload: { jobId: job.id },
        };

        await tx.outboxEvent.create({
          data: eventData,
        });

        // Deliberately violate the outbox primary key.
        await tx.outboxEvent.create({
          data: eventData,
        });
      }),
    ).rejects.toMatchObject({
      code: 'P2002',
    });

    // None of the transaction's changes should survive.
    expect(
      await prisma.user.count({
        where: { telegramUserId },
      }),
    ).toBe(0);

    expect(
      await prisma.telegramUpdate.count({
        where: { updateId },
      }),
    ).toBe(0);

    expect(
      await prisma.agentJob.count({
        where: { idempotencyKey },
      }),
    ).toBe(0);

    expect(
      await prisma.outboxEvent.count({
        where: { id: eventId },
      }),
    ).toBe(0);
  });
});
