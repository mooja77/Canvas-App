import { describe, it, expect, vi, beforeEach } from 'vitest';
import yauzl from 'yauzl';

/**
 * exportQdpx against a mocked database. The XML writer itself is covered by
 * qdpxParse.test.ts; this file covers what exportQdpx does BEFORE handing over
 * to the writer - in particular rebuilding the code hierarchy from flat rows.
 */

const { mockPrisma } = vi.hoisted(() => {
  const mockPrisma = {
    codingCanvas: { findUnique: vi.fn() },
    user: { findMany: vi.fn() },
    canvasMemo: { count: vi.fn() },
    canvasCase: { count: vi.fn() },
    canvasRelation: { count: vi.fn() },
    canvasComputedNode: { count: vi.fn() },
  };
  return { mockPrisma };
});

vi.mock('../lib/prisma.js', () => ({ prisma: mockPrisma }));

import { exportQdpx } from './qdpxExport.js';
import { parseQdpxProject, toGuid } from './qdpxParse.js';

/** Pull project.qde back out of the archive exportQdpx produced. */
function readProjectXml(zip: Buffer): Promise<string> {
  return new Promise((resolve, reject) => {
    yauzl.fromBuffer(zip, { lazyEntries: true }, (err, zipfile) => {
      if (err || !zipfile) return reject(err ?? new Error('no zipfile'));
      zipfile.readEntry();
      zipfile.on('entry', (entry) => {
        if (entry.fileName !== 'project.qde') return zipfile.readEntry();
        zipfile.openReadStream(entry, (err2, stream) => {
          if (err2 || !stream) return reject(err2 ?? new Error('no stream'));
          const chunks: Buffer[] = [];
          stream.on('data', (c: Buffer) => chunks.push(c));
          stream.on('end', () => resolve(Buffer.concat(chunks).toString('utf-8')));
          stream.on('error', reject);
        });
      });
      zipfile.on('end', () => reject(new Error('project.qde not found')));
      zipfile.on('error', reject);
    });
  });
}

interface Row {
  id: string;
  text: string;
  color: string | null;
  parentQuestionId: string | null;
}

function canvasWith(questions: Row[], codings: { id: string; questionId: string }[]) {
  return {
    id: 'canvas-1',
    name: 'Cycle canvas',
    createdAt: new Date('2026-01-01T00:00:00Z'),
    transcripts: [{ id: 't1', title: 'Interview', content: 'The bus never comes on time.' }],
    questions,
    codings: codings.map((c) => ({
      id: c.id,
      transcriptId: 't1',
      questionId: c.questionId,
      startOffset: 4,
      endOffset: 7,
      coderUserId: null,
      note: null,
      annotation: null,
      source: 'human',
    })),
  };
}

describe('exportQdpx - code hierarchy with a parent cycle (H4)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPrisma.user.findMany.mockResolvedValue([]);
    mockPrisma.canvasMemo.count.mockResolvedValue(0);
    mockPrisma.canvasCase.count.mockResolvedValue(0);
    mockPrisma.canvasRelation.count.mockResolvedValue(0);
    mockPrisma.canvasComputedNode.count.mockResolvedValue(0);
  });

  it('emits both codes of an A<->B cycle as roots instead of dropping them', async () => {
    mockPrisma.codingCanvas.findUnique.mockResolvedValue(
      canvasWith(
        [
          { id: 'A', text: 'Alpha', color: null, parentQuestionId: 'B' },
          { id: 'B', text: 'Beta', color: null, parentQuestionId: 'A' },
        ],
        [{ id: 'coding-1', questionId: 'A' }],
      ),
    );

    const { buffer } = await exportQdpx('canvas-1');
    const xml = await readProjectXml(buffer);

    expect(xml).toContain(`<Code guid="${toGuid('A')}"`);
    expect(xml).toContain(`<Code guid="${toGuid('B')}"`);

    const parsed = parseQdpxProject(xml);
    expect(parsed.totalCodes).toBe(2);
    expect(parsed.codes.map((c) => c.guid).sort()).toEqual([toGuid('A'), toGuid('B')].sort());

    // The coding's CodeRef must resolve to a code that is actually in the codebook.
    const codeGuids = new Set(parsed.codes.map((c) => c.guid));
    const ref = parsed.sources[0].selections[0].codings[0].codeGuid;
    expect(ref).toBe(toGuid('A'));
    expect(codeGuids.has(ref)).toBe(true);
  });

  it('keeps a well-formed child under a parent that is itself part of a cycle', async () => {
    mockPrisma.codingCanvas.findUnique.mockResolvedValue(
      canvasWith(
        [
          { id: 'A', text: 'Alpha', color: null, parentQuestionId: 'B' },
          { id: 'B', text: 'Beta', color: null, parentQuestionId: 'A' },
          { id: 'C', text: 'Gamma', color: null, parentQuestionId: 'A' },
        ],
        [],
      ),
    );

    const { buffer } = await exportQdpx('canvas-1');
    const parsed = parseQdpxProject(await readProjectXml(buffer));

    expect(parsed.totalCodes).toBe(3);
    const alpha = parsed.codes.find((c) => c.guid === toGuid('A'));
    expect(alpha?.children.map((c) => c.guid)).toEqual([toGuid('C')]);
  });

  it('still nests an ordinary hierarchy', async () => {
    mockPrisma.codingCanvas.findUnique.mockResolvedValue(
      canvasWith(
        [
          { id: 'P', text: 'Parent', color: null, parentQuestionId: null },
          { id: 'K', text: 'Kid', color: null, parentQuestionId: 'P' },
        ],
        [],
      ),
    );

    const { buffer } = await exportQdpx('canvas-1');
    const parsed = parseQdpxProject(await readProjectXml(buffer));

    expect(parsed.codes).toHaveLength(1);
    expect(parsed.codes[0].children.map((c) => c.guid)).toEqual([toGuid('K')]);
  });
});
