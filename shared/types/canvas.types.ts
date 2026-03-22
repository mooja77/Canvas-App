// ─── Coding Canvas Types ───

export interface CodingCanvas {
  id: string;
  dashboardAccessId: string;
  name: string;
  description?: string;
  deletedAt?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CanvasTranscript {
  id: string;
  canvasId: string;
  title: string;
  content: string;
  sortOrder: number;
  caseId?: string | null;
  sourceType?: string | null;
  sourceId?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CanvasQuestion {
  id: string;
  canvasId: string;
  text: string;
  color: string;
  sortOrder: number;
  parentQuestionId?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CanvasMemo {
  id: string;
  canvasId: string;
  title?: string;
  content: string;
  color: string;
  createdAt: string;
  updatedAt: string;
}

export interface CanvasTextCoding {
  id: string;
  canvasId: string;
  transcriptId: string;
  questionId: string;
  startOffset: number;
  endOffset: number;
  codedText: string;
  note?: string;
  annotation?: string | null;
  createdAt: string;
}

export interface CanvasNodePosition {
  id: string;
  canvasId: string;
  nodeId: string;
  nodeType: string;
  x: number;
  y: number;
  width?: number;
  height?: number;
  collapsed?: boolean;
}

// ─── Cases ───

export interface CanvasCase {
  id: string;
  canvasId: string;
  name: string;
  attributes: Record<string, string>;
  createdAt: string;
  updatedAt: string;
}

// ─── Relations ───

export interface CanvasRelation {
  id: string;
  canvasId: string;
  fromType: 'case' | 'question';
  fromId: string;
  toType: 'case' | 'question';
  toId: string;
  label: string;
  createdAt: string;
}

// ─── Computed Nodes ───

export type ComputedNodeType =
  | 'search' | 'cooccurrence' | 'matrix'
  | 'stats' | 'comparison' | 'wordcloud' | 'cluster'
  | 'codingquery' | 'sentiment' | 'treemap'
  | 'documentportrait' | 'timeline' | 'geomap';

export interface CanvasComputedNode {
  id: string;
  canvasId: string;
  nodeType: ComputedNodeType;
  label: string;
  config: Record<string, unknown>;
  result: Record<string, unknown>;
  updatedAt: string;
  createdAt: string;
}

// Type-specific configs
export interface SearchConfig { pattern: string; mode: 'keyword' | 'regex'; transcriptIds?: string[]; }
export interface CooccurrenceConfig { questionIds: string[]; minOverlap?: number; }
export interface MatrixConfig { questionIds?: string[]; caseIds?: string[]; }
export interface StatsConfig { groupBy: 'question' | 'transcript'; questionIds?: string[]; }
export interface ComparisonConfig { transcriptIds: string[]; questionIds?: string[]; }
export interface WordCloudConfig { questionId?: string; maxWords?: number; stopWords?: string[]; }
export interface ClusterConfig { k: number; questionIds?: string[]; }

// Type-specific results
export interface SearchResult {
  matches: {
    transcriptId: string;
    transcriptTitle: string;
    offset: number;
    matchText: string;
    context: string;
  }[];
}

export interface CooccurrenceResult {
  pairs: {
    questionIds: string[];
    segments: { transcriptId: string; text: string; startOffset: number; endOffset: number; }[];
    count: number;
  }[];
}

export interface MatrixResult {
  rows: {
    caseId: string;
    caseName: string;
    cells: { questionId: string; excerpts: string[]; count: number; }[];
  }[];
}

export interface StatsResult {
  items: { id: string; label: string; count: number; percentage: number; coverage: number; }[];
  total: number;
}

export interface ComparisonResult {
  transcripts: {
    id: string;
    title: string;
    profile: { questionId: string; count: number; coverage: number; }[];
  }[];
}

export interface WordCloudResult {
  words: { text: string; count: number; }[];
}

export interface ClusterResult {
  clusters: {
    id: number;
    label: string;
    segments: { codingId: string; text: string; }[];
    keywords: string[];
  }[];
}

// ─── Coding Query (Boolean) ───
export interface CodingQueryConfig {
  conditions: { questionId: string; operator: 'AND' | 'OR' | 'NOT' }[];
}
export interface CodingQueryResult {
  matches: { transcriptId: string; transcriptTitle: string; text: string; startOffset: number; endOffset: number }[];
  totalMatches: number;
}

// ─── Sentiment Analysis ───
export interface SentimentConfig {
  scope: 'all' | 'question' | 'transcript';
  scopeId?: string;
}
export interface SentimentResult {
  overall: { positive: number; negative: number; neutral: number; averageScore: number };
  items: { id: string; label: string; score: number; magnitude: number; sampleText: string }[];
}

// ─── Treemap / Theme Map ───
export interface TreemapConfig {
  metric: 'count' | 'characters';
  questionIds?: string[];
}
export interface TreemapResult {
  nodes: { id: string; name: string; size: number; color: string; parentId?: string }[];
  total: number;
}

// ─── AI Suggestions ───

export interface AiSuggestion {
  id: string;
  canvasId: string;
  transcriptId: string;
  questionId: string | null;
  suggestedText: string;
  startOffset: number;
  endOffset: number;
  codedText: string;
  confidence: number;
  status: 'pending' | 'accepted' | 'rejected';
  createdAt: string;
}

export interface SuggestCodesInput {
  transcriptId: string;
  codedText: string;
  startOffset: number;
  endOffset: number;
}

export interface AutoCodeTranscriptInput {
  transcriptId: string;
  instructions?: string;
}

// ─── Canvas Sharing ───

export interface CanvasShare {
  id: string;
  canvasId: string;
  shareCode: string;
  createdBy: string;
  expiresAt?: string | null;
  cloneCount: number;
  createdAt: string;
}

// ─── Canvas Collaboration ───

export interface CanvasCollaborator {
  id: string;
  canvasId: string;
  userId: string;
  role: 'owner' | 'editor' | 'viewer';
  invitedBy?: string;
  createdAt: string;
}

// ─── Merge Questions ───
export interface MergeQuestionsInput {
  sourceId: string;
  targetId: string;
}

// Full canvas with all related data
export interface CanvasDetail extends CodingCanvas {
  transcripts: CanvasTranscript[];
  questions: CanvasQuestion[];
  memos: CanvasMemo[];
  codings: CanvasTextCoding[];
  nodePositions: CanvasNodePosition[];
  cases: CanvasCase[];
  relations: CanvasRelation[];
  computedNodes: CanvasComputedNode[];
}

// ─── Input Types ───

export interface CreateCanvasInput {
  name: string;
  description?: string;
}

export interface CreateTranscriptInput {
  title: string;
  content: string;
  sourceType?: string;
  sourceId?: string;
}

export interface UpdateTranscriptInput {
  title?: string;
  content?: string;
  caseId?: string | null;
}

export interface CreateQuestionInput {
  text: string;
  color?: string;
}

export interface UpdateQuestionInput {
  text?: string;
  color?: string;
  parentQuestionId?: string | null;
}

export interface CreateMemoInput {
  title?: string;
  content: string;
  color?: string;
}

export interface UpdateMemoInput {
  title?: string;
  content?: string;
  color?: string;
}

export interface CreateCodingInput {
  transcriptId: string;
  questionId: string;
  startOffset: number;
  endOffset: number;
  codedText: string;
  note?: string;
}

export interface UpdateCodingInput {
  annotation?: string;
}

export interface SaveLayoutInput {
  positions: {
    nodeId: string;
    nodeType: string;
    x: number;
    y: number;
    width?: number;
    height?: number;
    collapsed?: boolean;
  }[];
}

export interface ReassignCodingInput {
  newQuestionId: string;
}

export interface CreateCaseInput {
  name: string;
  attributes?: Record<string, string>;
}

export interface UpdateCaseInput {
  name?: string;
  attributes?: Record<string, string>;
}

export interface CreateRelationInput {
  fromType: 'case' | 'question';
  fromId: string;
  toType: 'case' | 'question';
  toId: string;
  label: string;
}

export interface CreateComputedNodeInput {
  nodeType: ComputedNodeType;
  label: string;
  config?: Record<string, unknown>;
}

export interface UpdateComputedNodeInput {
  label?: string;
  config?: Record<string, unknown>;
}

export interface AutoCodeInput {
  questionId: string;
  pattern: string;
  mode: 'keyword' | 'regex';
  transcriptIds?: string[];
}

// ─── User & Billing Types ───

export type PlanTier = 'free' | 'pro' | 'team';

export interface User {
  id: string;
  email: string;
  name: string;
  role: string;
  plan: PlanTier;
  emailVerified: boolean;
  createdAt: string;
}

export interface SubscriptionInfo {
  status: 'active' | 'past_due' | 'canceled' | 'trialing';
  currentPeriodEnd: string;
  cancelAtPeriodEnd: boolean;
}

export interface PlanLimitError {
  success: false;
  error: string;
  code: 'PLAN_LIMIT_EXCEEDED';
  limit: string;
  current: number;
  max: number;
  upgrade: true;
}

// ─── Research Assistant Types ───

export interface ChatMessage {
  id: string;
  canvasId: string;
  userId?: string;
  role: 'user' | 'assistant';
  content: string;
  citations: { sourceType: string; sourceId: string; text: string }[];
  createdAt: string;
}

export interface Summary {
  id: string;
  canvasId: string;
  sourceType: string;
  sourceId?: string;
  summaryText: string;
  summaryType: 'paraphrase' | 'abstract' | 'thematic';
  createdAt: string;
  updatedAt: string;
}

// ─── Document & Region Coding Types ───

export interface CanvasDocument {
  id: string;
  canvasId: string;
  fileUploadId: string;
  title: string;
  docType: 'image' | 'pdf';
  pageCount: number;
  metadata: Record<string, unknown>;
  createdAt: string;
}

export interface DocumentRegionCoding {
  id: string;
  documentId: string;
  questionId: string;
  pageNumber: number;
  x: number;
  y: number;
  width: number;
  height: number;
  note?: string;
  createdAt: string;
}

// ─── Training Center Types ───

export interface TrainingDocument {
  id: string;
  canvasId: string;
  transcriptId: string;
  name: string;
  instructions?: string;
  goldCodings: { questionId: string; startOffset: number; endOffset: number; codedText: string }[];
  passThreshold: number;
  createdAt: string;
}

export interface TrainingAttempt {
  id: string;
  trainingDocumentId: string;
  userId: string;
  codings: unknown;
  kappaScore?: number;
  passed: boolean;
  createdAt: string;
}

// ─── Timeline ───

export interface TimelineConfig {
  transcriptIds?: string[];
}

export interface TimelineResult {
  entries: {
    transcriptId: string;
    title: string;
    date: string;
    codings: {
      codingId: string;
      codedText: string;
      questionId: string;
      questionText: string;
      questionColor: string;
    }[];
    codingCount: number;
  }[];
  totalDated: number;
  totalUndated: number;
}

// ─── GeoMap ───

export interface GeoMapConfig {
  transcriptIds?: string[];
}

export interface GeoMapResult {
  points: {
    transcriptId: string;
    title: string;
    latitude: number;
    longitude: number;
    locationName: string;
    codingCount: number;
  }[];
  totalMapped: number;
  totalUnmapped: number;
}

// ─── Research Repository ───

export interface ResearchRepository {
  id: string;
  userId: string;
  name: string;
  description?: string;
  createdAt: string;
}

export interface RepositoryInsight {
  id: string;
  repositoryId: string;
  canvasId?: string;
  title: string;
  content: string;
  tags: string[];
  sourceType?: string;
  sourceId?: string;
  createdAt: string;
}

// ─── Integration ───

export interface Integration {
  id: string;
  userId: string;
  provider: string;
  metadata: Record<string, unknown>;
  expiresAt?: string;
  createdAt: string;
}
