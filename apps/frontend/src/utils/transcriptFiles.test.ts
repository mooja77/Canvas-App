import { describe, it, expect } from 'vitest';
import { parseTranscriptFile, isSupportedTranscriptFile, getExt } from './transcriptFiles';

describe('getExt / isSupportedTranscriptFile', () => {
  it('extracts lowercased extensions', () => {
    expect(getExt('Interview.TXT')).toBe('txt');
    expect(getExt('a.b.srt')).toBe('srt');
    expect(getExt('noext')).toBeUndefined();
  });
  it('recognizes supported transcript files only', () => {
    expect(isSupportedTranscriptFile('a.txt')).toBe(true);
    expect(isSupportedTranscriptFile('a.csv')).toBe(true);
    expect(isSupportedTranscriptFile('a.vtt')).toBe(true);
    expect(isSupportedTranscriptFile('a.srt')).toBe(true);
    expect(isSupportedTranscriptFile('a.docx')).toBe(true);
    expect(isSupportedTranscriptFile('a.pdf')).toBe(true);
    expect(isSupportedTranscriptFile('a.doc')).toBe(false); // legacy .doc not supported
  });
});

describe('parseTranscriptFile', () => {
  it('parses .txt into one entry titled by filename', () => {
    expect(parseTranscriptFile('Interview A.txt', '  hello world  ')).toEqual([
      { title: 'Interview A', content: 'hello world' },
    ]);
  });

  it('parses .csv into many entries (title col 1, content col 2)', () => {
    const csv = 'P1,first answer\nP2,second answer';
    const out = parseTranscriptFile('survey.csv', csv);
    expect(out).toHaveLength(2);
    expect(out[0]).toEqual({ title: 'P1', content: 'first answer' });
    expect(out[1].title).toBe('P2');
  });

  it('parses .vtt into one cleaned transcript', () => {
    const vtt = 'WEBVTT\n\n00:00.000 --> 00:02.000\nHello there.\n';
    expect(parseTranscriptFile('call.vtt', vtt)).toEqual([{ title: 'call', content: 'Hello there.' }]);
  });

  it('returns [] for empty or content-less files', () => {
    expect(parseTranscriptFile('a.txt', '   ')).toEqual([]);
    expect(parseTranscriptFile('a.vtt', 'WEBVTT\n\n')).toEqual([]);
  });

  it('treats a single-column CSV row as content', () => {
    // Mirrors the original behavior: a lone field becomes the transcript body.
    const out = parseTranscriptFile('s.csv', 'just one column of text');
    expect(out).toEqual([{ title: 'Row 1', content: 'just one column of text' }]);
  });
});

/**
 * Every CSV out of Excel, Sheets, Qualtrics or SPSS has a header row.
 * Importing it produced a transcript titled "Title" whose content was the word
 * "Content": a junk source that consumed one of the Free plan's five
 * transcript slots and polluted the word counts and coverage statistics.
 * SurveyImportModal already treated row 0 as headers, so the two CSV paths in
 * the app disagreed.
 */
describe('CSV header rows', () => {
  it('does not import the header row as a transcript', () => {
    const csv = 'Title,Content\n"Interview 1","first content"\n"Interview 2","second content"';
    const out = parseTranscriptFile('interviews.csv', csv);

    expect(out).toHaveLength(2);
    expect(out[0]).toEqual({ title: 'Interview 1', content: 'first content' });
    expect(out.some((e) => e.title === 'Title')).toBe(false);
  });

  it('recognises the usual spellings and separators', () => {
    for (const header of ['Title,Content', 'name,text', 'Participant ID,Response', 'file_name,transcript']) {
      const out = parseTranscriptFile('x.csv', header + '\nP1,a real answer');
      expect(out).toEqual([{ title: 'P1', content: 'a real answer' }]);
    }
  });

  it('keeps the first row when it is data, not a header', () => {
    const csv = '"Interview 1","first content"\n"Interview 2","second content"';
    const out = parseTranscriptFile('interviews.csv', csv);

    expect(out).toHaveLength(2);
    expect(out[0].title).toBe('Interview 1');
  });

  it('does not eat the only row in a one-line CSV', () => {
    // Better a single odd-looking transcript than an import that silently
    // produces nothing.
    const out = parseTranscriptFile('one.csv', 'Title,Content');
    expect(out).toEqual([{ title: 'Title', content: 'Content' }]);
  });

  it('does not mistake a real answer for a header', () => {
    const csv = 'Notes,Text about the closure\nP2,second';
    const out = parseTranscriptFile('x.csv', csv);
    expect(out[0]).toEqual({ title: 'Notes', content: 'Text about the closure' });
  });
});
