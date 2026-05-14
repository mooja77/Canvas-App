import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { get as idbGet, set as idbSet, del as idbDel } from 'idb-keyval';
import { trackEvent } from '../../utils/analytics';
import { useReducedMotion } from '../../hooks/useReducedMotion';

/**
 * Interactive coding micro-demo per docs/refresh/16-interactive-demo-spec.md.
 *
 * Three interaction paths to the same end state:
 *   1. Mouse drag-select a span → floating widget → click a code chip.
 *   2. Touch select → bottom sheet → tap a code chip.
 *   3. Keyboard: tab to one of three pre-coded "quick-select" phrase buttons,
 *      Enter to open the widget, Tab to a code chip, Enter to apply.
 *
 * State persists in IndexedDB key `qualcanvas-demo-state` for 30 days, so a
 * researcher who started coding can come back and pick up where they left off.
 *
 * The whole component lazy-loads after the first paint of `/`. SSR/no-JS
 * visitors get the placeholder fallback rendered statically in LandingPage.tsx.
 */

// ─── Data ──────────────────────────────────────────────────────────────────

const TRANSCRIPT =
  "Coming back to school felt like reaching for a self I'd put somewhere I couldn't quite find. " +
  'The first week, I sat in seminar and listened to people use words I used to use, and I thought: ' +
  "I'm going to have to learn this language again. But it wasn't the language — the language was easy. " +
  "It was that I'd been someone else for three years. Someone who got up at four in the morning to give " +
  'my mother her medications. Someone who knew the difference between a hospice nurse who actually showed ' +
  "up and one who said she would. I don't know what to do with that knowing now. It doesn't fit on a CV. " +
  "It doesn't fit in a methods section. I came back because I wanted my brain back. But my brain came back different.";

interface Code {
  id: string;
  label: string;
  swatch: string; // hex for the small color dot in the codebook + light bg highlight
  bgClass: string; // tailwind classes for the applied-span background
  ringClass: string; // tailwind classes for the chip ring on hover
  hint: string; // one-line description for hover tooltip
  /** Lower-case substrings that suggest this code is a good fit. */
  keywords: string[];
  /** True if revealed in the initial 3-code suggestion. The other 3 unlock after exploration. */
  initial: boolean;
}

const CODES: Code[] = [
  {
    id: 'identity-as-resistance',
    label: 'identity-as-resistance',
    swatch: '#B7841F',
    bgClass: 'bg-ochre-200/60 dark:bg-ochre-900/40',
    ringClass: 'ring-ochre-500',
    hint: 'Reclaiming a previous self after a role change.',
    keywords: ['self', 'someone else', 'brain back', 'reaching for', 'put somewhere'],
    initial: true,
  },
  {
    id: 'caregiving',
    label: 'caregiving',
    swatch: '#956914',
    bgClass: 'bg-amber-200/50 dark:bg-amber-900/30',
    ringClass: 'ring-amber-500',
    hint: 'Work or context tied to caring for another.',
    keywords: ['mother', 'medications', 'hospice', 'morning', 'four in the morning', 'medication', 'nurse'],
    initial: true,
  },
  {
    id: 'transition / return',
    label: 'transition / return',
    swatch: '#475569',
    bgClass: 'bg-slate-300/40 dark:bg-slate-700/40',
    ringClass: 'ring-slate-500',
    hint: 'Coming back from a break or role.',
    keywords: ['coming back', 'first week', 'came back', 'returning', 'back to school'],
    initial: true,
  },
  {
    id: 'embodied knowledge',
    label: 'embodied knowledge',
    swatch: '#DDB761',
    bgClass: 'bg-yellow-200/40 dark:bg-yellow-900/30',
    ringClass: 'ring-yellow-500',
    hint: 'Knowing something through doing or living it.',
    keywords: ['knew the difference', 'knowing', 'difference between', 'actually showed up'],
    initial: false,
  },
  {
    id: 'professional vs. personal',
    label: 'professional vs. personal',
    swatch: '#22304A',
    bgClass: 'bg-indigo-200/40 dark:bg-indigo-900/30',
    ringClass: 'ring-indigo-500',
    hint: 'Tension between formal credentials and lived experience.',
    keywords: ['cv', 'methods section', "doesn't fit", 'language', 'what to do with'],
    initial: false,
  },
  {
    id: 'interrupted self',
    label: 'interrupted self',
    swatch: '#6A7891',
    bgClass: 'bg-gray-300/40 dark:bg-gray-700/40',
    ringClass: 'ring-gray-500',
    hint: 'Living as a different person during an interrupting period.',
    keywords: ['three years', 'someone else', 'been someone', 'someone who'],
    initial: false,
  },
];

/** Phrases the keyboard path surfaces as quick-select buttons. */
const QUICK_PHRASES = [
  'someone else for three years',
  'give my mother her medications',
  'Coming back to school',
] as const;

// ─── Persistence ───────────────────────────────────────────────────────────

const STORAGE_KEY = 'qualcanvas-demo-state';
const TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

interface AppliedCode {
  codeId: string;
  start: number;
  end: number;
  text: string;
}

interface StoredState {
  applied: AppliedCode[];
  revealed: string[];
  savedAt: number;
}

async function loadStoredState(): Promise<StoredState | null> {
  try {
    const stored = (await idbGet(STORAGE_KEY)) as StoredState | undefined;
    if (!stored) return null;
    if (Date.now() - stored.savedAt > TTL_MS) {
      await idbDel(STORAGE_KEY);
      return null;
    }
    return stored;
  } catch {
    return null;
  }
}

async function saveStoredState(state: Omit<StoredState, 'savedAt'>): Promise<void> {
  try {
    await idbSet(STORAGE_KEY, { ...state, savedAt: Date.now() } satisfies StoredState);
  } catch {
    // Silent fail — persistence is a nice-to-have, not load-bearing.
  }
}

// ─── Selection helpers ────────────────────────────────────────────────────

interface Selection {
  start: number;
  end: number;
  text: string;
}

function rankCodesForSelection(text: string, codes: Code[]): Code[] {
  const lower = text.toLowerCase();
  return codes
    .map((code) => ({
      code,
      score: code.keywords.reduce((sum, kw) => sum + (lower.includes(kw.toLowerCase()) ? 1 : 0), 0),
    }))
    .sort((a, b) => b.score - a.score)
    .map(({ code }) => code);
}

// Find the offset of a substring in the transcript (first occurrence).
function findOffset(needle: string): { start: number; end: number } | null {
  const idx = TRANSCRIPT.indexOf(needle);
  if (idx === -1) return null;
  return { start: idx, end: idx + needle.length };
}

// ─── Component ────────────────────────────────────────────────────────────

export default function InteractiveDemo() {
  const [applied, setApplied] = useState<AppliedCode[]>([]);
  const [revealed, setRevealed] = useState<string[]>(() => CODES.filter((c) => c.initial).map((c) => c.id));
  const [pendingSelection, setPendingSelection] = useState<Selection | null>(null);
  const [popupPos, setPopupPos] = useState<{ x: number; y: number } | null>(null);
  const [hydrated, setHydrated] = useState(false);
  const [announceText, setAnnounceText] = useState('');
  const transcriptRef = useRef<HTMLDivElement>(null);
  const reduceMotion = useReducedMotion();

  // ── Persistence: load on mount, save on change
  useEffect(() => {
    let mounted = true;
    void loadStoredState().then((stored) => {
      if (!mounted) return;
      if (stored) {
        setApplied(stored.applied);
        setRevealed(stored.revealed);
      }
      setHydrated(true);
    });
    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    void saveStoredState({ applied, revealed });
  }, [applied, revealed, hydrated]);

  // ── Selection capture (mouse + touch via browser's native Selection)
  const captureSelection = useCallback(() => {
    const sel = window.getSelection();
    if (!sel || sel.isCollapsed) {
      setPendingSelection(null);
      setPopupPos(null);
      return;
    }
    const range = sel.getRangeAt(0);
    const text = range.toString().trim();
    if (text.length < 4) {
      // Tiny selections (single word fragments) — ignore.
      setPendingSelection(null);
      setPopupPos(null);
      return;
    }
    const offset = findOffset(text);
    if (!offset) {
      // Selection didn't map cleanly into the transcript (e.g. crossed
      // multiple text nodes). Fall back to selecting the matched fragment by
      // searching the trimmed text.
      return;
    }
    // Anchor popup just below the selection.
    const rect = range.getBoundingClientRect();
    const container = transcriptRef.current?.getBoundingClientRect();
    if (!container) return;
    setPendingSelection({ start: offset.start, end: offset.end, text });
    setPopupPos({
      x: rect.left - container.left + rect.width / 2,
      y: rect.bottom - container.top + 12,
    });
    if (!applied.length) trackEvent('interactive_demo_started');
  }, [applied.length]);

  // ── Keyboard quick-select: clicking a quick-phrase button "selects" that span
  const quickSelect = (phrase: string) => {
    const offset = findOffset(phrase);
    if (!offset) return;
    const span = transcriptRef.current?.querySelector(`[data-quick="${phrase}"]`) as HTMLElement | null;
    const rect = span?.getBoundingClientRect();
    const container = transcriptRef.current?.getBoundingClientRect();
    if (rect && container) {
      setPopupPos({
        x: rect.left - container.left + rect.width / 2,
        y: rect.bottom - container.top + 12,
      });
    }
    setPendingSelection({ ...offset, text: phrase });
    if (!applied.length) trackEvent('interactive_demo_started');
  };

  // ── Apply a code to the pending selection
  const applyCode = (code: Code) => {
    if (!pendingSelection) return;
    setApplied((cur) => [
      ...cur,
      {
        codeId: code.id,
        start: pendingSelection.start,
        end: pendingSelection.end,
        text: pendingSelection.text,
      },
    ]);
    // Reveal a previously-hidden code each time the user applies a new one.
    setRevealed((cur) => {
      if (cur.length >= CODES.length) return cur;
      const next = CODES.find((c) => !cur.includes(c.id));
      return next ? [...cur, next.id] : cur;
    });
    setAnnounceText(`Code applied: ${code.label}.`);
    trackEvent('interactive_demo_code_applied', {
      code_name: code.id,
      code_count_in_session: applied.length + 1,
    });
    if (applied.length + 1 === 3) {
      trackEvent('interactive_demo_completed');
    }
    setPendingSelection(null);
    setPopupPos(null);
    window.getSelection()?.removeAllRanges();
  };

  // ── Reset the demo
  const resetDemo = async () => {
    setApplied([]);
    setRevealed(CODES.filter((c) => c.initial).map((c) => c.id));
    setPendingSelection(null);
    setPopupPos(null);
    setAnnounceText('Demo reset.');
    try {
      await idbDel(STORAGE_KEY);
    } catch {
      /* noop */
    }
  };

  // ── Escape closes the popup
  useEffect(() => {
    if (!pendingSelection) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setPendingSelection(null);
        setPopupPos(null);
        window.getSelection()?.removeAllRanges();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [pendingSelection]);

  // ── Render transcript with applied-code highlights overlaid
  const renderedTranscript = useMemo(() => {
    // Build a list of segments: either {applied code span} or plain text.
    type Segment = { start: number; end: number; codeId?: string; quickPhrase?: string };
    const segments: Segment[] = [];

    // Sort applied codes by start position; if they overlap, the later one wins
    // for the overlapping range — but for the demo we keep it simple and don't
    // visually layer overlaps.
    const sorted = [...applied].sort((a, b) => a.start - b.start);

    let cursor = 0;
    for (const ac of sorted) {
      if (ac.start > cursor) segments.push({ start: cursor, end: ac.start });
      segments.push({ start: ac.start, end: ac.end, codeId: ac.codeId });
      cursor = Math.max(cursor, ac.end);
    }
    if (cursor < TRANSCRIPT.length) segments.push({ start: cursor, end: TRANSCRIPT.length });

    // Within each plain segment, inject quick-phrase buttons where they fall.
    const enriched: Segment[] = [];
    for (const seg of segments) {
      if (seg.codeId) {
        enriched.push(seg);
        continue;
      }
      const segText = TRANSCRIPT.slice(seg.start, seg.end);
      // Sort phrases by their position in this segment so the inner cursor
      // advances correctly regardless of QUICK_PHRASES declaration order.
      const hits = QUICK_PHRASES.map((phrase) => ({ phrase, idx: segText.indexOf(phrase) }))
        .filter((h) => h.idx >= 0)
        .sort((a, b) => a.idx - b.idx);
      let inner = seg.start;
      for (const { phrase, idx } of hits) {
        const absStart = seg.start + idx;
        const absEnd = absStart + phrase.length;
        if (absStart < inner || absEnd > seg.end) continue;
        if (absStart > inner) enriched.push({ start: inner, end: absStart });
        enriched.push({ start: absStart, end: absEnd, quickPhrase: phrase });
        inner = absEnd;
      }
      if (inner < seg.end) enriched.push({ start: inner, end: seg.end });
    }
    return enriched;
  }, [applied]);

  const orderedCodeSuggestions = useMemo(() => {
    if (!pendingSelection) return [];
    return rankCodesForSelection(
      pendingSelection.text,
      CODES.filter((c) => revealed.includes(c.id)),
    ).slice(0, 4);
  }, [pendingSelection, revealed]);

  const codebookEntries = useMemo(() => {
    return CODES.map((code) => {
      const count = applied.filter((a) => a.codeId === code.id).length;
      return { code, count, applied: count > 0 };
    });
  }, [applied]);

  return (
    <div className="relative" onMouseUp={captureSelection} onTouchEnd={captureSelection}>
      <div className="relative rounded-2xl overflow-hidden ring-1 ring-gray-200 dark:ring-gray-700 bg-white dark:bg-gray-900 shadow-2xl shadow-ink-900/5">
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_280px]">
          {/* ── Transcript pane ── */}
          <div className="p-6 sm:p-10 border-b lg:border-b-0 lg:border-r border-gray-200 dark:border-gray-800 relative">
            <div className="text-xs font-semibold uppercase tracking-[0.08em] text-gray-500 dark:text-gray-400 mb-3">
              Maya, 27 — on returning to graduate school after caregiving
            </div>

            <div
              ref={transcriptRef}
              className="text-base sm:text-lg leading-relaxed text-gray-800 dark:text-gray-200 selection:bg-ochre-200 dark:selection:bg-ochre-900 select-text"
              style={{ fontVariationSettings: "'wght' 400" }}
              aria-label="Interview transcript — select a span to apply a code"
            >
              <blockquote className="m-0 p-0">
                {renderedTranscript.map((seg, idx) => {
                  const segText = TRANSCRIPT.slice(seg.start, seg.end);
                  if (seg.codeId) {
                    const code = CODES.find((c) => c.id === seg.codeId);
                    if (!code) return <span key={idx}>{segText}</span>;
                    return (
                      <span
                        key={idx}
                        className={`${code.bgClass} px-0.5 rounded-sm`}
                        title={`${code.label} — ${code.hint}`}
                      >
                        {segText}
                      </span>
                    );
                  }
                  if (seg.quickPhrase) {
                    return (
                      <button
                        key={idx}
                        type="button"
                        data-quick={seg.quickPhrase}
                        onClick={() => quickSelect(seg.quickPhrase!)}
                        className="
                          underline decoration-dotted decoration-ochre-500/60 underline-offset-4
                          hover:decoration-ochre-500 hover:decoration-solid
                          focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ochre-400 focus-visible:ring-offset-2 focus-visible:rounded
                          transition-colors duration-150
                          cursor-pointer
                        "
                      >
                        {segText}
                      </button>
                    );
                  }
                  return <span key={idx}>{segText}</span>;
                })}
              </blockquote>
            </div>

            {/* Hint */}
            {applied.length === 0 && !pendingSelection && (
              <p className="mt-4 text-xs text-gray-500 dark:text-gray-400">
                Highlight any span — or use the underlined quick-select phrases — to see suggested codes.
              </p>
            )}

            {/* Floating widget — appears anchored to the selection */}
            {pendingSelection && popupPos && (
              <div
                role="dialog"
                aria-modal="false"
                aria-label="Suggested codes"
                className={`
                  absolute z-20
                  bg-white dark:bg-gray-800
                  rounded-xl shadow-2xl
                  ring-1 ring-gray-200 dark:ring-gray-700
                  p-3
                  max-w-sm w-max
                  ${reduceMotion ? '' : 'animate-fade-in'}
                `}
                style={{
                  left: Math.max(8, Math.min(popupPos.x - 160, (transcriptRef.current?.offsetWidth ?? 0) - 320 - 8)),
                  top: popupPos.y,
                }}
              >
                <div className="text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-2 px-1">
                  Suggested codes
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {orderedCodeSuggestions.map((code) => (
                    <button
                      key={code.id}
                      type="button"
                      onClick={() => applyCode(code)}
                      title={code.hint}
                      className={`
                        inline-flex items-center gap-1.5 px-3 py-1.5
                        rounded-full text-xs font-medium
                        bg-gray-100 dark:bg-gray-700
                        text-gray-800 dark:text-gray-100
                        hover:bg-ochre-100 dark:hover:bg-ochre-900/30
                        ring-1 ring-transparent hover:${code.ringClass}
                        focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ochre-400 focus-visible:ring-offset-2
                        transition-colors duration-150
                      `}
                    >
                      <span
                        aria-hidden="true"
                        className="w-1.5 h-1.5 rounded-full"
                        style={{ backgroundColor: code.swatch }}
                      />
                      <span>+ {code.label}</span>
                    </button>
                  ))}
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setPendingSelection(null);
                    setPopupPos(null);
                    window.getSelection()?.removeAllRanges();
                  }}
                  className="mt-2 ml-1 text-xs text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white"
                >
                  Dismiss
                </button>
              </div>
            )}
          </div>

          {/* ── Codebook pane ── */}
          {/* role="region" carries the accessible name without nesting a
              complementary landmark inside the section landmark above. */}
          <div className="p-6 sm:p-8 bg-gray-50 dark:bg-gray-800/40" role="region" aria-label="Codebook">
            <div className="flex items-center justify-between mb-4">
              <div className="text-xs font-semibold uppercase tracking-[0.08em] text-gray-500 dark:text-gray-400">
                Codebook
              </div>
              {applied.length > 0 && (
                <button
                  type="button"
                  onClick={resetDemo}
                  className="
                    text-[10px] font-medium uppercase tracking-wider
                    text-gray-400 dark:text-gray-500
                    hover:text-gray-700 dark:hover:text-gray-300
                    focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ochre-400 focus-visible:ring-offset-2
                    rounded px-1.5 py-0.5
                  "
                  aria-label="Reset interactive demo"
                >
                  Reset
                </button>
              )}
            </div>

            <ul className="space-y-3 text-sm">
              {codebookEntries.map(({ code, count, applied: isApplied }) => (
                // Visual hierarchy (applied = bold/colored swatch, unapplied =
                // muted) carries the state. We dropped the `opacity-50` wrapper
                // because compositing the dark-mode greys at 50% pushed
                // contrast below 4.5:1.
                <li key={code.id} className="flex items-center gap-3">
                  <span
                    aria-hidden="true"
                    className="w-2 h-2 rounded-full flex-shrink-0"
                    style={{ backgroundColor: isApplied ? code.swatch : '#9CA7B9' }}
                  />
                  <span
                    className={`flex-1 ${isApplied ? 'text-gray-900 dark:text-gray-100 font-medium' : 'text-gray-600 dark:text-gray-300'}`}
                  >
                    {code.label}
                  </span>
                  <span className="text-xs text-gray-500 dark:text-gray-400 flex-shrink-0">
                    {count} {count === 1 ? 'span' : 'spans'}
                  </span>
                </li>
              ))}
            </ul>

            <div className="mt-6 text-xs text-gray-500 dark:text-gray-400 leading-relaxed">
              {applied.length === 0
                ? 'Pick a span to apply your first code.'
                : applied.length < 3
                  ? `${3 - applied.length} more to see how this becomes a theme.`
                  : null}
              {applied.length >= 3 && (
                <a
                  href="/methodology/thematic-analysis"
                  onClick={() =>
                    trackEvent('cta_clicked', {
                      cta_label: 'See how this becomes a theme',
                      location: 'interactive_demo',
                      target_route: '/methodology/thematic-analysis',
                    })
                  }
                  className="text-ochre-700 dark:text-ochre-400 hover:underline decoration-ochre-500 underline-offset-2 font-medium"
                >
                  See how this becomes a theme →
                </a>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Live region for screen-reader announcements */}
      <div role="status" aria-live="polite" className="sr-only">
        {announceText}
      </div>
    </div>
  );
}
