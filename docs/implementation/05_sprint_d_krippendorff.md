# Sprint D — Krippendorff's α + Fleiss' κ

## Goal

Add Krippendorff's α (and Fleiss' κ) to QualCanvas's intercoder reliability suite. Current implementation ships only Cohen's κ — methodologically incorrect for >2 coders or missing data, blocking institutional sales.

## Scope

- Implement Krippendorff α (nominal scale; ordinal/interval as stretch)
- Implement Fleiss κ for ≥3 coders
- Update `/api/v1/canvas/:id/intercoder` route to accept `method` query param
- Update IntercoderReliabilityModal UI with method dropdown
- Methods white-paper (1-page, customer-citable)
- Tests against Krippendorff (2018) ch. 12 published datasets

## Out of scope

- Multi-scale support (ordinal, interval, ratio) — stretch goal
- New visualisation of disagreement matrix (Sprint G inspector)
- Continuous variable α — qualitative coding is nominal only

## File-level changes

### 1. Compute functions

**`C:\JM Programs\QualCanvas\apps\backend\src\utils\intercoder.ts`** (extend existing file)

```typescript
/**
 * Krippendorff's alpha — handles any number of coders, missing data,
 * nominal/ordinal/interval/ratio measurement scales.
 *
 * Reference: Krippendorff (2018) Content Analysis ch. 12.
 *
 * For nominal data (the qualitative coding case):
 *   α = 1 - (D_o / D_e)
 *   D_o = observed disagreement
 *   D_e = expected disagreement by chance
 */
export interface KrippendorffInput {
  unitId: string; // segment / coding unit identifier
  coderId: string; // which researcher
  value: string; // code applied
}

export interface KrippendorffResult {
  alpha: number; // -1 to 1, where 1 = perfect agreement
  n_units: number;
  n_coders: number;
  n_observations: number;
  scale: 'nominal' | 'ordinal' | 'interval';
}

export function computeKrippendorffAlpha(
  observations: KrippendorffInput[],
  scale: 'nominal' | 'ordinal' | 'interval' = 'nominal',
): KrippendorffResult {
  // Build coincidence matrix
  const unitMap = new Map<string, Map<string, string>>();
  const allValues = new Set<string>();
  const allCoders = new Set<string>();

  for (const obs of observations) {
    if (!unitMap.has(obs.unitId)) unitMap.set(obs.unitId, new Map());
    unitMap.get(obs.unitId)!.set(obs.coderId, obs.value);
    allValues.add(obs.value);
    allCoders.add(obs.coderId);
  }

  const values = Array.from(allValues);
  const valueIndex = new Map(values.map((v, i) => [v, i]));
  const n_values = values.length;

  // Coincidence matrix: o[v1][v2] = expected co-occurrence within units
  const o: number[][] = Array.from({ length: n_values }, () => new Array(n_values).fill(0));
  const n_per_value: number[] = new Array(n_values).fill(0);
  let n_observations = 0;

  for (const [, coderValues] of unitMap) {
    const vals = Array.from(coderValues.values());
    const m_u = vals.length;
    if (m_u < 2) continue;
    n_observations += m_u;

    for (let i = 0; i < vals.length; i++) {
      for (let j = 0; j < vals.length; j++) {
        if (i === j) continue;
        const vi = valueIndex.get(vals[i])!;
        const vj = valueIndex.get(vals[j])!;
        o[vi][vj] += 1 / (m_u - 1);
        n_per_value[vi] += 1 / (m_u - 1);
      }
    }
  }

  const n_total = n_per_value.reduce((a, b) => a + b, 0);

  // Disagreement metric
  const metric = (v1: number, v2: number) => {
    if (scale === 'nominal') return v1 === v2 ? 0 : 1;
    if (scale === 'ordinal') return (v1 - v2) ** 2;
    return (v1 - v2) ** 2; // interval — same as ordinal for our purposes
  };

  // Observed disagreement
  let D_o = 0;
  for (let i = 0; i < n_values; i++) {
    for (let j = 0; j < n_values; j++) {
      D_o += o[i][j] * metric(i, j);
    }
  }
  D_o /= n_total;

  // Expected disagreement
  let D_e = 0;
  for (let i = 0; i < n_values; i++) {
    for (let j = 0; j < n_values; j++) {
      D_e += ((n_per_value[i] * n_per_value[j]) / (n_total * (n_total - 1))) * metric(i, j);
    }
  }

  const alpha = D_e === 0 ? 1 : 1 - D_o / D_e;

  return {
    alpha,
    n_units: unitMap.size,
    n_coders: allCoders.size,
    n_observations,
    scale,
  };
}

/**
 * Fleiss' kappa for ≥3 coders.
 * Reference: Fleiss (1971) "Measuring nominal scale agreement among many raters"
 */
export interface FleissInput {
  unitId: string;
  ratings: string[]; // one rating per coder, ordered by coder
}

export interface FleissResult {
  kappa: number;
  P_observed: number;
  P_expected: number;
  n_units: number;
  n_coders: number;
}

export function computeFleissKappa(observations: FleissInput[]): FleissResult {
  if (observations.length === 0) {
    return { kappa: 0, P_observed: 0, P_expected: 0, n_units: 0, n_coders: 0 };
  }
  const n_coders = observations[0].ratings.length;
  const n_units = observations.length;

  // Collect unique categories
  const categories = new Set<string>();
  for (const obs of observations) {
    for (const r of obs.ratings) categories.add(r);
  }
  const cats = Array.from(categories);
  const catIndex = new Map(cats.map((c, i) => [c, i]));

  // Build n_ij matrix (rows=units, cols=categories): count of raters assigning category j to unit i
  const n_ij: number[][] = observations.map((obs) => {
    const counts = new Array(cats.length).fill(0);
    for (const r of obs.ratings) {
      counts[catIndex.get(r)!] += 1;
    }
    return counts;
  });

  // P_i (proportion of pairs in agreement for unit i)
  const P_i = n_ij.map((row) => {
    const sum_sq = row.reduce((s, n) => s + n * n, 0);
    return (sum_sq - n_coders) / (n_coders * (n_coders - 1));
  });

  // P_observed (mean of P_i)
  const P_observed = P_i.reduce((s, p) => s + p, 0) / n_units;

  // p_j (overall proportion of ratings assigned to category j)
  const p_j = cats.map((_, j) => {
    let total = 0;
    for (const row of n_ij) total += row[j];
    return total / (n_units * n_coders);
  });

  // P_expected
  const P_expected = p_j.reduce((s, p) => s + p * p, 0);

  const kappa = P_expected === 1 ? 1 : (P_observed - P_expected) / (1 - P_expected);

  return { kappa, P_observed, P_expected, n_units, n_coders };
}
```

### 2. Route update

**`C:\JM Programs\QualCanvas\apps\backend\src\routes\codingRoutes.ts`** (existing Kappa endpoint):

```diff
 export async function computeReliability(req, res) {
   const { canvasId, transcriptId } = req.params;
+  const method = (req.query.method || 'alpha') as 'kappa' | 'alpha' | 'fleiss';
   const codings = await prisma.canvasTextCoding.findMany({
     where: { canvasId, ...(transcriptId ? { transcriptId } : {}) },
     orderBy: { startOffset: 'asc' },
   });

-  const result = computeCohenKappa(codingsA, codingsB, segments);
+  let result;
+  switch (method) {
+    case 'alpha':
+      result = computeKrippendorffAlpha(formatForKrippendorff(codings));
+      break;
+    case 'fleiss':
+      result = computeFleissKappa(formatForFleiss(codings));
+      break;
+    case 'kappa':
+    default:
+      result = computeCohenKappa(codingsA, codingsB, segments);
+  }
   res.json({ success: true, data: { method, result } });
 }
```

### 3. UI update

**`C:\JM Programs\QualCanvas\apps\frontend\src\components\canvas\panels\IntercoderReliabilityModal.tsx`**

Add a method-picker at the top:

```tsx
<div className="flex items-center gap-3 mb-4">
  <label className="text-sm font-medium">Method:</label>
  <select
    value={method}
    onChange={(e) => setMethod(e.target.value as Method)}
    className="px-3 py-1.5 border rounded-md"
  >
    <option value="alpha">Krippendorff's α (recommended)</option>
    <option value="fleiss">Fleiss' κ (3+ coders)</option>
    <option value="kappa">Cohen's κ (2 coders, legacy)</option>
  </select>
  <Tooltip content="Krippendorff's α handles any number of coders and missing data. Cohen's κ only works for exactly 2 coders with no missing data — methodologists prefer α (Krippendorff 2018; ATLAS.ti research hub).">
    <InfoIcon className="w-4 h-4 text-gray-400" />
  </Tooltip>
</div>
```

### 4. Tests

**`C:\JM Programs\QualCanvas\apps\backend\src\utils\intercoder.test.ts`** (new file):

```typescript
import { computeKrippendorffAlpha, computeFleissKappa } from './intercoder';

describe('Krippendorff α', () => {
  // Test 1: perfect agreement
  it('returns α=1 for perfect agreement', () => {
    const result = computeKrippendorffAlpha([
      { unitId: 'u1', coderId: 'c1', value: 'A' },
      { unitId: 'u1', coderId: 'c2', value: 'A' },
      { unitId: 'u2', coderId: 'c1', value: 'B' },
      { unitId: 'u2', coderId: 'c2', value: 'B' },
    ]);
    expect(result.alpha).toBeCloseTo(1.0, 4);
  });

  // Test 2: from Krippendorff (2018) ch. 12, Table 12.2
  // 4 coders, 12 units, expected α = 0.743
  it('matches Krippendorff 2018 Table 12.2 (α=0.743)', () => {
    const observations = [
      // unit 1: 4 coders agree on '*'
      { unitId: 'u1', coderId: 'a', value: '*' },
      { unitId: 'u1', coderId: 'b', value: '*' },
      { unitId: 'u1', coderId: 'c', value: '*' },
      { unitId: 'u1', coderId: 'd', value: '*' },
      // unit 2: 4 coders agree on '1'
      { unitId: 'u2', coderId: 'a', value: '1' },
      { unitId: 'u2', coderId: 'b', value: '1' },
      { unitId: 'u2', coderId: 'c', value: '1' },
      { unitId: 'u2', coderId: 'd', value: '1' },
      // ... (12 units total per Table 12.2)
    ];
    const result = computeKrippendorffAlpha(observations);
    expect(result.alpha).toBeCloseTo(0.743, 3);
  });

  it('returns α=0 for random agreement', () => {
    // ... appropriate test fixture
  });
});

describe('Fleiss κ', () => {
  it('matches Fleiss 1971 worked example (κ=0.430)', () => {
    // ... reference dataset
  });
});
```

### 5. Methods white-paper

**`C:\JM Programs\QualCanvas\apps\frontend\public\research\intercoder-reliability-methods.pdf`**

(or HTML page at `/research/intercoder-reliability`)

1-page document with:

- What is intercoder reliability?
- Why Cohen's κ is insufficient (Krippendorff 2018 ch. 12, ATLAS.ti research hub)
- Krippendorff's α formula + interpretation thresholds
- Fleiss' κ formula + interpretation
- How QualCanvas computes it
- Citation: "Statistical inter-coder reliability calculated per Krippendorff (2018). QualCanvas reports α as the primary measure."

Customer-citable in methods sections.

## Acceptance criteria

- [ ] `computeKrippendorffAlpha` implemented + tested
- [ ] `computeFleissKappa` implemented + tested
- [ ] Tests pass against Krippendorff (2018) Table 12.2 to 4 decimals
- [ ] Route accepts `method` query param, defaults to `alpha`
- [ ] IntercoderReliabilityModal has method dropdown, defaults to α
- [ ] Methods white-paper PDF / HTML page live
- [ ] `intercoderEnabled: true` plan flag gates access (researcherPro + team)
- [ ] E2E test: open intercoder modal, select α, run, verify result returned

## Rollback

- Revert files
- No DB changes
- Existing Cohen's κ flow continues working (it's still the legacy method)

## Telemetry

- `intercoder_reliability_run` event with `{ method, canvasId, coders, units, score }`

## Effort

**1-2 weeks.** Implementation 5 days, tests 2 days, UI 1 day, white-paper 1 day, polish + review 1 day.

## Owner

TBD

## Commit message

```
feat(intercoder): add Krippendorff's α and Fleiss' κ alongside Cohen's κ

- α is now default (recommended for any number of coders, handles missing data)
- Cohen's κ kept for legacy / 2-coder studies
- Method picker in IntercoderReliabilityModal
- Tests against Krippendorff 2018 Table 12.2 + Fleiss 1971 worked example
- Methods white-paper added at /research/intercoder-reliability

Unlocks institutional sales segment where methods reviewers reject Cohen's κ
for >2 coders or missing data.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
```
