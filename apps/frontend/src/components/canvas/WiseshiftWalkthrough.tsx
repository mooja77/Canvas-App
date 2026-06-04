import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useActiveCanvas, useCanvasStore } from '../../stores/canvasStore';
import { useUIStore } from '../../stores/uiStore';
import type { CanvasTextCoding, CanvasQuestion } from '@qualcanvas/shared';

/**
 * A guided, self-paced walkthrough that runs ON the user's real canvas — it
 * focuses real nodes, selects a real code (opening its coded-segments panel),
 * highlights a real coded excerpt in the transcript, and opens the live
 * intercoder-reliability check, narrating each step. Player controls: back /
 * forward / play-pause (auto-advance) / skip / contents / restart / exit, with
 * progress saved per-canvas so it can be left and resumed anytime.
 *
 * Scoped to the WISESHIFT WP3 work (gated on the canvas name) so it only
 * appears on those canvases.
 */

interface Ctx {
  topCode?: CanvasQuestion;
  firstCoding?: CanvasTextCoding;
  focus: (nodeId: string) => void;
}

interface Step {
  title: string;
  body: (n: { codes: number; codings: number; transcripts: number; topCodeText?: string }) => string;
  /** Drives the live canvas when this step is shown. */
  run?: (ctx: Ctx) => void;
}

const setSelectedQuestionId = (id: string | null) => useCanvasStore.getState().setSelectedQuestionId(id);
const setVerifyHighlight = (h: { transcriptId: string; startOffset: number; endOffset: number } | null) =>
  useUIStore.getState().setVerifyHighlight(h);
const openModal = (modal: string) =>
  window.dispatchEvent(new CustomEvent('qualcanvas:open-canvas-modal', { detail: { modal } }));

const STEPS: Step[] = [
  {
    title: 'Welcome to your project',
    body: (n) =>
      `This quick walkthrough runs right here on your real canvas — ${n.transcripts} interview${n.transcripts === 1 ? '' : 's'}, ${n.codes} code${n.codes === 1 ? '' : 's'} and ${n.codings} coded segment${n.codings === 1 ? '' : 's'}. Watch the panels open and nodes light up as we go. You can pause, jump around, leave and come back anytime.`,
  },
  {
    title: 'Your interviews',
    body: () =>
      'Each interview is a transcript node. We just centred one — every coded passage in it links out to the code it was tagged with. Zoom in on any transcript to read the cleaned text with the coded spans highlighted.',
    run: (c) => {
      const t = c.firstCoding?.transcriptId;
      if (t) c.focus(`transcript-${t}`);
    },
  },
  {
    title: 'Your codes — the CF1–CF8 framework',
    body: () =>
      'These colour-coded nodes are your Deliverable 3.1 analytical families (CF1–CF8) and their sub-codes. We centred your most-used code — the lines fanning out from it are every passage coded to it across the interviews.',
    run: (c) => {
      if (c.topCode) c.focus(`question-${c.topCode.id}`);
    },
  },
  {
    title: 'See a code’s passages',
    body: (n) =>
      `Selecting a code opens its coded-segments panel on the right — every excerpt tagged to “${n.topCodeText ?? 'this code'}”, with the source interview, so you can review them in one place.`,
    run: (c) => {
      if (c.topCode) {
        setSelectedQuestionId(c.topCode.id);
        c.focus(`question-${c.topCode.id}`);
      }
    },
  },
  {
    title: 'The excerpt, in context',
    body: () =>
      'Here’s one coded excerpt highlighted in its transcript — the node expands and scrolls straight to it. This is how every coding ties a verbatim passage back to the exact spot in the interview.',
    run: (c) => {
      setSelectedQuestionId(null);
      const cd = c.firstCoding;
      if (cd) {
        setVerifyHighlight({ transcriptId: cd.transcriptId, startOffset: cd.startOffset, endOffset: cd.endOffset });
        c.focus(`transcript-${cd.transcriptId}`);
      }
    },
  },
  {
    title: 'The codes sidebar',
    body: () =>
      'On the left, every code with its count. The CF1–CF8 families total up their sub-codes, so you can see at a glance how much sits under each family. Filter, or sort by frequency, to navigate a big codebook fast.',
    run: () => {
      setVerifyHighlight(null);
    },
  },
  {
    title: 'Is the coding reliable?',
    body: () =>
      'This is the live intercoder check. Your PACE transcript was coded by a second coder, and Krippendorff’s α came out around 0.85 — “almost perfect” agreement. Pick both coders + PACE and Compute to re-run it anytime the coding changes.',
    run: () => openModal('intercoder'),
  },
  {
    title: 'That’s your project',
    body: () =>
      'Transcripts, codes, codings, reliability — all explorable here, and exportable for your write-up. Replay this walkthrough anytime from the “Guide me” button. Over to you, Jodes.',
    run: () => {
      setSelectedQuestionId(null);
      setVerifyHighlight(null);
    },
  },
];

const AUTO_MS = 14000;

export default function WiseshiftWalkthrough({ onFocusNode }: { onFocusNode: (nodeId: string) => void }) {
  const activeCanvas = useActiveCanvas();
  const canvasId = activeCanvas?.id ?? null;
  const storageKey = canvasId ? `wiseshift-walkthrough-${canvasId}` : null;

  const [open, setOpen] = useState(false);
  const [step, setStep] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [showContents, setShowContents] = useState(false);
  const [hasSaved, setHasSaved] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Gate: only on the WISESHIFT WP3 canvases.
  const enabled = !!activeCanvas && /wiseshift/i.test(activeCanvas.name);

  // Real data the steps drive.
  const ctx = useMemo<Ctx>(() => {
    const codings = (activeCanvas?.codings ?? []) as CanvasTextCoding[];
    const questions = (activeCanvas?.questions ?? []) as CanvasQuestion[];
    const counts = new Map<string, number>();
    codings.forEach((c) => counts.set(c.questionId, (counts.get(c.questionId) ?? 0) + 1));
    let topCode: CanvasQuestion | undefined;
    let best = -1;
    questions.forEach((q) => {
      const n = counts.get(q.id) ?? 0;
      if (n > best) {
        best = n;
        topCode = q;
      }
    });
    return { topCode, firstCoding: codings[0], focus: onFocusNode };
  }, [activeCanvas, onFocusNode]);

  const counts = useMemo(
    () => ({
      codes: activeCanvas?.questions?.length ?? 0,
      codings: activeCanvas?.codings?.length ?? 0,
      transcripts: activeCanvas?.transcripts?.length ?? 0,
      topCodeText: ctx.topCode?.text,
    }),
    [activeCanvas, ctx.topCode],
  );

  // Detect a saved position for the "Resume" affordance.
  useEffect(() => {
    if (!storageKey) return;
    try {
      const raw = localStorage.getItem(storageKey);
      setHasSaved(!!raw && Number(raw) > 0);
    } catch {
      setHasSaved(false);
    }
  }, [storageKey, open]);

  const persist = useCallback(
    (s: number) => {
      if (!storageKey) return;
      try {
        localStorage.setItem(storageKey, String(s));
      } catch {
        /* ignore */
      }
    },
    [storageKey],
  );

  // Run the current step's canvas action whenever the step changes while open.
  useEffect(() => {
    if (!open) return;
    STEPS[step]?.run?.(ctx);
    persist(step);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, step]);

  const stop = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  // Auto-advance when playing.
  useEffect(() => {
    stop();
    if (!open || !playing) return;
    if (step >= STEPS.length - 1) {
      setPlaying(false);
      return;
    }
    timerRef.current = setTimeout(() => setStep((s) => Math.min(s + 1, STEPS.length - 1)), AUTO_MS);
    return stop;
  }, [open, playing, step, stop]);

  const launch = useCallback(
    (resume: boolean) => {
      let start = 0;
      if (resume && storageKey) {
        try {
          start = Math.min(Number(localStorage.getItem(storageKey) || 0) || 0, STEPS.length - 1);
        } catch {
          start = 0;
        }
      }
      setStep(start);
      setOpen(true);
    },
    [storageKey],
  );

  const exit = useCallback(() => {
    stop();
    setPlaying(false);
    setOpen(false);
    setShowContents(false);
    // Reset transient canvas state we may have set.
    setSelectedQuestionId(null);
    setVerifyHighlight(null);
  }, [stop]);

  const restart = useCallback(() => {
    setShowContents(false);
    setPlaying(false);
    setStep(0);
  }, []);

  const next = useCallback(() => setStep((s) => Math.min(s + 1, STEPS.length - 1)), []);
  const back = useCallback(() => setStep((s) => Math.max(s - 1, 0)), []);

  // Keyboard while open.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight') next();
      else if (e.key === 'ArrowLeft') back();
      else if (e.key === ' ') {
        e.preventDefault();
        setPlaying((p) => !p);
      } else if (e.key === 'Escape') {
        if (showContents) setShowContents(false);
        else exit();
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, next, back, exit, showContents]);

  if (!enabled) return null;

  // ── Launcher (when closed) ──
  if (!open) {
    return (
      <button
        onClick={() => launch(hasSaved)}
        className="absolute bottom-16 right-4 z-[9000] flex items-center gap-2 rounded-full bg-brand-600 px-4 py-2.5 text-sm font-medium text-white shadow-lg ring-1 ring-black/10 transition-all hover:-translate-y-0.5 hover:bg-brand-700 hover:shadow-xl"
        title="A guided walkthrough of how this project was coded"
      >
        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M9.813 15.904 9 18.75l-.813-2.846a4.5 4.5 0 0 0-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 0 0 3.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 0 0 3.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 0 0-3.09 3.09Z"
          />
        </svg>
        {hasSaved ? 'Resume guide' : 'Guide me through this canvas'}
      </button>
    );
  }

  const s = STEPS[step];
  const isLast = step === STEPS.length - 1;

  return (
    <>
      {/* The card floats over the LIVE canvas (no backdrop) so the driven
          panels/nodes stay visible. High z so it sits above opened modals. */}
      <div className="pointer-events-none fixed inset-x-0 bottom-0 z-[10001] flex justify-center px-4 pb-6">
        <div className="pointer-events-auto w-full max-w-[460px] overflow-hidden rounded-2xl bg-white shadow-2xl ring-1 ring-black/10 dark:bg-gray-800 dark:ring-white/10">
          {/* progress */}
          <div className="h-1 bg-gray-100 dark:bg-gray-700">
            <div
              className="h-full rounded-r-full bg-gradient-to-r from-brand-400 to-brand-600 transition-all duration-500"
              style={{ width: `${((step + 1) / STEPS.length) * 100}%` }}
            />
          </div>

          <div className="p-4">
            <div className="mb-1.5 flex items-center justify-between gap-2">
              <h3 className="text-[15px] font-semibold text-gray-900 dark:text-gray-100">{s.title}</h3>
              <span className="shrink-0 font-mono text-[10px] text-gray-400">
                {step + 1} / {STEPS.length}
              </span>
            </div>
            <p className="text-[13px] leading-relaxed text-gray-600 dark:text-gray-300">{s.body(counts)}</p>

            {/* contents drawer */}
            {showContents && (
              <div className="mt-3 max-h-40 overflow-auto rounded-lg border border-gray-200 p-1 dark:border-gray-700">
                {STEPS.map((st, i) => (
                  <button
                    key={i}
                    onClick={() => {
                      setStep(i);
                      setShowContents(false);
                    }}
                    className={`block w-full truncate rounded-md px-2 py-1.5 text-left text-[12px] ${
                      i === step
                        ? 'bg-brand-50 font-medium text-brand-700 dark:bg-brand-900/30 dark:text-brand-300'
                        : 'text-gray-600 hover:bg-gray-50 dark:text-gray-300 dark:hover:bg-gray-700/50'
                    }`}
                  >
                    <span className="mr-2 font-mono text-[10px] text-gray-400">{String(i + 1).padStart(2, '0')}</span>
                    {st.title}
                  </button>
                ))}
              </div>
            )}

            {/* controls */}
            <div className="mt-3 flex items-center gap-1">
              <button
                onClick={() => setShowContents((c) => !c)}
                className="rounded-lg px-2 py-1.5 text-[11px] text-gray-500 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-700"
                title="Contents — jump to any step"
              >
                ☰
              </button>
              <button
                onClick={restart}
                className="rounded-lg px-2 py-1.5 text-[11px] text-gray-500 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-700"
                title="Restart"
              >
                ↺
              </button>
              <button
                onClick={back}
                disabled={step === 0}
                className="rounded-lg px-2.5 py-1.5 text-[12px] text-gray-600 hover:bg-gray-100 disabled:opacity-40 dark:text-gray-300 dark:hover:bg-gray-700"
              >
                ‹ Back
              </button>
              <button
                onClick={() => setPlaying((p) => !p)}
                className="flex items-center gap-1 rounded-lg bg-brand-600 px-3 py-1.5 text-[12px] font-medium text-white hover:bg-brand-700"
                title="Play / pause (space)"
              >
                {playing ? '⏸ Pause' : '▶ Play'}
              </button>
              <button
                onClick={next}
                disabled={isLast}
                className="rounded-lg px-2.5 py-1.5 text-[12px] font-medium text-gray-700 hover:bg-gray-100 disabled:opacity-40 dark:text-gray-200 dark:hover:bg-gray-700"
              >
                Next ›
              </button>
              <div className="flex-1" />
              <button
                onClick={exit}
                className="rounded-lg px-2 py-1.5 text-[11px] text-gray-500 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-700"
                title="Exit (your place is saved)"
              >
                ✕ Exit
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
