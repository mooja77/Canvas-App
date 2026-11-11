/**
 * Reading a transcript file into plain text, shared by the import dialog and
 * the first-run screen.
 *
 * .docx, .pdf and .xlsx are binary, so they are read as an ArrayBuffer and
 * extracted. The parsers are lazy-imported so they only load when a researcher
 * actually opens that kind of file, and none of them enters the canvas bundle.
 */
import { getExt, parseTranscriptFile } from './transcriptFiles';

function readFileText(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => resolve((e.target?.result as string) ?? '');
    reader.onerror = () => reject(new Error('read failed'));
    reader.readAsText(file);
  });
}

export async function extractFileText(file: File): Promise<string> {
  const ext = getExt(file.name);
  if (ext === 'docx') {
    const mammoth = (await import('mammoth')).default;
    const arrayBuffer = await file.arrayBuffer();
    const { value } = await mammoth.extractRawText({ arrayBuffer });
    return value;
  }
  if (ext === 'pdf') {
    const { extractPdfText } = await import('./pdfText');
    return extractPdfText(await file.arrayBuffer());
  }
  if (ext === 'xlsx') {
    // The first sheet is re-serialised as CSV so the CSV transcript parser,
    // which already understands Qualtrics and Excel survey exports, handles it.
    const { readXlsxRecords, recordsToCsv } = await import('./xlsxText');
    return recordsToCsv(await readXlsxRecords(await file.arrayBuffer()));
  }
  return readFileText(file);
}

/** One file, one transcript: the kinds a researcher's interview arrives as. */
export const FIRST_TRANSCRIPT_EXTENSIONS = ['docx', 'pdf', 'txt', 'vtt', 'srt'] as const;
export const FIRST_TRANSCRIPT_ACCEPT = FIRST_TRANSCRIPT_EXTENSIONS.map((ext) => `.${ext}`).join(',');

/**
 * Read one file as the researcher's first transcript. Rejects with a message
 * that can be shown as it is: what went wrong and what to do instead.
 */
export async function readFirstTranscript(file: File): Promise<{ title: string; content: string }> {
  const ext = getExt(file.name);
  if (!ext || !(FIRST_TRANSCRIPT_EXTENSIONS as readonly string[]).includes(ext)) {
    throw new Error('Choose a .docx, .pdf, .txt, .vtt or .srt file, or paste the text instead.');
  }
  let text: string;
  try {
    text = await extractFileText(file);
  } catch (error) {
    // The PDF reader already explains scans and protected files in plain words.
    const reason = error instanceof Error && error.message && error.message !== 'read failed' ? error.message : '';
    throw new Error(reason || 'This file could not be read. Paste the text instead.', { cause: error });
  }
  const [entry] = parseTranscriptFile(file.name, text);
  if (!entry) {
    throw new Error('There is no text in this file. Paste the text instead.');
  }
  return entry;
}
