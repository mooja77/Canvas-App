import { useState, useRef, useEffect } from 'react';
import { useCanvasStore } from '../../../stores/canvasStore';
import type { ComputedNodeType } from '@canvas-app/shared';
import toast from 'react-hot-toast';

interface NodeOption {
  type: ComputedNodeType;
  label: string;
  description: string;
  color: string;
}

interface NodeCategory {
  title: string;
  icon: JSX.Element;
  nodes: NodeOption[];
}

const NODE_CATEGORIES: NodeCategory[] = [
  {
    title: 'Text Analysis',
    icon: <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z" /></svg>,
    nodes: [
      { type: 'search', label: 'Text Search', description: 'Find patterns across transcripts', color: '#059669' },
      { type: 'wordcloud', label: 'Word Cloud', description: 'Frequency visualization', color: '#6366F1' },
      { type: 'sentiment', label: 'Sentiment', description: 'Emotional tone analysis', color: '#F59E0B' },
    ],
  },
  {
    title: 'Coding Analysis',
    icon: <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M9.568 3H5.25A2.25 2.25 0 0 0 3 5.25v4.318c0 .597.237 1.17.659 1.591l9.581 9.581c.699.699 1.78.872 2.607.33a18.095 18.095 0 0 0 5.223-5.223c.542-.827.369-1.908-.33-2.607L11.16 3.66A2.25 2.25 0 0 0 9.568 3Z" /><path strokeLinecap="round" strokeLinejoin="round" d="M6 6h.008v.008H6V6Z" /></svg>,
    nodes: [
      { type: 'stats', label: 'Statistics', description: 'Coding frequency charts', color: '#3B82F6' },
      { type: 'cooccurrence', label: 'Co-occurrence', description: 'Find overlapping codings', color: '#7C3AED' },
      { type: 'codingquery', label: 'Coding Query', description: 'Boolean AND/OR/NOT queries', color: '#DC2626' },
      { type: 'cluster', label: 'Clustering', description: 'Group similar segments', color: '#14B8A6' },
    ],
  },
  {
    title: 'Frameworks & Comparison',
    icon: <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6A2.25 2.25 0 0 1 6 3.75h2.25A2.25 2.25 0 0 1 10.5 6v2.25a2.25 2.25 0 0 1-2.25 2.25H6a2.25 2.25 0 0 1-2.25-2.25V6ZM3.75 15.75A2.25 2.25 0 0 1 6 13.5h2.25a2.25 2.25 0 0 1 2.25 2.25V18a2.25 2.25 0 0 1-2.25 2.25H6A2.25 2.25 0 0 1 3.75 18v-2.25ZM13.5 6a2.25 2.25 0 0 1 2.25-2.25H18A2.25 2.25 0 0 1 20.25 6v2.25A2.25 2.25 0 0 1 18 10.5h-2.25a2.25 2.25 0 0 1-2.25-2.25V6ZM13.5 15.75a2.25 2.25 0 0 1 2.25-2.25H18a2.25 2.25 0 0 1 2.25 2.25V18A2.25 2.25 0 0 1 18 20.25h-2.25a2.25 2.25 0 0 1-2.25-2.25v-2.25Z" /></svg>,
    nodes: [
      { type: 'matrix', label: 'Framework Matrix', description: 'Case x Question grid', color: '#D97706' },
      { type: 'comparison', label: 'Comparison', description: 'Compare transcript profiles', color: '#EC4899' },
      { type: 'treemap', label: 'Theme Map', description: 'Visual theme proportions', color: '#8B5CF6' },
    ],
  },
];

// Flat list for backward compat
const NODE_OPTIONS = NODE_CATEGORIES.flatMap(c => c.nodes);

export default function AddComputedNodeMenu() {
  const { addComputedNode } = useCanvasStore();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as HTMLElement)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const handleAdd = async (type: ComputedNodeType, label: string) => {
    try {
      await addComputedNode(type, label);
      toast.success(`${label} node added`);
      setOpen(false);
    } catch {
      toast.error('Failed to add node');
    }
  };

  return (
    <div data-tour="canvas-btn-query" className="relative" ref={ref}>
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-1.5 rounded-lg bg-indigo-50 px-3 py-2 text-xs font-medium text-indigo-700 hover:bg-indigo-100 dark:bg-indigo-900/30 dark:text-indigo-300 dark:hover:bg-indigo-900/50 transition-colors"
        title="Add an analysis view to your canvas"
      >
        <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 3v11.25A2.25 2.25 0 0 0 6 16.5h2.25M3.75 3h-1.5m1.5 0h16.5m0 0h1.5m-1.5 0v11.25A2.25 2.25 0 0 1 18 16.5h-2.25m-7.5 0h7.5m-7.5 0-1 3m8.5-3 1 3m0 0 .5 1.5m-.5-1.5h-9.5m0 0-.5 1.5" />
        </svg>
        Analyze
        <svg className={`h-3 w-3 transition-transform ${open ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="m19.5 8.25-7.5 7.5-7.5-7.5" />
        </svg>
      </button>

      {open && (
        <div className="dropdown-enter absolute right-0 top-full z-50 mt-1.5 w-72 rounded-xl border border-gray-200/60 bg-white/95 p-1.5 shadow-lg backdrop-blur-xl dark:border-gray-700 dark:bg-gray-800/95 max-h-[70vh] overflow-y-auto">
          {NODE_CATEGORIES.map((cat, ci) => (
            <div key={cat.title}>
              {ci > 0 && <div className="mx-2 my-1 border-t border-gray-100 dark:border-gray-700/50" />}
              <div className="flex items-center gap-1.5 px-2.5 py-1.5 text-gray-400 dark:text-gray-500">
                {cat.icon}
                <p className="text-[10px] font-semibold uppercase tracking-wider">{cat.title}</p>
              </div>
              {cat.nodes.map(opt => (
                <button
                  key={opt.type}
                  onClick={() => handleAdd(opt.type, opt.label)}
                  className="flex w-full items-center gap-3 rounded-lg px-2.5 py-2 text-left transition-colors duration-100 hover:bg-gray-50 dark:hover:bg-gray-700/50"
                >
                  <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg" style={{ backgroundColor: opt.color + '18', color: opt.color }}>
                    <div className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: opt.color }} />
                  </div>
                  <div>
                    <p className="text-xs font-medium text-gray-700 dark:text-gray-300">{opt.label}</p>
                    <p className="text-[10px] text-gray-400 dark:text-gray-500">{opt.description}</p>
                  </div>
                </button>
              ))}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
