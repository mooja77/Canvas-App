import { useEffect, useState } from 'react';
import { useActiveCanvas } from '../../stores/canvasStore';
import { useUIStore } from '../../stores/uiStore';
import { useCanvasPlan, useCanvasPlanLimits } from '../../hooks/useCanvasPlan';

/**
 * Sprint G slice — bottom status bar.
 *
 * Slim 24-px bar at the foot of the canvas, surfaces real-time counters +
 * plan usage + browser network health + a tip pointing to Cmd+K. Lives outside
 * the React Flow viewport so it never overlaps content. Hidden on minimal-
 * zoom tier to avoid noise when the canvas is zoomed out for orientation.
 */
export default function StatusBar() {
  const canvas = useActiveCanvas();
  // The per-transcript word cap is enforced against the canvas OWNER's plan
  // (M6), so a collaborator's gauge follows the canvas, not their own tier.
  const effective = useCanvasPlan();
  const wordCap = useCanvasPlanLimits().maxWordsPerTranscript;
  const zoomTier = useUIStore((s) => s.zoomTier);
  const [networkOnline, setNetworkOnline] = useState(() => navigator.onLine);

  useEffect(() => {
    const onOnline = () => setNetworkOnline(true);
    const onOffline = () => setNetworkOnline(false);
    window.addEventListener('online', onOnline);
    window.addEventListener('offline', onOffline);
    return () => {
      window.removeEventListener('online', onOnline);
      window.removeEventListener('offline', onOffline);
    };
  }, []);

  if (zoomTier === 'minimal' || !canvas) return null;

  const codeCount = canvas.questions?.length ?? 0;
  const transcriptWordCounts = (canvas.transcripts ?? []).map(
    (t) => t.content?.split(/\s+/).filter(Boolean).length ?? 0,
  );
  const wordCount = transcriptWordCounts.reduce((sum, n) => sum + n, 0);
  // The plan cap is PER TRANSCRIPT (see backend checkWordLimit), so the gauge
  // has to track the single longest transcript. Summing the whole canvas and
  // dividing by a per-transcript cap told compliant users they were over their
  // limit as soon as they added a third document.
  const longestTranscript = transcriptWordCounts.length ? Math.max(...transcriptWordCounts) : 0;
  const wordPct = wordCap ? Math.min(100, Math.round((longestTranscript / wordCap) * 100)) : null;

  return (
    <div
      role="status"
      aria-label="Canvas status"
      className="flex-shrink-0 h-6 px-3 flex items-center justify-between text-[10px] text-gray-500 dark:text-gray-400 border-t border-gray-200/60 dark:border-gray-700/60 bg-gray-50/80 dark:bg-gray-900/60 backdrop-blur"
      data-testid="canvas-status-bar"
    >
      <div className="flex items-center gap-3">
        <span className="tabular-nums" data-testid="status-bar-words">
          words {wordCount.toLocaleString()}
        </span>
        {wordCap !== null && (
          <>
            <span className="text-gray-300 dark:text-gray-700">·</span>
            <span
              className="tabular-nums"
              data-testid="status-bar-word-cap"
              title={`This canvas's plan allows ${wordCap.toLocaleString()} words per transcript. This is the longest one.`}
            >
              longest {longestTranscript.toLocaleString()}
              <span className="text-gray-500 dark:text-gray-400">/{wordCap.toLocaleString()}</span>
            </span>
          </>
        )}
        {wordPct !== null && wordPct >= 75 && (
          <span
            data-testid="status-bar-word-pct"
            className={`rounded-full px-1.5 py-0.5 text-[9px] font-medium ${
              wordPct >= 95
                ? 'bg-rose-100 dark:bg-rose-900/30 text-rose-700 dark:text-rose-300'
                : 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300'
            }`}
            title="The longest transcript is nearing this canvas's per-transcript word limit"
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
          className={`flex items-center gap-1 ${networkOnline ? '' : 'text-rose-500 dark:text-rose-400'}`}
          title={networkOnline ? 'Browser online' : 'Browser offline — changes will sync when you reconnect'}
        >
          <span
            className={`inline-block h-1.5 w-1.5 rounded-full ${networkOnline ? 'bg-emerald-500' : 'bg-rose-500'}`}
          />
          {networkOnline ? 'online' : 'offline'}
        </span>
        <span className="hidden sm:inline">
          press{' '}
          <kbd className="rounded bg-gray-200 px-1 py-0.5 font-mono text-[9px] text-gray-700 dark:bg-gray-700 dark:text-gray-200">
            Ctrl+K
          </kbd>{' '}
          for commands
        </span>
      </div>
    </div>
  );
}
