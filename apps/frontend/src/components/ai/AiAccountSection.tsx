import { useCallback, useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { aiSettingsApi } from '../../services/api';
import { useAiConfigStore } from '../../stores/aiConfigStore';
import { formatUsd, providerGuide } from './aiProviders';

interface Usage {
  minutes: number;
  estimatedCostUsd: number;
}
interface CollaboratorUsage extends Usage {
  userId: string;
  name: string | null;
  email: string | null;
}
interface Settings {
  hasApiKey: boolean;
  provider?: string;
  model?: string | null;
  shareWithCollaborators?: boolean;
  transcriptionUsage?: Usage | null;
  collaboratorUsage?: CollaboratorUsage[];
}

/**
 * Account → AI. Status of the researcher's own AI account, the wizard to
 * connect or change it, removal, the owner's "collaborators may transcribe on
 * my key" switch, and plain usage reporting (what was transcribed on the key
 * this month, and by whom).
 */
export default function AiAccountSection() {
  const [settings, setSettings] = useState<Settings | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [busy, setBusy] = useState<'remove' | 'share' | null>(null);
  const openWizard = useAiConfigStore((s) => s.openWizard);
  const wizardOpen = useAiConfigStore((s) => s.wizard.open);
  const fetchConfig = useAiConfigStore((s) => s.fetchConfig);

  const load = useCallback(async () => {
    setLoadError(false);
    try {
      const res = await aiSettingsApi.getSettings();
      setSettings(res.data.data ?? { hasApiKey: false });
    } catch {
      setLoadError(true);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);
  // Reload after the wizard closes: the key may have just been connected.
  useEffect(() => {
    if (!wizardOpen) load();
  }, [wizardOpen, load]);

  const remove = async () => {
    if (!window.confirm('Remove your AI key? AI features and transcription stop until you connect one again.')) return;
    setBusy('remove');
    try {
      await aiSettingsApi.deleteSettings();
      toast.success('AI key removed');
      await fetchConfig({ force: true });
      await load();
    } catch {
      toast.error('Could not remove the key. Try again.');
    } finally {
      setBusy(null);
    }
  };

  const setSharing = async (share: boolean) => {
    setBusy('share');
    try {
      await aiSettingsApi.updateSharing(share);
      setSettings((s) => (s ? { ...s, shareWithCollaborators: share } : s));
      toast.success(
        share ? 'Collaborators can now transcribe with your key' : 'Collaborators can no longer use your key',
      );
    } catch {
      toast.error('Could not change the setting. Try again.');
    } finally {
      setBusy(null);
    }
  };

  const provider = providerGuide(settings?.provider);
  const isOpenAi = settings?.provider === 'openai';

  return (
    <div
      id="ai"
      className="mb-6 scroll-mt-6 rounded-xl bg-white p-6 ring-1 ring-gray-200 dark:bg-gray-800 dark:ring-gray-700"
      aria-labelledby="ai-settings-heading"
    >
      <h2
        id="ai-settings-heading"
        className="mb-2 text-sm font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400"
      >
        AI Settings
      </h2>
      <p className="mb-4 text-sm text-gray-600 dark:text-gray-400">
        Transcription and AI features run on your own AI account. Your provider bills you directly; QualCanvas never
        charges for AI.
      </p>

      {loadError ? (
        <div
          role="alert"
          className="rounded-lg bg-red-50 p-3 text-sm text-red-700 dark:bg-red-900/20 dark:text-red-300"
        >
          Could not load your AI settings.{' '}
          <button type="button" onClick={load} className="font-medium underline">
            Try again
          </button>
        </div>
      ) : !settings ? (
        <div className="h-16 animate-pulse rounded-lg bg-gray-100 dark:bg-gray-700" aria-label="Loading AI settings" />
      ) : !settings.hasApiKey ? (
        <div className="rounded-lg bg-gray-50 p-4 text-sm dark:bg-gray-900/40" data-testid="ai-not-connected">
          <p className="font-medium text-gray-900 dark:text-gray-100">No AI account connected</p>
          <p className="mt-1 text-gray-600 dark:text-gray-400">
            Connect an OpenAI key to transcribe recordings and use AI coding, or an Anthropic or Google key for text AI.
          </p>
          <button type="button" className="btn-primary mt-3 px-4 py-2 text-sm" onClick={() => openWizard()}>
            Connect your AI account
          </button>
        </div>
      ) : (
        <div className="space-y-4 text-sm">
          <div className="flex flex-wrap items-center justify-between gap-3" data-testid="ai-connected">
            <p className="text-gray-800 dark:text-gray-200">
              <span className="mr-1 inline-block h-2 w-2 rounded-full bg-emerald-500" aria-hidden />
              Connected: <strong>{provider.name}</strong>
              {settings.model ? ` (model ${settings.model})` : ''}. Key stored encrypted.
            </p>
            <div className="flex gap-2">
              <button
                type="button"
                className="btn-secondary px-3 py-1.5 text-sm"
                onClick={() => openWizard(undefined, settings.provider as 'openai')}
              >
                Change key
              </button>
              <button
                type="button"
                className="rounded-lg px-3 py-1.5 text-sm text-red-700 hover:bg-red-50 disabled:opacity-60 dark:text-red-300 dark:hover:bg-red-900/20"
                onClick={remove}
                disabled={busy !== null}
              >
                {busy === 'remove' ? 'Removing…' : 'Remove key'}
              </button>
            </div>
          </div>

          {isOpenAi && settings.transcriptionUsage && (
            <p className="text-gray-600 dark:text-gray-400" data-testid="ai-usage">
              {settings.transcriptionUsage.minutes > 0 ? (
                <>
                  Transcribed on your key this month: {settings.transcriptionUsage.minutes} min (about{' '}
                  {formatUsd(settings.transcriptionUsage.estimatedCostUsd)} at OpenAI&apos;s list price).
                </>
              ) : (
                'Nothing transcribed on your key yet this month.'
              )}{' '}
              Your OpenAI dashboard shows the exact bill.
            </p>
          )}

          {isOpenAi && (
            <div className="rounded-lg border border-gray-200 p-3 dark:border-gray-700">
              <label className="flex items-start gap-3">
                <input
                  type="checkbox"
                  className="mt-0.5"
                  checked={Boolean(settings.shareWithCollaborators)}
                  disabled={busy !== null}
                  onChange={(e) => setSharing(e.target.checked)}
                  aria-describedby="ai-share-help"
                />
                <span>
                  <span className="font-medium text-gray-900 dark:text-gray-100">
                    Let collaborators transcribe with my key
                  </span>
                  <span id="ai-share-help" className="block text-gray-600 dark:text-gray-400">
                    Coders on your canvases who have not connected their own OpenAI key can transcribe recordings into
                    your canvases, billed to your OpenAI account. They are told it is your key. Off by default.
                  </span>
                </span>
              </label>
              {(settings.collaboratorUsage?.length ?? 0) > 0 && (
                <div className="mt-3" data-testid="ai-collaborator-usage">
                  <p className="font-medium text-gray-900 dark:text-gray-100">Collaborators on your key this month</p>
                  <ul className="mt-1 space-y-0.5 text-gray-600 dark:text-gray-400">
                    {settings.collaboratorUsage!.map((c) => (
                      <li key={c.userId}>
                        {c.name || c.email || 'A collaborator'}: {c.minutes} min (about {formatUsd(c.estimatedCostUsd)})
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
