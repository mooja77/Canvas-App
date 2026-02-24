// ─── Coding Canvas Types ───

export interface CodingCanvas {
  id: string;
  dashboardAccessId: string;
  name: string;
  description?: string;
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
  | 'codingquery' | 'sentiment' | 'treemap';

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
