import { describe, it, expect, vi, beforeEach } from 'vitest';
import archiver from 'archiver';

/**
 * Archive-level QDPX tests: what happens to the .qdpx ZIP itself, as opposed to
 * the XML inside it (covered by utils/qdpxParse.test.ts).
 *
 * Two jobs here:
 *
 *  1. Real-world shape. A genuine NVivo for Windows 12.6 export carries no
 *     inline <PlainTextContent>; the source text lives in a separate archive
 *     entry referenced by plainTextPath="internal://<guid>.txt". Reading only
 *     project.qde therefore yields codes and codings with empty text.
 *
 *  2. Hostile and malformed archives. These assertions are written so that
 *     deleting a protection makes them fail: remove the decompressed-size cap
 *     and the zip-bomb test stops rejecting; remove the project-XML check and
 *     the malformed tests stop throwing.
 */

const { mockPrisma } = vi.hoisted(() => {
  const mockPrisma = {
    codingCanvas: { findUnique: vi.fn() },
    canvasQuestion: { create: vi.fn() },
    canvasTranscript: { create: vi.fn() },
    canvasTextCoding: { create: vi.fn() },
    // importQdpx runs its writes inside a transaction so a failed import cannot
    // leave a half-populated canvas. Hand the callback the same mock client.
    $transaction: vi.fn(),
  };
  mockPrisma.$transaction.mockImplementation(async (fn: (tx: typeof mockPrisma) => unknown) => fn(mockPrisma));
  return { mockPrisma };
});

vi.mock('../../lib/prisma.js', () => ({ prisma: mockPrisma }));

import { importQdpx } from '../../utils/qdpxImport.js';

/** Build a .qdpx ZIP in memory from a map of entry name to contents. */
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

// Structure copied from a real NVivo for Windows 12.6 .qdpx export: nested
// <Code>, no PlainTextContent, text referenced via plainTextPath. Content is
// neutral placeholder text — the third-party research data is not vendored.
const NVIVO_SHAPED_QDE = `<?xml version="1.0" encoding="utf-8"?>
<Project xmlns:xsd="http://www.w3.org/2001/XMLSchema" name="Untitled" origin="NVivo for Windows 12.6" creatingUserGUID="f93ad076-5ca1-4f46-abf4-b4b67130a6e2" creationDateTime="2025-02-21T15:09:07Z" basePath="" xmlns="urn:QDA-XML:project:1.0">
  <Users>
    <User guid="8ca3a2c1-8b7a-41c3-a9dd-a8fb46caa645" name="Coder" />
  </Users>
  <CodeBook>
    <Codes>
      <Code guid="3c51efbb-071f-43a7-9f32-228b89668e8d" name="Perceived susceptibility" isCodable="true">
        <Code guid="4d62f0cc-182f-44b8-a043-339c90779e9e" name="Personal risk" isCodable="true" />
      </Code>
    </Codes>
  </CodeBook>
  <Sources>
    <TextSource guid="56a79789-d535-4fb8-bedd-a915504c54ba" name="videos_selection" richTextPath="internal://56a79789-d535-4fb8-bedd-a915504c54ba.docx" plainTextPath="internal://56a79789-d535-4fb8-bedd-a915504c54ba.txt" creationDateTime="2025-06-11T16:24:07Z">
      <PlainTextSelection guid="fd960901-8191-4db1-a3dd-a91626d56c4b" name="" startPosition="4" endPosition="10">
        <Coding guid="aa960901-8191-4db1-a3dd-a91626d56c4b">
          <CodeRef targetGUID="4d62f0cc-182f-44b8-a043-339c90779e9e" />
        </Coding>
      </PlainTextSelection>
    </TextSource>
  </Sources>
</Project>`;

const SOURCE_TEXT = 'The vaccine question came up repeatedly.';

describe('QDPX archive handling', () => {
  const canvasId = 'canvas-arch-1';
  let created: { text: string; parentQuestionId: string | null }[];

  beforeEach(() => {
    vi.clearAllMocks();
    created = [];
    mockPrisma.codingCanvas.findUnique.mockResolvedValue({ id: canvasId, name: 'C' });

    let n = 0;
    mockPrisma.canvasQuestion.create.mockImplementation(async ({ data }) => {
      created.push({ text: data.text, parentQuestionId: data.parentQuestionId ?? null });
      return { id: `q${++n}`, ...data };
    });
    mockPrisma.canvasTranscript.create.mockImplementation(async ({ data }) => ({ id: 't1', ...data }));
    mockPrisma.canvasTextCoding.create.mockImplementation(async ({ data }) => ({ id: 'c1', ...data }));
  });

  // ─── Real NVivo shape ───

  it('resolves source text from the plainTextPath entry an NVivo export uses', async () => {
    const zip = await buildArchive({
      'project.qde': NVIVO_SHAPED_QDE,
      'sources/56a79789-d535-4fb8-bedd-a915504c54ba.txt': SOURCE_TEXT,
    });

    await importQdpx(canvasId, zip);

    const transcript = mockPrisma.canvasTranscript.create.mock.calls[0][0].data;
    expect(transcript.content).toBe(SOURCE_TEXT);
  });

  it('produces real coded text for an NVivo selection, not an empty string', async () => {
    const zip = await buildArchive({
      'project.qde': NVIVO_SHAPED_QDE,
      'sources/56a79789-d535-4fb8-bedd-a915504c54ba.txt': SOURCE_TEXT,
    });

    await importQdpx(canvasId, zip);

    const coding = mockPrisma.canvasTextCoding.create.mock.calls[0][0].data;
    expect(coding.codedText).toBe(SOURCE_TEXT.slice(4, 10));
    expect(coding.codedText).not.toBe('');
  });

  it('imports the NVivo code hierarchy with the child linked to its parent', async () => {
    const zip = await buildArchive({
      'project.qde': NVIVO_SHAPED_QDE,
      'sources/56a79789-d535-4fb8-bedd-a915504c54ba.txt': SOURCE_TEXT,
    });

    const result = await importQdpx(canvasId, zip);

    expect(result.codes).toBe(2);
    expect(created[0]).toEqual({ text: 'Perceived susceptibility', parentQuestionId: null });
    expect(created[1]).toEqual({ text: 'Personal risk', parentQuestionId: 'q1' });
  });

  it('still imports when the referenced text entry is absent, and codes nothing bogus', async () => {
    const zip = await buildArchive({ 'project.qde': NVIVO_SHAPED_QDE });

    const result = await importQdpx(canvasId, zip);

    expect(result.sources).toBe(1);
    const transcript = mockPrisma.canvasTranscript.create.mock.calls[0][0].data;
    expect(transcript.content).toBe('');
    // An out-of-range selection against empty text must not create a coding
    // whose codedText is "".
    expect(result.codings).toBe(0);
    expect(result.skippedCodings).toBe(1);
  });

  // ─── Hostile and malformed archives ───

  it('rejects an archive whose declared entry size exceeds the cap', async () => {
    // 120MB of zeroes compresses to almost nothing: the classic zip bomb. The
    // guard must reject on size, not on compressed bytes.
    const bomb = Buffer.alloc(120 * 1024 * 1024, 0);
    const zip = await buildArchive({ 'project.qde': bomb });

    await expect(importQdpx(canvasId, zip)).rejects.toThrow(/size limit/i);
  });

  it('rejects an archive containing no project XML', async () => {
    const zip = await buildArchive({ 'readme.txt': 'nothing to see' });

    await expect(importQdpx(canvasId, zip)).rejects.toThrow(/no project xml/i);
  });

  it('rejects XML that parses but has no Project element', async () => {
    const zip = await buildArchive({ 'project.qde': '<?xml version="1.0"?><NotAProject />' });

    await expect(importQdpx(canvasId, zip)).rejects.toThrow(/project/i);
  });

  it('rejects a truncated / non-ZIP buffer rather than crashing', async () => {
    await expect(importQdpx(canvasId, Buffer.from('PK\x03\x04 not really a zip'))).rejects.toThrow();
  });

  it('does not expand a DOCTYPE entity (billion laughs / XXE stays closed)', async () => {
    const xxe = `<?xml version="1.0"?>
<!DOCTYPE Project [ <!ENTITY boom "EXPANDED"> ]>
<Project name="&boom;" xmlns="urn:QDA-XML:project:1.0">
  <CodeBook><Codes><Code guid="11111111-1111-4111-8111-111111111111" name="&boom;" isCodable="true" /></Codes></CodeBook>
</Project>`;
    const zip = await buildArchive({ 'project.qde': xxe });

    await importQdpx(canvasId, zip);

    // The entity must survive as literal text, never as its expansion.
    expect(created[0].text).not.toContain('EXPANDED');
  });

  it('reports unsupported constructs found in the archive', async () => {
    const withExtras = NVIVO_SHAPED_QDE.replace(
      '</Project>',
      `  <Cases><Case guid="c1111111-1111-4111-8111-111111111111" name="P1" /></Cases>
</Project>`,
    );
    const zip = await buildArchive({
      'project.qde': withExtras,
      'sources/56a79789-d535-4fb8-bedd-a915504c54ba.txt': SOURCE_TEXT,
    });

    const result = await importQdpx(canvasId, zip);

    expect(result.unsupported).toContain('1 case');
  });
});
