import { readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

const assetsDir = join(process.cwd(), 'apps/frontend/dist/assets');
const kib = 1024;

const budgets = [
  // Raised 550 -> 560 on 2026-08-24, deliberately and with measurement.
  //
  // The accessibility pass added a focus trap to 27 dialogs (WAI-ARIA requires
  // one wherever aria-modal is claimed) and moved plan gating into the UI so a
  // Free user sees a lock instead of a failed click. Measured against main:
  // 558.48 kB -> 565.03 kB, +6.4 KiB, +1.2%. Gzipped: 143.19 -> 145.49 kB.
  //
  // Not trimmed back under the old number on purpose: the only way to claw back
  // ~2 KiB would be lazy-loading modals that are already behind user intent,
  // which risks regressions for no user-visible gain. The budget exists to catch
  // accidental bloat - a dependency landing in the wrong chunk - not to block
  // functional code. New headroom is ~8 KiB; if a change eats that, look at what
  // it pulled in before raising this again.
  //
  // Raised 560 -> 575 on 2026-09-03, measured the same way. The bug-hunt fixes
  // (docs/BUG-HUNT-2026-09-02.md) added the owner-plan gate hook used by seven
  // canvas components, id-merging for server artifacts, the load-sequence guard
  // and the per-canvas layout-save queue: 565.03 kB -> 574.12 kB, +8.9 KiB;
  // gzipped 145.49 -> 148.59 kB. The chunk was inspected for pulled-in
  // dependencies (none: zero zod references, no new vendor code); it is all
  // functional code. Headroom is again ~14 KiB.
  { pattern: /^CanvasPage-.*\.js$/, limitKiB: 575 },
  { pattern: /^chart-vendor-.*\.js$/, limitKiB: 450 },
  { pattern: /^flow-vendor-.*\.js$/, limitKiB: 220 },
  { pattern: /^react-vendor-.*\.js$/, limitKiB: 220 },
  // The PDF text engine, 1,633 KiB raw / 519 KiB gzipped. It is listed
  // explicitly rather than by raising the catch-all, because the catch-all is
  // what stops an ordinary chunk growing unnoticed and that job still matters.
  //
  // Why the size is accepted: it is lazy-imported (utils/pdfText.ts, reached
  // only when someone actually opens a PDF), so nobody pays for it on load and
  // a researcher pays once, cached thereafter. The precedent is mammoth, the
  // Word reader, already carried the same way at 490 KiB. The alternative was
  // hand-rolling a PDF text extractor — font encodings, CID maps, FlateDecode
  // — which would be wrong on real files in ways this is not. PDF is the
  // format transcription services and ethics committees hand people, and the
  // activation funnel shows this step losing nearly half of all users.
  { pattern: /^pdfjs-.*\.js$/, limitKiB: 1750 },
  { pattern: /^.*\.js$/, limitKiB: 700 },
];

const failures = [];

for (const file of readdirSync(assetsDir)) {
  const budget = budgets.find((entry) => entry.pattern.test(file));
  if (!budget) continue;

  const sizeKiB = statSync(join(assetsDir, file)).size / kib;
  if (sizeKiB > budget.limitKiB) {
    failures.push(`${file}: ${sizeKiB.toFixed(1)} KiB > ${budget.limitKiB} KiB`);
  }
}

if (failures.length) {
  console.error('Bundle budget exceeded:');
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log('Bundle budgets passed.');
