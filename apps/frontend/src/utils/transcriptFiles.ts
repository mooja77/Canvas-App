/**
 * Parse uploaded transcript files into importable entries, dispatching by
 * extension. Shared by FileUploadModal so the logic is pure and unit-tested.
 *
 * Supported: .txt (one transcript), .csv (title in col 1, content in col 2 —
 * many transcripts), .vtt/.srt (subtitle captions → one clean transcript).
 */
import { parseCsvRecords } from './csv';
import { parseSubtitles, isSubtitleExt } from './subtitles';

export interface ParsedEntry {
  title: string;
  content: string;
}

/**
 * Column names a spreadsheet header row is made of. Every CSV out of Excel,
 * Sheets, Qualtrics or SPSS has one, and importing it produced a junk
 * transcript titled "Title" containing the word "Content" — which consumed a
 * plan slot and polluted the word counts and coverage statistics.
 *
 * Matching a known vocabulary rather than guessing from shape is deliberate:
 * mistaking a real first response for a header would delete data, which is far
 * worse than leaving one junk row. `SurveyImportModal` already assumes row 0
 * is a header; this brings the two CSV paths into agreement for the cases it
 * can be sure about.
 */
const HEADER_LABELS = new Set([
  'title',
  'name',
  'id',
  'no',
  'number',
  'participant',
  'participantid',
  'respondent',
  'respondentid',
  'responseid',
  'interviewee',
  'interview',
  'speaker',
  'case',
  'caseid',
  'file',
  'filename',
  'source',
  'date',
  'timestamp',
  'content',
  'text',
  'transcript',
  'body',
  'response',
  'answer',
  'comment',
  'comments',
  'note',
  'notes',
  'description',
  'quote',
  'verbatim',
  'column1',
  'column2',
  'col1',
  'col2',
]);

function normalizeHeaderCell(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[\s_-]+/g, '');
}

/**
 * A survey platform names its answer columns after the question, so the cell
 * reads `Q1 - What worked?` rather than anything in the vocabulary above. That
 * left every Qualtrics and SurveyMonkey export importing its header row as the
 * researcher's first transcript, even though the identifier column beside it
 * was recognised.
 *
 * The `Q<number>` opening is the part that is safe to match: it is the
 * convention those tools use, and a participant's answer does not begin with a
 * question number. The question text after it is not inspected at all.
 */
function isQuestionColumnLabel(value: string): boolean {
  return /^q\s*\d+[a-z]?\b/i.test(value.trim());
}

/** True when every one of the first two cells reads as a column label. */
export function looksLikeCsvHeaderRow(fields: string[]): boolean {
  const cells = fields.slice(0, 2).filter((f) => f.trim() !== '');
  if (cells.length === 0) return false;
  return cells.every((c) => HEADER_LABELS.has(normalizeHeaderCell(c)) || isQuestionColumnLabel(c));
}

export function getExt(fileName: string): string | undefined {
  const parts = fileName.split('.');
  return parts.length > 1 ? parts.pop()?.toLowerCase() : undefined;
}

export function isSupportedTranscriptFile(fileName: string): boolean {
  const ext = getExt(fileName);
  // .docx is read+extracted to text by the caller (mammoth) before parsing.
  return ext === 'txt' || ext === 'csv' || ext === 'docx' || isSubtitleExt(ext);
}

/**
 * Parse one file's raw text into transcript entries. Returns [] when there's
 * no usable content (empty file, blank subtitles) so callers can skip it.
 */
export function parseTranscriptFile(fileName: string, text: string): ParsedEntry[] {
  if (!text.trim()) return [];
  const ext = getExt(fileName);
  const baseName = fileName.replace(/\.[^.]+$/i, '') || fileName;

  if (ext === 'csv') {
    const records = parseCsvRecords(text);
    // Drop a header row, but never the only row there is: a one-line CSV that
    // happens to read like a header is more likely a mislabelled transcript
    // than an empty spreadsheet, and returning [] would silently import
    // nothing.
    const rows = records.length > 1 && looksLikeCsvHeaderRow(records[0]) ? records.slice(1) : records;
    return rows
      .map((fields, i) => {
        if (fields.length < 2 || !fields[1]) return { title: `Row ${i + 1}`, content: fields[0] || '' };
        return { title: fields[0] || `Row ${i + 1}`, content: fields[1] };
      })
      .filter((e) => e.content.trim().length > 0);
  }

  if (isSubtitleExt(ext)) {
    const content = parseSubtitles(text);
    return content ? [{ title: baseName, content }] : [];
  }

  // .txt, already-extracted .docx text, and any other plain-text upload
  return [{ title: baseName, content: text.trim() }];
}
