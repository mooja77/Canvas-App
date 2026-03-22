import { useState } from 'react';
import { createPortal } from 'react-dom';
import { useCanvasTranscripts } from '../../../stores/canvasStore';

interface AiAutoCodeModalProps {
  onSubmit: (transcriptId: string, instructions?: string) => void;
  loading: boolean;
  onClose: () => void;
}

export default function AiAutoCodeModal({ onSubmit, loading, onClose }: AiAutoCodeModalProps) {
  const transcripts = useCanvasTranscripts();
  const [selectedTranscriptId, setSelectedTranscriptId] = useState(
    transcripts.length > 0 ? transcripts[0].id : '',
  );
  const [instructions, setInstructions] = useState('');

  return createPortal(
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/40" onClick={onClose}>
      <div
        className="w-full max-w-md rounded-xl bg-white p-5 shadow-2xl dark:bg-gray-900"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-2 mb-4">
          <svg className="h-5 w-5 text-purple-500" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904 9 18.75l-.813-2.846a4.5 4.5 0 0 0-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 0 0 3.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 0 0 3.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 0 0-3.09 3.09ZM18.259 8.715 18 9.75l-.259-1.035a3.375 3.375 0 0 0-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 0 0 2.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 0 0 2.455 2.456L21.75 6l-1.036.259a3.375 3.375 0 0 0-2.455 2.456Z" />
          </svg>
          <h2 className="text-base font-semibold text-gray-800 dark:text-gray-200">
            AI Auto-Code Transcript
          </h2>
        </div>

        <p className="mb-3 text-xs text-gray-500 dark:text-gray-400">
          AI will analyze the transcript and suggest thematic codes for relevant passages. All suggestions will be reviewed before applying.
        </p>

        <label className="block mb-1 text-xs font-medium text-gray-600 dark:text-gray-400">
          Transcript
        </label>
        <select
          value={selectedTranscriptId}
          onChange={(e) => setSelectedTranscriptId(e.target.value)}
          className="mb-3 w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-800 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200"
        >
          {transcripts.map((t) => (
            <option key={t.id} value={t.id}>
              {t.title}
            </option>
          ))}
        </select>

        <label className="block mb-1 text-xs font-medium text-gray-600 dark:text-gray-400">
          Instructions (optional)
        </label>
        <textarea
          value={instructions}
          onChange={(e) => setInstructions(e.target.value)}
          placeholder="e.g., Focus on themes related to workplace culture..."
          rows={3}
          className="mb-4 w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-800 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200"
          maxLength={1000}
        />

        <div className="flex justify-end gap-2">
          <button
            onClick={onClose}
            className="rounded-lg px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-800"
            disabled={loading}
          >
            Cancel
          </button>
          <button
            onClick={() => onSubmit(selectedTranscriptId, instructions || undefined)}
            disabled={loading || !selectedTranscriptId}
            className="flex items-center gap-1.5 rounded-lg bg-purple-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-purple-700 disabled:opacity-50"
          >
            {loading ? (
              <>
                <div className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                Analyzing...
              </>
            ) : (
              <>
                <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904 9 18.75l-.813-2.846a4.5 4.5 0 0 0-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 0 0 3.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 0 0 3.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 0 0-3.09 3.09Z" />
                </svg>
                Auto-Code
              </>
            )}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
