import { describe, it, expect } from 'vitest';
import JSZip from 'jszip';
import { generateReportDocxBlob, generateReportMarkdown, type ReportInput, type GroupBy } from './richExportContent';

const MULTILINE_EXCERPT = 'We nearly closed in March.\n\nThen the community stepped in.';
const CASE_ANNOTATION = 'Coder note: turning point in the funding narrative.';
const MULTILINE_MEMO = 'First paragraph of the memo.\n\nSecond paragraph, a separate thought.\nThird line.';

function makeInput(over: Partial<ReportInput> = {}): ReportInput {
  return {
    canvasName: 'WISE study',
    date: 'August 18, 2026',
    questions: [{ id: 'q1', text: 'Survival', color: '#3B82F6', parentQuestionId: null }],
    transcripts: [{ id: 't1', title: 'Interview 1', content: 'We nearly closed in March.', caseId: 'c1' }],
    codings: [
      {
        id: 'x1',
        transcriptId: 't1',
        questionId: 'q1',
        startOffset: 0,
        endOffset: 26,
        codedText: MULTILINE_EXCERPT,
        annotation: CASE_ANNOTATION,
        createdAt: '2026-08-18T00:00:00.000Z',
      },
    ],
    cases: [{ id: 'c1', name: 'Clarecare' }],
    memos: [{ id: 'm1', title: 'Analytic memo', content: MULTILINE_MEMO }],
    groupBy: 'code',
    includeCodebook: false,
    includeExcerpts: true,
    includeMemos: true,
    includeSummary: false,
    includeCoverage: false,
    ...over,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any;
}

/** Every contiguous run of ">"-prefixed lines in the markdown. */
function blockquoteBlocks(md: string): string[][] {
  const blocks: string[][] = [];
  let current: string[] = [];
  md.split('\n').forEach((line) => {
    if (line.startsWith('>')) {
      current.push(line);
    } else if (current.length) {
      blocks.push(current);
      current = [];
    }
  });
  if (current.length) blocks.push(current);
  return blocks;
}

describe('markdown report', () => {
  it.each<GroupBy>(['code', 'source', 'case'])('keeps the annotation when grouped by %s', (groupBy) => {
    const md = generateReportMarkdown(makeInput({ groupBy }));
    expect(md).toContain(`*Note: ${CASE_ANNOTATION}*`);
  });

  it.each<GroupBy>(['code', 'source', 'case'])(
    'quotes every line of a multi-line excerpt when grouped by %s',
    (groupBy) => {
      const md = generateReportMarkdown(makeInput({ groupBy }));
      const blocks = blockquoteBlocks(md);
      expect(blocks).toHaveLength(1);

      const block = blocks[0];
      // Excerpt lines + the attribution line, all inside one quote.
      expect(block).toHaveLength(MULTILINE_EXCERPT.split('\n').length + 1);
      block.forEach((line) => expect(line.startsWith('>')).toBe(true));
      expect(block[block.length - 1]).toContain('—');

      // Nothing from the excerpt escaped the quote.
      MULTILINE_EXCERPT.split('\n')
        .filter(Boolean)
        .forEach((line) => expect(md).not.toContain(`\n${line}`));
    },
  );

  it('still renders the excerpt text itself', () => {
    const md = generateReportMarkdown(makeInput());
    expect(md).toContain('We nearly closed in March.');
    expect(md).toContain('Then the community stepped in.');
  });
});

async function docxDocumentXml(input: ReportInput): Promise<string> {
  const blob = await generateReportDocxBlob(input);
  const zip = await JSZip.loadAsync(await blob.arrayBuffer());
  const xml = await zip.file('word/document.xml')!.async('string');
  return xml;
}

/** Raw XML of each <w:p>. */
function docxParagraphXml(xml: string): string[] {
  return xml.match(/<w:p[ >][\s\S]*?<\/w:p>/g) || [];
}

/** Text of each <w:p>, with <w:br/> rendered back as a newline. */
function docxParagraphTexts(xml: string): string[] {
  const paragraphs = xml.match(/<w:p[ >][\s\S]*?<\/w:p>/g) || [];
  return paragraphs.map((p) =>
    (p.match(/<w:br\/>|<w:br \/>|<w:t[^>]*>[\s\S]*?<\/w:t>/g) || [])
      .map((piece) => (piece.startsWith('<w:br') ? '\n' : piece.replace(/<w:t[^>]*>/, '').replace('</w:t>', '')))
      .join(''),
  );
}

describe('Word (.docx) report', () => {
  it('keeps a multi-paragraph memo as separate lines', async () => {
    const xml = await docxDocumentXml(makeInput({ includeExcerpts: false }));
    const paragraphs = docxParagraphXml(xml);
    const memoXml = paragraphs.find((p) => p.includes('First paragraph of the memo.'))!;
    expect(memoXml).toBeDefined();

    // WordprocessingML ignores a raw newline inside <w:t>; the break has to be
    // an element, and each line its own run.
    const texts = (memoXml.match(/<w:t[^>]*>[\s\S]*?<\/w:t>/g) || []).map((t) =>
      t.replace(/<w:t[^>]*>/, '').replace('</w:t>', ''),
    );
    expect(texts).toHaveLength(4);
    texts.forEach((t) => expect(t).not.toContain('\n'));
    expect(texts).toEqual(MULTILINE_MEMO.split('\n'));
    expect((memoXml.match(/<w:br\s*\/>/g) || []).length).toBe(3);

    const rendered = docxParagraphTexts(xml).find((t) => t.startsWith('First paragraph of the memo.'));
    expect(rendered).toBe(MULTILINE_MEMO);
  });

  it('emits a real line break element rather than swallowing the newline', async () => {
    const xml = await docxDocumentXml(makeInput({ includeExcerpts: false }));
    expect(xml).toMatch(/<w:br\s*\/>/);
  });

  it('keeps a multi-line excerpt readable in the quote paragraph', async () => {
    const xml = await docxDocumentXml(makeInput({ includeMemos: false }));
    const quoteXml = docxParagraphXml(xml).find((p) => p.includes('We nearly closed in March.'))!;
    expect(quoteXml).toBeDefined();
    expect((quoteXml.match(/<w:br\s*\/>/g) || []).length).toBe(2);
    (quoteXml.match(/<w:t[^>]*>[\s\S]*?<\/w:t>/g) || []).forEach((t) => expect(t).not.toContain('\n'));

    const quote = docxParagraphTexts(xml).find((t) => t.includes('We nearly closed in March.'));
    expect(quote).toContain('Then the community stepped in.');
  });
});
