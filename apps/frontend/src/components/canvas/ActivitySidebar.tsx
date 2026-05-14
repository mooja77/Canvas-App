import { lazy, Suspense } from 'react';
import type { ActivityId } from './ActivityBar';

/**
 * Sprint G — Sidebar that swaps content based on the active activity.
 *
 * 240-px wide. Each panel is lazy-loaded so the activity-bar shell stays
 * cheap even when most users only open one or two activities per session.
 * Panels intentionally use simple, reactive views over canvas store rather
 * than wrapping existing modals — the modals are still reachable via
 * Cmd+K + toolbar, this surface is for hands-on exploration.
 */
const CanvasesPanel = lazy(() => import('./activity-panels/CanvasesPanel'));
const CodebookPanel = lazy(() => import('./activity-panels/CodebookPanel'));
const QualityPanel = lazy(() => import('./activity-panels/QualityPanel'));

interface Props {
  activity: ActivityId | null;
  onClose: () => void;
}

export default function ActivitySidebar({ activity, onClose }: Props) {
  if (!activity) return null;

  return (
    <aside
      data-testid="activity-sidebar"
      className="flex-shrink-0 w-60 flex flex-col border-r border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900"
    >
      <header className="flex items-center justify-between px-3 py-2 border-b border-gray-200 dark:border-gray-700 sticky top-0 bg-white dark:bg-gray-900">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-gray-600 dark:text-gray-300">
          {LABELS[activity]}
        </h2>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close sidebar"
          className="rounded p-1 text-gray-400 hover:text-gray-700 dark:hover:text-gray-200"
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
          </svg>
        </button>
      </header>

      <div className="flex-1 overflow-y-auto">
        <Suspense fallback={<PanelSkeleton />}>
          {activity === 'canvases' && <CanvasesPanel />}
          {activity === 'codebook' && <CodebookPanel />}
          {activity === 'quality' && <QualityPanel />}
          {(activity === 'cases' ||
            activity === 'analyze' ||
            activity === 'ai' ||
            activity === 'collaborate' ||
            activity === 'schedule') && <ComingSoon activity={activity} />}
        </Suspense>
      </div>
    </aside>
  );
}

const LABELS: Record<ActivityId, string> = {
  canvases: 'Canvases',
  codebook: 'Codebook',
  cases: 'Cases',
  analyze: 'Analyze',
  ai: 'AI',
  collaborate: 'Collaborate',
  quality: 'Quality',
  schedule: 'Schedule',
};

function PanelSkeleton() {
  return (
    <div className="p-3 space-y-2" aria-label="Loading panel">
      <div className="h-3 w-3/4 rounded bg-gray-100 dark:bg-gray-800 animate-pulse" />
      <div className="h-3 w-1/2 rounded bg-gray-100 dark:bg-gray-800 animate-pulse" />
      <div className="h-3 w-2/3 rounded bg-gray-100 dark:bg-gray-800 animate-pulse" />
    </div>
  );
}

function ComingSoon({ activity }: { activity: ActivityId }) {
  return (
    <div className="p-4 text-xs text-gray-500 dark:text-gray-400">
      <p className="font-medium text-gray-700 dark:text-gray-200 mb-1">{LABELS[activity]} panel</p>
      <p>
        This panel is part of the activity-bar v2 IA rollout. The same actions are already reachable via the existing
        toolbar dropdowns and the Cmd+K command palette while we finish migrating each surface.
      </p>
    </div>
  );
}
