import { describe, it, expect } from 'vitest';
import { computeOverlappingSegments } from './TranscriptNode';
import type { CanvasTextCoding } from '@qualcanvas/shared';

/**
 * The coding loop's load-bearing invariant.
 *
 * A user's coding offsets are measured against the RENDERED transcript (
 * handleMouseUp walks the DOM with Range.toString()), but they are STORED
 * against the raw transcript content. Those two only agree if the rendered
 * output reproduces the raw text exactly - which means the segments below must
 * form a complete, non-overlapping partition of [0, text.length].
 *
 * If that ever breaks, nothing throws. Codings are silently stored against the
 * wrong span, and highlights, excerpt context, exports and Krippendorff's alpha
 * all inherit the error. This is the failure the selection gesture could
 * produce that cannot be driven headlessly, so it is pinned here instead.
 *
 * These are characterisation tests: the implementation is CORRECT today and
 * these do not fail against it. They exist so it cannot drift silently.
 */

const colorMap = new Map([
  ['q1', '#ff0000'],
  ['q2', '#00ff00'],
]);

const coding = (id: string, questionId: string, startOffset: number, endOffset: number) =>
  ({ id, questionId, startOffset, endOffset }) as unknown as CanvasTextCoding;

/** The whole point: reassembling the segments must reproduce the text byte for byte. */
const reassemble = (text: string, codings: CanvasTextCoding[], verify?: { start: number; end: number } | null) =>
  computeOverlappingSegments(text, codings, colorMap, verify)
    .map((s) => text.slice(s.start, s.end))
    .join('');

const TEXT = 'First paragraph about access.\n\nSecond paragraph, with a comma.\n\nThird: emoji 😀 and accents é.';

describe('computeOverlappingSegments partitions the transcript exactly', () => {
  const cases: [string, CanvasTextCoding[]][] = [
    ['no codings', []],
    ['one coding', [coding('c1', 'q1', 6, 15)]],
    ['adjacent codings', [coding('c1', 'q1', 0, 5), coding('c2', 'q2', 5, 10)]],
    ['overlapping codings', [coding('c1', 'q1', 0, 20), coding('c2', 'q2', 10, 30)]],
    ['nested codings', [coding('c1', 'q1', 0, 40), coding('c2', 'q2', 10, 20)]],
    ['identical ranges', [coding('c1', 'q1', 6, 15), coding('c2', 'q2', 6, 15)]],
    ['coding at the very start', [coding('c1', 'q1', 0, 1)]],
    ['coding to the very end', [coding('c1', 'q1', TEXT.length - 5, TEXT.length)]],
    ['coding spanning a paragraph break', [coding('c1', 'q1', 25, 40)]],
    ['coding across the emoji', [coding('c1', 'q1', TEXT.indexOf('😀'), TEXT.indexOf('😀') + 2)]],
    // Offsets outside the text are clamped; the partition must still be exact.
    ['offsets past the end', [coding('c1', 'q1', 10, TEXT.length + 500)]],
    ['negative start offset', [coding('c1', 'q1', -20, 12)]],
    ['entirely out of range', [coding('c1', 'q1', 900, 1000)]],
    ['zero-length coding', [coding('c1', 'q1', 12, 12)]],
    ['reversed offsets', [coding('c1', 'q1', 30, 10)]],
  ];

  it.each(cases)('reproduces the text exactly: %s', (_name, codings) => {
    expect(reassemble(TEXT, codings)).toBe(TEXT);
  });

  it.each(cases)('produces contiguous, non-overlapping segments: %s', (_name, codings) => {
    const segments = computeOverlappingSegments(TEXT, codings, colorMap);
    let cursor = 0;
    for (const seg of segments) {
      expect(seg.start).toBe(cursor);
      expect(seg.end).toBeGreaterThan(seg.start);
      cursor = seg.end;
    }
    if (segments.length > 0) expect(cursor).toBe(TEXT.length);
  });

  it('reproduces the text exactly with a verify range present', () => {
    expect(reassemble(TEXT, [coding('c1', 'q1', 6, 15)], { start: 20, end: 45 })).toBe(TEXT);
  });

  it('reproduces the text exactly for a verify range alone', () => {
    expect(reassemble(TEXT, [], { start: 3, end: 9 })).toBe(TEXT);
  });

  it('handles empty text without inventing content', () => {
    expect(reassemble('', [coding('c1', 'q1', 0, 5)])).toBe('');
  });

  it('attributes a segment to every coding covering it', () => {
    const segments = computeOverlappingSegments(
      TEXT,
      [coding('c1', 'q1', 0, 20), coding('c2', 'q2', 10, 30)],
      colorMap,
    );
    const overlap = segments.find((s) => s.start === 10 && s.end === 20);
    expect(overlap?.codingIds.sort()).toEqual(['c1', 'c2']);
  });
});
