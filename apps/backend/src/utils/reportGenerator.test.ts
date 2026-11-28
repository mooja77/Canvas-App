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
    expect(html).toMatch(/href="[^"]*\/canvas\/c-own"/);
  });

  it('includes canvases owned via the legacy DashboardAccess row', async () => {
    const { html } = await generateReport('u1');
    expect(html).toMatch(/href="[^"]*\/canvas\/c-legacy"/);
  });

  it('includes canvases shared with the user as a collaborator', async () => {
    const { html } = await generateReport('u1');
    expect(html).toMatch(/href="[^"]*\/canvas\/c-shared"/);
  });

  it('does not report "no activity" when the user has visible canvases', async () => {
    const { html } = await generateReport('u1');
    expect(html).not.toContain('No canvas activity this period');
  });

  it('excludes canvases the user cannot see', async () => {
    const { html } = await generateReport('u1');
    expect(html).not.toMatch(/href="[^"]*\/canvas\/c-other"/);
  });

  it('excludes trashed canvases', async () => {
    const { html } = await generateReport('u1');
    expect(html).not.toMatch(/href="[^"]*\/canvas\/c-trashed"/);
  });

  it('scopes a single-canvas report to a shared canvas the user can see', async () => {
    const { html } = await generateReport('u1', 'c-shared');
    expect(html).toMatch(/href="[^"]*\/canvas\/c-shared"/);
    expect(html).not.toMatch(/href="[^"]*\/canvas\/(c-own|c-legacy)"/);
  });

  it('still refuses a single-canvas report for a canvas the user cannot see', async () => {
    const { html } = await generateReport('u1', 'c-other');
    expect(html).toContain('No canvas activity this period');
    expect(html).not.toMatch(/href="[^"]*\/canvas\/c-other"/);
  });

  it('works for users with no legacy DashboardAccess row', async () => {
    mockPrisma.user.findUnique.mockResolvedValue({
      name: 'New User',
      email: 'new@example.edu',
      dashboardAccess: null,
    });
    const { html } = await generateReport('u1');
    expect(html).toMatch(/href="[^"]*\/canvas\/c-own"/);
    expect(html).not.toMatch(/href="[^"]*\/canvas\/c-legacy"/);
  });
});

describe('generateReport never carries participant text', () => {
  const SECRET_QUOTE = 'ZEBRA-QUOTE I told the nurse about my late husband';
  const SECRET_TRANSCRIPT = 'TRANSCRIPT-BODY-MARKER Participant 7 said something private';

  beforeEach(() => {
    vi.clearAllMocks();
    mockPrisma.user.findUnique.mockResolvedValue({
      name: 'Rita Researcher',
      email: 'rita@example.edu',
      dashboardAccess: null,
    });
    mockPrisma.canvasTextCoding.groupBy.mockResolvedValue([{ canvasId: 'c-own', _count: { _all: 4 } }]);
    // A backend that (wrongly) returns coded segments and transcript content must still not leak it.
    mockPrisma.codingCanvas.findMany.mockResolvedValue([
      {
        id: 'c-own',
        name: 'Study A',
        _count: { codings: 9, collaborators: 1 },
        codings: [{ codedText: SECRET_QUOTE, createdAt: new Date() }],
        transcripts: [{ title: 'Interview 7', content: SECRET_TRANSCRIPT }],
        questions: [{ text: SECRET_QUOTE, _count: { codings: 3 } }],
      },
    ]);
  });

  it('keeps transcript text and In Vivo code labels out of the html and subject', async () => {
    for (const days of [1, 7, 30]) {
      const { html, subject } = await generateReport('u1', null, days);
      expect(html).not.toContain('ZEBRA-QUOTE');
      expect(html).not.toContain('TRANSCRIPT-BODY-MARKER');
      expect(html).not.toContain('late husband');
      expect(subject).not.toContain('ZEBRA');
    }
  });

  it('keeps editable canvas titles out of the email when they contain a quote', async () => {
    mockPrisma.codingCanvas.findMany.mockResolvedValueOnce([
      { id: 'c-own', name: SECRET_QUOTE, _count: { codings: 9, collaborators: 1 }, questions: [] },
    ]);

    const { html, subject } = await generateReport('u1', 'c-own');
    expect(html).not.toContain(SECRET_QUOTE);
    expect(subject).not.toContain(SECRET_QUOTE);
    expect(html).toMatch(/href="[^"]*\/canvas\/c-own"[^>]*>Open this canvas in QualCanvas</);
  });

  it('does not ask the database for coding rows at all', async () => {
    await generateReport('u1');
    const args = mockPrisma.codingCanvas.findMany.mock.calls[0][0];
    expect(args).toMatchObject({ select: { id: true, _count: { select: { codings: true, collaborators: true } } } });
    expect(args.select).not.toHaveProperty('name');
    expect(args.select).not.toHaveProperty('codings');
    expect(args.select).not.toHaveProperty('questions');
  });

  it('sends counts and a link back into the app', async () => {
    const { html } = await generateReport('u1');
    expect(html).toContain('>4<'); // new codings this period
    expect(html).toContain('>9<'); // total codings
    expect(html).toMatch(/href="[^"]*\/canvas\/c-own"/);
  });
});
