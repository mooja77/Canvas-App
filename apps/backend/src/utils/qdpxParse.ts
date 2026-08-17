/**
 * REFI-QDA (QDA-XML v1.0) project parsing — pure functions, no database access.
 *
 * Structure per Project.xsd (REFI, 18 March 2019):
 *
 *   Project > CodeBook > Codes > Code    — Codes is a required wrapper and
 *                                          Code nests recursively
 *   Project > Sources > TextSource       — PlainTextContent is a child element
 *   TextSource > PlainTextSelection > Coding > CodeRef@targetGUID
 *
 * Note there is no top-level <Codings> element in the standard: a coding is
 * attached to the selection that carries it.
 */

import { createHash } from 'node:crypto';
import { XMLParser } from 'fast-xml-parser';

export interface ParsedCode {
  guid: string;
  name: string;
  color?: string;
  description?: string;
  children: ParsedCode[];
}

export interface ParsedSelection {
  guid: string;
  startPosition: number;
  endPosition: number;
  codeGuids: string[];
}

export interface ParsedSource {
  guid: string;
  name: string;
  plainText: string;
  /**
   * Set when the source text lives in a separate archive entry rather than
   * inline, e.g. plainTextPath="internal://<guid>.txt". NVivo exports this way,
   * so an importer that only reads project.qde gets empty sources.
   */
  plainTextPath?: string;
  selections: ParsedSelection[];
}

/**
 * Counts of standard constructs QualCanvas does not model and therefore drops.
 * Reported so an import can disclose its losses instead of implying a clean
 * copy.
 */
export interface UnsupportedCounts {
  variables: number;
  cases: number;
  notes: number;
  sets: number;
  graphs: number;
  links: number;
  pictureSources: number;
  pdfSources: number;
  audioSources: number;
  videoSources: number;
  /** Selections with no coding — a marked passage we cannot represent. */
  uncodedSelections: number;
}

export interface ParsedProject {
  name: string;
  codes: ParsedCode[];
  totalCodes: number;
  sources: ParsedSource[];
  unsupported: UnsupportedCounts;
}

/** Singular/plural label for each unsupported construct. */
const LOSS_LABELS: Record<keyof UnsupportedCounts, [string, string]> = {
  variables: ['variable', 'variables'],
  cases: ['case', 'cases'],
  notes: ['note', 'notes'],
  sets: ['set', 'sets'],
  graphs: ['graph', 'graphs'],
  links: ['link', 'links'],
  pictureSources: ['picture source', 'picture sources'],
  pdfSources: ['PDF source', 'PDF sources'],
  audioSources: ['audio source', 'audio sources'],
  videoSources: ['video source', 'video sources'],
  uncodedSelections: ['uncoded quotation', 'uncoded quotations'],
};

/** Human-readable list of what an import will drop, e.g. "2 variables". */
export function describeLosses(unsupported: UnsupportedCounts): string[] {
  return (Object.keys(LOSS_LABELS) as (keyof UnsupportedCounts)[])
    .filter((key) => unsupported[key] > 0)
    .map((key) => {
      const n = unsupported[key];
      const [singular, plural] = LOSS_LABELS[key];
      return `${n} ${n === 1 ? singular : plural}`;
    });
}

export interface FlatCode {
  guid: string;
  name: string;
  color?: string;
  description?: string;
  parentGuid: string | null;
}

/**
 * Depth-first pre-order flattening of a code tree. Parents always precede their
 * children, so a caller inserting rows in order can resolve each parentGuid to
 * an already-created row.
 */
export function flattenCodesForInsert(codes: ParsedCode[], parentGuid: string | null = null): FlatCode[] {
  const out: FlatCode[] = [];
  for (const code of codes) {
    out.push({
      guid: code.guid,
      name: code.name,
      color: code.color,
      description: code.description,
      parentGuid,
    });
    out.push(...flattenCodesForInsert(code.children, code.guid));
  }
  return out;
}

/** Elements that may legitimately appear once or many times. */
const REPEATABLE = ['Code', 'TextSource', 'PlainTextSelection', 'Coding', 'CodeRef'];

function toArray<T>(val: T | T[] | undefined | null): T[] {
  if (val === undefined || val === null) return [];
  return Array.isArray(val) ? val : [val];
}

const NAMED_ENTITIES: Record<string, string> = {
  lt: '<',
  gt: '>',
  amp: '&',
  quot: '"',
  apos: "'",
};

/**
 * Decode the five predefined XML entities plus numeric character references.
 *
 * The parser runs with processEntities disabled so that DOCTYPE-declared
 * entities are never expanded (XXE and billion-laughs). That also switches off
 * decoding of the predefined entities, so a transcript containing "&" would
 * otherwise import as a literal "&amp;". Decoding here — in one pass, so
 * "&amp;lt;" yields "&lt;" and not "<" — restores the text without reopening
 * entity expansion.
 */
function decodeXmlEntities(str: string): string {
  return str.replace(/&(#x[0-9a-fA-F]+|#\d+|[a-zA-Z]+);/g, (match, body: string) => {
    if (body.startsWith('#x') || body.startsWith('#X')) {
      const code = parseInt(body.slice(2), 16);
      return Number.isFinite(code) ? String.fromCodePoint(code) : match;
    }
    if (body.startsWith('#')) {
      const code = parseInt(body.slice(1), 10);
      return Number.isFinite(code) ? String.fromCodePoint(code) : match;
    }
    return NAMED_ENTITIES[body] ?? match;
  });
}

function attr(node: Record<string, unknown>, name: string): string | undefined {
  const v = node[`@_${name}`];
  return v === undefined || v === null ? undefined : decodeXmlEntities(String(v));
}

/** Text of a child element that fast-xml-parser may have collapsed to a scalar. */
function childText(node: Record<string, unknown>, name: string): string | undefined {
  const v = node[name];
  if (v === undefined || v === null) return undefined;
  if (typeof v === 'object') {
    const t = (v as Record<string, unknown>)['#text'];
    return t === undefined || t === null ? '' : decodeXmlEntities(String(t));
  }
  return decodeXmlEntities(String(v));
}

function parseCode(node: Record<string, unknown>): ParsedCode {
  return {
    guid: attr(node, 'guid') ?? '',
    name: attr(node, 'name') ?? 'Untitled code',
    color: attr(node, 'color'),
    description: childText(node, 'Description'),
    // Recursive: CodeType contains zero or more nested CodeType children.
    children: toArray(node.Code as Record<string, unknown>[]).map(parseCode),
  };
}

function countCodes(codes: ParsedCode[]): number {
  return codes.reduce((n, c) => n + 1 + countCodes(c.children), 0);
}

function parseSelection(node: Record<string, unknown>): ParsedSelection {
  const codeGuids: string[] = [];
  for (const coding of toArray(node.Coding as Record<string, unknown>[])) {
    for (const ref of toArray(coding.CodeRef as Record<string, unknown>[])) {
      const target = attr(ref, 'targetGUID');
      if (target) codeGuids.push(target);
    }
  }

  return {
    guid: attr(node, 'guid') ?? '',
    startPosition: parseInt(attr(node, 'startPosition') ?? '0', 10) || 0,
    endPosition: parseInt(attr(node, 'endPosition') ?? '0', 10) || 0,
    codeGuids,
  };
}

function parseTextSource(node: Record<string, unknown>): ParsedSource {
  return {
    guid: attr(node, 'guid') ?? '',
    name: attr(node, 'name') ?? 'Untitled source',
    // Spec puts the text in a child element. Older QualCanvas exports put it in
    // a plainTextContent attribute, so fall back to that.
    plainText: childText(node, 'PlainTextContent') ?? attr(node, 'plainTextContent') ?? '',
    plainTextPath: attr(node, 'plainTextPath'),
    selections: toArray(node.PlainTextSelection as Record<string, unknown>[]).map(parseSelection),
  };
}

/**
 * Older QualCanvas exports carried a top-level <Codings> block, with each
 * <Coding codeGUID> holding <TextSelection sourceGUID>. Fold those onto the
 * sources they reference so the rest of the pipeline sees one shape.
 */
function applyLegacyCodings(project: Record<string, unknown>, sources: ParsedSource[]): void {
  const codingsNode = project.Codings as Record<string, unknown> | undefined;
  if (!codingsNode) return;

  const byGuid = new Map(sources.map((s) => [s.guid, s]));

  for (const coding of toArray(codingsNode.Coding as Record<string, unknown>[])) {
    const codeGuid = attr(coding, 'codeGUID');
    if (!codeGuid) continue;

    for (const sel of toArray(coding.TextSelection as Record<string, unknown>[])) {
      const source = byGuid.get(attr(sel, 'sourceGUID') ?? '');
      if (!source) continue;

      source.selections.push({
        guid: attr(sel, 'guid') ?? '',
        startPosition: parseInt(attr(sel, 'startPosition') ?? '0', 10) || 0,
        endPosition: parseInt(attr(sel, 'endPosition') ?? '0', 10) || 0,
        codeGuids: [codeGuid],
      });
    }
  }
}

export function parseQdpxProject(xml: string): ParsedProject {
  const parser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: '@_',
    isArray: (name) => REPEATABLE.includes(name),
    // Keep transcript text and attributes as written. Without these a source
    // whose content is "123" would come back as the number 123.
    parseTagValue: false,
    parseAttributeValue: false,
    processEntities: false, // no external entity expansion (XXE)
    htmlEntities: false,
  });

  const parsed = parser.parse(xml) as Record<string, Record<string, unknown>>;
  const project = parsed.Project;
  if (!project) {
    throw new Error('Invalid QDPX: no Project element found');
  }

  const codeBook = project.CodeBook as Record<string, unknown> | undefined;
  const codesWrapper = codeBook?.Codes as Record<string, unknown> | undefined;
  // Conformant files wrap codes in <Codes>; older QualCanvas exports hung them
  // straight off <CodeBook>. Accept either.
  const codeNodes = codesWrapper
    ? toArray(codesWrapper.Code as Record<string, unknown>[])
    : toArray(codeBook?.Code as Record<string, unknown>[]);
  const codes = codeNodes.map(parseCode);

  const sourcesNode = project.Sources as Record<string, unknown> | undefined;
  const sources = toArray(sourcesNode?.TextSource as Record<string, unknown>[]).map(parseTextSource);
  applyLegacyCodings(project, sources);

  return {
    name: attr(project, 'name') ?? 'Imported project',
    codes,
    totalCodes: countCodes(codes),
    sources,
    unsupported: {
      ...countUnsupported(project, sourcesNode),
      uncodedSelections: sources.reduce(
        (n, s) => n + s.selections.filter((sel) => sel.codeGuids.length === 0).length,
        0,
      ),
    },
  };
}

function countChildren(parent: Record<string, unknown> | undefined, child: string): number {
  if (!parent) return 0;
  return toArray(parent[child] as unknown[]).length;
}

function countUnsupported(
  project: Record<string, unknown>,
  sourcesNode: Record<string, unknown> | undefined,
): UnsupportedCounts {
  const group = (name: string) => project[name] as Record<string, unknown> | undefined;

  return {
    variables: countChildren(group('Variables'), 'Variable'),
    cases: countChildren(group('Cases'), 'Case'),
    notes: countChildren(group('Notes'), 'Note'),
    sets: countChildren(group('Sets'), 'Set'),
    graphs: countChildren(group('Graphs'), 'Graph'),
    links: countChildren(group('Links'), 'Link'),
    pictureSources: countChildren(sourcesNode, 'PictureSource'),
    pdfSources: countChildren(sourcesNode, 'PDFSource'),
    audioSources: countChildren(sourcesNode, 'AudioSource'),
    videoSources: countChildren(sourcesNode, 'VideoSource'),
    uncodedSelections: 0, // filled in by the caller, which has the parsed sources
  };
}

// ─── Serialization ───

/**
 * QualCanvas stores CUIDs, but GUIDType in the schema is a UUID pattern and
 * stricter importers reject anything else. Derive a stable RFC-4122-shaped v4
 * GUID from the internal id so the same record always exports as the same GUID
 * (and so a round-trip through another tool can still be reconciled).
 */
export function toGuid(id: string): string {
  const h = createHash('sha256').update(id).digest('hex');
  const variant = ((parseInt(h.slice(16, 17), 16) & 0x3) | 0x8).toString(16);
  return [h.slice(0, 8), h.slice(8, 12), `4${h.slice(13, 16)}`, `${variant}${h.slice(17, 20)}`, h.slice(20, 32)].join(
    '-',
  );
}

function escapeXml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

export interface ExportCode {
  id: string;
  text: string;
  color?: string | null;
  children: ExportCode[];
}

export interface ExportSource {
  id: string;
  title: string;
  content: string;
}

export interface ExportCoding {
  id: string;
  transcriptId: string;
  questionId: string;
  startOffset: number;
  endOffset: number;
}

export interface ExportProject {
  name: string;
  createdAt: Date;
  codes: ExportCode[];
  sources: ExportSource[];
  codings: ExportCoding[];
}

/** Colour must match RGBType (#rgb or #rrggbb) or be omitted. */
function colorAttr(color?: string | null): string {
  return color && /^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/.test(color) ? ` color="${color}"` : '';
}

function codeXml(code: ExportCode, indent: string): string {
  const open = `${indent}<Code guid="${toGuid(code.id)}" name="${escapeXml(code.text)}" isCodable="true"${colorAttr(code.color)}`;
  if (code.children.length === 0) return `${open} />`;

  const children = code.children.map((c) => codeXml(c, `${indent}  `)).join('\n');
  return `${open}>\n${children}\n${indent}</Code>`;
}

function sourceXml(source: ExportSource, codings: ExportCoding[], indent: string): string {
  // Several codes may mark the same span. Other tools represent that as one
  // PlainTextSelection carrying several Coding children, so group by range
  // rather than emitting a duplicate selection per code.
  const byRange = new Map<string, ExportCoding[]>();
  for (const c of codings) {
    const key = `${c.startOffset}:${c.endOffset}`;
    const list = byRange.get(key);
    if (list) list.push(c);
    else byRange.set(key, [c]);
  }

  const selections = [...byRange.values()]
    .map((group) => {
      const first = group[0];
      const codingXml = group
        .map(
          (c) => `${indent}    <Coding guid="${toGuid(`${c.id}:coding`)}">
${indent}      <CodeRef targetGUID="${toGuid(c.questionId)}" />
${indent}    </Coding>`,
        )
        .join('\n');

      return `${indent}  <PlainTextSelection guid="${toGuid(first.id)}" startPosition="${first.startOffset}" endPosition="${first.endOffset}">
${codingXml}
${indent}  </PlainTextSelection>`;
    })
    .join('\n');

  return [
    `${indent}<TextSource guid="${toGuid(source.id)}" name="${escapeXml(source.title)}">`,
    `${indent}  <PlainTextContent>${escapeXml(source.content)}</PlainTextContent>`,
    selections,
    `${indent}</TextSource>`,
  ]
    .filter((line) => line !== '')
    .join('\n');
}

/**
 * Serialize a project to QDA-XML v1.0. Element order follows ProjectType's
 * xsd:sequence (Users, CodeBook, ..., Sources), which is significant: a
 * validating importer rejects out-of-order children.
 */
export function buildQdpxXml(project: ExportProject): string {
  const codingsBySource = new Map<string, ExportCoding[]>();
  for (const coding of project.codings) {
    const list = codingsBySource.get(coding.transcriptId);
    if (list) list.push(coding);
    else codingsBySource.set(coding.transcriptId, [coding]);
  }

  const codes = project.codes.map((c) => codeXml(c, '      ')).join('\n');
  const sources = project.sources.map((s) => sourceXml(s, codingsBySource.get(s.id) ?? [], '    ')).join('\n');

  return `<?xml version="1.0" encoding="utf-8"?>
<Project name="${escapeXml(project.name)}" origin="QualCanvas" creationDateTime="${project.createdAt.toISOString()}" xmlns="urn:QDA-XML:project:1.0">
  <CodeBook>
    <Codes>
${codes}
    </Codes>
  </CodeBook>
  <Sources>
${sources}
  </Sources>
</Project>
`;
}
