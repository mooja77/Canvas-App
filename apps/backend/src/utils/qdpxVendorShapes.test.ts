import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { parseQdpxProject, describeLosses, buildQdpxXml, toGuid } from './qdpxParse.js';
import type { ParsedCode, ExportCode } from './qdpxParse.js';

/**
 * Vendor-shape regression tests.
 *
 * The real NVivo and ATLAS.ti .qdpx exports used to validate this parser are
 * NOT vendored — they contain third-party research content. Their provenance,
 * SHA-256 and re-validation command are recorded in
 * docs/qdpx-interoperability-validation.md.
 *
 * What IS committed is a structure-preserving, content-neutral fixture per
 * vendor shape, so the structural facts that broke the original implementation
 * stay covered in CI: the Codes wrapper, recursive nesting, plainTextPath
 * instead of inline text, multiple codings on one selection, and uncoded
 * quotations.
 */

const fixturesDir = resolve(dirname(fileURLToPath(import.meta.url)), '../__tests__/fixtures/qdpx');
const atlasShaped = readFileSync(resolve(fixturesDir, 'atlasti-shaped.qde'), 'utf-8');

describe('ATLAS.ti-shaped export', () => {
  const project = parseQdpxProject(atlasShaped);

  it('reads the flat codebook through the Codes wrapper', () => {
    expect(project.totalCodes).toBe(4);
    expect(project.codes.map((c) => c.name)).toEqual([
      'Topic one',
      'Topic two',
      'Topic three::sub-topic',
      '"quoted topic"',
    ]);
  });

  it('decodes escaped quotes in a code name', () => {
    // &quot; must survive as a real quote, not as the literal entity.
    expect(project.codes[3].name).toBe('"quoted topic"');
  });

  it('carries no inline text — every source uses plainTextPath', () => {
    expect(project.sources).toHaveLength(2);
    expect(project.sources.every((s) => s.plainText === '')).toBe(true);
    expect(project.sources.every((s) => (s.plainTextPath ?? '').startsWith('internal://'))).toBe(true);
  });

  it('keeps two codings that share one selection', () => {
    const shared = project.sources[1].selections[0];
    expect(shared.codeGuids).toHaveLength(2);
    expect(shared.startPosition).toBe(0);
    expect(shared.endPosition).toBe(24);
  });

  it('counts the uncoded quotation rather than dropping it silently', () => {
    expect(project.unsupported.uncodedSelections).toBe(1);
  });

  it('enumerates every construct it cannot represent', () => {
    expect(describeLosses(project.unsupported)).toEqual([
      '2 notes',
      '2 sets',
      '1 graph',
      '1 link',
      '1 picture source',
      '2 PDF sources',
      '1 audio source',
      '2 video sources',
      '1 uncoded quotation',
    ]);
  });

  it('round-trips every (range, code) pair through our writer', () => {
    const toExport = (codes: ParsedCode[]): ExportCode[] =>
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
    const before = project.sources
      .flatMap((s) =>
        s.selections.flatMap((x) => x.codeGuids.map((g) => `${x.startPosition}-${x.endPosition}:${toGuid(g)}`)),
      )
      .sort();
    const after = round.sources
      .flatMap((s) => s.selections.flatMap((x) => x.codeGuids.map((g) => `${x.startPosition}-${x.endPosition}:${g}`)))
      .sort();

    expect(after).toEqual(before);
    expect(round.totalCodes).toBe(project.totalCodes);
  });
});
