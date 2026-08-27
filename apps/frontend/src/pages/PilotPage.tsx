import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import PageShell from '../components/marketing/PageShell';
import DisplayHeading from '../components/marketing/DisplayHeading';
import Eyebrow from '../components/marketing/Eyebrow';
import HairlineRule from '../components/marketing/HairlineRule';
import { usePageMeta } from '../hooks/usePageMeta';
import { pilotApi } from '../services/pilotApi';
import { trackEvent } from '../utils/analytics';

const tasks = [
  {
    id: 'create-project',
    title: '1. Create a project',
    outcome: 'Create a free account, choose a suitable starter template, and open the new canvas.',
  },
  {
    id: 'add-transcript',
    title: '2. Add a fictional transcript',
    outcome: 'Add a short interview transcript using only invented or public demonstration material.',
  },
  {
    id: 'code-passages',
    title: '3. Code two passages',
    outcome: 'Create at least two codes and apply them to relevant passages in the transcript.',
  },
  {
    id: 'memo-analysis',
    title: '4. Interpret a pattern',
    outcome: 'Write a research memo, then use one analysis tool to inspect a pattern in the coded material.',
  },
  {
    id: 'export',
    title: '5. Prepare a handoff',
    outcome: 'Find the export controls and download a useful output for supervision, reporting, or further analysis.',
  },
] as const;

type TaskId = (typeof tasks)[number]['id'];
type TaskOutcome = 'easy' | 'difficult' | 'not-completed' | 'not-attempted';

const initialOutcomes = Object.fromEntries(tasks.map((task) => [task.id, 'not-attempted'])) as Record<
  TaskId,
  TaskOutcome
>;

export default function PilotPage() {
  const [participantRole, setParticipantRole] = useState('');
  const [sector, setSector] = useState('');
  const [productExperience, setProductExperience] = useState('');
  const [taskOutcomes, setTaskOutcomes] = useState<Record<TaskId, TaskOutcome>>(initialOutcomes);
  const [hardestStep, setHardestStep] = useState('');
  const [missingFeature, setMissingFeature] = useState('');
  const [adoptionBlocker, setAdoptionBlocker] = useState('');
  const [recommendationScore, setRecommendationScore] = useState<number | null>(null);
  const [contactEmail, setContactEmail] = useState('');
  const [consentToContact, setConsentToContact] = useState(false);
  const [website, setWebsite] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState('');

  usePageMeta(
    'QualCanvas real-user pilot — Test a qualitative research workflow',
    'Take part in a 20–30 minute QualCanvas usability pilot: complete five research tasks and share structured feedback.',
  );

  useEffect(() => {
    trackEvent('pilot_started', { page: '/pilot' });
  }, []);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!participantRole || !productExperience || recommendationScore === null) return;

    setSubmitting(true);
    setError('');
    try {
      await pilotApi.submitFeedback({
        participantRole,
        sector,
        productExperience,
        taskResults: tasks.map((task) => ({ taskId: task.id, outcome: taskOutcomes[task.id] })),
        hardestStep,
        missingFeature,
        adoptionBlocker,
        recommendationScore,
        contactEmail,
        consentToContact,
        website,
      });
      trackEvent('pilot_feedback_submitted', {
        role: participantRole,
        product_experience: productExperience,
        recommendation_score: recommendationScore,
      });
      setSubmitted(true);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch {
      setError('Your feedback could not be submitted. Please check the form and try again.');
    } finally {
      setSubmitting(false);
    }
  };

  if (submitted) {
    return (
      <PageShell>
        <section className="max-w-2xl mx-auto px-4 sm:px-6 py-20 text-center">
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-ochre-700 dark:text-ochre-400 mb-4">
            Feedback received
          </p>
          <DisplayHeading size="md" className="mb-5">
            Thank you for testing QualCanvas.
          </DisplayHeading>
          <p className="text-lg text-gray-600 dark:text-gray-300 leading-relaxed mb-8">
            Your task results will be reviewed alongside other pilot sessions. We will use repeated problems—not one-off
            preferences—to decide what to improve next.
          </p>
          <div className="flex flex-col sm:flex-row justify-center gap-3">
            <Link
              to="/training"
              className="rounded-lg bg-ochre-500 px-6 py-3 font-semibold text-ink-950 hover:bg-ochre-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ochre-400"
            >
              Continue with training
            </Link>
            <Link
              to="/"
              className="rounded-lg border border-gray-300 px-6 py-3 font-semibold text-gray-800 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-100 dark:hover:bg-gray-800"
            >
              Return home
            </Link>
          </div>
        </section>
      </PageShell>
    );
  }

  return (
    <PageShell>
      <article className="max-w-4xl mx-auto px-4 sm:px-6 pt-14 pb-24">
        <HairlineRule className="mb-6" />
        <Eyebrow className="mb-3">Real-user pilot</Eyebrow>
        <DisplayHeading size="md" className="mb-6">
          Test one complete research workflow.
        </DisplayHeading>
        <p className="max-w-3xl text-lg text-gray-600 dark:text-gray-300 leading-relaxed">
          Spend 20–30 minutes completing five practical tasks, then tell us exactly where QualCanvas helped or got in
          your way. This is a usability study, not a test of your research ability.
        </p>

        <aside className="mt-8 rounded-2xl border border-ochre-200 bg-ochre-50 p-6 text-sm leading-relaxed text-gray-800 dark:border-ochre-900 dark:bg-ochre-900/10 dark:text-gray-200">
          <h2 className="font-semibold mb-2">Protect research participants</h2>
          <p>
            Use only fictional, synthetic, or already-public demonstration material. Do not upload customer data,
            confidential research, credentials, private email addresses, or identifiable participant information.
          </p>
        </aside>

        <section aria-labelledby="pilot-steps" className="mt-12">
          <h2 id="pilot-steps" className="text-2xl font-semibold text-gray-900 dark:text-white mb-2">
            The five tasks
          </h2>
          <p className="text-sm text-gray-600 dark:text-gray-400 mb-6">
            Try without training first. If you become stuck, use the{' '}
            <Link to="/training" className="underline decoration-ochre-500 underline-offset-2">
              training centre
            </Link>{' '}
            and record that the task was difficult.
          </p>
          <ol className="grid gap-4 sm:grid-cols-2">
            {tasks.map((task) => (
              <li
                key={task.id}
                className="rounded-xl bg-white p-5 ring-1 ring-gray-200 dark:bg-gray-800/60 dark:ring-gray-700"
              >
                <h3 className="font-semibold text-gray-900 dark:text-white mb-2">{task.title}</h3>
                <p className="text-sm leading-relaxed text-gray-600 dark:text-gray-300">{task.outcome}</p>
              </li>
            ))}
          </ol>
        </section>

        <form onSubmit={submit} className="mt-14 space-y-10" aria-labelledby="feedback-heading">
          <div>
            <HairlineRule className="mb-5" />
            <h2 id="feedback-heading" className="text-2xl font-semibold text-gray-900 dark:text-white mb-2">
              Record what happened
            </h2>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Feedback may be anonymous. Optional contact details are stored only when you consent to follow-up.
            </p>
          </div>

          <div className="grid gap-5 sm:grid-cols-2">
            <label className="block text-sm font-medium text-gray-800 dark:text-gray-200">
              Your role <span aria-hidden="true">*</span>
              <select
                required
                value={participantRole}
                onChange={(event) => setParticipantRole(event.target.value)}
                className="mt-1 block w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-gray-900 focus:border-ochre-500 focus:outline-none focus:ring-2 focus:ring-ochre-300 dark:border-gray-600 dark:bg-gray-900 dark:text-white"
              >
                <option value="">Choose a role</option>
                <option value="postgraduate-researcher">Postgraduate researcher</option>
                <option value="academic-researcher">Academic researcher</option>
                <option value="ux-service-researcher">UX or service researcher</option>
                <option value="educator-supervisor">Educator or supervisor</option>
                <option value="other">Another role</option>
              </select>
            </label>
            <label className="block text-sm font-medium text-gray-800 dark:text-gray-200">
              Sector or discipline <span className="font-normal text-gray-500">(optional)</span>
              <input
                value={sector}
                onChange={(event) => setSector(event.target.value)}
                maxLength={120}
                placeholder="For example: health research"
                className="mt-1 block w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-gray-900 focus:border-ochre-500 focus:outline-none focus:ring-2 focus:ring-ochre-300 dark:border-gray-600 dark:bg-gray-900 dark:text-white"
              />
            </label>
            <label className="block text-sm font-medium text-gray-800 dark:text-gray-200 sm:col-span-2">
              Previous QualCanvas experience <span aria-hidden="true">*</span>
              <select
                required
                value={productExperience}
                onChange={(event) => setProductExperience(event.target.value)}
                className="mt-1 block w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-gray-900 focus:border-ochre-500 focus:outline-none focus:ring-2 focus:ring-ochre-300 dark:border-gray-600 dark:bg-gray-900 dark:text-white"
              >
                <option value="">Choose your experience</option>
                <option value="first-time">This was my first use</option>
                <option value="some-experience">I have used it a few times</option>
                <option value="regular-user">I use it regularly</option>
              </select>
            </label>
          </div>

          <fieldset>
            <legend className="text-lg font-semibold text-gray-900 dark:text-white mb-4">How did each task go?</legend>
            <div className="space-y-3">
              {tasks.map((task) => (
                <label
                  key={task.id}
                  className="grid gap-2 rounded-xl border border-gray-200 p-4 sm:grid-cols-[minmax(0,1fr)_13rem] sm:items-center dark:border-gray-700"
                >
                  <span className="text-sm font-medium text-gray-800 dark:text-gray-200">{task.title}</span>
                  <select
                    aria-label={`${task.title} result`}
                    value={taskOutcomes[task.id]}
                    onChange={(event) =>
                      setTaskOutcomes((current) => ({ ...current, [task.id]: event.target.value as TaskOutcome }))
                    }
                    className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-ochre-500 focus:outline-none focus:ring-2 focus:ring-ochre-300 dark:border-gray-600 dark:bg-gray-900 dark:text-white"
                  >
                    <option value="easy">Completed easily</option>
                    <option value="difficult">Completed with difficulty</option>
                    <option value="not-completed">Could not complete</option>
                    <option value="not-attempted">Not attempted</option>
                  </select>
                </label>
              ))}
            </div>
          </fieldset>

          <div className="grid gap-5">
            <FeedbackTextArea
              label="Where did you hesitate, become stuck, or make a mistake?"
              value={hardestStep}
              onChange={setHardestStep}
            />
            <FeedbackTextArea
              label="What did you expect to find but could not?"
              value={missingFeature}
              onChange={setMissingFeature}
            />
            <FeedbackTextArea
              label="What, if anything, would stop you using QualCanvas for real work?"
              value={adoptionBlocker}
              onChange={setAdoptionBlocker}
            />
          </div>

          <fieldset>
            <legend className="text-base font-semibold text-gray-900 dark:text-white">
              How likely are you to recommend QualCanvas to another researcher? <span aria-hidden="true">*</span>
            </legend>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
              0 means not at all likely; 10 means very likely.
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              {Array.from({ length: 11 }, (_, score) => (
                <label key={score} className="cursor-pointer">
                  <input
                    type="radio"
                    name="recommendation-score"
                    required
                    value={score}
                    checked={recommendationScore === score}
                    onChange={() => setRecommendationScore(score)}
                    className="peer sr-only"
                  />
                  <span className="flex h-10 w-10 items-center justify-center rounded-lg border border-gray-300 text-sm font-medium text-gray-700 peer-checked:border-ochre-600 peer-checked:bg-ochre-500 peer-checked:text-ink-950 peer-focus-visible:ring-2 peer-focus-visible:ring-ochre-400 dark:border-gray-600 dark:text-gray-200">
                    {score}
                  </span>
                </label>
              ))}
            </div>
          </fieldset>

          <section aria-labelledby="follow-up-heading" className="rounded-2xl bg-gray-50 p-6 dark:bg-gray-800/50">
            <h3 id="follow-up-heading" className="font-semibold text-gray-900 dark:text-white mb-3">
              Optional follow-up
            </h3>
            <label className="block text-sm font-medium text-gray-800 dark:text-gray-200">
              Email address
              <input
                type="email"
                value={contactEmail}
                onChange={(event) => setContactEmail(event.target.value)}
                autoComplete="email"
                maxLength={254}
                className="mt-1 block w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-gray-900 focus:border-ochre-500 focus:outline-none focus:ring-2 focus:ring-ochre-300 dark:border-gray-600 dark:bg-gray-900 dark:text-white"
              />
            </label>
            <label className="mt-4 flex items-start gap-3 text-sm text-gray-600 dark:text-gray-300">
              <input
                type="checkbox"
                checked={consentToContact}
                onChange={(event) => setConsentToContact(event.target.checked)}
                required={Boolean(contactEmail)}
                className="mt-0.5 h-4 w-4 rounded border-gray-300 text-ochre-600 focus:ring-ochre-500"
              />
              I consent to QualCanvas storing this email and contacting me once about my pilot feedback.
            </label>
          </section>

          <label className="sr-only" aria-hidden="true">
            Website
            <input
              tabIndex={-1}
              autoComplete="off"
              value={website}
              onChange={(event) => setWebsite(event.target.value)}
            />
          </label>

          <div>
            {error && (
              <p
                role="alert"
                className="mb-4 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-800 dark:bg-red-900/20 dark:text-red-200"
              >
                {error}
              </p>
            )}
            <button
              type="submit"
              disabled={submitting}
              className="inline-flex w-full items-center justify-center rounded-lg bg-ochre-500 px-7 py-3.5 font-semibold text-ink-950 transition-colors hover:bg-ochre-600 disabled:opacity-50 sm:w-auto focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ochre-400 focus-visible:ring-offset-2"
            >
              {submitting ? 'Submitting feedback…' : 'Submit pilot feedback'}
            </button>
            <p className="mt-3 text-xs leading-relaxed text-gray-500 dark:text-gray-400">
              Please do not include research content or personal data in free-text answers. See the{' '}
              <Link to="/privacy" className="underline underline-offset-2">
                Privacy Policy
              </Link>{' '}
              for retention and deletion information.
            </p>
          </div>
        </form>
      </article>
    </PageShell>
  );
}

function FeedbackTextArea({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="block text-sm font-medium text-gray-800 dark:text-gray-200">
      {label} <span className="font-normal text-gray-500">(optional)</span>
      <textarea
        value={value}
        onChange={(event) => onChange(event.target.value)}
        maxLength={2000}
        rows={4}
        className="mt-1 block w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-gray-900 focus:border-ochre-500 focus:outline-none focus:ring-2 focus:ring-ochre-300 dark:border-gray-600 dark:bg-gray-900 dark:text-white"
      />
    </label>
  );
}
