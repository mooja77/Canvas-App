import { describe, it, expect } from 'vitest';
import { scoreCodings, spanIoU, type EvalCoding } from './evalMetrics.js';

const C = (code: string, startOffset: number, endOffset: number): EvalCoding => ({ code, startOffset, endOffset });

describe('spanIoU', () => {
  it('is 1 for identical spans', () => {
    expect(spanIoU(C('x', 0, 10), C('x', 0, 10))).toBe(1);
  });
  it('is 0 for disjoint spans', () => {
    expect(spanIoU(C('x', 0, 10), C('x', 20, 30))).toBe(0);
  });
  it('is 0 for touching-but-not-overlapping spans', () => {
    expect(spanIoU(C('x', 0, 10), C('x', 10, 20))).toBe(0);
  });
  it('computes intersection / union for partial overlap', () => {
    // [0,10) vs [5,15): intersection 5, union 15 => 1/3
    expect(spanIoU(C('x', 0, 10), C('x', 5, 15))).toBeCloseTo(1 / 3, 6);
  });
});

describe('scoreCodings', () => {
  it('scores a perfect match as 1/1/1', () => {
    const gold = [C('joy', 0, 10), C('fear', 20, 30)];
    const predicted = [C('joy', 0, 10), C('fear', 20, 30)];
    const s = scoreCodings(predicted, gold);
    expect(s.tp).toBe(2);
    expect(s.fp).toBe(0);
    expect(s.fn).toBe(0);
    expect(s.precision).toBe(1);
    expect(s.recall).toBe(1);
    expect(s.f1).toBe(1);
  });

  it('matches on span overlap above threshold, not exact offsets', () => {
    const gold = [C('joy', 0, 10)];
    const predicted = [C('joy', 1, 11)]; // IoU = 9/11 ≈ 0.82 >= 0.5
    const s = scoreCodings(predicted, gold);
    expect(s.tp).toBe(1);
    expect(s.f1).toBe(1);
  });

  it('does NOT match when overlap is below threshold', () => {
    const gold = [C('joy', 0, 10)];
    const predicted = [C('joy', 8, 30)]; // IoU = 2/30 ≈ 0.067 < 0.5
    const s = scoreCodings(predicted, gold);
    expect(s.tp).toBe(0);
    expect(s.fp).toBe(1);
    expect(s.fn).toBe(1);
  });

  it('does NOT match same span with a different code', () => {
    const gold = [C('joy', 0, 10)];
    const predicted = [C('fear', 0, 10)];
    const s = scoreCodings(predicted, gold);
    expect(s.tp).toBe(0);
    expect(s.precision).toBe(0);
    expect(s.recall).toBe(0);
  });

  it('normalizes code names (case/whitespace insensitive by default)', () => {
    const gold = [C('Joy', 0, 10)];
    const predicted = [C('  joy ', 0, 10)];
    expect(scoreCodings(predicted, gold).tp).toBe(1);
  });

  it('computes precision/recall for partial detection', () => {
    // gold has 2; model predicts 1 correct + 1 spurious
    const gold = [C('joy', 0, 10), C('fear', 20, 30)];
    const predicted = [C('joy', 0, 10), C('anger', 40, 50)];
    const s = scoreCodings(predicted, gold);
    expect(s.tp).toBe(1);
    expect(s.fp).toBe(1); // anger
    expect(s.fn).toBe(1); // fear
    expect(s.precision).toBe(0.5);
    expect(s.recall).toBe(0.5);
    expect(s.f1).toBeCloseTo(0.5, 6);
  });

  it('uses greedy 1:1 matching — one gold cannot absorb two predictions', () => {
    const gold = [C('joy', 0, 10)];
    const predicted = [C('joy', 0, 10), C('joy', 1, 11)]; // both overlap the single gold
    const s = scoreCodings(predicted, gold);
    expect(s.tp).toBe(1); // only one can match
    expect(s.fp).toBe(1); // the other is a false positive
    expect(s.fn).toBe(0);
    expect(s.precision).toBe(0.5);
    expect(s.recall).toBe(1);
  });

  it('prefers the higher-overlap pair when matching greedily', () => {
    const gold = [C('joy', 0, 10)];
    const predicted = [C('joy', 5, 15), C('joy', 0, 10)]; // second is the exact match
    const s = scoreCodings(predicted, gold);
    expect(s.tp).toBe(1);
    expect(s.matched[0].predictedIndex).toBe(1); // exact-overlap prediction wins
    expect(s.matched[0].iou).toBe(1);
  });

  it('produces a per-code breakdown', () => {
    const gold = [C('joy', 0, 10), C('joy', 20, 30), C('fear', 40, 50)];
    const predicted = [C('joy', 0, 10), C('fear', 41, 51)];
    const s = scoreCodings(predicted, gold);
    const joy = s.perCode.find((c) => c.code === 'joy')!;
    const fear = s.perCode.find((c) => c.code === 'fear')!;
    expect(joy.tp).toBe(1);
    expect(joy.fn).toBe(1); // second joy missed
    expect(joy.recall).toBe(0.5);
    expect(fear.tp).toBe(1);
    expect(fear.recall).toBe(1);
  });

  it('handles empty inputs with defined conventions', () => {
    expect(scoreCodings([], [])).toMatchObject({ tp: 0, precision: 1, recall: 1, f1: 1 });
    expect(scoreCodings([], [C('joy', 0, 10)])).toMatchObject({ tp: 0, precision: 0, recall: 0 });
    expect(scoreCodings([C('joy', 0, 10)], [])).toMatchObject({ tp: 0, precision: 0, recall: 0 });
  });

  it('respects a custom iouThreshold', () => {
    const gold = [C('joy', 0, 10)];
    const predicted = [C('joy', 0, 6)]; // IoU = 6/10 = 0.6
    expect(scoreCodings(predicted, gold, { iouThreshold: 0.5 }).tp).toBe(1);
    expect(scoreCodings(predicted, gold, { iouThreshold: 0.7 }).tp).toBe(0);
  });
});
