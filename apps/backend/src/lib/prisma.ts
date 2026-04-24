import { PrismaClient } from '@prisma/client';
import { logWarn } from './logger.js';

// In dev or when DEBUG_QUERIES=true, emit slow queries (>200ms) so
// N+1s and full-table scans surface during development instead of in prod.
const debugQueries = process.env.NODE_ENV !== 'production' || process.env.DEBUG_QUERIES === 'true';

// The `Prisma.LogEvent` / `Prisma.QueryEvent` types aren't exported by the
// installed Prisma client version — define the runtime-payload shapes locally.
interface PrismaLogEvent {
  timestamp: Date;
  message: string;
  target: string;
}

interface PrismaQueryEvent {
  timestamp: Date;
  query: string;
  params: string;
  duration: number;
  target: string;
}

export const prisma = new PrismaClient({
  log: debugQueries
    ? [
        { level: 'warn', emit: 'event' },
        { level: 'error', emit: 'event' },
        { level: 'query', emit: 'event' },
      ]
    : [
        { level: 'warn', emit: 'event' },
        { level: 'error', emit: 'event' },
      ],
});

// eslint-disable-next-line @typescript-eslint/no-explicit-any
(prisma as any).$on('warn', (e: PrismaLogEvent) => {
  logWarn(`[prisma] ${e.message}`, { target: e.target });
});

// eslint-disable-next-line @typescript-eslint/no-explicit-any
(prisma as any).$on('error', (e: PrismaLogEvent) => {
  // Not re-thrown — this is prisma's own diagnostic emission, not the query failure itself.
  logWarn(`[prisma:error] ${e.message}`, { target: e.target });
});

if (debugQueries) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (prisma as any).$on('query', (e: PrismaQueryEvent) => {
    // 200ms threshold — below that, most queries are idle SELECTs and noise.
    if (e.duration > 200) {
      logWarn(`[prisma:slow] ${e.duration}ms`, {
        query: e.query,
        duration: e.duration,
        target: e.target,
      });
    }
  });
}
