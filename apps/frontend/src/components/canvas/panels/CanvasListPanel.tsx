import { useState, useEffect, useMemo } from 'react';
import { useCanvasStore } from '../../../stores/canvasStore';
import { canvasApi } from '../../../services/api';
import ConfirmDialog from '../ConfirmDialog';
import toast from 'react-hot-toast';

type SortMode = 'newest' | 'az' | 'codings';

// ─── Canvas Templates ───
const CANVAS_TEMPLATES = [
  {
    id: 'blank',
    name: 'Blank Canvas',
    description: 'Start from scratch with an empty workspace',
    icon: 'plus',
    color: 'gray',
    questions: [],
  },
  {
    id: 'thematic',
    name: 'Thematic Analysis',
    description: 'Braun & Clarke framework with initial theme codes',
    icon: 'theme',
    color: 'purple',
    questions: [
      'Initial impressions / interesting features',
      'Recurring patterns across data',
      'Contradictions / tensions',
      'Participant emotions / affect',
      'Contextual factors',
    ],
  },
  {
    id: 'grounded',
    name: 'Grounded Theory',
    description: 'Open, axial, and selective coding structure',
    icon: 'theory',
    color: 'emerald',
    questions: [
      'Open codes — descriptive labels',
      'In-vivo codes — participant language',
      'Process codes — actions/interactions',
      'Axial categories',
      'Core category',
    ],
  },
  {
    id: 'ipa',
    name: 'IPA (Interpretative)',
    description: 'Interpretative Phenomenological Analysis template',
    icon: 'ipa',
    color: 'blue',
    questions: [
      'Descriptive comments',
      'Linguistic comments',
      'Conceptual comments',
      'Emergent themes',
      'Superordinate themes',
    ],
  },
  {
    id: 'framework',
    name: 'Framework Analysis',
    description: 'Structured matrix-based approach for applied research',
    icon: 'framework',
    color: 'orange',
    questions: [
      'Key concepts / definitions',
      'Attitudes / beliefs',
      'Experiences / practices',
      'Barriers / challenges',
      'Facilitators / enablers',
    ],
  },
  {
    id: 'content',
    name: 'Content Analysis',
    description: 'Systematic coding for frequency and pattern analysis',
    icon: 'content',
    color: 'teal',
    questions: [
      'Category A',
      'Category B',
      'Category C',
      'Uncategorized / Other',
    ],
  },
];

function relativeDate(dateStr: string): string {
  const now = Date.now();
  const then = new Date(dateStr).getTime();
  const diff = now - then;
  const mins = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days < 7) return `${days}d ago`;
  return new Date(dateStr).toLocaleDateString();
}

function TemplateIcon({ template }: { template: typeof CANVAS_TEMPLATES[0] }) {
  const colorClasses: Record<string, string> = {
    gray: 'bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400',
    purple: 'bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400',
    emerald: 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400',
    blue: 'bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400',
    orange: 'bg-orange-100 dark:bg-orange-900/30 text-orange-600 dark:text-orange-400',
    teal: 'bg-teal-100 dark:bg-teal-900/30 text-teal-600 dark:text-teal-400',
  };

  return (
    <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${colorClasses[template.color] || colorClasses.gray}`}>
      {template.id === 'blank' ? (
        <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
        </svg>
      ) : template.id === 'thematic' ? (
        <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="M9.568 3H5.25A2.25 2.25 0 0 0 3 5.25v4.318c0 .597.237 1.17.659 1.591l9.581 9.581c.699.699 1.78.872 2.607.33a18.095 18.095 0 0 0 5.223-5.223c.542-.827.369-1.908-.33-2.607L11.16 3.66A2.25 2.25 0 0 0 9.568 3Z" />
          <path strokeLinecap="round" strokeLinejoin="round" d="M6 6h.008v.008H6V6Z" />
        </svg>
      ) : template.id === 'grounded' ? (
        <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6A2.25 2.25 0 0 1 6 3.75h2.25A2.25 2.25 0 0 1 10.5 6v2.25a2.25 2.25 0 0 1-2.25 2.25H6a2.25 2.25 0 0 1-2.25-2.25V6ZM3.75 15.75A2.25 2.25 0 0 1 6 13.5h2.25a2.25 2.25 0 0 1 2.25 2.25V18a2.25 2.25 0 0 1-2.25 2.25H6A2.25 2.25 0 0 1 3.75 18v-2.25ZM13.5 6a2.25 2.25 0 0 1 2.25-2.25H18A2.25 2.25 0 0 1 20.25 6v2.25A2.25 2.25 0 0 1 18 10.5h-2.25a2.25 2.25 0 0 1-2.25-2.25V6ZM13.5 15.75a2.25 2.25 0 0 1 2.25-2.25H18a2.25 2.25 0 0 1 2.25 2.25V18A2.25 2.25 0 0 1 18 20.25h-2.25a2.25 2.25 0 0 1-2.25-2.25v-2.25Z" />
        </svg>
      ) : template.id === 'ipa' ? (
        <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 0 1 0-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178Z" />
          <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
        </svg>
      ) : template.id === 'framework' ? (
        <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="M3.375 19.5h17.25m-17.25 0a1.125 1.125 0 0 1-1.125-1.125M3.375 19.5h7.5c.621 0 1.125-.504 1.125-1.125m-9.75 0V5.625m0 12.75v-1.5c0-.621.504-1.125 1.125-1.125m18.375 2.625V5.625m0 12.75c0 .621-.504 1.125-1.125 1.125m1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125m0 3.75h-7.5A1.125 1.125 0 0 1 12 18.375m9.75-12.75c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125m19.5 0v1.5c0 .621-.504 1.125-1.125 1.125M2.25 5.625v1.5c0 .621.504 1.125 1.125 1.125m0 0h17.25m-17.25 0h7.5c.621 0 1.125.504 1.125 1.125M3.375 8.25c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125m17.25-3.75h-7.5c-.621 0-1.125.504-1.125 1.125m8.625-1.125c.621 0 1.125.504 1.125 1.125v1.5c0 .621-.504 1.125-1.125 1.125m-17.25 0h7.5m-7.5 0c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125M12 10.875v-1.5m0 1.5c0 .621-.504 1.125-1.125 1.125M12 10.875c0 .621.504 1.125 1.125 1.125m-2.25 0c.621 0 1.125.504 1.125 1.125M13.125 12h7.5m-7.5 0c-.621 0-1.125.504-1.125 1.125M20.625 12c.621 0 1.125.504 1.125 1.125v1.5c0 .621-.504 1.125-1.125 1.125m-17.25 0h7.5M12 14.625v-1.5m0 1.5c0 .621-.504 1.125-1.125 1.125M12 14.625c0 .621.504 1.125 1.125 1.125m-2.25 0c.621 0 1.125.504 1.125 1.125m0 0v1.5c0 .621-.504 1.125-1.125 1.125m1.125-2.625c-.621 0-1.125.504-1.125 1.125v1.5" />
        </svg>
      ) : (
        <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 6a7.5 7.5 0 1 0 7.5 7.5h-7.5V6Z" />
          <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 10.5H21A7.5 7.5 0 0 0 13.5 3v7.5Z" />
        </svg>
      )}
    </div>
  );
}

export default function CanvasListPanel() {
  const { canvases, loading, fetchCanvases, createCanvas, deleteCanvas, openCanvas, addQuestion } = useCanvasStore();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [creating, setCreating] = useState(false);
  const [shareCode, setShareCode] = useState('');
  const [cloning, setCloning] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<{ id: string; name: string } | null>(null);
  const [search, setSearch] = useState('');
  const [sortMode, setSortMode] = useState<SortMode>('newest');
  const [viewMode, setViewMode] = useState<'list' | 'grid'>('grid');
  const [selectedTemplate, setSelectedTemplate] = useState<string>('blank');
  const [showTemplates, setShowTemplates] = useState(false);

  useEffect(() => { fetchCanvases(); }, [fetchCanvases]);

  const filteredCanvases = useMemo(() => {
    let result = canvases;

    // Search filter
    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(c =>
        c.name.toLowerCase().includes(q) ||
        (c.description && c.description.toLowerCase().includes(q))
      );
    }

    // Sort
    result = [...result].sort((a, b) => {
      switch (sortMode) {
        case 'az':
          return a.name.localeCompare(b.name);
        case 'codings':
          return (b._count?.codings ?? 0) - (a._count?.codings ?? 0);
        case 'newest':
        default:
          return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
      }
    });

    return result;
  }, [canvases, search, sortMode]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    setCreating(true);
    try {
      const template = CANVAS_TEMPLATES.find(t => t.id === selectedTemplate);
      const canvas = await createCanvas(name.trim(), description.trim() || undefined);

      // If template has predefined questions, add them
      if (template && template.questions.length > 0) {
        await openCanvas(canvas.id);
        for (const qText of template.questions) {
          try {
            await addQuestion(qText);
          } catch { /* ignore individual failures */ }
        }
        toast.success(`Canvas created with ${template.questions.length} starter codes`);
      } else {
        openCanvas(canvas.id);
      }

      setName('');
      setDescription('');
      setShowForm(false);
      setSelectedTemplate('blank');
    } catch (err: any) {
      toast.error(err?.response?.data?.error || 'Failed to create canvas');
    } finally {
      setCreating(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteCanvas(id);
      toast.success('Canvas deleted');
    } catch {
      toast.error('Failed to delete canvas');
    } finally {
      setConfirmDelete(null);
    }
  };

  const handleClone = async () => {
    if (!shareCode.trim()) return;
    setCloning(true);
    try {
      const res = await canvasApi.cloneCanvas(shareCode.trim());
      const clonedCanvas = res.data.data;
      setShareCode('');
      await fetchCanvases();
      openCanvas(clonedCanvas.id);
      toast.success('Canvas cloned successfully');
    } catch (err: any) {
      toast.error(err?.response?.data?.error || 'Failed to clone canvas');
    } finally {
      setCloning(false);
    }
  };

  return (
    <div data-tour="canvas-list" className="mx-auto max-w-4xl px-6 py-6">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100">Coding Canvases</h2>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            Visual workspaces for qualitative interview coding
          </p>
        </div>
        <button
          data-tour="canvas-new-btn"
          onClick={() => { setShowForm(!showForm); setShowTemplates(true); }}
          className={showForm ? 'btn-secondary text-sm' : 'btn-primary text-sm flex items-center gap-1.5'}
        >
          {showForm ? 'Cancel' : (
            <>
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
              </svg>
              New Canvas
            </>
          )}
        </button>
      </div>

      {showForm && (
        <div className="card mb-6 overflow-hidden animate-slide-up">
          {/* Template selector */}
          {showTemplates && (
            <div className="border-b border-gray-200 dark:border-gray-700 p-4">
              <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">Choose a methodology template</h3>
              <div className="grid grid-cols-3 gap-2">
                {CANVAS_TEMPLATES.map(template => (
                  <button
                    key={template.id}
                    onClick={() => {
                      setSelectedTemplate(template.id);
                      if (template.id !== 'blank' && !name.trim()) {
                        setName(template.name + ' — ');
                      }
                    }}
                    className={`flex items-start gap-3 rounded-xl p-3 text-left transition-all ${
                      selectedTemplate === template.id
                        ? 'bg-brand-50 dark:bg-brand-900/20 ring-2 ring-brand-400 shadow-sm'
                        : 'bg-gray-50 dark:bg-gray-750 hover:bg-gray-100 dark:hover:bg-gray-700 border border-gray-200 dark:border-gray-700'
                    }`}
                  >
                    <TemplateIcon template={template} />
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-medium text-gray-800 dark:text-gray-200">{template.name}</p>
                      <p className="text-[10px] text-gray-400 dark:text-gray-500 mt-0.5 leading-relaxed">{template.description}</p>
                      {template.questions.length > 0 && (
                        <p className="text-[9px] text-gray-300 dark:text-gray-600 mt-1">
                          {template.questions.length} starter codes
                        </p>
                      )}
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleCreate} className="p-4">
            <div className="space-y-3">
              <div>
                <label className="label" htmlFor="canvas-name">Canvas Name</label>
                <input
                  id="canvas-name"
                  type="text"
                  className="input mt-1"
                  placeholder="e.g. Interview Batch 1 Coding"
                  value={name}
                  onChange={e => setName(e.target.value)}
                  autoFocus
                />
              </div>
              <div>
                <label className="label" htmlFor="canvas-desc">Description (optional)</label>
                <input
                  id="canvas-desc"
                  type="text"
                  className="input mt-1"
                  placeholder="Brief description of this coding workspace"
                  value={description}
                  onChange={e => setDescription(e.target.value)}
                />
              </div>

              {/* Template info */}
              {selectedTemplate !== 'blank' && (
                <div className="rounded-lg bg-brand-50 dark:bg-brand-900/15 px-3 py-2 text-xs text-brand-700 dark:text-brand-300">
                  <strong>{CANVAS_TEMPLATES.find(t => t.id === selectedTemplate)?.name}</strong> template will create {CANVAS_TEMPLATES.find(t => t.id === selectedTemplate)?.questions.length} starter research codes.
                </div>
              )}

              <div className="flex items-center gap-2">
                <button type="submit" disabled={creating || !name.trim()} className="btn-primary text-sm">
                  {creating ? 'Creating...' : 'Create Canvas'}
                </button>
                {showTemplates && (
                  <button
                    type="button"
                    onClick={() => setShowTemplates(false)}
                    className="text-xs text-gray-400 hover:text-gray-600"
                  >
                    Hide templates
                  </button>
                )}
              </div>
            </div>
          </form>
        </div>
      )}

      {/* Clone from share code - subtle/collapsible */}
      <details className="mb-4 group">
        <summary className="flex items-center gap-1.5 cursor-pointer text-xs text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors select-none">
          <svg className="h-3.5 w-3.5 transition-transform group-open:rotate-90" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="m8.25 4.5 7.5 7.5-7.5 7.5" />
          </svg>
          Have a share code? Import a canvas
        </summary>
        <div className="mt-2 flex items-center gap-2 animate-slide-down">
          <input
            type="text"
            className="input flex-1 text-sm"
            placeholder="Paste share code here..."
            value={shareCode}
            onChange={e => setShareCode(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') handleClone(); }}
          />
          <button
            onClick={handleClone}
            disabled={cloning || !shareCode.trim()}
            className="btn-secondary text-sm whitespace-nowrap"
          >
            {cloning ? 'Importing...' : 'Import'}
          </button>
        </div>
      </details>

      {/* Search and Sort controls */}
      {canvases.length > 0 && (
        <div className="mb-4 flex items-center gap-2">
          <div className="relative flex-1">
            <svg className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-gray-400" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z" />
            </svg>
            <input
              type="text"
              className="input w-full pl-8 text-sm"
              placeholder="Search canvases..."
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>
          <select
            className="input text-sm w-36"
            value={sortMode}
            onChange={e => setSortMode(e.target.value as SortMode)}
          >
            <option value="newest">Newest first</option>
            <option value="az">A-Z</option>
            <option value="codings">Most codings</option>
          </select>
          {/* View toggle */}
          <div className="flex rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
            <button
              onClick={() => setViewMode('grid')}
              className={`p-1.5 transition-colors ${viewMode === 'grid' ? 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200' : 'text-gray-400 hover:text-gray-600 dark:hover:text-gray-300'}`}
              title="Grid view"
            >
              <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6A2.25 2.25 0 0 1 6 3.75h2.25A2.25 2.25 0 0 1 10.5 6v2.25a2.25 2.25 0 0 1-2.25 2.25H6a2.25 2.25 0 0 1-2.25-2.25V6ZM3.75 15.75A2.25 2.25 0 0 1 6 13.5h2.25a2.25 2.25 0 0 1 2.25 2.25V18a2.25 2.25 0 0 1-2.25 2.25H6A2.25 2.25 0 0 1 3.75 18v-2.25ZM13.5 6a2.25 2.25 0 0 1 2.25-2.25H18A2.25 2.25 0 0 1 20.25 6v2.25A2.25 2.25 0 0 1 18 10.5h-2.25a2.25 2.25 0 0 1-2.25-2.25V6ZM13.5 15.75a2.25 2.25 0 0 1 2.25-2.25H18a2.25 2.25 0 0 1 2.25 2.25V18A2.25 2.25 0 0 1 18 20.25h-2.25a2.25 2.25 0 0 1-2.25-2.25v-2.25Z" />
              </svg>
            </button>
            <button
              onClick={() => setViewMode('list')}
              className={`p-1.5 transition-colors ${viewMode === 'list' ? 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200' : 'text-gray-400 hover:text-gray-600 dark:hover:text-gray-300'}`}
              title="List view"
            >
              <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 6.75h12M8.25 12h12m-12 5.25h12M3.75 6.75h.007v.008H3.75V6.75Zm.375 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0ZM3.75 12h.007v.008H3.75V12Zm.375 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm-.375 5.25h.007v.008H3.75v-.008Zm.375 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Z" />
              </svg>
            </button>
          </div>
        </div>
      )}

      {loading && canvases.length === 0 && (
        <div className="space-y-3">
          {[1, 2, 3].map(i => (
            <div key={i} className="card p-4">
              <div className="skeleton h-5 w-48 mb-2" />
              <div className="skeleton h-3 w-32 mb-3" />
              <div className="flex gap-3">
                <div className="skeleton h-3 w-20" />
                <div className="skeleton h-3 w-20" />
                <div className="skeleton h-3 w-24" />
              </div>
            </div>
          ))}
        </div>
      )}

      {!loading && canvases.length === 0 && !showForm && (
        <div className="card py-12 px-8 text-center">
          <div className="gentle-pulse inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-brand-50 dark:bg-brand-900/20 mb-4">
            <svg className="h-8 w-8 text-brand-500" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
            </svg>
          </div>
          <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-200">Create your first canvas</h3>
          <p className="mt-2 text-sm text-gray-500 dark:text-gray-400 max-w-sm mx-auto">
            A canvas is your workspace for coding interview transcripts. Choose a methodology template or start from scratch.
          </p>
          <div className="mt-6 flex flex-col items-center gap-3">
            <button onClick={() => { setShowForm(true); setShowTemplates(true); }} className="btn-primary text-sm px-6">
              Get Started
            </button>
            <div className="flex items-center gap-6 mt-4 text-xs text-gray-400 dark:text-gray-500">
              <div className="flex items-center gap-1.5">
                <span className="flex h-5 w-5 items-center justify-center rounded-full bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 text-[10px] font-bold">1</span>
                <span>Pick a template</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="flex h-5 w-5 items-center justify-center rounded-full bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400 text-[10px] font-bold">2</span>
                <span>Add transcripts</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="flex h-5 w-5 items-center justify-center rounded-full bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 text-[10px] font-bold">3</span>
                <span>Code & analyze</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* No search results state */}
      {canvases.length > 0 && filteredCanvases.length === 0 && (
        <div className="py-8 text-center text-sm text-gray-400 dark:text-gray-500">
          No canvases match &ldquo;{search}&rdquo;
        </div>
      )}

      <div data-tour="canvas-cards" className={viewMode === 'grid' ? 'grid grid-cols-2 gap-3' : 'space-y-3'}>
        {filteredCanvases.map((canvas, index) => (
          <div
            key={canvas.id}
            className={`card card-interactive list-item-enter cursor-pointer hover:shadow-card-hover group ${
              viewMode === 'grid' ? 'p-4' : 'flex items-center justify-between'
            }`}
            style={{ animationDelay: `${index * 50}ms` }}
            onClick={() => openCanvas(canvas.id)}
          >
            {viewMode === 'grid' ? (
              /* Grid card */
              <div>
                <div className="flex items-start justify-between mb-2">
                  <h3 className="font-medium text-gray-900 dark:text-gray-100 truncate text-sm pr-2">{canvas.name}</h3>
                  <button
                    onClick={e => { e.stopPropagation(); setConfirmDelete({ id: canvas.id, name: canvas.name }); }}
                    className="shrink-0 rounded p-1 text-gray-300 hover:bg-red-50 hover:text-red-600 dark:text-gray-600 dark:hover:bg-red-900/20 dark:hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity"
                    title="Delete canvas"
                    aria-label={`Delete canvas ${canvas.name}`}
                  >
                    <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0" />
                    </svg>
                  </button>
                </div>
                {canvas.description && (
                  <p className="text-xs text-gray-500 dark:text-gray-400 truncate mb-3">{canvas.description}</p>
                )}
                {/* Stats row */}
                {canvas._count && (
                  <div className="flex items-center gap-3 text-[10px] text-gray-400 dark:text-gray-500 mb-2">
                    <span className="flex items-center gap-1">
                      <svg className="h-3 w-3 text-blue-400" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z" />
                      </svg>
                      {canvas._count.transcripts}
                    </span>
                    <span className="flex items-center gap-1">
                      <svg className="h-3 w-3 text-purple-400" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M9.879 7.519c1.171-1.025 3.071-1.025 4.242 0 1.172 1.025 1.172 2.687 0 3.712-.203.179-.43.326-.67.442-.745.361-1.45.999-1.45 1.827v.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9 5.25h.008v.008H12v-.008Z" />
                      </svg>
                      {canvas._count.questions}
                    </span>
                    <span className="flex items-center gap-1">
                      <svg className="h-3 w-3 text-emerald-400" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
                      </svg>
                      {canvas._count.codings}
                    </span>
                  </div>
                )}
                <div className="text-[10px] text-gray-400 dark:text-gray-500">
                  Updated {relativeDate(canvas.updatedAt)}
                </div>
              </div>
            ) : (
              /* List row */
              <>
                <div className="min-w-0 flex-1">
                  <h3 className="font-medium text-gray-900 dark:text-gray-100 truncate">{canvas.name}</h3>
                  {canvas.description && (
                    <p className="mt-0.5 text-sm text-gray-500 dark:text-gray-400 truncate">{canvas.description}</p>
                  )}
                  <div className="mt-1 flex gap-3 text-xs text-gray-400 dark:text-gray-500">
                    {canvas._count && (
                      <>
                        <span>{canvas._count.transcripts} transcript{canvas._count.transcripts !== 1 ? 's' : ''}</span>
                        <span>{canvas._count.questions} question{canvas._count.questions !== 1 ? 's' : ''}</span>
                        <span>{canvas._count.codings} coding{canvas._count.codings !== 1 ? 's' : ''}</span>
                      </>
                    )}
                    <span>Updated {relativeDate(canvas.updatedAt)}</span>
                  </div>
                </div>
                <button
                  onClick={e => { e.stopPropagation(); setConfirmDelete({ id: canvas.id, name: canvas.name }); }}
                  className="ml-4 shrink-0 rounded p-1.5 text-gray-400 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-900/20 dark:hover:text-red-400"
                  title="Delete canvas"
                  aria-label={`Delete canvas ${canvas.name}`}
                >
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0" />
                  </svg>
                </button>
              </>
            )}
          </div>
        ))}
      </div>

      {confirmDelete && (
        <ConfirmDialog
          title="Delete Canvas"
          message={`Delete canvas "${confirmDelete.name}" and all its data? This cannot be undone.`}
          onConfirm={() => handleDelete(confirmDelete.id)}
          onCancel={() => setConfirmDelete(null)}
        />
      )}
    </div>
  );
}
