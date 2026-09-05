import { describe, it, expect } from 'vitest';
import { extractPdfText, normalizePdfText, PdfHasNoTextLayerError, PdfUnreadableError } from './pdfText';

/**
 * Built here rather than committed as a binary so the fixture is readable and
 * reviewable: a reader can see exactly what text the PDF claims to contain.
 */
function buildPdf(objects: string[]): ArrayBuffer {
  let pdf = '%PDF-1.4\n';
  const offsets: number[] = [];
  objects.forEach((o, i) => {
    offsets.push(pdf.length);
    pdf += `${i + 1} 0 obj\n${o}\nendobj\n`;
  });
  const xref = pdf.length;
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  for (const off of offsets) pdf += `${String(off).padStart(10, '0')} 00000 n \n`;
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;

  const bytes = new Uint8Array(pdf.length);
  for (let i = 0; i < pdf.length; i++) bytes[i] = pdf.charCodeAt(i) & 0xff;
  return bytes.buffer;
}

function textPdf(lines: string[]): ArrayBuffer {
  const esc = (s: string) => s.replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)');
  const body = lines.map((l) => `(${esc(l)}) Tj T*`).join('\n');
  const stream = `BT /F1 12 Tf 18 TL 56 760 Td\n${body}\nET`;
  return buildPdf([
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 5 0 R >> >> /Contents 4 0 R >>',
    `<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`,
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
  ]);
}

/** A valid page that draws no text: what a scan or photographed page looks like. */
function scannedPdf(): ArrayBuffer {
  const stream = 'q 1 0 0 1 0 0 cm Q';
  return buildPdf([
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R >>',
    `<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`,
  ]);
}

describe('normalizePdfText', () => {
  it('strips the trailing spaces page geometry leaves behind', () => {
    expect(normalizePdfText('P1: yes   \nP2: no\t\n')).toBe('P1: yes\nP2: no');
  });

  it('collapses page padding to a single blank line', () => {
    expect(normalizePdfText('one\n\n\n\n\ntwo')).toBe('one\n\ntwo');
  });

  it('leaves a deliberate single blank line alone', () => {
    expect(normalizePdfText('one\n\ntwo')).toBe('one\n\ntwo');
  });
});

describe('extractPdfText', () => {
  it('reads an interview transcript, keeping speakers, quotes and line breaks', async () => {
    const text = await extractPdfText(
      textPdf([
        'Interviewer: How did you find the first week?',
        'P1: Honestly? It was "fine", mostly.',
        'I did not know who to ask when something went wrong.',
        'Interviewer: And after that?',
      ]),
    );

    expect(text).toContain('Interviewer: How did you find the first week?');
    expect(text).toContain('"fine"');
    // Each line drawn on the page stays its own line, so a coder can see turns.
    expect(text.split('\n')).toHaveLength(4);
  });

  it('refuses a scan with an explanation the researcher can act on', async () => {
    // The failure that matters: without this the import would succeed and
    // create an empty transcript, consuming a plan slot and telling them
    // nothing about why the page they can see is not there.
    await expect(extractPdfText(scannedPdf())).rejects.toThrow(PdfHasNoTextLayerError);
    await expect(extractPdfText(scannedPdf())).rejects.toThrow(/OCR/);
  });

  it('reports an unreadable file rather than throwing a parser error at the user', async () => {
    const notAPdf = new TextEncoder().encode('This is a plain text file, not a PDF at all.').buffer;
    await expect(extractPdfText(notAPdf)).rejects.toThrow(PdfUnreadableError);
  });
});
