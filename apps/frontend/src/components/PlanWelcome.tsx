import { useAuthStore } from '../stores/authStore';
import { useUIStore } from '../stores/uiStore';

// Plan-specific welcome card shown once, right after the setup wizard.
// Each plan tier gets language and CTAs tailored to what they unlocked.
export default function PlanWelcome({ onClose }: { onClose: () => void }) {
  const plan = useAuthStore((s) => s.plan);
  const markSeen = useUIStore((s) => s.markFeatureSeen);

  const handleClose = () => {
    markSeen('planWelcomeSeen');
    onClose();
  };

  const content = (() => {
    if (plan === 'team') {
      return {
        title: 'Welcome to Team',
        lede: 'Your team plan unlocks real-time collaboration and cross-coder analytics.',
        items: [
          'Everything in Pro',
          'Create a team, invite members, collaborate in real-time',
          "Intercoder reliability (Cohen's Kappa)",
          'Unlimited share codes',
        ],
        cta: { label: 'Set up your team', href: '/team' },
      };
    }
    if (plan === 'pro') {
      return {
        title: 'Welcome to Pro',
        lede: 'Your Pro plan unlocks the full analysis suite and AI-assisted coding.',
        items: [
          'Unlimited canvases, transcripts, and codes',
          'All 10 analysis tools — Sentiment, Clustering, Co-occurrence',
          'AI-powered code suggestions and auto-coding',
          'Ethics & compliance panel',
          'Share canvases with up to 5 collaborators',
        ],
        cta: { label: 'Configure AI', href: '/account#ai' },
      };
    }
    return {
      title: 'Welcome to QualCanvas',
      lede: 'Your free plan is ready to go.',
      items: ['1 canvas, 2 transcripts, 5 codes', 'Statistics and Word Cloud analysis', 'CSV export'],
      cta: { label: 'See Pro features', href: '/pricing' },
    };
  })();

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center bg-gray-900/50 p-4 backdrop-blur-sm"
    >
      <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl dark:bg-gray-800">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">{content.title}</h2>
          <button
            onClick={handleClose}
            className="rounded p-1 text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700"
            title="Close"
            aria-label="Close welcome dialog"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <p className="mb-3 text-sm text-gray-600 dark:text-gray-400">{content.lede}</p>
        <ul className="mb-5 space-y-1.5 text-sm text-gray-700 dark:text-gray-300">
          {content.items.map((item) => (
            <li key={item} className="flex items-start gap-2">
              <svg
                className="mt-0.5 h-4 w-4 shrink-0 text-brand-500"
                fill="none"
                viewBox="0 0 24 24"
                strokeWidth={2}
                stroke="currentColor"
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
              </svg>
              <span>{item}</span>
            </li>
          ))}
        </ul>
        <div className="flex items-center justify-end gap-2">
          <button
            onClick={handleClose}
            className="rounded-lg px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-700"
          >
            Got it
          </button>
          <a
            href={content.cta.href}
            onClick={handleClose}
            className="rounded-lg bg-brand-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-brand-700"
          >
            {content.cta.label}
          </a>
        </div>
      </div>
    </div>
  );
}
