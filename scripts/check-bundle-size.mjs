import { readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

const assetsDir = join(process.cwd(), 'apps/frontend/dist/assets');
const kib = 1024;

const budgets = [
  { pattern: /^CanvasPage-.*\.js$/, limitKiB: 550 },
  { pattern: /^chart-vendor-.*\.js$/, limitKiB: 450 },
  { pattern: /^flow-vendor-.*\.js$/, limitKiB: 220 },
  { pattern: /^react-vendor-.*\.js$/, limitKiB: 220 },
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
