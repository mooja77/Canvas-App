/**
 * "AI vs me" agreement — in-product trust metric.
 *
 * Treats the AI as a second coder and scores its suggestions against the
 * canvas's coded set with the same span-IoU matching the eval harness uses
 * (scoreCodings). Answers the researcher's trust question directly: of what I
 * ended up coding, how much did the AI propose (recall), and of what the AI
 * proposed, how much matched my coding (precision)?
 *
 * Basis (documented in the response): gold = the canvas's final coded segments
 * (CanvasTextCoding, any source); predicted = the AI's suggestions. Comparing
 * against the *final* set (rather than only human-authored codings) keeps the
 * metric meaningful in the AI-assisted workflow, where many final codings
 * originate from accepted suggestions.
 *
 * Also reports confidence calibration — whether higher-confidence suggestions
 * actually agree with the coded set more often. A miscalibrated model (high
 * confidence, low agreement) is the signal the trust layer must surface.
 */
import { scoreCodings, type EvalCoding, type EvalScore } from './evalMetrics.js';

export interface CodingSpan {
  questionId: string | null;
  startOffset: number;
  endOffset: number;
}

export interface AiSuggestionSpan extends CodingSpan {
  confidence: number;
}

export interface CalibrationBucket {
  band: string;
  min: number;
  max: number;
  count: number;
  matched: number;
  /** % of suggestions in this band that matched a coded segment, or null if empty. */
  matchedRate: number | null;
}

export interface AgreementResult {
  goldCount: number;
  predictedCount: number;
  /** Suggestions skipped because they carry no code (can't be compared). */
  skipped: number;
  agreement: EvalScore;
  calibration: CalibrationBucket[];
}

const BANDS: { band: string; min: number; max: number }[] = [
  { band: '0.0–0.5', min: 0, max: 0.5 },
  { band: '0.5–0.7', min: 0.5, max: 0.7 },
  { band: '0.7–0.9', min: 0.7, max: 0.9 },
  // top band is inclusive of 1.0
  { band: '0.9–1.0', min: 0.9, max: Infinity },
];

export function computeAiAgreement(finalCodings: CodingSpan[], suggestions: AiSuggestionSpan[]): AgreementResult {
  const gold: EvalCoding[] = finalCodings
    .filter((c) => c.questionId)
    .map((c) => ({ code: c.questionId as string, startOffset: c.startOffset, endOffset: c.endOffset }));

  // Only suggestions that carry a code can be compared.
  const usable = suggestions.filter((s) => s.questionId);
  const skipped = suggestions.length - usable.length;
  const predicted: EvalCoding[] = usable.map((s) => ({
    code: s.questionId as string,
    startOffset: s.startOffset,
    endOffset: s.endOffset,
  }));

  const agreement = scoreCodings(predicted, gold);
  const matchedPredIdx = new Set(agreement.matched.map((m) => m.predictedIndex));

  const calibration: CalibrationBucket[] = BANDS.map((b) => {
    const idxInBand = usable.map((s, i) => ({ s, i })).filter(({ s }) => s.confidence >= b.min && s.confidence < b.max);
    const matched = idxInBand.filter(({ i }) => matchedPredIdx.has(i)).length;
    return {
      band: b.band,
      min: b.min,
      max: b.max === Infinity ? 1 : b.max,
      count: idxInBand.length,
      matched,
      matchedRate: idxInBand.length ? Math.round((matched / idxInBand.length) * 1000) / 10 : null,
    };
  });

  return { goldCount: gold.length, predictedCount: predicted.length, skipped, agreement, calibration };
}
