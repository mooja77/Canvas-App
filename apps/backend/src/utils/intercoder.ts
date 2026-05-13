/**
 * Cohen's Kappa computation for intercoder reliability.
 *
 * Compares two sets of codings (gold-standard vs attempt) over a transcript
 * by discretising the transcript into character-level units and computing
 * agreement on a per-question basis.
 */

interface CodingSpan {
  questionId: string;
  startOffset: number;
  endOffset: number;
  codedText?: string;
}

/**
 * Compute Cohen's Kappa between gold-standard codings and attempt codings.
 *
 * The transcript is divided into character-position units. For each question
 * present in either set, each position is classified as coded/not-coded by
 * each rater. The overall Kappa is computed as a weighted average across
 * all questions (weighted by number of positions).
 *
 * @param goldCodings   Array of gold-standard coding spans
 * @param attemptCodings Array of attempt coding spans
 * @param transcriptLength  Length of the transcript in characters
 * @returns Kappa score between -1 and 1 (1 = perfect agreement)
 */
export function computeKappa(
  goldCodings: CodingSpan[],
  attemptCodings: CodingSpan[],
  transcriptLength: number,
): number {
  if (transcriptLength <= 0) return 0;

  // Collect all unique question IDs
  const questionIds = new Set<string>();
  for (const c of goldCodings) questionIds.add(c.questionId);
  for (const c of attemptCodings) questionIds.add(c.questionId);

  if (questionIds.size === 0) return 1; // No codings from either side = perfect agreement

  let totalAgreement = 0;
  let totalExpected = 0;
  let totalPositions = 0;

  for (const qId of questionIds) {
    const goldSpans = goldCodings.filter((c) => c.questionId === qId);
    const attemptSpans = attemptCodings.filter((c) => c.questionId === qId);

    // Build boolean arrays for this question
    const goldBits = new Uint8Array(transcriptLength);
    const attemptBits = new Uint8Array(transcriptLength);

    for (const s of goldSpans) {
      const start = Math.max(0, Math.min(s.startOffset, transcriptLength));
      const end = Math.max(0, Math.min(s.endOffset, transcriptLength));
      for (let i = start; i < end; i++) goldBits[i] = 1;
    }

    for (const s of attemptSpans) {
      const start = Math.max(0, Math.min(s.startOffset, transcriptLength));
      const end = Math.max(0, Math.min(s.endOffset, transcriptLength));
      for (let i = start; i < end; i++) attemptBits[i] = 1;
    }

    // Count agreement cells
    let a = 0; // both coded
    let b = 0; // gold coded, attempt not
    let c = 0; // gold not, attempt coded
    let d = 0; // neither coded

    for (let i = 0; i < transcriptLength; i++) {
      if (goldBits[i] === 1 && attemptBits[i] === 1) a++;
      else if (goldBits[i] === 1 && attemptBits[i] === 0) b++;
      else if (goldBits[i] === 0 && attemptBits[i] === 1) c++;
      else d++;
    }

    const n = transcriptLength;
    const po = (a + d) / n; // observed agreement
    const pe = ((a + b) * (a + c) + (c + d) * (b + d)) / (n * n); // expected agreement

    totalAgreement += po * n;
    totalExpected += pe * n;
    totalPositions += n;
  }

  if (totalPositions === 0) return 1;

  const overallPo = totalAgreement / totalPositions;
  const overallPe = totalExpected / totalPositions;

  if (overallPe >= 1) return 1; // Avoid division by zero when expected agreement is 1

  return (overallPo - overallPe) / (1 - overallPe);
}

// ─── Krippendorff's α ──────────────────────────────────────────────────
//
// Sprint D of V3 plan (2026-05-13). Methods reviewers prefer α over Cohen's
// κ for any of: >2 coders, missing data, nominal categories with skewed
// marginals. Reference: Krippendorff (2018) Content Analysis ch. 12.
// See also: https://atlasti.com/research-hub/measuring-inter-coder-agreement-why-cohen-s-kappa-is-not-a-good-choice

export interface KrippendorffInput {
  unitId: string; // coding unit identifier (e.g. transcript span ID)
  coderId: string; // which researcher
  value: string; // the code applied (nominal)
}

export interface KrippendorffResult {
  alpha: number; // -1 to 1, where 1 = perfect agreement
  n_units: number; // number of units with ≥2 observations
  n_coders: number; // distinct coders seen
  n_observations: number; // total observations across all units
  scale: 'nominal';
}

/**
 * Compute Krippendorff's α for nominal-scale agreement.
 *
 *   α = 1 - (D_o / D_e)
 *   D_o = observed disagreement (within-unit coincidences that disagree)
 *   D_e = expected disagreement under chance (marginal-product baseline)
 *
 * α=1 is perfect agreement. α=0 is chance-level agreement. Negative α
 * indicates systematic disagreement. Returns α=1 when D_e=0 (degenerate
 * case: all observations are the same value).
 */
export function computeKrippendorffAlpha(observations: KrippendorffInput[]): KrippendorffResult {
  const unitMap = new Map<string, Map<string, string>>();
  const allValues = new Set<string>();
  const allCoders = new Set<string>();

  for (const obs of observations) {
    if (!unitMap.has(obs.unitId)) unitMap.set(obs.unitId, new Map());
    unitMap.get(obs.unitId)!.set(obs.coderId, obs.value);
    allValues.add(obs.value);
    allCoders.add(obs.coderId);
  }

  const values = Array.from(allValues);
  const valueIndex = new Map(values.map((v, i) => [v, i]));
  const n_values = values.length;

  const o: number[][] = Array.from({ length: n_values }, () => new Array(n_values).fill(0));
  const n_per_value: number[] = new Array(n_values).fill(0);
  let n_observations = 0;
  let n_units_with_pair = 0;

  for (const [, coderValues] of unitMap) {
    const vals = Array.from(coderValues.values());
    const m_u = vals.length;
    if (m_u < 2) continue;
    n_observations += m_u;
    n_units_with_pair++;
    for (let i = 0; i < vals.length; i++) {
      for (let j = 0; j < vals.length; j++) {
        if (i === j) continue;
        const vi = valueIndex.get(vals[i])!;
        const vj = valueIndex.get(vals[j])!;
        o[vi][vj] += 1 / (m_u - 1);
        n_per_value[vi] += 1 / (m_u - 1);
      }
    }
  }

  const n_total = n_per_value.reduce((a, b) => a + b, 0);
  const metric = (v1: number, v2: number) => (v1 === v2 ? 0 : 1);

  let D_o = 0;
  for (let i = 0; i < n_values; i++) {
    for (let j = 0; j < n_values; j++) {
      D_o += o[i][j] * metric(i, j);
    }
  }
  D_o = n_total === 0 ? 0 : D_o / n_total;

  let D_e = 0;
  if (n_total > 1) {
    for (let i = 0; i < n_values; i++) {
      for (let j = 0; j < n_values; j++) {
        D_e += ((n_per_value[i] * n_per_value[j]) / (n_total * (n_total - 1))) * metric(i, j);
      }
    }
  }

  const alpha = D_e === 0 ? 1 : 1 - D_o / D_e;

  return {
    alpha,
    n_units: n_units_with_pair,
    n_coders: allCoders.size,
    n_observations,
    scale: 'nominal',
  };
}

// ─── Fleiss' κ ─────────────────────────────────────────────────────────

export interface FleissInput {
  unitId: string;
  ratings: string[]; // one rating per coder; must be same length per item
}

export interface FleissResult {
  kappa: number;
  P_observed: number;
  P_expected: number;
  n_units: number;
  n_coders: number;
}

/**
 * Compute Fleiss' κ for ≥3 coders with complete data per item.
 *
 * Reference: Fleiss (1971) "Measuring nominal scale agreement among many raters",
 * Psychological Bulletin 76(5): 378-382.
 *
 * If your data has missing observations (some coders coded some items),
 * prefer computeKrippendorffAlpha() — α tolerates missingness; κ does not.
 */
export function computeFleissKappa(observations: FleissInput[]): FleissResult {
  if (observations.length === 0) {
    return { kappa: 0, P_observed: 0, P_expected: 0, n_units: 0, n_coders: 0 };
  }
  const n_coders = observations[0].ratings.length;
  const n_units = observations.length;

  for (const obs of observations) {
    if (obs.ratings.length !== n_coders) {
      throw new Error(
        `Fleiss' kappa requires the same number of coders per unit. Got ${obs.ratings.length} on unit ${obs.unitId}, expected ${n_coders}.`,
      );
    }
  }

  const categories = new Set<string>();
  for (const obs of observations) {
    for (const r of obs.ratings) categories.add(r);
  }
  const cats = Array.from(categories);
  const catIndex = new Map(cats.map((c, i) => [c, i]));

  const n_ij: number[][] = observations.map((obs) => {
    const counts = new Array(cats.length).fill(0);
    for (const r of obs.ratings) {
      counts[catIndex.get(r)!] += 1;
    }
    return counts;
  });

  const P_i = n_ij.map((row) => {
    const sum_sq = row.reduce((s: number, n: number) => s + n * n, 0);
    return n_coders < 2 ? 1 : (sum_sq - n_coders) / (n_coders * (n_coders - 1));
  });

  const P_observed = P_i.reduce((s, p) => s + p, 0) / n_units;

  const p_j = cats.map((_, j) => {
    let total = 0;
    for (const row of n_ij) total += row[j];
    return total / (n_units * n_coders);
  });

  const P_expected = p_j.reduce((s, p) => s + p * p, 0);
  const kappa = P_expected === 1 ? 1 : (P_observed - P_expected) / (1 - P_expected);

  return { kappa, P_observed, P_expected, n_units, n_coders };
}
