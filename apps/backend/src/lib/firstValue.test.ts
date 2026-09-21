import { describe, expect, it, vi } from 'vitest';
import { recordFirstValue } from './firstValue.js';

describe('recordFirstValue', () => {
  it('does not count sample content', async () => {
    const updateMany = vi.fn();
    const db = { user: { updateMany } } as never;
    await expect(
      recordFirstValue(db, {
        userId: 'u1',
        canvasId: 'canvas-sample',
        codingId: 'coding-sample',
        transcriptId: 'transcript-sample',
        transcriptSourceType: 'sample',
        codingSource: 'sample',
        recordedAt: new Date('2026-09-21T10:00:00.000Z'),
      }),
    ).resolves.toBe(false);
    expect(updateMany).not.toHaveBeenCalled();
  });

  it('writes an identifier-only marker once for a genuine saved coding', async () => {
    const updateMany = vi.fn().mockResolvedValue({ count: 1 });
    const db = { user: { updateMany } } as never;
    const recordedAt = new Date('2026-09-21T10:00:00.000Z');

    await expect(
      recordFirstValue(db, {
        userId: 'u1',
        canvasId: 'canvas-1',
        codingId: 'coding-1',
        transcriptId: 'transcript-1',
        transcriptSourceType: 'upload',
        codingSource: 'human',
        recordedAt,
      }),
    ).resolves.toBe(true);

    expect(updateMany).toHaveBeenCalledWith({
      where: { id: 'u1', firstValueAt: null },
      data: {
        firstValueAt: recordedAt,
        firstValueCanvasId: 'canvas-1',
        firstValueEvidence: JSON.stringify({
          kind: 'first_real_coding',
          canvasId: 'canvas-1',
          codingId: 'coding-1',
          transcriptId: 'transcript-1',
          recordedAt: recordedAt.toISOString(),
        }),
        onboardingCompletedAt: recordedAt,
      },
    });
  });
});
