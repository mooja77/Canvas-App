import React from 'react';
import ReactDOM from 'react-dom/client';
import * as Sentry from '@sentry/react';
import App from './App';
import toast, { Toaster } from 'react-hot-toast';
import { registerSW } from 'virtual:pwa-register';
import { useUIStore } from './stores/uiStore';
import { useFeatureFlagsStore, applyUrlFlagOverrides } from './stores/featureFlagsStore';
import { trackEvent } from './utils/analytics';
import './i18n';
import './index.css';
import './brand-v2.css';

// Initialize Sentry error tracking in production
if (import.meta.env.PROD && import.meta.env.VITE_SENTRY_DSN) {
  Sentry.init({
    dsn: import.meta.env.VITE_SENTRY_DSN,
    sendDefaultPii: false,
  });
}

// Initialize dark mode from persisted state
const darkMode = useUIStore.getState().darkMode;
if (darkMode) {
  document.documentElement.classList.add('dark');
}

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
  onNeedRefresh() {
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
