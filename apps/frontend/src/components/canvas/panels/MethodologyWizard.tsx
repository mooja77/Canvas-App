import { useState } from 'react';
import { createPortal } from 'react-dom';
import toast from 'react-hot-toast';
import { useEscapeToClose } from '../../../hooks/useEscapeToClose';
import { METHODOLOGY_PARADIGMS, getParadigm } from '../../../data/methodologyParadigms';

interface Props {
  onClose: () => void;
}

/**
 * Guided methodology wizard. Pick a qualitative paradigm, then walk its
 * workflow step-by-step (each mapped to QualCanvas actions). Navigable
 * (Back/Next), can change method, and is dismissible at any time. Guidance
 * only — nothing is enforced on the canvas.
 */
export default function MethodologyWizard({ onClose }: Props) {
  useEscapeToClose(onClose);
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [stepIndex, setStepIndex] = useState(0);

  const paradigm = selectedKey ? getParadigm(selectedKey) : undefined;

  const select = (key: string) => {
    setSelectedKey(key);
    setStepIndex(0);
  };

  const back = () => {
    if (stepIndex === 0) {
      setSelectedKey(null); // back to the method picker
    } else {
      setStepIndex((i) => i - 1);
    }
  };

  const next = () => {
    if (!paradigm) return;
    if (stepIndex < paradigm.steps.length - 1) {
      setStepIndex((i) => i + 1);
    } else {
      toast.success(`You're set up for ${paradigm.name}. Happy coding!`);
      onClose();
    }
  };

  return createPortal(
    <div
      className="modal-backdrop fixed inset-0 z-[9999] flex items-center justify-center bg-black/40 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="methodology-wizard-title"
        className="modal-content flex max-h-[85vh] w-full max-w-2xl flex-col rounded-2xl bg-white shadow-xl ring-1 ring-black/5 dark:bg-gray-800"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start justify-between gap-3 p-5 pb-3">
          <div>
            <h3 id="methodology-wizard-title" className="text-lg font-semibold text-gray-900 dark:text-gray-100">
              Methodology Guide
            </h3>
            <p className="mt-0.5 text-sm text-gray-500 dark:text-gray-400">
              {paradigm ? paradigm.name : 'Choose your qualitative approach — we’ll walk its workflow in QualCanvas.'}
            </p>
          </div>
          <button
            onClick={onClose}
            aria-label="Dismiss methodology guide"
            className="shrink-0 rounded p-1 text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700"
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-5 pb-4">
          {!paradigm ? (
            // ─── Method selection ───
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              {METHODOLOGY_PARADIGMS.map((p) => (
                <button
                  key={p.key}
                  onClick={() => select(p.key)}
                  className="flex flex-col rounded-xl border border-gray-200 p-3 text-left transition-colors hover:border-blue-400 hover:bg-blue-50/40 dark:border-gray-700 dark:hover:border-blue-600 dark:hover:bg-blue-900/20"
                >
                  <span className="text-sm font-semibold text-gray-800 dark:text-gray-100">{p.name}</span>
                  <span className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">{p.tagline}</span>
                </button>
              ))}
            </div>
          ) : (
            // ─── Step walkthrough ───
            <div>
              {/* Progress */}
              <div className="mb-3">
                <div className="mb-1 flex items-center justify-between text-xs text-gray-500 dark:text-gray-400">
                  <span>
                    Step {stepIndex + 1} of {paradigm.steps.length}
                  </span>
                  <button
                    onClick={() => setSelectedKey(null)}
                    className="text-blue-600 hover:underline dark:text-blue-400"
                  >
                    Change method
                  </button>
                </div>
                <div className="h-1 w-full rounded-full bg-gray-100 dark:bg-gray-700">
                  <div
                    className="h-1 rounded-full bg-blue-500 transition-all"
                    style={{ width: `${((stepIndex + 1) / paradigm.steps.length) * 100}%` }}
                  />
                </div>
              </div>

              {/* Current step */}
              <h4 className="text-base font-semibold text-gray-900 dark:text-gray-100">
                {paradigm.steps[stepIndex].title}
              </h4>
              <p className="mt-1.5 text-sm leading-relaxed text-gray-600 dark:text-gray-300">
                {paradigm.steps[stepIndex].guidance}
              </p>
              <div className="mt-3 rounded-lg border border-blue-100 bg-blue-50/60 p-3 dark:border-blue-900/40 dark:bg-blue-900/20">
                <p className="text-xs font-medium uppercase tracking-wide text-blue-600 dark:text-blue-400">
                  In QualCanvas
                </p>
                <p className="mt-1 text-sm text-gray-700 dark:text-gray-200">{paradigm.steps[stepIndex].inCanvas}</p>
              </div>

              {/* Context on the first step */}
              {stepIndex === 0 && (
                <div className="mt-3 space-y-1.5 text-xs text-gray-500 dark:text-gray-400">
                  <p>
                    <span className="font-medium text-gray-600 dark:text-gray-300">Best for: </span>
                    {paradigm.bestFor}
                  </p>
                  <p>
                    <span className="font-medium text-gray-600 dark:text-gray-300">Reliability: </span>
                    {paradigm.icrNote}
                  </p>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        {paradigm && (
          <div className="flex items-center justify-between border-t border-gray-200 px-5 py-3 dark:border-gray-700">
            <button onClick={back} className="btn-secondary text-sm">
              {stepIndex === 0 ? 'Choose method' : 'Back'}
            </button>
            <button onClick={next} className="btn-primary text-sm">
              {stepIndex < paradigm.steps.length - 1 ? 'Next' : 'Done'}
            </button>
          </div>
        )}
      </div>
    </div>,
    document.body,
  );
}
