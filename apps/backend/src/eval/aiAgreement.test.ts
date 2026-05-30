import { describe, it, expect } from 'vitest';
import { computeAiAgreement, type CodingSpan, type AiSuggestionSpan } from './aiAgreement.js';

describe('computeAiAgreement — "AI vs me" trust metric', () => {
  const gold: CodingSpan[] = [
    { questionId: 'Q-A', startOffset: 0, endOffset: 50 },
    { questionId: 'Q-B', startOffset: 100, endOffset: 150 },
    { questionId: 'Q-C', startOffset: 200, endOffset: 250 },
  ];

  const suggestions: AiSuggestionSpan[] = [
    { questionId: 'Q-A', startOffset: 0, endOffset: 50, confidence: 0.95 }, // exact match -> TP
    { questionId: 'Q-B', startOffset: 100, endOffset: 140, confidence: 0.8 }, // IoU 0.8 -> TP
    { questionId: 'Q-A', startOffset: 300, endOffset: 350, confidence: 0.6 }, // no gold there -> FP
    { questionId: null, startOffset: 400, endOffset: 420, confidence: 0.9 }, // no code -> skipped
    // gold Q-C (200-250) is never suggested -> FN
  ];

  it('scores AI suggestions against the coded set (P/R/F1) and skips codeless suggestions', () => {
    const r = computeAiAgreement(gold, suggestions);

    expect(r.goldCount).toBe(3);
    expect(r.predictedCount).toBe(3); // 4 suggestions minus 1 codeless
    expect(r.skipped).toBe(1);

    expect(r.agreement.tp).toBe(2);
    expect(r.agreement.fp).toBe(1);
    expect(r.agreement.fn).toBe(1);
    expect(r.agreement.precision).toBeCloseTo(2 / 3, 5);
    expect(r.agreement.recall).toBeCloseTo(2 / 3, 5);
    expect(r.agreement.f1).toBeCloseTo(2 / 3, 5);
  });

  it('reports confidence calibration — agreement rate per confidence band', () => {
    const r = computeAiAgreement(gold, suggestions);
    const byBand = Object.fromEntries(r.calibration.map((b) => [b.band, b]));

    expect(byBand['0.0–0.5'].count).toBe(0);
    expect(byBand['0.0–0.5'].matchedRate).toBeNull();

    // 0.6-confidence false positive: in band, not matched -> 0%
    expect(byBand['0.5–0.7'].count).toBe(1);
    expect(byBand['0.5–0.7'].matched).toBe(0);
    expect(byBand['0.5–0.7'].matchedRate).toBe(0);

    // 0.8-confidence true positive -> 100%
    expect(byBand['0.7–0.9'].count).toBe(1);
    expect(byBand['0.7–0.9'].matchedRate).toBe(100);

    // 0.95-confidence true positive -> 100% (top band inclusive of 1.0)
    expect(byBand['0.9–1.0'].count).toBe(1);
    expect(byBand['0.9–1.0'].matchedRate).toBe(100);
  });

  it('handles the empty cases without throwing', () => {
    const none = computeAiAgreement([], []);
    expect(none.predictedCount).toBe(0);
    expect(none.goldCount).toBe(0);
    // nothing predicted and nothing gold -> precision/recall defined as 1 (per scoreCodings convention)
    expect(none.agreement.f1).toBe(1);

    const onlyGold = computeAiAgreement(gold, []);
    expect(onlyGold.agreement.recall).toBe(0); // AI found none of my codings
  });
});
