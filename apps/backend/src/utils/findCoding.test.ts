import { describe, it, expect } from 'vitest';
import { findCoding } from './findCoding.js';

describe('findCoding', () => {
  const transcript =
    'And then the IRB said no, which was just devastating. We had to scrap six months of work. Then the IRB said no again, and we appealed.';

  it('finds the first occurrence when no anchor is provided', () => {
    const result = findCoding(transcript, 'the IRB said no', null);
    expect(result).toEqual({ start: 9, end: 24 });
  });

  it('uses anchorBefore to disambiguate when the substring repeats', () => {
    // Anchor before the SECOND occurrence
    const result = findCoding(transcript, 'the IRB said no', 'six months of work. Then ');
    expect(result).not.toBeNull();
    // Second occurrence starts at position 95
    expect(result!.start).toBeGreaterThan(50);
    expect(transcript.slice(result!.start, result!.end)).toBe('the IRB said no');
  });

  it('returns null when codedText is not in the transcript (likely hallucinated)', () => {
    const result = findCoding(transcript, 'this text was never said', 'And then ');
    expect(result).toBeNull();
  });

  it('falls back to first occurrence when anchor is missing from transcript', () => {
    // Anchor that doesn't appear → fallback kicks in
    const result = findCoding(transcript, 'the IRB said no', 'nonexistent context xx');
    expect(result).toEqual({ start: 9, end: 24 });
  });

  it('rejects anchors shorter than 10 chars (too ambiguous)', () => {
    // 7-char anchor should be ignored, falling back to first occurrence
    const result = findCoding(transcript, 'the IRB said no', 'short');
    expect(result).toEqual({ start: 9, end: 24 });
  });

  it('rejects an anchor-coding gap larger than 50 chars (anchor too far)', () => {
    // Anchor "And then " appears at the start. The SECOND occurrence of
    // "the IRB said no" is ~100 chars later — too far from the anchor to
    // be the intended match. Falls back to first occurrence.
    const result = findCoding(transcript, 'the IRB said no', 'And then ');
    expect(result).toEqual({ start: 9, end: 24 }); // first occurrence
  });

  it('handles empty codedText defensively', () => {
    expect(findCoding(transcript, '', 'anything')).toBeNull();
  });

  it('handles missing anchor parameter', () => {
    expect(findCoding(transcript, 'the IRB said no', undefined)).toEqual({ start: 9, end: 24 });
  });
});
