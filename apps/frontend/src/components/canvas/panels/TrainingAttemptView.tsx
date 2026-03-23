import { useState, useCallback, useEffect } from 'react';
import type { TrainingDocument, TrainingAttempt, CanvasQuestion } from '@canvas-app/shared';
import { canvasApi } from '../../../services/api';
import toast from 'react-hot-toast';

interface TrainingAttemptViewProps {
  isOpen: boolean;
  onClose: () => void;
  canvasId: string;
  trainingDocument: TrainingDocument;
  questions: CanvasQuestion[];
  transcriptContent: string;
}

interface CodingSpan {
  questionId: string;
  startOffset: number;
  endOffset: number;
  codedText: string;
}

export default function TrainingAttemptView({
  isOpen,
  onClose,
  canvasId,
  trainingDocument,
  questions,
  transcriptContent: _transcriptContent,
}: TrainingAttemptViewProps) {
  const [attempts, setAttempts] = useState<TrainingAttempt[]>([]);
  const [selectedAttempt, setSelectedAttempt] = useState<TrainingAttempt | null>(null);
  const [loading, setLoading] = useState(false);

  const loadAttempts = useCallback(async () => {
    try {
      setLoading(true);
      const res = await canvasApi.getTrainingAttempts(canvasId, trainingDocument.id);
      setAttempts(res.data.data);
    } catch {
      toast.error('Failed to load attempts');
    } finally {
      setLoading(false);
    }
  }, [canvasId, trainingDocument.id]);

  useEffect(() => {
    if (isOpen) loadAttempts();
  }, [isOpen, loadAttempts]);

  const getQuestionLabel = useCallback((questionId: string) => {
    const q = questions.find(q => q.id === questionId);
    return q?.text || 'Unknown Code';
  }, [questions]);

  const getQuestionColor = useCallback((questionId: string) => {
    const q = questions.find(q => q.id === questionId);
    return q?.color || '#3B82F6';
  }, [questions]);

  const getKappaLabel = (score: number) => {
    if (score >= 0.81) return { label: 'Almost Perfect', color: 'text-green-600' };
    if (score >= 0.61) return { label: 'Substantial', color: 'text-green-500' };
    if (score >= 0.41) return { label: 'Moderate', color: 'text-yellow-600' };
    if (score >= 0.21) return { label: 'Fair', color: 'text-orange-500' };
    if (score >= 0) return { label: 'Slight', color: 'text-red-500' };
    return { label: 'Poor', color: 'text-red-700' };
  };

  if (!isOpen) return null;

  const goldCodings = trainingDocument.goldCodings as CodingSpan[];
  const attemptCodings = selectedAttempt ? (selectedAttempt.codings as CodingSpan[]) : [];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-4xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-gray-800 dark:text-gray-200">
              Training Attempts: {trainingDocument.name}
            </h2>
            <p className="text-sm text-gray-500">
              Pass threshold: {(trainingDocument.passThreshold * 100).toFixed(0)}% Kappa
            </p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl">
            &times;
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-hidden flex">
          {/* Attempts list */}
          <div className="w-64 border-r border-gray-200 dark:border-gray-700 overflow-y-auto">
            <div className="p-3">
              <h3 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase mb-2">
                Attempts ({attempts.length})
              </h3>
              {loading ? (
                <p className="text-sm text-gray-500">Loading...</p>
              ) : attempts.length === 0 ? (
                <p className="text-sm text-gray-500">No attempts yet</p>
              ) : (
                <div className="space-y-1">
                  {attempts.map(attempt => {
                    const kappa = attempt.kappaScore ?? 0;
                    const kappaInfo = getKappaLabel(kappa);
                    return (
                      <button
                        key={attempt.id}
                        onClick={() => setSelectedAttempt(attempt)}
                        className={`w-full text-left p-2 rounded text-sm transition-colors ${
                          selectedAttempt?.id === attempt.id
                            ? 'bg-blue-100 dark:bg-blue-900/40'
                            : 'hover:bg-gray-100 dark:hover:bg-gray-700'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <span className={`text-xs font-medium ${kappaInfo.color}`}>
                            K={kappa.toFixed(3)}
                          </span>
                          <span className={`text-xs px-1.5 py-0.5 rounded-full ${
                            attempt.passed
                              ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                              : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                          }`}>
                            {attempt.passed ? 'Pass' : 'Fail'}
                          </span>
                        </div>
                        <div className="text-xs text-gray-500 mt-1">
                          {new Date(attempt.createdAt).toLocaleDateString()}
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* Comparison view */}
          <div className="flex-1 overflow-y-auto p-4">
            {selectedAttempt ? (
              <div className="space-y-4">
                {/* Kappa summary */}
                <div className={`p-3 rounded-lg ${
                  selectedAttempt.passed
                    ? 'bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800'
                    : 'bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800'
                }`}>
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="text-sm font-medium text-gray-800 dark:text-gray-200">
                        Kappa Score: {(selectedAttempt.kappaScore ?? 0).toFixed(3)}
                      </span>
                      <span className={`ml-2 text-xs ${getKappaLabel(selectedAttempt.kappaScore ?? 0).color}`}>
                        ({getKappaLabel(selectedAttempt.kappaScore ?? 0).label})
                      </span>
                    </div>
                    <span className={`text-sm font-semibold ${
                      selectedAttempt.passed ? 'text-green-700 dark:text-green-400' : 'text-red-700 dark:text-red-400'
                    }`}>
                      {selectedAttempt.passed ? 'PASSED' : 'FAILED'}
                    </span>
                  </div>
                </div>

                {/* Side-by-side comparison */}
                <div className="grid grid-cols-2 gap-4">
                  {/* Gold standard */}
                  <div>
                    <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                      Gold Standard ({goldCodings.length} codings)
                    </h4>
                    <div className="space-y-1 max-h-[400px] overflow-y-auto">
                      {goldCodings.map((c, i) => (
                        <div
                          key={i}
                          className="text-xs p-2 rounded border"
                          style={{
                            borderColor: getQuestionColor(c.questionId),
                            backgroundColor: `${getQuestionColor(c.questionId)}10`,
                          }}
                        >
                          <span className="font-medium" style={{ color: getQuestionColor(c.questionId) }}>
                            {getQuestionLabel(c.questionId)}
                          </span>
                          <p className="text-gray-600 dark:text-gray-400 mt-0.5 line-clamp-2">
                            "{c.codedText}"
                          </p>
                          <span className="text-gray-400">
                            [{c.startOffset}-{c.endOffset}]
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Attempt */}
                  <div>
                    <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                      Attempt ({attemptCodings.length} codings)
                    </h4>
                    <div className="space-y-1 max-h-[400px] overflow-y-auto">
                      {attemptCodings.map((c, i) => (
                        <div
                          key={i}
                          className="text-xs p-2 rounded border"
                          style={{
                            borderColor: getQuestionColor(c.questionId),
                            backgroundColor: `${getQuestionColor(c.questionId)}10`,
                          }}
                        >
                          <span className="font-medium" style={{ color: getQuestionColor(c.questionId) }}>
                            {getQuestionLabel(c.questionId)}
                          </span>
                          <p className="text-gray-600 dark:text-gray-400 mt-0.5 line-clamp-2">
                            "{c.codedText}"
                          </p>
                          <span className="text-gray-400">
                            [{c.startOffset}-{c.endOffset}]
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="flex items-center justify-center h-full text-gray-500 dark:text-gray-400">
                Select an attempt to view the comparison
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
