/**
 * Mojibake audit + repair.
 *
 * Scans user-facing text fields for the UTF-8 replacement character
 * (U+FFFD / `�`) — a sign that content was written to the DB after some
 * earlier client decoded it incorrectly. Prints offenders so they can be
 * reviewed. Optional --fix mode accepts a CSV of {id,column,value} lines
 * to apply one-by-one, because the replacement char is lossy and the
 * original characters can't be auto-guessed.
 *
 * Usage:
 *   DATABASE_URL=... npx tsx apps/backend/scripts/fix-mojibake.ts
 *   DATABASE_URL=... npx tsx apps/backend/scripts/fix-mojibake.ts --fix fixes.csv
 *
 * CSV format (no header, quote values with commas):
 *   canvas,cmn...abc,name,Thematic Analysis 🧠
 *   question,cmn...xyz,text,Thème émotionnel
 *   transcript,cmn...qrs,title,Élève 1
 *
 * columns: { canvas: "name", question: "text", transcript: "title" }
 */

import { PrismaClient } from '@prisma/client';
import { readFileSync } from 'node:fs';

const REPLACEMENT = '�';

type TargetTable = 'canvas' | 'question' | 'transcript';

const TARGETS: Record<TargetTable, { model: 'codingCanvas' | 'canvasQuestion' | 'canvasTranscript'; column: string }> =
  {
    canvas: { model: 'codingCanvas', column: 'name' },
    question: { model: 'canvasQuestion', column: 'text' },
    transcript: { model: 'canvasTranscript', column: 'title' },
  };

async function audit(prisma: PrismaClient): Promise<void> {
  console.log(`Scanning for rows containing U+FFFD (${REPLACEMENT}) ...\n`);
  let total = 0;
  for (const [key, { model, column }] of Object.entries(TARGETS) as Array<[TargetTable, typeof TARGETS.canvas]>) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const client = (prisma as any)[model];
    const rows: Array<Record<string, unknown>> = await client.findMany({
      where: { [column]: { contains: REPLACEMENT } },
      select: { id: true, [column]: true },
    });
    if (rows.length === 0) continue;
    console.log(`── ${key} (${rows.length} row${rows.length === 1 ? '' : 's'}) ──`);
    for (const row of rows) {
      console.log(`  ${row.id}  ${JSON.stringify(row[column])}`);
    }
    console.log();
    total += rows.length;
  }
  console.log(total === 0 ? '✔ No mojibake found.' : `⚠ ${total} row(s) contain the replacement character.`);
}

async function applyFixes(prisma: PrismaClient, csvPath: string): Promise<void> {
  const raw = readFileSync(csvPath, 'utf8')
    .split(/\r?\n/)
    .filter((l) => l.trim() && !l.startsWith('#'));
  let applied = 0;
  let skipped = 0;

  for (const line of raw) {
    // Split on first three commas only — the value may contain commas.
    const [tableRaw, id, columnRaw, ...rest] = line.split(',');
    const table = tableRaw?.trim() as TargetTable;
    const column = columnRaw?.trim();
    const value = rest.join(',').trim().replace(/^"|"$/g, '');

    if (!TARGETS[table]) {
      console.warn(`  skip: unknown table "${tableRaw}"`);
      skipped += 1;
      continue;
    }
    if (column !== TARGETS[table].column) {
      console.warn(`  skip ${id}: column must be "${TARGETS[table].column}" for ${table}, got "${column}"`);
      skipped += 1;
      continue;
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const client = (prisma as any)[TARGETS[table].model];
    await client.update({
      where: { id },
      data: { [column]: value },
    });
    console.log(`  ✔ ${table}/${id} → ${JSON.stringify(value)}`);
    applied += 1;
  }

  console.log(`\nApplied ${applied} fix(es), skipped ${skipped}.`);
}

async function main() {
  const prisma = new PrismaClient();
  try {
    const fixIdx = process.argv.indexOf('--fix');
    if (fixIdx !== -1) {
      const csvPath = process.argv[fixIdx + 1];
      if (!csvPath) {
        console.error('Error: --fix requires a CSV file path.');
        process.exit(1);
      }
      await applyFixes(prisma, csvPath);
    } else {
      await audit(prisma);
    }
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
