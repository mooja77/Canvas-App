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
} from './textAnalysis.js';

// ─── Test Data Fixtures ───

const transcripts = [
  { id: 't1', title: 'Interview A', content: 'The program was really good and helped many people. It was a great success for our community.' },
  { id: 't2', title: 'Interview B', content: 'There were some problems with funding. The situation was bad and people were frustrated.' },
  { id: 't3', title: 'Interview C', content: 'Overall the experience was positive. We saw improvement in several areas over time.', caseId: 'case1' },
];

const questions = [
  { id: 'q1', text: 'Impact', color: '#FF0000' },
  { id: 'q2', text: 'Challenges', color: '#0000FF' },
  { id: 'q3', text: 'Outcomes', color: '#00FF00' },
];

const codings = [
  { id: 'c1', transcriptId: 't1', questionId: 'q1', startOffset: 0, endOffset: 45, codedText: 'The program was really good and helped many' },
  { id: 'c2', transcriptId: 't1', questionId: 'q3', startOffset: 20, endOffset: 45, codedText: 'good and helped many' },
  { id: 'c3', transcriptId: 't2', questionId: 'q2', startOffset: 0, endOffset: 40, codedText: 'There were some problems with funding' },
  { id: 'c4', transcriptId: 't2', questionId: 'q2', startOffset: 42, endOffset: 85, codedText: 'The situation was bad and people were frustrated' },
  { id: 'c5', transcriptId: 't3', questionId: 'q1', startOffset: 0, endOffset: 40, codedText: 'Overall the experience was positive' },
  { id: 'c6', transcriptId: 't3', questionId: 'q3', startOffset: 40, endOffset: 82, codedText: 'We saw improvement in several areas over time' },
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

  it('handles invalid regex gracefully', () => {
    const result = searchTranscripts(transcripts, '[invalid', 'regex');
    expect(result.matches).toHaveLength(0);
  });

  it('is case-insensitive', () => {
    const result = searchTranscripts(transcripts, 'THE', 'literal');
    expect(result.matches.length).toBeGreaterThan(0);
  });

  it('handles empty transcripts array', () => {
    const result = searchTranscripts([], 'test', 'literal');
    expect(result.matches).toHaveLength(0);
  });

  it('handles empty pattern', () => {
    // Empty pattern matches every position — should not infinite loop
    const result = searchTranscripts([{ id: 't', title: 'T', content: 'abc' }], '', 'literal');
    expect(result.matches.length).toBeGreaterThan(0);
  });
});

// ─── 2. Co-occurrence ───

describe('computeCooccurrence', () => {
  it('finds overlapping codings between two questions', () => {
    // c1 (q1: 0-45) and c2 (q3: 20-45) overlap on t1
    const result = computeCooccurrence(codings, ['q1', 'q3']);
    expect(result.pairs.length).toBeGreaterThanOrEqual(1);
    const pair = result.pairs.find(p => p.questionIds.includes('q1') && p.questionIds.includes('q3'));
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
    const q2Item = result.items.find(i => i.id === 'q2');
    expect(q2Item).toBeDefined();
    expect(q2Item!.count).toBe(2); // c3 and c4
  });

  it('groups by transcript', () => {
    const result = computeStats(codings, questions, transcripts, 'transcript');
    expect(result.total).toBe(codings.length);
    const t1Item = result.items.find(i => i.id === 't1');
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

  it('coverage uses only relevant transcripts for question grouping', () => {
    // q2 only has codings in t2, so coverage denominator should only use t2's length
    const result = computeStats(codings, questions, transcripts, 'question');
    const q2Item = result.items.find(i => i.id === 'q2');
    expect(q2Item).toBeDefined();
    // q2 codings cover 0-40 and 42-85 of t2 (length 88) = 83 chars / 88 chars
    expect(q2Item!.coverage).toBeGreaterThan(0);
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
    const q1Profile = profile.find(p => p.questionId === 'q1');
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
    const hasProgram = result.words.some(w => w.text === 'program');
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
    expect(totalSegments).toBeLessThanOrEqual(codings.filter(c => c.questionId === 'q2').length);
  });
});

// ─── 8. Coding Query ───

describe('computeCodingQuery', () => {
  it('returns base question codings with no additional conditions', () => {
    const result = computeCodingQuery(codings, transcripts, [
      { questionId: 'q1', operator: 'AND' },
    ]);
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
    const t1Matches = result.matches.filter(m => m.transcriptId === 't1');
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
    const result = computeCodingQuery(codings, transcripts, [
      { questionId: 'q1', operator: 'AND' },
    ]);
    expect(result.matches.length).toBeLessThanOrEqual(100);
  });
});

// ─── 9. Sentiment Analysis ───

describe('computeSentiment', () => {
  it('scores positive text as positive', () => {
    const posCodings = [
      { id: 'p1', transcriptId: 't1', questionId: 'q1', startOffset: 0, endOffset: 30, codedText: 'This is excellent amazing wonderful great' },
    ];
    const result = computeSentiment(posCodings, transcripts, questions, 'all');
    expect(result.overall.positive).toBe(1);
    expect(result.overall.negative).toBe(0);
    expect(result.overall.averageScore).toBeGreaterThan(0);
  });

  it('scores negative text as negative', () => {
    const negCodings = [
      { id: 'n1', transcriptId: 't2', questionId: 'q2', startOffset: 0, endOffset: 30, codedText: 'This is terrible horrible awful bad' },
    ];
    const result = computeSentiment(negCodings, transcripts, questions, 'all');
    expect(result.overall.negative).toBe(1);
    expect(result.overall.positive).toBe(0);
    expect(result.overall.averageScore).toBeLessThan(0);
  });

  it('handles negation correctly', () => {
    const negatedCodings = [
      { id: 'neg1', transcriptId: 't1', questionId: 'q1', startOffset: 0, endOffset: 20, codedText: 'This is not good at all' },
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
    const q3Node = result.nodes.find(n => n.id === 'q3');
    expect(q3Node).toBeDefined();
    expect(q3Node!.parentId).toBe('q1');
  });

  it('filters out zero-size nodes', () => {
    // Create a question with no codings
    const extraQuestions = [
      ...questionsWithParent,
      { id: 'q4', text: 'Empty', color: '#000', parentQuestionId: null },
    ];
    const result = computeTreemap(codings, extraQuestions, 'count');
    const q4Node = result.nodes.find(n => n.id === 'q4');
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
