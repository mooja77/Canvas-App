/**
 * Node bulk-operation helpers.
 *
 * These exist so the canvas never claims a success it did not achieve: the
 * delete/paste loops report what actually happened rather than assuming every
 * item in the selection went through.
 */

/** Deletes one entity. Receives the entity id (node id minus its prefix) and the full node id. */
export type NodeDeleter = (entityId: string, nodeId: string) => void | Promise<void>;

/** Keyed by the node-id prefix used on the canvas (e.g. `transcript-`, `reroute-`). */
export type NodeDeleters = Partial<Record<NodeKind, NodeDeleter>>;

export type NodeKind = 'transcript' | 'question' | 'memo' | 'case' | 'computed' | 'group' | 'reroute' | 'sticky';

const NODE_KINDS: NodeKind[] = ['transcript', 'question', 'memo', 'case', 'computed', 'group', 'reroute', 'sticky'];

/** The node kind encoded in a canvas node id, or null when the id has no known prefix. */
export function nodeKindOf(nodeId: string): NodeKind | null {
  return NODE_KINDS.find((kind) => nodeId.startsWith(`${kind}-`)) ?? null;
}

/**
 * Resolves the delete action for a node id, or null when nothing on the canvas
 * knows how to delete it (in which case the caller must NOT report success).
 */
export function resolveNodeDelete(nodeId: string, deleters: NodeDeleters): (() => Promise<void>) | null {
  const kind = nodeKindOf(nodeId);
  if (!kind) return null;
  const deleter = deleters[kind];
  if (!deleter) return null;
  const entityId = nodeId.slice(kind.length + 1);
  return async () => {
    await deleter(entityId, nodeId);
  };
}

export interface BulkDeleteResult {
  /** Nodes whose delete actually completed. */
  deleted: number;
  /** Nodes whose delete threw. */
  failed: number;
  /** Nodes nothing knows how to delete. */
  unsupported: number;
  firstError?: unknown;
}

export async function deleteNodesById(nodeIds: string[], deleters: NodeDeleters): Promise<BulkDeleteResult> {
  const result: BulkDeleteResult = { deleted: 0, failed: 0, unsupported: 0 };
  for (const nodeId of nodeIds) {
    const run = resolveNodeDelete(nodeId, deleters);
    if (!run) {
      result.unsupported++;
      continue;
    }
    try {
      await run();
      result.deleted++;
    } catch (err) {
      result.failed++;
      if (result.firstError === undefined) result.firstError = err;
    }
  }
  return result;
}

export interface OpReport {
  kind: 'success' | 'error';
  text: string;
}

const plural = (n: number, word: string) => `${n} ${word}${n !== 1 ? 's' : ''}`;

export function describeBulkDelete(result: BulkDeleteResult): OpReport {
  const notDeleted = result.failed + result.unsupported;
  if (notDeleted === 0) {
    return { kind: 'success', text: `Deleted ${plural(result.deleted, 'node')}` };
  }
  if (result.deleted === 0) {
    return { kind: 'error', text: `Failed to delete ${plural(notDeleted, 'node')}` };
  }
  return {
    kind: 'error',
    text: `Deleted ${plural(result.deleted, 'node')}, ${notDeleted} failed`,
  };
}

export interface PasteOutcome {
  pasted: number;
  relationsCreated: number;
  failed: number;
  firstError?: unknown;
}

export function describePaste(outcome: PasteOutcome): OpReport | null {
  if (outcome.pasted === 0 && outcome.failed === 0) return null;
  if (outcome.failed > 0) {
    if (outcome.pasted === 0) {
      return { kind: 'error', text: `Failed to paste ${plural(outcome.failed, 'node')}` };
    }
    return {
      kind: 'error',
      text: `Pasted ${plural(outcome.pasted, 'node')}, ${outcome.failed} failed`,
    };
  }
  return {
    kind: 'success',
    text:
      outcome.relationsCreated > 0
        ? `Pasted ${outcome.pasted} node(s) with ${outcome.relationsCreated} connection(s)`
        : `Pasted ${outcome.pasted} node(s)`,
  };
}
