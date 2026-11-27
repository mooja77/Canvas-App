import { useState } from 'react';

export interface SampleAiSuggestion {
  id: string;
  codeLabel: string;
  colorClass: string;
  quote: string;
  confidence: number;
  reasoning: string;
}

export const SAMPLE_DEMO_TRANSCRIPT_TITLE = 'Sample interview: Returning to study after caregiving';

export const SAMPLE_AI_SUGGESTIONS: SampleAiSuggestion[] = [
  {
    id: 'sample-1',
    codeLabel: 'Identity transition',
    colorClass: 'bg-amber-100 text-amber-900 dark:bg-amber-900/40 dark:text-amber-200',
    quote: 'Coming back to school felt like reaching for a self I had put somewhere I could not quite find.',
    confidence: 0.92,
    reasoning: 'Frames returning to study as recovering an earlier sense of self after a long break.',
  },
  {
    id: 'sample-2',
    codeLabel: 'Caregiving expertise',
    colorClass: 'bg-sky-100 text-sky-900 dark:bg-sky-900/40 dark:text-sky-200',
    quote:
      'I got up at four in the morning to give my mother her medications and knew which hospice nurse actually showed up.',
    confidence: 0.89,
    reasoning: 'Describes practical clinical and logistical knowledge built through daily caregiving.',
  },
  {
    id: 'sample-3',
    codeLabel: 'Unrecognized lived knowledge',
    colorClass: 'bg-purple-100 text-purple-900 dark:bg-purple-900/40 dark:text-purple-200',
    quote: 'I do not know what to do with that knowing now. It does not fit on a CV or in a methods section.',
    confidence: 0.94,
    reasoning: 'Contrasts lived caregiving knowledge with formal academic credentials and reporting.',
  },
];

type Decision = 'pending' | 'accepted' | 'rejected';

interface AiCodingSampleProps {
  onConnectKey?: () => void;
}

/**
 * Built-in, zero-network worked example of AI code suggestions on demo data.
 * Lets researchers see how AI coding and human review work before connecting
 * their own OpenAI, Anthropic, or Google API key. Never makes any API call.
 */
export default function AiCodingSample({ onConnectKey }: AiCodingSampleProps) {
  const [decisions, setDecisions] = useState<Record<string, Decision>>({});

  const decisionOf = (id: string): Decision => decisions[id] ?? 'pending';
  const acceptedCount = SAMPLE_AI_SUGGESTIONS.filter((s) => decisionOf(s.id) === 'accepted').length;
  const rejectedCount = SAMPLE_AI_SUGGESTIONS.filter((s) => decisionOf(s.id) === 'rejected').length;
  const hasDecisions = acceptedCount > 0 || rejectedCount > 0;

  const setDecision = (id: string, next: Decision) => {
    setDecisions((prev) => ({ ...prev, [id]: prev[id] === next ? 'pending' : next }));
  };

  return (
    <section
      aria-labelledby="ai-coding-sample-heading"
      data-testid="ai-coding-sample"
      className="space-y-3 rounded-xl border border-indigo-200 bg-indigo-50/50 p-4 text-sm text-gray-800 dark:border-indigo-800 dark:bg-indigo-950/30 dark:text-gray-200"
    >
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h4 id="ai-coding-sample-heading" className="font-semibold text-gray-900 dark:text-gray-100">
            Worked AI coding sample (demo data, no key used)
          </h4>
          <p className="mt-0.5 text-xs text-gray-600 dark:text-gray-300">
            Built-in example on sample interview text. Nothing is sent to a server. Live AI coding always runs on your
            own OpenAI, Anthropic, or Google key.
          </p>
        </div>
        {hasDecisions && (
          <button
            type="button"
            onClick={() => setDecisions({})}
            className="rounded px-2 py-1 text-xs font-medium text-indigo-700 hover:bg-indigo-100 dark:text-indigo-300 dark:hover:bg-indigo-900/40"
          >
            Reset sample
          </button>
        )}
      </div>

      <div className="rounded-lg border border-gray-200 bg-white p-3 dark:border-gray-700 dark:bg-gray-900">
        <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
          {SAMPLE_DEMO_TRANSCRIPT_TITLE}
        </p>
        <p className="mt-1.5 leading-relaxed text-gray-800 dark:text-gray-200">
          {SAMPLE_AI_SUGGESTIONS.map((item, idx) => {
            const state = decisionOf(item.id);
            const highlight =
              state === 'accepted'
                ? 'rounded bg-emerald-100 px-1 py-0.5 text-emerald-950 dark:bg-emerald-900/50 dark:text-emerald-100'
                : state === 'rejected'
                  ? 'text-gray-400 line-through dark:text-gray-500'
                  : 'rounded bg-indigo-50 px-1 py-0.5 dark:bg-indigo-900/30';
            return (
              <span key={item.id}>
                <span className={highlight} data-testid={`sample-quote-${item.id}`} data-state={state}>
                  {item.quote}
                </span>
                {idx < SAMPLE_AI_SUGGESTIONS.length - 1 ? ' ' : ''}
              </span>
            );
          })}
        </p>
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between text-xs text-gray-600 dark:text-gray-300">
          <span className="font-medium">Suggested codes (you approve or reject each one)</span>
          <span data-testid="ai-sample-summary">
            {acceptedCount} of {SAMPLE_AI_SUGGESTIONS.length} accepted
          </span>
        </div>

        <ul className="space-y-2">
          {SAMPLE_AI_SUGGESTIONS.map((item) => {
            const state = decisionOf(item.id);
            return (
              <li
                key={item.id}
                className="rounded-lg border border-gray-200 bg-white p-2.5 dark:border-gray-700 dark:bg-gray-900"
              >
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0 flex-1 space-y-1">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className={`rounded px-1.5 py-0.5 text-xs font-medium ${item.colorClass}`}>
                        {item.codeLabel}
                      </span>
                      <span className="text-xs text-gray-500 dark:text-gray-400">
                        {Math.round(item.confidence * 100)}% match
                      </span>
                      {state !== 'pending' && (
                        <span
                          className={`rounded px-1.5 py-0.5 text-[11px] font-medium ${
                            state === 'accepted'
                              ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200'
                              : 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300'
                          }`}
                        >
                          {state === 'accepted' ? 'Accepted' : 'Rejected'}
                        </span>
                      )}
                    </div>
                    <p className="text-xs italic text-gray-600 dark:text-gray-400">&ldquo;{item.quote}&rdquo;</p>
                    <p className="text-xs text-gray-600 dark:text-gray-300">
                      <span className="font-medium">Why:</span> {item.reasoning}
                    </p>
                  </div>
                  <div className="flex shrink-0 gap-1.5">
                    <button
                      type="button"
                      aria-pressed={state === 'accepted'}
                      aria-label={`Accept ${item.codeLabel}`}
                      onClick={() => setDecision(item.id, 'accepted')}
                      className={`rounded px-2 py-1 text-xs font-medium ${
                        state === 'accepted'
                          ? 'bg-emerald-600 text-white'
                          : 'border border-emerald-300 text-emerald-800 hover:bg-emerald-50 dark:border-emerald-700 dark:text-emerald-200 dark:hover:bg-emerald-900/30'
                      }`}
                    >
                      Accept
                    </button>
                    <button
                      type="button"
                      aria-pressed={state === 'rejected'}
                      aria-label={`Reject ${item.codeLabel}`}
                      onClick={() => setDecision(item.id, 'rejected')}
                      className={`rounded px-2 py-1 text-xs font-medium ${
                        state === 'rejected'
                          ? 'bg-gray-700 text-white'
                          : 'border border-gray-300 text-gray-700 hover:bg-gray-100 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-800'
                      }`}
                    >
                      Reject
                    </button>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      </div>

      {onConnectKey && (
        <div className="flex justify-end pt-1">
          <button type="button" onClick={onConnectKey} className="btn-primary px-3 py-1.5 text-xs">
            Connect your AI key to code your own transcripts
          </button>
        </div>
      )}
    </section>
  );
}
