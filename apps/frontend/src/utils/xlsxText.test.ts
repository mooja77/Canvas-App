import { describe, it, expect } from 'vitest';
import { readXlsxRecords, recordsToCsv, XlsxUnreadableError } from './xlsxText';
import { parseTranscriptFile } from './transcriptFiles';

/**
 * A real .xlsx is built here from its parts (zip + XML) so the fixture is
 * readable: what each cell claims to hold is visible in the test, and the
 * archive goes through the same deflate path Excel's own files do.
 */
const enc = new TextEncoder();

function crc32(bytes: Uint8Array): number {
  let c = ~0;
  for (let i = 0; i < bytes.length; i++) {
    c ^= bytes[i];
    for (let k = 0; k < 8; k++) c = (c >>> 1) ^ (0xedb88320 & -(c & 1));
  }
  return ~c >>> 0;
}

async function deflateRaw(bytes: Uint8Array): Promise<Uint8Array> {
  const stream = new Response(bytes.slice().buffer).body!.pipeThrough(new CompressionStream('deflate-raw'));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

/** Minimal zip writer: local headers, central directory, end record. */
async function zip(files: Record<string, string>, { store = false } = {}): Promise<ArrayBuffer> {
  const locals: Uint8Array[] = [];
  const centrals: Uint8Array[] = [];
  let offset = 0;
  for (const [name, text] of Object.entries(files)) {
    const nameBytes = enc.encode(name);
    const raw = enc.encode(text);
    const data = store ? raw : await deflateRaw(raw);
    const method = store ? 0 : 8;
    const crc = crc32(raw);
    const local = new Uint8Array(30 + nameBytes.length + data.length);
    const lv = new DataView(local.buffer);
    lv.setUint32(0, 0x04034b50, true);
    lv.setUint16(4, 20, true);
    lv.setUint16(8, method, true);
    lv.setUint32(14, crc, true);
    lv.setUint32(18, data.length, true);
    lv.setUint32(22, raw.length, true);
    lv.setUint16(26, nameBytes.length, true);
    local.set(nameBytes, 30);
    local.set(data, 30 + nameBytes.length);
    locals.push(local);

    const central = new Uint8Array(46 + nameBytes.length);
    const cv = new DataView(central.buffer);
    cv.setUint32(0, 0x02014b50, true);
    cv.setUint16(4, 20, true);
    cv.setUint16(6, 20, true);
    cv.setUint16(10, method, true);
    cv.setUint32(16, crc, true);
    cv.setUint32(20, data.length, true);
    cv.setUint32(24, raw.length, true);
    cv.setUint16(28, nameBytes.length, true);
    cv.setUint32(42, offset, true);
    central.set(nameBytes, 46);
    centrals.push(central);
    offset += local.length;
  }
  const cdSize = centrals.reduce((n, c) => n + c.length, 0);
  const eocd = new Uint8Array(22);
  const ev = new DataView(eocd.buffer);
  ev.setUint32(0, 0x06054b50, true);
  ev.setUint16(8, centrals.length, true);
  ev.setUint16(10, centrals.length, true);
  ev.setUint32(12, cdSize, true);
  ev.setUint32(16, offset, true);
  const out = new Uint8Array(offset + cdSize + 22);
  let p = 0;
  for (const part of [...locals, ...centrals, eocd]) {
    out.set(part, p);
    p += part.length;
  }
  return out.buffer;
}

const WORKBOOK = `<?xml version="1.0" encoding="UTF-8"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <sheets><sheet name="Responses" sheetId="1" r:id="rId1"/><sheet name="Notes" sheetId="2" r:id="rId2"/></sheets>
</workbook>`;
const RELS = `<?xml version="1.0" encoding="UTF-8"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet2.xml"/>
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>
</Relationships>`;

function sharedStrings(strings: string[]): string {
  const items = strings
    .map((s) =>
      s.includes('|')
        ? s
            .split('|')
            .map((run) => `<r><t xml:space="preserve">${run}</t></r>`)
            .join('')
        : `<t xml:space="preserve">${s}</t>`,
    )
    .map((inner) => `<si>${inner}</si>`)
    .join('');
  return `<?xml version="1.0" encoding="UTF-8"?><sst xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" count="${strings.length}" uniqueCount="${strings.length}">${items}</sst>`;
}

function sheet(rows: string[]): string {
  return `<?xml version="1.0" encoding="UTF-8"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData>${rows.join('')}</sheetData></worksheet>`;
}

/** An Excel-style two-column sheet: participant in A, transcript in B, with a header. */
async function interviewsXlsx(): Promise<ArrayBuffer> {
  // Index 3 is a rich-text string (two runs) as Excel writes when part of a
  // cell is bold; the runs must be concatenated, not dropped.
  const strings = [
    'Participant',
    'Transcript',
    'P1',
    'I found the first week |"fine", mostly.',
    'P2',
    'It was 6" of rain and nobody said a thing.',
  ];
  return zip({
    'xl/workbook.xml': WORKBOOK,
    'xl/_rels/workbook.xml.rels': RELS,
    'xl/sharedStrings.xml': sharedStrings(strings),
    'xl/worksheets/sheet1.xml': sheet([
      '<row r="1"><c r="A1" t="s"><v>0</v></c><c r="B1" t="s"><v>1</v></c></row>',
      '<row r="2"><c r="A2" t="s"><v>2</v></c><c r="B2" t="s"><v>3</v></c></row>',
      // An empty styled row Excel leaves behind after a deleted line.
      '<row r="3"><c r="A3" s="1"/><c r="B3" s="1"/></row>',
      '<row r="4"><c r="A4" t="s"><v>4</v></c><c r="B4" t="s"><v>5</v></c></row>',
    ]),
    'xl/worksheets/sheet2.xml': sheet([
      '<row r="1"><c r="A1" t="inlineStr"><is><t>should not be read</t></is></c></row>',
    ]),
  });
}

describe('readXlsxRecords', () => {
  it('reads the first sheet by workbook order, resolving shared and rich-text strings', async () => {
    const records = await readXlsxRecords(await interviewsXlsx());
    expect(records).toEqual([
      ['Participant', 'Transcript'],
      ['P1', 'I found the first week "fine", mostly.'],
      ['P2', 'It was 6" of rain and nobody said a thing.'],
    ]);
  });

  it('handles inline strings, numbers, booleans and gaps in a row, and stored (uncompressed) entries', async () => {
    const buf = await zip(
      {
        'xl/worksheets/sheet1.xml': sheet([
          '<row r="1"><c r="A1" t="inlineStr"><is><t>Q1</t></is></c><c r="C1"><v>42</v></c><c r="D1" t="b"><v>1</v></c><c r="E1" t="str"><f>A1&amp;"x"</f><v>Q1x</v></c></row>',
        ]),
      },
      { store: true },
    );
    expect(await readXlsxRecords(buf)).toEqual([['Q1', '', '42', 'TRUE', 'Q1x']]);
  });

  it('refuses a password-protected workbook with a message a researcher can act on', async () => {
    const buf = await zip({ EncryptionInfo: 'x', EncryptedPackage: 'y' });
    await expect(readXlsxRecords(buf)).rejects.toThrow(XlsxUnreadableError);
    await expect(readXlsxRecords(buf)).rejects.toThrow(/password/);
  });

  it('refuses a file that is not a zip', async () => {
    const notZip = enc.encode('Participant,Transcript\nP1,hello').buffer;
    await expect(readXlsxRecords(notZip)).rejects.toThrow(XlsxUnreadableError);
  });
});

describe('xlsx through the transcript parser', () => {
  it('yields one transcript per row with the header dropped, exactly like the CSV path', async () => {
    const records = await readXlsxRecords(await interviewsXlsx());
    const entries = parseTranscriptFile('interviews.csv', recordsToCsv(records));
    expect(entries).toEqual([
      { title: 'P1', content: 'I found the first week "fine", mostly.' },
      { title: 'P2', content: 'It was 6" of rain and nobody said a thing.' },
    ]);
  });

  it('keeps a response that starts with = or - intact (no formula neutralisation on import)', () => {
    const csv = recordsToCsv([
      ['Participant', 'Transcript'],
      ['P3', '=to be honest it was fine'],
      ['P4', '-nothing to add'],
    ]);
    const entries = parseTranscriptFile('survey.csv', csv);
    expect(entries.map((e) => e.content)).toEqual(['=to be honest it was fine', '-nothing to add']);
  });
});
