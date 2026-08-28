import { useCallback, useEffect, useState } from 'react';
import { adminApi } from '../../services/api';

interface ActivationStage {
  key: 'signup' | 'canvas' | 'transcript' | 'coding';
  label: string;
  users: number;
  cohortRate: number | null;
  previousStepRate: number | null;
  medianHoursToReach: number | null;
}

interface ActivationData {
  period: string;
  since: string;
  activation: {
    cohortSize: number;
    activatedUsers: number;
    activationRate: number | null;
    stages: ActivationStage[];
  };
  content: {
    canvasesCreated: number;
    transcriptsCreated: number;
    codingsCreated: number;
    computedNodeRuns: number;
  };
}

const PERIODS = [
  { label: '7 days', value: '7d' },
  { label: '30 days', value: '30d' },
  { label: '90 days', value: '90d' },
] as const;

const AUTO_REFRESH_MS = 60_000;

function formatRate(value: number | null): string {
  return value === null ? '—' : `${value.toFixed(1)}%`;
}

function formatTime(hours: number | null): string {
  if (hours === null) return 'No completions yet';
  if (hours < 1) return 'Under 1 hour';
  if (hours < 48) return `${hours.toFixed(1)} hours`;
  return `${(hours / 24).toFixed(1)} days`;
}

export default function ActivationTab({ adminKey }: { adminKey: string }) {
  const [period, setPeriod] = useState<(typeof PERIODS)[number]['value']>('30d');
  const [data, setData] = useState<ActivationData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const response = await adminApi.getUsage(adminKey, { period });
      setData(response.data.data);
    } catch {
      setError('Failed to load activation data.');
    } finally {
      setLoading(false);
    }
  }, [adminKey, period]);

  useEffect(() => {
    load();
    const timer = window.setInterval(load, AUTO_REFRESH_MS);
    return () => window.clearInterval(timer);
  }, [load]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white">New-user activation</h2>
          <p className="mt-1 max-w-3xl text-sm text-gray-500 dark:text-gray-400">
            Follow real signup cohorts from account creation to their first coding. Test, demo, smoke and internal
            accounts are excluded, and milestones come from server-owned records rather than browser claims.
          </p>
        </div>
        <div className="inline-flex self-start rounded-lg border border-gray-200 bg-white p-1 dark:border-gray-700 dark:bg-gray-800">
          {PERIODS.map((option) => (
            <button
              key={option.value}
              type="button"
              aria-pressed={period === option.value}
              onClick={() => setPeriod(option.value)}
              className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                period === option.value
                  ? 'bg-indigo-600 text-white'
                  : 'text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-700'
              }`}
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>

      {loading && !data ? (
        <div role="status" className="py-12 text-center text-sm text-gray-500 dark:text-gray-400">
          Loading activation funnel…
        </div>
      ) : error || !data ? (
        <div role="alert" className="py-12 text-center text-sm text-red-600 dark:text-red-400">
          {error || 'No activation data is available.'}
        </div>
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-3">
            <SummaryCard label="Signup cohort" value={data.activation.cohortSize.toLocaleString()} />
            <SummaryCard label="Reached first coding" value={data.activation.activatedUsers.toLocaleString()} />
            <SummaryCard label="Activation rate" value={formatRate(data.activation.activationRate)} />
          </div>

          <section
            className="rounded-xl bg-white p-5 shadow dark:bg-gray-800"
            aria-labelledby="activation-funnel-title"
          >
            <div className="flex flex-wrap items-end justify-between gap-2">
              <div>
                <h3 id="activation-funnel-title" className="font-semibold text-gray-900 dark:text-white">
                  First-value funnel
                </h3>
                <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                  Cohort since {new Date(data.since).toLocaleDateString()}. Milestones may be reached after signup.
                </p>
              </div>
              {loading && <span className="text-xs text-gray-500 dark:text-gray-400">Refreshing…</span>}
            </div>

            <ol className="mt-5 space-y-4">
              {data.activation.stages.map((stage, index) => {
                const width = Math.max(0, Math.min(100, stage.cohortRate ?? 0));
                return (
                  <li key={stage.key} className="grid gap-3 lg:grid-cols-[minmax(180px,0.8fr)_minmax(260px,2fr)_1fr]">
                    <div>
                      <p className="text-sm font-medium text-gray-900 dark:text-white">
                        {index + 1}. {stage.label}
                      </p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">
                        {stage.users.toLocaleString()} users · {formatRate(stage.cohortRate)} of cohort
                      </p>
                    </div>
                    <div
                      role="progressbar"
                      aria-label={`${stage.label}: ${formatRate(stage.cohortRate)} of the signup cohort`}
                      aria-valuemin={0}
                      aria-valuemax={100}
                      aria-valuenow={stage.cohortRate ?? 0}
                      className="h-9 overflow-hidden rounded-lg bg-gray-100 dark:bg-gray-700"
                    >
                      <div
                        className="flex h-full min-w-0 items-center justify-end rounded-lg bg-indigo-600 px-2 text-xs font-semibold text-white transition-[width]"
                        style={{ width: `${width}%` }}
                      >
                        {width >= 18 ? formatRate(stage.cohortRate) : ''}
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-3 text-xs">
                      <div>
                        <p className="text-gray-500 dark:text-gray-400">From previous</p>
                        <p className="font-medium text-gray-700 dark:text-gray-200">
                          {formatRate(stage.previousStepRate)}
                        </p>
                      </div>
                      <div>
                        <p className="text-gray-500 dark:text-gray-400">Median time</p>
                        <p className="font-medium text-gray-700 dark:text-gray-200">
                          {index === 0 ? 'At signup' : formatTime(stage.medianHoursToReach)}
                        </p>
                      </div>
                    </div>
                  </li>
                );
              })}
            </ol>
          </section>

          <section className="rounded-xl bg-white p-5 shadow dark:bg-gray-800" aria-labelledby="period-output-title">
            <h3 id="period-output-title" className="font-semibold text-gray-900 dark:text-white">
              Real-user output during this period
            </h3>
            <dl className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <Metric label="Projects" value={data.content.canvasesCreated} />
              <Metric label="Transcripts" value={data.content.transcriptsCreated} />
              <Metric label="Codings" value={data.content.codingsCreated} />
              <Metric label="Analysis runs" value={data.content.computedNodeRuns} />
            </dl>
          </section>
        </>
      )}
    </div>
  );
}

function SummaryCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-white p-5 shadow dark:bg-gray-800">
      <p className="text-sm text-gray-500 dark:text-gray-400">{label}</p>
      <p className="mt-1 text-2xl font-bold text-gray-900 dark:text-white">{value}</p>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <dt className="text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400">{label}</dt>
      <dd className="mt-1 text-xl font-semibold text-gray-900 dark:text-white">{value.toLocaleString()}</dd>
    </div>
  );
}
