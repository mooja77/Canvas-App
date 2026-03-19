import { useState, useEffect, useCallback } from 'react';
import { canvasApi } from '../../../services/api';
import { useCanvasStore } from '../../../stores/canvasStore';
import toast from 'react-hot-toast';

interface TranscriptionJob {
  id: string;
  status: string;
  progress: number;
  resultText?: string;
  errorMessage?: string;
}

interface TranscriptionStatusPanelProps {
  jobId: string;
  onClose: () => void;
}

export default function TranscriptionStatusPanel({ jobId, onClose }: TranscriptionStatusPanelProps) {
  const activeCanvasId = useCanvasStore((s) => s.activeCanvasId);
  const refreshCanvas = useCanvasStore((s) => s.refreshCanvas);
  const [job, setJob] = useState<TranscriptionJob | null>(null);
  const [accepting, setAccepting] = useState(false);

  // Poll for job status
  useEffect(() => {
    if (!activeCanvasId) return;

    const poll = async () => {
      try {
        const res = await canvasApi.getTranscriptionJob(activeCanvasId, jobId);
        setJob(res.data.data);
      } catch {
        // ignore
      }
    };

    poll();
    const interval = setInterval(poll, 2000);

    return () => clearInterval(interval);
  }, [activeCanvasId, jobId]);

  // Stop polling once complete/failed
  useEffect(() => {
    if (job?.status === 'completed' || job?.status === 'failed') {
      // No more polling needed
    }
  }, [job?.status]);

  const handleAccept = useCallback(async () => {
    if (!activeCanvasId || !jobId) return;
    setAccepting(true);
    try {
      await canvasApi.acceptTranscription(activeCanvasId, jobId);
      await refreshCanvas();
      toast.success('Transcription added as transcript');
      onClose();
    } catch {
      toast.error('Failed to accept transcription');
    } finally {
      setAccepting(false);
    }
  }, [activeCanvasId, jobId, refreshCanvas, onClose]);

  return (
    <div className="absolute top-4 right-4 z-50 w-72 rounded-xl border border-blue-200 bg-white shadow-xl dark:border-blue-800 dark:bg-gray-900">
      <div className="flex items-center justify-between border-b border-blue-100 px-3 py-2 dark:border-blue-800">
        <div className="flex items-center gap-2">
          <svg className="h-4 w-4 text-blue-500" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 18.75a6 6 0 0 0 6-6v-1.5m-6 7.5a6 6 0 0 1-6-6v-1.5m6 7.5v3.75m-3.75 0h7.5M12 15.75a3 3 0 0 1-3-3V4.5a3 3 0 1 1 6 0v8.25a3 3 0 0 1-3 3Z" />
          </svg>
          <span className="text-sm font-medium text-blue-700 dark:text-blue-300">Transcription</span>
        </div>
        <button onClick={onClose} className="rounded p-0.5 text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800">
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      <div className="p-3">
        {(!job || job.status === 'queued' || job.status === 'processing') && (
          <div className="flex flex-col items-center gap-2 py-3">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-blue-200 border-t-blue-500" />
            <p className="text-xs text-gray-500">
              {job?.status === 'processing' ? 'Transcribing...' : 'Queued...'}
            </p>
            <div className="h-1.5 w-full rounded-full bg-gray-100 dark:bg-gray-700">
              <div
                className="h-1.5 rounded-full bg-blue-500 transition-all"
                style={{ width: `${job?.progress || 0}%` }}
              />
            </div>
          </div>
        )}

        {job?.status === 'completed' && (
          <>
            <div className="mb-2 max-h-32 overflow-y-auto rounded-lg bg-gray-50 p-2 text-xs text-gray-600 dark:bg-gray-800 dark:text-gray-400">
              {job.resultText?.slice(0, 500)}{(job.resultText?.length || 0) > 500 ? '...' : ''}
            </div>
            <button
              onClick={handleAccept}
              disabled={accepting}
              className="w-full rounded-lg bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
            >
              {accepting ? 'Adding...' : 'Accept & Create Transcript'}
            </button>
          </>
        )}

        {job?.status === 'failed' && (
          <div className="rounded-lg bg-red-50 p-2 text-xs text-red-600 dark:bg-red-900/20 dark:text-red-400">
            {job.errorMessage || 'Transcription failed'}
          </div>
        )}
      </div>
    </div>
  );
}
