/**
 * Validate a REFI-QDA project XML against the QualCanvas parser and writer.
 *
 * Vendor-produced .qdpx files are not vendored into this repository — they
 * contain third-party research content. This script reproduces the validation
 * from a file you supply, so the numbers recorded in
 * docs/qdpx-interoperability-validation.md can be re-derived independently.
 *
 *   node scripts/validate-qdpx-fixture.mjs <path-to-project.qde>
 *
 * Requires a prior build: npx tsc -b apps/backend
 */

import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';

const target = process.argv[2];
if (!target) {
  console.error('usage: node scripts/validate-qdpx-fixture.mjs <path-to-project.qde>');
  process.exit(2);
}

const mod = await import(pathToFileURL(resolve('apps/backend/dist/utils/qdpxParse.js')).href);
const { parseQdpxProject, describeLosses, buildQdpxXml, toGuid } = mod;

const raw = readFileSync(target);
const xml = raw.toString('utf-8');
const project = parseQdpxProject(xml);

const depth = (codes, d = 1) =>
  codes.length ? Math.max(...codes.map((c) => Math.max(d, depth(c.children, d + 1)))) : d - 1;

const guids = new Set();
(function walk(codes) {
  for (const c of codes) {
    guids.add(c.guid);
    walk(c.children);
  }
})(project.codes);

const selections = project.sources.reduce((n, s) => n + s.selections.length, 0);
let refs = 0;
let resolvable = 0;
for (const s of project.sources) {
  for (const sel of s.selections) {
    for (const g of sel.codeGuids) {
      refs++;
      if (guids.has(g)) resolvable++;
    }
  }
}

// Round-trip: re-emit what we parsed, parse it back, compare the full
// (range, code) pair set. Code GUIDs are deliberately remapped on export
// (CUID -> RFC-4122), so compare with that mapping applied.
const toExport = (codes) =>
  codes.map((c) => ({ id: c.guid, text: c.name, color: c.color, children: toExport(c.children) }));

const rebuilt = buildQdpxXml({
  name: project.name,
  createdAt: new Date('2026-01-01T00:00:00.000Z'),
  codes: toExport(project.codes),
  sources: project.sources.map((s) => ({ id: s.guid, title: s.name, content: s.plainText })),
  codings: project.sources.flatMap((s) =>
    s.selections.flatMap((sel) =>
      sel.codeGuids.map((g, i) => ({
        id: `${sel.guid}:${i}`,
        transcriptId: s.guid,
        questionId: g,
        startOffset: sel.startPosition,
        endOffset: sel.endPosition,
      })),
    ),
  ),
});

const round = parseQdpxProject(rebuilt);
const pairsBefore = project.sources
  .flatMap((s) => s.selections.flatMap((x) => x.codeGuids.map((g) => `${x.startPosition}-${x.endPosition}:${toGuid(g)}`)))
  .sort();
const pairsAfter = round.sources
  .flatMap((s) => s.selections.flatMap((x) => x.codeGuids.map((g) => `${x.startPosition}-${x.endPosition}:${g}`)))
  .sort();

const originMatch = xml.match(/origin="([^"]*)"/);

console.log(
  JSON.stringify(
    {
      file: target,
      bytes: raw.byteLength,
      sha256: createHash('sha256').update(raw).digest('hex'),
      origin: originMatch ? originMatch[1] : '(not declared)',
      projectName: project.name,
      topLevelCodes: project.codes.length,
      totalCodes: project.totalCodes,
      maxCodeDepth: depth(project.codes),
      textSources: project.sources.length,
      sourcesWithInlineText: project.sources.filter((s) => s.plainText.length > 0).length,
      sourcesViaPlainTextPath: project.sources.filter((s) => !s.plainText && s.plainTextPath).length,
      selections,
      codeReferences: refs,
      resolvableReferences: resolvable,
      danglingReferences: refs - resolvable,
      unsupported: describeLosses(project.unsupported),
      roundTrip: {
        codesPreserved: `${round.totalCodes}/${project.totalCodes}`,
        depthPreserved: `${depth(round.codes)}/${depth(project.codes)}`,
        codeReferencesPreserved: `${pairsAfter.length}/${pairsBefore.length}`,
        pairSetIdenticalAfterGuidRemap: JSON.stringify(pairsBefore) === JSON.stringify(pairsAfter),
      },
    },
    null,
    2,
  ),
);
