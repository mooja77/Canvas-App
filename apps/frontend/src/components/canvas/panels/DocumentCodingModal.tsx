import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import toast from 'react-hot-toast';
import type { CanvasDocument, CanvasQuestion, DocumentRegionCoding } from '@qualcanvas/shared';
import { canvasApi } from '../../../services/api';
import { useActiveCanvas, useCanvasStore, useIsViewer } from '../../../stores/canvasStore';
import { useEscapeToClose } from '../../../hooks/useEscapeToClose';
import { useFocusTrap } from '../../../hooks/useFocusTrap';
import { useCanvasPlan } from '../../../hooks/useCanvasPlan';
import ConfirmDialog from '../ConfirmDialog';
import { countPdfPages, openPdf, renderPdfPage, type PdfDocLike } from '../../../utils/pdfRender';
import { apiErrorMessage, formatBytes } from './featureScreenUtils';

/**
 * PDF / image region coding.
 *
 * Upload a PDF or image, draw a rectangle on a page (or type its position, for
 * keyboard users), and apply a code to it. Regions are listed per page and can
 * be re-coded, annotated, resized and deleted. Every call goes through the
 * canvas -> document -> region ownership chain on the server.
 */

type Region = DocumentRegionCoding & { codeMissing?: boolean; note?: string | null };
type Doc = CanvasDocument & { regionCount?: number };
type Box = { x: number; y: number; width: number; height: number };

const ACCEPTED = '.pdf,.png,.jpg,.jpeg,.gif,.webp,application/pdf,image/png,image/jpeg,image/gif,image/webp';
const MAX_MB = 20;
const round1 = (n: number) => Math.round(n * 10) / 10;
const clampBox = (b: Box): Box => {
  const x = Math.min(Math.max(b.x, 0), 99);
  const y = Math.min(Math.max(b.y, 0), 99);
  return {
    x: round1(x),
    y: round1(y),
    width: round1(Math.min(Math.max(b.width, 1), 100 - x)),
    height: round1(Math.min(Math.max(b.height, 1), 100 - y)),
  };
};

/** A labelled, obviously-fake sample page so a new user can try region coding without a file of their own. */
async function makeSamplePage(): Promise<File> {
  const canvas = document.createElement('canvas');
  canvas.width = 1000;
  canvas.height = 700;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas unavailable');
  ctx.fillStyle = '#fdfbf4';
  ctx.fillRect(0, 0, 1000, 700);
  ctx.fillStyle = '#1f2937';
  ctx.font = 'bold 34px sans-serif';
  ctx.fillText('SAMPLE — ward handover board (field photo)', 40, 60);
  ctx.font = '22px sans-serif';
  ctx.fillStyle = '#6b7280';
  ctx.fillText('Fictional example for trying region coding. Delete it when you are done.', 40, 95);
  const notes: [number, number, string, string][] = [
    [40, 140, '#fde68a', 'Bed 4: family asking again about discharge'],
    [520, 140, '#bfdbfe', 'Short-staffed nights all week'],
    [40, 380, '#fecaca', 'Handover cut to 10 min — agency nurse'],
    [520, 380, '#bbf7d0', 'Thank-you card from Bed 7 family'],
  ];
  for (const [x, y, colour, text] of notes) {
    ctx.fillStyle = colour;
    ctx.fillRect(x, y, 440, 200);
    ctx.fillStyle = '#111827';
    ctx.font = '26px sans-serif';
    const words = text.split(' ');
    let line = '';
    let ly = y + 50;
    for (const w of words) {
      if (ctx.measureText(`${line}${w} `).width > 400) {
        ctx.fillText(line, x + 20, ly);
        line = '';
        ly += 36;
      }
      line += `${w} `;
    }
    ctx.fillText(line, x + 20, ly);
  }
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/png'));
  if (!blob) throw new Error('Could not create the sample image');
  return new File([blob], 'Sample ward handover board.png', { type: 'image/png' });
}

export default function DocumentCodingModal({ onClose }: { onClose: () => void }) {
  const activeCanvas = useActiveCanvas();
  const canvasId = activeCanvas?.id ?? null;
  const questions: CanvasQuestion[] = useMemo(() => activeCanvas?.questions ?? [], [activeCanvas?.questions]);
  const addQuestion = useCanvasStore((s) => s.addQuestion);
  const isViewer = useIsViewer();
  const plan = useCanvasPlan();
  // Uploads are gated on the canvas OWNER's plan (server: checkFileUploadAccess).
  const uploadsAllowed = activeCanvas?.ownerPlan?.limits?.fileUploadEnabled ?? plan !== 'free';

  const dialogRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [confirm, setConfirm] = useState<{ kind: 'doc' | 'region'; id: string; label: string } | null>(null);
  useFocusTrap(dialogRef);
  useEscapeToClose(useCallback(() => (confirm ? undefined : onClose()), [confirm, onClose]));

  const [docs, setDocs] = useState<Doc[] | null>(null);
  const [docsError, setDocsError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [uploading, setUploading] = useState<{ name: string; pct: number } | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [announcement, setAnnouncement] = useState('');

  const loadDocs = useCallback(async () => {
    if (!canvasId) return;
    setDocsError(null);
    try {
      const res = await canvasApi.getDocuments(canvasId);
      const rows: Doc[] = res.data.data;
      setDocs(rows);
      setSelectedId((cur) => (cur && rows.some((d) => d.id === cur) ? cur : (rows[0]?.id ?? null)));
    } catch (err) {
      setDocsError(apiErrorMessage(err, 'Could not load documents.'));
    }
  }, [canvasId]);

  useEffect(() => {
    loadDocs();
  }, [loadDocs]);

  const upload = useCallback(
    async (file: File) => {
      if (!canvasId) return;
      setUploadError(null);
      if (file.size > MAX_MB * 1024 * 1024) {
        setUploadError(`${file.name} is ${formatBytes(file.size)}. The limit is ${MAX_MB} MB.`);
        return;
      }
      setUploading({ name: file.name, pct: 0 });
      try {
        const form = new FormData();
        form.append('file', file);
        form.append('title', file.name.replace(/\.[^.]+$/, ''));
        if (/\.pdf$/i.test(file.name) || file.type === 'application/pdf') {
          const pages = await countPdfPages(await file.arrayBuffer());
          if (pages === null) {
            setUploadError(`${file.name} could not be read as a PDF. Check it opens in a PDF viewer, then try again.`);
            setUploading(null);
            return;
          }
          form.append('pageCount', String(pages));
        }
        const res = await canvasApi.uploadDocument(canvasId, form, (pct) => setUploading({ name: file.name, pct }));
        const doc: Doc = { ...res.data.data, regionCount: 0 };
        setDocs((prev) => [...(prev ?? []), doc]);
        setSelectedId(doc.id);
        setAnnouncement(`${doc.title} uploaded. Choose a code, then draw a region on the page.`);
      } catch (err) {
        setUploadError(apiErrorMessage(err, 'Upload failed. Check your connection and try again.'));
      } finally {
        setUploading(null);
      }
    },
    [canvasId],
  );

  const trySample = useCallback(async () => {
    try {
      await upload(await makeSamplePage());
    } catch {
      setUploadError('Could not create the sample page in this browser.');
    }
  }, [upload]);

  const deleteDoc = useCallback(
    async (docId: string) => {
      if (!canvasId) return;
      try {
        await canvasApi.deleteDocument(canvasId, docId);
        setDocs((prev) => (prev ?? []).filter((d) => d.id !== docId));
        setSelectedId((cur) => (cur === docId ? null : cur));
        toast.success('Document deleted');
      } catch (err) {
        toast.error(apiErrorMessage(err, 'Could not delete the document.'));
      }
    },
    [canvasId],
  );

  const selected = docs?.find((d) => d.id === selectedId) ?? null;

  return createPortal(
    <div className="modal-backdrop fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-2 sm:p-4">
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="documents-title"
        aria-describedby="documents-intro"
        className="modal-content flex h-[92vh] w-full max-w-6xl flex-col rounded-2xl bg-white shadow-xl ring-1 ring-black/5 dark:bg-gray-800"
      >
        <div className="flex items-start justify-between border-b border-gray-200 px-5 py-3 dark:border-gray-700">
          <div>
            <h2 id="documents-title" className="text-base font-semibold text-gray-900 dark:text-gray-100">
              Documents &amp; images
            </h2>
            <p id="documents-intro" className="text-sm text-gray-500 dark:text-gray-400">
              Code regions of PDFs, photos, scanned field notes and diagrams with the same codebook as your transcripts.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-gray-700"
          >
            <svg
              className="h-5 w-5"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={1.5}
              stroke="currentColor"
              aria-hidden
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="flex min-h-0 flex-1 flex-col md:flex-row">
          {/* Document list */}
          <nav
            aria-label="Documents on this canvas"
            className="flex shrink-0 flex-col border-b border-gray-200 p-3 dark:border-gray-700 md:w-56 md:border-b-0 md:border-r"
          >
            {!isViewer && uploadsAllowed && (
              <>
                <button
                  type="button"
                  className="btn-primary mb-2 w-full px-3 py-1.5 text-sm"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={Boolean(uploading)}
                >
                  Upload PDF or image
                </button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept={ACCEPTED}
                  className="sr-only"
                  tabIndex={-1}
                  aria-hidden="true"
                  data-testid="document-file-input"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    e.target.value = '';
                    if (f) upload(f);
                  }}
                />
              </>
            )}
            {uploading && (
              <div className="mb-2 text-xs text-gray-600 dark:text-gray-300">
                <p>Uploading {uploading.name}…</p>
                <div
                  role="progressbar"
                  aria-label={`Uploading ${uploading.name}`}
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-valuenow={uploading.pct}
                  className="mt-1 h-1.5 rounded-full bg-gray-100 dark:bg-gray-700"
                >
                  <div className="h-1.5 rounded-full bg-indigo-500" style={{ width: `${uploading.pct}%` }} />
                </div>
              </div>
            )}
            {uploadError && (
              <p
                role="alert"
                className="mb-2 rounded bg-red-50 p-2 text-xs text-red-700 dark:bg-red-900/20 dark:text-red-300"
              >
                {uploadError}
              </p>
            )}
            {docsError ? (
              <p role="alert" className="text-xs text-red-700 dark:text-red-300">
                {docsError}{' '}
                <button type="button" className="underline" onClick={loadDocs}>
                  Try again
                </button>
              </p>
            ) : docs === null ? (
              <div className="h-20 animate-pulse rounded bg-gray-100 dark:bg-gray-700" aria-label="Loading documents" />
            ) : (
              <ul className="space-y-1 overflow-y-auto">
                {docs.map((d) => (
                  <li key={d.id} className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => setSelectedId(d.id)}
                      aria-current={d.id === selectedId ? 'true' : undefined}
                      className={`min-w-0 flex-1 rounded-lg px-2 py-1.5 text-left text-sm ${
                        d.id === selectedId
                          ? 'bg-indigo-50 text-indigo-800 dark:bg-indigo-900/30 dark:text-indigo-200'
                          : 'text-gray-700 hover:bg-gray-50 dark:text-gray-300 dark:hover:bg-gray-700/50'
                      }`}
                    >
                      <span className="block truncate font-medium">{d.title}</span>
                      <span className="block text-xs text-gray-500 dark:text-gray-400">
                        {d.docType === 'pdf' ? `PDF · ${d.pageCount} page${d.pageCount === 1 ? '' : 's'}` : 'Image'}
                      </span>
                    </button>
                    {!isViewer && (
                      <button
                        type="button"
                        className="rounded p-1 text-gray-400 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-900/20"
                        aria-label={`Delete ${d.title}`}
                        onClick={() => setConfirm({ kind: 'doc', id: d.id, label: d.title })}
                      >
                        <svg
                          className="h-4 w-4"
                          fill="none"
                          viewBox="0 0 24 24"
                          strokeWidth={1.5}
                          stroke="currentColor"
                          aria-hidden
                        >
                          <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
                        </svg>
                      </button>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </nav>

          {/* Main area */}
          <div className="min-h-0 min-w-0 flex-1 overflow-y-auto">
            {docs !== null && docs.length === 0 ? (
              <EmptyState
                canUpload={!isViewer && uploadsAllowed}
                isViewer={isViewer}
                planGate={!uploadsAllowed}
                onUpload={() => fileInputRef.current?.click()}
                onSample={trySample}
                busy={Boolean(uploading)}
              />
            ) : selected && canvasId ? (
              <DocumentWorkspace
                key={selected.id}
                canvasId={canvasId}
                doc={selected}
                questions={questions}
                readOnly={isViewer}
                onCreateCode={async (text) => (await addQuestion(text)).id}
                onRegionCountChange={(n) =>
                  setDocs((prev) => (prev ?? []).map((d) => (d.id === selected.id ? { ...d, regionCount: n } : d)))
                }
                onAnnounce={setAnnouncement}
                onRequestDeleteRegion={(id, label) => setConfirm({ kind: 'region', id, label })}
              />
            ) : null}
          </div>
        </div>
        <div aria-live="polite" className="sr-only">
          {announcement}
        </div>
      </div>
      {confirm && (
        <ConfirmDialog
          title={confirm.kind === 'doc' ? 'Delete document?' : 'Delete region?'}
          message={
            confirm.kind === 'doc'
              ? `“${confirm.label}” and every region coded on it will be deleted. This cannot be undone.`
              : `The region coded “${confirm.label}” will be deleted.`
          }
          onCancel={() => setConfirm(null)}
          onConfirm={async () => {
            const c = confirm;
            setConfirm(null);
            if (c.kind === 'doc') await deleteDoc(c.id);
            else window.dispatchEvent(new CustomEvent('qualcanvas:delete-region', { detail: { regionId: c.id } }));
          }}
        />
      )}
    </div>,
    document.body,
  );
}

function EmptyState({
  canUpload,
  isViewer,
  planGate,
  onUpload,
  onSample,
  busy,
}: {
  canUpload: boolean;
  isViewer: boolean;
  planGate: boolean;
  onUpload: () => void;
  onSample: () => void;
  busy: boolean;
}) {
  return (
    <div className="mx-auto max-w-lg p-8 text-center" data-testid="documents-empty">
      <h3 className="text-base font-semibold text-gray-900 dark:text-gray-100">No documents on this canvas yet</h3>
      <p className="mt-2 text-sm text-gray-600 dark:text-gray-300">
        Some of your data isn't text: photos from site visits, scanned diaries, policy PDFs, participants' drawings.
        Code regions of them with the same codes you use on interviews, so they count in your analysis too.
      </p>
      {isViewer ? (
        <p className="mt-4 text-sm text-gray-500">You have view-only access. The canvas owner can add documents.</p>
      ) : planGate ? (
        <p className="mt-4 text-sm text-gray-700 dark:text-gray-200" data-testid="documents-plan-gate">
          Uploading documents is included in the Student, Pro and Team plans.{' '}
          <a className="font-medium text-indigo-600 underline" href="/pricing">
            Compare plans
          </a>
        </p>
      ) : (
        <div className="mt-5 flex flex-wrap justify-center gap-2">
          <button type="button" className="btn-primary text-sm" onClick={onUpload} disabled={!canUpload || busy}>
            Upload a PDF or image
          </button>
          <button type="button" className="btn-secondary text-sm" onClick={onSample} disabled={!canUpload || busy}>
            Try it with a sample page
          </button>
        </div>
      )}
      <p className="mt-4 text-xs text-gray-500 dark:text-gray-400">PDF, PNG, JPEG, GIF or WebP, up to {MAX_MB} MB.</p>
    </div>
  );
}

function DocumentWorkspace({
  canvasId,
  doc,
  questions,
  readOnly,
  onCreateCode,
  onRegionCountChange,
  onAnnounce,
  onRequestDeleteRegion,
}: {
  canvasId: string;
  doc: Doc;
  questions: CanvasQuestion[];
  readOnly: boolean;
  onCreateCode: (text: string) => Promise<string>;
  onRegionCountChange: (n: number) => void;
  onAnnounce: (msg: string) => void;
  onRequestDeleteRegion: (id: string, label: string) => void;
}) {
  const [page, setPage] = useState(1);
  const [fileState, setFileState] = useState<'loading' | 'ready' | 'error'>('loading');
  const [fileError, setFileError] = useState('');
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const pdfRef = useRef<PdfDocLike | null>(null);
  const pdfCanvasRef = useRef<HTMLCanvasElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const [regions, setRegions] = useState<Region[] | null>(null);
  const [regionsError, setRegionsError] = useState<string | null>(null);
  const [codeId, setCodeId] = useState<string>('');
  const [newCodeText, setNewCodeText] = useState('');
  const [drawing, setDrawing] = useState<{ sx: number; sy: number; cx: number; cy: number } | null>(null);
  const [focusedRegion, setFocusedRegion] = useState<string | null>(null);
  const [kbBox, setKbBox] = useState<Box>({ x: 10, y: 10, width: 30, height: 20 });
  const [saving, setSaving] = useState(false);

  const codeById = useMemo(() => new Map(questions.map((q) => [q.id, q])), [questions]);
  useEffect(() => {
    if (!codeId && questions[0]) setCodeId(questions[0].id);
  }, [codeId, questions]);

  // Load the file once per document.
  useEffect(() => {
    let cancelled = false;
    let url: string | null = null;
    (async () => {
      setFileState('loading');
      try {
        const res = await canvasApi.getDocumentFile(canvasId, doc.id);
        const blob: Blob = res.data;
        if (cancelled) return;
        if (doc.docType === 'pdf') {
          pdfRef.current = await openPdf(await blob.arrayBuffer());
        } else {
          url = URL.createObjectURL(blob);
          setImageUrl(url);
        }
        if (!cancelled) setFileState('ready');
      } catch (err) {
        if (cancelled) return;
        let msg = 'Could not open this document.';
        const data = (err as { response?: { data?: unknown } })?.response?.data;
        if (data instanceof Blob) {
          try {
            msg = JSON.parse(await data.text()).error || msg;
          } catch {
            /* keep default */
          }
        }
        setFileError(msg);
        setFileState('error');
      }
    })();
    return () => {
      cancelled = true;
      if (url) URL.revokeObjectURL(url);
      pdfRef.current?.destroy?.().catch(() => undefined);
      pdfRef.current = null;
    };
  }, [canvasId, doc.id, doc.docType]);

  // Render the current PDF page.
  useEffect(() => {
    if (doc.docType !== 'pdf' || fileState !== 'ready' || !pdfRef.current || !pdfCanvasRef.current) return;
    const width = stageRef.current?.clientWidth || 800;
    renderPdfPage(pdfRef.current, page, pdfCanvasRef.current, width).catch(() => {
      setFileError('This page could not be drawn. The PDF may be damaged.');
      setFileState('error');
    });
  }, [doc.docType, fileState, page]);

  const loadRegions = useCallback(async () => {
    setRegionsError(null);
    try {
      const res = await canvasApi.getRegionCodings(canvasId, doc.id);
      setRegions(res.data.data);
      onRegionCountChange(res.data.data.length);
    } catch (err) {
      setRegionsError(apiErrorMessage(err, 'Could not load the coded regions.'));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- onRegionCountChange is a fresh closure each render
  }, [canvasId, doc.id]);

  useEffect(() => {
    loadRegions();
  }, [loadRegions]);

  const createRegion = useCallback(
    async (box: Box) => {
      if (!codeId) {
        toast.error('Choose a code first.');
        return;
      }
      setSaving(true);
      try {
        const res = await canvasApi.createRegionCoding(canvasId, doc.id, {
          questionId: codeId,
          pageNumber: page,
          ...clampBox(box),
        });
        setRegions((prev) => {
          const next = [...(prev ?? []), res.data.data];
          onRegionCountChange(next.length);
          return next;
        });
        onAnnounce(`Region coded ${codeById.get(codeId)?.text ?? ''} on page ${page}.`);
      } catch (err) {
        toast.error(apiErrorMessage(err, 'Could not save the region.'));
      } finally {
        setSaving(false);
      }
    },
    [canvasId, doc.id, codeId, page, codeById, onAnnounce, onRegionCountChange],
  );

  const updateRegion = useCallback(
    async (id: string, patch: Partial<Box> & { questionId?: string; note?: string | null }) => {
      try {
        const res = await canvasApi.updateRegionCoding(canvasId, doc.id, id, patch);
        setRegions((prev) => (prev ?? []).map((r) => (r.id === id ? res.data.data : r)));
        onAnnounce('Region updated.');
        return true;
      } catch (err) {
        toast.error(apiErrorMessage(err, 'Could not update the region.'));
        return false;
      }
    },
    [canvasId, doc.id, onAnnounce],
  );

  // Region deletes are confirmed in the parent dialog, then arrive here.
  useEffect(() => {
    const handler = async (e: Event) => {
      const regionId = (e as CustomEvent<{ regionId: string }>).detail?.regionId;
      if (!regionId || !regions?.some((r) => r.id === regionId)) return;
      try {
        await canvasApi.deleteRegionCoding(canvasId, doc.id, regionId);
        setRegions((prev) => {
          const next = (prev ?? []).filter((r) => r.id !== regionId);
          onRegionCountChange(next.length);
          return next;
        });
        onAnnounce('Region deleted.');
      } catch (err) {
        toast.error(apiErrorMessage(err, 'Could not delete the region.'));
      }
    };
    window.addEventListener('qualcanvas:delete-region', handler);
    return () => window.removeEventListener('qualcanvas:delete-region', handler);
  }, [canvasId, doc.id, regions, onAnnounce, onRegionCountChange]);

  const pct = (e: React.PointerEvent) => {
    const rect = stageRef.current!.getBoundingClientRect();
    return {
      x: Math.min(Math.max(((e.clientX - rect.left) / rect.width) * 100, 0), 100),
      y: Math.min(Math.max(((e.clientY - rect.top) / rect.height) * 100, 0), 100),
    };
  };

  const pageRegions = (regions ?? []).filter((r) => r.pageNumber === page);
  const colourOf = (r: Region) => (r.codeMissing ? '#9ca3af' : codeById.get(r.questionId)?.color || '#6366f1');
  const labelOf = (r: Region) => (r.codeMissing ? 'Deleted code' : codeById.get(r.questionId)?.text || 'Deleted code');
  const canDraw = !readOnly && Boolean(codeId) && fileState === 'ready';
  const drawRect = drawing
    ? {
        x: Math.min(drawing.sx, drawing.cx),
        y: Math.min(drawing.sy, drawing.cy),
        width: Math.abs(drawing.cx - drawing.sx),
        height: Math.abs(drawing.cy - drawing.sy),
      }
    : null;

  return (
    <div className="flex min-h-full flex-col lg:flex-row">
      {/* Page */}
      <div className="min-w-0 flex-1 p-3">
        <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
          <h3 className="truncate text-sm font-semibold text-gray-800 dark:text-gray-100">{doc.title}</h3>
          {doc.docType === 'pdf' && doc.pageCount > 1 && (
            <div className="flex items-center gap-2 text-sm" role="group" aria-label="Page navigation">
              <button
                type="button"
                className="btn-secondary px-2 py-1 text-xs"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page <= 1}
              >
                Previous page
              </button>
              <span aria-live="polite">
                Page {page} of {doc.pageCount}
              </span>
              <button
                type="button"
                className="btn-secondary px-2 py-1 text-xs"
                onClick={() => setPage((p) => Math.min(doc.pageCount, p + 1))}
                disabled={page >= doc.pageCount}
              >
                Next page
              </button>
            </div>
          )}
        </div>
        {fileState === 'error' ? (
          <div
            role="alert"
            className="rounded-lg bg-red-50 p-4 text-sm text-red-700 dark:bg-red-900/20 dark:text-red-300"
          >
            {fileError}
          </div>
        ) : (
          <div
            ref={stageRef}
            data-testid="document-stage"
            className={`relative select-none overflow-hidden rounded-lg border border-gray-200 bg-gray-50 dark:border-gray-700 dark:bg-gray-900 ${
              canDraw ? 'cursor-crosshair touch-none' : ''
            }`}
            onPointerDown={(e) => {
              if (!canDraw || e.button !== 0 || (e.target as HTMLElement).closest('[data-region]')) return;
              (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);
              const p = pct(e);
              setDrawing({ sx: p.x, sy: p.y, cx: p.x, cy: p.y });
            }}
            onPointerMove={(e) => {
              if (!drawing) return;
              const p = pct(e);
              setDrawing((d) => (d ? { ...d, cx: p.x, cy: p.y } : d));
            }}
            onPointerUp={() => {
              if (drawRect && drawRect.width > 1 && drawRect.height > 1) createRegion(drawRect);
              setDrawing(null);
            }}
            onPointerCancel={() => setDrawing(null)}
          >
            {fileState === 'loading' && (
              <div
                className="flex h-72 items-center justify-center text-sm text-gray-500"
                aria-label="Loading document"
              >
                Loading…
              </div>
            )}
            {doc.docType === 'pdf' ? (
              <canvas
                ref={pdfCanvasRef}
                className={fileState === 'ready' ? 'block w-full' : 'hidden'}
                aria-label={`${doc.title}, page ${page}`}
                role="img"
              />
            ) : (
              imageUrl && (
                <img
                  src={imageUrl}
                  alt={doc.title}
                  draggable={false}
                  className={fileState === 'ready' ? 'block w-full' : 'hidden'}
                />
              )
            )}
            {fileState === 'ready' &&
              pageRegions.map((r, i) => (
                <button
                  key={r.id}
                  type="button"
                  data-region
                  aria-label={`Region ${i + 1}: ${labelOf(r)}${r.note ? ` — ${r.note}` : ''}`}
                  onClick={() => setFocusedRegion(r.id)}
                  className={`absolute rounded-sm border-2 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 ${
                    focusedRegion === r.id ? 'ring-2 ring-indigo-500' : ''
                  } ${r.codeMissing ? 'border-dashed' : ''}`}
                  style={{
                    left: `${r.x}%`,
                    top: `${r.y}%`,
                    width: `${r.width}%`,
                    height: `${r.height}%`,
                    borderColor: colourOf(r),
                    backgroundColor: `${colourOf(r)}26`,
                  }}
                >
                  <span
                    className="absolute left-0 top-0 max-w-full truncate rounded-br px-1 text-[10px] font-medium text-white"
                    style={{ backgroundColor: colourOf(r) }}
                  >
                    {i + 1}. {labelOf(r)}
                  </span>
                </button>
              ))}
            {drawRect && (
              <div
                className="pointer-events-none absolute rounded-sm border-2 border-dashed"
                style={{
                  left: `${drawRect.x}%`,
                  top: `${drawRect.y}%`,
                  width: `${drawRect.width}%`,
                  height: `${drawRect.height}%`,
                  borderColor: codeById.get(codeId)?.color || '#6366f1',
                  backgroundColor: `${codeById.get(codeId)?.color || '#6366f1'}33`,
                }}
              />
            )}
          </div>
        )}
        {!readOnly && fileState === 'ready' && (
          <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
            {codeId
              ? 'Drag on the page to draw a region with the chosen code, or type its position in the panel.'
              : 'Create or choose a code to start drawing regions.'}
          </p>
        )}
      </div>

      {/* Side panel */}
      <aside
        aria-label="Codes and regions"
        className="w-full shrink-0 space-y-4 border-t border-gray-200 p-3 dark:border-gray-700 lg:w-80 lg:border-l lg:border-t-0"
      >
        {!readOnly && (
          <section aria-labelledby="region-code-heading" className="space-y-2">
            <h4 id="region-code-heading" className="text-sm font-semibold text-gray-800 dark:text-gray-100">
              Code to apply
            </h4>
            {questions.length === 0 ? (
              <p className="text-xs text-gray-600 dark:text-gray-300">This canvas has no codes yet. Create one here:</p>
            ) : (
              <select
                aria-label="Code to apply to new regions"
                className="input text-sm"
                value={codeId}
                onChange={(e) => setCodeId(e.target.value)}
              >
                {questions.map((q) => (
                  <option key={q.id} value={q.id}>
                    {q.text}
                  </option>
                ))}
              </select>
            )}
            <form
              className="flex gap-1"
              onSubmit={async (e) => {
                e.preventDefault();
                const text = newCodeText.trim();
                if (!text) return;
                try {
                  const id = await onCreateCode(text);
                  setCodeId(id);
                  setNewCodeText('');
                  onAnnounce(`Code ${text} created and selected.`);
                } catch (err) {
                  toast.error(apiErrorMessage(err, 'Could not create the code.'));
                }
              }}
            >
              <label htmlFor="region-new-code" className="sr-only">
                New code name
              </label>
              <input
                id="region-new-code"
                className="input text-sm"
                placeholder="New code…"
                value={newCodeText}
                maxLength={500}
                onChange={(e) => setNewCodeText(e.target.value)}
              />
              <button type="submit" className="btn-secondary px-2 py-1 text-xs" disabled={!newCodeText.trim()}>
                Add
              </button>
            </form>

            <details className="rounded-lg border border-gray-200 p-2 text-xs dark:border-gray-700">
              <summary className="cursor-pointer font-medium text-gray-700 dark:text-gray-200">
                Add a region by position (keyboard)
              </summary>
              <form
                className="mt-2 space-y-2"
                onSubmit={(e) => {
                  e.preventDefault();
                  createRegion(kbBox);
                }}
              >
                <p className="text-gray-500 dark:text-gray-400">Percent of the page, from the top-left corner.</p>
                <div className="grid grid-cols-2 gap-2">
                  {(['x', 'y', 'width', 'height'] as const).map((k) => (
                    <label key={k} className="block">
                      <span className="text-gray-600 dark:text-gray-300">
                        {k === 'x' ? 'Left' : k === 'y' ? 'Top' : k === 'width' ? 'Width' : 'Height'} (%)
                      </span>
                      <input
                        type="number"
                        min={k === 'width' || k === 'height' ? 1 : 0}
                        max={100}
                        step={0.5}
                        className="input mt-0.5 text-xs"
                        value={kbBox[k]}
                        onChange={(e) => setKbBox((b) => ({ ...b, [k]: Number(e.target.value) }))}
                      />
                    </label>
                  ))}
                </div>
                <button type="submit" className="btn-primary w-full px-2 py-1 text-xs" disabled={!canDraw || saving}>
                  Add region on page {page}
                </button>
              </form>
            </details>
          </section>
        )}

        <section aria-labelledby="region-list-heading">
          <h4 id="region-list-heading" className="mb-2 text-sm font-semibold text-gray-800 dark:text-gray-100">
            Regions on page {page} ({pageRegions.length})
          </h4>
          {regionsError ? (
            <p role="alert" className="text-xs text-red-700 dark:text-red-300">
              {regionsError}{' '}
              <button type="button" className="underline" onClick={loadRegions}>
                Try again
              </button>
            </p>
          ) : regions === null ? (
            <div className="h-12 animate-pulse rounded bg-gray-100 dark:bg-gray-700" aria-label="Loading regions" />
          ) : pageRegions.length === 0 ? (
            <p className="text-xs text-gray-500 dark:text-gray-400">
              {readOnly
                ? 'No regions have been coded on this page.'
                : 'No regions yet. Drag a rectangle over the part of the page that shows something worth coding.'}
            </p>
          ) : (
            <ol className="space-y-2">
              {pageRegions.map((r, i) => (
                <RegionRow
                  key={r.id}
                  index={i + 1}
                  region={r}
                  questions={questions}
                  label={labelOf(r)}
                  colour={colourOf(r)}
                  readOnly={readOnly}
                  highlighted={focusedRegion === r.id}
                  onSave={(patch) => updateRegion(r.id, patch)}
                  onDelete={() => onRequestDeleteRegion(r.id, labelOf(r))}
                />
              ))}
            </ol>
          )}
          {regions && regions.length > pageRegions.length && (
            <p className="mt-2 text-xs text-gray-500">
              {regions.length - pageRegions.length} more region(s) on other pages.
            </p>
          )}
        </section>
      </aside>
    </div>
  );
}

function RegionRow({
  index,
  region,
  questions,
  label,
  colour,
  readOnly,
  highlighted,
  onSave,
  onDelete,
}: {
  index: number;
  region: Region;
  questions: CanvasQuestion[];
  label: string;
  colour: string;
  readOnly: boolean;
  highlighted: boolean;
  onSave: (patch: Partial<Box> & { questionId?: string; note?: string | null }) => Promise<boolean>;
  onDelete: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [codeId, setCodeId] = useState(region.codeMissing ? '' : region.questionId);
  const [note, setNote] = useState(region.note ?? '');
  const [box, setBox] = useState<Box>({ x: region.x, y: region.y, width: region.width, height: region.height });
  const [busy, setBusy] = useState(false);

  return (
    <li
      className={`rounded-lg border p-2 text-xs ${
        highlighted ? 'border-indigo-400 ring-1 ring-indigo-300' : 'border-gray-200 dark:border-gray-700'
      }`}
      data-testid="region-row"
    >
      <div className="flex items-center justify-between gap-2">
        <span className="flex min-w-0 items-center gap-1.5">
          <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: colour }} aria-hidden />
          <span className="truncate font-medium text-gray-800 dark:text-gray-100">
            {index}. {label}
          </span>
        </span>
        {!readOnly && !editing && (
          <span className="flex shrink-0 gap-2">
            <button
              type="button"
              className="text-indigo-600 hover:underline"
              aria-label={`Edit region ${index}`}
              onClick={() => setEditing(true)}
            >
              Edit
            </button>
            <button
              type="button"
              className="text-red-600 hover:underline"
              aria-label={`Delete region ${index}`}
              onClick={onDelete}
            >
              Delete
            </button>
          </span>
        )}
      </div>
      {region.codeMissing && (
        <p className="mt-1 text-amber-700 dark:text-amber-300">
          Its code was deleted or merged away. {readOnly ? '' : 'Choose a new code or delete the region.'}
        </p>
      )}
      {region.note && !editing && <p className="mt-1 text-gray-600 dark:text-gray-300">{region.note}</p>}
      {editing && (
        <form
          className="mt-2 space-y-2"
          onSubmit={async (e) => {
            e.preventDefault();
            setBusy(true);
            const ok = await onSave({
              ...(codeId && codeId !== region.questionId ? { questionId: codeId } : {}),
              note: note.trim() ? note.trim() : null,
              ...clampBox(box),
            });
            setBusy(false);
            if (ok) setEditing(false);
          }}
        >
          <label className="block">
            <span className="text-gray-600 dark:text-gray-300">Code</span>
            <select
              className="input mt-0.5 text-xs"
              value={codeId}
              onChange={(e) => setCodeId(e.target.value)}
              required
            >
              <option value="" disabled>
                Choose a code…
              </option>
              {questions.map((q) => (
                <option key={q.id} value={q.id}>
                  {q.text}
                </option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="text-gray-600 dark:text-gray-300">Note</span>
            <textarea
              className="input mt-0.5 text-xs"
              rows={2}
              maxLength={5000}
              value={note}
              onChange={(e) => setNote(e.target.value)}
            />
          </label>
          <fieldset className="grid grid-cols-2 gap-2">
            <legend className="sr-only">Position (percent of page)</legend>
            {(['x', 'y', 'width', 'height'] as const).map((k) => (
              <label key={k} className="block">
                <span className="text-gray-600 dark:text-gray-300">
                  {k === 'x' ? 'Left' : k === 'y' ? 'Top' : k === 'width' ? 'Width' : 'Height'} (%)
                </span>
                <input
                  type="number"
                  min={k === 'width' || k === 'height' ? 1 : 0}
                  max={100}
                  step={0.5}
                  className="input mt-0.5 text-xs"
                  value={box[k]}
                  onChange={(e) => setBox((b) => ({ ...b, [k]: Number(e.target.value) }))}
                />
              </label>
            ))}
          </fieldset>
          <div className="flex gap-2">
            <button type="submit" className="btn-primary px-2 py-1 text-xs" disabled={busy || !codeId}>
              {busy ? 'Saving…' : 'Save'}
            </button>
            <button type="button" className="btn-secondary px-2 py-1 text-xs" onClick={() => setEditing(false)}>
              Cancel
            </button>
          </div>
        </form>
      )}
    </li>
  );
}
