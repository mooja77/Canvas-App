import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useCanvasStore } from '../../stores/canvasStore';
import { useAuthStore } from '../../stores/authStore';
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
  const navigate = useNavigate();
  const isMobile = useMobile();
  const [collapsed, setCollapsed] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const activeCanvas = useCanvasStore((s) => s.activeCanvas);
  const plan = useAuthStore((s) => s.plan);
  const onboardingChecklistDismissed = useUIStore((s) => s.onboardingChecklistDismissed);
  const dismissOnboardingChecklist = useUIStore((s) => s.dismissOnboardingChecklist);

  useEffect(() => {
    if (onboardingChecklistDismissed) setDismissed(true);
  }, [onboardingChecklistDismissed]);

  const tasks = useMemo(() => {
    const codings = activeCanvas?.codings ?? [];
    const questions = activeCanvas?.questions ?? [];
    const computedNodes = activeCanvas?.computedNodes ?? [];
    const isPro = plan === 'pro' || plan === 'team';
    return [
      {
        id: 'first-coded-excerpt',
        label: 'Code your first excerpt',
        done: codings.length > 0,
        action: null,
      },
      {
        id: 'create-theme',
        label: 'Group 2+ codes into a theme',
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
        done: !!localStorage.getItem('qualcanvas-first-export'),
        action: null,
      },
      isPro
        ? {
            id: 'invite-collaborator',
            label: 'Invite a collaborator',
            done: false,
            action: () => navigate('/account'),
          }
        : {
            id: 'upgrade-sharing',
            label: 'Upgrade for sharing',
            done: false,
            action: () => navigate('/pricing'),
          },
    ];
  }, [activeCanvas, plan, navigate]);

  const completedCount = tasks.filter((t) => t.done).length;
  const allDone = completedCount === tasks.length;

  // Auto-hide once everything is done; user has finished the activation arc.
  // Also hidden on mobile so it doesn't crowd the phone-width canvas (#9).
  if (dismissed || allDone || isMobile) return null;

  return (
    <div className="fixed bottom-4 right-4 z-40 w-72 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 shadow-lg">
      <button
        type="button"
        onClick={() => setCollapsed((v) => !v)}
        className="w-full flex items-center justify-between px-4 py-3 text-left"
      >
        <div>
          <div className="text-xs font-semibold text-gray-900 dark:text-white">Get started</div>
          <div className="text-[10px] text-gray-500 dark:text-gray-400">
            {completedCount} of {tasks.length} complete
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              dismissOnboardingChecklist();
              setDismissed(true);
            }}
            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
            title="Dismiss checklist"
            aria-label="Dismiss checklist"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
            </svg>
          </button>
          <svg
            className={`h-4 w-4 text-gray-400 transition-transform ${collapsed ? '' : 'rotate-180'}`}
            fill="none"
            viewBox="0 0 24 24"
            strokeWidth={1.5}
            stroke="currentColor"
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="m19.5 8.25-7.5 7.5-7.5-7.5" />
          </svg>
        </div>
      </button>

      {!collapsed && (
        <ul className="border-t border-gray-100 dark:border-gray-700 divide-y divide-gray-100 dark:divide-gray-700">
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
                    className={`text-xs ${task.done ? 'text-gray-400 line-through' : 'text-gray-700 dark:text-gray-200'}`}
                  >
                    {task.label}
                  </span>
                </button>
              ) : (
                <div className="flex items-center gap-2">
                  <ChecklistDot done={task.done} />
                  <span
                    className={`text-xs ${task.done ? 'text-gray-400 line-through' : 'text-gray-700 dark:text-gray-200'}`}
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
