import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Link } from 'react-router-dom';
import { aiSettingsApi } from '../../services/api';
import { useAiConfigStore } from '../../stores/aiConfigStore';
import { useAuthStore } from '../../stores/authStore';
import { useEscapeToClose } from '../../hooks/useEscapeToClose';
import { useFocusTrap } from '../../hooks/useFocusTrap';
import {
  GPT4O_INPUT_USD_PER_M,
  GPT4O_OUTPUT_USD_PER_M,
  OPENAI_PRICES_CHECKED,
  OPENAI_PRICING_URL,
  PROVIDERS,
  WHISPER_USD_PER_MINUTE,
  providerGuide,
  type AiProviderId,
} from './aiProviders';

/**
 * "Connect your AI account" — a step-by-step guide to creating a key with the
 * researcher's own AI provider, testing it and saving it. QualCanvas never
 * supplies a paid AI key: every AI feature, transcription included, runs on
 * the key connected here and the provider bills the researcher directly.
 *
 * Steps: 1 How it works (cost) · 2 Provider · 3 Create a key · 4 Test the key
 * · 5 Connected (security + spending limit).
 */

const STEPS = ['How it works', 'Choose a provider', 'Create a key', 'Test your key', 'Connected'] as const;
type Step = 0 | 1 | 2 | 3 | 4;

const link = 'font-medium text-indigo-700 underline hover:no-underline dark:text-indigo-300';

function ExternalLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <a href={href} target="_blank" rel="noopener noreferrer" className={link}>
      {children}
      <span className="sr-only"> (opens in a new tab)</span>
    </a>
  );
}

interface Props {
  onClose: () => void;
  /** What the user was trying to do, e.g. "Audio transcription". */
  reason?: string | null;
  /** Start on this provider (transcription opens straight on OpenAI). */
  initialProvider?: AiProviderId | null;
  /** Called after a key was tested and saved. */
  onConnected?: (provider: AiProviderId) => void;
}

export default function ConnectAiWizard({ onClose, reason, initialProvider, onConnected }: Props) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);
  useFocusTrap(dialogRef);
  useEscapeToClose(onClose);
  const emailAuthed = useAuthStore((s) => s.authType) === 'email';
  const setConfigured = useAiConfigStore((s) => s.setConfigured);

  const [step, setStep] = useState<Step>(0);
  const [providerId, setProviderId] = useState<AiProviderId>(initialProvider ?? 'openai');
  const [apiKey, setApiKey] = useState('');
  const [model, setModel] = useState('');
  const [showKey, setShowKey] = useState(false);
  const [testing, setTesting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const provider = providerGuide(providerId);
  const transcriptionReason = Boolean(reason && /transcri/i.test(reason));

  // Move focus to the new step's heading so screen readers announce it.
  useEffect(() => {
    headingRef.current?.focus();
  }, [step]);

  const go = (next: Step) => {
    setError(null);
    setStep(next);
  };

  const test = async () => {
    const key = apiKey.trim();
    if (!key) {
      setError(`Paste your ${provider.name} key first.`);
      return;
    }
    setTesting(true);
    setError(null);
    try {
      await aiSettingsApi.updateSettings({ provider: providerId, apiKey: key, model: model.trim() || undefined });
      setConfigured(true, providerId);
      setApiKey('');
      onConnected?.(providerId);
      go(4);
    } catch (err) {
      const data = (err as { response?: { status?: number; data?: { error?: string } } })?.response;
      setError(
        data?.data?.error ||
          (data?.status === 429
            ? 'Too many attempts. Wait 15 minutes and try again.'
            : 'We could not test the key. Check your connection and try again. Nothing was saved.'),
      );
    } finally {
      setTesting(false);
    }
  };

  const heading = emailAuthed ? STEPS[step] : 'Email account required';

  return createPortal(
    <div className="modal-backdrop fixed inset-0 z-[9999] flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="connect-ai-title"
        aria-describedby="connect-ai-subtitle"
        className="modal-content flex max-h-[90vh] w-full max-w-lg flex-col overflow-hidden rounded-2xl bg-white shadow-2xl ring-1 ring-black/5 dark:bg-gray-900"
      >
        <div className="border-b border-gray-200 px-6 py-4 dark:border-gray-700">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 id="connect-ai-title" className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                Connect your AI account
              </h2>
              <p id="connect-ai-subtitle" className="mt-0.5 text-sm text-gray-600 dark:text-gray-400">
                {reason
                  ? `${reason} runs on your own AI account. This takes about 5 minutes.`
                  : 'AI features run on your own AI account. This takes about 5 minutes.'}
              </p>
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close"
              className="rounded p-1 text-gray-500 hover:bg-gray-100 hover:text-gray-700 dark:hover:bg-gray-800 dark:hover:text-gray-200"
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
          {emailAuthed && (
            <ol aria-label="Progress" className="mt-3 flex flex-wrap gap-x-3 gap-y-1 text-xs">
              {STEPS.map((label, i) => (
                <li
                  key={label}
                  aria-current={i === step ? 'step' : undefined}
                  className={
                    i === step
                      ? 'font-semibold text-indigo-700 dark:text-indigo-300'
                      : i < step
                        ? 'text-gray-700 dark:text-gray-300'
                        : 'text-gray-500 dark:text-gray-400'
                  }
                >
                  {i + 1}. {label}
                  {i < step && <span className="sr-only"> (done)</span>}
                </li>
              ))}
            </ol>
          )}
        </div>

        <div className="flex-1 space-y-4 overflow-y-auto px-6 py-5 text-sm text-gray-700 dark:text-gray-300">
          <h3
            ref={headingRef}
            tabIndex={-1}
            className="text-base font-semibold text-gray-900 outline-none dark:text-gray-100"
            data-testid="connect-ai-step"
          >
            {heading}
          </h3>

          {!emailAuthed && (
            <div className="space-y-3">
              <p>
                Your AI key is saved to an email account, and you are signed in with an access code. Link an email
                address first, then come back here.
              </p>
              <Link to="/account" onClick={onClose} className="btn-primary inline-flex px-3 py-1.5 text-sm">
                Link your email account
              </Link>
            </div>
          )}

          {emailAuthed && step === 0 && (
            <div className="space-y-3">
              <p>
                QualCanvas&apos;s AI features, such as audio transcription, code suggestions, auto-coding and summaries,
                run on <strong>your own account with an AI provider</strong>. You connect it once with a key, which is
                like a password that lets QualCanvas ask the provider to do the work for you.
              </p>
              <p>
                <strong>You pay the provider directly</strong>, only for what you use. QualCanvas never charges for AI
                and never sees your provider bill.
              </p>
              <div className="rounded-lg bg-gray-50 p-3 dark:bg-gray-800">
                <p className="font-medium text-gray-900 dark:text-gray-100">What it costs with OpenAI</p>
                <ul className="mt-1 list-disc space-y-1 pl-5">
                  <li>
                    Transcription (Whisper): ${WHISPER_USD_PER_MINUTE} a minute, so a one-hour interview costs about $
                    {(WHISPER_USD_PER_MINUTE * 60).toFixed(2)}.
                  </li>
                  <li>
                    Text AI (GPT-4o): ${GPT4O_INPUT_USD_PER_M.toFixed(2)} per million word pieces (tokens) sent and $
                    {GPT4O_OUTPUT_USD_PER_M.toFixed(2)} per million returned. A million tokens is roughly 750,000 words.
                  </li>
                </ul>
                <p className="mt-2 text-xs text-gray-600 dark:text-gray-400">
                  From <ExternalLink href={OPENAI_PRICING_URL}>OpenAI&apos;s pricing page</ExternalLink>, checked{' '}
                  {OPENAI_PRICES_CHECKED}. Prices can change; that page is always the latest.
                </p>
              </div>
              <div className="flex justify-end">
                <button type="button" className="btn-primary px-4 py-2 text-sm" onClick={() => go(1)}>
                  Get started
                </button>
              </div>
            </div>
          )}

          {emailAuthed && step === 1 && (
            <fieldset className="space-y-2">
              <legend className="mb-1">Which AI provider do you want to use?</legend>
              {PROVIDERS.map((p) => (
                <label
                  key={p.id}
                  className={`flex cursor-pointer items-start gap-3 rounded-lg border p-3 ${
                    providerId === p.id
                      ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-900/20'
                      : 'border-gray-200 dark:border-gray-700'
                  }`}
                >
                  <input
                    type="radio"
                    name="ai-provider"
                    value={p.id}
                    checked={providerId === p.id}
                    onChange={() => setProviderId(p.id)}
                    className="mt-1"
                  />
                  <span>
                    <span className="font-medium text-gray-900 dark:text-gray-100">
                      {p.name}
                      {p.id === 'openai' && ' (recommended)'}
                    </span>
                    <span className="block text-xs text-gray-600 dark:text-gray-400">{p.tagline}</span>
                  </span>
                </label>
              ))}
              {transcriptionReason && providerId !== 'openai' && (
                <p
                  role="note"
                  className="rounded-lg bg-amber-50 p-2 text-amber-900 dark:bg-amber-900/20 dark:text-amber-200"
                >
                  Transcription only works with an OpenAI key. Choose OpenAI to transcribe recordings.
                </p>
              )}
              <div className="flex justify-between pt-2">
                <button type="button" className="btn-secondary px-3 py-2 text-sm" onClick={() => go(0)}>
                  Back
                </button>
                <button type="button" className="btn-primary px-4 py-2 text-sm" onClick={() => go(2)}>
                  Next
                </button>
              </div>
            </fieldset>
          )}

          {emailAuthed && step === 2 && (
            <div className="space-y-3">
              <p>Follow these steps in a new tab, then come back here with your key.</p>
              <ol className="list-decimal space-y-2 pl-5" data-testid="connect-ai-steps">
                {provider.steps.map((s) => (
                  <li key={s.text}>
                    {s.text}
                    {s.link && (
                      <>
                        {' '}
                        <ExternalLink href={s.link.href}>{s.link.label}</ExternalLink>
                      </>
                    )}
                  </li>
                ))}
              </ol>
              <p className="rounded-lg bg-indigo-50 p-2 text-indigo-900 dark:bg-indigo-900/20 dark:text-indigo-200">
                Tip: a spending limit in your {provider.name} dashboard is the simplest way to stay in control.
              </p>
              <div className="flex justify-between pt-2">
                <button type="button" className="btn-secondary px-3 py-2 text-sm" onClick={() => go(1)}>
                  Back
                </button>
                <button type="button" className="btn-primary px-4 py-2 text-sm" onClick={() => go(3)}>
                  I have my key
                </button>
              </div>
            </div>
          )}

          {emailAuthed && step === 3 && (
            <form
              className="space-y-3"
              onSubmit={(e) => {
                e.preventDefault();
                test();
              }}
              aria-busy={testing}
            >
              <p>
                Paste your {provider.name} key. We check it with a free request to {provider.name} (it uses no credit)
                before saving anything.
              </p>
              <div>
                <label htmlFor="connect-ai-key" className="label text-xs">
                  {provider.name} API key
                </label>
                <div className="relative">
                  <input
                    id="connect-ai-key"
                    type={showKey ? 'text' : 'password'}
                    value={apiKey}
                    onChange={(e) => setApiKey(e.target.value)}
                    placeholder={`${provider.keyPrefix}…`}
                    autoComplete="off"
                    spellCheck={false}
                    aria-invalid={Boolean(error)}
                    aria-describedby={error ? 'connect-ai-error' : undefined}
                    className="input pr-16 text-sm"
                    disabled={testing}
                  />
                  <button
                    type="button"
                    onClick={() => setShowKey((v) => !v)}
                    aria-pressed={showKey}
                    className="absolute right-2 top-1/2 -translate-y-1/2 rounded px-1.5 text-xs text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-800"
                  >
                    {showKey ? 'Hide' : 'Show'}
                  </button>
                </div>
              </div>
              <details className="text-xs">
                <summary className="cursor-pointer text-gray-600 dark:text-gray-400">Advanced: choose a model</summary>
                <label htmlFor="connect-ai-model" className="label mt-2 text-xs">
                  Model (optional, default {provider.defaultModel})
                </label>
                <input
                  id="connect-ai-model"
                  type="text"
                  value={model}
                  onChange={(e) => setModel(e.target.value)}
                  placeholder={provider.defaultModel}
                  className="input text-sm"
                  disabled={testing}
                />
              </details>
              {testing && (
                <p role="status" className="text-gray-600 dark:text-gray-400" data-testid="connect-ai-testing">
                  Testing your key with {provider.name}…
                </p>
              )}
              {error && (
                <div
                  id="connect-ai-error"
                  role="alert"
                  className="rounded-lg bg-red-50 p-3 text-red-800 dark:bg-red-900/20 dark:text-red-200"
                  data-testid="connect-ai-error"
                >
                  <p className="font-medium">That key didn&apos;t work.</p>
                  <p className="mt-1">{error}</p>
                </div>
              )}
              <div className="flex justify-between pt-2">
                <button
                  type="button"
                  className="btn-secondary px-3 py-2 text-sm"
                  onClick={() => go(2)}
                  disabled={testing}
                >
                  Back
                </button>
                <button type="submit" className="btn-primary px-4 py-2 text-sm" disabled={testing || !apiKey.trim()}>
                  {testing ? 'Testing…' : 'Test and save key'}
                </button>
              </div>
            </form>
          )}

          {emailAuthed && step === 4 && (
            <div className="space-y-3" data-testid="connect-ai-success">
              <p
                role="status"
                className="rounded-lg bg-emerald-50 p-3 text-emerald-900 dark:bg-emerald-900/20 dark:text-emerald-200"
              >
                <strong>Your {provider.name} account is connected.</strong>{' '}
                {provider.transcription
                  ? 'AI features and audio transcription are ready to use.'
                  : 'Text AI features are ready. To transcribe recordings, connect an OpenAI key instead.'}
              </p>
              <div>
                <p className="font-medium text-gray-900 dark:text-gray-100">How we look after your key</p>
                <ul className="mt-1 list-disc space-y-1 pl-5">
                  <li>It is stored encrypted (AES-256) and is never shown again, not even to you.</li>
                  <li>
                    Only your account uses it. Collaborators can use it for transcription only if you switch that on in
                    Account → AI.
                  </li>
                  <li>
                    You can remove it at any time in Account → AI, or delete it in your {provider.name} dashboard.
                  </li>
                </ul>
              </div>
              <p className="rounded-lg bg-indigo-50 p-2 text-indigo-900 dark:bg-indigo-900/20 dark:text-indigo-200">
                If you haven&apos;t already,{' '}
                <ExternalLink href={provider.limitsUrl}>set a monthly spending limit</ExternalLink> in your{' '}
                {provider.name} dashboard.
              </p>
              <div className="flex justify-end">
                <button type="button" className="btn-primary px-4 py-2 text-sm" onClick={onClose}>
                  {transcriptionReason ? 'Back to transcription' : 'Done'}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
}
