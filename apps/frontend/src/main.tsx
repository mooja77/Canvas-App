import React from 'react';
import ReactDOM from 'react-dom/client';
import * as Sentry from '@sentry/react';
import App from './App';
import { Toaster } from 'react-hot-toast';
import { useUIStore } from './stores/uiStore';
import './i18n';
import './index.css';

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

// Remove the prerendered marketing block + its inline styles so React owns
// the page from here on. The block only exists for first-paint visibility
// and SEO/AI-search crawlers — see index.html #marketing-root.
document.getElementById('marketing-root')?.remove();
document.getElementById('prerender-styles')?.remove();

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
    <Toaster
      position="bottom-right"
      toastOptions={{
        className: 'dark:bg-gray-800 dark:text-white',
        style: { borderRadius: '10px', padding: '12px 16px' },
      }}
    />
  </React.StrictMode>,
);
