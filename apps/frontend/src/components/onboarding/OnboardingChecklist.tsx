import { useEffect, useMemo, useState } from 'react';
import { useCanvasStore } from '../../stores/canvasStore';
import { useUIStore } from '../../stores/uiStore';
import { useMobile } from '../../hooks/useMobile';

/**
 * Asana-style persistent checklist. Reads canvas content reactively so each
 * row updates as the user actually does the thing — we don't carry a parallel
 * piece of state that could drift.
 *
 * Collapsed-by-default after first action so it doesn't crowd the canvas.
 *
 * Hidden entirely on mobile (live QA finding #9): the 288px floating card
 * fixed bottom-right covers most of a phone-width canvas and competes with
 * the canvas controls. Mobile is a review/navigation surface — the
 * activation checklist belongs on tablet/desktop where there's room.
 */
export default function OnboardingChecklist() {
  const isMobile = useMobile();
  // null = "no explicit choice yet" → default open only while nothing is done;
  // once the user has completed a step the card starts collapsed so it stops
  // crowding the canvas (this was always the stated intent).
  const [collapsed, setCollapsed] = useState<boolean | null>(null);
  const [dismissed, setDismissed] = useState(false);
  const activeCanvas = useCanvasStore((s) => s.activeCanvas);
  const onboardingChecklistDismissed = useUIStore((s) => s.onboardingChecklistDismissed);
  const dismissOnboardingChecklist = useUIStore((s) => s.dismissOnboardingChecklist);
  // Account-scoped, server-backed (onboardingState.checklistComplete). This
  // used to read a browser-wide `qualcanvas-first-export` localStorage bit, so
  // a brand-new account on a machine where anyone had ever exported opened
  // with the row already ticked and the whole card collapsed.
  const checklistComplete = useUIStore((s) => s.onboardingChecklistComplete);

  useEffect(() => {
    if (onboardingChecklistDismissed) setDismissed(true);
  }, [onboardingChecklistDismissed]);

  const tasks = useMemo(() => {
    const transcripts = activeCanvas?.transcripts ?? [];
    const codings = activeCanvas?.codings ?? [];
    const questions = activeCanvas?.questions ?? [];
    const computedNodes = activeCanvas?.computedNodes ?? [];
    return [
      {
        id: 'first-transcript',
        label: 'Add your first transcript',
        done: transcripts.length > 0,
        action: () => window.dispatchEvent(new CustomEvent('qualcanvas:open-transcript-picker')),
      },
      {
        id: 'first-coded-excerpt',
        label: 'Code your first excerpt',
        done: codings.length > 0,
        action: null,
      },
      {
        id: 'create-theme',
        label: 'Create at least 2 codes',
        done: questions.length >= 2,
        action: null,
      },
      {
        id: 'run-analysis',
        label: 'Run an analysis (word cloud, frequency, ...)',
        done: computedNodes.length > 0,
        action: null,
      },
      {
        id: 'export-csv',
        label: 'Export your codings to CSV',
        done: checklistComplete.includes('export-csv'),
        action: null,
      },
    ];
  }, [activeCanvas, checklistComplete]);

  const completedCount = tasks.filter((t) => t.done).length;
  const allDone = completedCount === tasks.length;
  const isCollapsed = collapsed ?? completedCount > 0;

  // Auto-hide once everything is done; user has finished the activation arc.
  // Also hidden on mobile so it doesn't crowd the phone-width canvas (#9).
  // And hidden with no canvas open (e.g. the canvas list): every task is
  // canvas-scoped, so without an activeCanvas it reads a misleading "0 of 5"
  // and none of the rows are actionable. It reappears inside a canvas.
  if (dismissed || allDone || isMobile || !activeCanvas) return null;

  return (
    // bottom-12 keeps the card clear of the canvas status bar — at bottom-4 it
    // sat on top of Help / notifications / zoom and swallowed their clicks
    // (round-5 audit; exactly the controls a first-time user needs).
    <div className="fixed bottom-12 right-4 z-40 w-72 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 shadow-lg">
      <div className="flex items-stretch">
        <button
          type="button"
          onClick={() => setCollapsed(!isCollapsed)}
          className="flex flex-1 items-center justify-between px-4 py-3 text-left"
          aria-expanded={!isCollapsed}
          aria-controls="onboarding-checklist-tasks"
        >
          <div>
            <div className="text-xs font-semibold text-gray-900 dark:text-white">Get started</div>
            <div className="text-[10px] text-gray-500 dark:text-gray-400">
              {completedCount} of {tasks.length} complete
            </div>
          </div>
          <svg
            className={`h-4 w-4 text-gray-500 transition-transform ${isCollapsed ? '' : 'rotate-180'}`}
            fill="none"
            viewBox="0 0 24 24"
            strokeWidth={1.5}
            stroke="currentColor"
            aria-hidden="true"
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="m19.5 8.25-7.5 7.5-7.5-7.5" />
          </svg>
        </button>
        <button
          type="button"
          onClick={() => {
            dismissOnboardingChecklist();
            setDismissed(true);
          }}
          className="px-3 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
          title="Dismiss checklist"
          aria-label="Dismiss checklist"
        >
          <svg
            className="h-4 w-4"
            fill="none"
            viewBox="0 0 24 24"
            strokeWidth="1.5"
            stroke="currentColor"
            aria-hidden="true"
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      {!isCollapsed && (
        <ul
          id="onboarding-checklist-tasks"
          className="border-t border-gray-100 dark:border-gray-700 divide-y divide-gray-100 dark:divide-gray-700"
        >
          {tasks.map((task) => (
            <li key={task.id} className="px-4 py-2">
              {task.action ? (
                <button
                  type="button"
                  onClick={task.action}
                  className="flex items-center gap-2 text-left w-full hover:text-brand-600 dark:hover:text-brand-300"
                >
                  <ChecklistDot done={task.done} />
                  <span
                    className={`text-xs ${task.done ? 'text-gray-500 line-through dark:text-gray-400' : 'text-gray-700 dark:text-gray-200'}`}
                  >
                    {task.label}
                  </span>
                </button>
              ) : (
                <div className="flex items-center gap-2">
                  <ChecklistDot done={task.done} />
                  <span
                    className={`text-xs ${task.done ? 'text-gray-500 line-through dark:text-gray-400' : 'text-gray-700 dark:text-gray-200'}`}
                  >
                    {task.label}
                  </span>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function ChecklistDot({ done }: { done: boolean }) {
  if (done) {
    return (
      <svg
        className="h-4 w-4 shrink-0 text-emerald-500"
        fill="none"
        viewBox="0 0 24 24"
        strokeWidth={2}
        stroke="currentColor"
      >
        <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
      </svg>
    );
  }
  return <span className="h-3 w-3 shrink-0 rounded-full border-2 border-gray-300 dark:border-gray-600" />;
}
