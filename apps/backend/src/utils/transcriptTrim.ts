/**
 * Trim a transcript string to at most `maxWords` whitespace-separated words
 * while preserving original spacing and line breaks up to the cut point.
 */
export function trimTranscriptToWordLimit(
  text: string,
  maxWords: number,
): { text: string; trimmed: boolean; wordCount: number } {
  const matches = Array.from(text.matchAll(/\S+/g));
  const wordCount = matches.length;
  if (!Number.isFinite(maxWords) || maxWords <= 0 || wordCount <= maxWords) {
    return { text, trimmed: false, wordCount };
  }
  const lastKept = matches[maxWords - 1];
  const cutIndex = (lastKept.index ?? 0) + lastKept[0].length;
  return {
    text: text.slice(0, cutIndex).trimEnd(),
    trimmed: true,
    wordCount,
  };
}
