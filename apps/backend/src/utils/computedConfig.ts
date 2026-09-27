/**
 * Normalise a computed (analysis) node's saved config before running it.
 *
 * Node config is stored as free-form JSON (`z.record(z.unknown())`), so a value
 * of the wrong type used to reach the analysis functions and crash the run with
 * a 500 on every attempt: cluster `k: 2.5` indexed a centroid that was never
 * built, `pattern: 5` called `.trim` on a number, `questionIds: "abc"` called
 * `.flatMap` on a string. Wrong-typed values are dropped (the analysis then
 * uses its default) and numbers are clamped to the range the UI offers.
 */
export interface ComputedConfig {
  pattern?: string;
  mode?: string;
  groupBy?: string;
  scope?: string;
  scopeId?: string;
  metric?: string;
  questionId?: string;
  transcriptId?: string;
  transcriptIds?: string[];
  questionIds?: string[];
  caseIds?: string[];
  stopWords?: string[];
  k?: number;
  maxWords?: number;
  minOverlap?: number;
  conditions?: { questionId: string; operator: 'AND' | 'OR' | 'NOT' }[];
}

const STRING_KEYS = ['pattern', 'mode', 'groupBy', 'scope', 'scopeId', 'metric', 'questionId', 'transcriptId'] as const;
const STRING_ARRAY_KEYS = ['transcriptIds', 'questionIds', 'caseIds', 'stopWords'] as const;

function intIn(value: unknown, min: number, max: number): number | undefined {
  if (typeof value !== 'number' || !Number.isFinite(value)) return undefined;
  return Math.min(max, Math.max(min, Math.round(value)));
}

export function sanitizeComputedConfig(raw: unknown): ComputedConfig {
  const input = raw && typeof raw === 'object' && !Array.isArray(raw) ? (raw as Record<string, unknown>) : {};
  const out: ComputedConfig = {};
  for (const key of STRING_KEYS) {
    if (typeof input[key] === 'string') out[key] = input[key] as string;
  }
  for (const key of STRING_ARRAY_KEYS) {
    const v = input[key];
    if (Array.isArray(v)) out[key] = v.filter((x): x is string => typeof x === 'string');
  }
  const k = intIn(input.k, 1, 20);
  if (k !== undefined) out.k = k;
  const maxWords = intIn(input.maxWords, 1, 500);
  if (maxWords !== undefined) out.maxWords = maxWords;
  const minOverlap = intIn(input.minOverlap, 0, 1_000_000);
  if (minOverlap !== undefined) out.minOverlap = minOverlap;
  if (Array.isArray(input.conditions)) {
    out.conditions = input.conditions.filter(
      (c): c is { questionId: string; operator: 'AND' | 'OR' | 'NOT' } =>
        !!c &&
        typeof c === 'object' &&
        typeof (c as { questionId?: unknown }).questionId === 'string' &&
        ['AND', 'OR', 'NOT'].includes((c as { operator?: unknown }).operator as string),
    );
  }
  return out;
}
