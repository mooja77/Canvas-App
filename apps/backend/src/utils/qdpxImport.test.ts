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

/**
 * Line-ending convention for foreign archives (bug hunt 2026-09-02).
 *
 * XML 1.0 section 2.11 has every conformant parser normalise a literal CR or
 * CRLF in element content to LF, and fast-xml-parser does. So the offsets of
 * an inline <PlainTextContent> source are, per the spec, counted against the
 * LF-normalised text. A separate .txt entry referenced by plainTextPath (how
 * NVivo writes sources) is read byte-for-byte, so CRLF-counted offsets on it
 * are exact. An exporter that inlines literal CRLF but counts the CR bytes
 * produces a file that misaligns in every conformant importer; that case is
 * a documented limitation, not something we guess at.
 */
describe('importQdpx - CRLF sources and offset convention', () => {
  const CODE = '11111111-1111-4111-8111-111111111111';
  const SOURCE = '22222222-2222-4222-8222-222222222222';
  const crlfText = 'Line one\r\nLine two\r\nLine three coded here\r\nLine four.\r\n';
  const lfText = crlfText.replace(/\r\n/g, '\n');

  function project(sourceAttrs: string, inline: string, start: number, end: number): string {
    return `<?xml version="1.0" encoding="utf-8"?>
<Project name="CRLF" xmlns="urn:QDA-XML:project:1.0">
  <CodeBook><Codes><Code guid="${CODE}" name="C" isCodable="true" /></Codes></CodeBook>
  <Sources>
    <TextSource guid="${SOURCE}" name="S"${sourceAttrs}>${inline}<PlainTextSelection guid="33333333-3333-4333-8333-333333333333" startPosition="${start}" endPosition="${end}"><Coding guid="44444444-4444-4444-8444-444444444444"><CodeRef targetGUID="${CODE}" /></Coding></PlainTextSelection></TextSource>
  </Sources>
</Project>`;
  }

  beforeEach(() => {
    vi.clearAllMocks();
    mockPrisma.codingCanvas.findUnique.mockResolvedValue({ id: 'canvas-1', name: 'C', userId: 'owner-1' });
    mockPrisma.canvasCollaborator.findMany.mockResolvedValue([]);
    mockPrisma.canvasQuestion.findMany.mockResolvedValue([]);
    mockPrisma.canvasTranscript.findMany.mockResolvedValue([]);
    mockPrisma.canvasTextCoding.findMany.mockResolvedValue([]);
    mockPrisma.canvasQuestion.create.mockImplementation(async ({ data }) => ({ id: 'q1', ...data }));
    mockPrisma.canvasTranscript.create.mockImplementation(async ({ data }) => ({ id: 't1', ...data }));
    mockPrisma.canvasTextCoding.create.mockImplementation(async ({ data }) => ({ id: 'c1', ...data }));
  });

  const importedTranscript = () => mockPrisma.canvasTranscript.create.mock.calls[0][0].data as { content: string };
  const importedCoding = () =>
    mockPrisma.canvasTextCoding.create.mock.calls[0]?.[0].data as
      | { codedText: string; startOffset: number; endOffset: number }
      | undefined;

  it('keeps CRLF in a separate .txt source and resolves CRLF-counted offsets exactly', async () => {
    const start = crlfText.indexOf('coded here');
    const zip = await buildArchive({
      'project.qde': project(` plainTextPath="internal://${SOURCE}.txt"`, '', start, start + 'coded here'.length),
      [`sources/${SOURCE}.txt`]: crlfText,
    });

    const result = await importQdpx('canvas-1', zip);

    expect(result).toMatchObject({ sources: 1, codings: 1, skippedCodings: 0 });
    expect(importedTranscript().content).toBe(crlfText);
    expect(importedCoding()).toMatchObject({ codedText: 'coded here', startOffset: start });
  });

  it('normalises literal CRLF inside <PlainTextContent> to LF and resolves LF-counted offsets', async () => {
    const start = lfText.indexOf('coded here');
    const zip = await buildArchive({
      'project.qde': project(
        '',
        `<PlainTextContent>${crlfText}</PlainTextContent>`,
        start,
        start + 'coded here'.length,
      ),
    });

    const result = await importQdpx('canvas-1', zip);

    expect(result).toMatchObject({ sources: 1, codings: 1, skippedCodings: 0 });
    expect(importedTranscript().content).toBe(lfText);
    expect(importedCoding()).toMatchObject({ codedText: 'coded here', startOffset: start });
  });

  it('documents the limitation: CRLF-counted offsets on an inline literal-CRLF source misalign', async () => {
    // Measured: two CRLF lines before the selection shift it by two. (A
    // selection that runs past the normalised end is skipped by the existing
    // past-the-end guard rather than misaligned, hence the trailing line.)
    const start = crlfText.indexOf('coded here');
    const zip = await buildArchive({
      'project.qde': project(
        '',
        `<PlainTextContent>${crlfText}</PlainTextContent>`,
        start,
        start + 'coded here'.length,
      ),
    });

    await importQdpx('canvas-1', zip);

    expect(importedCoding()?.codedText).toBe('ded here\nL');
  });

  it('preserves a CR written as a character reference, which is how a conformant exporter keeps one', async () => {
    const escaped = crlfText.replace(/\r/g, '&#13;');
    const start = crlfText.indexOf('coded here');
    const zip = await buildArchive({
      'project.qde': project('', `<PlainTextContent>${escaped}</PlainTextContent>`, start, start + 'coded here'.length),
    });

    await importQdpx('canvas-1', zip);

    expect(importedTranscript().content).toBe(crlfText);
    expect(importedCoding()).toMatchObject({ codedText: 'coded here', startOffset: start });
  });
});
