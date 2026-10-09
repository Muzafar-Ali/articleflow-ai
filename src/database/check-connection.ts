import { createPrismaClient } from './prisma.js';

const databaseUrl = process.env['DATABASE_URL'];

if (!databaseUrl) {
  throw new Error('DATABASE_URL environment variable is required');
}

const prisma = createPrismaClient(databaseUrl);

try {
  // Establish database connectivity.
  await prisma.$connect();

  // Execute a real PostgreSQL query.
  const result = await prisma.$queryRaw<Array<{ connected: number }>>`SELECT 1::int AS connected`;

  if (result.length !== 1 || result[0]?.connected !== 1) {
    throw new Error('Unexpected database health-check result');
  }

  console.log('PostgreSQL connection verified successfully');
} finally {
  // Always release database connections.
  await prisma.$disconnect();
}
