import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuthStore } from '../stores/authStore';
import { useUIStore } from '../stores/uiStore';
import { useCanvasStore } from '../stores/canvasStore';
import { authApi, onboardingApi, type OnboardingState } from '../services/api';
import { usePageMeta } from '../hooks/usePageMeta';
import CodingCanvas from '../components/canvas/CodingCanvas';
import SetupWizard from '../components/SetupWizard';
import PlanWelcome from '../components/PlanWelcome';
import AiSetupBanner from '../components/AiSetupBanner';
import TrialBanner from '../components/TrialBanner';
import OnboardingFlow from '../components/onboarding/OnboardingFlow';
import OnboardingChecklist from '../components/onboarding/OnboardingChecklist';
import StatusBar from '../components/canvas/StatusBar';
import ActivityBar, { type ActivityId } from '../components/canvas/ActivityBar';
import ActivitySidebar from '../components/canvas/ActivitySidebar';
import { useFeatureFlag } from '../stores/featureFlagsStore';
import { resolveFirstRunSurface } from '../components/onboarding/firstRunSurface';
import { SunIcon, MoonIcon, ArrowRightStartOnRectangleIcon } from '@heroicons/react/24/outline';
import toast from 'react-hot-toast';

export default function CanvasPage() {
  const { authenticated, name, logout, authType, emailVerified, userId } = useAuthStore();
  const setTrialState = useAuthStore((s) => s.setTrialState);
  const { darkMode, toggleDarkMode, setupWizardComplete, completeSetupWizard, openFullProductTour } = useUIStore();
  const onboardingV2Complete = useUIStore((s) => s.onboardingV2Complete);
  const completeOnboardingV2 = useUIStore((s) => s.completeOnboardingV2);
  const prepareOnboardingForAccount = useUIStore((s) => s.prepareOnboardingForAccount);
  const hydrateOnboardingForAccount = useUIStore((s) => s.hydrateOnboardingForAccount);
  const onboardingV2Enabled = useFeatureFlag('onboarding_v2');
  const activityBarV2Enabled = useFeatureFlag('activity_bar_v2');
  const [activeActivity, setActiveActivity] = useState<ActivityId | null>(null);
  const planWelcomeSeen = useUIStore((s) => s.featureDiscovery.planWelcomeSeen);
  const [showPlanWelcome, setShowPlanWelcome] = useState(false);
  const canvases = useCanvasStore((s) => s.canvases);
  const fetchCanvases = useCanvasStore((s) => s.fetchCanvases);
  const closeCanvas = useCanvasStore((s) => s.closeCanvas);
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  usePageMeta(
    'Canvas — QualCanvas',
    'Your qualitative research workspace. Code transcripts, analyze themes, and collaborate.',
  );
  const [resending, setResending] = useState(false);
  const [bannerDismissed, setBannerDismissed] = useState(false);
  const [canvasesLoaded, setCanvasesLoaded] = useState(false);
  const [onboardingStateLoaded, setOnboardingStateLoaded] = useState(false);
  const [persistedOnboardingState, setPersistedOnboardingState] = useState<OnboardingState['state']>(null);

  const showVerificationBanner = authType === 'email' && !emailVerified && !bannerDismissed;

  // Fetch canvases before choosing the one first-run surface.
  useEffect(() => {
    if (authenticated && !canvasesLoaded) {
      fetchCanvases().then((loaded) => {
        if (loaded) setCanvasesLoaded(true);
      });
    }
  }, [authenticated, canvasesLoaded, fetchCanvases]);

  // Sync trial state from server on mount. The login response doesn't carry
  // trialEndsAt yet, so we hydrate it on the canvas page (where the trial
  // banner lives). Legacy users have authType === 'legacy' and skip this —
  // /auth/me's legacy branch doesn't return trialEndsAt anyway.
  useEffect(() => {
    if (!authenticated || authType !== 'email') return;
    authApi
      .getMe()
      .then((res) => {
        const u = res.data?.data?.user;
        if (u && typeof u.effectivePlan === 'string') {
          setTrialState({
            // Carry the REAL plan through too. The X-User-Plan response header
            // only ever reports the trial-overlaid tier, so /auth/me is the
            // only place `plan` gets refreshed mid-session (e.g. right after a
            // checkout completes).
            ...(typeof u.plan === 'string' ? { plan: u.plan } : {}),
            effectivePlan: u.effectivePlan,
            trialEndsAt: u.trialEndsAt ?? null,
          });
        }
      })
      .catch(() => {
        /* non-fatal — banner just won't appear on this page load */
      });
  }, [authenticated, authType, setTrialState]);

  // Hydrate the v2 decision from the authenticated account, not a browser-wide
  // completion bit. Waiting for this read prevents the flow from mounting in
  // the effect gap before the legacy wizard decides to show.
  useEffect(() => {
    if (!authenticated || !onboardingV2Enabled || authType !== 'email' || !userId) {
      setOnboardingStateLoaded(true);
      setPersistedOnboardingState(null);
      return;
    }

    let cancelled = false;
    setOnboardingStateLoaded(false);
    setPersistedOnboardingState(null);
    prepareOnboardingForAccount(userId);

    onboardingApi
      .get()
      .then((response) => {
        if (cancelled) return;
        const data = response.data.data;
        const state = data.state;
        hydrateOnboardingForAccount(userId, {
          completed: Boolean(data.completedAt),
          dismissedTooltips: Array.isArray(state?.dismissedTooltips)
            ? state.dismissedTooltips.filter((value): value is string => typeof value === 'string')
            : [],
          checklistComplete: Array.isArray(state?.checklistComplete)
            ? state.checklistComplete.filter((value): value is string => typeof value === 'string')
            : [],
        });
        setPersistedOnboardingState(state);
      })
      .catch(() => {
        // Keep the account-scoped reset and allow the visible v2 flow to work.
        // Server writes inside the flow are already best-effort.
      })
      .finally(() => {
        if (!cancelled) setOnboardingStateLoaded(true);
      });

    return () => {
      cancelled = true;
    };
  }, [authenticated, authType, hydrateOnboardingForAccount, onboardingV2Enabled, prepareOnboardingForAccount, userId]);

  // Existing users do not need either first-run surface even if they predate
  // server onboarding timestamps. This is local presentation state only.
  useEffect(() => {
    if (!canvasesLoaded || canvases.length === 0) return;
    if (onboardingV2Enabled && authType === 'email') completeOnboardingV2();
    else if (!setupWizardComplete) completeSetupWizard();
  }, [
    authType,
    canvases.length,
    canvasesLoaded,
    completeOnboardingV2,
    completeSetupWizard,
    onboardingV2Enabled,
    setupWizardComplete,
  ]);

  // Demo mode: ?demo=true triggers the guided tour
  useEffect(() => {
    if (searchParams.get('demo') === 'true' && authenticated) {
      openFullProductTour();
    }
  }, [searchParams, authenticated, openFullProductTour]);

  const handleResendVerification = async () => {
    if (resending) return;
    setResending(true);
    try {
      await authApi.resendVerification();
      toast.success('Verification email sent! Check your inbox.');
    } catch {
      toast.error('Failed to resend verification email');
    } finally {
      setResending(false);
    }
  };

  useEffect(() => {
    if (!authenticated) {
      navigate('/');
    }
  }, [authenticated, navigate]);

  // Flag the canvas page on body so index.html's CSS can hide the chat
  // widget (which otherwise overlaps the status bar + bookmarks).
  useEffect(() => {
    document.body.dataset.page = 'canvas';
    return () => {
      delete document.body.dataset.page;
    };
  }, []);

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  if (!authenticated) return null;

  const firstRunSurface = resolveFirstRunSurface({
    authenticated,
    authType,
    onboardingV2Enabled,
    canvasesLoaded,
    canvasCount: canvases.length,
    onboardingStateLoaded,
    onboardingV2Complete,
    setupWizardComplete,
  });

  return (
    <div className="h-screen flex flex-col bg-white dark:bg-gray-900">
      <a
        href="#canvas-main"
        className="sr-only focus:not-sr-only focus:absolute focus:z-50 focus:p-2 focus:bg-brand-600 focus:text-white focus:rounded"
      >
        Skip to canvas
      </a>
      {/* Screen-reader page heading — the workspace is otherwise heading-less,
          leaving SR users without a top-level landmark to orient on. */}
      <h1 className="sr-only">Canvas workspace</h1>
      {/* Minimal header */}
      <header className="flex-shrink-0 h-12 border-b border-gray-200/80 dark:border-gray-700/80 flex items-center justify-between px-4 bg-white/95 dark:bg-gray-800/95 backdrop-blur-md">
        <div className="flex items-center gap-3">
          {/* Logo doubles as a home button — clicking returns to the canvas
              list from anywhere. Mirrors the toolbar Back link: a real
              navigation to /canvas (with closeCanvas) reliably lands on the
              list, where an SPA navigate could leave a transient loading state. */}
          <a
            href="/canvas"
            onClick={closeCanvas}
            className="flex items-center gap-2 no-underline cursor-pointer hover:opacity-80 transition-opacity"
            title="Back to your canvases"
            aria-label="Back to your canvases"
          >
            <div className="w-7 h-7 bg-gradient-to-br from-brand-500 to-brand-700 rounded-lg flex items-center justify-center shadow-sm">
              <svg
                className="w-4 h-4 text-white"
                fill="none"
                viewBox="0 0 24 24"
                strokeWidth={1.5}
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z"
                />
              </svg>
            </div>
            <span className="font-semibold text-gray-900 dark:text-white text-sm tracking-tight">Canvas</span>
          </a>
        </div>

        <div className="flex items-center gap-2">
          <div className="flex items-center gap-2 px-2 py-1 rounded-lg bg-gray-50 dark:bg-gray-700/50">
            <div
              className="flex h-6 w-6 items-center justify-center rounded-full bg-gradient-to-br from-brand-400 to-brand-600 text-[10px] font-bold text-white shadow-sm"
              aria-hidden="true"
            >
              {name?.charAt(0).toUpperCase()}
            </div>
            <span className="text-xs font-medium text-gray-600 dark:text-gray-300 hidden sm:inline">{name}</span>
          </div>
          <button
            onClick={toggleDarkMode}
            className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
            title={darkMode ? 'Switch to light mode' : 'Switch to dark mode'}
            aria-label={darkMode ? 'Switch to light mode' : 'Switch to dark mode'}
          >
            {darkMode ? <SunIcon className="w-4 h-4" /> : <MoonIcon className="w-4 h-4" />}
          </button>
          <button
            onClick={handleLogout}
            className="flex items-center gap-1 px-2 py-1.5 rounded-lg text-xs text-gray-500 hover:text-red-600 dark:text-gray-400 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
            title="Sign out"
            aria-label="Sign out"
          >
            <ArrowRightStartOnRectangleIcon className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Sign out</span>
          </button>
        </div>
      </header>

      {/* Email verification banner */}
      {showVerificationBanner && (
        <div className="flex-shrink-0 bg-amber-50 dark:bg-amber-900/30 border-b border-amber-200 dark:border-amber-800 px-4 py-2 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-sm text-amber-800 dark:text-amber-200">
            <svg
              className="w-4 h-4 flex-shrink-0"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={1.5}
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M21.75 6.75v10.5a2.25 2.25 0 0 1-2.25 2.25h-15a2.25 2.25 0 0 1-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0 0 19.5 4.5h-15a2.25 2.25 0 0 0-2.25 2.25m19.5 0v.243a2.25 2.25 0 0 1-1.07 1.916l-7.5 4.615a2.25 2.25 0 0 1-2.36 0L3.32 8.91a2.25 2.25 0 0 1-1.07-1.916V6.75"
              />
            </svg>
            <span>
              Please verify your email. Check your inbox or{' '}
              <button
                onClick={handleResendVerification}
                disabled={resending}
                className="font-medium underline hover:no-underline disabled:opacity-50"
              >
                {resending ? 'sending...' : 'resend verification email'}
              </button>
              .
            </span>
          </div>
          <button
            onClick={() => setBannerDismissed(true)}
            className="p-0.5 rounded text-amber-600 dark:text-amber-400 hover:bg-amber-100 dark:hover:bg-amber-800/50 transition-colors"
            title="Dismiss"
            aria-label="Dismiss verification banner"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      )}

      <TrialBanner />
      <AiSetupBanner />

      {showPlanWelcome && <PlanWelcome onClose={() => setShowPlanWelcome(false)} />}

      {/* Legacy setup remains only for legacy sessions or when v2 is disabled. */}
      {firstRunSurface === 'legacy_setup' ? (
        <SetupWizard
          onComplete={() => {
            if (!planWelcomeSeen) setShowPlanWelcome(true);
          }}
        />
      ) : (
        /* Full-screen canvas workspace */
        <>
          <div id="canvas-main" className="flex-1 overflow-hidden flex" aria-label="Canvas workspace">
            {activityBarV2Enabled && (
              <>
                <ActivityBar
                  activeActivity={activeActivity}
                  onSelectActivity={(id) => setActiveActivity((prev) => (prev === id ? null : id))}
                />
                <ActivitySidebar activity={activeActivity} onClose={() => setActiveActivity(null)} />
              </>
            )}
            <main className="flex-1 overflow-hidden relative">
              <CodingCanvas />
              {onboardingV2Enabled && onboardingV2Complete && <OnboardingChecklist />}
            </main>
          </div>
          <StatusBar />
        </>
      )}

      {/* Account-hydrated onboarding v2 replaces the legacy wizard for email users. */}
      {firstRunSurface === 'onboarding_v2' && (
        <OnboardingFlow
          initialState={
            persistedOnboardingState as { currentStep?: number; personalization?: { method?: string } } | undefined
          }
          onClose={completeOnboardingV2}
        />
      )}
    </div>
  );
}
