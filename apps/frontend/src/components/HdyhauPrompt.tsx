import { useEffect, useState } from 'react';
import { hdyhauApi, type HdyhauChannel } from '../services/hdyhauApi';

const OPTIONS: { key: HdyhauChannel; label: string }[] = [
  { key: 'ai_assistant', label: 'ChatGPT or another AI assistant' },
  { key: 'google', label: 'Google search' },
  { key: 'word_of_mouth', label: 'A colleague, supervisor or friend' },
  { key: 'trade_group', label: 'A conference, course or research network' },
  { key: 'social', label: 'Social media or YouTube' },
  { key: 'other', label: 'Other' },
];

const OTHER_MAX = 500;

/**
 * One optional question, asked once per account after signup. The server
 * decides whether to ask (GET /user/hdyhau) and records the answer or the skip,
 * so it never reappears on any device. A small corner card, never a modal: it
 * must not block the canvas. Any network failure simply hides it.
 */
export default function HdyhauPrompt() {
  const [visible, setVisible] = useState(false);
  const [showOther, setShowOther] = useState(false);
  const [otherText, setOtherText] = useState('');

  useEffect(() => {
    let cancelled = false;
    hdyhauApi
      .get()
      .then((res) => {
        if (!cancelled && res.data?.data?.ask === true) setVisible(true);
      })
      .catch(() => {
        /* never block the app on this question */
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (!visible) return null;

  const answer = (key: HdyhauChannel, text?: string) => {
    setVisible(false);
    hdyhauApi.answer(key, text?.trim() || undefined).catch(() => {});
  };

  const skip = () => {
    setVisible(false);
    hdyhauApi.skip().catch(() => {});
  };

  return (
    <section
      aria-labelledby="hdyhau-title"
      className="fixed bottom-12 left-1/2 z-40 w-[min(22rem,calc(100vw-2rem))] -translate-x-1/2 rounded-xl border border-gray-200 bg-white p-4 shadow-xl dark:border-gray-700 dark:bg-gray-900"
    >
      <div className="mb-3 flex items-start justify-between gap-3">
        <div>
          <h2 id="hdyhau-title" className="text-sm font-semibold text-gray-900 dark:text-white">
            How did you hear about QualCanvas?
          </h2>
          <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">Optional, one tap. It helps a small team.</p>
        </div>
        <button
          type="button"
          onClick={skip}
          className="rounded p-1 text-xs text-gray-500 hover:bg-gray-100 hover:text-gray-700 dark:text-gray-400 dark:hover:bg-gray-800"
          aria-label="Skip this question"
        >
          Skip
        </button>
      </div>

      {!showOther ? (
        <div className="flex flex-wrap gap-2">
          {OPTIONS.map((o) => (
            <button
              key={o.key}
              type="button"
              onClick={() => (o.key === 'other' ? setShowOther(true) : answer(o.key))}
              className="rounded-full bg-gray-100 px-3 py-1.5 text-xs font-medium text-gray-700 transition-colors hover:bg-brand-600 hover:text-white dark:bg-gray-800 dark:text-gray-200"
            >
              {o.label}
            </button>
          ))}
        </div>
      ) : (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            answer('other', otherText);
          }}
        >
          <label htmlFor="hdyhau-other" className="mb-1 block text-xs font-medium text-gray-700 dark:text-gray-300">
            Where did you hear about us? (optional)
          </label>
          <input
            id="hdyhau-other"
            type="text"
            autoFocus
            maxLength={OTHER_MAX}
            value={otherText}
            onChange={(e) => setOtherText(e.target.value)}
            className="w-full rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-brand-500 dark:border-gray-600 dark:bg-gray-800 dark:text-white"
          />
          <div className="mt-2 flex justify-end">
            <button
              type="submit"
              className="rounded-lg bg-brand-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-brand-700"
            >
              Submit
            </button>
          </div>
        </form>
      )}
    </section>
  );
}
