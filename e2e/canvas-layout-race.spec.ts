import { test, expect } from '@playwright/test';
import { PrismaClient } from '@prisma/client';
import { randomUUID } from 'node:crypto';
import { ownedAnalysisDatabase } from '../scripts/analysis-fixture-database.mjs';

test('a layout save returns 404 when the canvas is deleted during the save', async ({ request, baseURL }) => {
  if (!baseURL || !['localhost', '127.0.0.1'].includes(new URL(baseURL).hostname)) {
    throw new Error('Layout race fixture requires a local API');
  }
  const db = new PrismaClient({ datasources: { db: { url: ownedAnalysisDatabase() } } });
  const headers = { Origin: new URL(baseURL).origin };
  let canvasId: string | undefined;
  try {
    const created = await request.post('/api/canvas', {
      headers,
      data: { name: 'Layout race ' + randomUUID() },
    });
    expect(created.status()).toBe(201);
    canvasId = (await created.json()).data.id as string;
    const layout = '/api/canvas/' + canvasId + '/layout';
    const positions = [{ nodeId: 'pending-memo', nodeType: 'memo', x: 10, y: 20 }];

    let save: ReturnType<typeof request.put> | undefined;
    try {
      await db.$transaction(
        async (tx) => {
          const [{ pid }] = await tx.$queryRaw<{ pid: number }[]>`SELECT pg_backend_pid() AS pid`;
          await tx.codingCanvas.delete({ where: { id: canvasId } });

          // The route can still read the committed canvas. The write must wait
          // for this deletion to commit before PostgreSQL checks the foreign key.
          save = request.put(layout, { headers, data: { positions }, timeout: 15_000 });
          await expect
            .poll(
              async () => {
                const [{ blocked }] = await db.$queryRaw<{ blocked: boolean }[]>`
                SELECT EXISTS (
                  SELECT 1 FROM pg_stat_activity
                  WHERE ${pid} = ANY(pg_blocking_pids(pid))
                    AND query LIKE '%"CanvasNodePosition"%'
                ) AS blocked`;
                return blocked;
              },
              { timeout: 8000, message: 'the in-flight layout write is waiting for the canvas deletion' },
            )
            .toBe(true);
        },
        { timeout: 12_000 },
      );

      const response = await save!;
      expect(response.status()).toBe(404);
      expect(await response.json()).toMatchObject({ success: false, error: 'Canvas not found' });

      const staleSave = await request.put(layout, { headers, data: { positions } });
      expect(staleSave.status()).toBe(404);
      expect(await db.canvasNodePosition.count({ where: { canvasId } })).toBe(0);
    } finally {
      await save?.catch(() => undefined);
    }
  } finally {
    try {
      if (canvasId) await db.codingCanvas.deleteMany({ where: { id: canvasId } });
    } finally {
      await db.$disconnect();
    }
  }
});
