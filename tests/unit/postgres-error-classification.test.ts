import { describe, expect, it } from '@jest/globals';

import { isPostgresUnavailableError } from '../../src/database/repositories/prisma-article-acceptance.repository.js';

function makePrismaError(code: string, message: string): Error {
  return Object.assign(new Error(message), { code });
}

describe('PostgreSQL failure classification', () => {
  it('recognizes a Prisma database connection error', () => {
    const error = makePrismaError('P1001', 'Database server unavailable');

    expect(isPostgresUnavailableError(error)).toBe(true);
  });

  it('recognizes a nested PostgreSQL driver connection error', () => {
    const driverError = makePrismaError('ECONNREFUSED', 'Connection refused');

    const error = new Error('Database query failed', {
      cause: driverError,
    });

    expect(isPostgresUnavailableError(error)).toBe(true);
  });

  it('recognizes a transaction startup timeout reported as P2028', () => {
    const error = makePrismaError(
      'P2028',
      'Transaction API error: Unable to start a transaction in the given time.',
    );

    expect(isPostgresUnavailableError(error)).toBe(true);
  });

  it('does not classify a closed transaction as a dependency outage', () => {
    const error = makePrismaError(
      'P2028',
      'Transaction already closed: A query cannot be executed on an expired transaction.',
    );

    expect(isPostgresUnavailableError(error)).toBe(false);
  });

  it('does not classify unrelated P2028 transaction errors as outages', () => {
    const error = makePrismaError('P2028', 'Transaction API error: Transaction not found.');

    expect(isPostgresUnavailableError(error)).toBe(false);
  });

  it('does not classify unique constraint violations as outages', () => {
    const error = makePrismaError('P2002', 'Unique constraint failed');

    expect(isPostgresUnavailableError(error)).toBe(false);
  });

  it('does not classify unknown errors as outages', () => {
    expect(isPostgresUnavailableError(new Error('Unexpected failure'))).toBe(false);
  });
});
