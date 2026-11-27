import { describe, it, expect } from 'vitest';
import { trimTranscriptToWordLimit } from './transcriptTrim.js';

describe('trimTranscriptToWordLimit', () => {
  it('leaves transcripts within the word limit untouched', () => {
    const input = 'One two three\nfour five.';
    const res = trimTranscriptToWordLimit(input, 10);
    expect(res).toEqual({ text: input, trimmed: false, wordCount: 5 });
  });

  it('trims transcripts over the Free 10,000-word limit to the first N words preserving line breaks', () => {
    const input = 'First line words\nSecond line words\nThird line words';
    const res = trimTranscriptToWordLimit(input, 5);
    expect(res.trimmed).toBe(true);
    expect(res.wordCount).toBe(9);
    expect(res.text).toBe('First line words\nSecond line');
  });

  it('handles 10,500-word transcripts cleanly down to exactly 10,000 words', () => {
    const input = Array.from({ length: 10500 }, (_, i) => `word${i}`).join(' ');
    const res = trimTranscriptToWordLimit(input, 10000);
    expect(res.trimmed).toBe(true);
    expect(res.wordCount).toBe(10500);
    expect(res.text.split(/\s+/).length).toBe(10000);
  });
});
