import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import toast from 'react-hot-toast';
import type { CanvasQuestion, CanvasTranscript } from '@qualcanvas/shared';
import { canvasApi } from '../../../services/api';
import { useActiveCanvas } from '../../../stores/canvasStore';
import { useEscapeToClose } from '../../../hooks/useEscapeToClose';
import { useFocusTrap } from '../../../hooks/useFocusTrap';
import ConfirmDialog from '../ConfirmDialog';
import TrainingCodingPad, { type PadCoding } from './TrainingCodingPad';
import { apiErrorMessage, kappaBand } from './featureScreenUtils';

/**
 * Coder training.
 *
 * The canvas owner writes an exercise: a transcript plus an answer key coded in
 * this screen (never on the canvas, so trainees cannot read it off the canvas).
 * Trainees code the same transcript, get Cohen's κ against the key, and only see
 * the key once they pass. The server enforces that rule; this screen follows it.
 */

interface Progress {
  attempts: number;
  bestKappa: number | null;
  passed: boolean;
}
interface Exercise {
  id: string;
  transcriptId: string;
  name: string;
  instructions: string | null;
  passThreshold: number;
  createdAt: string;
  attemptCount: number;
  goldCodingCount: number;
  myProgress: Progress;
  goldCodings?: PadCoding[];
  passedTraineeCount?: number;
}
interface Attempt {
  id: string;
  userId: string | null;
  userName?: string;
  codings: PadCoding[];
  kappaScore: number | null;
  passed: boolean;
  createdAt: string;
  goldCodings?: PadCoding[];
}

type View =
  | { kind: 'list' }
  | { kind: 'create' }
  | { kind: 'attempt'; exercise: Exercise }
  | { kind: 'review'; exercise: Exercise };

export default function CoderTrainingModal({ onClose }: { onClose: () => void }) {
  const activeCanvas = useActiveCanvas();
  const canvasId = activeCanvas?.id ?? null;
  const isOwner = (activeCanvas?.myRole ?? 'owner') === 'owner';
  const transcripts: CanvasTranscript[] = useMemo(() => activeCanvas?.transcripts ?? [], [activeCanvas?.transcripts]);
  const questions: CanvasQuestion[] = useMemo(() => activeCanvas?.questions ?? [], [activeCanvas?.questions]);
  const canvasCodings = useMemo(() => activeCanvas?.codings ?? [], [activeCanvas?.codings]);

  const dialogRef = useRef<HTMLDivElement>(null);
  const [confirmDelete, setConfirmDelete] = useState<Exercise | null>(null);
  useFocusTrap(dialogRef);
  useEscapeToClose(useCallback(() => (confirmDelete ? undefined : onClose()), [confirmDelete, onClose]));

  const [view, setView] = useState<View>({ kind: 'list' });
  const [exercises, setExercises] = useState<Exercise[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [announcement, setAnnouncement] = useState('');

  const load = useCallback(async () => {
    if (!canvasId) return;
    setError(null);
    try {
      const res = await canvasApi.getTrainingDocuments(canvasId);
      setExercises(res.data.data);
    } catch (err) {
      setError(apiErrorMessage(err, 'Could not load training exercises.'));
    }
  }, [canvasId]);

  useEffect(() => {
    load();
  }, [load]);

  const transcriptOf = (id: string) => transcripts.find((t) => t.id === id);
  const heading =
    view.kind === 'create'
      ? 'New training exercise'
      : view.kind === 'attempt'
        ? view.exercise.name
        : view.kind === 'review'
          ? `Attempts: ${view.exercise.name}`
          : 'Coder training';

  return createPortal(
    <div className="modal-backdrop fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-2 sm:p-4">
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="training-title"
        className="modal-content flex max-h-[92vh] w-full max-w-3xl flex-col rounded-2xl bg-white shadow-xl ring-1 ring-black/5 dark:bg-gray-800"
      >
        <div className="flex items-start justify-between border-b border-gray-200 px-5 py-3 dark:border-gray-700">
          <div className="min-w-0">
            {view.kind !== 'list' && (
              <button
                type="button"
                className="mb-1 text-xs font-medium text-indigo-600 hover:underline"
                onClick={() => {
                  setView({ kind: 'list' });
                  load();
                }}
              >
                ← All exercises
              </button>
            )}
            <h2 id="training-title" className="truncate text-base font-semibold text-gray-900 dark:text-gray-100">
              {heading}
            </h2>
            {view.kind === 'list' && (
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Practise coding against a gold-standard answer key before coding real data. Scored with Cohen's κ.
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-gray-700"
          >
            <svg
              className="h-5 w-5"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={1.5}
              stroke="currentColor"
              aria-hidden
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4">
          {view.kind === 'list' &&
            (error ? (
              <div
                role="alert"
                className="rounded-lg bg-red-50 p-3 text-sm text-red-700 dark:bg-red-900/20 dark:text-red-300"
              >
                {error}{' '}
                <button type="button" className="font-medium underline" onClick={load}>
                  Try again
                </button>
              </div>
            ) : exercises === null ? (
              <div
                className="h-24 animate-pulse rounded-lg bg-gray-100 dark:bg-gray-700"
                aria-label="Loading exercises"
              />
            ) : exercises.length === 0 ? (
              <div
                className="rounded-xl border border-gray-200 p-5 text-sm dark:border-gray-700"
                data-testid="training-empty"
              >
                <h3 className="font-semibold text-gray-900 dark:text-gray-100">No training exercises yet</h3>
                <p className="mt-1 text-gray-600 dark:text-gray-300">
                  New coders drift from a codebook in ways nobody notices until the data is coded. An exercise lets them
                  code a transcript you have already coded, see how closely they agree (Cohen's κ), and try again before
                  touching the real data.
                </p>
                {isOwner ? (
                  transcripts.length === 0 ? (
                    <p className="mt-3 text-gray-700 dark:text-gray-200">
                      Add a transcript to this canvas first — an exercise is built on one.
                    </p>
                  ) : questions.length === 0 ? (
                    <p className="mt-3 text-gray-700 dark:text-gray-200">
                      Create at least one code first — trainees code with your codebook.
                    </p>
                  ) : (
                    <>
                      <button
                        type="button"
                        className="btn-primary mt-4 text-sm"
                        onClick={() => setView({ kind: 'create' })}
                      >
                        Create an exercise
                      </button>
                      <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
                        Already coded a transcript? You can start the answer key from those codings.
                      </p>
                    </>
                  )
                ) : (
                  <p className="mt-3 text-gray-700 dark:text-gray-200">
                    The canvas owner hasn't created an exercise yet. Ask them to set one up for you.
                  </p>
                )}
              </div>
            ) : (
              <>
                <ul className="space-y-3">
                  {exercises.map((ex) => (
                    <li
                      key={ex.id}
                      className="rounded-xl border border-gray-200 p-4 dark:border-gray-700"
                      data-testid="training-exercise"
                    >
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <div className="min-w-0">
                          <h3 className="font-medium text-gray-900 dark:text-gray-100">{ex.name}</h3>
                          <p className="text-xs text-gray-500 dark:text-gray-400">
                            {transcriptOf(ex.transcriptId)?.title ?? 'Transcript no longer on this canvas'} · pass at κ
                            ≥ {ex.passThreshold.toFixed(2)}
                            {isOwner &&
                              ` · answer key: ${ex.goldCodingCount} coding${ex.goldCodingCount === 1 ? '' : 's'}`}
                          </p>
                        </div>
                        <ProgressBadge progress={ex.myProgress} />
                      </div>
                      {isOwner && (
                        <p className="mt-1 text-xs text-gray-600 dark:text-gray-300">
                          {ex.attemptCount} attempt{ex.attemptCount === 1 ? '' : 's'} · {ex.passedTraineeCount ?? 0}{' '}
                          coder{ex.passedTraineeCount === 1 ? '' : 's'} passed
                        </p>
                      )}
                      <div className="mt-3 flex flex-wrap gap-2">
                        <button
                          type="button"
                          className="btn-primary px-3 py-1.5 text-sm"
                          onClick={() => setView({ kind: 'attempt', exercise: ex })}
                          disabled={!transcriptOf(ex.transcriptId)}
                          aria-label={`${ex.myProgress.attempts ? 'Try again' : 'Start exercise'}: ${ex.name}`}
                        >
                          {ex.myProgress.attempts ? 'Try again' : 'Start exercise'}
                        </button>
                        <button
                          type="button"
                          className="btn-secondary px-3 py-1.5 text-sm"
                          onClick={() => setView({ kind: 'review', exercise: ex })}
                          aria-label={`${isOwner ? 'Review attempts' : 'My attempts'}: ${ex.name}`}
                        >
                          {isOwner ? 'Review attempts' : 'My attempts'}
                        </button>
                        {isOwner && (
                          <button
                            type="button"
                            className="px-3 py-1.5 text-sm text-red-600 hover:underline"
                            aria-label={`Delete ${ex.name}`}
                            onClick={() => setConfirmDelete(ex)}
                          >
                            Delete
                          </button>
                        )}
                      </div>
                    </li>
                  ))}
                </ul>
                {isOwner && (
                  <button
                    type="button"
                    className="mt-4 w-full rounded-lg border border-dashed border-indigo-300 py-2 text-sm text-indigo-700 hover:bg-indigo-50 dark:border-indigo-700 dark:text-indigo-300 dark:hover:bg-indigo-900/20"
                    onClick={() => setView({ kind: 'create' })}
                  >
                    + New exercise
                  </button>
                )}
              </>
            ))}

          {view.kind === 'create' && canvasId && (
            <CreateExercise
              canvasId={canvasId}
              transcripts={transcripts}
              questions={questions}
              canvasCodings={canvasCodings}
              onCreated={(name) => {
                setAnnouncement(`Exercise ${name} created.`);
                toast.success('Exercise created');
                setView({ kind: 'list' });
                load();
              }}
            />
          )}

          {view.kind === 'attempt' && canvasId && (
            <AttemptExercise
              canvasId={canvasId}
              exercise={view.exercise}
              transcript={transcriptOf(view.exercise.transcriptId)}
              questions={questions}
              onAnnounce={setAnnouncement}
            />
          )}

          {view.kind === 'review' && canvasId && (
            <ReviewAttempts canvasId={canvasId} exercise={view.exercise} questions={questions} isOwner={isOwner} />
          )}
        </div>
        <div aria-live="polite" className="sr-only">
          {announcement}
        </div>
      </div>
      {confirmDelete && canvasId && (
        <ConfirmDialog
          title="Delete exercise?"
          message={`“${confirmDelete.name}”, its answer key and every attempt at it will be deleted.`}
          onCancel={() => setConfirmDelete(null)}
          onConfirm={async () => {
            const ex = confirmDelete;
            setConfirmDelete(null);
            try {
              await canvasApi.deleteTrainingDocument(canvasId, ex.id);
              setExercises((prev) => (prev ?? []).filter((e) => e.id !== ex.id));
              toast.success('Exercise deleted');
            } catch (err) {
              toast.error(apiErrorMessage(err, 'Could not delete the exercise.'));
            }
          }}
        />
      )}
    </div>,
    document.body,
  );
}

function ProgressBadge({ progress }: { progress: Progress }) {
  if (progress.passed) {
    return (
      <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300">
        Passed · best κ {progress.bestKappa?.toFixed(2)}
      </span>
    );
  }
  if (progress.attempts) {
    return (
      <span className="rounded-full bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-800 dark:bg-amber-900/30 dark:text-amber-300">
        Not passed yet · {progress.attempts} attempt{progress.attempts === 1 ? '' : 's'} · best κ{' '}
        {(progress.bestKappa ?? 0).toFixed(2)}
      </span>
    );
  }
  return (
    <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-600 dark:bg-gray-700 dark:text-gray-300">
      Not started
    </span>
  );
}

function CreateExercise({
  canvasId,
  transcripts,
  questions,
  canvasCodings,
  onCreated,
}: {
  canvasId: string;
  transcripts: CanvasTranscript[];
  questions: CanvasQuestion[];
  canvasCodings: {
    transcriptId: string;
    questionId: string;
    startOffset: number;
    endOffset: number;
    codedText: string;
  }[];
  onCreated: (name: string) => void;
}) {
  const [name, setName] = useState('');
  const [transcriptId, setTranscriptId] = useState(transcripts[0]?.id ?? '');
  const [instructions, setInstructions] = useState('');
  const [threshold, setThreshold] = useState(70);
  const [gold, setGold] = useState<PadCoding[]>([]);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const transcript = transcripts.find((t) => t.id === transcriptId);
  const existing = canvasCodings.filter((c) => c.transcriptId === transcriptId);

  return (
    <form
      className="space-y-4"
      onSubmit={async (e) => {
        e.preventDefault();
        setFormError(null);
        if (!name.trim() || !transcriptId || gold.length === 0) {
          setFormError('Give the exercise a name, choose a transcript and add at least one coding to the answer key.');
          return;
        }
        setSaving(true);
        try {
          await canvasApi.createTrainingDocument(canvasId, {
            transcriptId,
            name: name.trim(),
            instructions: instructions.trim() || undefined,
            goldCodings: gold,
            passThreshold: threshold / 100,
          });
          onCreated(name.trim());
        } catch (err) {
          setFormError(apiErrorMessage(err, 'Could not create the exercise.'));
        } finally {
          setSaving(false);
        }
      }}
    >
      <div>
        <label htmlFor="training-name" className="label text-sm">
          Exercise name
        </label>
        <input
          id="training-name"
          className="input text-sm"
          maxLength={200}
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. Burnout codebook — practice round 1"
          required
        />
      </div>
      <div>
        <label htmlFor="training-transcript" className="label text-sm">
          Transcript
        </label>
        <select
          id="training-transcript"
          className="input text-sm"
          value={transcriptId}
          onChange={(e) => {
            setTranscriptId(e.target.value);
            setGold([]);
          }}
        >
          {transcripts.map((t) => (
            <option key={t.id} value={t.id}>
              {t.title}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label htmlFor="training-instructions" className="label text-sm">
          Instructions for trainees (optional)
        </label>
        <textarea
          id="training-instructions"
          className="input text-sm"
          rows={2}
          maxLength={5000}
          value={instructions}
          onChange={(e) => setInstructions(e.target.value)}
          placeholder="e.g. Code every mention of workload, even indirect ones."
        />
      </div>
      <div>
        <label htmlFor="training-threshold" className="label text-sm">
          Pass mark (Cohen's κ, as a percentage)
        </label>
        <div className="flex items-center gap-3">
          <input
            id="training-threshold"
            type="number"
            min={0}
            max={100}
            step={5}
            className="input w-24 text-sm"
            value={threshold}
            onChange={(e) => setThreshold(Math.min(100, Math.max(0, Number(e.target.value) || 0)))}
            aria-describedby="training-threshold-help"
          />
          <span id="training-threshold-help" className="text-xs text-gray-500 dark:text-gray-400">
            κ ≥ {(threshold / 100).toFixed(2)} ({kappaBand(threshold / 100)}). 70% is a common bar.
          </span>
        </div>
      </div>

      <fieldset className="rounded-xl border border-gray-200 p-3 dark:border-gray-700">
        <legend className="px-1 text-sm font-semibold text-gray-800 dark:text-gray-100">Answer key</legend>
        <p className="mb-2 text-xs text-gray-600 dark:text-gray-300">
          Code the passages a trained coder should code. The key lives only in this exercise: trainees never see it
          until they pass.
        </p>
        {existing.length > 0 && (
          <div className="mb-3 rounded-lg bg-amber-50 p-2 text-xs text-amber-900 dark:bg-amber-900/20 dark:text-amber-200">
            <button
              type="button"
              className="font-medium underline"
              onClick={() =>
                setGold(
                  existing
                    .filter((c) => questions.some((q) => q.id === c.questionId))
                    .map((c) => ({
                      questionId: c.questionId,
                      startOffset: c.startOffset,
                      endOffset: c.endOffset,
                      codedText: c.codedText,
                    })),
                )
              }
            >
              Start from the {existing.length} coding{existing.length === 1 ? '' : 's'} already on this transcript
            </button>
            <span className="block mt-1">
              Note: anyone who can open this canvas can already see those codings on the canvas. For a blind exercise,
              use a transcript you haven't coded on the canvas and code it here instead.
            </span>
          </div>
        )}
        {transcript ? (
          <TrainingCodingPad
            content={transcript.content}
            questions={questions}
            codings={gold}
            onChange={setGold}
            label={`Transcript: ${transcript.title}`}
          />
        ) : (
          <p className="text-sm text-gray-600">Choose a transcript.</p>
        )}
      </fieldset>

      {formError && (
        <p role="alert" className="rounded-lg bg-red-50 p-2 text-sm text-red-700 dark:bg-red-900/20 dark:text-red-300">
          {formError}
        </p>
      )}
      <div className="flex justify-end">
        <button type="submit" className="btn-primary text-sm" disabled={saving}>
          {saving ? 'Creating…' : `Create exercise (${gold.length} coding${gold.length === 1 ? '' : 's'} in key)`}
        </button>
      </div>
    </form>
  );
}

function AttemptExercise({
  canvasId,
  exercise,
  transcript,
  questions,
  onAnnounce,
}: {
  canvasId: string;
  exercise: Exercise;
  transcript?: CanvasTranscript;
  questions: CanvasQuestion[];
  onAnnounce: (msg: string) => void;
}) {
  const [codings, setCodings] = useState<PadCoding[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<Attempt | null>(null);
  const [error, setError] = useState<string | null>(null);
  const resultRef = useRef<HTMLDivElement>(null);

  if (!transcript) {
    return <p className="text-sm text-gray-600">The transcript for this exercise is no longer on the canvas.</p>;
  }

  const submit = async () => {
    setError(null);
    setSubmitting(true);
    try {
      const res = await canvasApi.submitTrainingAttempt(canvasId, exercise.id, { codings });
      const attempt: Attempt = res.data.data;
      setResult(attempt);
      const k = attempt.kappaScore ?? 0;
      onAnnounce(
        attempt.passed
          ? `Passed. Your κ is ${k.toFixed(2)}, ${kappaBand(k)}. The answer key is now shown.`
          : `Not passed yet. Your κ is ${k.toFixed(2)}; the pass mark is ${exercise.passThreshold.toFixed(2)}.`,
      );
      setTimeout(() => resultRef.current?.focus(), 0);
    } catch (err) {
      setError(apiErrorMessage(err, 'Could not score your attempt. Try again.'));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-4">
      {exercise.instructions && (
        <div className="rounded-lg bg-indigo-50 p-3 text-sm text-indigo-900 dark:bg-indigo-900/20 dark:text-indigo-200">
          <p className="font-medium">Instructions</p>
          <p className="mt-1 whitespace-pre-wrap">{exercise.instructions}</p>
        </div>
      )}
      <p className="text-sm text-gray-600 dark:text-gray-300">
        Code this transcript as you would for the study. You pass at κ ≥ {exercise.passThreshold.toFixed(2)}. The answer
        key stays hidden until you pass.
      </p>
      <TrainingCodingPad
        content={transcript.content}
        questions={questions}
        codings={codings}
        onChange={(next) => {
          setCodings(next);
          setResult(null);
        }}
        label={`Transcript: ${transcript.title}`}
        disabled={submitting}
      />
      {error && (
        <p role="alert" className="rounded-lg bg-red-50 p-2 text-sm text-red-700 dark:bg-red-900/20 dark:text-red-300">
          {error}
        </p>
      )}
      <div className="flex justify-end">
        <button
          type="button"
          className="btn-primary text-sm"
          onClick={submit}
          disabled={submitting || codings.length === 0}
        >
          {submitting ? 'Scoring…' : 'Submit for scoring'}
        </button>
      </div>
      {result && (
        <div
          ref={resultRef}
          tabIndex={-1}
          role="status"
          data-testid="training-result"
          className={`rounded-xl border p-4 text-sm focus:outline-none ${
            result.passed
              ? 'border-emerald-200 bg-emerald-50 text-emerald-900 dark:border-emerald-800 dark:bg-emerald-900/20 dark:text-emerald-200'
              : 'border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-800 dark:bg-amber-900/20 dark:text-amber-200'
          }`}
        >
          <p className="font-semibold">
            {result.passed ? 'Passed' : 'Not passed yet'} — κ = {(result.kappaScore ?? 0).toFixed(2)} (
            {kappaBand(result.kappaScore ?? 0)})
          </p>
          {result.passed && result.goldCodings ? (
            <>
              <p className="mt-1">Here is the answer key next to your codings.</p>
              <Comparison gold={result.goldCodings} mine={result.codings} questions={questions} />
            </>
          ) : (
            <p className="mt-1">
              The pass mark is κ ≥ {exercise.passThreshold.toFixed(2)}. Re-read the code definitions and the
              instructions, adjust your codings above and submit again.
            </p>
          )}
        </div>
      )}
    </div>
  );
}

function ReviewAttempts({
  canvasId,
  exercise,
  questions,
  isOwner,
}: {
  canvasId: string;
  exercise: Exercise;
  questions: CanvasQuestion[];
  isOwner: boolean;
}) {
  const [attempts, setAttempts] = useState<Attempt[] | null>(null);
  const [gold, setGold] = useState<PadCoding[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const [a, d] = await Promise.all([
        canvasApi.getTrainingAttempts(canvasId, exercise.id),
        canvasApi.getTrainingDocument(canvasId, exercise.id),
      ]);
      setAttempts(a.data.data);
      setGold(Array.isArray(d.data.data.goldCodings) ? d.data.data.goldCodings : null);
    } catch (err) {
      setError(apiErrorMessage(err, 'Could not load attempts.'));
    }
  }, [canvasId, exercise.id]);

  useEffect(() => {
    load();
  }, [load]);

  if (error) {
    return (
      <p role="alert" className="text-sm text-red-700">
        {error}{' '}
        <button type="button" className="underline" onClick={load}>
          Try again
        </button>
      </p>
    );
  }
  if (!attempts)
    return <div className="h-24 animate-pulse rounded-lg bg-gray-100 dark:bg-gray-700" aria-label="Loading attempts" />;
  if (attempts.length === 0) {
    return (
      <p className="text-sm text-gray-600 dark:text-gray-300">
        {isOwner ? 'Nobody has attempted this exercise yet.' : "You haven't attempted this exercise yet."}
      </p>
    );
  }
  const current = attempts.find((a) => a.id === selected) ?? null;
  return (
    <div className="space-y-3">
      <table className="w-full text-left text-sm">
        <caption className="sr-only">Attempts at {exercise.name}</caption>
        <thead className="text-xs uppercase text-gray-500">
          <tr>
            {isOwner && (
              <th scope="col" className="py-1">
                Coder
              </th>
            )}
            <th scope="col" className="py-1">
              When
            </th>
            <th scope="col" className="py-1">
              κ
            </th>
            <th scope="col" className="py-1">
              Result
            </th>
            <th scope="col" className="py-1">
              <span className="sr-only">Details</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {attempts.map((a) => (
            <tr key={a.id} className="border-t border-gray-100 dark:border-gray-700">
              {isOwner && <td className="py-1.5">{a.userName ?? '—'}</td>}
              <td className="py-1.5">{new Date(a.createdAt).toLocaleString()}</td>
              <td className="py-1.5">{(a.kappaScore ?? 0).toFixed(2)}</td>
              <td className="py-1.5">{a.passed ? 'Passed' : 'Not passed'}</td>
              <td className="py-1.5">
                <button
                  type="button"
                  className="text-indigo-600 hover:underline"
                  aria-label={`View attempt from ${new Date(a.createdAt).toLocaleString()}`}
                  onClick={() => setSelected(a.id)}
                >
                  View
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {current && (
        <div className="rounded-xl border border-gray-200 p-3 dark:border-gray-700">
          {gold ? (
            <Comparison
              gold={gold}
              mine={current.codings}
              questions={questions}
              mineLabel={isOwner ? 'Coder' : 'You'}
            />
          ) : (
            <>
              <p className="mb-2 text-xs text-gray-600 dark:text-gray-300">
                The answer key is shown once you pass. Your codings in this attempt:
              </p>
              <CodingList title="Your codings" codings={current.codings} questions={questions} />
            </>
          )}
        </div>
      )}
    </div>
  );
}

function CodingList({
  title,
  codings,
  questions,
}: {
  title: string;
  codings: PadCoding[];
  questions: CanvasQuestion[];
}) {
  const q = (id: string) => questions.find((x) => x.id === id);
  return (
    <div>
      <h5 className="text-xs font-semibold uppercase text-gray-500">
        {title} ({codings.length})
      </h5>
      <ul className="mt-1 max-h-64 space-y-1 overflow-y-auto">
        {codings.map((c, i) => (
          <li key={i} className="rounded border border-gray-200 p-1.5 text-xs dark:border-gray-700">
            <span className="font-medium" style={{ color: q(c.questionId)?.color }}>
              {q(c.questionId)?.text ?? 'Deleted code'}
            </span>{' '}
            <span className="text-gray-600 dark:text-gray-300">“{c.codedText}”</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function Comparison({
  gold,
  mine,
  questions,
  mineLabel = 'You',
}: {
  gold: PadCoding[];
  mine: PadCoding[];
  questions: CanvasQuestion[];
  mineLabel?: string;
}) {
  return (
    <div className="mt-2 grid gap-3 sm:grid-cols-2" data-testid="training-comparison">
      <CodingList title="Answer key" codings={gold} questions={questions} />
      <CodingList title={mineLabel} codings={mine} questions={questions} />
    </div>
  );
}
