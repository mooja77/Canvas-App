import { useMemo, useState } from 'react';
import { useCanvasStore } from '../../stores/canvasStore';
import { useUIStore } from '../../stores/uiStore';
import { useMobile } from '../../hooks/useMobile';
import { patchOnboardingState } from './utils/onboardingState';
import toast from 'react-hot-toast';

/**
 * Asana-style persistent checklist. Reads canvas content reactively so each
 * row updates as the user actually does the thing — we don't carry a parallel
 * piece of state that could drift.
 *
 * Open through the first-value path, collapsed by default afterwards so it
 * does not crowd the canvas.
 *
 * On a phone this sits in the page flow above the canvas, so the first-value
 * deep links remain reachable without a floating card covering the controls.
 */
export default function OnboardingChecklist() {
  const isMobile = useMobile();
  // null = "no explicit choice yet" → default open only while nothing is done;
  // once the user has completed a step the card starts collapsed so it stops
  // crowding the canvas (this was always the stated intent).
  const [collapsed, setCollapsed] = useState<boolean | null>(null);
  const activeCanvas = useCanvasStore((s) => s.activeCanvas);
  const onboardingChecklistDismissed = useUIStore((s) => s.onboardingChecklistDismissed);
  const dismissOnboardingChecklist = useUIStore((s) => s.dismissOnboardingChecklist);
  // Account-scoped, server-backed (onboardingState.checklistComplete). This
  // used to read a browser-wide `qualcanvas-first-export` localStorage bit, so
  // a brand-new account on a machine where anyone had ever exported opened
  // with the row already ticked and the whole card collapsed.
  const checklistComplete = useUIStore((s) => s.onboardingChecklistComplete);

  const tasks = useMemo(() => {
    const transcripts = activeCanvas?.transcripts ?? [];
    const codings = activeCanvas?.codings ?? [];
    const computedNodes = activeCanvas?.computedNodes ?? [];
    // Starter templates seed transcripts, codes and coded excerpts marked
    // 'sample'. The guide is about the researcher's own first steps, so seeded
    // material never ticks a step: otherwise a template canvas would open with
    // steps already done that the researcher never took.
    const ownTranscripts = transcripts.filter((t) => t.sourceType !== 'sample');
    const ownTranscriptIds = new Set(ownTranscripts.map((t) => t.id));
    const ownCodings = codings.filter((c) => c.source !== 'sample' && ownTranscriptIds.has(c.transcriptId));
    const codesUsed = new Set(ownCodings.map((c) => c.questionId)).size;
    const openTranscriptPicker = () => window.dispatchEvent(new CustomEvent('qualcanvas:open-transcript-picker'));
    // Coding happens in a transcript: centre the researcher's own transcript
    // (or open the picker when there is none yet) and say what to do there.
    const goCode = () => {
      const target = ownTranscripts[0];
      if (!target) return openTranscriptPicker();
      window.dispatchEvent(new CustomEvent('qualcanvas:focus-node', { detail: { nodeId: `transcript-${target.id}` } }));
      toast('Highlight a sentence in your transcript, type a code name and press Enter.', { duration: 6000 });
    };
    return [
      {
        id: 'first-transcript',
        label: 'Add your first transcript',
        done: ownTranscripts.length > 0,
        action: openTranscriptPicker,
      },
      {
        id: 'first-coded-excerpt',
        label: 'Code your first excerpt',
        done: ownCodings.length > 0,
        action: goCode,
      },
      {
        id: 'create-theme',
        label: 'Use 2 different codes',
        done: codesUsed >= 2,
        action: goCode,
      },
      {
        id: 'run-analysis',
        label: 'Run an analysis (word cloud, frequency, ...)',
        // Creating a node only chooses an analysis; its initial result is {}.
        // A successful server run returns a populated result object, including
        // named empty collections when the analysis legitimately found nothing.
        done: computedNodes.some((node) => Object.keys(node.result ?? {}).length > 0),
        action: () => window.dispatchEvent(new CustomEvent('qualcanvas:open-analyze-menu')),
      },
      {
        id: 'export-csv',
        label: 'Export your codings to CSV',
        done: checklistComplete.includes('export-csv'),
        action: () =>
          window.dispatchEvent(new CustomEvent('qualcanvas:open-canvas-modal', { detail: { modal: 'coded-data' } })),
      },
    ];
  }, [activeCanvas, checklistComplete]);

  const completedCount = tasks.filter((t) => t.done).length;
  const allDone = completedCount === tasks.length;
  // Stay open through the first-value path (own transcript -> first coded
  // excerpt), where the deep links matter most; afterwards start collapsed so
  // the guide stops crowding the canvas.
  const isCollapsed = collapsed ?? completedCount >= 2;

  // Auto-hide once everything is done; user has finished the activation arc.
  // Hidden with no canvas open (e.g. the canvas list): every task is
  // canvas-scoped, so without an activeCanvas it reads a misleading "0 of 5"
  // and none of the rows are actionable. It reappears inside a canvas.
  if (onboardingChecklistDismissed || allDone || !activeCanvas) return null;

  return (
    // bottom-12 keeps the card clear of the canvas status bar — at bottom-4 it
    // sat on top of Help / notifications / zoom and swallowed their clicks
    // (round-5 audit; exactly the controls a first-time user needs).
    <div
      className={`${isMobile ? 'relative mx-3 my-2 w-auto shrink-0' : 'fixed bottom-12 right-4 z-40 w-72'} rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 shadow-lg`}
    >
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
            <div
              role="status"
              aria-live="polite"
              aria-atomic="true"
              className="text-[10px] text-gray-500 dark:text-gray-400"
            >
              {completedCount} of {tasks.length} complete
            </div>
            <div
              role="progressbar"
              aria-label="Setup progress"
              aria-valuemin={0}
              aria-valuemax={tasks.length}
              aria-valuenow={completedCount}
              className="mt-1.5 h-1.5 w-40 overflow-hidden rounded-full bg-gray-100 dark:bg-gray-700"
            >
              <div
                className="h-full rounded-full bg-emerald-500 transition-all"
                style={{ width: `${Math.round((completedCount / tasks.length) * 100)}%` }}
              />
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
            void patchOnboardingState({ checklistDismissed: true });
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
              {!task.done ? (
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
