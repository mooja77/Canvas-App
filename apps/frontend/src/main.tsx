import React from 'react';
import ReactDOM from 'react-dom/client';
import * as Sentry from '@sentry/react';
import App from './App';
import toast, { Toaster } from 'react-hot-toast';
import { registerSW } from 'virtual:pwa-register';
import { useUIStore } from './stores/uiStore';
import { useThemePreferenceStore, type ThemePreference } from './stores/themePreferenceStore';
import { useFeatureFlagsStore, applyUrlFlagOverrides } from './stores/featureFlagsStore';
import { trackEvent } from './utils/analytics';
import './i18n';
import './index.css';
import './brand-v2.css';

// Initialize Sentry error tracking in production.
// NOTE: Session Replay is intentionally NOT enabled. This app renders
// participant transcript content, which can be special-category data under
// GDPR; recording DOM sessions (even masked) is a consent decision we don't
// make by default. Revisit behind explicit opt-in. We capture errors +
// lightweight performance traces only, and never default PII.
if (import.meta.env.PROD && import.meta.env.VITE_SENTRY_DSN) {
  Sentry.init({
    dsn: import.meta.env.VITE_SENTRY_DSN,
    environment: 'production',
    // Tag every event with the deployed commit so errors map to a release
    // (passed from CI as github.sha). Falls back to undefined if unset.
    release: import.meta.env.VITE_GIT_SHA || undefined,
    sendDefaultPii: false,
    integrations: [Sentry.browserTracingIntegration()],
    // Sample performance traces lightly; all errors are still captured.
    tracesSampleRate: 0.1,
    // Filter out well-known benign browser noise so the issue stream stays
    // signal-rich (these are not actionable application errors).
    ignoreErrors: [
      'ResizeObserver loop limit exceeded',
      'ResizeObserver loop completed with undelivered notifications.',
      'Non-Error promise rejection captured',
    ],
  });
}

// Keep the legacy canvas theme state and the newer three-state marketing
// preference in sync. Both previously controlled the same <html>.dark class
// independently, so lazy-loading a public page could reset a canvas user's
// explicit dark-mode choice back to the OS default.
const resolveThemePreference = (preference: ThemePreference) =>
  preference === 'dark' ||
  (preference === 'system' && window.matchMedia?.('(prefers-color-scheme: dark)').matches === true);

let syncingThemeStores = false;
const syncThemePreferenceToUI = (preference: ThemePreference) => {
  const shouldBeDark = resolveThemePreference(preference);
  document.documentElement.classList.toggle('dark', shouldBeDark);
  if (useUIStore.getState().darkMode !== shouldBeDark) {
    syncingThemeStores = true;
    useUIStore.setState({ darkMode: shouldBeDark });
    syncingThemeStores = false;
  }
};

// Preserve explicit dark mode selected before the marketing preference store
// existed. Once the newer key exists, its system/light/dark choice is the
// source of truth and is mirrored into the canvas store.
if (!localStorage.getItem('qualcanvas-theme-preference') && useUIStore.getState().darkMode) {
  useThemePreferenceStore.getState().setPreference('dark');
} else {
  syncThemePreferenceToUI(useThemePreferenceStore.getState().preference);
}

useThemePreferenceStore.subscribe((state, previous) => {
  if (state.preference !== previous.preference) {
    syncThemePreferenceToUI(state.preference);
  }
});

useUIStore.subscribe((state, previous) => {
  if (syncingThemeStores || state.darkMode === previous.darkMode) return;
  const preference = useThemePreferenceStore.getState().preference;
  if (resolveThemePreference(preference) !== state.darkMode) {
    useThemePreferenceStore.getState().setPreference(state.darkMode ? 'dark' : 'light');
  }
});

window.matchMedia?.('(prefers-color-scheme: dark)').addEventListener('change', () => {
  const preference = useThemePreferenceStore.getState().preference;
  if (preference === 'system') syncThemePreferenceToUI(preference);
});

// Apply ?flags=... overrides before reading flag state for brand v2 paint.
applyUrlFlagOverrides();
const flagState = useFeatureFlagsStore.getState();
if (flagState.isEnabled('ink_ochre_palette')) {
  document.documentElement.classList.add('brand-v2');
}
if (flagState.isEnabled('fraunces_display')) {
  document.documentElement.classList.add('brand-v2-display');
}
// Stay reactive — flipping flags via devtools updates the page live.
useFeatureFlagsStore.subscribe((s) => {
  document.documentElement.classList.toggle('brand-v2', s.isEnabled('ink_ochre_palette'));
  document.documentElement.classList.toggle('brand-v2-display', s.isEnabled('fraunces_display'));
});

// Reliability fix #10 — surface SW updates with an actionable toast instead
// of letting the next nav silently activate a possibly-incompatible bundle.
// The toast persists (duration: Infinity) until the user clicks Reload.
const updateSW = registerSW({
  onRegisteredSW(_swScriptUrl, registration) {
    if (!registration) return;
    // registerSW only probes for a new service worker on the initial page
    // load. Researchers keep the canvas tab open for hours, so without an
    // explicit poll they never see the "New version" toast after a deploy —
    // which is how the finding #1 fix initially looked "not deployed".
    // Poll every 30 min, and whenever the tab regains focus (throttled to the
    // same interval so rapid tab-switching doesn't spam update requests).
    const UPDATE_INTERVAL_MS = 30 * 60 * 1000;
    let lastCheck = Date.now();
    const checkForUpdate = () => {
      lastCheck = Date.now();
      // Swallow rejections — update() fails offline / on a network blip, and
      // an unhandled rejection would just be Sentry noise. The next tick or
      // refocus retries anyway.
      registration.update().catch(() => {});
    };
    setInterval(() => {
      if (document.visibilityState === 'visible') checkForUpdate();
    }, UPDATE_INTERVAL_MS);
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible' && Date.now() - lastCheck > UPDATE_INTERVAL_MS) {
        checkForUpdate();
      }
    });
  },
  onNeedRefresh() {
    // Surface the update at most once per tab session. In 'prompt' mode the new
    // worker sits "waiting" and a manual reload (F5) does NOT activate it, so
    // registerSW re-fires onNeedRefresh on every page load while it waits —
    // which made this toast pop on every load ("always says new version
    // available"). The waiting worker still activates on its own once all tabs
    // close, so users who ignore the toast pick up the update next session;
    // clicking Reload applies it immediately. We intentionally do NOT auto-
    // activate mid-session (would risk chunk-load errors against the running
    // page) — see the registerType:'prompt' rationale in vite.config.ts.
    try {
      if (sessionStorage.getItem('qc-sw-update-prompted') === '1') return;
      sessionStorage.setItem('qc-sw-update-prompted', '1');
    } catch {
      // sessionStorage can throw (private mode / blocked storage) — show once.
    }
    trackEvent('service_worker_update_available');
    toast(
      (t) =>
        React.createElement(
          'div',
          { className: 'flex items-center gap-3' },
          React.createElement(
            'div',
            null,
            React.createElement('div', { className: 'text-sm font-medium' }, 'New version available'),
            React.createElement(
              'div',
              { className: 'text-xs text-gray-500 dark:text-gray-400' },
              'Reload to get the latest features and fixes.',
            ),
          ),
          React.createElement(
            'button',
            {
              onClick: () => {
                toast.dismiss(t.id);
                void updateSW(true);
              },
              className: 'rounded-md bg-brand-600 px-3 py-1 text-xs font-medium text-white hover:bg-brand-700',
            },
            'Reload',
          ),
          React.createElement(
            'button',
            {
              onClick: () => toast.dismiss(t.id),
              className:
                'rounded-md px-2 py-1 text-xs font-medium text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200',
            },
            'Later',
          ),
        ),
      { duration: Infinity, id: 'sw-update' },
    );
  },
});

// Remove the prerendered marketing block + its inline styles so React owns
// the page from here on. The block only exists for first-paint visibility
// and SEO/AI-search crawlers — see index.html #marketing-root.
document.getElementById('marketing-root')?.remove();
document.getElementById('prerender-styles')?.remove();

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
    <Toaster
      position="top-right"
      toastOptions={{
        className: 'dark:bg-gray-800 dark:text-white',
        style: { borderRadius: '10px', padding: '12px 16px' },
      }}
    />
  </React.StrictMode>,
);
