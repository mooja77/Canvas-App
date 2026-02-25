import { useState, useEffect, useRef } from 'react';
import { useCanvasStore } from '../../../stores/canvasStore';

interface Props {
  canvasName: string;
}

export default function CanvasSwitcher({ canvasName }: Props) {
  const { canvases, fetchCanvases, openCanvas, activeCanvasId } = useCanvasStore();
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const ref = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Fetch canvases on first open
  useEffect(() => {
    if (open && canvases.length === 0) fetchCanvases();
  }, [open, canvases.length, fetchCanvases]);

  // Focus input on open
  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 50);
    } else {
      setSearch('');
    }
  }, [open]);

  // Close on click outside
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as HTMLElement)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  // Close on Escape
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [open]);

  const otherCanvases = canvases.filter(c => c.id !== activeCanvasId);
  const filtered = search
    ? otherCanvases.filter(c => c.name.toLowerCase().includes(search.toLowerCase()))
    : otherCanvases;

  const handleSwitch = (id: string) => {
    setOpen(false);
    openCanvas(id);
  };

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(o => !o)}
        className="group flex items-center gap-1.5 rounded-lg px-1 py-0.5 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors max-w-[180px]"
        title="Switch canvas"
      >
        <h3 className="font-semibold text-gray-900 dark:text-gray-100 truncate text-sm">{canvasName}</h3>
        <svg className={`h-3 w-3 shrink-0 text-gray-400 group-hover:text-gray-600 dark:group-hover:text-gray-300 transition-transform ${open ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="m19.5 8.25-7.5 7.5-7.5-7.5" />
        </svg>
      </button>

      {open && (
        <div className="dropdown-enter absolute left-0 top-full mt-1 z-50 w-72 rounded-xl bg-white shadow-xl ring-1 ring-black/10 dark:bg-gray-800 dark:ring-white/10 overflow-hidden">
          {/* Search */}
          <div className="border-b border-gray-100 dark:border-gray-700 p-2">
            <div className="flex items-center gap-2 rounded-lg bg-gray-50 dark:bg-gray-750 px-2.5 py-1.5">
              <svg className="h-3.5 w-3.5 text-gray-400" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z" />
              </svg>
              <input
                ref={inputRef}
                type="text"
                className="flex-1 bg-transparent text-xs text-gray-700 dark:text-gray-300 placeholder:text-gray-400 focus:outline-none"
                placeholder="Search canvases..."
                value={search}
                onChange={e => setSearch(e.target.value)}
              />
            </div>
          </div>

          {/* Canvas list */}
          <div className="max-h-56 overflow-y-auto py-1 sidebar-scroll">
            {filtered.length === 0 ? (
              <p className="px-4 py-3 text-xs text-gray-400 text-center">
                {otherCanvases.length === 0 ? 'No other canvases' : 'No matches'}
              </p>
            ) : (
              filtered.map(c => (
                <button
                  key={c.id}
                  onClick={() => handleSwitch(c.id)}
                  className="w-full flex items-center gap-3 px-3 py-2 text-left hover:bg-gray-50 dark:hover:bg-gray-750 transition-colors"
                >
                  <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-brand-50 text-brand-600 dark:bg-brand-900/30 dark:text-brand-400 text-xs font-bold shrink-0">
                    {c.name.charAt(0).toUpperCase()}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-medium text-gray-700 dark:text-gray-300 truncate">{c.name}</p>
                    <p className="text-[10px] text-gray-400 dark:text-gray-500">
                      {c._count?.transcripts || 0} transcripts &middot; {c._count?.codings || 0} codings
                    </p>
                  </div>
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
