import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useAuthStore } from '../stores/authStore';
import { useUIStore } from '../stores/uiStore';
import { useAiConfigStore } from '../stores/aiConfigStore';
import { useCanvasPlanLimits } from '../hooks/useCanvasPlan';
import { useEscapeToClose } from '../hooks/useEscapeToClose';
import { useFocusTrap } from '../hooks/useFocusTrap';
import AiCodingSample from './ai/AiCodingSample';

function AiCodingSampleModal({ onClose, onConnectKey }: { onClose: () => void; onConnectKey: () => void }) {
  const dialogRef = useRef<HTMLDivElement>(null);
  useFocusTrap(dialogRef);
  useEscapeToClose(onClose);

  return createPortal(
    <div
      className="modal-backdrop fixed inset-0 z-[9999] flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="ai-coding-sample-modal-title"
        className="modal-content flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl ring-1 ring-black/5 dark:bg-gray-900"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-gray-200 px-5 py-3.5 dark:border-gray-700">
          <h2 id="ai-coding-sample-modal-title" className="text-base font-semibold text-gray-900 dark:text-gray-100">
            See how AI coding works
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close worked sample"
            className="rounded p-1 text-gray-500 hover:bg-gray-100 hover:text-gray-700 dark:hover:bg-gray-800 dark:hover:text-gray-200"
          >
            <svg
              className="h-5 w-5"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={1.5}
              stroke="currentColor"
              aria-hidden
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-5">
          <AiCodingSample onConnectKey={onConnectKey} />
        </div>
      </div>
    </div>,
    document.body,
  );
}

// Non-blocking banner for AI-entitled users whose AI key isn't set yet. Points
// them to the AI setup flow once; dismissal is per-session (we don't want to
// permanently hide it in case they revisit the setup later).
export default function AiSetupBanner() {
  const authType = useAuthStore((s) => s.authType);
  const seen = useUIStore((s) => s.featureDiscovery.aiPromptSeen);
  const markSeen = useUIStore((s) => s.markFeatureSeen);
  const { configured, loaded, fetchConfig, openWizard } = useAiConfigStore();
  const [dismissed, setDismissed] = useState(false);
  const [sampleOpen, setSampleOpen] = useState(false);

  // Derived from the plan limits rather than a hand-listed set of tier names —
  // the old `plan === 'pro' || plan === 'team'` test silently excluded Student,
  // a tier explicitly sold on full AI (aiEnabled: true).
  //
  // `checkAiAccess` resolves the plan from the canvas OWNER when a canvas is
  // open (M6), so entitlement follows the open canvas; with no canvas open
  // this is the viewer's own effective plan (trial overlay included). The key
  // itself is still per user, which is why the CTA still applies.
  const aiEntitled = useCanvasPlanLimits().aiEnabled;

  useEffect(() => {
    // AI keys are stored per email-auth user, so only AI-entitled email accounts
    // can actually configure one. Don't poll the endpoint for free or legacy
    // users — it would 401 for legacy (access-code) sessions and spam the console.
    if (authType === 'email' && aiEntitled) {
      fetchConfig();
    }
  }, [aiEntitled, authType, fetchConfig]);

  // Legacy (access-code) users are grandfathered to Pro but can't add an AI key
  // until they link an email — the Account page's AI Settings section is
  // email-auth only. Showing them the "add a key" CTA would dead-end on /account,
  // so gate the banner on email auth.
  const eligible = authType === 'email' && aiEntitled && loaded && !configured && !seen && !dismissed;
  if (!eligible) return null;

  const handleDismiss = () => {
    setDismissed(true);
    markSeen('aiPromptSeen');
  };

  return (
    <div className="flex-shrink-0 border-b border-indigo-200 bg-indigo-50 px-4 py-1.5 dark:border-indigo-800 dark:bg-indigo-900/30">
      <div className="flex items-center justify-between gap-3">
        {/* min-w-0 + truncate keep this to a single line at every width — it
            used to wrap to three lines on mobile, eating prime canvas space. */}
        <div className="flex min-w-0 items-center gap-2 text-sm text-indigo-800 dark:text-indigo-200">
          <svg
            className="h-4 w-4 flex-shrink-0"
            fill="none"
            viewBox="0 0 24 24"
            strokeWidth={1.5}
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M9.813 15.904 9 18.75l-.813-2.846a4.5 4.5 0 0 0-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 0 0 3.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 0 0 3.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 0 0-3.09 3.09Z"
            />
          </svg>
          <span className="truncate">
            <button type="button" onClick={() => openWizard()} className="font-medium underline hover:no-underline">
              Connect your AI account
            </button>{' '}
            to use transcription, AI code suggestions, auto-coding &amp; summaries (you pay your provider directly).{' '}
            <button
              type="button"
              onClick={() => setSampleOpen(true)}
              className="font-medium underline hover:no-underline"
            >
              See worked sample (no key)
            </button>
          </span>
        </div>
        <button
          onClick={handleDismiss}
          className="rounded p-0.5 text-indigo-600 hover:bg-indigo-100 dark:text-indigo-400 dark:hover:bg-indigo-800/50"
          title="Dismiss"
          aria-label="Dismiss AI setup banner"
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
          </svg>
        </button>
      </div>
      {sampleOpen && (
        <AiCodingSampleModal
          onClose={() => setSampleOpen(false)}
          onConnectKey={() => {
            setSampleOpen(false);
            openWizard();
          }}
        />
      )}
    </div>
  );
}
