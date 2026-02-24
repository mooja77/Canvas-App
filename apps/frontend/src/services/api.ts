import axios from 'axios';
import type {
  CreateCanvasInput,
  CreateTranscriptInput,
  UpdateTranscriptInput,
  CreateQuestionInput,
  UpdateQuestionInput,
  CreateMemoInput,
  UpdateMemoInput,
  CreateCodingInput,
  UpdateCodingInput,
  SaveLayoutInput,
  CreateCaseInput,
  UpdateCaseInput,
  CreateRelationInput,
  CreateComputedNodeInput,
  UpdateComputedNodeInput,
  AutoCodeInput,
} from '@canvas-app/shared';

// ─── Canvas API client (points to Canvas App backend) ───

const API_BASE = import.meta.env.VITE_API_URL || '/api';

const canvasClient = axios.create({
  baseURL: API_BASE,
  headers: { 'Content-Type': 'application/json' },
});

// Inject auth token from authStore
canvasClient.interceptors.request.use(config => {
  try {
    const stored = localStorage.getItem('canvas-app-auth');
    if (stored) {
      const parsed = JSON.parse(stored);
      const jwt = parsed?.state?.jwt;
      if (jwt) {
        config.headers['x-dashboard-code'] = jwt;
      }
    }
  } catch { /* ignore */ }
  return config;
});

export const canvasApi = {
  // ─── Canvas CRUD ───
  getCanvases: () =>
    canvasClient.get('/canvas'),

  createCanvas: (data: CreateCanvasInput) =>
    canvasClient.post('/canvas', data),

  getCanvas: (canvasId: string) =>
    canvasClient.get(`/canvas/${canvasId}`),

  updateCanvas: (canvasId: string, data: Partial<CreateCanvasInput>) =>
    canvasClient.put(`/canvas/${canvasId}`, data),

  deleteCanvas: (canvasId: string) =>
    canvasClient.delete(`/canvas/${canvasId}`),

  // ─── Transcripts ───
  addTranscript: (canvasId: string, data: CreateTranscriptInput) =>
    canvasClient.post(`/canvas/${canvasId}/transcripts`, data),

  updateTranscript: (canvasId: string, tid: string, data: UpdateTranscriptInput) =>
    canvasClient.put(`/canvas/${canvasId}/transcripts/${tid}`, data),

  deleteTranscript: (canvasId: string, tid: string) =>
    canvasClient.delete(`/canvas/${canvasId}/transcripts/${tid}`),

  // ─── Questions ───
  addQuestion: (canvasId: string, data: CreateQuestionInput) =>
    canvasClient.post(`/canvas/${canvasId}/questions`, data),

  updateQuestion: (canvasId: string, qid: string, data: UpdateQuestionInput) =>
    canvasClient.put(`/canvas/${canvasId}/questions/${qid}`, data),

  deleteQuestion: (canvasId: string, qid: string) =>
    canvasClient.delete(`/canvas/${canvasId}/questions/${qid}`),

  // ─── Memos ───
  addMemo: (canvasId: string, data: CreateMemoInput) =>
    canvasClient.post(`/canvas/${canvasId}/memos`, data),

  updateMemo: (canvasId: string, mid: string, data: UpdateMemoInput) =>
    canvasClient.put(`/canvas/${canvasId}/memos/${mid}`, data),

  deleteMemo: (canvasId: string, mid: string) =>
    canvasClient.delete(`/canvas/${canvasId}/memos/${mid}`),

  // ─── Codings ───
  createCoding: (canvasId: string, data: CreateCodingInput) =>
    canvasClient.post(`/canvas/${canvasId}/codings`, data),

  deleteCoding: (canvasId: string, codingId: string) =>
    canvasClient.delete(`/canvas/${canvasId}/codings/${codingId}`),

  reassignCoding: (canvasId: string, codingId: string, newQuestionId: string) =>
    canvasClient.put(`/canvas/${canvasId}/codings/${codingId}/reassign`, { newQuestionId }),

  updateCoding: (canvasId: string, codingId: string, data: UpdateCodingInput) =>
    canvasClient.put(`/canvas/${canvasId}/codings/${codingId}`, data),

  // ─── Layout ───
  saveLayout: (canvasId: string, data: SaveLayoutInput) =>
    canvasClient.put(`/canvas/${canvasId}/layout`, data),

  // ─── Cases ───
  createCase: (canvasId: string, data: CreateCaseInput) =>
    canvasClient.post(`/canvas/${canvasId}/cases`, data),

  updateCase: (canvasId: string, caseId: string, data: UpdateCaseInput) =>
    canvasClient.put(`/canvas/${canvasId}/cases/${caseId}`, data),

  deleteCase: (canvasId: string, caseId: string) =>
    canvasClient.delete(`/canvas/${canvasId}/cases/${caseId}`),

  // ─── Relations ───
  createRelation: (canvasId: string, data: CreateRelationInput) =>
    canvasClient.post(`/canvas/${canvasId}/relations`, data),

  updateRelation: (canvasId: string, relId: string, data: { label: string }) =>
    canvasClient.put(`/canvas/${canvasId}/relations/${relId}`, data),

  deleteRelation: (canvasId: string, relId: string) =>
    canvasClient.delete(`/canvas/${canvasId}/relations/${relId}`),

  // ─── Computed Nodes ───
  createComputedNode: (canvasId: string, data: CreateComputedNodeInput) =>
    canvasClient.post(`/canvas/${canvasId}/computed`, data),

  updateComputedNode: (canvasId: string, nodeId: string, data: UpdateComputedNodeInput) =>
    canvasClient.put(`/canvas/${canvasId}/computed/${nodeId}`, data),

  deleteComputedNode: (canvasId: string, nodeId: string) =>
    canvasClient.delete(`/canvas/${canvasId}/computed/${nodeId}`),

  runComputedNode: (canvasId: string, nodeId: string) =>
    canvasClient.post(`/canvas/${canvasId}/computed/${nodeId}/run`),

  // ─── Auto-Code ───
  autoCode: (canvasId: string, data: AutoCodeInput) =>
    canvasClient.post(`/canvas/${canvasId}/auto-code`, data),

  // ─── Merge Questions ───
  mergeQuestions: (canvasId: string, sourceId: string, targetId: string) =>
    canvasClient.post(`/canvas/${canvasId}/questions/merge`, { sourceId, targetId }),

  // ─── Import Narratives (pre-formatted) ───
  importNarratives: (canvasId: string, data: { narratives: { title: string; content: string; sourceType?: string; sourceId?: string }[] }) =>
    canvasClient.post(`/canvas/${canvasId}/import-narratives`, data),

  // ─── Import from Canvas ───
  importFromCanvas: (canvasId: string, data: { sourceCanvasId: string; transcriptIds: string[] }) =>
    canvasClient.post(`/canvas/${canvasId}/import-from-canvas`, data),

  // ─── Canvas Sharing ───
  shareCanvas: (canvasId: string) =>
    canvasClient.post(`/canvas/${canvasId}/share`),

  getShares: (canvasId: string) =>
    canvasClient.get(`/canvas/${canvasId}/shares`),

  revokeShare: (canvasId: string, shareId: string) =>
    canvasClient.delete(`/canvas/${canvasId}/share/${shareId}`),

  cloneCanvas: (shareCode: string) =>
    canvasClient.post(`/canvas/clone/${shareCode}`),

  getSharedCanvas: (shareCode: string) =>
    canvasClient.get(`/canvas/shared/${shareCode}`),
};

// ─── Auth API ───

export const authApi = {
  login: (dashboardCode: string) =>
    canvasClient.post('/auth', { dashboardCode }),

  register: (name: string, role?: string) =>
    canvasClient.post('/auth/register', { name, role }),
};

// ─── WISEShift Bridge Client (for importing narratives from WISEShift) ───

export function createWiseShiftBridge(baseUrl: string, dashboardCode: string) {
  const client = axios.create({
    baseURL: baseUrl,
    headers: {
      'Content-Type': 'application/json',
      'x-dashboard-code': dashboardCode,
    },
    timeout: 10000,
  });

  return {
    getNarratives: (params: { ids?: string; assessmentId?: string }) =>
      client.get('/api/v1/research/narratives', { params }),

    getAssessments: () =>
      client.get('/api/v1/research/assessments'),
  };
}
