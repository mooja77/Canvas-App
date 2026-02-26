import { PrismaClient } from '@prisma/client';

export const prisma = new PrismaClient({
  log: process.env.NODE_ENV === 'production'
    ? ['warn', 'error']
    : ['warn', 'error'],
});

// Enable WAL mode for better concurrent read performance and busy timeout
prisma.$executeRawUnsafe('PRAGMA journal_mode=WAL;').catch(() => {});
prisma.$executeRawUnsafe('PRAGMA busy_timeout=5000;').catch(() => {});
