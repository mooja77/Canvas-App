import { useEffect, useState } from 'react';
import { useUIStore, type FeatureDiscovery } from '../stores/uiStore';

// Small, auto-dismissing popover that teaches one feature on first encounter.
// Each feature fires at most once per browser (persisted in uiStore).
//
// Tooltips queue: only ONE is visible at a time. Without this, a brand-new
// user's first canvas showed several at once (e.g. the Tools and Export tips,
// on adjacent toolbar buttons) physically overlapping into an unreadable
// stack. Each instance requests a module-level lock; the next in line shows
// when the current one is dismissed.
let tooltipLockHeld = false;
const tooltipWaiters: Array<() => void> = [];

function acquireTooltipLock(onAcquired: () => void): () => void {
  let granted = false;
  const tryGrant = () => {
    granted = true;
    tooltipLockHeld = true;
    onAcquired();
  };
  if (!tooltipLockHeld) tryGrant();
  else tooltipWaiters.push(tryGrant);
  // Release: pass the lock to the next waiter (or free it). Idempotent — it
  // can be called from both dismiss() and the effect cleanup. Also handles
  // cancellation while still queued.
  let released = false;
  return () => {
    if (released) return;
    released = true;
    if (!granted) {
      const i = tooltipWaiters.indexOf(tryGrant);
      if (i >= 0) tooltipWaiters.splice(i, 1);
      return;
    }
    const next = tooltipWaiters.shift();
    if (next) next();
    else tooltipLockHeld = false;
  };
}
interface Props {
  feature: keyof FeatureDiscovery;
  title: string;
  body: string;
  // Render target — typically a toolbar button. The tooltip positions itself
  // below the wrapped child. If children is omitted, the tooltip renders as
  // a standalone banner near the top-right of the viewport.
  children?: React.ReactNode;
  // Hide until parent says it's time. Use for tooltips whose trigger isn't
  // visible yet (e.g. menu has to be opened first).
  enabled?: boolean;
  autoDismissMs?: number;
}

export default function FeatureTooltip({
  feature,
  title,
  body,
  children,
  enabled = true,
  autoDismissMs = 8000,
}: Props) {
  const disabledForE2e = import.meta.env.VITE_E2E;
  const seen = useUIStore((s) => s.featureDiscovery[feature]);
  const markSeen = useUIStore((s) => s.markFeatureSeen);
  const [visible, setVisible] = useState(false);

  const [release, setRelease] = useState<(() => void) | null>(null);

  useEffect(() => {
    if (disabledForE2e || !enabled || seen) return;
    let releaseLock: (() => void) | null = null;
    // Slight delay so the trigger element is laid out, then wait our turn —
    // only one feature tip shows at a time (see queue above).
    const show = window.setTimeout(() => {
      releaseLock = acquireTooltipLock(() => {
        setVisible(true);
        setRelease(() => releaseLock);
      });
    }, 300);
    return () => {
      window.clearTimeout(show);
      releaseLock?.();
    };
  }, [disabledForE2e, enabled, seen]);

  useEffect(() => {
    if (!visible || autoDismissMs <= 0) return;
    const t = window.setTimeout(() => dismiss(), autoDismissMs);
    return () => window.clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, autoDismissMs]);

  const dismiss = () => {
    setVisible(false);
    markSeen(feature);
    release?.();
    setRelease(null);
  };

  if (disabledForE2e) {
    return children ? <>{children}</> : null;
  }

  if (children) {
    return (
      <span className="relative inline-flex">
        {children}
        {visible && !seen && (
          <span
            role="tooltip"
            className="absolute left-1/2 top-full z-50 mt-2 w-64 -translate-x-1/2 rounded-lg bg-gray-900 px-3 py-2 text-[11px] text-white shadow-xl ring-1 ring-black/20 dark:bg-gray-100 dark:text-gray-900 dark:ring-white/10"
          >
            <span className="pointer-events-none absolute -top-1 left-1/2 h-2 w-2 -translate-x-1/2 rotate-45 bg-gray-900 dark:bg-gray-100" />
            <button
              onClick={dismiss}
              className="absolute right-1 top-1 rounded p-0.5 text-gray-400 hover:bg-white/10 hover:text-white dark:hover:bg-black/10 dark:hover:text-gray-900"
              title="Dismiss"
              aria-label="Dismiss tip"
            >
              <svg className="h-2.5 w-2.5" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
              </svg>
            </button>
            <div className="pr-4 font-semibold">{title}</div>
            <div className="pr-4 text-[10px] opacity-90">{body}</div>
          </span>
        )}
      </span>
    );
  }

  if (!visible || seen) return null;
  return (
    <div
      role="status"
      className="fixed right-4 top-16 z-50 w-72 rounded-xl border border-gray-200 bg-white p-3 shadow-2xl dark:border-gray-700 dark:bg-gray-800"
    >
      <div className="flex items-start justify-between gap-2">
        <div>
          <div className="text-sm font-semibold text-gray-900 dark:text-gray-100">{title}</div>
          <div className="mt-1 text-xs text-gray-600 dark:text-gray-400">{body}</div>
        </div>
        <button
          onClick={dismiss}
          className="shrink-0 rounded p-1 text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700"
          title="Dismiss"
          aria-label="Dismiss tip"
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
          </svg>
        </button>
      </div>
    </div>
  );
}
