import { useState, useEffect } from 'react';
import { canvasApi } from '../../../services/api';
import { useCanvasStore } from '../../../stores/canvasStore';
import type { CanvasTranscript } from '@canvas-app/shared';
import toast from 'react-hot-toast';

interface CanvasSummary {
  id: string;
  name: string;
  description?: string;
  _count?: { transcripts: number; questions: number; codings: number };
}

interface Props {
  onClose: () => void;
}

export default function CrossCanvasImportModal({ onClose }: Props) {
  const { activeCanvasId, importFromCanvas } = useCanvasStore();
  const [canvases, setCanvases] = useState<CanvasSummary[]>([]);
  const [selectedCanvasId, setSelectedCanvasId] = useState<string | null>(null);
  const [transcripts, setTranscripts] = useState<CanvasTranscript[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [importing, setImporting] = useState(false);

  useEffect(() => {
    canvasApi.getCanvases()
      .then(res => {
        // Filter out the current canvas
        const list = (res.data.data || []).filter((c: CanvasSummary) => c.id !== activeCanvasId);
        setCanvases(list);
      })
      .catch(() => toast.error('Failed to load canvases'))
      .finally(() => setLoading(false));
  }, [activeCanvasId]);

  const handleSelectCanvas = async (id: string) => {
    setSelectedCanvasId(id);
    setTranscripts([]);
    setSelectedIds(new Set());
    setLoadingDetail(true);
    try {
      const res = await canvasApi.getCanvas(id);
      setTranscripts(res.data.data.transcripts || []);
    } catch {
      toast.error('Failed to load canvas detail');
    } finally {
      setLoadingDetail(false);
    }
  };

  const toggleId = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleAll = () => {
    if (selectedIds.size === transcripts.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(transcripts.map(t => t.id)));
    }
  };

  const handleImport = async () => {
    if (selectedIds.size === 0 || !selectedCanvasId) return;
    setImporting(true);
    try {
      await importFromCanvas(selectedCanvasId, Array.from(selectedIds));
      toast.success(`Imported ${selectedIds.size} transcript${selectedIds.size > 1 ? 's' : ''}`);
      onClose();
    } catch {
      toast.error('Failed to import transcripts');
    } finally {
      setImporting(false);
    }
  };

  const wordCount = (text: string) => text.split(/\s+/).filter(Boolean).length;

  return (
    <div className="modal-backdrop fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm" onClick={onClose}>
      <div
        className="modal-content w-full max-w-2xl max-h-[80vh] flex flex-col rounded-2xl bg-white shadow-xl ring-1 ring-black/5 dark:bg-gray-800"
        onClick={e => e.stopPropagation()}
      >
        <div className="p-6 pb-3">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Import from Another Canvas</h3>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            Copy transcripts from one of your other canvases.
          </p>
        </div>

        <div className="flex-1 overflow-y-auto px-6 pb-6">
          {loading ? (
            <div className="py-8 text-center text-gray-400">Loading canvases...</div>
          ) : canvases.length === 0 ? (
            <div className="py-8 text-center text-gray-400">No other canvases available</div>
          ) : (
            <>
              <div className="mb-4">
                <label className="label">Source Canvas</label>
                <select
                  className="input mt-1"
                  value={selectedCanvasId || ''}
                  onChange={e => handleSelectCanvas(e.target.value)}
                >
                  <option value="">Select a canvas...</option>
                  {canvases.map(c => (
                    <option key={c.id} value={c.id}>
                      {c.name} ({c._count?.transcripts || 0} transcripts)
                    </option>
                  ))}
                </select>
              </div>

              {loadingDetail && (
                <div className="py-6 text-center text-gray-400">Loading transcripts...</div>
              )}
              {!loadingDetail && selectedCanvasId && transcripts.length === 0 && (
                <div className="py-6 text-center text-gray-400">No transcripts in this canvas</div>
              )}
              {transcripts.length > 0 && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between mb-2">
                    <button
                      onClick={toggleAll}
                      className="text-xs text-blue-600 hover:text-blue-700 dark:text-blue-400"
                    >
                      {selectedIds.size === transcripts.length ? 'Deselect All' : 'Select All'}
                    </button>
                    <span className="text-xs text-gray-400">{selectedIds.size} of {transcripts.length} selected</span>
                  </div>
                  {transcripts.map(t => (
                    <label
                      key={t.id}
                      className={`flex items-start gap-3 rounded-lg border p-3 cursor-pointer transition-colors ${
                        selectedIds.has(t.id)
                          ? 'border-purple-300 bg-purple-50/50 dark:border-purple-700 dark:bg-purple-900/20'
                          : 'border-gray-200 hover:border-gray-300 dark:border-gray-700 dark:hover:border-gray-600'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={selectedIds.has(t.id)}
                        onChange={() => toggleId(t.id)}
                        className="mt-0.5 h-4 w-4 rounded border-gray-300 text-purple-600"
                      />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <p className="text-xs font-medium text-gray-700 dark:text-gray-300">{t.title}</p>
                          <span className="text-[10px] text-gray-400">{wordCount(t.content)} words</span>
                        </div>
                        <p className="mt-0.5 text-xs text-gray-400 line-clamp-1">{t.content}</p>
                      </div>
                    </label>
                  ))}
                </div>
              )}
            </>
          )}
        </div>

        <div className="flex justify-end gap-3 border-t border-gray-200 px-6 py-4 dark:border-gray-700">
          <button onClick={onClose} className="btn-secondary text-sm">Cancel</button>
          <button
            onClick={handleImport}
            disabled={importing || selectedIds.size === 0}
            className="btn-primary text-sm"
          >
            {importing ? 'Importing...' : `Import ${selectedIds.size > 0 ? selectedIds.size : ''} Selected`}
          </button>
        </div>
      </div>
    </div>
  );
}
