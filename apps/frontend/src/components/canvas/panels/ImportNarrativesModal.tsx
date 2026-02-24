import { useState } from 'react';
import { createWiseShiftBridge } from '../../../services/api';
import { useCanvasStore } from '../../../stores/canvasStore';
import toast from 'react-hot-toast';

interface Narrative {
  id: string;
  textValue: string;
  questionId: string;
  domainKey: string;
  organisationName: string;
  assessmentId: string;
}

interface Props {
  onClose: () => void;
}

export default function ImportNarrativesModal({ onClose }: Props) {
  const { importNarratives } = useCanvasStore();

  // WISEShift connection settings
  const [wiseShiftUrl, setWiseShiftUrl] = useState('http://localhost:3006');
  const [dashboardCode, setDashboardCode] = useState('');
  const [connected, setConnected] = useState(false);

  // Data
  const [narratives, setNarratives] = useState<Narrative[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);
  const [importing, setImporting] = useState(false);

  // Manual text input mode
  const [mode, setMode] = useState<'bridge' | 'manual'>('bridge');
  const [manualTitle, setManualTitle] = useState('');
  const [manualContent, setManualContent] = useState('');

  const handleConnect = async () => {
    if (!wiseShiftUrl.trim() || !dashboardCode.trim()) {
      toast.error('Please enter both URL and dashboard code');
      return;
    }
    setLoading(true);
    try {
      const bridge = createWiseShiftBridge(wiseShiftUrl.trim(), dashboardCode.trim());
      const res = await bridge.getNarratives({});
      const data: Narrative[] = res.data.data || [];
      setNarratives(data);
      setConnected(true);
      if (data.length === 0) {
        toast('No narrative responses found', { icon: 'i' });
      } else {
        toast.success(`Found ${data.length} narrative responses`);
      }
    } catch (err: any) {
      const msg = err.response?.data?.error || err.message || 'Connection failed';
      toast.error(`Failed to connect: ${msg}`);
    } finally {
      setLoading(false);
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
    if (selectedIds.size === narratives.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(narratives.map(n => n.id)));
    }
  };

  const handleImportFromBridge = async () => {
    if (selectedIds.size === 0) return;
    setImporting(true);
    try {
      const selected = narratives.filter(n => selectedIds.has(n.id));
      const formatted = selected.map(n => ({
        title: `${n.organisationName} — ${n.domainKey}: ${(n.textValue || '').slice(0, 60).replace(/\s+\S*$/, '')}...`,
        content: n.textValue,
        sourceType: 'wiseshift-import',
        sourceId: n.id,
      }));
      await importNarratives(formatted);
      toast.success(`Imported ${formatted.length} narrative${formatted.length > 1 ? 's' : ''}`);
      onClose();
    } catch {
      toast.error('Failed to import narratives');
    } finally {
      setImporting(false);
    }
  };

  const handleManualImport = async () => {
    if (!manualTitle.trim() || !manualContent.trim()) return;
    setImporting(true);
    try {
      await importNarratives([{ title: manualTitle.trim(), content: manualContent.trim(), sourceType: 'manual' }]);
      toast.success('Transcript added');
      onClose();
    } catch {
      toast.error('Failed to add transcript');
    } finally {
      setImporting(false);
    }
  };

  return (
    <div className="modal-backdrop fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm" onClick={onClose}>
      <div
        className="modal-content w-full max-w-2xl max-h-[80vh] flex flex-col rounded-2xl bg-white shadow-xl ring-1 ring-black/5 dark:bg-gray-800"
        onClick={e => e.stopPropagation()}
      >
        <div className="p-6 pb-3">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Import Narratives</h3>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            Import text from WISEShift or enter manually.
          </p>

          {/* Mode selector */}
          <div className="flex mt-3 bg-gray-100 dark:bg-gray-700 rounded-lg p-1">
            <button
              onClick={() => setMode('bridge')}
              className={`flex-1 py-1.5 text-xs font-medium rounded-md transition-colors ${
                mode === 'bridge' ? 'bg-white dark:bg-gray-600 shadow text-brand-600 dark:text-brand-300' : 'text-gray-500'
              }`}
            >
              WISEShift Bridge
            </button>
            <button
              onClick={() => setMode('manual')}
              className={`flex-1 py-1.5 text-xs font-medium rounded-md transition-colors ${
                mode === 'manual' ? 'bg-white dark:bg-gray-600 shadow text-brand-600 dark:text-brand-300' : 'text-gray-500'
              }`}
            >
              Manual Entry
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-6 pb-6">
          {mode === 'manual' ? (
            <div className="space-y-3">
              <div>
                <label className="label">Title</label>
                <input
                  type="text"
                  className="input"
                  value={manualTitle}
                  onChange={e => setManualTitle(e.target.value)}
                  placeholder="Transcript title..."
                />
              </div>
              <div>
                <label className="label">Content</label>
                <textarea
                  className="input min-h-[200px]"
                  value={manualContent}
                  onChange={e => setManualContent(e.target.value)}
                  placeholder="Paste transcript text here..."
                />
              </div>
            </div>
          ) : !connected ? (
            <div className="space-y-3">
              <div>
                <label className="label">WISEShift URL</label>
                <input
                  type="text"
                  className="input"
                  value={wiseShiftUrl}
                  onChange={e => setWiseShiftUrl(e.target.value)}
                  placeholder="http://localhost:3006"
                />
              </div>
              <div>
                <label className="label">Dashboard Code</label>
                <input
                  type="text"
                  className="input"
                  value={dashboardCode}
                  onChange={e => setDashboardCode(e.target.value)}
                  placeholder="DASH-XXXXXXXX"
                />
              </div>
              <button
                onClick={handleConnect}
                disabled={loading}
                className="btn-primary text-sm w-full"
              >
                {loading ? 'Connecting...' : 'Connect & Fetch Narratives'}
              </button>
            </div>
          ) : (
            <div className="space-y-2">
              {narratives.length === 0 ? (
                <div className="py-6 text-center text-gray-400">No narratives found</div>
              ) : (
                <>
                  <div className="flex items-center justify-between mb-2">
                    <button
                      onClick={toggleAll}
                      className="text-xs text-blue-600 hover:text-blue-700 dark:text-blue-400"
                    >
                      {selectedIds.size === narratives.length ? 'Deselect All' : 'Select All'}
                    </button>
                    <span className="text-xs text-gray-400">{selectedIds.size} of {narratives.length} selected</span>
                  </div>
                  {narratives.map(n => (
                    <label
                      key={n.id}
                      className={`flex items-start gap-3 rounded-lg border p-3 cursor-pointer transition-colors ${
                        selectedIds.has(n.id)
                          ? 'border-blue-300 bg-blue-50/50 dark:border-blue-700 dark:bg-blue-900/20'
                          : 'border-gray-200 hover:border-gray-300 dark:border-gray-700 dark:hover:border-gray-600'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={selectedIds.has(n.id)}
                        onChange={() => toggleId(n.id)}
                        className="mt-0.5 h-4 w-4 rounded border-gray-300 text-blue-600"
                      />
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-medium text-gray-700 dark:text-gray-300">
                          {n.organisationName} — {n.domainKey}
                        </p>
                        <p className="mt-0.5 text-xs text-gray-400 line-clamp-2">
                          {n.textValue}
                        </p>
                      </div>
                    </label>
                  ))}
                </>
              )}
            </div>
          )}
        </div>

        <div className="flex justify-end gap-3 border-t border-gray-200 px-6 py-4 dark:border-gray-700">
          <button onClick={onClose} className="btn-secondary text-sm">Cancel</button>
          {mode === 'manual' ? (
            <button
              onClick={handleManualImport}
              disabled={importing || !manualTitle.trim() || !manualContent.trim()}
              className="btn-primary text-sm"
            >
              {importing ? 'Adding...' : 'Add Transcript'}
            </button>
          ) : connected ? (
            <button
              onClick={handleImportFromBridge}
              disabled={importing || selectedIds.size === 0}
              className="btn-primary text-sm"
            >
              {importing ? 'Importing...' : `Import ${selectedIds.size > 0 ? selectedIds.size : ''} Selected`}
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
}
