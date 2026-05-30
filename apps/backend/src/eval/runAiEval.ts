/**
 * AI eval harness — runner (Phase 2 of docs/superpowers/specs/2026-05-29-ai-eval-harness-design.md).
 *
 * For each gold fixture, obtain predicted codings (either recorded model output
 * via --dry-run, or a live LLM call reusing the REAL auto-code prompt + provider
 * via --live), resolve their spans with the same text-anchoring the product
 * uses, score them against the gold codings with the pure scoreCodings() core,
 * and print + persist precision / recall / F1 (overall + per code).
 *
 * Usage:
 *   npm run eval:ai                 # dry-run all fixtures (no API key, no cost)
 *   npm run eval:ai -- --fixture sample-emotions
 *   npm run eval:ai -- --live       # live LLM (needs OPENAI_API_KEY); not a CI gate
 *
 * The runner is dev/research tooling — never a CI gate (cost + secrets). Only
 * the dry-run pipeline + the pure evaluateFixture() are unit-tested.
 */
import { readFileSync, readdirSync, writeFileSync, mkdirSync, existsSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { scoreCodings, type EvalCoding, type EvalScore } from './evalMetrics.js';
import { findCoding } from '../utils/findCoding.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const FIXTURES_DIR = join(HERE, 'fixtures');

export interface CodingItem {
  /** Code name; or `questionId` (a codebook id) which is resolved to its name. */
  code?: string;
  questionId?: string;
  codedText: string;
  anchorBefore?: string | null;
  confidence?: number;
  reasoning?: string;
}

export interface Fixture {
  name: string;
  description?: string;
  transcriptTitle: string;
  transcriptContent: string;
  codebook: { id: string; text: string }[];
  goldCodings: CodingItem[];
}

export interface RawModelOutput {
  codings: CodingItem[];
}

export interface FixtureResult {
  name: string;
  score: EvalScore;
  /** Predicted codings whose codedText couldn't be anchored (hallucinated spans). */
  hallucinated: number;
  goldCount: number;
  /** Gold codings that failed to anchor (should be 0 for a clean fixture). */
  goldDropped: number;
  predictedCount: number;
}

/**
 * Resolve a list of {code/questionId, codedText, anchorBefore} into EvalCodings
 * by anchoring each codedText into the transcript (the same text-anchored span
 * resolution the product uses — LLM-emitted offsets are unreliable). A
 * questionId is mapped to its codebook name so live predictions (which emit
 * ids) compare against gold (which uses names). Unanchorable items are dropped.
 */
function anchorCodings(
  transcript: string,
  items: CodingItem[],
  codebook: { id: string; text: string }[],
): { evals: EvalCoding[]; dropped: number } {
  const nameById = new Map(codebook.map((c) => [c.id, c.text]));
  const evals: EvalCoding[] = [];
  let dropped = 0;
  for (const it of items) {
    const span = findCoding(transcript, it.codedText, it.anchorBefore ?? null);
    if (!span) {
      dropped++;
      continue;
    }
    const code = (it.questionId && nameById.get(it.questionId)) || it.code || it.questionId || '';
    evals.push({ code, startOffset: span.start, endOffset: span.end });
  }
  return { evals, dropped };
}

/** Pure: score one fixture's predicted model output against its gold codings. */
export function evaluateFixture(fixture: Fixture, raw: RawModelOutput): FixtureResult {
  const gold = anchorCodings(fixture.transcriptContent, fixture.goldCodings, fixture.codebook);
  const pred = anchorCodings(fixture.transcriptContent, raw.codings ?? [], fixture.codebook);
  const score = scoreCodings(pred.evals, gold.evals);
  return {
    name: fixture.name,
    score,
    hallucinated: pred.dropped,
    goldCount: gold.evals.length,
    goldDropped: gold.dropped,
    predictedCount: pred.evals.length,
  };
}

export function loadFixtures(): Fixture[] {
  return readdirSync(FIXTURES_DIR)
    .filter((f) => f.endsWith('.json') && !f.endsWith('.recorded.json'))
    .map((f) => JSON.parse(readFileSync(join(FIXTURES_DIR, f), 'utf8')) as Fixture);
}

async function getPredicted(fixture: Fixture, live: boolean): Promise<RawModelOutput> {
  if (!live) {
    const recPath = join(FIXTURES_DIR, `${fixture.name}.recorded.json`);
    if (!existsSync(recPath)) {
      throw new Error(`Dry-run needs a recorded output: ${fixture.name}.recorded.json (or run with --live).`);
    }
    return JSON.parse(readFileSync(recPath, 'utf8')) as RawModelOutput;
  }
  // Live: reuse the REAL auto-code prompt + provider abstraction.
  const { buildAutoCodeTranscriptPrompt } = await import('../utils/aiPrompts.js');
  const { createProvider, getDefaultProvider } = await import('../lib/llm.js');
  const apiKey = process.env.OPENAI_API_KEY;
  const provider = apiKey
    ? createProvider('openai', apiKey, process.env.EVAL_MODEL || undefined)
    : getDefaultProvider();
  if (!provider) throw new Error('Live eval requires OPENAI_API_KEY (or a configured default provider).');
  const messages = buildAutoCodeTranscriptPrompt({
    transcriptTitle: fixture.transcriptTitle,
    transcriptContent: fixture.transcriptContent,
    existingCodes: fixture.codebook,
    instructions: undefined,
  });
  const result = await provider.complete({ messages, responseFormat: 'json', temperature: 0.2, maxTokens: 4096 });
  return JSON.parse(result.content) as RawModelOutput;
}

function pct(n: number): string {
  return `${(n * 100).toFixed(1)}%`;
}

function printResult(r: FixtureResult): void {
  const s = r.score;
  console.log(`\n=== ${r.name} ===`);
  console.log(
    `overall  P ${pct(s.precision)}  R ${pct(s.recall)}  F1 ${pct(s.f1)}   ` +
      `(tp ${s.tp} fp ${s.fp} fn ${s.fn}; gold ${r.goldCount}, predicted ${r.predictedCount}, hallucinated ${r.hallucinated})`,
  );
  for (const c of s.perCode) {
    console.log(
      `  ${c.code.padEnd(20)} P ${pct(c.precision)}  R ${pct(c.recall)}  F1 ${pct(c.f1)}  (tp ${c.tp} fp ${c.fp} fn ${c.fn})`,
    );
  }
  if (r.goldDropped > 0) console.warn(`  ! ${r.goldDropped} gold coding(s) failed to anchor — check the fixture.`);
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const live = args.includes('--live');
  const only = args.includes('--fixture') ? args[args.indexOf('--fixture') + 1] : null;

  const fixtures = loadFixtures().filter((f) => !only || f.name === only);
  if (fixtures.length === 0) {
    console.error(only ? `No fixture named "${only}".` : 'No fixtures found.');
    process.exit(1);
  }

  console.log(`AI eval — ${live ? 'LIVE (real LLM)' : 'dry-run (recorded outputs)'} — ${fixtures.length} fixture(s)`);
  const results: FixtureResult[] = [];
  for (const fixture of fixtures) {
    const raw = await getPredicted(fixture, live);
    const r = evaluateFixture(fixture, raw);
    printResult(r);
    results.push(r);
  }

  const macroF1 = results.reduce((a, r) => a + r.score.f1, 0) / results.length;
  console.log(`\nmacro-F1 across ${results.length} fixture(s): ${pct(macroF1)}`);

  const reportsDir = join(HERE, '..', '..', '..', '..', 'eval-reports');
  mkdirSync(reportsDir, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const reportPath = join(reportsDir, `ai-eval-${live ? 'live' : 'dryrun'}-${stamp}.json`);
  writeFileSync(reportPath, JSON.stringify({ mode: live ? 'live' : 'dry-run', macroF1, results }, null, 2));
  console.log(`report: ${reportPath}`);
}

// Only run the CLI when invoked directly (not when imported by the test, whose
// path ends with runAiEval.test.{ts,js} and so won't match).
if (process.argv[1] && /runAiEval\.(ts|js)$/.test(process.argv[1])) {
  main().catch((err) => {
    console.error(err instanceof Error ? err.message : err);
    process.exit(1);
  });
}
