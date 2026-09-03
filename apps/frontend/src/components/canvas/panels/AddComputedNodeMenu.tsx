import { useState, useRef } from 'react';
import { useCanvasStore } from '../../../stores/canvasStore';
import { useCanvasPlan } from '../../../hooks/useCanvasPlan';
import type { PlanTier } from '../../../config/planLimits';
import type { ComputedNodeType } from '@qualcanvas/shared';
import toast from 'react-hot-toast';
import { CollisionPopover } from '../primitives/CollisionPopover';

// ─── Plan gating ──────────────────────────────────────────────────────────
//
// The menu used to offer all ten tools to everyone with no lock, no badge and
// no disabled state; six of them 403'd on click and the user got a red "Failed
// to add node" toast next to an upgrade modal that named the wrong plans.
//
// SOURCE OF TRUTH: `allowedAnalysisTypes` in shared/types/plans.ts,
// enforced by `checkAnalysisType`. Mirrored here — the same way
// config/planLimits.ts mirrors the numeric caps — because the lock has to
// render before any round-trip. AddComputedNodeMenu.test.tsx asserts this
// table AND the refusal copy against the backend module, so moving a tool
// between tiers cannot leave a stale lock or a stale sentence behind.

const ALL_ANALYSIS_TYPES = [
  'search',
  'cooccurrence',
  'matrix',
  'stats',
  'comparison',
  'wordcloud',
  'cluster',
  'codingquery',
  'sentiment',
  'treemap',
  'documentportrait',
  'timeline',
  'geomap',
] as const;

export const ANALYSIS_TYPES_BY_PLAN: Record<PlanTier, readonly string[]> = {
  free: ['stats', 'wordcloud', 'sentiment', 'search'],
  student: ALL_ANALYSIS_TYPES,
  pro: ALL_ANALYSIS_TYPES,
  team: ALL_ANALYSIS_TYPES,
};

const PLAN_LABELS: Record<PlanTier, string> = { free: 'Free', student: 'Student', pro: 'Pro', team: 'Team' };
const TIER_ORDER: PlanTier[] = ['free', 'student', 'pro', 'team'];

/** Paid tiers that may create `type`, cheapest first. Free is never listed —
 *  "available on the Free plan" is not a useful thing to tell someone who was
 *  just refused (backend `plansWith` does the same). */
export function plansWithAnalysis(type: string): PlanTier[] {
  return TIER_ORDER.filter((tier) => tier !== 'free' && ANALYSIS_TYPES_BY_PLAN[tier].includes(type));
}

function joinList(names: string[]): string {
  if (names.length === 0) return '';
  if (names.length === 1) return names[0];
  if (names.length === 2) return `${names[0]} and ${names[1]}`;
  return `${names.slice(0, -1).join(', ')}, and ${names[names.length - 1]}`;
}

/** Mirrors backend `featureAvailabilityMessage` so the pre-emptive refusal and
 *  the 403 it replaces read identically. */
export function planAvailabilityMessage(subject: string, tiers: PlanTier[]): string {
  if (tiers.length === 0) return `${subject} is not available on any plan.`;
  return `${subject} is available on the ${joinList(tiers.map((t) => PLAN_LABELS[t]))} plan${
    tiers.length > 1 ? 's' : ''
  }.`;
}

interface NodeOption {
  type: ComputedNodeType;
  label: string;
  description: string;
  color: string;
}

interface NodeCategory {
  title: string;
  icon: JSX.Element;
  nodes: NodeOption[];
}

const NODE_CATEGORIES: NodeCategory[] = [
  {
    title: 'Text Analysis',
    icon: (
      <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z"
        />
      </svg>
    ),
    nodes: [
      { type: 'search', label: 'Text Search', description: 'Find patterns across transcripts', color: '#059669' },
      { type: 'wordcloud', label: 'Word Cloud', description: 'Frequency visualization', color: '#6366F1' },
      { type: 'sentiment', label: 'Sentiment', description: 'Emotional tone analysis', color: '#F59E0B' },
    ],
  },
  {
    title: 'Coding Analysis',
    icon: (
      <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M9.568 3H5.25A2.25 2.25 0 0 0 3 5.25v4.318c0 .597.237 1.17.659 1.591l9.581 9.581c.699.699 1.78.872 2.607.33a18.095 18.095 0 0 0 5.223-5.223c.542-.827.369-1.908-.33-2.607L11.16 3.66A2.25 2.25 0 0 0 9.568 3Z"
        />
        <path strokeLinecap="round" strokeLinejoin="round" d="M6 6h.008v.008H6V6Z" />
      </svg>
    ),
    nodes: [
      { type: 'stats', label: 'Statistics', description: 'Coding frequency charts', color: '#3B82F6' },
      { type: 'cooccurrence', label: 'Co-occurrence', description: 'Find overlapping codings', color: '#7C3AED' },
      { type: 'codingquery', label: 'Coding Query', description: 'Boolean AND/OR/NOT queries', color: '#DC2626' },
      { type: 'cluster', label: 'Clustering', description: 'Group similar segments', color: '#14B8A6' },
    ],
  },
  {
    title: 'Frameworks & Comparison',
    icon: (
      <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M3.75 6A2.25 2.25 0 0 1 6 3.75h2.25A2.25 2.25 0 0 1 10.5 6v2.25a2.25 2.25 0 0 1-2.25 2.25H6a2.25 2.25 0 0 1-2.25-2.25V6ZM3.75 15.75A2.25 2.25 0 0 1 6 13.5h2.25a2.25 2.25 0 0 1 2.25 2.25V18a2.25 2.25 0 0 1-2.25 2.25H6A2.25 2.25 0 0 1 3.75 18v-2.25ZM13.5 6a2.25 2.25 0 0 1 2.25-2.25H18A2.25 2.25 0 0 1 20.25 6v2.25A2.25 2.25 0 0 1 18 10.5h-2.25a2.25 2.25 0 0 1-2.25-2.25V6ZM13.5 15.75a2.25 2.25 0 0 1 2.25-2.25H18a2.25 2.25 0 0 1 2.25 2.25V18A2.25 2.25 0 0 1 18 20.25h-2.25a2.25 2.25 0 0 1-2.25-2.25v-2.25Z"
        />
      </svg>
    ),
    nodes: [
      { type: 'matrix', label: 'Framework Matrix', description: 'Case x Question grid', color: '#D97706' },
      { type: 'comparison', label: 'Comparison', description: 'Compare transcript profiles', color: '#EC4899' },
      { type: 'treemap', label: 'Theme Map', description: 'Visual theme proportions', color: '#8B5CF6' },
    ],
  },
];

// Flat list for backward compat
const _NODE_OPTIONS = NODE_CATEGORIES.flatMap((c) => c.nodes);

export default function AddComputedNodeMenu() {
  const addComputedNode = useCanvasStore((s) => s.addComputedNode);
  // `checkAnalysisType` gates on the canvas OWNER's plan (M6), so the locks
  // follow the open canvas rather than the viewer's own subscription.
  const effectivePlan = useCanvasPlan();
  const allowedTypes = ANALYSIS_TYPES_BY_PLAN[effectivePlan as PlanTier] ?? ANALYSIS_TYPES_BY_PLAN.free;
  const [open, setOpen] = useState(false);
  const anchorRef = useRef<HTMLButtonElement | null>(null);

  const handleAdd = async (type: ComputedNodeType, label: string) => {
    try {
      const node = await addComputedNode(type, label);
      toast.success(`${label} node added`);
      setOpen(false);
      // Pan the camera to the new node — it spawns at a default layout slot
      // that is often outside the current viewport, and a success toast over
      // an unchanged canvas reads as "nothing happened".
      window.dispatchEvent(new CustomEvent('qualcanvas:focus-node', { detail: { nodeId: `computed-${node.id}` } }));
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (err: any) {
      // Never swallow the server's reason again. A plan refusal, a viewer
      // write-guard rejection and a validation error all used to collapse into
      // the same three words.
      toast.error(err?.response?.data?.error || 'Failed to add node');
    }
  };

  /**
   * A tool this plan cannot create. Refuse locally rather than firing a request
   * that will 403: the user gets the correct sentence instead of a red "Failed
   * to add node", and the global upgrade modal still gets its chance via the
   * same event the axios interceptor dispatches for a real 403.
   */
  const handleLocked = (opt: NodeOption) => {
    const message = planAvailabilityMessage(`${opt.label} analysis`, plansWithAnalysis(opt.type));
    setOpen(false);
    toast.error(message);
    window.dispatchEvent(
      new CustomEvent('plan-limit-exceeded', {
        detail: {
          error: message,
          code: 'PLAN_LIMIT_EXCEEDED',
          limit: 'allowedAnalysisTypes',
          current: 0,
          max: 0,
          upgrade: true,
        },
      }),
    );
  };

  return (
    <div data-tour="canvas-btn-query" className="relative">
      <button
        ref={anchorRef}
        onClick={() => setOpen((prev) => !prev)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label="Analyze menu"
        className="flex items-center gap-1.5 rounded-lg bg-indigo-50 px-3 py-2 text-xs font-medium text-indigo-700 hover:bg-indigo-100 dark:bg-indigo-900/30 dark:text-indigo-300 dark:hover:bg-indigo-900/50 transition-colors"
        title="Add an analysis view to your canvas"
      >
        <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M3.75 3v11.25A2.25 2.25 0 0 0 6 16.5h2.25M3.75 3h-1.5m1.5 0h16.5m0 0h1.5m-1.5 0v11.25A2.25 2.25 0 0 1 18 16.5h-2.25m-7.5 0h7.5m-7.5 0-1 3m8.5-3 1 3m0 0 .5 1.5m-.5-1.5h-9.5m0 0-.5 1.5"
          />
        </svg>
        Analyze
        <svg
          className={`h-3 w-3 transition-transform ${open ? 'rotate-180' : ''}`}
          fill="none"
          viewBox="0 0 24 24"
          strokeWidth={2}
          stroke="currentColor"
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="m19.5 8.25-7.5 7.5-7.5-7.5" />
        </svg>
      </button>

      <CollisionPopover open={open} onClose={() => setOpen(false)} anchorRef={anchorRef} width={288}>
        <div className="p-1.5">
          {NODE_CATEGORIES.map((cat, ci) => (
            <div key={cat.title}>
              {ci > 0 && <div className="mx-2 my-1 border-t border-gray-100 dark:border-gray-700/50" />}
              <div className="flex items-center gap-1.5 px-2.5 py-1.5 text-gray-400 dark:text-gray-500">
                {cat.icon}
                <p className="text-[10px] font-semibold uppercase tracking-wider">{cat.title}</p>
              </div>
              {cat.nodes.map((opt) => {
                const locked = !allowedTypes.includes(opt.type);
                const tiers = plansWithAnalysis(opt.type);
                const message = planAvailabilityMessage(`${opt.label} analysis`, tiers);
                return (
                  <button
                    key={opt.type}
                    onClick={() => (locked ? handleLocked(opt) : handleAdd(opt.type, opt.label))}
                    // Kept focusable and clickable rather than `disabled`: a
                    // disabled control is skipped by screen readers and offers
                    // no route to the upgrade. Clicking says why and opens the
                    // plan dialog instead of hitting the API.
                    aria-label={locked ? `${opt.label} — ${message}` : undefined}
                    title={locked ? message : undefined}
                    data-locked={locked ? 'true' : undefined}
                    className={`flex w-full items-center gap-3 rounded-lg px-2.5 py-2 text-left transition-colors duration-100 hover:bg-gray-50 dark:hover:bg-gray-700/50 ${
                      locked ? 'opacity-70' : ''
                    }`}
                  >
                    <div
                      className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg"
                      style={{ backgroundColor: opt.color + '18', color: opt.color }}
                    >
                      <div className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: opt.color }} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-medium text-gray-700 dark:text-gray-300">{opt.label}</p>
                      <p className="text-[10px] text-gray-400 dark:text-gray-500">{opt.description}</p>
                    </div>
                    {locked && tiers.length > 0 && (
                      <span
                        aria-hidden="true"
                        className="ml-auto flex shrink-0 items-center gap-1 rounded-full bg-amber-100 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-amber-700 dark:bg-amber-900/30 dark:text-amber-300"
                      >
                        <svg
                          className="h-2.5 w-2.5"
                          fill="none"
                          viewBox="0 0 24 24"
                          strokeWidth={2}
                          stroke="currentColor"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            d="M16.5 10.5V6.75a4.5 4.5 0 1 0-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 0 0 2.25-2.25v-6.75a2.25 2.25 0 0 0-2.25-2.25H6.75a2.25 2.25 0 0 0-2.25 2.25v6.75a2.25 2.25 0 0 0 2.25 2.25Z"
                          />
                        </svg>
                        {PLAN_LABELS[tiers[0]]}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          ))}
        </div>
      </CollisionPopover>
    </div>
  );
}
