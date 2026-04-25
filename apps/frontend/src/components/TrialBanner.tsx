import { Link } from 'react-router-dom';
import { useAuthStore } from '../stores/authStore';
import { useUIStore } from '../stores/uiStore';

const DAY_MS = 24 * 60 * 60 * 1000;

type BannerState = 'mid-trial' | 'last-day' | 'expired';

/**
 * Trial countdown banner shown on the canvas page.
 *
 * Reads the user's effective plan + trialEndsAt from authStore (hydrated
 * from /auth/me by CanvasPage). Three escalation levels — mid-trial,
 * last-day, expired — each with copy and CTA tuned to the urgency.
 *
 * Dismissal is per-day (uiStore.lastTrialBannerDismissalDate stores
 * 'YYYY-MM-DD'). The banner re-appears the next day so users get nudged
 * again as the trial nears expiry, but not spammed multiple times the
 * same day. Long-expired (>7 days past) banners stop showing — those
 * users have either churned or are using QualCanvas at the free tier
 * permanently, and we don't need to keep nagging.
 */
function computeBannerState({
  trialEndsAt,
  plan,
  lastDismissalDate,
}: {
  trialEndsAt: string | null;
  plan: string | null;
  lastDismissalDate: string | null;
}): BannerState | null {
  if (!trialEndsAt) return null;
  // User has paid — banner only relevant for the trialing/expired cases.
  if (plan === 'pro' || plan === 'team') return null;

  const todayKey = new Date().toISOString().slice(0, 10);
  if (lastDismissalDate === todayKey) return null;

  const ms = new Date(trialEndsAt).getTime() - Date.now();
  const daysRemaining = Math.ceil(ms / DAY_MS);

  if (daysRemaining > 7) return null; // first half of trial: silent
  if (daysRemaining > 1) return 'mid-trial'; // last week of trial
  if (daysRemaining === 1) return 'last-day'; // less than 24h left
  if (daysRemaining > -7) return 'expired'; // up to 7 days post-expiry
  return null; // long-expired: stop nagging
}

const COPY: Record<
  BannerState,
  {
    tone: string;
    message: (daysLeft: number) => string;
    cta: string;
  }
> = {
  'mid-trial': {
    tone: 'border-blue-200 bg-blue-50 text-blue-800 dark:border-blue-800 dark:bg-blue-900/30 dark:text-blue-200',
    message: (d) =>
      `You have ${d} day${d === 1 ? '' : 's'} left of your Pro trial. Add a card to keep all features after your trial ends.`,
    cta: 'Add card',
  },
  'last-day': {
    tone: 'border-amber-300 bg-amber-50 text-amber-900 dark:border-amber-700 dark:bg-amber-900/30 dark:text-amber-200',
    message: () => 'Just 1 day left in your Pro trial. Add a card now to keep your work flowing on Pro.',
    cta: 'Add card now',
  },
  expired: {
    tone: 'border-rose-300 bg-rose-50 text-rose-900 dark:border-rose-800 dark:bg-rose-900/30 dark:text-rose-200',
    message: () =>
      'Your Pro trial ended. Your data is safe, but new canvases, codes, and analyses are now limited to the Free tier.',
    cta: 'Upgrade to Pro',
  },
};

export default function TrialBanner() {
  const trialEndsAt = useAuthStore((s) => s.trialEndsAt);
  const plan = useAuthStore((s) => s.plan);
  const authType = useAuthStore((s) => s.authType);
  const lastDismissalDate = useUIStore((s) => s.lastTrialBannerDismissalDate);
  const dismissToday = useUIStore((s) => s.dismissTrialBannerToday);

  // Legacy access-code users are grandfathered to Pro and never have a
  // trialEndsAt — short-circuit before reading anything.
  if (authType !== 'email') return null;

  const state = computeBannerState({ trialEndsAt, plan, lastDismissalDate });
  if (!state) return null;

  const daysLeft = trialEndsAt ? Math.max(0, Math.ceil((new Date(trialEndsAt).getTime() - Date.now()) / DAY_MS)) : 0;
  const { tone, message, cta } = COPY[state];

  return (
    <div
      role="status"
      aria-live={state === 'last-day' || state === 'expired' ? 'polite' : 'off'}
      className={`flex-shrink-0 border-b ${tone}`}
    >
      <div className="px-4 py-2 flex items-center justify-between gap-3 text-sm">
        <div className="flex items-center gap-2">
          <svg
            className="h-4 w-4 flex-shrink-0"
            fill="none"
            viewBox="0 0 24 24"
            strokeWidth={1.5}
            stroke="currentColor"
            aria-hidden="true"
          >
            {state === 'expired' ? (
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M12 9v3.75m9-.75a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9 3.75h.008v.008H12v-.008Z"
              />
            ) : (
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
            )}
          </svg>
          <span>{message(daysLeft)}</span>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <Link
            to="/pricing"
            className="rounded-md px-3 py-1 text-xs font-semibold ring-1 ring-current/20 hover:bg-current/10 transition-colors"
          >
            {cta}
          </Link>
          <button
            onClick={dismissToday}
            className="rounded p-0.5 hover:bg-current/10 transition-colors"
            title="Dismiss for today"
            aria-label="Dismiss trial banner for today"
          >
            <svg
              className="h-4 w-4"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={1.5}
              stroke="currentColor"
              aria-hidden="true"
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}
