import { useState } from 'react';
import { trackEvent } from '../../utils/analytics';
import { FIRST_TRANSCRIPT_ACCEPT, readFirstTranscript } from '../../utils/transcriptFileText';
import { getExt } from '../../utils/transcriptFiles';

interface Props {
  initialResearchTopic?: string;
  initialMethod?: string;
  onContinue: (answers: { researchTopic: string; method: string }) => void;
  onSkip: () => void;
  /** Fast path: create a project with this pasted or chosen transcript and open it for coding. */
  onPasteTranscript?: (text: string, title?: string) => void | Promise<void>;
}

const METHODS = [
  { id: 'interviews', label: 'Interviews' },
  { id: 'focus_groups', label: 'Focus groups' },
  { id: 'field_notes', label: 'Field notes' },
  { id: 'open_ended_survey', label: 'Open-ended survey' },
  { id: 'other', label: 'Other' },
] as const;

export default function Screen1_Personalization({
  initialResearchTopic = '',
  initialMethod = 'interviews',
  onContinue,
  onSkip,
  onPasteTranscript,
}: Props) {
  const [pasted, setPasted] = useState('');
  const [pasting, setPasting] = useState(false);
  const [fileError, setFileError] = useState('');
  const [dragging, setDragging] = useState(false);

  // A researcher's transcript is usually a file (Word, PDF, or the captions
  // Zoom and Teams save), so the first screen takes the file itself. A file
  // that cannot be read says why and leaves the paste box as the way through.
  const startFromFile = async (file: File | undefined) => {
    if (!file || !onPasteTranscript || pasting) return;
    const format = getExt(file.name) ?? 'unknown';
    setFileError('');
    setPasting(true);
    try {
      const { title, content } = await readFirstTranscript(file);
      trackEvent('transcript_import', { stage: 'first_run', outcome: 'read', format });
      await onPasteTranscript(content, title);
    } catch (error) {
      trackEvent('transcript_import', { stage: 'first_run', outcome: 'failed', format });
      setFileError(`${file.name}: ${error instanceof Error ? error.message : 'This file could not be read.'}`);
    } finally {
      setPasting(false);
    }
  };
  const [topic, setTopic] = useState(initialResearchTopic);
  const [method, setMethod] = useState<string>(initialMethod);
  // Two questions, both optional: the topic names the first project, the
  // method pre-selects the template. (A third "solo or team?" question was
  // asked and never used, so it is gone.)
  const canContinue = Boolean(method);

  return (
    <div className="w-full max-w-xl">
      <div className="text-center mb-6">
        <h2 className="text-2xl font-semibold text-gray-900 dark:text-white">Let's tailor your workspace</h2>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
          Two quick, optional questions: we name your first project and suggest a starting template.
        </p>
      </div>

      {onPasteTranscript && (
        <div
          data-testid="onboarding-transcript-start"
          onDragOver={(e) => {
            e.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragging(false);
            void startFromFile(e.dataTransfer.files?.[0]);
          }}
          className={`mb-6 rounded-xl border p-4 dark:bg-brand-900/20 ${
            dragging
              ? 'border-brand-500 bg-brand-100 dark:border-brand-400'
              : 'border-brand-200 bg-brand-50/60 dark:border-brand-800'
          }`}
        >
          <label htmlFor="onboarding-paste" className="block text-sm font-semibold text-gray-900 dark:text-white mb-1">
            Have a transcript ready? Paste it and start coding
          </label>
          <p className="mb-2 text-xs text-gray-500 dark:text-gray-400">
            No template, method or AI key needed. Highlight a sentence next and choose a code.
          </p>
          <textarea
            id="onboarding-paste"
            rows={5}
            value={pasted}
            onChange={(e) => setPasted(e.target.value)}
            placeholder="Paste your interview, focus group or field-note text here"
            className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-brand-500"
          />
          {fileError && (
            <p role="alert" className="mt-2 text-xs text-red-700 dark:text-red-300">
              {fileError}
            </p>
          )}
          <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
            <div className="flex flex-wrap items-center gap-2">
              <label
                htmlFor="onboarding-file"
                className={`inline-flex min-h-[36px] cursor-pointer items-center rounded-lg border border-brand-300 bg-white px-3 py-1.5 text-sm font-medium text-brand-700 hover:bg-brand-50 focus-within:ring-2 focus-within:ring-brand-500 dark:border-brand-700 dark:bg-gray-800 dark:text-brand-200 ${
                  pasting ? 'pointer-events-none opacity-50' : ''
                }`}
              >
                Choose a transcript file
                <input
                  id="onboarding-file"
                  type="file"
                  accept={FIRST_TRANSCRIPT_ACCEPT}
                  disabled={pasting}
                  className="sr-only"
                  onChange={(e) => {
                    const chosen = e.target.files?.[0];
                    // Reset so choosing the same file again after an error still fires.
                    e.target.value = '';
                    void startFromFile(chosen);
                  }}
                />
              </label>
              <span className="text-xs text-gray-500 dark:text-gray-400">
                Word, PDF, text or caption file. You can also drop it here.
              </span>
            </div>
            <button
              type="button"
              disabled={!pasted.trim() || pasting}
              onClick={async () => {
                setPasting(true);
                try {
                  await onPasteTranscript(pasted);
                } finally {
                  setPasting(false);
                }
              }}
              className="btn-primary px-4 py-2 text-sm disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {pasting ? 'Opening…' : 'Start coding this transcript'}
            </button>
          </div>
        </div>
      )}

      <div className="space-y-5">
        <div>
          <label
            htmlFor="onboarding-topic"
            className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5"
          >
            What are you researching? <span className="font-normal text-gray-500 dark:text-gray-400">(optional)</span>
          </label>
          <input
            id="onboarding-topic"
            type="text"
            maxLength={80}
            value={topic}
            onChange={(e) => setTopic(e.target.value)}
            placeholder="e.g. patient experience with telehealth"
            className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-brand-500"
          />
        </div>

        <div>
          {/* Not a <label htmlFor>: this captions a set of BUTTONS, not a form
              control, and an htmlFor pointing at no element is worse than no
              association at all. A named group is the correct construct. */}
          <span
            id="onboarding-method-label"
            className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5"
          >
            Method?
          </span>
          <div role="group" aria-labelledby="onboarding-method-label" className="flex flex-wrap gap-2">
            {METHODS.map((m) => (
              <button
                key={m.id}
                type="button"
                onClick={() => setMethod(m.id)}
                className={`rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
                  method === m.id
                    ? 'bg-brand-600 text-white'
                    : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200 hover:bg-gray-200 dark:hover:bg-gray-600'
                }`}
              >
                {m.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="flex items-center justify-between mt-7">
        <button
          type="button"
          onClick={() => {
            trackEvent('onboarding_skipped', { at_step: 1 });
            onSkip();
          }}
          className="text-xs text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300"
        >
          Skip — I'll set up later
        </button>
        <button
          type="button"
          disabled={!canContinue}
          onClick={() => onContinue({ researchTopic: topic.trim(), method })}
          className="btn-primary px-5 py-2 text-sm disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Continue
        </button>
      </div>
    </div>
  );
}
