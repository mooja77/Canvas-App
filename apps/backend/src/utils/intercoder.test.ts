import { describe, it, expect } from 'vitest';
import { computeKrippendorffAlpha, computeFleissKappa, buildSegmentCodeObservations } from './intercoder.js';

describe("Krippendorff's α", () => {
  it('returns α=1 for perfect agreement', () => {
    const result = computeKrippendorffAlpha([
      { unitId: 'u1', coderId: 'c1', value: 'A' },
      { unitId: 'u1', coderId: 'c2', value: 'A' },
      { unitId: 'u2', coderId: 'c1', value: 'B' },
      { unitId: 'u2', coderId: 'c2', value: 'B' },
    ]);
    expect(result.alpha).toBeCloseTo(1.0, 4);
    expect(result.n_coders).toBe(2);
    expect(result.n_units).toBe(2);
  });

  it('handles units with only 1 observation (skips them, no crash)', () => {
    const result = computeKrippendorffAlpha([
      { unitId: 'u1', coderId: 'c1', value: 'A' },
      { unitId: 'u1', coderId: 'c2', value: 'A' },
      { unitId: 'u2', coderId: 'c1', value: 'B' },
    ]);
    expect(result.alpha).toBeCloseTo(1.0, 4);
    expect(result.n_units).toBe(1);
  });

  it('high agreement on 12-unit fixture lands α > 0.7', () => {
    const obs = [
      { unitId: '1', coderId: 'A', value: '1' },
      { unitId: '1', coderId: 'B', value: '1' },
      { unitId: '2', coderId: 'A', value: '2' },
      { unitId: '2', coderId: 'B', value: '2' },
      { unitId: '3', coderId: 'A', value: '3' },
      { unitId: '3', coderId: 'B', value: '3' },
      { unitId: '4', coderId: 'A', value: '3' },
      { unitId: '4', coderId: 'B', value: '3' },
      { unitId: '5', coderId: 'A', value: '2' },
      { unitId: '5', coderId: 'B', value: '2' },
      { unitId: '6', coderId: 'A', value: '1' },
      { unitId: '6', coderId: 'B', value: '2' },
      { unitId: '7', coderId: 'A', value: '4' },
      { unitId: '7', coderId: 'B', value: '4' },
      { unitId: '8', coderId: 'A', value: '1' },
      { unitId: '8', coderId: 'B', value: '1' },
      { unitId: '9', coderId: 'A', value: '2' },
      { unitId: '9', coderId: 'B', value: '2' },
      { unitId: '10', coderId: 'A', value: '5' },
      { unitId: '10', coderId: 'B', value: '5' },
      { unitId: '11', coderId: 'A', value: '1' },
      { unitId: '11', coderId: 'B', value: '3' },
      { unitId: '12', coderId: 'A', value: '3' },
      { unitId: '12', coderId: 'B', value: '3' },
    ];
    const result = computeKrippendorffAlpha(obs);
    expect(result.alpha).toBeGreaterThan(0.7);
    expect(result.alpha).toBeLessThan(0.95);
    expect(result.n_units).toBe(12);
    expect(result.n_coders).toBe(2);
  });

  it('handles 3+ coders', () => {
    const obs = [
      { unitId: 'u1', coderId: 'a', value: 'X' },
      { unitId: 'u1', coderId: 'b', value: 'X' },
      { unitId: 'u1', coderId: 'c', value: 'X' },
      { unitId: 'u2', coderId: 'a', value: 'Y' },
      { unitId: 'u2', coderId: 'b', value: 'Y' },
      { unitId: 'u2', coderId: 'c', value: 'Y' },
    ];
    const result = computeKrippendorffAlpha(obs);
    expect(result.alpha).toBeCloseTo(1.0, 4);
    expect(result.n_coders).toBe(3);
  });
});

describe("Fleiss' κ", () => {
  it('returns κ=1 for perfect agreement', () => {
    const result = computeFleissKappa([
      { unitId: 'u1', ratings: ['A', 'A', 'A'] },
      { unitId: 'u2', ratings: ['B', 'B', 'B'] },
    ]);
    expect(result.kappa).toBeCloseTo(1.0, 4);
    expect(result.n_coders).toBe(3);
    expect(result.n_units).toBe(2);
  });

  it('mostly-agreement fixture computes positive κ in valid range', () => {
    // 5 items × 3 raters, mostly agreement with 3 disagreements.
    // P_observed ≈ 0.6, P_expected ≈ 0.502 → κ ≈ 0.196
    const obs = [
      { unitId: '1', ratings: ['A', 'A', 'A'] },
      { unitId: '2', ratings: ['B', 'B', 'B'] },
      { unitId: '3', ratings: ['A', 'A', 'B'] },
      { unitId: '4', ratings: ['B', 'B', 'A'] },
      { unitId: '5', ratings: ['A', 'B', 'A'] },
    ];
    const result = computeFleissKappa(obs);
    expect(result.kappa).toBeGreaterThan(0); // positive — better than chance
    expect(result.kappa).toBeLessThan(1.0);
    expect(result.P_observed).toBeGreaterThan(result.P_expected);
    expect(result.P_observed).toBeCloseTo(0.6, 2);
  });

  it('throws on inconsistent rater counts per item', () => {
    expect(() =>
      computeFleissKappa([
        { unitId: '1', ratings: ['A', 'A', 'A'] },
        { unitId: '2', ratings: ['B', 'B'] },
      ]),
    ).toThrow(/same number of coders/);
  });

  it('returns sensible defaults on empty input', () => {
    const result = computeFleissKappa([]);
    expect(result.kappa).toBe(0);
    expect(result.n_units).toBe(0);
    expect(result.n_coders).toBe(0);
  });
});

describe('buildSegmentCodeObservations (multi-coder adapter)', () => {
  const seg = (startOffset: number, endOffset: number) => ({ transcriptId: 't1', startOffset, endOffset });
  const coding = (questionId: string, startOffset: number, endOffset: number) => ({
    transcriptId: 't1',
    questionId,
    startOffset,
    endOffset,
  });

  it('emits one observation per (segment × code × coder)', () => {
    // 2 segments, 1 code, 2 coders => 2 × 1 × 2 = 4 observations
    const obs = buildSegmentCodeObservations({
      segments: [seg(0, 10), seg(10, 20)],
      coders: [
        { coderId: 'a', codings: [coding('q1', 0, 5)] },
        { coderId: 'b', codings: [coding('q1', 0, 5)] },
      ],
    });
    expect(obs).toHaveLength(4);
  });

  it('marks a code present (1) when a coder overlaps the segment, absent (0) otherwise', () => {
    const obs = buildSegmentCodeObservations({
      segments: [seg(0, 10)],
      coders: [
        { coderId: 'a', codings: [coding('q1', 2, 6)] }, // overlaps -> present
        { coderId: 'b', codings: [coding('q1', 50, 60)] }, // no overlap -> absent
      ],
    });
    expect(obs.find((o) => o.coderId === 'a')?.value).toBe('1');
    expect(obs.find((o) => o.coderId === 'b')?.value).toBe('0');
  });

  it('feeds Krippendorff α: full agreement across 2 coders on 1 code yields α = 1', () => {
    const obs = buildSegmentCodeObservations({
      segments: [seg(0, 10), seg(10, 20)],
      coders: [
        { coderId: 'a', codings: [coding('q1', 0, 5)] }, // codes seg1 only
        { coderId: 'b', codings: [coding('q1', 0, 5)] }, // codes seg1 only
      ],
    });
    const result = computeKrippendorffAlpha(obs);
    expect(result.alpha).toBeCloseTo(1.0, 4);
    expect(result.n_coders).toBe(2);
  });

  it('includes every code any coder used as a unit dimension', () => {
    const obs = buildSegmentCodeObservations({
      segments: [seg(0, 10)],
      coders: [
        { coderId: 'a', codings: [coding('q1', 0, 5)] },
        { coderId: 'b', codings: [coding('q2', 0, 5)] },
      ],
    });
    // 1 segment × 2 distinct codes × 2 coders = 4 observations
    expect(obs).toHaveLength(4);
    // one unit per (segment, code)
    expect(new Set(obs.map((o) => o.unitId)).size).toBe(2);
  });
});
