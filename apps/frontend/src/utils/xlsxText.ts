/**
 * Read the first worksheet of an .xlsx file as rows of strings.
 *
 * Why this exists: survey platforms (Qualtrics, Microsoft Forms, SurveyMonkey)
 * and Excel users hand over .xlsx, and the CSV path already knows how to turn a
 * spreadsheet of open-ended answers into transcripts (header detection,
 * question-column labels, byte-order marks). Saving as CSV first was the only
 * route in. This module produces the same rows the CSV parser would see, so
 * everything downstream is shared and already tested.
 *
 * Why no dependency: an .xlsx is a zip of XML. The browser can inflate zip
 * entries natively (DecompressionStream 'deflate-raw', Chrome 80, Firefox 113,
 * Safari 16.4) and parse XML natively (DOMParser). The spreadsheet libraries
 * that do this are 300 KB to 1 MB and pull in Node polyfills under Vite. The
 * subset needed here, shared strings, inline strings, numbers and booleans
 * from one sheet, is small enough to own.
 *
 * What is deliberately not handled: formulas (their cached value is read, the
 * formula is not evaluated), dates (they arrive as Excel serial numbers, which
 * is what a CSV export of the same sheet would also give), merged cells,
 * and sheets other than the first. A password-protected workbook is refused
 * with a message rather than a parser error.
 */

export class XlsxUnreadableError extends Error {
  constructor(detail: string) {
    super(`This spreadsheet could not be read (${detail}).`);
    this.name = 'XlsxUnreadableError';
  }
}

// ─── zip ───

interface ZipEntry {
  name: string;
  method: number;
  compressedSize: number;
  offset: number;
}

function u16(view: DataView, at: number): number {
  return view.getUint16(at, true);
}
function u32(view: DataView, at: number): number {
  return view.getUint32(at, true);
}

/** Locate the central directory and list every entry in it. */
function listZipEntries(bytes: Uint8Array): ZipEntry[] {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  // End of central directory record: signature 0x06054b50, searched backwards
  // because a trailing comment of up to 64 KiB may follow it.
  let eocd = -1;
  for (let i = bytes.length - 22; i >= Math.max(0, bytes.length - 22 - 65535); i--) {
    if (u32(view, i) === 0x06054b50) {
      eocd = i;
      break;
    }
  }
  if (eocd < 0) throw new XlsxUnreadableError('not a zip archive');
  const count = u16(view, eocd + 10);
  let p = u32(view, eocd + 16);
  const entries: ZipEntry[] = [];
  const decoder = new TextDecoder();
  for (let i = 0; i < count; i++) {
    if (u32(view, p) !== 0x02014b50) throw new XlsxUnreadableError('damaged central directory');
    const method = u16(view, p + 10);
    const compressedSize = u32(view, p + 20);
    const nameLen = u16(view, p + 28);
    const extraLen = u16(view, p + 30);
    const commentLen = u16(view, p + 32);
    const offset = u32(view, p + 42);
    const name = decoder.decode(bytes.subarray(p + 46, p + 46 + nameLen));
    entries.push({ name, method, compressedSize, offset });
    p += 46 + nameLen + extraLen + commentLen;
  }
  return entries;
}

async function readZipEntry(bytes: Uint8Array, entry: ZipEntry): Promise<Uint8Array> {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  if (u32(view, entry.offset) !== 0x04034b50) throw new XlsxUnreadableError('damaged entry header');
  // The local header repeats name and extra lengths; the sizes it carries may
  // be zero (streamed writers), so the central directory's sizes are used.
  const nameLen = u16(view, entry.offset + 26);
  const extraLen = u16(view, entry.offset + 28);
  const start = entry.offset + 30 + nameLen + extraLen;
  const data = bytes.subarray(start, start + entry.compressedSize);
  if (entry.method === 0) return data;
  if (entry.method !== 8) throw new XlsxUnreadableError(`unsupported compression method ${entry.method}`);
  if (typeof DecompressionStream === 'undefined') {
    throw new XlsxUnreadableError('this browser cannot decompress the file; save it as CSV instead');
  }
  // Response, not Blob: a Uint8Array body gives a ReadableStream everywhere
  // this runs (browsers and Node), whereas jsdom's Blob has no stream().
  // slice() copies into a standalone ArrayBuffer, which Response accepts.
  const body = new Response(data.slice().buffer).body;
  if (!body) throw new XlsxUnreadableError('could not open the compressed entry');
  const stream = body.pipeThrough(new DecompressionStream('deflate-raw'));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

// ─── xlsx ───

function parseXml(text: string): Document {
  const doc = new DOMParser().parseFromString(text, 'application/xml');
  if (doc.getElementsByTagName('parsererror').length > 0)
    throw new XlsxUnreadableError('malformed XML inside the workbook');
  return doc;
}

/** Concatenate every <t> under a node: rich-text runs split one string into several. */
function textOf(node: Element): string {
  let out = '';
  const ts = node.getElementsByTagName('t');
  for (let i = 0; i < ts.length; i++) out += ts[i].textContent ?? '';
  return out;
}

/** "A" -> 0, "Z" -> 25, "AA" -> 26. */
function columnIndex(ref: string): number {
  let n = 0;
  for (let i = 0; i < ref.length; i++) {
    const c = ref.charCodeAt(i);
    if (c < 65 || c > 90) break;
    n = n * 26 + (c - 64);
  }
  return n - 1;
}

/** Resolve the first sheet's part name from the workbook and its relationships. */
function firstSheetPath(parts: Map<string, string>): string {
  const workbook = parts.get('xl/workbook.xml');
  const rels = parts.get('xl/_rels/workbook.xml.rels');
  if (workbook && rels) {
    const sheet = parseXml(workbook).getElementsByTagName('sheet')[0];
    const rid =
      sheet?.getAttribute('r:id') ??
      sheet?.getAttributeNS('http://schemas.openxmlformats.org/officeDocument/2006/relationships', 'id');
    if (rid) {
      const relationships = parseXml(rels).getElementsByTagName('Relationship');
      for (let i = 0; i < relationships.length; i++) {
        if (relationships[i].getAttribute('Id') === rid) {
          const target = relationships[i].getAttribute('Target') ?? '';
          return target.startsWith('/') ? target.slice(1) : `xl/${target}`;
        }
      }
    }
  }
  const fallback = [...parts.keys()].find((k) => /^xl\/worksheets\/sheet\d*\.xml$/.test(k));
  if (!fallback) throw new XlsxUnreadableError('no worksheet found');
  return fallback;
}

/**
 * Rows of the first worksheet, every cell as a string, blanks as ''. Trailing
 * empty cells are trimmed per row and wholly empty rows are dropped, which is
 * what a CSV export of the same sheet contains.
 */
export async function readXlsxRecords(data: ArrayBuffer): Promise<string[][]> {
  const bytes = new Uint8Array(data);
  const entries = listZipEntries(bytes);
  const wanted = new Set(['xl/workbook.xml', 'xl/_rels/workbook.xml.rels', 'xl/sharedStrings.xml']);
  if (entries.some((e) => e.name === 'EncryptionInfo' || e.name === 'EncryptedPackage')) {
    throw new XlsxUnreadableError('the workbook is password-protected; remove the password and try again');
  }
  const parts = new Map<string, string>();
  const decoder = new TextDecoder();
  for (const e of entries) {
    if (wanted.has(e.name) || /^xl\/worksheets\/sheet\d*\.xml$/.test(e.name)) {
      parts.set(e.name, decoder.decode(await readZipEntry(bytes, e)));
    }
  }
  if (!parts.has('xl/workbook.xml') && ![...parts.keys()].some((k) => k.startsWith('xl/worksheets/'))) {
    throw new XlsxUnreadableError('not an Excel workbook');
  }

  const shared: string[] = [];
  const sharedXml = parts.get('xl/sharedStrings.xml');
  if (sharedXml) {
    const items = parseXml(sharedXml).getElementsByTagName('si');
    for (let i = 0; i < items.length; i++) shared.push(textOf(items[i]));
  }

  const sheetPath = firstSheetPath(parts);
  const sheetXml = parts.get(sheetPath);
  if (!sheetXml) throw new XlsxUnreadableError(`worksheet ${sheetPath} is missing`);
  const rowsXml = parseXml(sheetXml).getElementsByTagName('row');

  const records: string[][] = [];
  for (let r = 0; r < rowsXml.length; r++) {
    const cells = rowsXml[r].getElementsByTagName('c');
    const row: string[] = [];
    for (let i = 0; i < cells.length; i++) {
      const c = cells[i];
      const col = columnIndex(c.getAttribute('r') ?? '');
      const type = c.getAttribute('t');
      let value = '';
      if (type === 's') {
        const idx = Number(c.getElementsByTagName('v')[0]?.textContent ?? '');
        value = shared[idx] ?? '';
      } else if (type === 'inlineStr') {
        value = textOf(c);
      } else if (type === 'b') {
        value = c.getElementsByTagName('v')[0]?.textContent === '1' ? 'TRUE' : 'FALSE';
      } else {
        // n (number), str (formula string result), d (ISO date), or untyped
        value = c.getElementsByTagName('v')[0]?.textContent ?? '';
      }
      if (col >= 0) {
        while (row.length < col) row.push('');
        row[col] = value;
      } else {
        row.push(value);
      }
    }
    while (row.length > 0 && row[row.length - 1] === '') row.pop();
    if (row.some((v) => v.trim() !== '')) records.push(row);
  }
  return records;
}

/**
 * Serialise rows as RFC 4180 text so the existing CSV transcript parser can
 * take over: header detection, question-column labels and the rest live
 * there and are already tested against real Qualtrics and Excel exports.
 * Every field is quoted and embedded quotes doubled; nothing else is altered,
 * so a response that starts with "=" or "-" survives the round trip intact.
 */
export function recordsToCsv(records: string[][]): string {
  return records.map((row) => row.map((v) => `"${v.replace(/"/g, '""')}"`).join(',')).join('\n');
}
