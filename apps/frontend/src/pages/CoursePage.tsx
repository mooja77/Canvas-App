import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import PageShell from '../components/marketing/PageShell';
import { YouTubeVideoCard } from '../components/training/YouTubeVideoCard';
import { COURSE_MODULES } from '../data/courseModules';
import { trainingVideos } from '../data/trainingVideos';
import { usePageMeta } from '../hooks/usePageMeta';
import { trackEvent } from '../utils/analytics';

const PROGRESS_STORAGE_KEY = 'qualcanvas_course_progress_v1';

function loadCompletedModules(): string[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(PROGRESS_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((id): id is string => typeof id === 'string') : [];
  } catch {
    return [];
  }
}

export default function CoursePage() {
  const [activeModuleId, setActiveModuleId] = useState(COURSE_MODULES[0].id);
  const [completedIds, setCompletedIds] = useState<string[]>(() => loadCompletedModules());
  const [answers, setAnswers] = useState<Record<string, number>>({});

  usePageMeta(
    'Free Online Qualitative Coding Course | QualCanvas',
    'A free, self-paced 6-module online course covering privacy-first setup, codebook design, thematic analysis, cross-case comparison, team agreement, and defensible exports. No account required.',
  );

  useEffect(() => {
    trackEvent('training_page_viewed', { page: '/course' });
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      window.localStorage.setItem(PROGRESS_STORAGE_KEY, JSON.stringify(completedIds));
    } catch {
      // Ignore storage failures in restricted browser modes
    }
  }, [completedIds]);

  const videoById = useMemo(() => {
    const map = new Map<string, (typeof trainingVideos)[number]>();
    for (const v of trainingVideos) map.set(v.id, v);
    return map;
  }, []);

  const activeIndex = Math.max(
    0,
    COURSE_MODULES.findIndex((m) => m.id === activeModuleId),
  );
  const activeModule = COURSE_MODULES[activeIndex] ?? COURSE_MODULES[0];
  const isCompleted = completedIds.includes(activeModule.id);
  const totalMinutes = COURSE_MODULES.reduce((sum, m) => sum + m.durationMinutes, 0);
  const completionPct = Math.round((completedIds.length / COURSE_MODULES.length) * 100);

  const toggleComplete = (moduleId: string) => {
    setCompletedIds((prev) => (prev.includes(moduleId) ? prev.filter((id) => id !== moduleId) : [...prev, moduleId]));
  };

  const resetProgress = () => {
    setCompletedIds([]);
    setAnswers({});
  };

  const moduleVideos = activeModule.videoIds
    .map((id) => videoById.get(id))
    .filter((v): v is (typeof trainingVideos)[number] => Boolean(v));

  return (
    <PageShell>
      <section
        className="border-y border-gray-200 bg-slate-950 text-white dark:border-gray-800"
        aria-labelledby="course-heading"
      >
        <div className="mx-auto grid max-w-6xl gap-10 px-4 py-14 sm:py-18 lg:grid-cols-[1.2fr_0.8fr] lg:items-center">
          <div>
            <p className="mb-3 text-xs font-semibold uppercase tracking-[0.2em] text-amber-400">
              Free self-paced online course
            </p>
            <h1 id="course-heading" className="max-w-3xl text-3xl font-bold tracking-tight sm:text-5xl">
              Practical Qualitative Coding: Transcript to Defensible Report
            </h1>
            <p className="mt-5 max-w-2xl text-base leading-7 text-slate-300 sm:text-lg">
              Six short modules with real walkthrough videos, plain-language steps, synthetic practice exercises, and
              quick knowledge checks. Open to everyone with no sign-up wall.
            </p>
            <div className="mt-7 flex flex-wrap gap-3">
              <a
                href="#course-workspace"
                className="rounded-lg bg-amber-500 px-5 py-3 text-sm font-semibold text-slate-950 hover:bg-amber-400"
              >
                Start Module 1
              </a>
              <Link
                to="/training"
                className="rounded-lg border border-slate-600 px-5 py-3 text-sm font-semibold text-white hover:border-slate-400"
              >
                Browse all 18 videos
              </Link>
              <Link
                to="/login?mode=register"
                className="rounded-lg border border-slate-600 px-5 py-3 text-sm font-semibold text-white hover:border-slate-400"
              >
                Open free practice workspace
              </Link>
            </div>
          </div>

          <div className="rounded-2xl border border-slate-700 bg-slate-900/80 p-5">
            <div className="flex items-center justify-between text-xs text-slate-300">
              <span className="font-semibold uppercase tracking-wider text-amber-400">Your progress</span>
              <span>
                {completedIds.length} of {COURSE_MODULES.length} modules complete
              </span>
            </div>
            <div
              className="mt-3 h-2.5 w-full overflow-hidden rounded-full bg-slate-800"
              role="progressbar"
              aria-valuenow={completionPct}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-label="Course completion progress"
            >
              <div
                className="h-full rounded-full bg-amber-400 transition-all duration-300"
                style={{ width: `${completionPct}%` }}
              />
            </div>
            <dl className="mt-5 grid grid-cols-3 gap-2 text-center">
              <div className="rounded-xl bg-slate-950/70 p-3">
                <dt className="text-[11px] text-slate-400">Modules</dt>
                <dd className="mt-1 text-xl font-bold text-white">{COURSE_MODULES.length}</dd>
              </div>
              <div className="rounded-xl bg-slate-950/70 p-3">
                <dt className="text-[11px] text-slate-400">Total time</dt>
                <dd className="mt-1 text-xl font-bold text-white">{totalMinutes} min</dd>
              </div>
              <div className="rounded-xl bg-slate-950/70 p-3">
                <dt className="text-[11px] text-slate-400">Cost</dt>
                <dd className="mt-1 text-xl font-bold text-amber-400">Free</dd>
              </div>
            </dl>
            {completedIds.length > 0 && (
              <button
                type="button"
                onClick={resetProgress}
                className="mt-4 w-full rounded-lg border border-slate-700 px-3 py-1.5 text-xs font-medium text-slate-300 hover:border-slate-500 hover:text-white"
              >
                Reset course progress
              </button>
            )}
          </div>
        </div>
      </section>

      <section id="course-workspace" className="mx-auto max-w-6xl px-4 py-12" aria-label="Course curriculum">
        {completedIds.length === COURSE_MODULES.length && (
          <div
            role="status"
            className="mb-8 rounded-2xl border border-emerald-200 bg-emerald-50 p-5 text-emerald-950 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-100"
          >
            <h2 className="text-base font-bold">Course complete</h2>
            <p className="mt-1 text-sm">
              You finished all six modules. You are ready to run a privacy-first qualitative study in QualCanvas and
              export a full methods trail.
            </p>
          </div>
        )}

        <div className="grid gap-8 lg:grid-cols-[280px_1fr]">
          <nav aria-label="Course modules" className="space-y-2">
            {COURSE_MODULES.map((mod) => {
              const selected = mod.id === activeModule.id;
              const done = completedIds.includes(mod.id);
              return (
                <button
                  key={mod.id}
                  type="button"
                  onClick={() => setActiveModuleId(mod.id)}
                  aria-current={selected ? 'step' : undefined}
                  className={`flex w-full items-start gap-3 rounded-xl border p-3.5 text-left transition-colors ${
                    selected
                      ? 'border-brand-600 bg-brand-50/70 text-gray-950 dark:border-brand-400 dark:bg-brand-950/40 dark:text-white'
                      : 'border-gray-200 bg-white text-gray-700 hover:bg-gray-50 dark:border-gray-800 dark:bg-gray-900 dark:text-gray-300 dark:hover:bg-gray-800/80'
                  }`}
                >
                  <span
                    className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
                      done
                        ? 'bg-emerald-600 text-white'
                        : selected
                          ? 'bg-brand-600 text-white'
                          : 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300'
                    }`}
                  >
                    {done ? '✓' : mod.number}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                      Module {mod.number} · {mod.durationMinutes} min
                    </span>
                    <span className="mt-0.5 block text-sm font-semibold leading-snug">{mod.title}</span>
                  </span>
                </button>
              );
            })}
          </nav>

          <article className="space-y-8 rounded-2xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-800 dark:bg-gray-900 sm:p-8">
            <header className="border-b border-gray-200 pb-6 dark:border-gray-800">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-amber-700 dark:text-amber-400">
                Module {activeModule.number} of {COURSE_MODULES.length} · {activeModule.durationMinutes} minutes
              </p>
              <h2 className="mt-2 text-2xl font-bold text-gray-950 dark:text-white sm:text-3xl">
                {activeModule.title}
              </h2>
              <p className="mt-3 text-base leading-7 text-gray-600 dark:text-gray-300">{activeModule.summary}</p>
            </header>

            <div>
              <h3 className="text-sm font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                What you will learn
              </h3>
              <ul className="mt-3 space-y-2 text-sm text-gray-700 dark:text-gray-300">
                {activeModule.outcomes.map((item) => (
                  <li key={item} className="flex items-start gap-2">
                    <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-brand-600 dark:bg-brand-400" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>

            {moduleVideos.length > 0 && (
              <div>
                <h3 className="text-sm font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                  Watch the walkthrough
                </h3>
                <div className="mt-3 grid gap-4 sm:grid-cols-2">
                  {moduleVideos.map((video) => (
                    <YouTubeVideoCard key={video.id} video={video} />
                  ))}
                </div>
              </div>
            )}

            <div>
              <h3 className="text-sm font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                Step-by-step guide
              </h3>
              <ol className="mt-3 space-y-3 text-sm leading-6 text-gray-700 dark:text-gray-300">
                {activeModule.steps.map((step, idx) => (
                  <li key={step} className="flex items-start gap-3">
                    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-gray-100 text-xs font-semibold text-gray-800 dark:bg-gray-800 dark:text-gray-200">
                      {idx + 1}
                    </span>
                    <span>{step}</span>
                  </li>
                ))}
              </ol>
            </div>

            <div className="rounded-xl border border-amber-200 bg-amber-50/70 p-5 dark:border-amber-900/60 dark:bg-amber-950/20">
              <h3 className="text-sm font-bold text-gray-950 dark:text-white">{activeModule.exerciseTitle}</h3>
              <p className="mt-1.5 text-sm leading-6 text-gray-700 dark:text-gray-300">{activeModule.exercisePrompt}</p>
            </div>

            <div>
              <h3 className="text-sm font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                Quick knowledge check
              </h3>
              <div className="mt-3 space-y-5">
                {activeModule.quiz.map((q) => {
                  const chosen = answers[q.id];
                  const answered = typeof chosen === 'number';
                  const isCorrect = answered && chosen === q.correctIndex;
                  return (
                    <fieldset key={q.id} className="rounded-xl border border-gray-200 p-4 dark:border-gray-800">
                      <legend className="px-1 text-sm font-semibold text-gray-900 dark:text-gray-100">
                        {q.prompt}
                      </legend>
                      <div className="mt-3 space-y-2">
                        {q.options.map((option, optIdx) => {
                          const selected = chosen === optIdx;
                          return (
                            <label
                              key={option}
                              className={`flex cursor-pointer items-start gap-2.5 rounded-lg border px-3 py-2 text-sm transition-colors ${
                                selected
                                  ? 'border-brand-600 bg-brand-50/60 text-gray-950 dark:border-brand-400 dark:bg-brand-950/30 dark:text-white'
                                  : 'border-gray-200 text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800/60'
                              }`}
                            >
                              <input
                                type="radio"
                                name={q.id}
                                checked={selected}
                                onChange={() => setAnswers((prev) => ({ ...prev, [q.id]: optIdx }))}
                                className="mt-1"
                              />
                              <span>{option}</span>
                            </label>
                          );
                        })}
                      </div>
                      {answered && (
                        <p
                          role="status"
                          className={`mt-3 rounded-lg px-3 py-2 text-xs font-medium ${
                            isCorrect
                              ? 'bg-emerald-50 text-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-200'
                              : 'bg-amber-50 text-amber-950 dark:bg-amber-950/40 dark:text-amber-200'
                          }`}
                        >
                          {isCorrect ? 'Correct. ' : 'Not quite. '}
                          {q.explanation}
                        </p>
                      )}
                    </fieldset>
                  );
                })}
              </div>
            </div>

            <footer className="flex flex-wrap items-center justify-between gap-3 border-t border-gray-200 pt-6 dark:border-gray-800">
              <button
                type="button"
                onClick={() => toggleComplete(activeModule.id)}
                className={`rounded-lg px-4 py-2 text-sm font-semibold transition-colors ${
                  isCompleted
                    ? 'bg-emerald-600 text-white hover:bg-emerald-700'
                    : 'bg-brand-600 text-white hover:bg-brand-700'
                }`}
              >
                {isCompleted ? 'Module completed' : 'Mark module complete'}
              </button>

              <div className="flex items-center gap-2">
                {activeIndex > 0 && (
                  <button
                    type="button"
                    onClick={() => setActiveModuleId(COURSE_MODULES[activeIndex - 1].id)}
                    className="rounded-lg border border-gray-300 px-3.5 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-200 dark:hover:bg-gray-800"
                  >
                    Previous module
                  </button>
                )}
                {activeIndex < COURSE_MODULES.length - 1 && (
                  <button
                    type="button"
                    onClick={() => setActiveModuleId(COURSE_MODULES[activeIndex + 1].id)}
                    className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800 dark:bg-white dark:text-slate-950 dark:hover:bg-gray-200"
                  >
                    Next module
                  </button>
                )}
              </div>
            </footer>
          </article>
        </div>
      </section>
    </PageShell>
  );
}
