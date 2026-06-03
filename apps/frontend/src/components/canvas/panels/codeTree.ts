import type { CanvasQuestion, CanvasTextCoding } from '@qualcanvas/shared';

export interface CodeTreeItem {
  question: CanvasQuestion;
  children: CodeTreeItem[];
  /** Direct codings on this code PLUS all of its descendants' codings (the
   *  rolled-up total). This is what the sidebar shows so a parent family
   *  reflects how much is coded beneath it, not just its own direct codings. */
  codingCount: number;
  /** Direct codings on this code only (excludes descendants). */
  ownCount: number;
}

export type CodeSortMode = 'name' | 'count';

/**
 * Builds the hierarchical code tree with rolled-up coding counts.
 *
 * Codings are attached to individual codes, but codes can be nested under
 * parent "family" codes (via parentQuestionId). Previously each row showed only
 * its OWN direct codings, so parent families read 0 even when their sub-codes
 * were heavily coded — misleading at a glance. Here each node's `codingCount`
 * is its own codings plus the sum of all descendants', while `ownCount` keeps
 * the direct-only figure for anything that needs it.
 */
export function buildCodeTree(
  questions: CanvasQuestion[],
  codings: CanvasTextCoding[],
  sortMode: CodeSortMode,
): CodeTreeItem[] {
  const ownCounts = new Map<string, number>();
  codings.forEach((c) => ownCounts.set(c.questionId, (ownCounts.get(c.questionId) || 0) + 1));

  const map = new Map<string, CodeTreeItem>();
  const roots: CodeTreeItem[] = [];

  questions.forEach((q) => {
    const own = ownCounts.get(q.id) || 0;
    map.set(q.id, { question: q, children: [], codingCount: own, ownCount: own });
  });

  questions.forEach((q) => {
    const item = map.get(q.id)!;
    if (q.parentQuestionId && map.has(q.parentQuestionId)) {
      map.get(q.parentQuestionId)!.children.push(item);
    } else {
      roots.push(item);
    }
  });

  // Post-order roll-up: a node's total = its own codings + every descendant's.
  const rollUp = (item: CodeTreeItem): number => {
    let total = item.ownCount;
    for (const child of item.children) total += rollUp(child);
    item.codingCount = total;
    return total;
  };
  roots.forEach(rollUp);

  const sortFn = (a: CodeTreeItem, b: CodeTreeItem) =>
    sortMode === 'count' ? b.codingCount - a.codingCount : a.question.text.localeCompare(b.question.text);
  const sortRec = (items: CodeTreeItem[]) => {
    items.sort(sortFn);
    items.forEach((i) => sortRec(i.children));
  };
  sortRec(roots);

  return roots;
}
