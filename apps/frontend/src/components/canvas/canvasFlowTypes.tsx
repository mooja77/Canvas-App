import { lazy, Suspense, type ComponentType } from 'react';
import type { EdgeTypes, NodeProps, NodeTypes } from '@xyflow/react';
import { ErrorBoundary } from '../ErrorBoundary';
import TranscriptNode from './nodes/TranscriptNode';
import QuestionNode from './nodes/QuestionNode';
import MemoNode from './nodes/MemoNode';
import CaseNode from './nodes/CaseNode';
import GroupNode from './nodes/GroupNode';
import StickyNoteNode from './nodes/StickyNoteNode';
import RerouteNode from './nodes/RerouteNode';
import SearchResultNode from './nodes/SearchResultNode';
import CodingQueryNode from './nodes/CodingQueryNode';
import DocumentNode from './nodes/DocumentNode';
import DocumentPortraitNode from './nodes/DocumentPortraitNode';
import CodingEdge from './edges/CodingEdge';
import RelationEdge from './edges/RelationEdge';

// React Flow perf fix #4 — lazy-load chart-heavy node types so recharts
// (~150KB) and visx (~60KB) aren't in the initial canvas bundle. These
// nodes only appear when the user has actually run an analysis, so they're
// not on the typical first-canvas-load critical path.
const CooccurrenceNode = lazy(() => import('./nodes/CooccurrenceNode'));
const MatrixNode = lazy(() => import('./nodes/MatrixNode'));
const StatsNode = lazy(() => import('./nodes/StatsNode'));
const ComparisonNode = lazy(() => import('./nodes/ComparisonNode'));
const WordCloudNode = lazy(() => import('./nodes/WordCloudNode'));
const ClusterNode = lazy(() => import('./nodes/ClusterNode'));
const SentimentNode = lazy(() => import('./nodes/SentimentNode'));
const TreemapNode = lazy(() => import('./nodes/TreemapNode'));
const TimelineNode = lazy(() => import('./nodes/TimelineNode'));
const GeoMapNode = lazy(() => import('./nodes/GeoMapNode'));

function asNodeComponent(component: unknown) {
  return component as ComponentType<NodeProps>;
}

function withErrorBoundary(NodeComponent: ComponentType<NodeProps>) {
  const WrappedNode = function WrappedNode(props: NodeProps) {
    return (
      <ErrorBoundary>
        <NodeComponent {...props} />
      </ErrorBoundary>
    );
  };
  WrappedNode.displayName = `WithErrorBoundary(${NodeComponent.displayName || NodeComponent.name || 'Component'})`;
  return WrappedNode;
}

// Tiny placeholder shown while a chart node's chunk is loading. Matches the
// 280×180 default chart-node size so the canvas doesn't jump on mount.
function NodeLoadingSkeleton() {
  return (
    <div
      className="flex h-[180px] w-[280px] items-center justify-center rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 shadow-sm"
      aria-label="Loading analysis node"
    >
      <div className="flex items-center gap-2 text-xs text-gray-400">
        <span className="inline-block h-2 w-2 animate-pulse rounded-full bg-gray-300" />
        <span>Loading analysis…</span>
      </div>
    </div>
  );
}

function withSuspense(NodeComponent: ComponentType<NodeProps>) {
  const Wrapped = function SuspendedNode(props: NodeProps) {
    return (
      <Suspense fallback={<NodeLoadingSkeleton />}>
        <NodeComponent {...props} />
      </Suspense>
    );
  };
  Wrapped.displayName = `Suspended(${NodeComponent.displayName || NodeComponent.name || 'LazyNode'})`;
  return Wrapped;
}

// Order: eager nodes first (always on canvas), then lazy chart nodes
// wrapped in withSuspense() so their chunks load on first appearance.
export const nodeTypes: NodeTypes = {
  transcript: asNodeComponent(TranscriptNode),
  question: asNodeComponent(QuestionNode),
  memo: asNodeComponent(MemoNode),
  case: asNodeComponent(CaseNode),
  group: asNodeComponent(GroupNode),
  sticky: asNodeComponent(StickyNoteNode),
  reroute: asNodeComponent(RerouteNode),
  search: withErrorBoundary(asNodeComponent(SearchResultNode)),
  codingquery: withErrorBoundary(asNodeComponent(CodingQueryNode)),
  document: withErrorBoundary(asNodeComponent(DocumentNode)),
  documentportrait: withErrorBoundary(asNodeComponent(DocumentPortraitNode)),
  // Lazy chart nodes — recharts / visx pulled in on first use
  cooccurrence: withErrorBoundary(withSuspense(asNodeComponent(CooccurrenceNode))),
  matrix: withErrorBoundary(withSuspense(asNodeComponent(MatrixNode))),
  stats: withErrorBoundary(withSuspense(asNodeComponent(StatsNode))),
  comparison: withErrorBoundary(withSuspense(asNodeComponent(ComparisonNode))),
  wordcloud: withErrorBoundary(withSuspense(asNodeComponent(WordCloudNode))),
  cluster: withErrorBoundary(withSuspense(asNodeComponent(ClusterNode))),
  sentiment: withErrorBoundary(withSuspense(asNodeComponent(SentimentNode))),
  treemap: withErrorBoundary(withSuspense(asNodeComponent(TreemapNode))),
  timeline: withErrorBoundary(withSuspense(asNodeComponent(TimelineNode))),
  geomap: withErrorBoundary(withSuspense(asNodeComponent(GeoMapNode))),
};

export const edgeTypes: EdgeTypes = {
  coding: CodingEdge,
  relation: RelationEdge,
};
