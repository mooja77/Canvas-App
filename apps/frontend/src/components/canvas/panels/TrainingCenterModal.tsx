import { useState, useCallback, useEffect } from 'react';
import type { CanvasTranscript, CanvasQuestion, TrainingDocument } from '@qualcanvas/shared';
import { canvasApi } from '../../../services/api';
import toast from 'react-hot-toast';

interface TrainingCenterModalProps {
  isOpen: boolean;
  onClose: () => void;
  canvasId: string;
  transcripts: CanvasTranscript[];
  questions: CanvasQuestion[];
}

export default function TrainingCenterModal({
  isOpen,
  onClose,
  canvasId,
  transcripts,
  questions: _questions,
}: TrainingCenterModalProps) {
  const [trainingDocs, setTrainingDocs] = useState<TrainingDocument[]>([]);
  const [loading, setLoading] = useState(false);
  const [showCreate, setShowCreate] = useState(false);

  // Create form state
  const [name, setName] = useState('');
  const [instructions, setInstructions] = useState('');
  const [selectedTranscriptId, setSelectedTranscriptId] = useState('');
  const [passThreshold, setPassThreshold] = useState(0.7);

  const loadTrainingDocs = useCallback(async () => {
    try {
      setLoading(true);
      const res = await canvasApi.getTrainingDocuments(canvasId);
      setTrainingDocs(res.data.data);
    } catch {
      toast.error('Failed to load training documents');
    } finally {
      setLoading(false);
    }
  }, [canvasId]);

  useEffect(() => {
    if (isOpen) loadTrainingDocs();
  }, [isOpen, loadTrainingDocs]);

  const handleCreate = useCallback(async () => {
    if (!name || !selectedTranscriptId) {
      toast.error('Name and transcript are required');
      return;
    }

    try {
      // Use current codings for the selected transcript as gold standard
      // In practice, the user would code the transcript first, then save it as training
      const res = await canvasApi.createTrainingDocument(canvasId, {
        transcriptId: selectedTranscriptId,
        name,
        instructions: instructions || undefined,
        goldCodings: [], // User would populate these through the UI
        passThreshold,
      });

      setTrainingDocs(prev => [...prev, res.data.data]);
      setShowCreate(false);
      setName('');
      setInstructions('');
      setSelectedTranscriptId('');
      toast.success('Training document created');
    } catch {
      toast.error('Failed to create training document');
    }
  }, [canvasId, name, instructions, selectedTranscriptId, passThreshold]);

  const handleDelete = useCallback(async (docId: string) => {
    try {
      await canvasApi.deleteTrainingDocument(canvasId, docId);
      setTrainingDocs(prev => prev.filter(d => d.id !== docId));
      toast.success('Training document deleted');
    } catch {
      toast.error('Failed to delete training document');
    }
  }, [canvasId]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-3xl max-h-[85vh] flex flex-col">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-gray-800 dark:text-gray-200">
              Training Center
            </h2>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Create gold-standard documents and test intercoder reliability
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 text-xl"
          >
            &times;
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-6 py-4">
          {loading ? (
            <div className="text-center py-8 text-gray-500">Loading...</div>
          ) : (
            <>
              {/* Training document list */}
              {trainingDocs.length === 0 && !showCreate ? (
                <div className="text-center py-8">
                  <p className="text-gray-500 dark:text-gray-400 mb-4">
                    No training documents yet. Create one to start training coders.
                  </p>
                  <button
                    onClick={() => setShowCreate(true)}
                    className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 text-sm"
                  >
                    Create Training Document
                  </button>
                </div>
              ) : (
                <div className="space-y-3">
                  {trainingDocs.map(doc => {
                    const transcript = transcripts.find(t => t.id === doc.transcriptId);
                    return (
                      <div
                        key={doc.id}
                        className="border border-gray-200 dark:border-gray-600 rounded-lg p-4 hover:bg-gray-50 dark:hover:bg-gray-700/50"
                      >
                        <div className="flex items-start justify-between">
                          <div>
                            <h3 className="font-medium text-gray-800 dark:text-gray-200">
                              {doc.name}
                            </h3>
                            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                              Transcript: {transcript?.title || 'Unknown'}
                            </p>
                            {doc.instructions && (
                              <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">
                                {doc.instructions}
                              </p>
                            )}
                            <div className="flex items-center gap-4 mt-2 text-xs text-gray-500">
                              <span>Pass threshold: {(doc.passThreshold * 100).toFixed(0)}%</span>
                              <span>Gold codings: {doc.goldCodings.length}</span>
                            </div>
                          </div>
                          <button
                            onClick={() => handleDelete(doc.id)}
                            className="text-gray-400 hover:text-red-500 text-sm"
                            title="Delete"
                          >
                            &times;
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Create form */}
              {showCreate && (
                <div className="mt-4 border border-blue-200 dark:border-blue-800 rounded-lg p-4 bg-blue-50/50 dark:bg-blue-900/20">
                  <h3 className="text-sm font-semibold text-gray-800 dark:text-gray-200 mb-3">
                    New Training Document
                  </h3>

                  <div className="space-y-3">
                    <div>
                      <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Name *</label>
                      <input
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        className="w-full text-sm border border-gray-300 dark:border-gray-600 rounded px-3 py-1.5 bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-200"
                        placeholder="e.g., Theme Identification Training"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Transcript *</label>
                      <select
                        value={selectedTranscriptId}
                        onChange={(e) => setSelectedTranscriptId(e.target.value)}
                        className="w-full text-sm border border-gray-300 dark:border-gray-600 rounded px-3 py-1.5 bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-200"
                      >
                        <option value="">Select a transcript...</option>
                        {transcripts.map(t => (
                          <option key={t.id} value={t.id}>{t.title}</option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Instructions</label>
                      <textarea
                        value={instructions}
                        onChange={(e) => setInstructions(e.target.value)}
                        className="w-full text-sm border border-gray-300 dark:border-gray-600 rounded px-3 py-1.5 bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-200"
                        rows={3}
                        placeholder="Instructions for coders attempting this training..."
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
                        Pass Threshold (Kappa score): {(passThreshold * 100).toFixed(0)}%
                      </label>
                      <input
                        type="range"
                        min={0}
                        max={100}
                        value={passThreshold * 100}
                        onChange={(e) => setPassThreshold(parseInt(e.target.value) / 100)}
                        className="w-full"
                      />
                    </div>

                    <div className="flex justify-end gap-2">
                      <button
                        onClick={() => setShowCreate(false)}
                        className="px-3 py-1.5 text-sm text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded"
                      >
                        Cancel
                      </button>
                      <button
                        onClick={handleCreate}
                        disabled={!name || !selectedTranscriptId}
                        className="px-4 py-1.5 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
                      >
                        Create
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* Add button when list exists */}
              {trainingDocs.length > 0 && !showCreate && (
                <button
                  onClick={() => setShowCreate(true)}
                  className="mt-4 w-full py-2 text-sm text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded border border-dashed border-blue-300 dark:border-blue-700"
                >
                  + Create Training Document
                </button>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
