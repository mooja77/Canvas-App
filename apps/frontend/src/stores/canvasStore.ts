// React Flow perf fix #2: switch to createWithEqualityFn(..., shallow) so
// multi-field selectors don't return a fresh object reference on every
// store mutation, defeating React.memo on consumers. Individual-field
// selectors are unaffected (primitive equality already works). The store
// definition body itself is unchanged.
import { createWithEqualityFn } from 'zustand/traditional';
import { shallow } from 'zustand/shallow';
import type {
  CodingCanvas,
  CanvasDetail,
  CanvasTranscript,
  CanvasQuestion,
  CanvasMemo,
  CanvasTextCoding,
  CanvasNodePosition,
  CanvasCase,
  CanvasRelation,
  CanvasComputedNode,
  ComputedNodeType,
} from '@qualcanvas/shared';
import { canvasApi, getAllCanvases } from '../services/api';
import { emitSocketEvent } from '../lib/socket';
import { cacheCanvas, getCachedCanvas, clearCachedCanvas } from '../lib/offlineStorage';
import { trackEvent } from '../utils/analytics';
import toast from 'react-hot-toast';

const FIRST_CODING_FLAG = 'qualcanvas-first-coding-fired';

// Layout writes frequently target the same rows (drag stop, resize, collapse,
// auto-arrange, and new-node placement can all fire close together). Letting
// those requests overlap makes PostgreSQL transactions wait on one another's
// row locks and can turn a tiny save into a request timeout. Preserve the
// caller order and keep later saves queued even when an earlier one fails.
let layoutSaveQueue: Promise<void> = Promise.resolve();
let queuedLayoutSaveCount = 0;

interface PendingSelection {
  transcriptId: string;
  startOffset: number;
  endOffset: number;
  codedText: string;
}

interface CanvasState {
  // Canvas list
  canvases: (CodingCanvas & {
    _count?: { transcripts: number; questions: number; codings: number };
    sharedWithMe?: boolean;
  })[];
  loading: boolean;
  error: string | null;

  // Trash
  trashedCanvases: (CodingCanvas & {
    _count?: { transcripts: number; questions: number; codings: number };
    sharedWithMe?: boolean;
  })[];
  trashLoading: boolean;
  trashError: string | null;

  // Active canvas
  activeCanvasId: string | null;
  activeCanvas: CanvasDetail | null;

  // Text selection for coding
  pendingSelection: PendingSelection | null;

  // Detail panel
  selectedQuestionId: string | null;

  // UI toggles
  showCodingStripes: boolean;
  savingLayout: boolean;
  /**
   * True when the last layout save FAILED. The status chip was a binary
   * "Saving..." / "Saved", so a failed save fell straight back to "Saved"
   * while the arrangement existed only in the browser - reload and the work
   * was gone. The toast lasted ~4s and then there was no signal at all.
   */
  layoutSaveFailed: boolean;
  runningNodeId: string | null;

  // Actions
  fetchCanvases: () => Promise<boolean>;
  createCanvas: (name: string, description?: string, starterCodes?: string[]) => Promise<CodingCanvas>;
  setResearchParadigm: (paradigm: string | null) => Promise<void>;
  deleteCanvas: (id: string) => Promise<void>;
  openCanvas: (id: string) => Promise<void>;
  closeCanvas: () => void;
  refreshCanvas: () => Promise<void>;

  // Trash actions
  fetchTrash: () => Promise<void>;
  restoreCanvas: (id: string) => Promise<void>;
  permanentDeleteCanvas: (id: string) => Promise<void>;

  // Canvas item actions
  addTranscript: (title: string, content: string) => Promise<CanvasTranscript>;
  updateTranscript: (tid: string, data: { title?: string; content?: string; caseId?: string | null }) => Promise<void>;
  deleteTranscript: (tid: string) => Promise<void>;

  addQuestion: (text: string, color?: string) => Promise<CanvasQuestion>;
  updateQuestion: (
    qid: string,
    data: { text?: string; color?: string; parentQuestionId?: string | null },
  ) => Promise<void>;
  deleteQuestion: (qid: string) => Promise<void>;

  addMemo: (content: string, title?: string, color?: string) => Promise<CanvasMemo>;
  updateMemo: (mid: string, data: { title?: string; content?: string; color?: string }) => Promise<void>;
  deleteMemo: (mid: string) => Promise<void>;

  // Coding
  setPendingSelection: (selection: PendingSelection | null) => void;
  createCoding: (
    transcriptId: string,
    questionId: string,
    startOffset: number,
    endOffset: number,
    codedText: string,
  ) => Promise<CanvasTextCoding>;
  deleteCoding: (codingId: string) => Promise<void>;
  updateCodingAnnotation: (codingId: string, annotation: string | null) => Promise<void>;
  reassignCoding: (codingId: string, newQuestionId: string) => Promise<void>;

  // Layout
  saveLayout: (positions: CanvasNodePosition[]) => Promise<void>;

  // Detail panel
  setSelectedQuestionId: (id: string | null) => void;

  // Cases
  addCase: (name: string, attributes?: Record<string, string>) => Promise<CanvasCase>;
  updateCase: (caseId: string, data: { name?: string; attributes?: Record<string, string> }) => Promise<void>;
  deleteCase: (caseId: string) => Promise<void>;

  // Relations
  addRelation: (
    fromType: 'case' | 'question',
    fromId: string,
    toType: 'case' | 'question',
    toId: string,
    label: string,
  ) => Promise<CanvasRelation>;
  updateRelation: (relId: string, label: string) => Promise<void>;
  deleteRelation: (relId: string) => Promise<void>;

  // Computed Nodes
  addComputedNode: (
    nodeType: ComputedNodeType,
    label: string,
    config?: Record<string, unknown>,
  ) => Promise<CanvasComputedNode>;
  updateComputedNode: (nodeId: string, data: { label?: string; config?: Record<string, unknown> }) => Promise<void>;
  deleteComputedNode: (nodeId: string) => Promise<void>;
  runComputedNode: (nodeId: string) => Promise<CanvasComputedNode>;

  // Auto-Code
  autoCode: (
    questionId: string,
    pattern: string,
    mode: 'keyword' | 'regex',
    transcriptIds?: string[],
  ) => Promise<{ created: number }>;

  // In-Vivo / Spread / Merge
  codeInVivo: (
    transcriptId: string,
    startOffset: number,
    endOffset: number,
    codedText: string,
  ) => Promise<CanvasQuestion>;
  spreadToParagraph: (transcriptId: string, startOffset: number, endOffset: number, codedText: string) => Promise<void>;
  mergeQuestions: (sourceId: string, targetId: string) => Promise<void>;

  // Import
  importNarratives: (
    narratives: { title: string; content: string; sourceType?: string; sourceId?: string }[],
  ) => Promise<void>;
  importFromCanvas: (sourceCanvasId: string, transcriptIds: string[]) => Promise<void>;

  // UI toggles
  toggleCodingStripes: () => void;
}

export const useCanvasStore = createWithEqualityFn<CanvasState>(
  (set, get) => ({
    canvases: [],
    loading: false,
    error: null,
    trashedCanvases: [],
    trashLoading: false,
    trashError: null,
    activeCanvasId: null,
    activeCanvas: null,
    pendingSelection: null,
    selectedQuestionId: null,
    showCodingStripes: false,
    savingLayout: false,
    layoutSaveFailed: false,
    runningNodeId: null,

    fetchCanvases: async () => {
      set({ loading: true, error: null });
      try {
        const canvases = await getAllCanvases();
        set({ canvases, loading: false });
        return true;
      } catch {
        set({ error: 'Failed to load canvases', loading: false });
        return false;
      }
    },

    createCanvas: async (name, description, starterCodes) => {
      const res = await canvasApi.createCanvas({ name, description, starterCodes });
      const canvas = res.data.data;
      set((s) => ({ canvases: [canvas, ...s.canvases] }));
      return canvas;
    },

    setResearchParadigm: async (paradigm) => {
      const { activeCanvasId } = get();
      if (!activeCanvasId) return;
      await canvasApi.updateCanvas(activeCanvasId, { researchParadigm: paradigm });
      set((s) => ({
        activeCanvas: s.activeCanvas ? { ...s.activeCanvas, researchParadigm: paradigm } : s.activeCanvas,
        canvases: s.canvases.map((c) => (c.id === activeCanvasId ? { ...c, researchParadigm: paradigm } : c)),
      }));
    },

    deleteCanvas: async (id) => {
      await canvasApi.deleteCanvas(id);
      set((s) => ({
        canvases: s.canvases.filter((c) => c.id !== id),
        activeCanvasId: s.activeCanvasId === id ? null : s.activeCanvasId,
        activeCanvas: s.activeCanvasId === id ? null : s.activeCanvas,
      }));
    },

    openCanvas: async (id) => {
      set({ loading: true, error: null });
      try {
        const res = await canvasApi.getCanvas(id);
        set({ activeCanvasId: id, activeCanvas: res.data.data, loading: false, pendingSelection: null });
        // Cache for offline use
        cacheCanvas(res.data.data).catch(() => {});
      } catch (err) {
        // A response with a status code is a definitive answer from the
        // server, NOT an offline condition. Re-serving the cached copy here
        // handed a removed collaborator (403) or a trashed canvas (404) the
        // full transcripts, codings and memos — with a stale myRole of
        // 'owner' — behind a reassuring "Loaded from offline cache" toast.
        const status = (err as { response?: { status?: number } } | undefined)?.response?.status;

        if (status === 403 || status === 404) {
          // Access was refused or the canvas is gone: drop the local copy so
          // it can't be served later either.
          await clearCachedCanvas(id).catch(() => {});
          const message =
            status === 403 ? 'You no longer have access to this canvas' : 'This canvas is no longer available';
          set({ error: message, loading: false, activeCanvasId: null, activeCanvas: null, pendingSelection: null });
          toast.error(message);
          return;
        }

        if (status !== undefined && status < 500) {
          // Any other 4xx (401 expired session, 429 rate limit, ...) is still
          // a real server answer — don't dress it up as offline. The cached
          // copy may legitimately be this user's, so leave it in place.
          set({ error: 'Failed to open canvas', loading: false });
          toast.error('Failed to load canvas');
          return;
        }

        // No response at all (network down) or a 5xx outage — offline fallback.
        const cached = await getCachedCanvas(id).catch(() => null);
        if (cached) {
          set({ activeCanvasId: id, activeCanvas: cached, loading: false, pendingSelection: null });
          toast('Loaded from offline cache', { icon: '\u{1F4F1}' });
        } else {
          set({ error: 'Failed to open canvas', loading: false });
          toast.error('Failed to load canvas');
        }
      }
    },

    closeCanvas: () => {
      set({ activeCanvasId: null, activeCanvas: null, pendingSelection: null, selectedQuestionId: null });
    },

    refreshCanvas: async () => {
      const { activeCanvasId } = get();
      if (!activeCanvasId) return;
      try {
        const res = await canvasApi.getCanvas(activeCanvasId);
        set({ activeCanvas: res.data.data });
      } catch (err) {
        console.error('[canvasStore] refreshCanvas failed:', err);
        // Don't clear activeCanvas — keep stale data rather than blank screen
      }
    },

    fetchTrash: async () => {
      set({ trashLoading: true, trashError: null });
      try {
        const res = await canvasApi.getTrash();
        set({ trashedCanvases: res.data.data, trashLoading: false, trashError: null });
      } catch {
        set({ trashLoading: false, trashError: 'Failed to load trash' });
      }
    },

    restoreCanvas: async (id) => {
      await canvasApi.restoreCanvas(id);
      set((s) => ({
        trashedCanvases: s.trashedCanvases.filter((c) => c.id !== id),
      }));
      // Refresh the main list so it shows up
      get().fetchCanvases();
    },

    permanentDeleteCanvas: async (id) => {
      await canvasApi.permanentDeleteCanvas(id);
      set((s) => ({
        trashedCanvases: s.trashedCanvases.filter((c) => c.id !== id),
      }));
    },

    addTranscript: async (title, content) => {
      const { activeCanvasId } = get();
      if (!activeCanvasId) throw new Error('No canvas open');
      const res = await canvasApi.addTranscript(activeCanvasId, { title, content });
      const transcript = res.data.data;
      set((s) => ({
        activeCanvas: s.activeCanvas
          ? { ...s.activeCanvas, transcripts: [...s.activeCanvas.transcripts, transcript] }
          : null,
      }));
      emitSocketEvent('canvas:node-added', {
        canvasId: activeCanvasId,
        data: { type: 'transcript', id: transcript.id },
      });
      return transcript;
    },

    updateTranscript: async (tid, data) => {
      const { activeCanvasId } = get();
      if (!activeCanvasId) return;
      const res = await canvasApi.updateTranscript(activeCanvasId, tid, data);
      const updated = res.data.data;
      set((s) => ({
        activeCanvas: s.activeCanvas
          ? {
              ...s.activeCanvas,
              transcripts: s.activeCanvas.transcripts.map((t: CanvasTranscript) =>
                t.id === tid ? { ...t, ...updated } : t,
              ),
            }
          : null,
      }));
      emitSocketEvent('canvas:transcript-updated', { canvasId: activeCanvasId, data: { transcriptId: tid } });
    },

    deleteTranscript: async (tid) => {
      const { activeCanvasId } = get();
      if (!activeCanvasId) return;
      await canvasApi.deleteTranscript(activeCanvasId, tid);
      set((s) => ({
        activeCanvas: s.activeCanvas
          ? {
              ...s.activeCanvas,
              transcripts: s.activeCanvas.transcripts.filter((t: CanvasTranscript) => t.id !== tid),
              codings: s.activeCanvas.codings.filter((c: CanvasTextCoding) => c.transcriptId !== tid),
              nodePositions: s.activeCanvas.nodePositions.filter(
                (p: CanvasNodePosition) => p.nodeId !== `transcript-${tid}` && p.nodeId !== tid,
              ),
            }
          : null,
      }));
      emitSocketEvent('canvas:node-deleted', {
        canvasId: activeCanvasId,
        data: { nodeId: tid, nodeType: 'transcript' },
      });
    },

    addQuestion: async (text, color) => {
      const { activeCanvasId } = get();
      if (!activeCanvasId) throw new Error('No canvas open');
      const res = await canvasApi.addQuestion(activeCanvasId, { text, color });
      const question = res.data.data;
      set((s) => ({
        activeCanvas: s.activeCanvas ? { ...s.activeCanvas, questions: [...s.activeCanvas.questions, question] } : null,
      }));
      emitSocketEvent('canvas:node-added', { canvasId: activeCanvasId, data: { type: 'question', id: question.id } });
      return question;
    },

    updateQuestion: async (qid, data) => {
      const { activeCanvasId } = get();
      if (!activeCanvasId) return;
      const res = await canvasApi.updateQuestion(activeCanvasId, qid, data);
      const updated = res.data.data;
      set((s) => ({
        activeCanvas: s.activeCanvas
          ? {
              ...s.activeCanvas,
              questions: s.activeCanvas.questions.map((q: CanvasQuestion) => (q.id === qid ? { ...q, ...updated } : q)),
            }
          : null,
      }));
    },

    deleteQuestion: async (qid) => {
      const { activeCanvasId } = get();
      if (!activeCanvasId) return;
      await canvasApi.deleteQuestion(activeCanvasId, qid);
      set((s) => ({
        activeCanvas: s.activeCanvas
          ? {
              ...s.activeCanvas,
              questions: s.activeCanvas.questions
                .filter((q: CanvasQuestion) => q.id !== qid)
                .map((q: CanvasQuestion) => (q.parentQuestionId === qid ? { ...q, parentQuestionId: null } : q)),
              codings: s.activeCanvas.codings.filter((c: CanvasTextCoding) => c.questionId !== qid),
              relations: s.activeCanvas.relations.filter(
                (r: CanvasRelation) =>
                  !(r.fromType === 'question' && r.fromId === qid) && !(r.toType === 'question' && r.toId === qid),
              ),
              nodePositions: s.activeCanvas.nodePositions.filter(
                (p: CanvasNodePosition) => p.nodeId !== `question-${qid}` && p.nodeId !== qid,
              ),
            }
          : null,
      }));
      emitSocketEvent('canvas:node-deleted', { canvasId: activeCanvasId, data: { nodeId: qid, nodeType: 'question' } });
    },

    addMemo: async (content, title, color) => {
      const { activeCanvasId } = get();
      if (!activeCanvasId) throw new Error('No canvas open');
      const res = await canvasApi.addMemo(activeCanvasId, { content, title, color });
      const memo = res.data.data;
      set((s) => ({
        activeCanvas: s.activeCanvas ? { ...s.activeCanvas, memos: [...s.activeCanvas.memos, memo] } : null,
      }));
      emitSocketEvent('canvas:node-added', { canvasId: activeCanvasId, data: { type: 'memo', id: memo.id } });
      return memo;
    },

    updateMemo: async (mid, data) => {
      const { activeCanvasId } = get();
      if (!activeCanvasId) return;
      const res = await canvasApi.updateMemo(activeCanvasId, mid, data);
      const updated = res.data.data;
      set((s) => ({
        activeCanvas: s.activeCanvas
          ? {
              ...s.activeCanvas,
              memos: s.activeCanvas.memos.map((m: CanvasMemo) => (m.id === mid ? { ...m, ...updated } : m)),
            }
          : null,
      }));
    },

    deleteMemo: async (mid) => {
      const { activeCanvasId } = get();
      if (!activeCanvasId) return;
      await canvasApi.deleteMemo(activeCanvasId, mid);
      set((s) => ({
        activeCanvas: s.activeCanvas
          ? {
              ...s.activeCanvas,
              memos: s.activeCanvas.memos.filter((m: CanvasMemo) => m.id !== mid),
              nodePositions: s.activeCanvas.nodePositions.filter(
                (p: CanvasNodePosition) => p.nodeId !== `memo-${mid}` && p.nodeId !== mid,
              ),
            }
          : null,
      }));
      emitSocketEvent('canvas:node-deleted', { canvasId: activeCanvasId, data: { nodeId: mid, nodeType: 'memo' } });
    },

    setPendingSelection: (selection) => set({ pendingSelection: selection }),

    createCoding: async (transcriptId, questionId, startOffset, endOffset, codedText) => {
      const { activeCanvasId } = get();
      if (!activeCanvasId) throw new Error('No canvas open');
      try {
        const res = await canvasApi.createCoding(activeCanvasId, {
          transcriptId,
          questionId,
          startOffset,
          endOffset,
          codedText,
        });
        const coding = res.data.data;
        set((s) => ({
          activeCanvas: s.activeCanvas ? { ...s.activeCanvas, codings: [...s.activeCanvas.codings, coding] } : null,
          pendingSelection: null,
        }));
        emitSocketEvent('canvas:coding-added', {
          canvasId: activeCanvasId,
          data: { id: coding.id, transcriptId, questionId },
        });

        // Sprint F: first-value moment. localStorage flag is per-browser, which
        // over-fires for users on a new device — accepted trade-off vs the
        // alternative (server round-trip on every coding to check uniqueness).
        try {
          if (!localStorage.getItem(FIRST_CODING_FLAG)) {
            localStorage.setItem(FIRST_CODING_FLAG, new Date().toISOString());
            trackEvent('first_excerpt_coded', {
              canvas_id: activeCanvasId,
              code_text: codedText.slice(0, 80),
            });
            window.dispatchEvent(new CustomEvent('qualcanvas:first-excerpt-coded', { detail: { coding } }));
          }
        } catch {
          // localStorage may be unavailable (e.g. Safari private mode); ignore.
        }

        return coding;
      } catch (err) {
        console.error('[canvasStore] createCoding failed:', err);
        set({ pendingSelection: null }); // Clear even on error
        throw err;
      }
    },

    deleteCoding: async (codingId) => {
      const { activeCanvasId } = get();
      if (!activeCanvasId) return;
      await canvasApi.deleteCoding(activeCanvasId, codingId);
      set((s) => ({
        activeCanvas: s.activeCanvas
          ? { ...s.activeCanvas, codings: s.activeCanvas.codings.filter((c: CanvasTextCoding) => c.id !== codingId) }
          : null,
      }));
      emitSocketEvent('canvas:coding-deleted', { canvasId: activeCanvasId, data: { codingId } });
    },

    updateCodingAnnotation: async (codingId, annotation) => {
      const { activeCanvasId } = get();
      if (!activeCanvasId) return;
      const res = await canvasApi.updateCoding(activeCanvasId, codingId, { annotation: annotation ?? undefined });
      const updated = res.data.data;
      set((s) => ({
        activeCanvas: s.activeCanvas
          ? {
              ...s.activeCanvas,
              codings: s.activeCanvas.codings.map((c: CanvasTextCoding) =>
                c.id === codingId ? { ...c, ...updated } : c,
              ),
            }
          : null,
      }));
    },

    reassignCoding: async (codingId, newQuestionId) => {
      const { activeCanvasId } = get();
      if (!activeCanvasId) return;
      await canvasApi.reassignCoding(activeCanvasId, codingId, newQuestionId);
      set((s) => ({
        activeCanvas: s.activeCanvas
          ? {
              ...s.activeCanvas,
              codings: s.activeCanvas.codings.map((c: CanvasTextCoding) =>
                c.id === codingId ? { ...c, questionId: newQuestionId } : c,
              ),
            }
          : null,
      }));
    },

    saveLayout: async (positions) => {
      const { activeCanvasId, activeCanvas } = get();
      if (!activeCanvasId) return;
      // Viewers can't persist layout (server 403s) — silently skip instead of
      // toasting "Layout save failed" at someone who is read-only by design.
      if (activeCanvas?.myRole === 'viewer') return;
      const canvasId = activeCanvasId;
      const payload = {
        positions: positions.map((p) => ({
          nodeId: p.nodeId,
          nodeType: p.nodeType,
          x: p.x,
          y: p.y,
          width: p.width,
          height: p.height,
          collapsed: p.collapsed,
        })),
      };
      queuedLayoutSaveCount++;
      set({ savingLayout: true });
      const request = layoutSaveQueue.then(async () => {
        await canvasApi.saveLayout(canvasId, payload);
      });
      layoutSaveQueue = request.catch(() => undefined);
      try {
        await request;
        set({ layoutSaveFailed: false });
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } catch (err: any) {
        // Record it, don't just toast it. The toast expires; the unsaved
        // arrangement does not.
        set({ layoutSaveFailed: true });
        toast.error(err?.response?.data?.error || 'Layout save failed');
      } finally {
        queuedLayoutSaveCount--;
        if (queuedLayoutSaveCount === 0) set({ savingLayout: false });
      }
    },

    setSelectedQuestionId: (id) => set({ selectedQuestionId: id }),

    // ─── Cases ───

    addCase: async (name, attributes) => {
      const { activeCanvasId } = get();
      if (!activeCanvasId) throw new Error('No canvas open');
      const res = await canvasApi.createCase(activeCanvasId, { name, attributes });
      const caseRecord = res.data.data;
      set((s) => ({
        activeCanvas: s.activeCanvas ? { ...s.activeCanvas, cases: [...s.activeCanvas.cases, caseRecord] } : null,
      }));
      emitSocketEvent('canvas:node-added', { canvasId: activeCanvasId, data: { type: 'case', id: caseRecord.id } });
      return caseRecord;
    },

    updateCase: async (caseId, data) => {
      const { activeCanvasId } = get();
      if (!activeCanvasId) return;
      const res = await canvasApi.updateCase(activeCanvasId, caseId, data);
      const updated = res.data.data;
      set((s) => ({
        activeCanvas: s.activeCanvas
          ? {
              ...s.activeCanvas,
              cases: s.activeCanvas.cases.map((c: CanvasCase) => (c.id === caseId ? { ...c, ...updated } : c)),
            }
          : null,
      }));
    },

    deleteCase: async (caseId) => {
      const { activeCanvasId } = get();
      if (!activeCanvasId) return;
      await canvasApi.deleteCase(activeCanvasId, caseId);
      set((s) => ({
        activeCanvas: s.activeCanvas
          ? {
              ...s.activeCanvas,
              cases: s.activeCanvas.cases.filter((c: CanvasCase) => c.id !== caseId),
              transcripts: s.activeCanvas.transcripts.map((t: CanvasTranscript) =>
                t.caseId === caseId ? { ...t, caseId: null } : t,
              ),
              relations: s.activeCanvas.relations.filter(
                (r: CanvasRelation) =>
                  !(r.fromType === 'case' && r.fromId === caseId) && !(r.toType === 'case' && r.toId === caseId),
              ),
              nodePositions: s.activeCanvas.nodePositions.filter(
                (p: CanvasNodePosition) => p.nodeId !== `case-${caseId}` && p.nodeId !== caseId,
              ),
            }
          : null,
      }));
      emitSocketEvent('canvas:node-deleted', { canvasId: activeCanvasId, data: { nodeId: caseId, nodeType: 'case' } });
    },

    // ─── Relations ───

    addRelation: async (fromType, fromId, toType, toId, label) => {
      const { activeCanvasId } = get();
      if (!activeCanvasId) throw new Error('No canvas open');
      const res = await canvasApi.createRelation(activeCanvasId, { fromType, fromId, toType, toId, label });
      const relation = res.data.data;
      set((s) => ({
        activeCanvas: s.activeCanvas ? { ...s.activeCanvas, relations: [...s.activeCanvas.relations, relation] } : null,
      }));
      return relation;
    },

    updateRelation: async (relId, label) => {
      const { activeCanvasId } = get();
      if (!activeCanvasId) return;
      await canvasApi.updateRelation(activeCanvasId, relId, { label });
      set((s) => ({
        activeCanvas: s.activeCanvas
          ? {
              ...s.activeCanvas,
              relations: s.activeCanvas.relations.map((r: CanvasRelation) => (r.id === relId ? { ...r, label } : r)),
            }
          : null,
      }));
    },

    deleteRelation: async (relId) => {
      const { activeCanvasId } = get();
      if (!activeCanvasId) return;
      await canvasApi.deleteRelation(activeCanvasId, relId);
      set((s) => ({
        activeCanvas: s.activeCanvas
          ? { ...s.activeCanvas, relations: s.activeCanvas.relations.filter((r: CanvasRelation) => r.id !== relId) }
          : null,
      }));
    },

    // ─── Computed Nodes ───

    addComputedNode: async (nodeType, label, config) => {
      const { activeCanvasId } = get();
      if (!activeCanvasId) throw new Error('No canvas open');
      const res = await canvasApi.createComputedNode(activeCanvasId, { nodeType, label, config });
      const node = res.data.data;
      set((s) => ({
        activeCanvas: s.activeCanvas
          ? { ...s.activeCanvas, computedNodes: [...s.activeCanvas.computedNodes, node] }
          : null,
      }));
      emitSocketEvent('canvas:node-added', { canvasId: activeCanvasId, data: { type: 'computed', id: node.id } });
      return node;
    },

    updateComputedNode: async (nodeId, data) => {
      const { activeCanvasId } = get();
      if (!activeCanvasId) return;
      const res = await canvasApi.updateComputedNode(activeCanvasId, nodeId, data);
      const updated = res.data.data;
      set((s) => ({
        activeCanvas: s.activeCanvas
          ? {
              ...s.activeCanvas,
              computedNodes: s.activeCanvas.computedNodes.map((n: CanvasComputedNode) =>
                n.id === nodeId ? { ...n, ...updated } : n,
              ),
            }
          : null,
      }));
    },

    deleteComputedNode: async (nodeId) => {
      const { activeCanvasId } = get();
      if (!activeCanvasId) return;
      await canvasApi.deleteComputedNode(activeCanvasId, nodeId);
      set((s) => ({
        activeCanvas: s.activeCanvas
          ? {
              ...s.activeCanvas,
              computedNodes: s.activeCanvas.computedNodes.filter((n: CanvasComputedNode) => n.id !== nodeId),
              nodePositions: s.activeCanvas.nodePositions.filter(
                (p: CanvasNodePosition) => p.nodeId !== `computed-${nodeId}` && p.nodeId !== nodeId,
              ),
            }
          : null,
      }));
      emitSocketEvent('canvas:node-deleted', { canvasId: activeCanvasId, data: { nodeId, nodeType: 'computed' } });
    },

    runComputedNode: async (nodeId) => {
      const { activeCanvasId } = get();
      if (!activeCanvasId) throw new Error('No canvas open');
      set({ runningNodeId: nodeId });
      try {
        const res = await canvasApi.runComputedNode(activeCanvasId, nodeId);
        const updated = res.data.data;
        set((s) => ({
          activeCanvas: s.activeCanvas
            ? {
                ...s.activeCanvas,
                computedNodes: s.activeCanvas.computedNodes.map((n: CanvasComputedNode) =>
                  n.id === nodeId ? { ...n, ...updated } : n,
                ),
              }
            : null,
        }));
        return updated;
      } finally {
        set({ runningNodeId: null });
      }
    },

    // ─── Auto-Code ───

    autoCode: async (questionId, pattern, mode, transcriptIds) => {
      const { activeCanvasId } = get();
      if (!activeCanvasId) throw new Error('No canvas open');
      const res = await canvasApi.autoCode(activeCanvasId, { questionId, pattern, mode, transcriptIds });
      const { created, codings } = res.data.data;
      if (codings?.length) {
        set((s) => ({
          activeCanvas: s.activeCanvas ? { ...s.activeCanvas, codings: [...s.activeCanvas.codings, ...codings] } : null,
        }));
        emitSocketEvent('canvas:coding-added', {
          canvasId: activeCanvasId,
          data: { id: 'bulk', transcriptId: 'bulk', questionId },
        });
      }
      return { created };
    },

    // ─── In-Vivo Coding ───

    codeInVivo: async (transcriptId, startOffset, endOffset, codedText) => {
      const question = await get().addQuestion(codedText);
      await get().createCoding(transcriptId, question.id, startOffset, endOffset, codedText);
      return question;
    },

    // ─── Spread to Paragraph ───

    spreadToParagraph: async (transcriptId, startOffset, endOffset, codedText) => {
      const { activeCanvas, addQuestion, createCoding } = get();
      if (!activeCanvas) throw new Error('No canvas open');
      const transcript = activeCanvas.transcripts.find((t) => t.id === transcriptId);
      if (!transcript) throw new Error('Transcript not found');

      const content = transcript.content;

      let paraStart = content.lastIndexOf('\n\n', startOffset);
      paraStart = paraStart === -1 ? 0 : paraStart + 2;

      let paraEnd = content.indexOf('\n\n', endOffset);
      paraEnd = paraEnd === -1 ? content.length : paraEnd;

      const paragraphText = content.slice(paraStart, paraEnd).trim();
      if (!paragraphText) return;

      const question = await addQuestion(codedText);
      await createCoding(transcriptId, question.id, paraStart, paraEnd, paragraphText);
    },

    // ─── Merge Questions ───

    mergeQuestions: async (sourceId, targetId) => {
      const { activeCanvasId, refreshCanvas } = get();
      if (!activeCanvasId) throw new Error('No canvas open');
      await canvasApi.mergeQuestions(activeCanvasId, sourceId, targetId);
      await refreshCanvas();
    },

    // ─── Import ───

    importNarratives: async (narratives) => {
      const { activeCanvasId, refreshCanvas } = get();
      if (!activeCanvasId) throw new Error('No canvas open');
      await canvasApi.importNarratives(activeCanvasId, { narratives });
      await refreshCanvas();
    },

    importFromCanvas: async (sourceCanvasId, transcriptIds) => {
      const { activeCanvasId, refreshCanvas } = get();
      if (!activeCanvasId) throw new Error('No canvas open');
      await canvasApi.importFromCanvas(activeCanvasId, { sourceCanvasId, transcriptIds });
      await refreshCanvas();
    },

    // ─── UI toggles ───

    toggleCodingStripes: () => set((s) => ({ showCodingStripes: !s.showCodingStripes })),
  }),
  shallow,
);

// ─── Granular selector hooks (prevent unnecessary re-renders) ───

export const useActiveCanvas = () => useCanvasStore((s) => s.activeCanvas);
/** True when the current user has read-only (viewer) access to the active canvas. */
export const useIsViewer = () => useCanvasStore((s) => s.activeCanvas?.myRole === 'viewer');
export const useActiveCanvasId = () => useCanvasStore((s) => s.activeCanvasId);
export const useCanvasTranscripts = () => useCanvasStore((s) => s.activeCanvas?.transcripts ?? []);
export const useCanvasQuestions = () => useCanvasStore((s) => s.activeCanvas?.questions ?? []);
export const useCanvasCodings = () => useCanvasStore((s) => s.activeCanvas?.codings ?? []);
export const useCanvasMemos = () => useCanvasStore((s) => s.activeCanvas?.memos ?? []);
export const useCanvasCases = () => useCanvasStore((s) => s.activeCanvas?.cases ?? []);
export const useCanvasRelations = () => useCanvasStore((s) => s.activeCanvas?.relations ?? []);
export const useCanvasComputedNodes = () => useCanvasStore((s) => s.activeCanvas?.computedNodes ?? []);
export const useCanvasNodePositions = () => useCanvasStore((s) => s.activeCanvas?.nodePositions ?? []);
export const useSelectedQuestionId = () => useCanvasStore((s) => s.selectedQuestionId);
export const usePendingSelection = () => useCanvasStore((s) => s.pendingSelection);
export const useCanvasLoading = () => useCanvasStore((s) => s.loading);
export const useCanvasError = () => useCanvasStore((s) => s.error);
export const useShowCodingStripes = () => useCanvasStore((s) => s.showCodingStripes);
export const useRunningNodeId = () => useCanvasStore((s) => s.runningNodeId);
export const useTrashedCanvases = () => useCanvasStore((s) => s.trashedCanvases);
export const useTrashLoading = () => useCanvasStore((s) => s.trashLoading);
export const useTrashError = () => useCanvasStore((s) => s.trashError);
