import { useMemo } from 'react';
import { useCanvasStore } from '../../../stores/canvasStore';
import type { CanvasQuestion } from '@canvas-app/shared';
import toast from 'react-hot-toast';

interface HierarchyPanelProps {
  onClose: () => void;
}

interface TreeItem {
  question: CanvasQuestion;
  children: TreeItem[];
  depth: number;
}

export default function HierarchyPanel({ onClose }: HierarchyPanelProps) {
  const { activeCanvas, updateQuestion } = useCanvasStore();
  const questions = activeCanvas?.questions ?? [];

  // Build tree from flat list
  const tree = useMemo(() => {
    const map = new Map<string, TreeItem>();
    const roots: TreeItem[] = [];

    // Create nodes
    questions.forEach((q: CanvasQuestion) => {
      map.set(q.id, { question: q, children: [], depth: 0 });
    });

    // Build relationships
    questions.forEach((q: CanvasQuestion) => {
      const item = map.get(q.id)!;
      if (q.parentQuestionId && map.has(q.parentQuestionId)) {
        const parent = map.get(q.parentQuestionId)!;
        parent.children.push(item);
        item.depth = 1;
        // Compute depth recursively (max 3)
        let p = q.parentQuestionId;
        let d = 1;
        while (p && d < 3) {
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
  }, [questions]);

  const flatList = useMemo(() => {
    const result: TreeItem[] = [];
    const walk = (items: TreeItem[]) => {
      items.forEach(item => {
        result.push(item);
        walk(item.children);
      });
    };
    walk(tree);
    return result;
  }, [tree]);

  const handleIndent = async (q: CanvasQuestion) => {
    // Find the question above in the flat list to make it the parent
    const idx = flatList.findIndex(item => item.question.id === q.id);
    if (idx <= 0) return;
    const newParent = flatList[idx - 1].question;
    try {
      await updateQuestion(q.id, { parentQuestionId: newParent.id });
      toast.success('Moved under ' + newParent.text.slice(0, 30));
    } catch {
      toast.error('Failed to move question');
    }
  };

  const handleOutdent = async (q: CanvasQuestion) => {
    try {
      await updateQuestion(q.id, { parentQuestionId: null });
      toast.success('Moved to top level');
    } catch {
      toast.error('Failed to move question');
    }
  };

  return (
    <div className="modal-backdrop fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <div className="modal-content w-full max-w-md rounded-2xl bg-white shadow-xl backdrop-blur-xl ring-1 ring-black/5 dark:bg-gray-800 max-h-[70vh] flex flex-col">
        <div className="flex items-center justify-between border-b border-gray-200 px-4 py-3 dark:border-gray-700">
          <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">Code Hierarchy</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-3">
          {flatList.length === 0 ? (
            <p className="text-center text-xs text-gray-400 py-4">No questions yet.</p>
          ) : (
            <div className="space-y-1">
              {flatList.map(item => (
                <div
                  key={item.question.id}
                  className="flex items-center gap-2 rounded px-2 py-1.5 hover:bg-gray-50 dark:hover:bg-gray-750"
                  style={{ paddingLeft: `${8 + item.depth * 24}px` }}
                >
                  {/* Indent indicator */}
                  {item.depth > 0 && (
                    <span className="text-gray-300 dark:text-gray-600">{'└'}</span>
                  )}

                  <div className="h-3 w-3 rounded-full shrink-0" style={{ backgroundColor: item.question.color }} />
                  <span className="text-xs text-gray-800 dark:text-gray-200 flex-1 truncate">{item.question.text}</span>

                  {item.children.length > 0 && (
                    <span className="text-[10px] text-gray-400 bg-gray-100 dark:bg-gray-700 rounded-full px-1.5 py-0.5">
                      {item.children.length}
                    </span>
                  )}

                  <div className="flex gap-0.5">
                    <button
                      onClick={() => handleIndent(item.question)}
                      className="rounded p-0.5 text-gray-300 hover:text-gray-600 dark:hover:text-gray-400"
                      title="Indent (make child of above)"
                    >
                      <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" d="m8.25 4.5 7.5 7.5-7.5 7.5" />
                      </svg>
                    </button>
                    {item.depth > 0 && (
                      <button
                        onClick={() => handleOutdent(item.question)}
                        className="rounded p-0.5 text-gray-300 hover:text-gray-600 dark:hover:text-gray-400"
                        title="Outdent (move to top level)"
                      >
                        <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5 8.25 12l7.5-7.5" />
                        </svg>
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
