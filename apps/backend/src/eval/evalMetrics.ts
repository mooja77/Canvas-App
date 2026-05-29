/**
 * AI suggestion eval — scoring core.
 *
 * Pure functions (no LLM, no DB, no dataset) that score predicted codings
 * against gold (expert) codings. A predicted coding "matches" a gold coding
 * iff they share the same (normalized) code AND their character spans overlap
 * by at least an IoU threshold. Exact-offset matching is too strict for
 * qualitative coding — researchers care that roughly the right passage got
 * roughly the right code, not that offsets are identical.
 *
 * Matching is greedy and 1:1 (highest-overlap pairs first), so neither a gold
 * span nor a predicted span is double-counted. Reports precision / recall / F1
 * overall and per code.
 *
 * See docs/superpowers/specs/2026-05-29-ai-eval-harness-design.md
 */

export interface EvalCoding {
  /** Code identifier or name (compared after normalization). */
  code: string;
  /** Inclusive-exclusive character offsets into the transcript. */
  startOffset: number;
  endOffset: number;
}

export interface PerCodeScore {
  code: string;
  tp: number;
  fp: number;
  fn: number;
  precision: number;
  recall: number;
  f1: number;
}

export interface MatchedPair {
  predictedIndex: number;
  goldIndex: number;
  iou: number;
}

export interface EvalScore {
  precision: number;
  recall: number;
  f1: number;
  tp: number;
  fp: number;
  fn: number;
  perCode: PerCodeScore[];
  matched: MatchedPair[];
}

export interface ScoreOptions {
  /** Minimum span IoU for a same-code pair to count as a match. Default 0.5. */
  iouThreshold?: number;
  /** How to normalize a code before comparing. Default: trim + lowercase. */
  normalizeCode?: (code: string) => string;
}

/** Intersection-over-union of two character spans. 0 when they don't overlap. */
export function spanIoU(a: EvalCoding, b: EvalCoding): number {
  const intersection = Math.max(0, Math.min(a.endOffset, b.endOffset) - Math.max(a.startOffset, b.startOffset));
  if (intersection <= 0) return 0;
  const lenA = Math.max(0, a.endOffset - a.startOffset);
  const lenB = Math.max(0, b.endOffset - b.startOffset);
  const union = lenA + lenB - intersection;
  return union <= 0 ? 0 : intersection / union;
}

function f1Of(precision: number, recall: number): number {
  return precision + recall === 0 ? 0 : (2 * precision * recall) / (precision + recall);
}

/**
 * precision = TP / predictedCount, recall = TP / goldCount, with a defined
 * convention when a denominator is zero:
 *  - nothing predicted AND nothing gold  -> 1 (nothing to find, nothing wrong)
 *  - nothing predicted, gold exists       -> precision 0 (found none of them)
 *  - predictions exist, no gold           -> precision 0 (all false positives)
 */
function prf(tp: number, predictedCount: number, goldCount: number) {
  const precision = predictedCount === 0 ? (goldCount === 0 ? 1 : 0) : tp / predictedCount;
  const recall = goldCount === 0 ? (predictedCount === 0 ? 1 : 0) : tp / goldCount;
  return { precision, recall, f1: f1Of(precision, recall) };
}

export function scoreCodings(predicted: EvalCoding[], gold: EvalCoding[], opts: ScoreOptions = {}): EvalScore {
  const threshold = opts.iouThreshold ?? 0.5;
  const norm = opts.normalizeCode ?? ((c: string) => c.trim().toLowerCase());

  // All same-code pairs that clear the overlap threshold, best overlap first.
  const candidates: MatchedPair[] = [];
  for (let i = 0; i < predicted.length; i++) {
    for (let j = 0; j < gold.length; j++) {
      if (norm(predicted[i].code) !== norm(gold[j].code)) continue;
      const iou = spanIoU(predicted[i], gold[j]);
      if (iou >= threshold) candidates.push({ predictedIndex: i, goldIndex: j, iou });
    }
  }
  candidates.sort((a, b) => b.iou - a.iou);

  const usedPred = new Set<number>();
  const usedGold = new Set<number>();
  const matched: MatchedPair[] = [];
  for (const c of candidates) {
    if (usedPred.has(c.predictedIndex) || usedGold.has(c.goldIndex)) continue;
    usedPred.add(c.predictedIndex);
    usedGold.add(c.goldIndex);
    matched.push(c);
  }

  const tp = matched.length;
  const fp = predicted.length - tp;
  const fn = gold.length - tp;
  const overall = prf(tp, predicted.length, gold.length);

  // Per-code breakdown, keyed by normalized code across gold ∪ predicted.
  const codeKeys = new Set<string>();
  predicted.forEach((p) => codeKeys.add(norm(p.code)));
  gold.forEach((g) => codeKeys.add(norm(g.code)));

  const matchedByCode = new Map<string, number>();
  for (const m of matched) {
    const key = norm(gold[m.goldIndex].code);
    matchedByCode.set(key, (matchedByCode.get(key) ?? 0) + 1);
  }

  const perCode: PerCodeScore[] = Array.from(codeKeys)
    .sort()
    .map((key) => {
      const predictedCount = predicted.filter((p) => norm(p.code) === key).length;
      const goldCount = gold.filter((g) => norm(g.code) === key).length;
      const tpc = matchedByCode.get(key) ?? 0;
      const { precision, recall, f1 } = prf(tpc, predictedCount, goldCount);
      return { code: key, tp: tpc, fp: predictedCount - tpc, fn: goldCount - tpc, precision, recall, f1 };
    });

  return { ...overall, tp, fp, fn, perCode, matched };
}
