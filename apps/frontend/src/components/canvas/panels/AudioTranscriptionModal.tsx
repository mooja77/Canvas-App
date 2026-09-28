import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import toast from 'react-hot-toast';
import { canvasApi } from '../../../services/api';
import { useCanvasStore, useActiveCanvasId, useIsViewer } from '../../../stores/canvasStore';
import { useEscapeToClose } from '../../../hooks/useEscapeToClose';
import { useFocusTrap } from '../../../hooks/useFocusTrap';
import { useAiConfigStore } from '../../../stores/aiConfigStore';
import { apiErrorCode, apiErrorMessage, formatBytes } from './featureScreenUtils';

/**
 * Audio upload + transcription screen.
 *
 * Upload a recording, start a transcription job, watch it, and add the result
 * to the canvas as a transcript. There are no included minutes: every recording
 * is transcribed on a customer's own OpenAI key (backend utils/aiKeys.ts). The
 * panel at the top says whose key will pay, and when there is none it says
 * "Connect your AI account to transcribe" with a button that opens the wizard.
 */

interface Allowance {
  plan: string;
  fileUploadEnabled: boolean;
  maxUploadMb: number;
  emailAccount: boolean;
  /** Whose own OpenAI key pays: the researcher's, the canvas owner's (shared), or none. */
  keySource: 'own' | 'canvas-owner' | null;
  isCanvasOwner: boolean;
  canvasOwnerName: string | null;
  ownerHasOpenAiKey: boolean;
  ownerSharesKey: boolean;
  usageThisMonth: { minutes: number; estimatedCostUsd: number } | null;
  pricePerMinuteUsd: number;
}

interface JobRow {
  id: string;
  status: 'queued' | 'processing' | 'completed' | 'failed';
  progress: number;
  errorMessage: string | null;
  language: string | null;
  createdAt: string;
  fileName: string;
  sizeBytes: number;
  transcriptId: string | null;
  fileUploadId?: string;
}

const ACCEPTED = '.mp3,.wav,.m4a,.mp4,.ogg,.oga,.webm,.flac,audio/*,video/mp4,video/webm';
const LANGUAGES: [string, string][] = [
  ['', 'Detect automatically'],
  ['en', 'English'],
  ['ga', 'Irish'],
  ['es', 'Spanish'],
  ['fr', 'French'],
  ['de', 'German'],
  ['pt', 'Portuguese'],
  ['it', 'Italian'],
  ['nl', 'Dutch'],
  ['pl', 'Polish'],
  ['zh', 'Chinese'],
  ['ja', 'Japanese'],
  ['ko', 'Korean'],
  ['ar', 'Arabic'],
];
const PLAN_NAMES: Record<string, string> = { free: 'Free', student: 'Student', pro: 'Pro', team: 'Team' };

type Phase = { kind: 'idle' } | { kind: 'uploading'; pct: number; name: string } | { kind: 'starting'; name: string };

export default function AudioTranscriptionModal({ onClose }: { onClose: () => void }) {
  const canvasId = useActiveCanvasId();
  const isViewer = useIsViewer();
  const refreshCanvas = useCanvasStore((s) => s.refreshCanvas);
  const dialogRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  // Inactive while the wizard is on top, so the wizard owns focus and Esc.
  const wizardOpen = useAiConfigStore((s) => s.wizard.open);
  const openWizard = useAiConfigStore((s) => s.openWizard);
  const connectAi = useCallback(() => openWizard('Audio transcription', 'openai'), [openWizard]);
  useFocusTrap(dialogRef, !wizardOpen);
  useEscapeToClose(wizardOpen ? () => undefined : onClose);

  const [allowance, setAllowance] = useState<Allowance | null>(null);
  const [allowanceError, setAllowanceError] = useState<string | null>(null);
  const [jobs, setJobs] = useState<JobRow[] | null>(null);
  const [jobsError, setJobsError] = useState<string | null>(null);
  const [language, setLanguage] = useState('');
  const [phase, setPhase] = useState<Phase>({ kind: 'idle' });
  const [uploadError, setUploadError] = useState<{ message: string; needsKey: boolean } | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [titles, setTitles] = useState<Record<string, string>>({});
  const [accepting, setAccepting] = useState<string | null>(null);
  const [announcement, setAnnouncement] = useState('');
  // Map job -> uploaded file, so a failed job can be retried without re-uploading.
  const fileByJob = useRef<Record<string, string>>({});
  const lastStatus = useRef<Record<string, string>>({});

  const loadAllowance = useCallback(async () => {
    if (!canvasId) return;
    setAllowanceError(null);
    try {
      const res = await canvasApi.getTranscriptionAllowance(canvasId);
      setAllowance(res.data.data);
    } catch (err) {
      setAllowanceError(apiErrorMessage(err, 'Could not load your transcription allowance.'));
    }
  }, [canvasId]);

  const loadJobs = useCallback(async () => {
    if (!canvasId) return;
    try {
      const res = await canvasApi.listTranscriptionJobs(canvasId);
      const rows: JobRow[] = res.data.data;
      setJobsError(null);
      setJobs(rows);
      // Announce status changes to screen-reader users.
      for (const job of rows) {
        const prev = lastStatus.current[job.id];
        if (prev && prev !== job.status) {
          if (job.status === 'completed') setAnnouncement(`Transcription of ${job.fileName} is ready to add.`);
          if (job.status === 'failed') setAnnouncement(`Transcription of ${job.fileName} failed.`);
        }
        lastStatus.current[job.id] = job.status;
      }
    } catch (err) {
      setJobsError(apiErrorMessage(err, 'Could not load recent transcriptions.'));
    }
  }, [canvasId]);

  useEffect(() => {
    loadAllowance();
    loadJobs();
  }, [loadAllowance, loadJobs]);
  // The wizard opens on top of this screen; re-check the key when it closes.
  const wizardWasOpen = useRef(false);
  useEffect(() => {
    if (wizardWasOpen.current && !wizardOpen) {
      setUploadError(null);
      loadAllowance();
    }
    wizardWasOpen.current = wizardOpen;
  }, [wizardOpen, loadAllowance]);

  // Poll while anything is still running.
  const active = (jobs ?? []).some((j) => j.status === 'queued' || j.status === 'processing');
  useEffect(() => {
    if (!active) return;
    const t = setInterval(() => {
      loadJobs();
    }, 2000);
    return () => clearInterval(t);
  }, [active, loadJobs]);
  // Refresh usage once a job finishes (minutes are recorded then).
  const wasActive = useRef(false);
  useEffect(() => {
    if (wasActive.current && !active) loadAllowance();
    wasActive.current = active;
  }, [active, loadAllowance]);

  const startJob = useCallback(
    async (fileUploadId: string, name: string) => {
      if (!canvasId) return;
      setPhase({ kind: 'starting', name });
      try {
        const res = await canvasApi.startTranscription(canvasId, { fileUploadId, language: language || undefined });
        fileByJob.current[res.data.data.jobId] = fileUploadId;
        setAnnouncement(`Transcription of ${name} started.`);
        await loadJobs();
      } catch (err) {
        const code = apiErrorCode(err);
        setUploadError({
          message: apiErrorMessage(err, 'Could not start the transcription. Try again.'),
          needsKey: code === 'TRANSCRIPTION_KEY_REQUIRED',
        });
        if (code === 'TRANSCRIPTION_IN_PROGRESS') await loadJobs();
      } finally {
        setPhase({ kind: 'idle' });
      }
    },
    [canvasId, language, loadJobs],
  );

  const handleFile = useCallback(
    async (file: File) => {
      if (!canvasId || !allowance) return;
      setUploadError(null);
      if (file.size > allowance.maxUploadMb * 1024 * 1024) {
        setUploadError({
          message: `${file.name} is ${formatBytes(file.size)}. The limit is ${allowance.maxUploadMb} MB — split or compress the recording first.`,
          needsKey: false,
        });
        return;
      }
      setPhase({ kind: 'uploading', pct: 0, name: file.name });
      let uploadedId: string;
      try {
        const form = new FormData();
        form.append('file', file);
        const res = await canvasApi.uploadFileDirect(canvasId, form, (pct) =>
          setPhase({ kind: 'uploading', pct, name: file.name }),
        );
        uploadedId = res.data.data.id;
      } catch (err) {
        setPhase({ kind: 'idle' });
        setUploadError({
          message: apiErrorMessage(err, 'Upload failed. Check your connection and try again.'),
          needsKey: false,
        });
        return;
      }
      await startJob(uploadedId, file.name);
    },
    [canvasId, allowance, startJob],
  );

  const retry = useCallback(
    async (job: JobRow) => {
      const fileUploadId = fileByJob.current[job.id] ?? job.fileUploadId;
      if (!fileUploadId) {
        fileInputRef.current?.click();
        return;
      }
      await startJob(fileUploadId, job.fileName);
    },
    [startJob],
  );

  const accept = useCallback(
    async (job: JobRow) => {
      if (!canvasId) return;
      setAccepting(job.id);
      try {
        const title = (titles[job.id] ?? job.fileName.replace(/\.[^.]+$/, '')).trim();
        await canvasApi.acceptTranscription(canvasId, job.id, title || undefined);
        await refreshCanvas();
        toast.success('Transcript added to the canvas');
        setAnnouncement(`${title || job.fileName} was added to the canvas as a transcript.`);
        await loadJobs();
      } catch (err) {
        toast.error(apiErrorMessage(err, 'Could not add the transcript.'));
      } finally {
        setAccepting(null);
      }
    },
    [canvasId, titles, refreshCanvas, loadJobs],
  );

  const busy = phase.kind !== 'idle';
  const blockedByPlan = allowance !== null && !allowance.fileUploadEnabled;
  const needsKey = allowance !== null && allowance.keySource === null;
  const canUpload = !isViewer && allowance !== null && !blockedByPlan && !needsKey && !busy;

  return createPortal(
    <div className="modal-backdrop fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="audio-transcription-title"
        aria-describedby="audio-transcription-intro"
        className="modal-content w-full max-w-2xl rounded-2xl bg-white shadow-xl ring-1 ring-black/5 dark:bg-gray-800 max-h-[90vh] flex flex-col"
      >
        <div className="flex items-start justify-between border-b border-gray-200 px-5 py-4 dark:border-gray-700">
          <div>
            <h2 id="audio-transcription-title" className="text-base font-semibold text-gray-900 dark:text-gray-100">
              Transcribe audio
            </h2>
            <p id="audio-transcription-intro" className="mt-0.5 text-sm text-gray-500 dark:text-gray-400">
              Turn an interview recording into a timestamped transcript you can code.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-gray-700 dark:hover:text-gray-300"
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

        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
          {/* Allowance */}
          <section aria-labelledby="transcription-allowance-heading">
            <h3 id="transcription-allowance-heading" className="sr-only">
              Your transcription allowance
            </h3>
            {allowanceError ? (
              <div
                role="alert"
                className="rounded-lg bg-red-50 p-3 text-sm text-red-700 dark:bg-red-900/20 dark:text-red-300"
              >
                {allowanceError}{' '}
                <button type="button" onClick={loadAllowance} className="font-medium underline">
                  Try again
                </button>
              </div>
            ) : !allowance ? (
              <div
                className="h-14 animate-pulse rounded-lg bg-gray-100 dark:bg-gray-700"
                aria-label="Loading your allowance"
              />
            ) : (
              <AllowancePanel allowance={allowance} onConnect={connectAi} />
            )}
          </section>

          {/* Upload */}
          {!isViewer && allowance && !blockedByPlan && (
            <section aria-labelledby="transcription-upload-heading" className="space-y-3">
              <h3 id="transcription-upload-heading" className="text-sm font-semibold text-gray-800 dark:text-gray-200">
                Upload a recording
              </h3>
              <div
                className={`flex flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed px-4 py-6 text-center transition-colors ${
                  dragOver
                    ? 'border-indigo-400 bg-indigo-50 dark:border-indigo-500 dark:bg-indigo-900/20'
                    : 'border-gray-200 dark:border-gray-700'
                }`}
                onDragOver={(e) => {
                  e.preventDefault();
                  if (canUpload) setDragOver(true);
                }}
                onDragLeave={() => setDragOver(false)}
                onDrop={(e) => {
                  e.preventDefault();
                  setDragOver(false);
                  const file = e.dataTransfer.files[0];
                  if (file && canUpload) handleFile(file);
                }}
              >
                {phase.kind === 'uploading' ? (
                  <div className="w-full max-w-xs space-y-2">
                    <p className="text-sm text-gray-600 dark:text-gray-300">Uploading {phase.name}…</p>
                    <div
                      role="progressbar"
                      aria-label={`Uploading ${phase.name}`}
                      aria-valuemin={0}
                      aria-valuemax={100}
                      aria-valuenow={phase.pct}
                      className="h-2 w-full rounded-full bg-gray-100 dark:bg-gray-700"
                    >
                      <div
                        className="h-2 rounded-full bg-indigo-500 transition-all"
                        style={{ width: `${phase.pct}%` }}
                      />
                    </div>
                  </div>
                ) : phase.kind === 'starting' ? (
                  <p className="text-sm text-gray-600 dark:text-gray-300">Starting transcription of {phase.name}…</p>
                ) : (
                  <>
                    <p className="text-sm text-gray-600 dark:text-gray-300">Drag a recording here, or</p>
                    <button
                      type="button"
                      className="btn-primary px-3 py-1.5 text-sm"
                      disabled={!canUpload}
                      onClick={() => fileInputRef.current?.click()}
                    >
                      Choose a recording
                    </button>
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      MP3, WAV, M4A, MP4, OGG, WEBM or FLAC, up to {allowance.maxUploadMb} MB.
                    </p>
                  </>
                )}
                <input
                  ref={fileInputRef}
                  type="file"
                  accept={ACCEPTED}
                  className="sr-only"
                  tabIndex={-1}
                  aria-hidden="true"
                  data-testid="audio-file-input"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    e.target.value = '';
                    if (file) handleFile(file);
                  }}
                />
              </div>
              <div>
                <label htmlFor="transcription-language" className="label text-xs">
                  Spoken language
                </label>
                <select
                  id="transcription-language"
                  value={language}
                  onChange={(e) => setLanguage(e.target.value)}
                  className="input text-sm"
                  disabled={busy}
                >
                  {LANGUAGES.map(([code, name]) => (
                    <option key={code} value={code}>
                      {name}
                    </option>
                  ))}
                </select>
              </div>
              {uploadError && (
                <div
                  role="alert"
                  className="rounded-lg bg-red-50 p-3 text-sm text-red-700 dark:bg-red-900/20 dark:text-red-300"
                >
                  {uploadError.message}
                  {uploadError.needsKey && (
                    <>
                      {' '}
                      <button type="button" onClick={connectAi} className="font-medium underline">
                        Connect your AI account
                      </button>
                    </>
                  )}
                </div>
              )}
            </section>
          )}

          {/* Jobs */}
          <section aria-labelledby="transcription-jobs-heading">
            <h3 id="transcription-jobs-heading" className="mb-2 text-sm font-semibold text-gray-800 dark:text-gray-200">
              Recent transcriptions
            </h3>
            {jobsError ? (
              <div
                role="alert"
                className="rounded-lg bg-red-50 p-3 text-sm text-red-700 dark:bg-red-900/20 dark:text-red-300"
              >
                {jobsError}{' '}
                <button type="button" onClick={loadJobs} className="font-medium underline">
                  Try again
                </button>
              </div>
            ) : jobs === null ? (
              <div
                className="h-16 animate-pulse rounded-lg bg-gray-100 dark:bg-gray-700"
                aria-label="Loading transcriptions"
              />
            ) : jobs.length === 0 ? (
              <div className="rounded-xl border border-gray-200 p-4 text-sm text-gray-600 dark:border-gray-700 dark:text-gray-300">
                <p className="font-medium text-gray-800 dark:text-gray-100">
                  No recordings transcribed on this canvas yet.
                </p>
                <p className="mt-1">
                  Transcribing keeps you close to the data: each transcript arrives with timestamps, so you can code it
                  straight away and go back to the moment in the recording.
                </p>
                <p className="mt-2">
                  Already have a transcript from Zoom, Teams or Otter? Close this and use{' '}
                  <strong>Add transcript → Upload File</strong> — caption (.vtt, .srt) and document files import without
                  using any minutes.
                </p>
              </div>
            ) : (
              <ul className="space-y-2">
                {jobs.map((job) => (
                  <li
                    key={job.id}
                    className="rounded-xl border border-gray-200 p-3 dark:border-gray-700"
                    data-testid="transcription-job"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <p
                        className="min-w-0 truncate text-sm font-medium text-gray-800 dark:text-gray-100"
                        title={job.fileName}
                      >
                        {job.fileName}
                      </p>
                      <StatusBadge status={job.status} added={Boolean(job.transcriptId)} />
                    </div>
                    {(job.status === 'queued' || job.status === 'processing') && (
                      <div
                        role="progressbar"
                        aria-label={`Transcribing ${job.fileName}`}
                        aria-valuemin={0}
                        aria-valuemax={100}
                        aria-valuenow={Math.round(job.progress)}
                        className="mt-2 h-1.5 w-full rounded-full bg-gray-100 dark:bg-gray-700"
                      >
                        <div
                          className="h-1.5 rounded-full bg-indigo-500 transition-all"
                          style={{ width: `${job.progress}%` }}
                        />
                      </div>
                    )}
                    {job.status === 'failed' && (
                      <div className="mt-2 text-sm text-red-700 dark:text-red-300">
                        <p>{job.errorMessage || 'Transcription failed.'}</p>
                        {!isViewer && (
                          <button
                            type="button"
                            className="mt-1 font-medium underline"
                            onClick={() => retry(job)}
                            disabled={busy}
                          >
                            Try again
                          </button>
                        )}
                      </div>
                    )}
                    {job.status === 'completed' && !job.transcriptId && !isViewer && (
                      <div className="mt-2 flex flex-wrap items-end gap-2">
                        <div className="min-w-[12rem] flex-1">
                          <label htmlFor={`title-${job.id}`} className="label text-xs">
                            Transcript title
                          </label>
                          <input
                            id={`title-${job.id}`}
                            className="input text-sm"
                            maxLength={200}
                            value={titles[job.id] ?? job.fileName.replace(/\.[^.]+$/, '')}
                            onChange={(e) => setTitles((t) => ({ ...t, [job.id]: e.target.value }))}
                          />
                        </div>
                        <button
                          type="button"
                          className="btn-primary px-3 py-2 text-sm"
                          onClick={() => accept(job)}
                          disabled={accepting === job.id}
                        >
                          {accepting === job.id ? 'Adding…' : 'Add to canvas'}
                        </button>
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
        <div aria-live="polite" className="sr-only">
          {announcement}
        </div>
      </div>
    </div>,
    document.body,
  );
}

function StatusBadge({ status, added }: { status: JobRow['status']; added: boolean }) {
  const map: Record<string, [string, string]> = {
    queued: ['Waiting', 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-200'],
    processing: ['Transcribing', 'bg-indigo-50 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300'],
    completed: added
      ? ['Added to canvas', 'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300']
      : ['Ready to add', 'bg-amber-50 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300'],
    failed: ['Failed', 'bg-red-50 text-red-700 dark:bg-red-900/30 dark:text-red-300'],
  };
  const [label, cls] = map[status] ?? [status, 'bg-gray-100 text-gray-700'];
  return <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${cls}`}>{label}</span>;
}

function AllowancePanel({ allowance, onConnect }: { allowance: Allowance; onConnect: () => void }) {
  const planName = PLAN_NAMES[allowance.plan] ?? allowance.plan;
  const box = 'rounded-lg p-3 text-sm';
  if (!allowance.fileUploadEnabled) {
    return (
      <div
        className={`${box} bg-indigo-50 text-indigo-900 dark:bg-indigo-900/20 dark:text-indigo-200`}
        data-testid="transcription-plan-gate"
      >
        <p className="font-medium">Audio transcription isn't included in the {planName} plan.</p>
        <p className="mt-1">
          Student, Pro and Team can upload recordings and transcribe them on their own OpenAI account.{' '}
          <a href="/pricing" className="font-medium underline">
            Compare plans
          </a>
        </p>
      </div>
    );
  }
  const price = `$${allowance.pricePerMinuteUsd} a minute`;
  const usage = allowance.usageThisMonth;
  if (allowance.keySource === 'own') {
    return (
      <div
        className={`${box} bg-emerald-50 text-emerald-900 dark:bg-emerald-900/20 dark:text-emerald-200`}
        data-testid="transcription-own-key"
      >
        Transcribing on your own OpenAI account. OpenAI bills you directly ({price}).
        {usage && usage.minutes > 0 && (
          <>
            {' '}
            This month: {usage.minutes} min, about ${usage.estimatedCostUsd.toFixed(2)}.
          </>
        )}
      </div>
    );
  }
  if (allowance.keySource === 'canvas-owner') {
    const owner = allowance.canvasOwnerName || 'the canvas owner';
    return (
      <div
        className={`${box} bg-sky-50 text-sky-900 dark:bg-sky-900/20 dark:text-sky-200`}
        data-testid="transcription-owner-key"
      >
        <p>
          Transcriptions here use <strong>{owner}&apos;s</strong> OpenAI key, which they share with collaborators.
          OpenAI bills {owner} ({price}), and they can see the minutes you use.
        </p>
        <p className="mt-1">
          Prefer to pay yourself?{' '}
          <button type="button" onClick={onConnect} className="font-medium underline">
            Connect your own AI account
          </button>
        </p>
      </div>
    );
  }
  if (!allowance.emailAccount) {
    return (
      <div
        className={`${box} bg-amber-50 text-amber-900 dark:bg-amber-900/20 dark:text-amber-200`}
        data-testid="transcription-needs-key"
      >
        <p className="font-medium">Connect your AI account to transcribe</p>
        <p className="mt-1">
          First link an email address to this access-code account in{' '}
          <a href="/account" className="font-medium underline">
            Account
          </a>
          , then connect your OpenAI key.
        </p>
      </div>
    );
  }
  return (
    <div
      className={`${box} bg-amber-50 text-amber-900 dark:bg-amber-900/20 dark:text-amber-200`}
      data-testid="transcription-needs-key"
    >
      <p className="font-medium">Connect your AI account to transcribe</p>
      <p className="mt-1">
        Transcription runs on your own OpenAI account, and OpenAI bills you directly ({price}, about $
        {(allowance.pricePerMinuteUsd * 60).toFixed(2)} for an hour of audio).
        {!allowance.isCanvasOwner &&
          allowance.ownerHasOpenAiKey &&
          ' The canvas owner has an OpenAI key but has not shared it with collaborators. Ask them to, or connect your own.'}
      </p>
      <button type="button" onClick={onConnect} className="btn-primary mt-2 px-3 py-1.5 text-sm">
        Connect your AI account
      </button>
    </div>
  );
}
