/**
 * AI spec 11 — text-anchored coding match.
 *
 * LLM-emitted character offsets are unreliable. Models routinely miscount
 * positions in long strings, especially with unicode / emoji / tabs. This
 * helper instead trusts the LLM's `codedText` (an exact substring) and
 * uses the `anchorBefore` field (~20-30 chars of preceding context) to
 * disambiguate when the same substring appears multiple times in the
 * transcript.
 *
 * If `codedText` doesn't exist in the transcript at all, that's a sign
 * the model hallucinated text — the caller should skip + log the row
 * rather than store a misaligned offset.
 */

export interface FindCodingResult {
  start: number;
  end: number;
}

const ANCHOR_MIN_LEN = 10;
// Max allowable gap between end of anchor and start of codedText, in chars.
// Lets the LLM emit a slightly-imperfect anchor (e.g. trims a trailing
// space) without missing the match — but a value too large would defeat
// disambiguation.
const ANCHOR_TO_CODING_MAX_GAP = 50;

export function findCoding(
  transcript: string,
  codedText: string,
  anchorBefore: string | null | undefined,
): FindCodingResult | null {
  if (!codedText) return null;

  // Try with anchor first when one was provided. This handles the case
  // where the same coded substring legitimately appears more than once
  // in the transcript and we want the LLM's specific occurrence.
  if (anchorBefore && anchorBefore.length >= ANCHOR_MIN_LEN) {
    const anchorIdx = transcript.indexOf(anchorBefore);
    if (anchorIdx >= 0) {
      const searchFrom = anchorIdx + anchorBefore.length;
      const codingIdx = transcript.indexOf(codedText, searchFrom);
      if (codingIdx >= 0 && codingIdx - searchFrom <= ANCHOR_TO_CODING_MAX_GAP) {
        return { start: codingIdx, end: codingIdx + codedText.length };
      }
    }
  }

  // Fallback: first occurrence of codedText. Loses disambiguation but
  // beats discarding a real coding due to a bad anchor.
  const idx = transcript.indexOf(codedText);
  if (idx >= 0) {
    return { start: idx, end: idx + codedText.length };
  }

  // Substring not in transcript → likely hallucinated.
  return null;
}
