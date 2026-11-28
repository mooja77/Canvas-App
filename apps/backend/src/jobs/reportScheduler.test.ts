import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const { mockPrisma, sendEmail } = vi.hoisted(() => ({
  mockPrisma: {
    user: { findUnique: vi.fn() },
    codingCanvas: { findMany: vi.fn() },
    canvasTextCoding: { groupBy: vi.fn() },
    auditLog: { count: vi.fn() },
    reportSchedule: { findMany: vi.fn(), updateMany: vi.fn(), update: vi.fn() },
  },
  sendEmail: vi.fn(),
}));

vi.mock('../lib/prisma.js', () => ({ prisma: mockPrisma }));
vi.mock('../lib/email.js', () => ({ sendEmail }));
vi.mock('../lib/logger.js', () => ({ logError: vi.fn() }));

import { startReportScheduler, stopReportScheduler } from './reportScheduler.js';

describe('weekly report email (scheduler end to end)', () => {
  const quote = 'ZEBRA-QUOTE I told the nurse about my late husband';

  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();
    mockPrisma.auditLog.count.mockResolvedValue(0);
    mockPrisma.reportSchedule.findMany.mockResolvedValue([
      {
        id: 's1',
        userId: 'u1',
        canvasId: null,
        frequency: 'weekly',
        dayOfWeek: null,
        lastSent: null,
        user: { id: 'u1', name: 'Rita', email: 'rita@example.edu' },
      },
    ]);
    mockPrisma.reportSchedule.updateMany.mockResolvedValue({ count: 1 });
    mockPrisma.reportSchedule.update.mockResolvedValue({});
    mockPrisma.user.findUnique.mockResolvedValue({ name: 'Rita', email: 'rita@example.edu', dashboardAccess: null });
    mockPrisma.canvasTextCoding.groupBy.mockResolvedValue([{ canvasId: 'c1', _count: { _all: 2 } }]);
    mockPrisma.codingCanvas.findMany.mockResolvedValue([
      {
        id: 'c1',
        name: 'CANVAS-TITLE-QUOTE I told the nurse about my late husband',
        _count: { codings: 5, collaborators: 0 },
        codings: [{ codedText: 'LEAKCHECK-SEGMENT private words', createdAt: new Date() }],
        questions: [{ text: quote, _count: { codings: 3 } }],
      },
    ]);
    sendEmail.mockResolvedValue(true);
  });

  afterEach(() => {
    stopReportScheduler();
    vi.useRealTimers();
  });

  it('sends a count-only email without participant text for any plan', async () => {
    startReportScheduler();
    await vi.advanceTimersByTimeAsync(10_500);
    expect(sendEmail).toHaveBeenCalledTimes(1);
    const [to, subject, html] = sendEmail.mock.calls[0];
    expect(to).toBe('rita@example.edu');
    expect(subject).not.toContain('LEAKCHECK');
    expect(html).not.toContain('LEAKCHECK');
    expect(html).toContain('Open QualCanvas');
    expect(subject).not.toContain(quote);
    expect(html).not.toContain(quote);
    expect(html).not.toContain('CANVAS-TITLE-QUOTE');
    expect(html).toContain('>2<');
    expect(html).toContain('>5<');
    expect(html).toMatch(/href="[^"]*\/canvas\/c1"/);
    // No plan data is consulted: free and paid recipients get the same count-only report.
    expect(mockPrisma.user.findUnique.mock.calls[0][0].select).not.toHaveProperty('plan');
  });
});
