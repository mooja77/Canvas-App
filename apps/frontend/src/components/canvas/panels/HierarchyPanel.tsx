import { useMemo, useState, useCallback, useRef } from 'react';
import { useCanvasStore } from '../../../stores/canvasStore';
import type { CanvasQuestion, CanvasTextCoding } from '@canvas-app/shared';
import toast from 'react-hot-toast';

interface HierarchyPanelProps {
  onClose: () => void;
}

interface TreeItem {
  question: CanvasQuestion;
  children: TreeItem[];
  depth: number;
  codingCount: number;
}

export default function HierarchyPanel({ onClose }: HierarchyPanelProps) {
  const { activeCanvas, updateQuestion } = useCanvasStore();
  const questions = activeCanvas?.questions ?? [];
  const codings = activeCanvas?.codings ?? [];
  const [dragOverId, setDragOverId] = useState<string | null>(null);
  const [dragId, setDragId] = useState<string | null>(null);
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set(questions.map(q => q.id)));

  // Coding counts per question
  const codingCounts = useMemo(() => {
    const counts = new Map<string, number>();
    codings.forEach((c: CanvasTextCoding) => {
      counts.set(c.questionId, (counts.get(c.questionId) || 0) + 1);
    });
    return counts;
  }, [codings]);

  // Build tree from flat list
  const tree = useMemo(() => {
    const map = new Map<string, TreeItem>();
    const roots: TreeItem[] = [];

    questions.forEach((q: CanvasQuestion) => {
      map.set(q.id, { question: q, children: [], depth: 0, codingCount: codingCounts.get(q.id) || 0 });
    });

    questions.forEach((q: CanvasQuestion) => {
      const item = map.get(q.id)!;
      if (q.parentQuestionId && map.has(q.parentQuestionId)) {
        const parent = map.get(q.parentQuestionId)!;
        parent.children.push(item);
        // Compute depth
        let p = q.parentQuestionId;
        let d = 1;
        while (p && d < 4) {
          const pq = questions.find((x: CanvasQuestion) => x.id === p);
          if (pq?.parentQuestionId) { d++; p = pq.parentQuestionId; }
          else break;
        }
        item.depth = d;
      } else {
        roots.push(item);
      }
    });

    return roots;
  }, [questions, codingCounts]);

  // Flatten tree respecting expanded state
  const flatList = useMemo(() => {
    const result: TreeItem[] = [];
    const walk = (items: TreeItem[]) => {
      items.forEach(item => {
        result.push(item);
        if (expandedIds.has(item.question.id)) {
          walk(item.children);
        }
      });
    };
    walk(tree);
    return result;
  }, [tree, expandedIds]);

  const toggleExpanded = useCallback((id: string) => {
    setExpandedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const handleDragStart = useCallback((id: string) => {
    setDragId(id);
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent, id: string) => {
    e.preventDefault();
    setDragOverId(id);
  }, []);

  const handleDrop = useCallback(async (targetId: string) => {
    if (!dragId || dragId === targetId) {
      setDragId(null);
      setDragOverId(null);
      return;
    }

    // Don't allow making a parent a child of its own descendant
    const isDescendant = (parentId: string, childId: string): boolean => {
      const q = questions.find(x => x.id === childId);
      if (!q?.parentQuestionId) return false;
      if (q.parentQuestionId === parentId) return true;
      return isDescendant(parentId, q.parentQuestionId);
    };

    if (isDescendant(dragId, targetId)) {
      toast.error('Cannot make a parent a child of its own descendant');
      setDragId(null);
      setDragOverId(null);
      return;
    }

    try {
      await updateQuestion(dragId, { parentQuestionId: targetId });
      toast.success('Code moved');
      setExpandedIds(prev => new Set([...prev, targetId]));
    } catch {
      toast.error('Failed to move code');
    }
    setDragId(null);
    setDragOverId(null);
  }, [dragId, questions, updateQuestion]);

  const handleMoveToRoot = useCallback(async (id: string) => {
    try {
      await updateQuestion(id, { parentQuestionId: null });
      toast.success('Moved to top level');
    } catch {
      toast.error('Failed to move');
    }
  }, [updateQuestion]);

  const totalCodingCount = codings.length;

  return (
    <div className="modal-backdrop fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <div className="command-palette-enter w-full max-w-md rounded-2xl bg-white shadow-2xl ring-1 ring-black/10 dark:bg-gray-800 dark:ring-white/10 max-h-[70vh] flex flex-col">
        <div className="flex items-center justify-between border-b border-gray-200 dark:border-gray-700 px-4 py-3">
          <div>
            <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">Code Hierarchy</h3>
            <p className="text-[10px] text-gray-400 dark:text-gray-500 mt-0.5">
              Drag codes to reorganize &middot; {questions.length} codes &middot; {totalCodingCount} codings
            </p>
          </div>
          <button onClick={onClose} className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-gray-700 transition-colors">
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-2">
          {flatList.length === 0 ? (
            <div className="py-8 text-center">
              <p className="text-xs text-gray-400 dark:text-gray-500">No codes yet.</p>
              <p className="text-[10px] text-gray-300 dark:text-gray-600 mt-1">Add codes to organize your analysis.</p>
            </div>
          ) : (
            <div className="space-y-0.5">
              {flatList.map(item => {
                const hasChildren = item.children.length > 0;
                const isExpanded = expandedIds.has(item.question.id);
                const isDragOver = dragOverId === item.question.id;
                const isDragging = dragId === item.question.id;

                return (
                  <div
                    key={item.question.id}
                    draggable
                    onDragStart={() => handleDragStart(item.question.id)}
                    onDragOver={(e) => handleDragOver(e, item.question.id)}
                    onDragLeave={() => setDragOverId(null)}
                    onDrop={() => handleDrop(item.question.id)}
                    onDragEnd={() => { setDragId(null); setDragOverId(null); }}
                    className={`flex items-center gap-1.5 rounded-lg px-2 py-1.5 transition-all duration-100 cursor-grab active:cursor-grabbing ${
                      isDragOver ? 'bg-brand-50 dark:bg-brand-900/30 ring-1 ring-brand-300 dark:ring-brand-700' :
                      isDragging ? 'opacity-40' :
                      'hover:bg-gray-50 dark:hover:bg-gray-750'
                    }`}
                    style={{ paddingLeft: `${8 + item.depth * 20}px` }}
                  >
                    {/* Expand/collapse */}
                    {hasChildren ? (
                      <button
                        onClick={() => toggleExpanded(item.question.id)}
                        className="shrink-0 rounded p-0.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                      >
                        <svg className={`h-3 w-3 transition-transform ${isExpanded ? 'rotate-90' : ''}`} fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" d="m8.25 4.5 7.5 7.5-7.5 7.5" />
                        </svg>
                      </button>
                    ) : (
                      <span className="w-4" />
                    )}

                    {/* Color dot */}
                    <div className="h-3 w-3 rounded-full shrink-0 ring-1 ring-black/10" style={{ backgroundColor: item.question.color }} />

                    {/* Label */}
                    <span className="text-xs text-gray-800 dark:text-gray-200 flex-1 truncate">{item.question.text}</span>

                    {/* Coding count */}
                    <span className="shrink-0 text-[10px] tabular-nums text-gray-400">
                      {item.codingCount}
                    </span>

                    {/* Move to root */}
                    {item.depth > 0 && (
                      <button
                        onClick={() => handleMoveToRoot(item.question.id)}
                        className="shrink-0 rounded p-0.5 text-gray-300 hover:text-gray-600 dark:hover:text-gray-400 transition-colors"
                        title="Move to top level"
                      >
                        <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5 8.25 12l7.5-7.5" />
                        </svg>
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Drop zone for root level */}
        {dragId && (
          <div
            className="mx-2 mb-2 rounded-lg border-2 border-dashed border-gray-200 dark:border-gray-700 py-2 text-center text-[10px] text-gray-400 transition-colors hover:border-brand-300 hover:text-brand-500"
            onDragOver={(e) => { e.preventDefault(); }}
            onDrop={() => { handleMoveToRoot(dragId); setDragId(null); setDragOverId(null); }}
          >
            Drop here to move to top level
          </div>
        )}
      </div>
    </div>
  );
}
