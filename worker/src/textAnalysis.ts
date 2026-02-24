/**
 * Text analysis utilities for Coding Canvas computed nodes.
 * All functions are pure — they take data arrays and return result objects.
 */

// Configuration constants
const SEARCH_CONTEXT_CHARS = 50;
const MAX_SEARCH_MATCHES = 100;
const MAX_WORD_FREQUENCY_RESULTS = 100;
const MIN_WORD_LENGTH = 3;
const MAX_MATRIX_EXCERPTS = 5;
const MAX_CLUSTER_SEGMENTS = 20;
const KMEANS_MAX_ITERATIONS = 50;
const KMEANS_RESTARTS = 3;
const SENTIMENT_POSITIVE_THRESHOLD = 0.05;
const SENTIMENT_NEGATIVE_THRESHOLD = -0.05;

interface TranscriptData {
  id: string;
  title: string;
  content: string;
  caseId?: string | null;
}

interface CodingData {
  id: string;
  transcriptId: string;
  questionId: string;
  startOffset: number;
  endOffset: number;
  codedText: string;
}

interface QuestionData {
  id: string;
  text: string;
  color: string;
}

interface CaseData {
  id: string;
  name: string;
  attributes: Record<string, string>;
}

// ─── Stop words for English text analysis ───
const STOP_WORDS = new Set([
  'a', 'an', 'the', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for',
  'of', 'with', 'by', 'from', 'is', 'are', 'was', 'were', 'be', 'been',
  'being', 'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would',
  'could', 'should', 'may', 'might', 'shall', 'can', 'need', 'dare',
  'it', 'its', 'this', 'that', 'these', 'those', 'i', 'me', 'my', 'we',
  'our', 'you', 'your', 'he', 'him', 'his', 'she', 'her', 'they', 'them',
  'their', 'what', 'which', 'who', 'whom', 'when', 'where', 'why', 'how',
  'not', 'no', 'nor', 'if', 'then', 'else', 'so', 'as', 'than', 'too',
  'very', 'just', 'about', 'above', 'after', 'again', 'all', 'also',
  'am', 'any', 'because', 'before', 'below', 'between', 'both', 'each',
  'few', 'get', 'got', 'here', 'into', 'more', 'most', 'much', 'must',
  'now', 'only', 'other', 'out', 'own', 'said', 'same', 'some', 'still',
  'such', 'take', 'there', 'through', 'under', 'up', 'us', 'well',
  'over', 'down', 'while', 'during', 'until', 'against', 'further',
  'once', 'upon', 'already', 'always', 'never', 'often', 'however',
  'although', 'since', 'within', 'without', 'like', 'even', 'also',
  'back', 'make', 'made', 'way', 'think', 'know', 'see', 'look',
  'come', 'go', 'going', 'went', 'really', 'thing', 'things',
]);

// ─── 1. Text Search ───

export function searchTranscripts(
  transcripts: TranscriptData[],
  pattern: string,
  mode: string,
  transcriptIds?: string[],
) {
  const contextWindow = SEARCH_CONTEXT_CHARS;
  const matches: {
    transcriptId: string;
    transcriptTitle: string;
    offset: number;
    matchText: string;
    context: string;
  }[] = [];

  const filtered = transcriptIds?.length
    ? transcripts.filter(t => transcriptIds.includes(t.id))
    : transcripts;

  for (const t of filtered) {
    let regex: RegExp;
    try {
      if (mode === 'regex') {
        regex = new RegExp(pattern, 'gi');
      } else {
        regex = new RegExp(pattern.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi');
      }
    } catch {
      continue;
    }

    let match: RegExpExecArray | null;
    while ((match = regex.exec(t.content)) !== null) {
      const start = Math.max(0, match.index - contextWindow);
      const end = Math.min(t.content.length, match.index + match[0].length + contextWindow);
      matches.push({
        transcriptId: t.id,
        transcriptTitle: t.title,
        offset: match.index,
        matchText: match[0],
        context: (start > 0 ? '...' : '') + t.content.slice(start, end) + (end < t.content.length ? '...' : ''),
      });
      // Prevent infinite loop on zero-length matches
      if (match[0].length === 0) regex.lastIndex++;
    }
  }

  return { matches };
}

// ─── 2. Co-occurrence ───

export function computeCooccurrence(
  codings: CodingData[],
  questionIds: string[],
  minOverlap?: number,
) {
  if (questionIds.length < 2) return { pairs: [] };

  const overlap = minOverlap ?? 1;

  // Group codings by transcript
  const byTranscript = new Map<string, CodingData[]>();
  for (const c of codings) {
    if (!questionIds.includes(c.questionId)) continue;
    const arr = byTranscript.get(c.transcriptId) || [];
    arr.push(c);
    byTranscript.set(c.transcriptId, arr);
  }

  // For each pair of question IDs, find overlapping ranges
  const pairMap = new Map<string, { questionIds: string[]; segments: any[]; }>();

  for (let i = 0; i < questionIds.length; i++) {
    for (let j = i + 1; j < questionIds.length; j++) {
      const qA = questionIds[i];
      const qB = questionIds[j];
      const key = `${qA}|${qB}`;
      const segments: any[] = [];

      for (const [tid, tCodings] of byTranscript) {
        const aCodes = tCodings.filter(c => c.questionId === qA);
        const bCodes = tCodings.filter(c => c.questionId === qB);

        for (const a of aCodes) {
          for (const b of bCodes) {
            const overlapStart = Math.max(a.startOffset, b.startOffset);
            const overlapEnd = Math.min(a.endOffset, b.endOffset);
            if (overlapEnd - overlapStart >= overlap) {
              segments.push({
                transcriptId: tid,
                text: a.codedText.slice(
                  Math.max(0, overlapStart - a.startOffset),
                  overlapEnd - a.startOffset,
                ),
                startOffset: overlapStart,
                endOffset: overlapEnd,
              });
            }
          }
        }
      }

      if (segments.length > 0) {
        pairMap.set(key, { questionIds: [qA, qB], segments });
      }
    }
  }

  return {
    pairs: Array.from(pairMap.values()).map(p => ({
      ...p,
      count: p.segments.length,
    })),
  };
}

// ─── 3. Framework Matrix ───

export function buildFrameworkMatrix(
  transcripts: TranscriptData[],
  questions: QuestionData[],
  codings: CodingData[],
  cases: CaseData[],
  questionIds?: string[],
  caseIds?: string[],
) {
  const filteredQuestions = questionIds?.length
    ? questions.filter(q => questionIds.includes(q.id))
    : questions;
  const filteredCases = caseIds?.length
    ? cases.filter(c => caseIds.includes(c.id))
    : cases;

  // Map transcript -> case
  const transcriptCaseMap = new Map<string, string>();
  for (const t of transcripts) {
    if (t.caseId) transcriptCaseMap.set(t.id, t.caseId);
  }

  const rows = filteredCases.map(cs => {
    // Get transcripts belonging to this case
    const caseTranscriptIds = transcripts
      .filter(t => t.caseId === cs.id)
      .map(t => t.id);

    const cells = filteredQuestions.map(q => {
      const cellCodings = codings.filter(
        c => c.questionId === q.id && caseTranscriptIds.includes(c.transcriptId),
      );
      return {
        questionId: q.id,
        excerpts: cellCodings.map(c => c.codedText).slice(0, MAX_MATRIX_EXCERPTS),
        count: cellCodings.length,
      };
    });

    return { caseId: cs.id, caseName: cs.name, cells };
  });

  return { rows };
}

// ─── 4. Statistics ───

export function computeStats(
  codings: CodingData[],
  questions: QuestionData[],
  transcripts: TranscriptData[],
  groupBy: string,
  questionIds?: string[],
) {
  const filteredCodings = questionIds?.length
    ? codings.filter(c => questionIds.includes(c.questionId))
    : codings;

  const total = filteredCodings.length;

  if (groupBy === 'question') {
    const filteredQuestions = questionIds?.length
      ? questions.filter(q => questionIds.includes(q.id))
      : questions;

    const items = filteredQuestions.map(q => {
      const qCodings = filteredCodings.filter(c => c.questionId === q.id);
      const totalChars = qCodings.reduce((sum, c) => sum + (c.endOffset - c.startOffset), 0);
      const relevantTranscriptIds = new Set(qCodings.map(c => c.transcriptId));
      const totalTranscriptChars = transcripts
        .filter(t => relevantTranscriptIds.has(t.id))
        .reduce((sum, t) => sum + t.content.length, 0);
      return {
        id: q.id,
        label: q.text,
        count: qCodings.length,
        percentage: total > 0 ? Math.round((qCodings.length / total) * 100 * 10) / 10 : 0,
        coverage: totalTranscriptChars > 0 ? Math.round((totalChars / totalTranscriptChars) * 100 * 10) / 10 : 0,
      };
    });

    return { items, total };
  }

  // Group by transcript
  const items = transcripts.map(t => {
    const tCodings = filteredCodings.filter(c => c.transcriptId === t.id);
    const totalChars = tCodings.reduce((sum, c) => sum + (c.endOffset - c.startOffset), 0);
    return {
      id: t.id,
      label: t.title,
      count: tCodings.length,
      percentage: total > 0 ? Math.round((tCodings.length / total) * 100 * 10) / 10 : 0,
      coverage: t.content.length > 0 ? Math.round((totalChars / t.content.length) * 100 * 10) / 10 : 0,
    };
  });

  return { items, total };
}

// ─── 5. Comparison ───

export function computeComparison(
  codings: CodingData[],
  transcripts: TranscriptData[],
  questions: QuestionData[],
  transcriptIds: string[],
  questionIds?: string[],
) {
  const filteredTranscripts = transcriptIds.length
    ? transcripts.filter(t => transcriptIds.includes(t.id))
    : transcripts;
  const filteredQuestions = questionIds?.length
    ? questions.filter(q => questionIds.includes(q.id))
    : questions;

  const result = filteredTranscripts.map(t => {
    const profile = filteredQuestions.map(q => {
      const qCodings = codings.filter(c => c.transcriptId === t.id && c.questionId === q.id);
      const totalChars = qCodings.reduce((sum, c) => sum + (c.endOffset - c.startOffset), 0);
      return {
        questionId: q.id,
        count: qCodings.length,
        coverage: t.content.length > 0 ? Math.round((totalChars / t.content.length) * 100 * 10) / 10 : 0,
      };
    });
    return { id: t.id, title: t.title, profile };
  });

  return { transcripts: result };
}

// ─── 6. Word Frequency ───

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s'-]/g, ' ')
    .split(/\s+/)
    .filter(w => w.length >= MIN_WORD_LENGTH && !STOP_WORDS.has(w));
}

export function computeWordFrequency(
  codings: CodingData[],
  questionId?: string,
  maxWords?: number,
  customStopWords?: string[],
) {
  const filtered = questionId
    ? codings.filter(c => c.questionId === questionId)
    : codings;

  const extraStops = new Set(customStopWords?.map(w => w.toLowerCase()) || []);
  const freq = new Map<string, number>();

  for (const c of filtered) {
    const tokens = tokenize(c.codedText);
    for (const token of tokens) {
      if (extraStops.has(token)) continue;
      freq.set(token, (freq.get(token) || 0) + 1);
    }
  }

  const words = Array.from(freq.entries())
    .map(([text, count]) => ({ text, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, maxWords || MAX_WORD_FREQUENCY_RESULTS);

  return { words };
}

// ─── 7. Clustering (TF-IDF + K-Means) ───

function buildTfIdf(documents: string[][]): { vectors: number[][]; vocabulary: string[] } {
  // Build vocabulary
  const vocab = new Map<string, number>();
  const df = new Map<string, number>(); // document frequency

  for (const doc of documents) {
    const unique = new Set(doc);
    for (const term of unique) {
      df.set(term, (df.get(term) || 0) + 1);
    }
    for (const term of doc) {
      if (!vocab.has(term)) vocab.set(term, vocab.size);
    }
  }

  const vocabulary = Array.from(vocab.keys());
  const N = documents.length;

  // Build TF-IDF vectors
  const vectors = documents.map(doc => {
    const tf = new Map<string, number>();
    for (const term of doc) {
      tf.set(term, (tf.get(term) || 0) + 1);
    }
    return vocabulary.map(term => {
      const termFreq = (tf.get(term) || 0) / (doc.length || 1);
      const idf = Math.log((N + 1) / ((df.get(term) || 0) + 1)) + 1;
      return termFreq * idf;
    });
  });

  return { vectors, vocabulary };
}

function cosineSimilarity(a: number[], b: number[]): number {
  let dot = 0, magA = 0, magB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    magA += a[i] * a[i];
    magB += b[i] * b[i];
  }
  const denom = Math.sqrt(magA) * Math.sqrt(magB);
  return denom === 0 ? 0 : dot / denom;
}

function kMeans(vectors: number[][], k: number, maxIter = KMEANS_MAX_ITERATIONS): number[] {
  if (vectors.length === 0 || k <= 0) return [];
  const actualK = Math.min(k, vectors.length);
  const dim = vectors[0].length;

  let bestLabels: number[] = [];
  let bestScore = -Infinity;

  // Multiple random restarts for stability
  for (let restart = 0; restart < KMEANS_RESTARTS; restart++) {
    // Random initialization
    const indices = [...Array(vectors.length).keys()];
    for (let i = indices.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [indices[i], indices[j]] = [indices[j], indices[i]];
    }
    const centroids = indices.slice(0, actualK).map(i => [...vectors[i]]);
    const labels = new Array(vectors.length).fill(0);

    for (let iter = 0; iter < maxIter; iter++) {
      // Assign
      let changed = false;
      for (let i = 0; i < vectors.length; i++) {
        let bestDist = -Infinity;
        let bestCluster = 0;
        for (let c = 0; c < actualK; c++) {
          const sim = cosineSimilarity(vectors[i], centroids[c]);
          if (sim > bestDist) {
            bestDist = sim;
            bestCluster = c;
          }
        }
        if (labels[i] !== bestCluster) {
          labels[i] = bestCluster;
          changed = true;
        }
      }
      if (!changed) break;

      // Update centroids
      for (let c = 0; c < actualK; c++) {
        const members = vectors.filter((_, i) => labels[i] === c);
        if (members.length === 0) continue;
        for (let d = 0; d < dim; d++) {
          centroids[c][d] = members.reduce((sum, v) => sum + v[d], 0) / members.length;
        }
      }
    }

    // Score: average intra-cluster similarity
    let totalSim = 0;
    for (let i = 0; i < vectors.length; i++) {
      totalSim += cosineSimilarity(vectors[i], centroids[labels[i]]);
    }
    const score = totalSim / vectors.length;

    if (score > bestScore) {
      bestScore = score;
      bestLabels = labels;
    }
  }

  return bestLabels;
}

export function computeClusters(
  codings: CodingData[],
  k: number,
  questionIds?: string[],
) {
  const filtered = questionIds?.length
    ? codings.filter(c => questionIds.includes(c.questionId))
    : codings;

  if (filtered.length === 0) return { clusters: [] };

  // Tokenize each coding
  const documents = filtered.map(c => tokenize(c.codedText));
  const { vectors, vocabulary } = buildTfIdf(documents);

  // Cluster
  const labels = kMeans(vectors, k);

  // Build cluster results
  const clusterMap = new Map<number, { segments: any[]; vectors: number[][] }>();
  for (let i = 0; i < filtered.length; i++) {
    const label = labels[i];
    if (!clusterMap.has(label)) clusterMap.set(label, { segments: [], vectors: [] });
    const cluster = clusterMap.get(label)!;
    cluster.segments.push({ codingId: filtered[i].id, text: filtered[i].codedText });
    cluster.vectors.push(vectors[i]);
  }

  const clusters = Array.from(clusterMap.entries()).map(([id, { segments, vectors: cvecs }]) => {
    // Top keywords: highest average TF-IDF scores in the cluster
    const avgVec = new Array(vocabulary.length).fill(0);
    for (const v of cvecs) {
      for (let d = 0; d < v.length; d++) avgVec[d] += v[d];
    }
    for (let d = 0; d < avgVec.length; d++) avgVec[d] /= cvecs.length;

    const keywords = avgVec
      .map((score, idx) => ({ word: vocabulary[idx], score }))
      .sort((a, b) => b.score - a.score)
      .slice(0, 5)
      .filter(k => k.score > 0)
      .map(k => k.word);

    return {
      id,
      label: `Cluster ${id + 1}`,
      segments: segments.slice(0, MAX_CLUSTER_SEGMENTS), // Limit for display
      keywords,
    };
  });

  return { clusters };
}

// ─── 8. Coding Query (Boolean AND/OR/NOT) ───

interface TranscriptLookup {
  id: string;
  title: string;
  content: string;
}

export function computeCodingQuery(
  codings: CodingData[],
  transcripts: TranscriptLookup[],
  conditions: { questionId: string; operator: 'AND' | 'OR' | 'NOT' }[],
) {
  if (conditions.length === 0) return { matches: [], totalMatches: 0 };

  const transcriptMap = new Map<string, TranscriptLookup>();
  transcripts.forEach(t => transcriptMap.set(t.id, t));

  // Group codings by transcript
  const byTranscript = new Map<string, CodingData[]>();
  for (const c of codings) {
    const arr = byTranscript.get(c.transcriptId) || [];
    arr.push(c);
    byTranscript.set(c.transcriptId, arr);
  }

  const matches: { transcriptId: string; transcriptTitle: string; text: string; startOffset: number; endOffset: number }[] = [];

  for (const [tid, tCodings] of byTranscript) {
    const transcript = transcriptMap.get(tid);
    if (!transcript) continue;

    // Get codings for the first condition's question
    const firstQ = conditions[0].questionId;
    const baseCodes = tCodings.filter(c => c.questionId === firstQ);

    for (const baseCode of baseCodes) {
      let include = true;

      for (let i = 1; i < conditions.length; i++) {
        const cond = conditions[i];
        const qCodes = tCodings.filter(c => c.questionId === cond.questionId);

        // Check overlap with base coding
        const hasOverlap = qCodes.some(c => {
          const overlapStart = Math.max(baseCode.startOffset, c.startOffset);
          const overlapEnd = Math.min(baseCode.endOffset, c.endOffset);
          return overlapEnd > overlapStart;
        });

        if (cond.operator === 'AND' && !hasOverlap) { include = false; break; }
        if (cond.operator === 'OR') { /* OR always includes — just expands the base set */ }
        if (cond.operator === 'NOT' && hasOverlap) { include = false; break; }
      }

      if (include) {
        matches.push({
          transcriptId: tid,
          transcriptTitle: transcript.title,
          text: baseCode.codedText,
          startOffset: baseCode.startOffset,
          endOffset: baseCode.endOffset,
        });
      }
    }

    // For OR conditions, also include codings from OR-questions not already matched
    for (let i = 1; i < conditions.length; i++) {
      if (conditions[i].operator !== 'OR') continue;
      const orCodes = tCodings.filter(c => c.questionId === conditions[i].questionId);
      for (const oc of orCodes) {
        const alreadyMatched = matches.some(m =>
          m.transcriptId === tid && m.startOffset === oc.startOffset && m.endOffset === oc.endOffset
        );
        if (!alreadyMatched) {
          matches.push({
            transcriptId: tid,
            transcriptTitle: transcript.title,
            text: oc.codedText,
            startOffset: oc.startOffset,
            endOffset: oc.endOffset,
          });
        }
      }
    }
  }

  return { matches: matches.slice(0, MAX_SEARCH_MATCHES), totalMatches: matches.length };
}

// ─── 9. Sentiment Analysis (AFINN-style) ───

const AFINN_LEXICON: Record<string, number> = {
  // Positive words
  'good': 3, 'great': 3, 'excellent': 4, 'amazing': 4, 'wonderful': 4,
  'fantastic': 4, 'outstanding': 5, 'superb': 5, 'brilliant': 4, 'awesome': 4,
  'love': 3, 'loved': 3, 'like': 2, 'enjoy': 2, 'happy': 3, 'pleased': 3,
  'satisfied': 2, 'delighted': 4, 'thrilled': 4, 'excited': 3, 'grateful': 3,
  'thankful': 2, 'beautiful': 3, 'best': 3, 'better': 2, 'improve': 2,
  'improved': 2, 'improvement': 2, 'success': 3, 'successful': 3, 'win': 3,
  'won': 3, 'strong': 2, 'strength': 2, 'positive': 2, 'benefit': 2,
  'beneficial': 2, 'effective': 2, 'efficient': 2, 'helpful': 2, 'hope': 2,
  'hopeful': 2, 'inspire': 3, 'inspired': 3, 'innovative': 3, 'progress': 2,
  'valuable': 2, 'support': 2, 'supported': 2, 'encourage': 2, 'encouraged': 2,
  'proud': 3, 'confident': 2, 'trust': 2, 'trusted': 2, 'impressive': 3,
  'remarkable': 3, 'perfect': 3, 'exceptional': 4, 'incredible': 4,
  'nice': 2, 'kind': 2, 'generous': 3, 'warm': 2, 'friendly': 2,
  'safe': 1, 'secure': 2, 'comfortable': 2, 'fun': 3, 'interesting': 2,
  'fascinating': 3, 'engaging': 2, 'rewarding': 2, 'worthy': 2,
  'agree': 1, 'advantage': 2, 'achieve': 2, 'achievement': 3,
  'capable': 2, 'commitment': 2, 'committed': 2, 'opportunity': 2,
  // Negative words
  'bad': -3, 'terrible': -4, 'horrible': -4, 'awful': -4, 'worst': -4,
  'poor': -2, 'worse': -3, 'negative': -2, 'fail': -3, 'failed': -3,
  'failure': -3, 'problem': -2, 'issue': -1, 'concern': -1, 'concerned': -2,
  'worried': -2, 'worry': -2, 'fear': -2, 'afraid': -2, 'angry': -3,
  'frustrate': -3, 'frustrated': -3, 'frustrating': -3, 'annoyed': -2,
  'annoying': -2, 'disappoint': -3, 'disappointed': -3, 'disappointing': -3,
  'sad': -2, 'unhappy': -2, 'unfortunate': -2, 'unfortunately': -2,
  'hate': -4, 'hated': -4, 'dislike': -2, 'difficult': -1, 'hard': -1,
  'struggle': -2, 'struggling': -2, 'suffer': -3, 'suffering': -3,
  'pain': -2, 'painful': -2, 'stress': -2, 'stressed': -2, 'stressful': -2,
  'weak': -2, 'weakness': -2, 'lack': -2, 'lacking': -2, 'loss': -3,
  'lost': -2, 'miss': -1, 'missing': -2, 'damage': -3, 'damaged': -3,
  'harm': -3, 'harmful': -3, 'danger': -3, 'dangerous': -3,
  'risk': -1, 'risky': -2, 'threat': -3, 'crisis': -3,
  'conflict': -2, 'disagree': -2, 'wrong': -2, 'mistake': -2,
  'error': -2, 'fault': -2, 'blame': -2, 'complain': -2, 'complaint': -2,
  'reject': -3, 'rejected': -3, 'deny': -2, 'denied': -2,
  'confuse': -2, 'confused': -2, 'confusing': -2, 'unclear': -1,
  'impossible': -3, 'useless': -3, 'worthless': -4, 'boring': -2,
  'tired': -2, 'exhausted': -3, 'overwhelm': -3, 'overwhelmed': -3,
  'abuse': -4, 'corrupt': -4, 'corruption': -4, 'unfair': -3,
  'unjust': -3, 'inequality': -2, 'barrier': -2, 'obstacle': -2,
  'neglect': -3, 'neglected': -3, 'ignore': -2, 'ignored': -2,
};

const NEGATION_WORDS = new Set([
  'not', 'no', 'never', 'neither', 'nor',
  "don't", "doesn't", "didn't", "won't", "wouldn't",
  "couldn't", "shouldn't", "isn't", "aren't",
  "wasn't", "weren't", "can't", "hasn't", "haven't",
]);

function scoreSentiment(text: string): { score: number; magnitude: number } {
  const words = text.toLowerCase().replace(/[^a-z0-9\s'-]/g, ' ').split(/\s+/);
  let totalScore = 0;
  let magnitude = 0;
  let matched = 0;

  for (let i = 0; i < words.length; i++) {
    const word = words[i];
    const s = AFINN_LEXICON[word];
    if (s !== undefined) {
      const negated = i > 0 && NEGATION_WORDS.has(words[i - 1]);
      const adjustedScore = negated ? s * -1 : s;
      totalScore += adjustedScore;
      magnitude += Math.abs(adjustedScore);
      matched++;
    }
  }

  return {
    score: words.length > 0 ? totalScore / words.length : 0,
    magnitude,
  };
}

interface QuestionWithParent extends QuestionData {
  parentQuestionId?: string | null;
}

export function computeSentiment(
  codings: CodingData[],
  transcripts: TranscriptLookup[],
  questions: QuestionData[],
  scope: string,
  scopeId?: string,
) {
  let filteredCodings = codings;
  if (scope === 'question' && scopeId) {
    filteredCodings = codings.filter(c => c.questionId === scopeId);
  } else if (scope === 'transcript' && scopeId) {
    filteredCodings = codings.filter(c => c.transcriptId === scopeId);
  }

  let positive = 0, negative = 0, neutral = 0;
  let totalScore = 0;

  for (const c of filteredCodings) {
    const { score } = scoreSentiment(c.codedText);
    if (score > SENTIMENT_POSITIVE_THRESHOLD) positive++;
    else if (score < SENTIMENT_NEGATIVE_THRESHOLD) negative++;
    else neutral++;
    totalScore += score;
  }

  const averageScore = filteredCodings.length > 0 ? totalScore / filteredCodings.length : 0;

  // Group by scope for per-item breakdown
  const groupByKey = scope === 'transcript' ? 'transcriptId' : 'questionId';
  const groupMap = new Map<string, CodingData[]>();
  for (const c of filteredCodings) {
    const key = (c as any)[groupByKey];
    const arr = groupMap.get(key) || [];
    arr.push(c);
    groupMap.set(key, arr);
  }

  const labelMap = new Map<string, string>();
  if (scope === 'transcript' || scope === 'all') {
    transcripts.forEach(t => labelMap.set(t.id, t.title));
  }
  if (scope === 'question' || scope === 'all') {
    questions.forEach(q => labelMap.set(q.id, q.text));
  }

  const items = Array.from(groupMap.entries()).map(([id, groupCodings]) => {
    const allText = groupCodings.map(c => c.codedText).join(' ');
    const { score, magnitude } = scoreSentiment(allText);
    return {
      id,
      label: labelMap.get(id) || id,
      score,
      magnitude,
      sampleText: groupCodings[0]?.codedText.slice(0, 80) || '',
    };
  }).sort((a, b) => b.score - a.score);

  return {
    overall: { positive, negative, neutral, averageScore },
    items,
  };
}

// ─── 10. Treemap / Theme Map ───

export function computeTreemap(
  codings: CodingData[],
  questions: QuestionWithParent[],
  metric: string,
  questionIds?: string[],
) {
  const filteredQuestions = questionIds?.length
    ? questions.filter(q => questionIds.includes(q.id))
    : questions;

  const nodes = filteredQuestions.map(q => {
    const qCodings = codings.filter(c => c.questionId === q.id);
    const size = metric === 'characters'
      ? qCodings.reduce((sum, c) => sum + (c.endOffset - c.startOffset), 0)
      : qCodings.length;

    return {
      id: q.id,
      name: q.text,
      size,
      color: q.color,
      parentId: q.parentQuestionId || undefined,
    };
  }).filter(n => n.size > 0);

  const total = nodes.reduce((sum, n) => sum + n.size, 0);

  return { nodes, total };
}
