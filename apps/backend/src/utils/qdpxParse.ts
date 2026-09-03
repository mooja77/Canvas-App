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

export interface ParsedCoding {
  codeGuid: string;
  /** GUID of the <User> that made this coding, per CodingType@creatingUser. */
  creatingUser?: string;
}

export interface ParsedSelection {
  guid: string;
  startPosition: number;
  endPosition: number;
  /** Code GUIDs only, in the same order as `codings`. */
  codeGuids: string[];
  /** Same references as `codeGuids`, carrying the coder attribution as well. */
  codings: ParsedCoding[];
}

export interface ParsedUser {
  guid: string;
  name: string;
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
  /**
   * Selections whose startPosition/endPosition is not a non-negative integer
   * ("abc", "2.9", "-1"). Skipped rather than coerced: parseInt used to turn
   * "abc" into 0 and fabricate a coding at the top of the source.
   */
  invalidSelections: number;
}

export interface ParsedProject {
  name: string;
  codes: ParsedCode[];
  totalCodes: number;
  sources: ParsedSource[];
  /** <Users> declared by the exporting tool, keyed by GUID. */
  users: ParsedUser[];
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
  invalidSelections: ['selection with an unreadable text range', 'selections with unreadable text ranges'],
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
const REPEATABLE = ['Code', 'TextSource', 'PlainTextSelection', 'Coding', 'CodeRef', 'User'];

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
      return decodeCodePoint(parseInt(body.slice(2), 16), match);
    }
    if (body.startsWith('#')) {
      return decodeCodePoint(parseInt(body.slice(1), 10), match);
    }
    return NAMED_ENTITIES[body] ?? match;
  });
}

/**
 * A numeric character reference that names nothing - above U+10FFFF, or a
 * surrogate half - is left as the literal entity text. String.fromCodePoint
 * throws RangeError on both, and that raw message used to surface as the 400
 * for the whole import.
 */
function decodeCodePoint(code: number, original: string): string {
  const isScalarValue = Number.isInteger(code) && code >= 0 && code <= 0x10ffff && !(code >= 0xd800 && code <= 0xdfff);
  return isScalarValue ? String.fromCodePoint(code) : original;
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

/** Tallies that accumulate across one parse and end up in `unsupported`. */
interface ParseTally {
  invalidSelections: number;
}

/**
 * Read a selection offset. The schema types startPosition/endPosition as
 * integers; anything else ("abc", "2.9", "-1", missing) is null so the caller
 * skips the selection. Number() rather than parseInt: parseInt("2.9") is 2 and
 * parseInt("abc") is NaN-then-0, which silently moved or fabricated codings.
 * Number("1e1") is 10 - an integer, and accepted as one.
 */
function parseOffset(raw: string | undefined): number | null {
  if (raw === undefined || raw.trim() === '') return null;
  const n = Number(raw);
  return Number.isInteger(n) && n >= 0 ? n : null;
}

/** Both offsets, or null (and a tally mark) if either is unreadable. */
function parseOffsets(node: Record<string, unknown>, tally: ParseTally): { start: number; end: number } | null {
  const start = parseOffset(attr(node, 'startPosition'));
  const end = parseOffset(attr(node, 'endPosition'));
  if (start === null || end === null) {
    tally.invalidSelections++;
    return null;
  }
  return { start, end };
}

function parseSelection(node: Record<string, unknown>, tally: ParseTally): ParsedSelection | null {
  const offsets = parseOffsets(node, tally);
  if (!offsets) return null;

  const codings: ParsedCoding[] = [];
  for (const coding of toArray(node.Coding as Record<string, unknown>[])) {
    // CodingType@creatingUser names the researcher who applied the code. It is
    // the only attribution the standard carries, and discarding it is what made
    // a multi-coder project unarchivable.
    const creatingUser = attr(coding, 'creatingUser');
    for (const ref of toArray(coding.CodeRef as Record<string, unknown>[])) {
      const target = attr(ref, 'targetGUID');
      if (target) codings.push({ codeGuid: target, creatingUser });
    }
  }

  return {
    guid: attr(node, 'guid') ?? '',
    startPosition: offsets.start,
    endPosition: offsets.end,
    codeGuids: codings.map((c) => c.codeGuid),
    codings,
  };
}

function parseTextSource(node: Record<string, unknown>, tally: ParseTally): ParsedSource {
  return {
    guid: attr(node, 'guid') ?? '',
    name: attr(node, 'name') ?? 'Untitled source',
    // Spec puts the text in a child element. Older QualCanvas exports put it in
    // a plainTextContent attribute, so fall back to that.
    plainText: childText(node, 'PlainTextContent') ?? attr(node, 'plainTextContent') ?? '',
    plainTextPath: attr(node, 'plainTextPath'),
    selections: toArray(node.PlainTextSelection as Record<string, unknown>[])
      .map((sel) => parseSelection(sel, tally))
      .filter((sel): sel is ParsedSelection => sel !== null),
  };
}

/**
 * Older QualCanvas exports carried a top-level <Codings> block, with each
 * <Coding codeGUID> holding <TextSelection sourceGUID>. Fold those onto the
 * sources they reference so the rest of the pipeline sees one shape.
 */
function applyLegacyCodings(project: Record<string, unknown>, sources: ParsedSource[], tally: ParseTally): void {
  const codingsNode = project.Codings as Record<string, unknown> | undefined;
  if (!codingsNode) return;

  const byGuid = new Map(sources.map((s) => [s.guid, s]));

  for (const coding of toArray(codingsNode.Coding as Record<string, unknown>[])) {
    const codeGuid = attr(coding, 'codeGUID');
    if (!codeGuid) continue;

    for (const sel of toArray(coding.TextSelection as Record<string, unknown>[])) {
      const source = byGuid.get(attr(sel, 'sourceGUID') ?? '');
      if (!source) continue;

      const offsets = parseOffsets(sel, tally);
      if (!offsets) continue;

      const creatingUser = attr(coding, 'creatingUser');
      source.selections.push({
        guid: attr(sel, 'guid') ?? '',
        startPosition: offsets.start,
        endPosition: offsets.end,
        codeGuids: [codeGuid],
        codings: [{ codeGuid, creatingUser }],
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
    // fast-xml-parser trims text nodes by default, which silently shortened
    // every source: a transcript stored with leading/trailing whitespace came
    // back shorter while its codings kept their original offsets, so every
    // coding in that source slid onto different words. Nothing detected it,
    // because the importer recomputes codedText from the shifted text and the
    // content.slice(start,end) === codedText invariant still held on the
    // corrupted row. QualCanvas could not read back its own valid export.
    trimValues: false,
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

  const tally: ParseTally = { invalidSelections: 0 };
  const sourcesNode = project.Sources as Record<string, unknown> | undefined;
  const sources = toArray(sourcesNode?.TextSource as Record<string, unknown>[]).map((s) => parseTextSource(s, tally));
  applyLegacyCodings(project, sources, tally);

  const usersNode = project.Users as Record<string, unknown> | undefined;
  const users = toArray(usersNode?.User as Record<string, unknown>[])
    .map((u) => ({ guid: attr(u, 'guid') ?? '', name: attr(u, 'name') ?? '' }))
    .filter((u) => u.guid !== '');

  return {
    name: attr(project, 'name') ?? 'Imported project',
    codes,
    totalCodes: countCodes(codes),
    sources,
    users,
    unsupported: {
      ...countUnsupported(project, sourcesNode),
      uncodedSelections: sources.reduce(
        (n, s) => n + s.selections.filter((sel) => sel.codeGuids.length === 0).length,
        0,
      ),
      invalidSelections: tally.invalidSelections,
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
    invalidSelections: 0, // likewise, tallied while the sources were parsed
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

/**
 * Characters XML 1.0 forbids outright. Char ::= #x9 | #xA | #xD |
 * [#x20-#xD7FF] | [#xE000-#xFFFD] | [#x10000-#x10FFFF] (XML 1.0 §2.2), and a
 * character reference must itself match Char (§4.1), so `&#11;` is illegal too
 * — there is no way to represent these in a conformant XML 1.0 document.
 *
 * Matches: C0 controls other than tab/LF/CR, the two non-characters U+FFFE and
 * U+FFFF, and unpaired surrogates (a lone half is not a character at all).
 */
const XML_ILLEGAL =
  /[\u0000-\u0008\u000B\u000C\u000E-\u001F\uFFFE\uFFFF]|[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/g;

/** How many XML-illegal code units a string contains. */
export function countXmlIllegalChars(str: string): number {
  return str.match(XML_ILLEGAL)?.length ?? 0;
}

/**
 * Replace characters XML 1.0 cannot carry with U+FFFD.
 *
 * Text pasted out of Word or a PDF really does contain U+000B, U+000C and
 * U+0001, and writing them raw produced a project.qde that no other QDA tool
 * could open — `xml.etree.ElementTree.parse` fails with "not well-formed
 * (invalid token)" while QualCanvas's own lenient parser read it back happily,
 * so the breakage was invisible from inside the product.
 *
 * U+FFFD is one UTF-16 code unit, exactly like every character it replaces, so
 * every startPosition/endPosition in the export still addresses the same span.
 * Silently deleting the characters would have slid every later coding.
 */
function sanitizeXmlText(str: string): string {
  return str.replace(XML_ILLEGAL, '\uFFFD');
}

function escapeXml(str: string): string {
  return (
    sanitizeXmlText(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&apos;')
      // XML 1.0 §2.11 REQUIRES a parser to normalise a literal CR (and CRLF) to a
      // single LF. A transcript authored in Word or on Windows therefore came
      // back two bytes shorter per line than it went in, sliding every coding
      // after the first newline. A numeric character reference is the only way
      // to round-trip a carriage return, because normalisation happens before
      // entity expansion.
      .replace(/\r/g, '&#13;')
  );
}

/**
 * Escape for an attribute value. XML 1.0 §3.3.3 makes a parser replace every
 * literal tab, LF and CR inside an attribute value with a space before the
 * application ever sees it, so a source title or code name containing one
 * comes back altered. Numeric character references survive that step.
 */
function escapeXmlAttr(str: string): string {
  return escapeXml(str).replace(/\t/g, '&#9;').replace(/\n/g, '&#10;');
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
  /** Researcher who applied the code, written out as CodingType@creatingUser. */
  coderUserId?: string | null;
}

export interface ExportUser {
  id: string;
  name: string;
}

export interface ExportProject {
  name: string;
  createdAt: Date;
  codes: ExportCode[];
  sources: ExportSource[];
  codings: ExportCoding[];
  /** Researchers referenced by the codings, written out as <Users>. */
  users?: ExportUser[];
  /**
   * Content the caller knows is NOT in this archive, already phrased for a
   * human ("2 memos", "1 case"). Written into the file so the researcher who
   * opens it later can see what the format could not carry.
   */
  omitted?: string[];
}

/** Colour must match RGBType (#rgb or #rrggbb) or be omitted. */
function colorAttr(color?: string | null): string {
  return color && /^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/.test(color) ? ` color="${color}"` : '';
}

function codeXml(code: ExportCode, indent: string): string {
  const open = `${indent}<Code guid="${toGuid(code.id)}" name="${escapeXmlAttr(code.text)}" isCodable="true"${colorAttr(code.color)}`;
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
          // creatingUser is the one place the standard records WHO coded a
          // passage. Without it a multi-coder project exports as anonymous and
          // the intercoder work cannot be archived or handed on.
          (c) => `${indent}    <Coding guid="${toGuid(`${c.id}:coding`)}"${
            c.coderUserId ? ` creatingUser="${toGuid(c.coderUserId)}"` : ''
          }>
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
    `${indent}<TextSource guid="${toGuid(source.id)}" name="${escapeXmlAttr(source.title)}">`,
    `${indent}  <PlainTextContent>${escapeXml(source.content)}</PlainTextContent>`,
    selections,
    `${indent}</TextSource>`,
  ]
    .filter((line) => line !== '')
    .join('\n');
}

/**
 * The offset convention. Nothing in REFI-QDA says whether startPosition counts
 * characters, bytes or UTF-16 code units, and the exported numbers are UTF-16
 * code-unit indices (JavaScript string indices). A reader that slices by code
 * point instead bleeds past the excerpt once the text contains an emoji or any
 * other astral character. Say so in the file rather than leaving it to be
 * discovered.
 */
const OFFSET_CONVENTION =
  'PlainTextSelection startPosition/endPosition are UTF-16 code-unit indices into ' +
  'PlainTextContent, zero-based, end-exclusive (endPosition is the first unit AFTER ' +
  'the excerpt). Astral characters such as emoji count as two units.';

/** XML-illegal code units across a code tree's names, recursively. */
function countIllegalInCodeNames(codes: ExportCode[]): number {
  return codes.reduce((n, c) => n + countXmlIllegalChars(c.text) + countIllegalInCodeNames(c.children), 0);
}

/** XML comments may not contain "--" or end with "-". */
function commentSafe(text: string): string {
  return text.replace(/-{2,}/g, '-').replace(/-$/, '');
}

export interface BuiltQdpxProject {
  xml: string;
  /** Everything this archive does not carry, phrased for a human. */
  notes: string[];
}

/**
 * Serialize a project to QDA-XML v1.0. Element order follows ProjectType's
 * xsd:sequence (Users, CodeBook, ..., Sources), which is significant: a
 * validating importer rejects out-of-order children.
 *
 * Returns the losses alongside the XML. The import path already goes to
 * trouble to disclose what it dropped; an export that only ever says
 * "exported successfully" reads as lossless and is not.
 */
export function buildQdpxProject(project: ExportProject): BuiltQdpxProject {
  const codingsBySource = new Map<string, ExportCoding[]>();
  for (const coding of project.codings) {
    const list = codingsBySource.get(coding.transcriptId);
    if (list) list.push(coding);
    else codingsBySource.set(coding.transcriptId, [coding]);
  }

  const codes = project.codes.map((c) => codeXml(c, '      ')).join('\n');
  const sources = project.sources.map((s) => sourceXml(s, codingsBySource.get(s.id) ?? [], '    ')).join('\n');

  const users = project.users ?? [];
  const usersXml =
    users.length === 0
      ? ''
      : `  <Users>
${users.map((u) => `    <User guid="${toGuid(u.id)}" name="${escapeXmlAttr(u.name)}" />`).join('\n')}
  </Users>
`;

  const omitted = project.omitted ?? [];
  // Every string escapeXml/escapeXmlAttr sanitises must be counted here, or
  // the disclosure under-reports: code names (nested) and user names were
  // sanitised but not counted, so an archive whose only control character sat
  // in a code name said "No content was dropped".
  const illegal =
    project.sources.reduce((n, s) => n + countXmlIllegalChars(s.content) + countXmlIllegalChars(s.title), 0) +
    countXmlIllegalChars(project.name) +
    countIllegalInCodeNames(project.codes) +
    users.reduce((n, u) => n + countXmlIllegalChars(u.name), 0);
  const substitution =
    illegal > 0
      ? `${illegal} character(s) that XML 1.0 cannot represent (control codes) replaced with U+FFFD; ` +
        'text offsets are unaffected'
      : null;

  const notes = [...omitted, ...(substitution ? [substitution] : [])];

  const disclosure = [
    'Exported by QualCanvas.',
    OFFSET_CONVENTION,
    omitted.length > 0 ? `NOT included in this archive: ${omitted.join('; ')}.` : 'No content was dropped on export.',
    ...(substitution ? [`Substitution: ${substitution}.`] : []),
  ]
    .map(commentSafe)
    .join('\n  ');

  const xml = `<?xml version="1.0" encoding="utf-8"?>
<!--
  ${disclosure}
-->
<Project name="${escapeXmlAttr(project.name)}" origin="QualCanvas" creationDateTime="${project.createdAt.toISOString()}" xmlns="urn:QDA-XML:project:1.0">
${usersXml}  <CodeBook>
    <Codes>
${codes}
    </Codes>
  </CodeBook>
  <Sources>
${sources}
  </Sources>
</Project>
`;

  return { xml, notes };
}

/** Convenience wrapper for callers that only want the document. */
export function buildQdpxXml(project: ExportProject): string {
  return buildQdpxProject(project).xml;
}
