import { useEffect, useState } from 'react';
import { useActiveCanvas } from '../../stores/canvasStore';
import { useAuthStore } from '../../stores/authStore';
import { useUIStore } from '../../stores/uiStore';

// Subset of backend plans.ts — kept in sync manually since the frontend
// only needs the word-cap number for the status bar gauge.
const PLAN_WORD_CAPS: Record<string, number | null> = {
  free: 5000,
  pro: 50000,
  team: null,
};

/**
 * Sprint G slice — bottom status bar.
 *
 * Slim 24-px bar at the foot of the canvas, surfaces real-time counters +
 * plan usage + WebSocket health + a tip pointing to Cmd+K. Lives outside
 * the React Flow viewport so it never overlaps content. Hidden on minimal-
 * zoom tier to avoid noise when the canvas is zoomed out for orientation.
 */
export default function StatusBar() {
  const canvas = useActiveCanvas();
  const plan = useAuthStore((s) => s.plan);
  const effectivePlan = useAuthStore((s) => s.effectivePlan);
  const zoomTier = useUIStore((s) => s.zoomTier);
  const [wsOnline, setWsOnline] = useState(true);

  useEffect(() => {
    const onOnline = () => setWsOnline(true);
    const onOffline = () => setWsOnline(false);
    window.addEventListener('online', onOnline);
    window.addEventListener('offline', onOffline);
    return () => {
      window.removeEventListener('online', onOnline);
      window.removeEventListener('offline', onOffline);
    };
  }, []);

  if (zoomTier === 'minimal' || !canvas) return null;

  const codeCount = canvas.questions?.length ?? 0;
  const wordCount = (canvas.transcripts ?? []).reduce(
    (sum, t) => sum + (t.content?.split(/\s+/).filter(Boolean).length ?? 0),
    0,
  );
  const effective = effectivePlan ?? plan ?? 'free';
  const wordCap = PLAN_WORD_CAPS[effective] ?? null;
  const wordPct = wordCap ? Math.min(100, Math.round((wordCount / wordCap) * 100)) : null;

  return (
    <div
      role="status"
      aria-label="Canvas status"
      className="flex-shrink-0 h-6 px-3 flex items-center justify-between text-[10px] text-gray-500 dark:text-gray-400 border-t border-gray-200/60 dark:border-gray-700/60 bg-gray-50/80 dark:bg-gray-900/60 backdrop-blur"
      data-testid="canvas-status-bar"
    >
      <div className="flex items-center gap-3">
        <span className="tabular-nums">
          words {wordCount.toLocaleString()}
          {wordCap ? <span className="text-gray-400">/{wordCap.toLocaleString()}</span> : null}
        </span>
        {wordPct !== null && wordPct >= 75 && (
          <span
            className={`rounded-full px-1.5 py-0.5 text-[9px] font-medium ${
              wordPct >= 95
                ? 'bg-rose-100 dark:bg-rose-900/30 text-rose-700 dark:text-rose-300'
                : 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300'
            }`}
            title="You're nearing your plan's word limit"
          >
            {wordPct}% of cap
          </span>
        )}
        <span className="text-gray-300 dark:text-gray-700">·</span>
        <span className="tabular-nums">codes {codeCount}</span>
        <span className="text-gray-300 dark:text-gray-700">·</span>
        <span>
          plan <span className="font-medium capitalize text-gray-700 dark:text-gray-200">{effective}</span>
        </span>
      </div>
      <div className="flex items-center gap-3">
        <span
          className={`flex items-center gap-1 ${wsOnline ? '' : 'text-rose-500 dark:text-rose-400'}`}
          title={wsOnline ? 'Connected' : 'Offline — changes will sync when you reconnect'}
        >
          <span className={`inline-block h-1.5 w-1.5 rounded-full ${wsOnline ? 'bg-emerald-500' : 'bg-rose-500'}`} />
          {wsOnline ? 'connected' : 'offline'}
        </span>
        <span className="hidden sm:inline">
          press <kbd className="rounded bg-gray-200 dark:bg-gray-700 px-1 py-0.5 font-mono text-[9px]">Ctrl+K</kbd> for
          commands
        </span>
      </div>
    </div>
  );
}
