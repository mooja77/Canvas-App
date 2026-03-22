import axios from 'axios';
import { useAuthStore } from '../stores/authStore';
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
  SuggestCodesInput,
  AutoCodeTranscriptInput,
} from '@canvas-app/shared';

// ─── Canvas API client (points to Canvas App backend) ───

const API_BASE = import.meta.env.VITE_API_URL || '/api';

export const canvasClient = axios.create({
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
      const authType = parsed?.state?.authType;
      if (jwt) {
        if (authType === 'email') {
          config.headers['Authorization'] = `Bearer ${jwt}`;
        } else {
          config.headers['x-dashboard-code'] = jwt;
        }
      }
    }
  } catch { /* ignore */ }
  return config;
});

// Plan limit interceptor — fires custom event on PLAN_LIMIT_EXCEEDED
canvasClient.interceptors.response.use(
  response => response,
  error => {
    if (error.response?.status === 403 && error.response?.data?.code === 'PLAN_LIMIT_EXCEEDED') {
      const detail = error.response.data;
      window.dispatchEvent(new CustomEvent('plan-limit-exceeded', { detail }));
    }
    return Promise.reject(error);
  }
);

// Plan sync interceptor — reads X-User-Plan header from server
canvasClient.interceptors.response.use(
  response => {
    const serverPlan = response.headers['x-user-plan'];
    if (serverPlan) {
      const currentPlan = useAuthStore.getState().plan;
      if (currentPlan && currentPlan !== serverPlan) {
        useAuthStore.getState().updatePlan(serverPlan);
      }
    }
    return response;
  },
  error => Promise.reject(error)
);

let isRedirecting = false;

// 401 interceptor — expired JWT redirect
canvasClient.interceptors.response.use(
  response => response,
  error => {
    if (error.response?.status === 401 && error.response?.data?.code !== 'PLAN_LIMIT_EXCEEDED') {
      if (!isRedirecting && useAuthStore.getState().authenticated) {
        isRedirecting = true;
        useAuthStore.getState().logout();
        window.location.href = '/login?expired=true';
        setTimeout(() => { isRedirecting = false; }, 2000);
      }
    }
    return Promise.reject(error);
  }
);

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

  // ─── Trash (soft delete) ───
  getTrash: () =>
    canvasClient.get('/canvas/trash'),

  restoreCanvas: (canvasId: string) =>
    canvasClient.post(`/canvas/${canvasId}/restore`),

  permanentDeleteCanvas: (canvasId: string) =>
    canvasClient.delete(`/canvas/${canvasId}/permanent`),

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

  // ─── AI ───
  aiSuggestCodes: (canvasId: string, data: SuggestCodesInput) =>
    canvasClient.post(`/canvas/${canvasId}/ai/suggest-codes`, data),

  aiAutoCodeTranscript: (canvasId: string, data: AutoCodeTranscriptInput) =>
    canvasClient.post(`/canvas/${canvasId}/ai/auto-code-transcript`, data),

  getAiSuggestions: (canvasId: string, params?: { status?: string; transcriptId?: string }) =>
    canvasClient.get(`/canvas/${canvasId}/ai/suggestions`, { params }),

  updateAiSuggestion: (canvasId: string, suggestionId: string, data: { status: 'accepted' | 'rejected' }) =>
    canvasClient.put(`/canvas/${canvasId}/ai/suggestions/${suggestionId}`, data),

  bulkActionAiSuggestions: (canvasId: string, data: { suggestionIds: string[]; action: 'accepted' | 'rejected' }) =>
    canvasClient.post(`/canvas/${canvasId}/ai/suggestions/bulk-action`, data),

  // ─── Research Assistant ───
  embedCanvasData: (canvasId: string) =>
    canvasClient.post(`/canvas/${canvasId}/ai/embed`),

  chatQuery: (canvasId: string, message: string) =>
    canvasClient.post(`/canvas/${canvasId}/ai/chat`, { message }),

  getChatHistory: (canvasId: string) =>
    canvasClient.get(`/canvas/${canvasId}/ai/chat/history`),

  generateSummary: (canvasId: string, data: { sourceType: string; sourceId?: string; summaryType?: string }) =>
    canvasClient.post(`/canvas/${canvasId}/ai/summarize`, data),

  getSummaries: (canvasId: string, params?: { sourceType?: string; sourceId?: string }) =>
    canvasClient.get(`/canvas/${canvasId}/summaries`, { params }),

  updateSummary: (canvasId: string, sid: string, data: { summaryText: string }) =>
    canvasClient.put(`/canvas/${canvasId}/summaries/${sid}`, data),

  // ─── File Upload & Transcription ───
  getPresignedUploadUrl: (canvasId: string, data: { fileName: string; contentType: string }) =>
    canvasClient.post(`/canvas/${canvasId}/upload/presigned`, data),

  confirmUpload: (canvasId: string, data: { storageKey: string; originalName: string; mimeType: string; sizeBytes: number }) =>
    canvasClient.post(`/canvas/${canvasId}/upload/confirm`, data),

  uploadFileDirect: (canvasId: string, formData: FormData, onProgress?: (pct: number) => void) =>
    canvasClient.post(`/canvas/${canvasId}/upload/direct`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
      onUploadProgress: (e) => {
        if (onProgress && e.total) onProgress(Math.round((e.loaded / e.total) * 100));
      },
    }),

  startTranscription: (canvasId: string, data: { fileUploadId: string; language?: string }) =>
    canvasClient.post(`/canvas/${canvasId}/transcribe`, data),

  getTranscriptionJob: (canvasId: string, jobId: string) =>
    canvasClient.get(`/canvas/${canvasId}/transcribe/${jobId}`),

  acceptTranscription: (canvasId: string, jobId: string, title?: string) =>
    canvasClient.post(`/canvas/${canvasId}/transcribe/${jobId}/accept`, { title }),

  // ─── Collaboration ───
  getCollaborators: (canvasId: string) =>
    canvasClient.get(`/canvas/${canvasId}/collaborators`),

  addCollaborator: (canvasId: string, data: { userId: string; role?: string }) =>
    canvasClient.post(`/canvas/${canvasId}/collaborators`, data),

  removeCollaborator: (canvasId: string, userId: string) =>
    canvasClient.delete(`/canvas/${canvasId}/collaborators/${userId}`),

  // ─── Documents & Region Coding ───
  createDocument: (canvasId: string, data: { fileUploadId: string; title: string; docType: string; pageCount?: number; metadata?: Record<string, unknown> }) =>
    canvasClient.post(`/canvas/${canvasId}/documents`, data),

  getDocuments: (canvasId: string) =>
    canvasClient.get(`/canvas/${canvasId}/documents`),

  deleteDocument: (canvasId: string, docId: string) =>
    canvasClient.delete(`/canvas/${canvasId}/documents/${docId}`),

  createRegionCoding: (canvasId: string, docId: string, data: { questionId: string; pageNumber?: number; x: number; y: number; width: number; height: number; note?: string }) =>
    canvasClient.post(`/canvas/${canvasId}/documents/${docId}/regions`, data),

  getRegionCodings: (canvasId: string, docId: string) =>
    canvasClient.get(`/canvas/${canvasId}/documents/${docId}/regions`),

  deleteRegionCoding: (canvasId: string, docId: string, regionId: string) =>
    canvasClient.delete(`/canvas/${canvasId}/documents/${docId}/regions/${regionId}`),

  // ─── Training Center ───
  createTrainingDocument: (canvasId: string, data: { transcriptId: string; name: string; instructions?: string; goldCodings: unknown[]; passThreshold?: number }) =>
    canvasClient.post(`/canvas/${canvasId}/training`, data),

  getTrainingDocuments: (canvasId: string) =>
    canvasClient.get(`/canvas/${canvasId}/training`),

  getTrainingDocument: (canvasId: string, docId: string) =>
    canvasClient.get(`/canvas/${canvasId}/training/${docId}`),

  deleteTrainingDocument: (canvasId: string, docId: string) =>
    canvasClient.delete(`/canvas/${canvasId}/training/${docId}`),

  submitTrainingAttempt: (canvasId: string, docId: string, data: { codings: unknown[] }) =>
    canvasClient.post(`/canvas/${canvasId}/training/${docId}/attempt`, data),

  getTrainingAttempts: (canvasId: string, docId: string) =>
    canvasClient.get(`/canvas/${canvasId}/training/${docId}/attempts`),

  // ─── QDPX Import/Export ───
  exportQdpx: (canvasId: string) =>
    canvasClient.get(`/canvas/${canvasId}/export/qdpx`, { responseType: 'arraybuffer' }),

  importQdpx: (canvasId: string, formData: FormData) =>
    canvasClient.post(`/canvas/${canvasId}/import/qdpx`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    }),

  // ─── Repository & Insights ───
  getRepositories: () =>
    canvasClient.get('/repositories'),

  createRepository: (data: { name: string; description?: string; canvasIds?: string[] }) =>
    canvasClient.post('/repositories', data),

  deleteRepository: (repoId: string) =>
    canvasClient.delete(`/repositories/${repoId}`),

  getInsights: (repoId: string) =>
    canvasClient.get(`/repositories/${repoId}/insights`),

  createInsight: (repoId: string, data: { title: string; content: string; type?: string }) =>
    canvasClient.post(`/repositories/${repoId}/insights`, data),

  deleteInsight: (repoId: string, insightId: string) =>
    canvasClient.delete(`/repositories/${repoId}/insights/${insightId}`),

  // ─── Integrations ───
  getIntegrations: () =>
    canvasClient.get('/integrations'),

  connectIntegration: (data: { provider: string; accessToken: string; refreshToken?: string; metadata?: Record<string, unknown>; expiresAt?: string }) =>
    canvasClient.post('/integrations/connect', data),

  disconnectIntegration: (integrationId: string) =>
    canvasClient.delete(`/integrations/${integrationId}`),
};

// ─── Auth API ───

export const authApi = {
  // Legacy access-code auth
  login: (dashboardCode: string) =>
    canvasClient.post('/auth', { dashboardCode }),

  register: (name: string, role?: string) =>
    canvasClient.post('/auth/register', { name, role }),

  // Email auth
  emailSignup: (email: string, password: string, name: string) =>
    canvasClient.post('/auth/signup', { email, password, name }),

  emailLogin: (email: string, password: string) =>
    canvasClient.post('/auth/email-login', { email, password }),

  googleLogin: (credential: string) =>
    canvasClient.post('/auth/google', { credential }),

  forgotPassword: (email: string) =>
    canvasClient.post('/auth/forgot-password', { email }),

  resetPassword: (email: string, token: string, newPassword: string) =>
    canvasClient.post('/auth/reset-password', { email, token, newPassword }),

  getMe: () =>
    canvasClient.get('/auth/me'),

  linkAccount: (email: string, password: string, name?: string) =>
    canvasClient.post('/auth/link-account', { email, password, name }),

  updateProfile: (data: { name?: string; email?: string }) =>
    canvasClient.put('/auth/profile', data),

  changePassword: (currentPassword: string, newPassword: string) =>
    canvasClient.put('/auth/change-password', { currentPassword, newPassword }),

  deleteAccount: (password: string) =>
    canvasClient.delete('/auth/account', { data: { password } }),
};

// ─── AI Settings API ───

export const aiSettingsApi = {
  getSettings: () =>
    canvasClient.get('/ai-settings'),

  updateSettings: (data: { provider: string; apiKey: string; model?: string; embeddingModel?: string }) =>
    canvasClient.put('/ai-settings', data),

  deleteSettings: () =>
    canvasClient.delete('/ai-settings'),
};

// ─── Billing API ───

export const billingApi = {
  createCheckout: (priceId: string, plan: string) =>
    canvasClient.post('/billing/create-checkout', { priceId, plan }),

  createPortal: () =>
    canvasClient.post('/billing/create-portal'),

  getSubscription: () =>
    canvasClient.get('/billing/subscription'),
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
