import { UTF8_BOM, escapeCsvField, escapeTsvField } from '../../../utils/delimitedText';

export { UTF8_BOM, escapeCsvField, escapeTsvField };

export interface CodebookEntry {
  name: string;
  color: string;
  parentTheme: string;
  frequency: number;
  coveragePercent: number;
  examples: string[];
}

export interface DataRow {
  transcriptTitle: string;
  codeName: string;
  codeColor: string;
  parentTheme: string;
  codedText: string;
  startOffset: number;
  endOffset: number;
  annotation: string;
  caseName: string;
  createdAt: string;
}

export const CODEBOOK_TSV_HEADER = 'Code Name\tColor\tParent Theme\tFrequency\tCoverage %\tExample Excerpts';
export const DATA_TSV_HEADER = 'Transcript\tCode\tParent Theme\tCoded Text\tAnnotation\tCase\tDate';
export const CODEBOOK_CSV_HEADER = 'Code Name,Color,Parent Theme,Frequency,Coverage %,Example Excerpts';
export const DATA_CSV_HEADER = 'Transcript,Code,Code Color,Parent Theme,Coded Text,Start,End,Annotation,Case,Date';

export function buildCodebookTsv(entries: CodebookEntry[]): string {
  const rows = entries.map((e) =>
    [e.name, e.color, e.parentTheme, String(e.frequency), `${e.coveragePercent}%`, e.examples.join(' | ')]
      .map(escapeTsvField)
      .join('\t'),
  );
  return [CODEBOOK_TSV_HEADER, ...rows].join('\n');
}

export function buildDataTsv(rows: DataRow[]): string {
  const body = rows.map((r) =>
    [r.transcriptTitle, r.codeName, r.parentTheme, r.codedText, r.annotation, r.caseName, r.createdAt]
      .map(escapeTsvField)
      .join('\t'),
  );
  return [DATA_TSV_HEADER, ...body].join('\n');
}

export function buildCodebookCsv(entries: CodebookEntry[]): string {
  const rows = entries.map(
    (e) =>
      `${escapeCsvField(e.name)},${e.color},${escapeCsvField(e.parentTheme)},${e.frequency},${e.coveragePercent}%,${escapeCsvField(e.examples.join(' | '))}`,
  );
  return UTF8_BOM + [CODEBOOK_CSV_HEADER, ...rows].join('\n');
}

export function buildDataCsv(rows: DataRow[]): string {
  const body = rows.map(
    (r) =>
      `${escapeCsvField(r.transcriptTitle)},${escapeCsvField(r.codeName)},${r.codeColor},${escapeCsvField(r.parentTheme)},${escapeCsvField(r.codedText)},${r.startOffset},${r.endOffset},${escapeCsvField(r.annotation)},${escapeCsvField(r.caseName)},${r.createdAt}`,
  );
  return UTF8_BOM + [DATA_CSV_HEADER, ...body].join('\n');
}
