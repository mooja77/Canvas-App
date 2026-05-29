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
    expect(isSupportedTranscriptFile('a.pdf')).toBe(false);
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
