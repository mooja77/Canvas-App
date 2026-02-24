import { useState } from 'react';
import { useCanvasStore } from '../../../stores/canvasStore';
import ConfirmDialog from '../ConfirmDialog';
import type { CanvasCase, CanvasTranscript } from '@canvas-app/shared';
import toast from 'react-hot-toast';

interface CaseManagerPanelProps {
  onClose: () => void;
}

export default function CaseManagerPanel({ onClose }: CaseManagerPanelProps) {
  const { activeCanvas, addCase, updateCase, deleteCase, updateTranscript } = useCanvasStore();
  const [newName, setNewName] = useState('');
  const [newAttrs, setNewAttrs] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editAttrs, setEditAttrs] = useState('');
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  const cases = activeCanvas?.cases ?? [];
  const transcripts = activeCanvas?.transcripts ?? [];

  const parseAttrs = (str: string): Record<string, string> => {
    const result: Record<string, string> = {};
    str.split(',').forEach(pair => {
      const [key, val] = pair.split(':').map(s => s.trim());
      if (key && val) result[key] = val;
    });
    return result;
  };

  const handleCreate = async () => {
    if (!newName.trim()) return;
    try {
      await addCase(newName.trim(), newAttrs ? parseAttrs(newAttrs) : undefined);
      setNewName('');
      setNewAttrs('');
      toast.success('Case created');
    } catch {
      toast.error('Failed to create case');
    }
  };

  const handleUpdate = async (caseId: string) => {
    try {
      await updateCase(caseId, {
        name: editName.trim(),
        attributes: editAttrs ? parseAttrs(editAttrs) : {},
      });
      setEditingId(null);
      toast.success('Case updated');
    } catch {
      toast.error('Failed to update case');
    }
  };

  const handleAssignTranscript = async (tid: string, caseId: string | null) => {
    try {
      await updateTranscript(tid, { caseId });
    } catch {
      toast.error('Failed to assign transcript');
    }
  };

  const startEdit = (c: CanvasCase) => {
    setEditingId(c.id);
    setEditName(c.name);
    setEditAttrs(Object.entries(c.attributes || {}).map(([k, v]) => `${k}: ${v}`).join(', '));
  };

  return (
    <div className="modal-backdrop fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <div className="modal-content w-full max-w-lg rounded-2xl bg-white shadow-xl backdrop-blur-xl ring-1 ring-black/5 dark:bg-gray-800 max-h-[80vh] flex flex-col">
        <div className="flex items-center justify-between border-b border-gray-200 px-4 py-3 dark:border-gray-700">
          <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">Cases & Classifications</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {/* Create new case */}
          <div className="rounded-lg border border-gray-200 dark:border-gray-700 p-3 space-y-2">
            <h4 className="text-xs font-medium text-gray-700 dark:text-gray-300">New Case</h4>
            <input
              type="text"
              className="input w-full text-sm"
              placeholder="Case name (e.g. Participant A)"
              value={newName}
              onChange={e => setNewName(e.target.value)}
            />
            <input
              type="text"
              className="input w-full text-xs"
              placeholder="Attributes (e.g. role: Manager, org: NHS)"
              value={newAttrs}
              onChange={e => setNewAttrs(e.target.value)}
            />
            <button onClick={handleCreate} disabled={!newName.trim()} className="btn-primary h-7 px-3 text-xs disabled:opacity-50">
              Create Case
            </button>
          </div>

          {/* Existing cases */}
          {cases.map((c: CanvasCase) => (
            <div key={c.id} className="rounded-lg border border-gray-200 dark:border-gray-700 p-3">
              {editingId === c.id ? (
                <div className="space-y-2">
                  <input className="input w-full text-sm" value={editName} onChange={e => setEditName(e.target.value)} />
                  <input className="input w-full text-xs" placeholder="key: value, key: value" value={editAttrs} onChange={e => setEditAttrs(e.target.value)} />
                  <div className="flex gap-2">
                    <button onClick={() => handleUpdate(c.id)} className="btn-primary h-7 px-2 text-xs">Save</button>
                    <button onClick={() => setEditingId(null)} className="text-xs text-gray-400">Cancel</button>
                  </div>
                </div>
              ) : (
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium text-gray-800 dark:text-gray-200">{c.name}</span>
                    <div className="flex gap-1">
                      <button onClick={() => startEdit(c)} className="text-[10px] text-blue-500 hover:text-blue-700">Edit</button>
                      <button onClick={() => setConfirmDeleteId(c.id)} className="text-[10px] text-red-400 hover:text-red-600">Delete</button>
                    </div>
                  </div>
                  {Object.keys(c.attributes || {}).length > 0 && (
                    <div className="flex flex-wrap gap-1 mb-2">
                      {Object.entries(c.attributes).map(([k, v]) => (
                        <span key={k} className="rounded-full bg-teal-50 px-2 py-0.5 text-[10px] text-teal-700 dark:bg-teal-900/30 dark:text-teal-300">
                          {k}: {v}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Assign transcripts to this case */}
              <div className="mt-2 border-t border-gray-100 dark:border-gray-700 pt-2">
                <p className="text-[10px] font-medium text-gray-500 mb-1">Assigned Transcripts:</p>
                {transcripts.map((t: CanvasTranscript) => (
                  <label key={t.id} className="flex items-center gap-2 text-xs text-gray-700 dark:text-gray-300 mb-0.5">
                    <input
                      type="checkbox"
                      checked={t.caseId === c.id}
                      onChange={() => handleAssignTranscript(t.id, t.caseId === c.id ? null : c.id)}
                      className="rounded border-gray-300 h-3 w-3"
                    />
                    {t.title}
                  </label>
                ))}
              </div>
            </div>
          ))}

          {cases.length === 0 && (
            <p className="text-center text-xs text-gray-400 py-4">No cases yet. Create one above.</p>
          )}
        </div>

        {/* Delete confirmation */}
        {confirmDeleteId && (
          <ConfirmDialog
            title="Delete Case"
            message="Delete this case? Transcripts will be unlinked and relations removed."
            onConfirm={() => { deleteCase(confirmDeleteId); setConfirmDeleteId(null); }}
            onCancel={() => setConfirmDeleteId(null)}
          />
        )}
      </div>
    </div>
  );
}
