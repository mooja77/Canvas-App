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
    return parseCsvRecords(text)
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
