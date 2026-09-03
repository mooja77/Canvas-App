import { describe, it, expect, vi, beforeEach } from 'vitest';
import archiver from 'archiver';

/**
 * importQdpx against a mocked database: what gets written for a given file.
 * Archive-level handling (zip bombs, missing entries, NVivo plainTextPath) is
 * covered by __tests__/integration/qdpx-archive.test.ts.
 */

const { mockPrisma } = vi.hoisted(() => {
  const mockPrisma = {
    codingCanvas: { findUnique: vi.fn() },
    canvasCollaborator: { findMany: vi.fn() },
    canvasQuestion: { create: vi.fn(), findMany: vi.fn() },
    canvasTranscript: { create: vi.fn(), findMany: vi.fn() },
    canvasTextCoding: { create: vi.fn(), findMany: vi.fn() },
    $transaction: vi.fn(),
  };
  mockPrisma.$transaction.mockImplementation(async (fn: (tx: typeof mockPrisma) => unknown) => fn(mockPrisma));
  return { mockPrisma };
});

vi.mock('../lib/prisma.js', () => ({ prisma: mockPrisma }));

import { importQdpx } from './qdpxImport.js';

function buildArchive(entries: Record<string, string | Buffer>): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const archive = archiver('zip', { zlib: { level: 9 } });
    const chunks: Buffer[] = [];
    archive.on('data', (c: Buffer) => chunks.push(c));
    archive.on('end', () => resolve(Buffer.concat(chunks)));
    archive.on('error', reject);
    for (const [name, body] of Object.entries(entries)) archive.append(body, { name });
    void archive.finalize();
  });
}

function projectWithCodeColor(color: string | null): string {
  const attr = color === null ? '' : ` color="${color}"`;
  return `<?xml version="1.0" encoding="utf-8"?>
<Project name="Colours" xmlns="urn:QDA-XML:project:1.0">
  <CodeBook>
    <Codes>
      <Code guid="11111111-1111-4111-8111-111111111111" name="Tinted" isCodable="true"${attr} />
    </Codes>
  </CodeBook>
</Project>`;
}

/** The colour the importer falls back to when the file carries none. */
const DEFAULT_CODE_COLOR = '#3B82F6';

async function importedColor(color: string | null): Promise<string> {
  const zip = await buildArchive({ 'project.qde': projectWithCodeColor(color) });
  await importQdpx('canvas-1', zip);
  return mockPrisma.canvasQuestion.create.mock.calls[0][0].data.color as string;
}

describe('importQdpx - code colour validation (M7)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPrisma.codingCanvas.findUnique.mockResolvedValue({ id: 'canvas-1', name: 'C', userId: 'owner-1' });
    mockPrisma.canvasCollaborator.findMany.mockResolvedValue([]);
    mockPrisma.canvasQuestion.findMany.mockResolvedValue([]);
    mockPrisma.canvasTranscript.findMany.mockResolvedValue([]);
    mockPrisma.canvasTextCoding.findMany.mockResolvedValue([]);
    let n = 0;
    mockPrisma.canvasQuestion.create.mockImplementation(async ({ data }) => ({ id: `q${++n}`, ...data }));
  });

  it('keeps a #rrggbb colour as written', async () => {
    expect(await importedColor('#a1B2c3')).toBe('#a1B2c3');
  });

  it('falls back to the default colour when the file carries none', async () => {
    expect(await importedColor(null)).toBe(DEFAULT_CODE_COLOR);
  });

  it('replaces a value that is not a colour at all (spreadsheet formula injection)', async () => {
    expect(await importedColor('=HYPERLINK(&quot;http://evil&quot;)')).toBe(DEFAULT_CODE_COLOR);
  });

  it('replaces a named colour, which the API would reject', async () => {
    expect(await importedColor('red')).toBe(DEFAULT_CODE_COLOR);
  });

  it('expands #rgb to #rrggbb', async () => {
    expect(await importedColor('#abc')).toBe('#aabbcc');
  });

  it('truncates #rrggbbaa to #rrggbb', async () => {
    expect(await importedColor('#12345678')).toBe('#123456');
  });

  it('rejects hex of any other length', async () => {
    expect(await importedColor('#12345')).toBe(DEFAULT_CODE_COLOR);
    expect(await importedColor('#1234567')).toBe(DEFAULT_CODE_COLOR);
  });
});
