import { useState } from 'react';
import { trackEvent } from '../../utils/analytics';

interface Props {
  onContinue: (answers: { researchTopic: string; method: string; solo: boolean }) => void;
  onSkip: () => void;
}

const METHODS = [
  { id: 'interviews', label: 'Interviews' },
  { id: 'focus_groups', label: 'Focus groups' },
  { id: 'field_notes', label: 'Field notes' },
  { id: 'open_ended_survey', label: 'Open-ended survey' },
  { id: 'other', label: 'Other' },
] as const;

export default function Screen1_Personalization({ onContinue, onSkip }: Props) {
  const [topic, setTopic] = useState('');
  const [method, setMethod] = useState<string>('interviews');
  const [solo, setSolo] = useState<boolean | null>(null);

  const canContinue = topic.trim().length > 0 && method && solo !== null;

  return (
    <div className="w-full max-w-xl">
      <div className="text-center mb-6">
        <h2 className="text-2xl font-semibold text-gray-900 dark:text-white">Let's tailor your workspace</h2>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
          Three quick questions so we can suggest the right starting template.
        </p>
      </div>

      <div className="space-y-5">
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
            What are you researching?
          </label>
          <input
            autoFocus
            type="text"
            maxLength={80}
            value={topic}
            onChange={(e) => setTopic(e.target.value)}
            placeholder="e.g. patient experience with telehealth"
            className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-brand-500"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Method?</label>
          <div className="flex flex-wrap gap-2">
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

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
            Just you, or a team?
          </label>
          <div className="grid grid-cols-2 gap-2">
            {[
              { id: 'solo', label: 'Solo', value: true },
              { id: 'team', label: 'Team', value: false },
            ].map((opt) => (
              <button
                key={opt.id}
                type="button"
                onClick={() => setSolo(opt.value)}
                className={`rounded-lg border px-3 py-2 text-sm font-medium transition-colors ${
                  solo === opt.value
                    ? 'border-brand-500 bg-brand-50 dark:bg-brand-900/30 text-brand-700 dark:text-brand-300'
                    : 'border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 hover:border-gray-300 dark:hover:border-gray-600'
                }`}
              >
                {opt.label}
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
          className="text-xs text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
        >
          Skip — I'll set up later
        </button>
        <button
          type="button"
          disabled={!canContinue}
          onClick={() => onContinue({ researchTopic: topic.trim(), method, solo: !!solo })}
          className="btn-primary px-5 py-2 text-sm disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Continue
        </button>
      </div>
    </div>
  );
}
