import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockPrisma } = vi.hoisted(() => ({
  mockPrisma: {
    user: { findUnique: vi.fn() },
    codingCanvas: { findMany: vi.fn() },
    canvasTextCoding: { groupBy: vi.fn() },
  },
}));

vi.mock('../lib/prisma.js', () => ({ prisma: mockPrisma }));

import { generateReport } from './reportGenerator.js';

/**
 * GET /canvas scopes a user's canvases three ways: owned via userId, owned via
 * the legacy DashboardAccess row, and shared with them as a collaborator.
 * Report generation scoped by userId alone, so a user whose canvas is plainly
 * listed in her UI got HTTP 200 and "No canvas activity this period" — a
 * missing-data bug dressed up as a success. These tests pin the two scopings
 * together.
 */

interface FakeCanvas {
  id: string;
  name: string;
  userId: string | null;
  dashboardAccessId: string;
  deletedAt: Date | null;
  collaboratorUserIds: string[];
}

const CANVASES: FakeCanvas[] = [
  {
    id: 'c-own',
    name: 'Owned Via UserId',
    userId: 'u1',
    dashboardAccessId: 'da-legacy',
    deletedAt: null,
    collaboratorUserIds: [],
  },
  {
    id: 'c-legacy',
    name: 'Owned Via Legacy Access Code',
    userId: null,
    dashboardAccessId: 'da-legacy',
    deletedAt: null,
    collaboratorUserIds: [],
  },
  {
    id: 'c-shared',
    name: 'Shared With Me',
    userId: 'u2',
    dashboardAccessId: 'da-other',
    deletedAt: null,
    collaboratorUserIds: ['u1'],
  },
  {
    id: 'c-other',
    name: 'Belongs To Someone Else',
    userId: 'u2',
    dashboardAccessId: 'da-other',
    deletedAt: null,
    collaboratorUserIds: [],
  },
  {
    id: 'c-trashed',
    name: 'Trashed Canvas',
    userId: 'u1',
    dashboardAccessId: 'da-legacy',
    deletedAt: new Date('2026-01-01'),
    collaboratorUserIds: [],
  },
];

/** Minimal evaluator for the subset of Prisma `where` syntax this query uses. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function matchesWhere(canvas: FakeCanvas, where: any): boolean {
  for (const [key, value] of Object.entries(where ?? {})) {
    if (key === 'OR') {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      if (!(value as any[]).some((branch) => matchesWhere(canvas, branch))) return false;
      continue;
    }
    if (key === 'collaborators') {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const wanted = (value as any).some?.userId;
      if (!canvas.collaboratorUserIds.includes(wanted)) return false;
      continue;
    }
    if (key === 'deletedAt') {
      if (value === null && canvas.deletedAt !== null) return false;
      continue;
    }
    if ((canvas as unknown as Record<string, unknown>)[key] !== value) return false;
  }
  return true;
}

function toPrismaShape(canvas: FakeCanvas) {
  return {
    ...canvas,
    _count: { codings: 3, collaborators: canvas.collaboratorUserIds.length },
    codings: [],
    questions: [],
  };
}

describe('generateReport canvas scoping', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPrisma.user.findUnique.mockResolvedValue({
      name: 'Rita Researcher',
      email: 'rita@example.edu',
      dashboardAccess: { id: 'da-legacy' },
    });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    mockPrisma.codingCanvas.findMany.mockImplementation(async ({ where }: any) =>
      CANVASES.filter((c) => matchesWhere(c, where)).map(toPrismaShape),
    );
    mockPrisma.canvasTextCoding.groupBy.mockResolvedValue([]);
  });

  it('includes canvases the user owns via userId', async () => {
    const { html } = await generateReport('u1');
    expect(html).toContain('Owned Via UserId');
  });

  it('includes canvases owned via the legacy DashboardAccess row', async () => {
    const { html } = await generateReport('u1');
    expect(html).toContain('Owned Via Legacy Access Code');
  });

  it('includes canvases shared with the user as a collaborator', async () => {
    const { html } = await generateReport('u1');
    expect(html).toContain('Shared With Me');
  });

  it('does not report "no activity" when the user has visible canvases', async () => {
    const { html } = await generateReport('u1');
    expect(html).not.toContain('No canvas activity this period');
  });

  it('excludes canvases the user cannot see', async () => {
    const { html } = await generateReport('u1');
    expect(html).not.toContain('Belongs To Someone Else');
  });

  it('excludes trashed canvases', async () => {
    const { html } = await generateReport('u1');
    expect(html).not.toContain('Trashed Canvas');
  });

  it('scopes a single-canvas report to a shared canvas the user can see', async () => {
    const { html } = await generateReport('u1', 'c-shared');
    expect(html).toContain('Shared With Me');
    expect(html).not.toContain('Owned Via UserId');
  });

  it('still refuses a single-canvas report for a canvas the user cannot see', async () => {
    const { html } = await generateReport('u1', 'c-other');
    expect(html).toContain('No canvas activity this period');
    expect(html).not.toContain('Belongs To Someone Else');
  });

  it('works for users with no legacy DashboardAccess row', async () => {
    mockPrisma.user.findUnique.mockResolvedValue({
      name: 'New User',
      email: 'new@example.edu',
      dashboardAccess: null,
    });
    const { html } = await generateReport('u1');
    expect(html).toContain('Owned Via UserId');
    expect(html).not.toContain('Owned Via Legacy Access Code');
  });
});
