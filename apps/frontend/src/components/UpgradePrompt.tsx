import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';

interface PlanLimitDetail {
  error: string;
  code: string;
  limit: string;
  current: number;
  max: number;
  upgrade: boolean;
}

export default function UpgradePrompt() {
  const [show, setShow] = useState(false);
  const [detail, setDetail] = useState<PlanLimitDetail | null>(null);
  const navigate = useNavigate();
  const modalRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: CustomEvent<PlanLimitDetail>) => {
      // Frequency cap: skip if shown in last 5 minutes
      const lastShown = sessionStorage.getItem('upgrade-prompt-last-shown');
      if (lastShown && Date.now() - parseInt(lastShown) < 5 * 60 * 1000) return;
      sessionStorage.setItem('upgrade-prompt-last-shown', Date.now().toString());
      setDetail(e.detail);
      setShow(true);
    };
    window.addEventListener('plan-limit-exceeded', handler as EventListener);
    return () => window.removeEventListener('plan-limit-exceeded', handler as EventListener);
  }, []);

  useEffect(() => {
    if (!show) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setShow(false);
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [show]);

  useEffect(() => {
    if (!show) return;
    const modal = modalRef.current;
    if (!modal) return;

    const focusableEls = modal.querySelectorAll<HTMLElement>(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    );
    if (focusableEls.length === 0) return;

    const firstEl = focusableEls[0];
    const lastEl = focusableEls[focusableEls.length - 1];

    // Focus first focusable element
    firstEl.focus();

    const handleTab = (e: KeyboardEvent) => {
      if (e.key !== 'Tab') return;
      if (e.shiftKey) {
        if (document.activeElement === firstEl) {
          e.preventDefault();
          lastEl.focus();
        }
      } else {
        if (document.activeElement === lastEl) {
          e.preventDefault();
          firstEl.focus();
        }
      }
    };

    document.addEventListener('keydown', handleTab);
    return () => document.removeEventListener('keydown', handleTab);
  }, [show]);

  if (!show || !detail) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm" role="alertdialog" aria-modal="true">
      <div ref={modalRef} className="relative bg-white dark:bg-gray-800 rounded-2xl shadow-2xl max-w-md w-full mx-4 p-6">
        <button
          onClick={() => setShow(false)}
          className="absolute top-3 right-3 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
          aria-label="Close"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
        <div className="text-center">
          <div className="inline-flex items-center justify-center w-12 h-12 bg-amber-100 dark:bg-amber-900/30 rounded-full mb-4">
            <svg className="w-6 h-6 text-amber-600 dark:text-amber-400" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z" />
            </svg>
          </div>
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
            Plan Limit Reached
          </h3>
          <p className="text-gray-600 dark:text-gray-300 mb-6">
            {detail.error}
          </p>
          <div className="bg-brand-50 dark:bg-brand-900/20 rounded-lg p-4 mb-6 text-left">
            <p className="text-sm font-medium text-brand-800 dark:text-brand-200 mb-2">
              Upgrade to Pro for $12/mo:
            </p>
            <ul className="text-sm text-brand-700 dark:text-brand-300 space-y-1">
              <li>Unlimited canvases & transcripts</li>
              <li>All 12 analysis tools</li>
              <li>Auto-code, ethics panel, cases</li>
              <li>CSV, PNG, HTML, Markdown exports</li>
            </ul>
            <p className="text-xs text-brand-600 dark:text-brand-400 mt-2">
              40% off with .edu email
            </p>
          </div>
          <div className="flex gap-3">
            <button
              onClick={() => setShow(false)}
              className="flex-1 py-2.5 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 text-sm font-medium transition-colors"
            >
              Maybe Later
            </button>
            <button
              onClick={() => {
                setShow(false);
                navigate('/pricing');
              }}
              className="flex-1 py-2.5 bg-brand-600 hover:bg-brand-700 text-white rounded-lg text-sm font-medium transition-colors"
            >
              View Plans
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
