import { UTF8_BOM, escapeCsvField } from '../../../utils/delimitedText';

/**
 * CSV writers for the two intercoder reports. The landing page promises a
 * "methods-paper-ready CSV export"; both reports used to download a .txt file.
 *
 * Numbers are written bare so a spreadsheet reads them as numbers. They must not
 * go through escapeCsvField: its formula guard prefixes a leading "-" with an
 * apostrophe, which would turn a negative kappa into text. Every string cell
 * (code names, coder names, transcript titles are user-typed) is quoted and
 * formula-neutralised.
 */
export type CsvCell = string | number;

function cell(value: CsvCell): string {
  if (typeof value === 'number') return Number.isFinite(value) ? String(value) : '';
  return escapeCsvField(value);
}

export function toCsv(rows: CsvCell[][]): string {
  // CRLF per RFC 4180; the BOM makes Windows Excel decode accented names as UTF-8.
  return UTF8_BOM + rows.map((row) => row.map(cell).join(',')).join('\r\n') + '\r\n';
}

const round3 = (n: number) => Math.round(n * 1000) / 1000;

export interface AgreementReportInput {
  method: string;
  alpha: number;
  interpretation: string;
  nCoders: number;
  coderNames: string[];
  transcriptTitle: string;
  nUnits: number;
  nObservations: number;
  nSegments: number;
  unattributedCodings?: number;
}

/** Multi-coder agreement (IntercoderPanel): one Measure,Value row per figure. */
export function agreementReportCsv(r: AgreementReportInput): string {
  const rows: CsvCell[][] = [
    ['Measure', 'Value'],
    ['Report', 'Intercoder agreement'],
    ['Method', r.method],
    ['Transcript', r.transcriptTitle],
    ['Coders', r.nCoders],
    ['Coder names', r.coderNames.join('; ')],
    ['Score', round3(r.alpha)],
    ['Interpretation', r.interpretation],
    ['Coding units', r.nUnits],
    ['Observations', r.nObservations],
    ['Segments', r.nSegments],
    ['Unattributed codings excluded', r.unattributedCodings ?? 0],
  ];
  // The caveat has to travel with the file: this is what ends up cited in a
  // methods section.
  if (r.unattributedCodings) {
    rows.push([
      'Coverage caveat',
      `${r.unattributedCodings} coding(s) on this transcript carry no coder attribution (bulk auto-code, imports, or legacy access-code sessions) and are excluded. This score describes only the attributed coding.`,
    ]);
  }
  return toCsv(rows);
}

export interface KappaTranscriptRow {
  title: string;
  segments: number;
  both: number;
  onlyA: number;
  onlyB: number;
  neither: number;
  kappa: number;
}

export interface KappaReportInput {
  codeA: string;
  codeB: string;
  unit: string;
  kappa: number;
  interpretation: string;
  observedAgreement: number;
  expectedAgreement: number;
  totalUnits: number;
  both: number;
  onlyA: number;
  onlyB: number;
  neither: number;
  perTranscript: KappaTranscriptRow[];
}

/**
 * Two-code Cohen's kappa (IntercoderReliabilityModal): one row per transcript
 * plus a final "All transcripts" row, so the table can be pasted into a paper
 * or re-analysed without re-typing.
 */
export function kappaReportCsv(r: KappaReportInput): string {
  const header: CsvCell[] = [
    'Transcript',
    'Code A',
    'Code B',
    'Unit',
    'Units',
    'Both coded',
    'Only A',
    'Only B',
    'Neither',
    'Observed agreement',
    'Expected agreement',
    "Cohen's kappa",
    'Interpretation',
  ];
  const rows: CsvCell[][] = [header];
  for (const t of r.perTranscript) {
    rows.push([
      t.title,
      r.codeA,
      r.codeB,
      r.unit,
      t.segments,
      t.both,
      t.onlyA,
      t.onlyB,
      t.neither,
      t.segments ? round3((t.both + t.neither) / t.segments) : '',
      '',
      round3(t.kappa),
      '',
    ]);
  }
  rows.push([
    'All transcripts',
    r.codeA,
    r.codeB,
    r.unit,
    r.totalUnits,
    r.both,
    r.onlyA,
    r.onlyB,
    r.neither,
    round3(r.observedAgreement),
    round3(r.expectedAgreement),
    round3(r.kappa),
    r.interpretation,
  ]);
  return toCsv(rows);
}

/** Trigger a browser download of CSV text. */
export function downloadCsv(csv: string, filename: string): void {
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
