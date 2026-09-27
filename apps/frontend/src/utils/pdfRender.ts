/**
 * Render PDF pages for the region-coding screen.
 *
 * Uses the pdf.js build that already ships inside `unpdf` (the transcript
 * importer's PDF reader), imported lazily so it never enters the canvas bundle.
 */

// Only the handful of pdf.js members we call; unpdf's own types are loose.
interface PdfPageLike {
  getViewport(opts: { scale: number }): { width: number; height: number };
  render(opts: { canvasContext: CanvasRenderingContext2D; viewport: unknown; canvas?: HTMLCanvasElement }): {
    promise: Promise<void>;
  };
}
export interface PdfDocLike {
  numPages: number;
  getPage(n: number): Promise<PdfPageLike>;
  destroy?: () => Promise<void>;
}

export async function openPdf(data: ArrayBuffer): Promise<PdfDocLike> {
  const { getDocumentProxy } = await import('unpdf');
  return (await getDocumentProxy(new Uint8Array(data))) as unknown as PdfDocLike;
}

/** Number of pages, or null when the file cannot be read as a PDF. */
export async function countPdfPages(data: ArrayBuffer): Promise<number | null> {
  try {
    const pdf = await openPdf(data);
    const n = pdf.numPages;
    await pdf.destroy?.().catch(() => undefined);
    return n;
  } catch {
    return null;
  }
}

/** Draw page `pageNumber` into `canvas`, fitted to `targetWidth` CSS pixels. */
export async function renderPdfPage(
  pdf: PdfDocLike,
  pageNumber: number,
  canvas: HTMLCanvasElement,
  targetWidth: number,
): Promise<{ width: number; height: number }> {
  const page = await pdf.getPage(pageNumber);
  const base = page.getViewport({ scale: 1 });
  const ratio = typeof window !== 'undefined' ? Math.min(window.devicePixelRatio || 1, 2) : 1;
  const scale = (Math.max(targetWidth, 200) / base.width) * ratio;
  const viewport = page.getViewport({ scale });
  canvas.width = Math.floor(viewport.width);
  canvas.height = Math.floor(viewport.height);
  canvas.style.width = '100%';
  canvas.style.height = 'auto';
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas 2D context unavailable');
  await page.render({ canvasContext: ctx, viewport, canvas }).promise;
  return { width: viewport.width / ratio, height: viewport.height / ratio };
}
