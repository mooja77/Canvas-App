import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { evaluateFixture, loadFixtures, type Fixture, type RawModelOutput } from './runAiEval.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const read = (p: string) => JSON.parse(readFileSync(join(HERE, 'fixtures', p), 'utf8'));

describe('AI eval harness — runner pipeline (dry-run)', () => {
  const fixture = read('sample-emotions.json') as Fixture;
  const recorded = read('sample-emotions.recorded.json') as RawModelOutput;

  it('discovers fixtures without their .recorded.json counterparts', () => {
    const names = loadFixtures().map((f) => f.name);
    expect(names).toContain('sample-emotions');
    // recorded files must not be loaded as fixtures
    expect(names.every((n) => !n.endsWith('.recorded'))).toBe(true);
  });

  it('scores the recorded model output against gold with the expected metrics', () => {
    const r = evaluateFixture(fixture, recorded);

    // 5 recorded codings: 3 correct (1 exact + 2 partial-overlap), 1 wrong-code
    // false positive, 1 hallucinated span dropped at anchor time.
    expect(r.goldCount).toBe(3);
    expect(r.goldDropped).toBe(0);
    expect(r.predictedCount).toBe(4); // 5 minus the 1 hallucination
    expect(r.hallucinated).toBe(1);

    expect(r.score.tp).toBe(3);
    expect(r.score.fp).toBe(1);
    expect(r.score.fn).toBe(0);
    expect(r.score.precision).toBeCloseTo(0.75, 5);
    expect(r.score.recall).toBeCloseTo(1, 5);
    expect(r.score.f1).toBeCloseTo(0.857, 3);
  });

  it('breaks the score down per code', () => {
    const r = evaluateFixture(fixture, recorded);
    const byCode = Object.fromEntries(r.score.perCode.map((c) => [c.code, c]));

    // "anxiety" got one right span + one wrong-code false positive -> P 0.5, R 1.
    expect(byCode['anxiety'].precision).toBeCloseTo(0.5, 5);
    expect(byCode['anxiety'].recall).toBeCloseTo(1, 5);
    // the other two codes are clean.
    expect(byCode['social support'].f1).toBeCloseTo(1, 5);
    expect(byCode['coping'].f1).toBeCloseTo(1, 5);
  });

  it('a perfect prediction scores F1 = 1; an empty prediction scores recall 0', () => {
    const perfect: RawModelOutput = { codings: fixture.goldCodings };
    expect(evaluateFixture(fixture, perfect).score.f1).toBeCloseTo(1, 5);

    const empty = evaluateFixture(fixture, { codings: [] });
    expect(empty.score.recall).toBe(0);
    expect(empty.score.tp).toBe(0);
  });
});
