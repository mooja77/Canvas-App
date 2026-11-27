import type { Node } from '@xyflow/react';
import { isDenseEdgeGraph, resolveEdgeSync, shouldCullOffscreenElements } from './canvasEdgeUtils';
import { decorateNodes } from './canvasNodeDecoration';

export interface CanvasBenchmarkPreset {
  transcripts: number;
  wordsPerTranscript: number;
  codes: number;
  codings: number;
  relations: number;
  memos: number;
}

export const CANVAS_BENCHMARK_PRESETS = {
  small: {
    transcripts: 10,
    wordsPerTranscript: 300,
    codes: 15,
    codings: 80,
    relations: 10,
    memos: 5,
  },
  medium: {
    transcripts: 30,
    wordsPerTranscript: 800,
    codes: 40,
    codings: 400,
    relations: 40,
    memos: 15,
  },
  large: {
    transcripts: 60,
    wordsPerTranscript: 1200,
    codes: 80,
    codings: 1500,
    relations: 120,
    memos: 30,
  },
} as const satisfies Record<string, CanvasBenchmarkPreset>;

export type CanvasBenchmarkPresetName = keyof typeof CANVAS_BENCHMARK_PRESETS;

export interface MeasurableCanvasLike {
  transcripts?: Array<{ id: string; content?: string | null }>;
  questions?: Array<{ id: string }>;
  memos?: Array<{ id: string }>;
  cases?: Array<{ id: string }>;
  computedNodes?: Array<{ id: string }>;
  codings?: Array<{ id: string; transcriptId: string; questionId: string }>;
  relations?: Array<{ id: string; fromId: string; toId: string }>;
}

export interface CanvasScaleSummary {
  nodeCount: number;
  edgeCount: number;
  codingCount: number;
  transcriptCount: number;
  codeCount: number;
  totalWords: number;
  longestTranscriptWords: number;
  isLarge: boolean;
  cullingActive: boolean;
  denseEdgeModeActive: boolean;
}

export interface CanvasBenchmarkReport {
  preset: CanvasBenchmarkPresetName;
  scale: CanvasScaleSummary;
  timingsMs: {
    wordCountMs: number;
    codingEdgeBundleMs: number;
    decorateIdleMs: number;
    decorateSearchMs: number;
    edgeSyncMs: number;
    totalMs: number;
  };
  idlePreservedReference: boolean;
}

export function countWordsFast(text: string | null | undefined): number {
  if (!text) return 0;
  let count = 0;
  let inWord = false;
  for (let i = 0; i < text.length; i++) {
    const code = text.charCodeAt(i);
    const isSpace = code === 32 || code === 9 || code === 10 || code === 13;
    if (isSpace) {
      inWord = false;
    } else if (!inWord) {
      inWord = true;
      count++;
    }
  }
  return count;
}

export function summarizeCanvasScale(canvas: MeasurableCanvasLike | null | undefined): CanvasScaleSummary {
  const transcripts = canvas?.transcripts ?? [];
  const questions = canvas?.questions ?? [];
  const memos = canvas?.memos ?? [];
  const cases = canvas?.cases ?? [];
  const computedNodes = canvas?.computedNodes ?? [];
  const codings = canvas?.codings ?? [];
  const relations = canvas?.relations ?? [];

  let totalWords = 0;
  let longestTranscriptWords = 0;
  for (let i = 0; i < transcripts.length; i++) {
    const words = countWordsFast(transcripts[i].content);
    totalWords += words;
    if (words > longestTranscriptWords) longestTranscriptWords = words;
  }

  const pairKeys = new Set<string>();
  for (let i = 0; i < codings.length; i++) {
    pairKeys.add(`${codings[i].transcriptId}:${codings[i].questionId}`);
  }

  const nodeCount = transcripts.length + questions.length + memos.length + cases.length + computedNodes.length;
  const edgeCount = pairKeys.size + relations.length;
  const cullingActive = shouldCullOffscreenElements(nodeCount);
  const denseEdgeModeActive = isDenseEdgeGraph(edgeCount);

  return {
    nodeCount,
    edgeCount,
    codingCount: codings.length,
    transcriptCount: transcripts.length,
    codeCount: questions.length,
    totalWords,
    longestTranscriptWords,
    isLarge: cullingActive || denseEdgeModeActive,
    cullingActive,
    denseEdgeModeActive,
  };
}

export function generateSyntheticCanvas(presetName: CanvasBenchmarkPresetName): Required<MeasurableCanvasLike> {
  const preset = CANVAS_BENCHMARK_PRESETS[presetName];
  const sampleSentence = 'Participant described recurring workflow delays and clear benefits from visual grouping. ';
  const sentenceWords = 11;
  const repeats = Math.max(1, Math.ceil(preset.wordsPerTranscript / sentenceWords));
  const content = sampleSentence.repeat(repeats);

  const transcripts = Array.from({ length: preset.transcripts }, (_, i) => ({
    id: `t-${i + 1}`,
    content,
  }));
  const questions = Array.from({ length: preset.codes }, (_, i) => ({
    id: `q-${i + 1}`,
  }));
  const memos = Array.from({ length: preset.memos }, (_, i) => ({
    id: `m-${i + 1}`,
  }));
  const codings = Array.from({ length: preset.codings }, (_, i) => ({
    id: `c-${i + 1}`,
    transcriptId: transcripts[i % transcripts.length].id,
    questionId: questions[i % questions.length].id,
  }));
  const relations = Array.from({ length: preset.relations }, (_, i) => ({
    id: `r-${i + 1}`,
    fromId: questions[i % questions.length].id,
    toId: questions[(i + 1) % questions.length].id,
  }));

  return {
    transcripts,
    questions,
    memos,
    cases: [],
    computedNodes: [],
    codings,
    relations,
  };
}

export function measureCanvasOperations(presetName: CanvasBenchmarkPresetName): CanvasBenchmarkReport {
  const sample = generateSyntheticCanvas(presetName);

  const t0 = performance.now();
  const scale = summarizeCanvasScale(sample);
  const t1 = performance.now();

  const bundled = new Map<string, string[]>();
  for (let i = 0; i < sample.codings.length; i++) {
    const c = sample.codings[i];
    const key = `${c.transcriptId}:${c.questionId}`;
    const list = bundled.get(key);
    if (list) list.push(c.id);
    else bundled.set(key, [c.id]);
  }
  const freshEdges = Array.from(bundled.entries(), ([id, codingIds]) => ({ id, codingIds }));
  const t2 = performance.now();

  const nodes: Node[] = [
    ...sample.transcripts.map((t, idx) => ({
      id: `transcript-${t.id}`,
      position: { x: (idx % 10) * 320, y: Math.floor(idx / 10) * 260 },
      data: { label: t.id },
    })),
    ...sample.questions.map((q, idx) => ({
      id: `question-${q.id}`,
      position: { x: (idx % 10) * 240, y: 2000 + Math.floor(idx / 10) * 140 },
      data: { label: q.id },
    })),
    ...sample.memos.map((m, idx) => ({
      id: `memo-${m.id}`,
      position: { x: (idx % 10) * 260, y: 3400 + Math.floor(idx / 10) * 160 },
      data: { label: m.id },
    })),
  ];

  const idleResult = decorateNodes(nodes, { highlightedNodeIds: new Set(), mutedNodeIds: new Set() });
  const t3 = performance.now();

  decorateNodes(nodes, {
    highlightedNodeIds: new Set(['transcript-t-1', 'question-q-1', 'question-q-2']),
    mutedNodeIds: new Set(['memo-m-1']),
  });
  const t4 = performance.now();

  resolveEdgeSync(true, [], freshEdges);
  const t5 = performance.now();

  return {
    preset: presetName,
    scale,
    timingsMs: {
      wordCountMs: Number((t1 - t0).toFixed(3)),
      codingEdgeBundleMs: Number((t2 - t1).toFixed(3)),
      decorateIdleMs: Number((t3 - t2).toFixed(3)),
      decorateSearchMs: Number((t4 - t3).toFixed(3)),
      edgeSyncMs: Number((t5 - t4).toFixed(3)),
      totalMs: Number((t5 - t0).toFixed(3)),
    },
    idlePreservedReference: idleResult === nodes,
  };
}
