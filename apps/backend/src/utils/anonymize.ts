/**
 * Transcript anonymisation.
 *
 * Replaces every whole-word occurrence of each `find` with its `replace` in a
 * single left-to-right pass and returns an offset map, so codings keep pointing
 * at the same words after the text changes length.
 *
 * Previously the route ran `content.replace(/\bfind\b/gi, replace)` per pair:
 *  - `\b` is ASCII-only, so names such as "Úna", "José" or "Áine" were never
 *    replaced although the transcript was then flagged as anonymised;
 *  - `replace` was interpreted as a pattern (`$&` re-inserted the name);
 *  - codings' start/end offsets were not moved, so every coding after the
 *    first length-changing replacement highlighted the wrong words.
 */

export interface Replacement {
  find: string;
  replace: string;
}

export interface AnonymizeResult {
  content: string;
  replacedCount: number;
  /** Map an offset in the old content to the new content. */
  mapStart: (offset: number) => number;
  mapEnd: (offset: number) => number;
}

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// "Word" characters for boundary purposes: any letter, mark or number, plus _.
const WORD = '[\\p{L}\\p{M}\\p{N}_]';

export function anonymizeText(content: string, replacements: Replacement[]): AnonymizeResult {
  const pairs = replacements.filter((r) => r.find.trim().length > 0);
  if (pairs.length === 0) {
    return { content, replacedCount: 0, mapStart: (o) => o, mapEnd: (o) => o };
  }
  // Longest first so "Mary Anne" wins over "Mary" at the same position.
  const ordered = [...pairs].sort((a, b) => b.find.length - a.find.length);
  // A boundary is only required on a side where the search term itself starts
  // or ends with a word character ("Dr." must still match before a space).
  const alternatives = ordered.map((r) => {
    const f = r.find;
    const pre = new RegExp(`^${WORD}`, 'u').test(f) ? `(?<!${WORD})` : '';
    const post = new RegExp(`${WORD}$`, 'u').test(f) ? `(?!${WORD})` : '';
    return `(${pre}${escapeRegex(f)}${post})`;
  });
  const regex = new RegExp(alternatives.join('|'), 'giu');

  // Segments of the edit: [oldStart, oldEnd, newStart, newEnd]
  const edits: Array<[number, number, number, number]> = [];
  let out = '';
  let last = 0;
  let replacedCount = 0;
  for (const m of content.matchAll(regex)) {
    const start = m.index ?? 0;
    const matched = m[0];
    // Exactly one capture group (one per search term) participates.
    const group = m.findIndex((g, i) => i > 0 && g !== undefined);
    const replacement = ordered[group - 1].replace;
    out += content.slice(last, start);
    const newStart = out.length;
    out += replacement;
    edits.push([start, start + matched.length, newStart, out.length]);
    last = start + matched.length;
    replacedCount++;
  }
  out += content.slice(last);

  function map(offset: number, side: 'start' | 'end'): number {
    let delta = 0;
    for (const [oS, oE, nS, nE] of edits) {
      if (offset <= oS) break;
      if (offset < oE) {
        // Inside a replaced span: snap outward so the coding still covers it.
        return side === 'start' ? nS : nE;
      }
      delta = nE - oE;
    }
    return offset + delta;
  }

  return {
    content: out,
    replacedCount,
    mapStart: (o) => map(o, 'start'),
    mapEnd: (o) => map(o, 'end'),
  };
}
