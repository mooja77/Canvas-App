import { describe, it, expect } from 'vitest';
import {
  buildCodebookCsv,
  buildCodebookTsv,
  buildDataCsv,
  buildDataTsv,
  type CodebookEntry,
  type DataRow,
} from './codebookExportFormat';

/**
 * Parse a delimited table the way Excel / Sheets do: a field may be wrapped in
 * double quotes, in which case it can contain the delimiter, newlines, and
 * doubled quotes. Everything the exporters emit is checked by round-tripping
 * through this parser instead of by string matching.
 */
function parseDelimited(text: string, delimiter: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += ch;
      }
      continue;
    }
    if (ch === '"' && field === '') {
      inQuotes = true;
    } else if (ch === delimiter) {
      row.push(field);
      field = '';
    } else if (ch === '\n') {
      row.push(field);
      rows.push(row);
      row = [];
      field = '';
    } else if (ch !== '\r') {
      field += ch;
    }
  }
  row.push(field);
  rows.push(row);
  return rows;
}

const MULTILINE_EXCERPT = 'I felt lost.\n\nThen the funding came through.';
const TABBED_NOTE = 'coder A\tsecond pass';

const entries: CodebookEntry[] = [
  {
    name: 'Funding uncertainty',
    color: '#3B82F6',
    parentTheme: 'Resourcing',
    frequency: 2,
    coveragePercent: 12.5,
    examples: [MULTILINE_EXCERPT, 'short one'],
  },
  {
    name: 'Trust',
    color: '#10B981',
    parentTheme: '',
    frequency: 1,
    coveragePercent: 3,
    examples: [],
  },
];

const dataRows: DataRow[] = [
  {
    transcriptTitle: 'Interview 1',
    codeName: 'Funding uncertainty',
    codeColor: '#3B82F6',
    parentTheme: 'Resourcing',
    codedText: MULTILINE_EXCERPT,
    startOffset: 10,
    endOffset: 52,
    annotation: TABBED_NOTE,
    caseName: 'Clarecare',
    createdAt: '2026-08-18',
  },
  {
    transcriptTitle: 'Interview 2',
    codeName: 'Trust',
    codeColor: '#10B981',
    parentTheme: '',
    codedText: 'They trusted us',
    startOffset: 0,
    endOffset: 15,
    annotation: '',
    caseName: '',
    createdAt: '2026-08-18',
  },
];

describe('clipboard TSV export', () => {
  it('keeps one row per code even when an excerpt spans lines', () => {
    const parsed = parseDelimited(buildCodebookTsv(entries), '\t');
    expect(parsed).toHaveLength(entries.length + 1);
    expect(parsed[0]).toHaveLength(6);
    expect(parsed[1]).toHaveLength(6);
    expect(parsed[1][0]).toBe('Funding uncertainty');
    expect(parsed[1][5]).toBe(`${MULTILINE_EXCERPT} | short one`);
  });

  it('keeps one row per coding and does not split on tabs inside a note', () => {
    const parsed = parseDelimited(buildDataTsv(dataRows), '\t');
    expect(parsed).toHaveLength(dataRows.length + 1);
    expect(parsed[1]).toHaveLength(7);
    expect(parsed[1][3]).toBe(MULTILINE_EXCERPT);
    expect(parsed[1][4]).toBe(TABBED_NOTE);
    expect(parsed[2][1]).toBe('Trust');
  });

  it('leaves ordinary values unquoted so a plain paste stays readable', () => {
    const tsv = buildDataTsv(dataRows);
    expect(tsv.split('\n')[0]).toBe('Transcript\tCode\tParent Theme\tCoded Text\tAnnotation\tCase\tDate');
    expect(tsv).toContain('Interview 2\tTrust\t\tThey trusted us\t\t\t2026-08-18');
  });
});

describe('CSV export', () => {
  it('starts with a UTF-8 BOM so Excel on Windows reads accents correctly', () => {
    expect(buildCodebookCsv(entries).charCodeAt(0)).toBe(0xfeff);
    expect(buildDataCsv(dataRows).charCodeAt(0)).toBe(0xfeff);
  });

  it('round-trips every field, BOM stripped', () => {
    const csv = buildDataCsv(dataRows).replace(/^\uFEFF/, '');
    const parsed = parseDelimited(csv, ',');
    expect(parsed).toHaveLength(dataRows.length + 1);
    expect(parsed[1][4]).toBe(MULTILINE_EXCERPT);
    expect(parsed[1][7]).toBe(TABBED_NOTE);
    expect(parsed[1][9]).toBe('2026-08-18');
  });

  it('round-trips a codebook with accented text', () => {
    const accented: CodebookEntry[] = [
      { name: 'Coopération', color: '#000000', parentTheme: 'Réseau', frequency: 1, coveragePercent: 1, examples: [] },
    ];
    const parsed = parseDelimited(buildCodebookCsv(accented).replace(/^\uFEFF/, ''), ',');
    expect(parsed[1][0]).toBe('Coopération');
    expect(parsed[1][2]).toBe('Réseau');
  });
});
