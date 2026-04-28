import type { ComponentType } from 'react';
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
import CooccurrenceNode from './nodes/CooccurrenceNode';
import MatrixNode from './nodes/MatrixNode';
import StatsNode from './nodes/StatsNode';
import ComparisonNode from './nodes/ComparisonNode';
import WordCloudNode from './nodes/WordCloudNode';
import ClusterNode from './nodes/ClusterNode';
import CodingQueryNode from './nodes/CodingQueryNode';
import SentimentNode from './nodes/SentimentNode';
import TreemapNode from './nodes/TreemapNode';
import TimelineNode from './nodes/TimelineNode';
import GeoMapNode from './nodes/GeoMapNode';
import DocumentNode from './nodes/DocumentNode';
import DocumentPortraitNode from './nodes/DocumentPortraitNode';
import CodingEdge from './edges/CodingEdge';
import RelationEdge from './edges/RelationEdge';

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

export const nodeTypes: NodeTypes = {
  transcript: asNodeComponent(TranscriptNode),
  question: asNodeComponent(QuestionNode),
  memo: asNodeComponent(MemoNode),
  case: asNodeComponent(CaseNode),
  group: asNodeComponent(GroupNode),
  sticky: asNodeComponent(StickyNoteNode),
  reroute: asNodeComponent(RerouteNode),
  search: withErrorBoundary(asNodeComponent(SearchResultNode)),
  cooccurrence: withErrorBoundary(asNodeComponent(CooccurrenceNode)),
  matrix: withErrorBoundary(asNodeComponent(MatrixNode)),
  stats: withErrorBoundary(asNodeComponent(StatsNode)),
  comparison: withErrorBoundary(asNodeComponent(ComparisonNode)),
  wordcloud: withErrorBoundary(asNodeComponent(WordCloudNode)),
  cluster: withErrorBoundary(asNodeComponent(ClusterNode)),
  codingquery: withErrorBoundary(asNodeComponent(CodingQueryNode)),
  sentiment: withErrorBoundary(asNodeComponent(SentimentNode)),
  treemap: withErrorBoundary(asNodeComponent(TreemapNode)),
  timeline: withErrorBoundary(asNodeComponent(TimelineNode)),
  geomap: withErrorBoundary(asNodeComponent(GeoMapNode)),
  document: withErrorBoundary(asNodeComponent(DocumentNode)),
  documentportrait: withErrorBoundary(asNodeComponent(DocumentPortraitNode)),
};

export const edgeTypes: EdgeTypes = {
  coding: CodingEdge,
  relation: RelationEdge,
};
