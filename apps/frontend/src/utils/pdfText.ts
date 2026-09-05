/**
 * Extract transcript text from a PDF.
 *
 * Why PDF at all: the activation funnel showed the product losing nearly half
 * its users between creating a project and adding a transcript, and PDF is the
 * format transcription services, ethics committees and supervisors hand people.
 * Until now the only route in for a PDF was copy and paste.
 *
 * A PDF carries no paragraphs, only positioned text runs, so what comes back is
 * one line per line drawn on the page. Blank lines between speaker turns are
 * lost. That is acceptable for coding, where offsets into the stored text are
 * what matter, and it is the same trade the .docx path already makes.
 */

/** A PDF with no text layer, i.e. a scan or a photograph of a page. */
export class PdfHasNoTextLayerError extends Error {
  constructor() {
    super(
      'This PDF has no selectable text, so it is probably a scan. ' +
        'Open it in a PDF reader and try to select a sentence: if you cannot, ' +
        'the file needs running through OCR before it can be coded.',
    );
    this.name = 'PdfHasNoTextLayerError';
  }
}

/** A PDF that is encrypted, corrupt, or not a PDF at all. */
export class PdfUnreadableError extends Error {
  constructor(detail: string) {
    super(`This PDF could not be read (${detail}).`);
    this.name = 'PdfUnreadableError';
  }
}

/**
 * Text is "absent" rather than merely sparse when there is nothing but
 * whitespace. A cover page with a single word is still a text layer, and
 * refusing it would be worse than importing it: the researcher can see what
 * they got and delete it.
 */
function hasNoTextLayer(text: string): boolean {
  return text.trim().length === 0;
}

/**
 * Normalise what the extractor returns into transcript text.
 *
 * Trailing spaces come from the page geometry rather than the writing, and a
 * run of blank lines is page padding, not the author's intent. Both are
 * flattened so the stored text reads like a transcript and the word counts
 * are not inflated by layout.
 */
export function normalizePdfText(raw: string): string {
  return raw
    .replace(/\r\n?/g, '\n')
    .split('\n')
    .map((line) => line.replace(/[ \t]+$/, ''))
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

/**
 * Read every page of `data` and return its text.
 *
 * unpdf is imported lazily, exactly as mammoth is on the .docx path, so the
 * parser only reaches a researcher who actually opens a PDF and never enters
 * the canvas bundle.
 */
export async function extractPdfText(data: ArrayBuffer): Promise<string> {
  let raw: string;
  try {
    const { extractText, getDocumentProxy } = await import('unpdf');
    const pdf = await getDocumentProxy(new Uint8Array(data));
    // mergePages returns the whole document as one string; the per-page array
    // shape is the other overload and is not what we ask for.
    const { text } = await extractText(pdf, { mergePages: true });
    raw = text;
  } catch (err) {
    throw new PdfUnreadableError(err instanceof Error ? err.message : 'unknown error');
  }

  const text = normalizePdfText(raw);
  // Checked after normalisation: a page of nothing but spaces is still a scan.
  if (hasNoTextLayer(text)) throw new PdfHasNoTextLayerError();
  return text;
}
