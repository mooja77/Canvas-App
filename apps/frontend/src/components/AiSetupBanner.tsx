import { useEffect, useState } from 'react';
import { useAuthStore } from '../stores/authStore';
import { useUIStore } from '../stores/uiStore';
import { useAiConfigStore } from '../stores/aiConfigStore';

// Non-blocking banner for Pro/Team users whose AI key isn't set yet. Points
// them to the AI setup flow once; dismissal is per-session (we don't want to
// permanently hide it in case they revisit the setup later).
export default function AiSetupBanner() {
  const plan = useAuthStore((s) => s.plan);
  const authType = useAuthStore((s) => s.authType);
  const seen = useUIStore((s) => s.featureDiscovery.aiPromptSeen);
  const markSeen = useUIStore((s) => s.markFeatureSeen);
  const { configured, loaded, fetchConfig } = useAiConfigStore();
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    // AI keys are stored per email-auth user, so only Pro/Team email accounts can
    // actually configure one. Don't poll the endpoint for free or legacy users —
    // it would 401 for legacy (access-code) sessions and spam the console.
    if (authType === 'email' && (plan === 'pro' || plan === 'team')) {
      fetchConfig();
    }
  }, [plan, authType, fetchConfig]);

  // Legacy (access-code) users are grandfathered to Pro but can't add an AI key
  // until they link an email — the Account page's AI Settings section is
  // email-auth only. Showing them the "add a key" CTA would dead-end on /account,
  // so gate the banner on email auth.
  const eligible =
    authType === 'email' && (plan === 'pro' || plan === 'team') && loaded && !configured && !seen && !dismissed;
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
            <a href="/account#ai" className="font-medium underline hover:no-underline">
              Add an OpenAI or Anthropic key
            </a>{' '}
            to enable AI code suggestions, auto-coding &amp; summaries.
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
    </div>
  );
}
