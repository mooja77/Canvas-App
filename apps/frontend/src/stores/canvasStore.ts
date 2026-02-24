import { create } from 'zustand';
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
} from '@canvas-app/shared';
import { canvasApi } from '../services/api';
import toast from 'react-hot-toast';

interface PendingSelection {
  transcriptId: string;
  startOffset: number;
  endOffset: number;
  codedText: string;
}

interface CanvasState {
  // Canvas list
  canvases: (CodingCanvas & { _count?: { transcripts: number; questions: number; codings: number } })[];
  loading: boolean;
  error: string | null;

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

  // Actions
  fetchCanvases: () => Promise<void>;
  createCanvas: (name: string, description?: string) => Promise<CodingCanvas>;
  deleteCanvas: (id: string) => Promise<void>;
  openCanvas: (id: string) => Promise<void>;
  closeCanvas: () => void;
  refreshCanvas: () => Promise<void>;

  // Canvas item actions
  addTranscript: (title: string, content: string) => Promise<CanvasTranscript>;
  updateTranscript: (tid: string, data: { title?: string; content?: string; caseId?: string | null }) => Promise<void>;
  deleteTranscript: (tid: string) => Promise<void>;

  addQuestion: (text: string, color?: string) => Promise<CanvasQuestion>;
  updateQuestion: (qid: string, data: { text?: string; color?: string; parentQuestionId?: string | null }) => Promise<void>;
  deleteQuestion: (qid: string) => Promise<void>;

  addMemo: (content: string, title?: string, color?: string) => Promise<CanvasMemo>;
  updateMemo: (mid: string, data: { title?: string; content?: string; color?: string }) => Promise<void>;
  deleteMemo: (mid: string) => Promise<void>;

  // Coding
  setPendingSelection: (selection: PendingSelection | null) => void;
  createCoding: (transcriptId: string, questionId: string, startOffset: number, endOffset: number, codedText: string) => Promise<CanvasTextCoding>;
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
  addRelation: (fromType: 'case' | 'question', fromId: string, toType: 'case' | 'question', toId: string, label: string) => Promise<CanvasRelation>;
  updateRelation: (relId: string, label: string) => Promise<void>;
  deleteRelation: (relId: string) => Promise<void>;

  // Computed Nodes
  addComputedNode: (nodeType: ComputedNodeType, label: string, config?: Record<string, unknown>) => Promise<CanvasComputedNode>;
  updateComputedNode: (nodeId: string, data: { label?: string; config?: Record<string, unknown> }) => Promise<void>;
  deleteComputedNode: (nodeId: string) => Promise<void>;
  runComputedNode: (nodeId: string) => Promise<CanvasComputedNode>;

  // Auto-Code
  autoCode: (questionId: string, pattern: string, mode: 'keyword' | 'regex', transcriptIds?: string[]) => Promise<{ created: number }>;

  // In-Vivo / Spread / Merge
  codeInVivo: (transcriptId: string, startOffset: number, endOffset: number, codedText: string) => Promise<CanvasQuestion>;
  spreadToParagraph: (transcriptId: string, startOffset: number, endOffset: number, codedText: string) => Promise<void>;
  mergeQuestions: (sourceId: string, targetId: string) => Promise<void>;

  // Import
  importNarratives: (narratives: { title: string; content: string; sourceType?: string; sourceId?: string }[]) => Promise<void>;
  importFromCanvas: (sourceCanvasId: string, transcriptIds: string[]) => Promise<void>;

  // UI toggles
  toggleCodingStripes: () => void;
}

export const useCanvasStore = create<CanvasState>()((set, get) => ({
  canvases: [],
  loading: false,
  error: null,
  activeCanvasId: null,
  activeCanvas: null,
  pendingSelection: null,
  selectedQuestionId: null,
  showCodingStripes: false,
  savingLayout: false,

  fetchCanvases: async () => {
    set({ loading: true, error: null });
    try {
      const res = await canvasApi.getCanvases();
      set({ canvases: res.data.data, loading: false });
    } catch {
      set({ error: 'Failed to load canvases', loading: false });
    }
  },

  createCanvas: async (name, description) => {
    const res = await canvasApi.createCanvas({ name, description });
    const canvas = res.data.data;
    set(s => ({ canvases: [canvas, ...s.canvases] }));
    return canvas;
  },

  deleteCanvas: async (id) => {
    await canvasApi.deleteCanvas(id);
    set(s => ({
      canvases: s.canvases.filter(c => c.id !== id),
      activeCanvasId: s.activeCanvasId === id ? null : s.activeCanvasId,
      activeCanvas: s.activeCanvasId === id ? null : s.activeCanvas,
    }));
  },

  openCanvas: async (id) => {
    set({ loading: true, error: null });
    try {
      const res = await canvasApi.getCanvas(id);
      set({ activeCanvasId: id, activeCanvas: res.data.data, loading: false });
    } catch {
      set({ error: 'Failed to open canvas', loading: false });
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
    } catch { /* silent */ }
  },

  addTranscript: async (title, content) => {
    const { activeCanvasId } = get();
    if (!activeCanvasId) throw new Error('No canvas open');
    const res = await canvasApi.addTranscript(activeCanvasId, { title, content });
    const transcript = res.data.data;
    set(s => ({
      activeCanvas: s.activeCanvas
        ? { ...s.activeCanvas, transcripts: [...s.activeCanvas.transcripts, transcript] }
        : null,
    }));
    return transcript;
  },

  updateTranscript: async (tid, data) => {
    const { activeCanvasId } = get();
    if (!activeCanvasId) return;
    const res = await canvasApi.updateTranscript(activeCanvasId, tid, data);
    const updated = res.data.data;
    set(s => ({
      activeCanvas: s.activeCanvas
        ? { ...s.activeCanvas, transcripts: s.activeCanvas.transcripts.map((t: CanvasTranscript) => t.id === tid ? { ...t, ...updated } : t) }
        : null,
    }));
  },

  deleteTranscript: async (tid) => {
    const { activeCanvasId } = get();
    if (!activeCanvasId) return;
    await canvasApi.deleteTranscript(activeCanvasId, tid);
    set(s => ({
      activeCanvas: s.activeCanvas
        ? {
            ...s.activeCanvas,
            transcripts: s.activeCanvas.transcripts.filter((t: CanvasTranscript) => t.id !== tid),
            codings: s.activeCanvas.codings.filter((c: CanvasTextCoding) => c.transcriptId !== tid),
          }
        : null,
    }));
  },

  addQuestion: async (text, color) => {
    const { activeCanvasId } = get();
    if (!activeCanvasId) throw new Error('No canvas open');
    const res = await canvasApi.addQuestion(activeCanvasId, { text, color });
    const question = res.data.data;
    set(s => ({
      activeCanvas: s.activeCanvas
        ? { ...s.activeCanvas, questions: [...s.activeCanvas.questions, question] }
        : null,
    }));
    return question;
  },

  updateQuestion: async (qid, data) => {
    const { activeCanvasId } = get();
    if (!activeCanvasId) return;
    const res = await canvasApi.updateQuestion(activeCanvasId, qid, data);
    const updated = res.data.data;
    set(s => ({
      activeCanvas: s.activeCanvas
        ? { ...s.activeCanvas, questions: s.activeCanvas.questions.map((q: CanvasQuestion) => q.id === qid ? { ...q, ...updated } : q) }
        : null,
    }));
  },

  deleteQuestion: async (qid) => {
    const { activeCanvasId } = get();
    if (!activeCanvasId) return;
    await canvasApi.deleteQuestion(activeCanvasId, qid);
    set(s => ({
      activeCanvas: s.activeCanvas
        ? {
            ...s.activeCanvas,
            questions: s.activeCanvas.questions
              .filter((q: CanvasQuestion) => q.id !== qid)
              .map((q: CanvasQuestion) => q.parentQuestionId === qid ? { ...q, parentQuestionId: null } : q),
            codings: s.activeCanvas.codings.filter((c: CanvasTextCoding) => c.questionId !== qid),
          }
        : null,
    }));
  },

  addMemo: async (content, title, color) => {
    const { activeCanvasId } = get();
    if (!activeCanvasId) throw new Error('No canvas open');
    const res = await canvasApi.addMemo(activeCanvasId, { content, title, color });
    const memo = res.data.data;
    set(s => ({
      activeCanvas: s.activeCanvas
        ? { ...s.activeCanvas, memos: [...s.activeCanvas.memos, memo] }
        : null,
    }));
    return memo;
  },

  updateMemo: async (mid, data) => {
    const { activeCanvasId } = get();
    if (!activeCanvasId) return;
    const res = await canvasApi.updateMemo(activeCanvasId, mid, data);
    const updated = res.data.data;
    set(s => ({
      activeCanvas: s.activeCanvas
        ? { ...s.activeCanvas, memos: s.activeCanvas.memos.map((m: CanvasMemo) => m.id === mid ? { ...m, ...updated } : m) }
        : null,
    }));
  },

  deleteMemo: async (mid) => {
    const { activeCanvasId } = get();
    if (!activeCanvasId) return;
    await canvasApi.deleteMemo(activeCanvasId, mid);
    set(s => ({
      activeCanvas: s.activeCanvas
        ? { ...s.activeCanvas, memos: s.activeCanvas.memos.filter((m: CanvasMemo) => m.id !== mid) }
        : null,
    }));
  },

  setPendingSelection: (selection) => set({ pendingSelection: selection }),

  createCoding: async (transcriptId, questionId, startOffset, endOffset, codedText) => {
    const { activeCanvasId } = get();
    if (!activeCanvasId) throw new Error('No canvas open');
    const res = await canvasApi.createCoding(activeCanvasId, {
      transcriptId, questionId, startOffset, endOffset, codedText,
    });
    const coding = res.data.data;
    set(s => ({
      activeCanvas: s.activeCanvas
        ? { ...s.activeCanvas, codings: [...s.activeCanvas.codings, coding] }
        : null,
      pendingSelection: null,
    }));
    return coding;
  },

  deleteCoding: async (codingId) => {
    const { activeCanvasId } = get();
    if (!activeCanvasId) return;
    await canvasApi.deleteCoding(activeCanvasId, codingId);
    set(s => ({
      activeCanvas: s.activeCanvas
        ? { ...s.activeCanvas, codings: s.activeCanvas.codings.filter((c: CanvasTextCoding) => c.id !== codingId) }
        : null,
    }));
  },

  updateCodingAnnotation: async (codingId, annotation) => {
    const { activeCanvasId } = get();
    if (!activeCanvasId) return;
    const res = await canvasApi.updateCoding(activeCanvasId, codingId, { annotation: annotation ?? undefined });
    const updated = res.data.data;
    set(s => ({
      activeCanvas: s.activeCanvas
        ? { ...s.activeCanvas, codings: s.activeCanvas.codings.map((c: CanvasTextCoding) => c.id === codingId ? { ...c, ...updated } : c) }
        : null,
    }));
  },

  reassignCoding: async (codingId, newQuestionId) => {
    const { activeCanvasId } = get();
    if (!activeCanvasId) return;
    await canvasApi.reassignCoding(activeCanvasId, codingId, newQuestionId);
    set(s => ({
      activeCanvas: s.activeCanvas
        ? { ...s.activeCanvas, codings: s.activeCanvas.codings.map((c: CanvasTextCoding) => c.id === codingId ? { ...c, questionId: newQuestionId } : c) }
        : null,
    }));
  },

  saveLayout: async (positions) => {
    const { activeCanvasId } = get();
    if (!activeCanvasId) return;
    set({ savingLayout: true });
    try {
      await canvasApi.saveLayout(activeCanvasId, {
        positions: positions.map(p => ({
          nodeId: p.nodeId,
          nodeType: p.nodeType,
          x: p.x,
          y: p.y,
          width: p.width,
          height: p.height,
          collapsed: p.collapsed,
        })),
      });
    } catch {
      toast.error('Layout save failed');
    } finally {
      set({ savingLayout: false });
    }
  },

  setSelectedQuestionId: (id) => set({ selectedQuestionId: id }),

  // ─── Cases ───

  addCase: async (name, attributes) => {
    const { activeCanvasId } = get();
    if (!activeCanvasId) throw new Error('No canvas open');
    const res = await canvasApi.createCase(activeCanvasId, { name, attributes });
    const caseRecord = res.data.data;
    set(s => ({
      activeCanvas: s.activeCanvas
        ? { ...s.activeCanvas, cases: [...s.activeCanvas.cases, caseRecord] }
        : null,
    }));
    return caseRecord;
  },

  updateCase: async (caseId, data) => {
    const { activeCanvasId } = get();
    if (!activeCanvasId) return;
    const res = await canvasApi.updateCase(activeCanvasId, caseId, data);
    const updated = res.data.data;
    set(s => ({
      activeCanvas: s.activeCanvas
        ? { ...s.activeCanvas, cases: s.activeCanvas.cases.map((c: CanvasCase) => c.id === caseId ? { ...c, ...updated } : c) }
        : null,
    }));
  },

  deleteCase: async (caseId) => {
    const { activeCanvasId } = get();
    if (!activeCanvasId) return;
    await canvasApi.deleteCase(activeCanvasId, caseId);
    set(s => ({
      activeCanvas: s.activeCanvas
        ? {
            ...s.activeCanvas,
            cases: s.activeCanvas.cases.filter((c: CanvasCase) => c.id !== caseId),
            transcripts: s.activeCanvas.transcripts.map((t: CanvasTranscript) =>
              t.caseId === caseId ? { ...t, caseId: null } : t
            ),
            relations: s.activeCanvas.relations.filter((r: CanvasRelation) =>
              !(r.fromType === 'case' && r.fromId === caseId) &&
              !(r.toType === 'case' && r.toId === caseId)
            ),
          }
        : null,
    }));
  },

  // ─── Relations ───

  addRelation: async (fromType, fromId, toType, toId, label) => {
    const { activeCanvasId } = get();
    if (!activeCanvasId) throw new Error('No canvas open');
    const res = await canvasApi.createRelation(activeCanvasId, { fromType, fromId, toType, toId, label });
    const relation = res.data.data;
    set(s => ({
      activeCanvas: s.activeCanvas
        ? { ...s.activeCanvas, relations: [...s.activeCanvas.relations, relation] }
        : null,
    }));
    return relation;
  },

  updateRelation: async (relId, label) => {
    const { activeCanvasId } = get();
    if (!activeCanvasId) return;
    await canvasApi.updateRelation(activeCanvasId, relId, { label });
    set(s => ({
      activeCanvas: s.activeCanvas
        ? { ...s.activeCanvas, relations: s.activeCanvas.relations.map((r: CanvasRelation) => r.id === relId ? { ...r, label } : r) }
        : null,
    }));
  },

  deleteRelation: async (relId) => {
    const { activeCanvasId } = get();
    if (!activeCanvasId) return;
    await canvasApi.deleteRelation(activeCanvasId, relId);
    set(s => ({
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
    set(s => ({
      activeCanvas: s.activeCanvas
        ? { ...s.activeCanvas, computedNodes: [...s.activeCanvas.computedNodes, node] }
        : null,
    }));
    return node;
  },

  updateComputedNode: async (nodeId, data) => {
    const { activeCanvasId } = get();
    if (!activeCanvasId) return;
    const res = await canvasApi.updateComputedNode(activeCanvasId, nodeId, data);
    const updated = res.data.data;
    set(s => ({
      activeCanvas: s.activeCanvas
        ? { ...s.activeCanvas, computedNodes: s.activeCanvas.computedNodes.map((n: CanvasComputedNode) => n.id === nodeId ? { ...n, ...updated } : n) }
        : null,
    }));
  },

  deleteComputedNode: async (nodeId) => {
    const { activeCanvasId } = get();
    if (!activeCanvasId) return;
    await canvasApi.deleteComputedNode(activeCanvasId, nodeId);
    set(s => ({
      activeCanvas: s.activeCanvas
        ? { ...s.activeCanvas, computedNodes: s.activeCanvas.computedNodes.filter((n: CanvasComputedNode) => n.id !== nodeId) }
        : null,
    }));
  },

  runComputedNode: async (nodeId) => {
    const { activeCanvasId } = get();
    if (!activeCanvasId) throw new Error('No canvas open');
    const res = await canvasApi.runComputedNode(activeCanvasId, nodeId);
    const updated = res.data.data;
    set(s => ({
      activeCanvas: s.activeCanvas
        ? { ...s.activeCanvas, computedNodes: s.activeCanvas.computedNodes.map((n: CanvasComputedNode) => n.id === nodeId ? { ...n, ...updated } : n) }
        : null,
    }));
    return updated;
  },

  // ─── Auto-Code ───

  autoCode: async (questionId, pattern, mode, transcriptIds) => {
    const { activeCanvasId } = get();
    if (!activeCanvasId) throw new Error('No canvas open');
    const res = await canvasApi.autoCode(activeCanvasId, { questionId, pattern, mode, transcriptIds });
    const { created, codings } = res.data.data;
    if (codings?.length) {
      set(s => ({
        activeCanvas: s.activeCanvas
          ? { ...s.activeCanvas, codings: [...s.activeCanvas.codings, ...codings] }
          : null,
      }));
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
    const transcript = activeCanvas.transcripts.find(t => t.id === transcriptId);
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

  toggleCodingStripes: () => set(s => ({ showCodingStripes: !s.showCodingStripes })),
}));
