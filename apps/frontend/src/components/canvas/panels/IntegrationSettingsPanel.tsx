import { useState, useEffect } from 'react';
import { canvasApi } from '../../../services/api';
import toast from 'react-hot-toast';
import ConfirmDialog from '../ConfirmDialog';

/**
 * Legacy provider credentials — erasure only.
 *
 * QualCanvas never had a working Zoom/Slack/Qualtrics integration: the old
 * connect endpoint stored an access token pasted into the request body and
 * nothing ever read it back. That endpoint is retired (410) and no new
 * credentials can be created.
 *
 * This panel exists solely so a user can see whether anything was stored for
 * them under the old behaviour and delete it. Deliberately:
 *   - lists only credentials that actually exist, never a provider catalogue;
 *   - renders nothing suggesting a provider is pending or "coming later";
 *   - never offers or implies reconnection;
 *   - works on every plan, because erasing your own data is not a paid feature.
 */

interface IntegrationInfo {
  id: string;
  provider: string;
  createdAt: string;
}

const PROVIDER_LABELS: Record<string, string> = {
  zoom: 'Zoom',
  slack: 'Slack',
  qualtrics: 'Qualtrics',
};

export default function IntegrationSettingsPanel() {
  const [integrations, setIntegrations] = useState<IntegrationInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  const loadIntegrations = async () => {
    try {
      const res = await canvasApi.getIntegrations();
      setIntegrations(res.data.integrations ?? []);
    } catch {
      toast.error('Could not load stored credentials');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadIntegrations();
  }, []);

  const handleConfirmedDelete = async () => {
    if (!confirmDeleteId) return;
    try {
      await canvasApi.disconnectIntegration(confirmDeleteId);
      toast.success('Credential deleted');
      loadIntegrations();
    } catch {
      toast.error('Could not delete credential');
    } finally {
      setConfirmDeleteId(null);
    }
  };

  if (loading) {
    return (
      <div className="p-6 text-center">
        <div className="animate-spin rounded-full h-6 w-6 border-2 border-blue-500 border-t-transparent mx-auto" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Legacy provider credentials</h3>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
          QualCanvas does not connect to Zoom, Slack or Qualtrics. Those connections have been retired and cannot be
          created. Import transcripts as files instead.
        </p>
      </div>

      {integrations.length === 0 ? (
        <div className="rounded-lg border border-gray-200 bg-gray-50 p-4 text-sm text-gray-600 dark:border-gray-700 dark:bg-gray-800/60 dark:text-gray-300">
          No provider credentials are stored for your account. Nothing to remove.
        </div>
      ) : (
        <>
          <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900 dark:border-amber-900 dark:bg-amber-900/20 dark:text-amber-200">
            An earlier version of QualCanvas stored the credential{integrations.length === 1 ? '' : 's'} below. They are
            encrypted at rest and unused. You can delete {integrations.length === 1 ? 'it' : 'them'} permanently here;
            deleting your account removes {integrations.length === 1 ? 'it' : 'them'} too.
          </div>

          <ul className="space-y-3">
            {integrations.map((integration) => (
              <li
                key={integration.id}
                className="flex items-center justify-between rounded-lg border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800"
              >
                <div>
                  <h4 className="text-sm font-medium text-gray-900 dark:text-white">
                    {PROVIDER_LABELS[integration.provider] ?? integration.provider}
                  </h4>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    Stored {new Date(integration.createdAt).toLocaleDateString()} · unused
                  </p>
                </div>
                <button
                  onClick={() => setConfirmDeleteId(integration.id)}
                  className="rounded border border-red-200 px-3 py-1.5 text-xs text-red-600 hover:bg-red-50 dark:border-red-800 dark:text-red-400 dark:hover:bg-red-900/20"
                >
                  Delete
                </button>
              </li>
            ))}
          </ul>
        </>
      )}

      {confirmDeleteId && (
        <ConfirmDialog
          title="Delete stored credential"
          message="This permanently deletes the stored credential. It cannot be undone, and there is no way to create a new one — provider connections have been retired."
          confirmLabel="Delete permanently"
          onConfirm={handleConfirmedDelete}
          onCancel={() => setConfirmDeleteId(null)}
        />
      )}
    </div>
  );
}
