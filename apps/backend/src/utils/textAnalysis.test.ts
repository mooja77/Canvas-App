import { describe, it, expect } from 'vitest';
import {
  searchTranscripts,
  computeCooccurrence,
  buildFrameworkMatrix,
  computeStats,
  computeComparison,
  computeWordFrequency,
  computeClusters,
  computeCodingQuery,
  computeSentiment,
  computeTreemap,
  computeDocumentPortrait,
  regexChunks,
} from './textAnalysis.js';
import { AppError } from '../middleware/errorHandler.js';

// ─── Test Data Fixtures ───

const transcripts = [
  {
    id: 't1',
    title: 'Interview A',
    content: 'The program was really good and helped many people. It was a great success for our community.',
  },
  {
    id: 't2',
    title: 'Interview B',
    content: 'There were some problems with funding. The situation was bad and people were frustrated.',
  },
  {
    id: 't3',
    title: 'Interview C',
    content: 'Overall the experience was positive. We saw improvement in several areas over time.',
    caseId: 'case1',
  },
];

const questions = [
  { id: 'q1', text: 'Impact', color: '#FF0000' },
  { id: 'q2', text: 'Challenges', color: '#0000FF' },
  { id: 'q3', text: 'Outcomes', color: '#00FF00' },
];

const codings = [
  {
    id: 'c1',
    transcriptId: 't1',
    questionId: 'q1',
    startOffset: 0,
    endOffset: 45,
    codedText: 'The program was really good and helped many',
  },
  { id: 'c2', transcriptId: 't1', questionId: 'q3', startOffset: 20, endOffset: 45, codedText: 'good and helped many' },
  {
    id: 'c3',
    transcriptId: 't2',
    questionId: 'q2',
    startOffset: 0,
    endOffset: 40,
    codedText: 'There were some problems with funding',
  },
  {
    id: 'c4',
    transcriptId: 't2',
    questionId: 'q2',
    startOffset: 42,
    endOffset: 85,
    codedText: 'The situation was bad and people were frustrated',
  },
  {
    id: 'c5',
    transcriptId: 't3',
    questionId: 'q1',
    startOffset: 0,
    endOffset: 40,
    codedText: 'Overall the experience was positive',
  },
  {
    id: 'c6',
    transcriptId: 't3',
    questionId: 'q3',
    startOffset: 40,
    endOffset: 82,
    codedText: 'We saw improvement in several areas over time',
  },
];

const cases = [
  { id: 'case1', name: 'Case Alpha', attributes: {} },
  { id: 'case2', name: 'Case Beta', attributes: {} },
];

// ─── 1. Search ───

describe('searchTranscripts', () => {
  it('finds literal matches with context', () => {
    const result = searchTranscripts(transcripts, 'good', 'literal');
    expect(result.matches).toHaveLength(1);
    expect(result.matches[0].transcriptId).toBe('t1');
    expect(result.matches[0].matchText).toBe('good');
    expect(result.matches[0].context).toContain('good');
  });

  it('finds regex matches', () => {
    const result = searchTranscripts(transcripts, 'pro\\w+', 'regex');
    expect(result.matches.length).toBeGreaterThanOrEqual(2); // program, problems
  });

  it('returns empty for no matches', () => {
    const result = searchTranscripts(transcripts, 'zzzznotfound', 'literal');
    expect(result.matches).toHaveLength(0);
  });

  it('filters by transcript IDs', () => {
    const result = searchTranscripts(transcripts, 'the', 'literal', ['t1']);
    for (const m of result.matches) {
      expect(m.transcriptId).toBe('t1');
    }
  });

  it('reports an invalid regex as a 400 carrying the SyntaxError text, not as zero matches (M8)', () => {
    // This test used to assert 0 matches: the compile error was swallowed by
    // a try/catch-continue, so the researcher saw "no results" and never
    // learned the pattern was broken.
    let caught: unknown;
    try {
      searchTranscripts(transcripts, '[invalid', 'regex');
    } catch (err) {
      caught = err;
    }
    expect(caught).toBeInstanceOf(AppError);
    expect((caught as AppError).statusCode).toBe(400);
    expect((caught as AppError).message).toMatch(/unterminated character class/i);
  });

  it('is case-insensitive', () => {
    const result = searchTranscripts(transcripts, 'THE', 'literal');
    expect(result.matches.length).toBeGreaterThan(0);
  });

  it('handles empty transcripts array', () => {
    const result = searchTranscripts([], 'test', 'literal');
    expect(result.matches).toHaveLength(0);
  });

  it('rejects an empty pattern rather than matching every position', () => {
    // This test previously asserted `matches.length > 0` — it was guarding
    // against an infinite loop, but in doing so it locked in the flood: one
    // match per character, each with matchText: ''. That result is persisted
    // on the node and embedded in every canvas fetch, so a single click on an
    // unconfigured Search node left a canvas permanently multi-megabyte.
    // Refusing the query satisfies the original intent (no hang) without
    // producing the junk.
    expect(() => searchTranscripts([{ id: 't', title: 'T', content: 'abc' }], '', 'literal')).toThrow(
      /search pattern/i,
    );
  });
});

describe('searchTranscripts - regex safety and error reporting (H5, M8)', () => {
  const one = (content: string) => [{ id: 't', title: 'T', content }];

  function catchError(fn: () => unknown): AppError | null {
    try {
      fn();
      return null;
    } catch (err) {
      return err as AppError;
    }
  }

  it('rejects an unsafe pattern with a 400 instead of silently returning nothing', () => {
    const err = catchError(() => searchTranscripts(one('aaaa'), '(a+)+$', 'regex'));
    expect(err).toBeInstanceOf(AppError);
    expect(err?.statusCode).toBe(400);
    expect(err?.message).toBe('Regex pattern is too complex or potentially unsafe');
  });

  it.each(['(a+?)+$', '(a*?)+$', '(a?)+$', '(a{1,3})+$', '(a+)+?$', '(a{2,})*$'])(
    'rejects the nested-quantifier form %s that the old check missed',
    (pattern) => {
      const err = catchError(() => searchTranscripts(one('aaaa'), pattern, 'regex'));
      expect(err?.statusCode).toBe(400);
    },
  );

  it.each(['a*a*b', '.*.*x', '\\w+\\w*x', 'a+?a*b'])(
    'rejects the same atom quantified twice in a row (%s), which is cubic unanchored',
    (pattern) => {
      // Measured: a*a*b on ONE 2,000-character chunk of a's = 5.9 s.
      const err = catchError(() => searchTranscripts(one('aaaa'), pattern, 'regex'));
      expect(err?.statusCode).toBe(400);
    },
  );

  it('stops a pattern the static check misses after ONE slow exec and reports it as a 400', () => {
    // \w+\s*\w+x passes every static rule (the atoms differ) but is cubic on a
    // run of word characters: 5.1 s per 2,000-character chunk, measured. On a
    // 900-character run one exec costs a few hundred ms - over the 100 ms
    // budget - so the search must stop there. Before this guard the same exec
    // was repeated for every chunk of every transcript, and the researcher
    // got silently truncated results after the wait.
    const run = 'a'.repeat(900);
    const transcripts = [
      { id: 't1', title: 'One', content: `${run}\n${run}\n${run}` },
      { id: 't2', title: 'Two', content: run },
    ];
    const started = performance.now();
    const err = catchError(() => searchTranscripts(transcripts, '\\w+\\s*\\w+x', 'regex'));
    const elapsed = performance.now() - started;
    expect(err?.statusCode).toBe(400);
    expect(err?.message).toMatch(/took too long/i);
    // Four chunks would be four slow execs; one abort is one.
    expect(elapsed).toBeLessThan(4000);
  });

  it("either rejects (a+?)+$ or finishes it in under 200 ms on 28 a's (H5)", () => {
    // Measured before the fix: 5.36 s for ONE exec, which the between-exec
    // budget never got a chance to interrupt.
    const content = 'a'.repeat(28) + '!';
    const started = performance.now();
    const err = catchError(() => searchTranscripts(one(content), '(a+?)+$', 'regex'));
    const elapsed = performance.now() - started;
    if (err) expect(err.statusCode).toBe(400);
    else expect(elapsed).toBeLessThan(200);
  });

  it('reports an invalid literal-mode pattern the same way (never zero results)', () => {
    // Literal mode escapes metacharacters, so this cannot normally fail to
    // compile; the contract is that nothing in this function swallows a
    // compile error.
    const result = searchTranscripts(one('a[b'), '[b', 'literal');
    expect(result.matches.map((m) => m.matchText)).toEqual(['[b']);
  });

  it('accepts an astral character class via the u flag (M8)', () => {
    const result = searchTranscripts(one('so happy 😁 today'), '[😀-😂]', 'regex');
    expect(result.matches).toHaveLength(1);
    expect(result.matches[0].matchText).toBe('😁');
    expect(result.matches[0].offset).toBe(9);
  });

  it('falls back to a non-unicode compile when the pattern is only valid without u', () => {
    // `\-` outside a character class is an identity escape: legal in legacy
    // mode, a SyntaxError under the u flag.
    const result = searchTranscripts(one('a-b'), 'a\\-b', 'regex');
    expect(result.matches.map((m) => m.matchText)).toEqual(['a-b']);
  });

  it('does not loop forever on a zero-length match at an astral character', () => {
    const result = searchTranscripts(one('😀😀'), 'x*', 'regex');
    expect(result.matches).toHaveLength(0);
  });

  it('finds a regex match deep inside a long transcript with the right offset and context', () => {
    const filler = 'lorem ipsum dolor sit amet\n'.repeat(400).slice(0, 4500);
    const content = filler + 'NEEDLE-42' + ' tail text';
    const result = searchTranscripts(one(content), 'needle-\\d+', 'regex');
    expect(result.matches).toHaveLength(1);
    expect(result.matches[0].offset).toBe(4500);
    expect(result.matches[0].matchText).toBe('NEEDLE-42');
    expect(result.matches[0].context).toContain('NEEDLE-42 tail text');
    expect(content.slice(result.matches[0].offset, result.matches[0].offset + 9)).toBe('NEEDLE-42');
  });

  it('never hands a single regex exec more than 2,000 characters', () => {
    const content = 'x'.repeat(3000) + '\n' + 'y'.repeat(2500) + '\n' + 'z'.repeat(10);
    const chunks = regexChunks(content);
    expect(chunks.length).toBeGreaterThan(1);
    for (const [start, end] of chunks) expect(end - start).toBeLessThanOrEqual(2000);
    // The chunks tile the string exactly.
    expect(chunks[0][0]).toBe(0);
    expect(chunks[chunks.length - 1][1]).toBe(content.length);
    for (let i = 1; i < chunks.length; i++) expect(chunks[i][0]).toBe(chunks[i - 1][1]);
  });

  it('prefers to break chunks at a line boundary', () => {
    const content = 'a'.repeat(1500) + '\n' + 'b'.repeat(1500);
    const chunks = regexChunks(content);
    expect(chunks[0]).toEqual([0, 1501]);
  });
});

// ─── 2. Co-occurrence ───

describe('computeCooccurrence', () => {
  it('finds overlapping codings between two questions', () => {
    // c1 (q1: 0-45) and c2 (q3: 20-45) overlap on t1
    const result = computeCooccurrence(codings, ['q1', 'q3']);
    expect(result.pairs.length).toBeGreaterThanOrEqual(1);
    const pair = result.pairs.find((p) => p.questionIds.includes('q1') && p.questionIds.includes('q3'));
    expect(pair).toBeDefined();
    expect(pair!.count).toBeGreaterThan(0);
  });

  it('returns empty for non-overlapping questions', () => {
    // q1 on t1 (0-45) and q2 on t2 — different transcripts, no overlap
    const result = computeCooccurrence(codings, ['q1', 'q2']);
    expect(result.pairs).toHaveLength(0);
  });

  it('returns empty for fewer than 2 questions', () => {
    const result = computeCooccurrence(codings, ['q1']);
    expect(result.pairs).toHaveLength(0);
  });

  it('respects minOverlap threshold', () => {
    // The overlap between c1 and c2 is 25 chars (20-45)
    const resultLow = computeCooccurrence(codings, ['q1', 'q3'], 1);
    const resultHigh = computeCooccurrence(codings, ['q1', 'q3'], 100);
    expect(resultLow.pairs.length).toBeGreaterThanOrEqual(resultHigh.pairs.length);
  });

  it('handles empty codings', () => {
    const result = computeCooccurrence([], ['q1', 'q2']);
    expect(result.pairs).toHaveLength(0);
  });
});

// ─── 3. Framework Matrix ───

describe('buildFrameworkMatrix', () => {
  const transcriptsWithCases = [
    { id: 't1', title: 'Interview A', content: 'content A', caseId: 'case1' },
    { id: 't2', title: 'Interview B', content: 'content B', caseId: 'case2' },
  ];

  it('builds matrix with cases and questions', () => {
    const result = buildFrameworkMatrix(transcriptsWithCases, questions, codings, cases);
    expect(result.rows).toHaveLength(2);
    expect(result.rows[0].cells).toHaveLength(3);
    expect(result.rows[0].caseName).toBe('Case Alpha');
  });

  it('filters by question IDs', () => {
    const result = buildFrameworkMatrix(transcriptsWithCases, questions, codings, cases, ['q1']);
    expect(result.rows[0].cells).toHaveLength(1);
    expect(result.rows[0].cells[0].questionId).toBe('q1');
  });

  it('filters by case IDs', () => {
    const result = buildFrameworkMatrix(transcriptsWithCases, questions, codings, cases, undefined, ['case1']);
    expect(result.rows).toHaveLength(1);
    expect(result.rows[0].caseId).toBe('case1');
  });

  it('handles empty cases', () => {
    const result = buildFrameworkMatrix(transcriptsWithCases, questions, codings, []);
    expect(result.rows).toHaveLength(0);
  });
});

// ─── 4. Statistics ───

describe('computeStats', () => {
  it('groups by question with correct counts', () => {
    const result = computeStats(codings, questions, transcripts, 'question');
    expect(result.total).toBe(codings.length);
    const q2Item = result.items.find((i) => i.id === 'q2');
    expect(q2Item).toBeDefined();
    expect(q2Item!.count).toBe(2); // c3 and c4
  });

  it('groups by transcript', () => {
    const result = computeStats(codings, questions, transcripts, 'transcript');
    expect(result.total).toBe(codings.length);
    const t1Item = result.items.find((i) => i.id === 't1');
    expect(t1Item).toBeDefined();
    expect(t1Item!.count).toBe(2); // c1 and c2
  });

  it('calculates coverage correctly by question', () => {
    const result = computeStats(codings, questions, transcripts, 'question');
    for (const item of result.items) {
      expect(item.coverage).toBeGreaterThanOrEqual(0);
      expect(item.coverage).toBeLessThanOrEqual(100);
    }
  });

  it('coverage for a code is a share of the whole corpus, not just the transcripts it appears in', () => {
    // Regression: coverage used to divide by only the transcripts a code
    // appeared in (83/88 = 94.3% for q2), while the Codebook table and the
    // exported CSV divided by every transcript in the canvas. Same code, same
    // moment, ~3x apart. One denominator now: the corpus.
    const result = computeStats(codings, questions, transcripts, 'question');
    const q2Item = result.items.find((i) => i.id === 'q2');
    expect(q2Item).toBeDefined();
    // q2 covers 0-40 and 42-85 of t2 = 83 chars; corpus = 93 + 88 + 83 = 264.
    expect(q2Item!.coverage).toBeCloseTo(31.4, 1);
    expect(result.coverageBasis).toBe('percent-of-all-transcript-characters');
    expect(result.coverageLabel).toMatch(/all transcript text in this canvas/i);
  });

  it('names the denominator it used when grouping by transcript', () => {
    const result = computeStats(codings, questions, transcripts, 'transcript');
    expect(result.coverageBasis).toBe('percent-of-this-transcript');
    const t2Item = result.items.find((i) => i.id === 't2');
    // 83 coded chars of t2's 88.
    expect(t2Item!.coverage).toBeCloseTo(94.3, 1);
  });

  it('counts a character once when two codings overlap the same passage', () => {
    const overlapping = [
      { id: 'o1', transcriptId: 't1', questionId: 'q1', startOffset: 0, endOffset: 50, codedText: 'a' },
      { id: 'o2', transcriptId: 't1', questionId: 'q1', startOffset: 20, endOffset: 60, codedText: 'b' },
    ];
    const result = computeStats(overlapping, questions, transcripts, 'question');
    const q1Item = result.items.find((i) => i.id === 'q1');
    // Union is 0-60 = 60 chars, not 50 + 40 = 90.
    expect(q1Item!.coverage).toBeCloseTo(round1((60 / 264) * 100), 1);
  });

  it('clamps an out-of-range coding so per-transcript coverage cannot exceed 100%', () => {
    const runaway = [
      { id: 'r1', transcriptId: 't1', questionId: 'q1', startOffset: 0, endOffset: 5000, codedText: 'x' },
    ];
    const result = computeStats(runaway, questions, transcripts, 'transcript');
    const t1Item = result.items.find((i) => i.id === 't1');
    expect(t1Item!.coverage).toBe(100);
  });
});

// Regression for the theme roll-up: codings hang off leaf codes, but the
// sidebar rolls them up into their parent theme. The Statistics node did not,
// so a theme with coded sub-codes was reported (and exported) as zero.
const round1 = (n: number) => Math.round(n * 10) / 10;

const nestedQuestions = [
  { id: 'theme1', text: 'THEME: Personal cost', color: '#DB2777', parentQuestionId: null },
  { id: 'leaf1', text: 'Financial strain', color: '#DB2777', parentQuestionId: 'theme1' },
  { id: 'leaf2', text: 'Isolation', color: '#DB2777', parentQuestionId: 'theme1' },
  { id: 'sub1', text: 'Debt', color: '#DB2777', parentQuestionId: 'leaf1' },
  { id: 'standalone', text: 'Service fragmentation', color: '#0000FF', parentQuestionId: null },
];

const nestedCodings = [
  { id: 'n1', transcriptId: 't1', questionId: 'leaf1', startOffset: 0, endOffset: 10, codedText: 'The progra' },
  { id: 'n2', transcriptId: 't1', questionId: 'leaf2', startOffset: 20, endOffset: 30, codedText: 'good and h' },
  { id: 'n3', transcriptId: 't2', questionId: 'sub1', startOffset: 0, endOffset: 10, codedText: 'There were' },
  { id: 'n4', transcriptId: 't2', questionId: 'standalone', startOffset: 40, endOffset: 50, codedText: 'The situat' },
];

describe('computeStats — parent theme roll-up', () => {
  it('rolls descendant codings up into a parent theme instead of reporting zero', () => {
    const result = computeStats(nestedCodings, nestedQuestions, transcripts, 'question');
    const theme = result.items.find((i) => i.id === 'theme1')!;
    // leaf1 + leaf2 + sub1 = 3 codings beneath the theme, 0 applied directly.
    expect(theme.count).toBe(3);
    expect(theme.directCount).toBe(0);
    expect(theme.coverage).toBeGreaterThan(0);
    // 10 + 10 + 10 = 30 chars of the 264-char corpus.
    expect(theme.coverage).toBeCloseTo(round1((30 / 264) * 100), 1);
  });

  it('rolls up through more than one level', () => {
    const result = computeStats(nestedCodings, nestedQuestions, transcripts, 'question');
    const leaf1 = result.items.find((i) => i.id === 'leaf1')!;
    // leaf1's own coding plus its child sub1's.
    expect(leaf1.count).toBe(2);
    expect(leaf1.directCount).toBe(1);
  });

  it('leaves a code with no children reporting its own codings only', () => {
    const result = computeStats(nestedCodings, nestedQuestions, transcripts, 'question');
    const standalone = result.items.find((i) => i.id === 'standalone')!;
    expect(standalone.count).toBe(1);
    expect(standalone.directCount).toBe(1);
  });

  it('selecting a theme scopes the analysis to its subtree', () => {
    const result = computeStats(nestedCodings, nestedQuestions, transcripts, 'question', ['theme1']);
    expect(result.items).toHaveLength(1);
    expect(result.items[0].id).toBe('theme1');
    // The three sub-code codings are in scope; the standalone code's is not.
    expect(result.total).toBe(3);
    expect(result.items[0].count).toBe(3);
    expect(result.items[0].percentage).toBe(100);
  });

  it('filters by question IDs', () => {
    const result = computeStats(codings, questions, transcripts, 'question', ['q1']);
    expect(result.items).toHaveLength(1);
    expect(result.items[0].id).toBe('q1');
  });

  it('handles empty codings', () => {
    const result = computeStats([], questions, transcripts, 'question');
    expect(result.total).toBe(0);
    for (const item of result.items) {
      expect(item.count).toBe(0);
    }
  });
});

describe('computeStats — hierarchy edge cases', () => {
  it('does not hang or double-count when parentQuestionId forms a cycle', () => {
    const cyclic = [
      { id: 'a', text: 'A', color: '#000000', parentQuestionId: 'b' },
      { id: 'b', text: 'B', color: '#000000', parentQuestionId: 'a' },
    ];
    const cyclicCodings = [
      { id: 'z1', transcriptId: 't1', questionId: 'a', startOffset: 0, endOffset: 5, codedText: 'The p' },
      { id: 'z2', transcriptId: 't1', questionId: 'b', startOffset: 6, endOffset: 11, codedText: 'rogra' },
    ];
    const result = computeStats(cyclicCodings, cyclic, transcripts, 'question');
    expect(result.items.find((i) => i.id === 'a')!.count).toBe(2);
    expect(result.items.find((i) => i.id === 'b')!.count).toBe(2);
  });

  it('treats a parentQuestionId pointing at an unknown code as a root', () => {
    const orphaned = [{ id: 'o', text: 'Orphan', color: '#000000', parentQuestionId: 'does-not-exist' }];
    const orphanCodings = [
      { id: 'y1', transcriptId: 't1', questionId: 'o', startOffset: 0, endOffset: 5, codedText: 'The p' },
    ];
    const result = computeStats(orphanCodings, orphaned, transcripts, 'question');
    expect(result.items).toHaveLength(1);
    expect(result.items[0].count).toBe(1);
  });
});

// ─── 5. Comparison ───

describe('computeComparison', () => {
  it('returns profiles for selected transcripts', () => {
    const result = computeComparison(codings, transcripts, questions, ['t1', 't2']);
    expect(result.transcripts).toHaveLength(2);
    expect(result.transcripts[0].profile).toHaveLength(3);
  });

  it('computes coverage per transcript per question', () => {
    const result = computeComparison(codings, transcripts, questions, ['t1']);
    const profile = result.transcripts[0].profile;
    const q1Profile = profile.find((p) => p.questionId === 'q1');
    expect(q1Profile).toBeDefined();
    expect(q1Profile!.count).toBe(1);
    expect(q1Profile!.coverage).toBeGreaterThan(0);
  });

  it('handles empty transcript selection', () => {
    const result = computeComparison(codings, transcripts, questions, []);
    expect(result.transcripts).toHaveLength(3); // all transcripts
  });
});

// ─── 6. Word Frequency ───

describe('computeWordFrequency', () => {
  it('returns word frequencies sorted by count', () => {
    const result = computeWordFrequency(codings);
    expect(result.words.length).toBeGreaterThan(0);
    // Should be sorted descending
    for (let i = 1; i < result.words.length; i++) {
      expect(result.words[i].count).toBeLessThanOrEqual(result.words[i - 1].count);
    }
  });

  it('filters stop words', () => {
    const result = computeWordFrequency(codings);
    const stopWords = ['the', 'was', 'and', 'were'];
    for (const w of result.words) {
      expect(stopWords).not.toContain(w.text);
    }
  });

  it('filters short words', () => {
    const result = computeWordFrequency(codings);
    for (const w of result.words) {
      expect(w.text.length).toBeGreaterThanOrEqual(3);
    }
  });

  it('filters by question ID', () => {
    const allResult = computeWordFrequency(codings);
    const filteredResult = computeWordFrequency(codings, 'q2');
    expect(filteredResult.words.length).toBeLessThanOrEqual(allResult.words.length);
  });

  it('respects custom stop words', () => {
    const result = computeWordFrequency(codings, undefined, undefined, ['program']);
    const hasProgram = result.words.some((w) => w.text === 'program');
    expect(hasProgram).toBe(false);
  });

  it('respects maxWords limit', () => {
    const result = computeWordFrequency(codings, undefined, 3);
    expect(result.words.length).toBeLessThanOrEqual(3);
  });

  it('handles empty codings', () => {
    const result = computeWordFrequency([]);
    expect(result.words).toHaveLength(0);
  });
});

// ─── 7. Clustering ───

describe('computeClusters', () => {
  it('produces requested number of clusters', () => {
    const result = computeClusters(codings, 2);
    expect(result.clusters.length).toBeLessThanOrEqual(2);
    expect(result.clusters.length).toBeGreaterThan(0);
  });

  it('assigns all codings to clusters', () => {
    const result = computeClusters(codings, 2);
    const totalSegments = result.clusters.reduce((sum, c) => sum + c.segments.length, 0);
    // May be capped by MAX_CLUSTER_SEGMENTS per cluster, but total >= codings length
    expect(totalSegments).toBeGreaterThan(0);
  });

  it('extracts keywords per cluster', () => {
    const result = computeClusters(codings, 2);
    for (const cluster of result.clusters) {
      expect(cluster.keywords.length).toBeGreaterThan(0);
    }
  });

  it('handles k larger than data', () => {
    const result = computeClusters(codings, 100);
    // Should cap at actual data size
    expect(result.clusters.length).toBeLessThanOrEqual(codings.length);
  });

  it('handles empty codings', () => {
    const result = computeClusters([], 3);
    expect(result.clusters).toHaveLength(0);
  });

  it('filters by question IDs', () => {
    const result = computeClusters(codings, 2, ['q2']);
    const totalSegments = result.clusters.reduce((sum, c) => sum + c.segments.length, 0);
    expect(totalSegments).toBeLessThanOrEqual(codings.filter((c) => c.questionId === 'q2').length);
  });
});

// ─── 8. Coding Query ───

describe('computeCodingQuery', () => {
  it('returns base question codings with no additional conditions', () => {
    const result = computeCodingQuery(codings, transcripts, [{ questionId: 'q1', operator: 'AND' }]);
    expect(result.matches.length).toBe(2); // c1 and c5
  });

  it('AND requires overlap', () => {
    // q1 and q3 overlap on t1
    const result = computeCodingQuery(codings, transcripts, [
      { questionId: 'q1', operator: 'AND' },
      { questionId: 'q3', operator: 'AND' },
    ]);
    // Only c1 overlaps with c2 (q3)
    expect(result.matches.length).toBeGreaterThanOrEqual(1);
    expect(result.matches[0].transcriptId).toBe('t1');
  });

  it('NOT excludes overlapping codings', () => {
    const result = computeCodingQuery(codings, transcripts, [
      { questionId: 'q1', operator: 'AND' },
      { questionId: 'q3', operator: 'NOT' },
    ]);
    // c1 overlaps with q3, should be excluded. c5 does not overlap with q3.
    const t1Matches = result.matches.filter((m) => m.transcriptId === 't1');
    expect(t1Matches).toHaveLength(0);
  });

  it('OR expands the result set', () => {
    const result = computeCodingQuery(codings, transcripts, [
      { questionId: 'q1', operator: 'AND' },
      { questionId: 'q2', operator: 'OR' },
    ]);
    // Should include q1 codings + q2 codings
    expect(result.matches.length).toBeGreaterThan(2);
  });

  it('returns empty for no conditions', () => {
    const result = computeCodingQuery(codings, transcripts, []);
    expect(result.matches).toHaveLength(0);
  });

  it('caps results at max', () => {
    const result = computeCodingQuery(codings, transcripts, [{ questionId: 'q1', operator: 'AND' }]);
    expect(result.matches.length).toBeLessThanOrEqual(100);
  });
});

// ─── 9. Sentiment Analysis ───

describe('computeSentiment', () => {
  it('scores positive text as positive', () => {
    const posCodings = [
      {
        id: 'p1',
        transcriptId: 't1',
        questionId: 'q1',
        startOffset: 0,
        endOffset: 30,
        codedText: 'This is excellent amazing wonderful great',
      },
    ];
    const result = computeSentiment(posCodings, transcripts, questions, 'all');
    expect(result.overall.positive).toBe(1);
    expect(result.overall.negative).toBe(0);
    expect(result.overall.averageScore).toBeGreaterThan(0);
  });

  it('scores negative text as negative', () => {
    const negCodings = [
      {
        id: 'n1',
        transcriptId: 't2',
        questionId: 'q2',
        startOffset: 0,
        endOffset: 30,
        codedText: 'This is terrible horrible awful bad',
      },
    ];
    const result = computeSentiment(negCodings, transcripts, questions, 'all');
    expect(result.overall.negative).toBe(1);
    expect(result.overall.positive).toBe(0);
    expect(result.overall.averageScore).toBeLessThan(0);
  });

  it('handles negation correctly', () => {
    const negatedCodings = [
      {
        id: 'neg1',
        transcriptId: 't1',
        questionId: 'q1',
        startOffset: 0,
        endOffset: 20,
        codedText: 'This is not good at all',
      },
    ];
    const result = computeSentiment(negatedCodings, transcripts, questions, 'all');
    // "not good" should flip to negative
    expect(result.overall.averageScore).toBeLessThan(0);
  });

  it('handles double negation', () => {
    const doubleNegCodings = [
      { id: 'dn1', transcriptId: 't1', questionId: 'q1', startOffset: 0, endOffset: 20, codedText: 'not bad actually' },
    ];
    const result = computeSentiment(doubleNegCodings, transcripts, questions, 'all');
    // "not bad" should flip bad(-3) to positive
    expect(result.overall.averageScore).toBeGreaterThan(0);
  });

  it('filters by scope=question', () => {
    const result = computeSentiment(codings, transcripts, questions, 'question', 'q2');
    // Only q2 codings (negative text)
    expect(result.overall.averageScore).toBeLessThanOrEqual(0);
  });

  it('handles empty codings', () => {
    const result = computeSentiment([], transcripts, questions, 'all');
    expect(result.overall.positive).toBe(0);
    expect(result.overall.negative).toBe(0);
    expect(result.overall.neutral).toBe(0);
    expect(result.overall.averageScore).toBe(0);
  });

  it('returns items sorted by score descending', () => {
    const result = computeSentiment(codings, transcripts, questions, 'all');
    for (let i = 1; i < result.items.length; i++) {
      expect(result.items[i].score).toBeLessThanOrEqual(result.items[i - 1].score);
    }
  });
});

// ─── 10. Treemap ───

describe('computeTreemap', () => {
  const questionsWithParent = [
    { id: 'q1', text: 'Impact', color: '#FF0000', parentQuestionId: null },
    { id: 'q2', text: 'Challenges', color: '#0000FF', parentQuestionId: null },
    { id: 'q3', text: 'Outcomes', color: '#00FF00', parentQuestionId: 'q1' },
  ];

  it('builds treemap with count metric', () => {
    const result = computeTreemap(codings, questionsWithParent, 'count');
    expect(result.nodes.length).toBeGreaterThan(0);
    expect(result.total).toBeGreaterThan(0);
    for (const node of result.nodes) {
      expect(node.size).toBeGreaterThan(0);
    }
  });

  it('builds treemap with characters metric', () => {
    const result = computeTreemap(codings, questionsWithParent, 'characters');
    expect(result.total).toBeGreaterThan(0);
  });

  it('preserves parent-child relationships', () => {
    const result = computeTreemap(codings, questionsWithParent, 'count');
    const q3Node = result.nodes.find((n) => n.id === 'q3');
    expect(q3Node).toBeDefined();
    expect(q3Node!.parentId).toBe('q1');
  });

  it('filters out zero-size nodes', () => {
    // Create a question with no codings
    const extraQuestions = [...questionsWithParent, { id: 'q4', text: 'Empty', color: '#000', parentQuestionId: null }];
    const result = computeTreemap(codings, extraQuestions, 'count');
    const q4Node = result.nodes.find((n) => n.id === 'q4');
    expect(q4Node).toBeUndefined();
  });

  it('filters by question IDs', () => {
    const result = computeTreemap(codings, questionsWithParent, 'count', ['q1']);
    expect(result.nodes).toHaveLength(1);
    expect(result.nodes[0].id).toBe('q1');
  });

  it('handles empty codings', () => {
    const result = computeTreemap([], questionsWithParent, 'count');
    expect(result.nodes).toHaveLength(0);
    expect(result.total).toBe(0);
  });
});

describe('computeDocumentPortrait', () => {
  it('positions codings proportionally along each transcript and colors by code', () => {
    const result = computeDocumentPortrait(transcripts, codings, questions);
    // t1 (len 91) has c1 (0-45) and c2 (20-45); t2 and t3 also have codings.
    expect(result.totalTranscripts).toBe(3);
    const t1 = result.strips.find((s) => s.transcriptId === 't1')!;
    expect(t1.transcriptTitle).toBe('Interview A');
    expect(t1.segments).toHaveLength(2);
    // sorted by startPercent; c1 starts at 0%
    expect(t1.segments[0].startPercent).toBeCloseTo(0, 5);
    expect(t1.segments[0].endPercent).toBeGreaterThan(0);
    expect(t1.segments[0].endPercent).toBeLessThanOrEqual(100);
    expect(t1.segments[0].color).toBe('#FF0000'); // q1
  });

  it('filters to a single transcript when transcriptId is configured', () => {
    const result = computeDocumentPortrait(transcripts, codings, questions, { transcriptId: 't2' });
    expect(result.strips).toHaveLength(1);
    expect(result.strips[0].transcriptId).toBe('t2');
  });

  it('filters segments by questionIds when provided', () => {
    const result = computeDocumentPortrait(transcripts, codings, questions, { questionIds: ['q1'] });
    const allSegments = result.strips.flatMap((s) => s.segments);
    expect(allSegments.length).toBeGreaterThan(0);
    expect(allSegments.every((seg) => seg.questionId === 'q1')).toBe(true);
  });

  it('clamps offsets beyond the transcript length to 100%', () => {
    const overrun = [{ transcriptId: 't1', questionId: 'q1', startOffset: 0, endOffset: 99999 }];
    const result = computeDocumentPortrait(transcripts, overrun, questions, { transcriptId: 't1' });
    expect(result.strips[0].segments[0].endPercent).toBeCloseTo(100, 5);
  });

  it('skips transcripts with no codings or empty content', () => {
    const empty = [{ id: 'tx', title: 'Empty', content: '' }];
    expect(
      computeDocumentPortrait(empty, codings, questions).strips.find((s) => s.transcriptId === 'tx'),
    ).toBeUndefined();
    expect(computeDocumentPortrait(transcripts, [], questions).strips).toHaveLength(0);
  });

  it('falls back to a default color for unknown codes', () => {
    const orphan = [{ transcriptId: 't1', questionId: 'zzz', startOffset: 0, endOffset: 10 }];
    const result = computeDocumentPortrait(transcripts, orphan, questions, { transcriptId: 't1' });
    expect(result.strips[0].segments[0].color).toBe('#3B82F6');
  });
});

/**
 * An empty or zero-width search pattern used to return one "match" per
 * character - 21,319 matches and a 4.8 MB result on a modest canvas, from one
 * click on an unconfigured node. Because the result is persisted and embedded
 * in every GET /canvas/:id, that canvas then shipped 4.8 MB on every load
 * until someone deleted the node.
 */
describe('searchTranscripts rejects patterns that match everything', () => {
  it('refuses an empty pattern instead of matching every character position', () => {
    expect(() => searchTranscripts(transcripts, '', 'keyword')).toThrow(/search pattern/i);
  });

  it('refuses a whitespace-only pattern', () => {
    expect(() => searchTranscripts(transcripts, '   ', 'keyword')).toThrow(/search pattern/i);
  });

  it('does not record zero-length regex matches', () => {
    // `x*` matches the empty string at every position. Previously that meant
    // one result per character, each with matchText: ''.
    const result = searchTranscripts(transcripts, 'zzz*', 'regex');
    expect(result.matches.every((m) => m.matchText.length > 0)).toBe(true);
    expect(result.matches.length).toBeLessThan(10);
  });

  it('still finds ordinary matches', () => {
    const result = searchTranscripts(transcripts, 'good', 'literal');
    expect(result.matches).toHaveLength(1);
  });
});
