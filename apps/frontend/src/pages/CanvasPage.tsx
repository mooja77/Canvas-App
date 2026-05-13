import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuthStore } from '../stores/authStore';
import { useUIStore } from '../stores/uiStore';
import { useCanvasStore } from '../stores/canvasStore';
import { authApi } from '../services/api';
import { usePageMeta } from '../hooks/usePageMeta';
import CodingCanvas from '../components/canvas/CodingCanvas';
import SetupWizard from '../components/SetupWizard';
import PlanWelcome from '../components/PlanWelcome';
import AiSetupBanner from '../components/AiSetupBanner';
import TrialBanner from '../components/TrialBanner';
import OnboardingFlow from '../components/onboarding/OnboardingFlow';
import OnboardingChecklist from '../components/onboarding/OnboardingChecklist';
import { useFeatureFlag } from '../stores/featureFlagsStore';
import { SunIcon, MoonIcon, ArrowRightStartOnRectangleIcon } from '@heroicons/react/24/outline';
import toast from 'react-hot-toast';

export default function CanvasPage() {
  const { authenticated, name, logout, authType, emailVerified } = useAuthStore();
  const setTrialState = useAuthStore((s) => s.setTrialState);
  const { darkMode, toggleDarkMode, setupWizardComplete, completeSetupWizard, openFullProductTour } = useUIStore();
  const onboardingV2Complete = useUIStore((s) => s.onboardingV2Complete);
  const completeOnboardingV2 = useUIStore((s) => s.completeOnboardingV2);
  const onboardingV2Enabled = useFeatureFlag('onboarding_v2');
  const planWelcomeSeen = useUIStore((s) => s.featureDiscovery.planWelcomeSeen);
  const [showPlanWelcome, setShowPlanWelcome] = useState(false);
  const canvases = useCanvasStore((s) => s.canvases);
  const fetchCanvases = useCanvasStore((s) => s.fetchCanvases);
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  usePageMeta(
    'Canvas — QualCanvas',
    'Your qualitative research workspace. Code transcripts, analyze themes, and collaborate.',
  );
  const [resending, setResending] = useState(false);
  const [bannerDismissed, setBannerDismissed] = useState(false);
  const [showWizard, setShowWizard] = useState(false);
  const [canvasesLoaded, setCanvasesLoaded] = useState(false);

  const showVerificationBanner = authType === 'email' && !emailVerified && !bannerDismissed;

  // Fetch canvases on mount to decide whether to show setup wizard
  useEffect(() => {
    if (authenticated && !canvasesLoaded) {
      fetchCanvases().finally(() => setCanvasesLoaded(true));
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
            effectivePlan: u.effectivePlan,
            trialEndsAt: u.trialEndsAt ?? null,
          });
        }
      })
      .catch(() => {
        /* non-fatal — banner just won't appear on this page load */
      });
  }, [authenticated, authType, setTrialState]);

  // Show setup wizard for first-time users with no canvases.
  // Auto-mark wizard complete for existing users who already have canvases
  // (handles legacy users who never had the flag set).
  useEffect(() => {
    if (!canvasesLoaded) return;
    if (!setupWizardComplete && canvases.length === 0) {
      setShowWizard(true);
    } else if (!setupWizardComplete && canvases.length > 0) {
      completeSetupWizard();
    }
  }, [canvasesLoaded, setupWizardComplete, canvases.length, completeSetupWizard]);

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

  return (
    <div className="h-screen flex flex-col bg-white dark:bg-gray-900">
      <a
        href="#canvas-main"
        className="sr-only focus:not-sr-only focus:absolute focus:z-50 focus:p-2 focus:bg-brand-600 focus:text-white focus:rounded"
      >
        Skip to canvas
      </a>
      {/* Minimal header */}
      <header className="flex-shrink-0 h-12 border-b border-gray-200/80 dark:border-gray-700/80 flex items-center justify-between px-4 bg-white/95 dark:bg-gray-800/95 backdrop-blur-md">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
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
          </div>
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
            className="flex items-center gap-1 px-2 py-1.5 rounded-lg text-xs text-gray-400 hover:text-red-500 dark:text-gray-500 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
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

      {/* Setup wizard for first-time users — replaces canvas until complete */}
      {showWizard ? (
        <SetupWizard
          onComplete={() => {
            setShowWizard(false);
            if (!planWelcomeSeen) setShowPlanWelcome(true);
          }}
        />
      ) : (
        /* Full-screen canvas workspace */
        <main id="canvas-main" className="flex-1 overflow-hidden" aria-label="Canvas workspace">
          <CodingCanvas />
          {onboardingV2Enabled && onboardingV2Complete && <OnboardingChecklist />}
        </main>
      )}

      {/* Sprint F onboarding v2 — gated by feature flag, fires once per user */}
      {onboardingV2Enabled && !onboardingV2Complete && canvasesLoaded && canvases.length === 0 && !showWizard && (
        <OnboardingFlow onClose={completeOnboardingV2} />
      )}
    </div>
  );
}
