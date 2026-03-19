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
    const goldSpans = goldCodings.filter(c => c.questionId === qId);
    const attemptSpans = attemptCodings.filter(c => c.questionId === qId);

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
