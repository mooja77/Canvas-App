import { describe, it, expect } from 'vitest';
import { sanitizeComputedConfig } from './computedConfig.js';
import { computeClusters } from './textAnalysis.js';

describe('sanitizeComputedConfig', () => {
  it('keeps well-typed values', () => {
    expect(
      sanitizeComputedConfig({ pattern: 'x', questionIds: ['a', 'b'], k: 4, maxWords: 50, stopWords: ['the'] }),
    ).toEqual({ pattern: 'x', questionIds: ['a', 'b'], k: 4, maxWords: 50, stopWords: ['the'] });
  });

  it('drops wrong types that used to crash the run', () => {
    expect(sanitizeComputedConfig({ pattern: 5, questionIds: 'abc', stopWords: 'x', k: 'three' })).toEqual({});
  });

  it('rounds and clamps numbers', () => {
    expect(sanitizeComputedConfig({ k: 2.5, maxWords: 10_000, minOverlap: -3 })).toEqual({
      k: 3,
      maxWords: 500,
      minOverlap: 0,
    });
  });

  it('filters malformed coding-query conditions', () => {
    expect(
      sanitizeComputedConfig({
        conditions: [
          { questionId: 'q1', operator: 'AND' },
          { questionId: 2, operator: 'OR' },
          { operator: 'XOR' },
          null,
        ],
      }),
    ).toEqual({ conditions: [{ questionId: 'q1', operator: 'AND' }] });
  });

  it('tolerates non-object input', () => {
    expect(sanitizeComputedConfig(null)).toEqual({});
    expect(sanitizeComputedConfig([1, 2])).toEqual({});
  });

  it('a sanitized fractional k no longer crashes clustering', () => {
    const codings = Array.from({ length: 6 }, (_, i) => ({
      id: `c${i}`,
      transcriptId: 't1',
      questionId: 'q1',
      startOffset: 0,
      endOffset: 5,
      codedText: `workload stress manager support ${i}`,
    }));
    const k = sanitizeComputedConfig({ k: 2.5 }).k!;
    expect(() => computeClusters(codings, k)).not.toThrow();
  });
});
