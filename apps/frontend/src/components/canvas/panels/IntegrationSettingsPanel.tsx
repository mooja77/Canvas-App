import { useState, useEffect } from 'react';
import { canvasApi } from '../../../services/api';
import toast from 'react-hot-toast';

interface IntegrationInfo {
  id: string;
  userId: string;
  provider: string;
  metadata: string;
  expiresAt: string | null;
  createdAt: string;
}

const PROVIDERS = [
  {
    id: 'zoom',
    name: 'Zoom',
    description: 'Import meeting recordings and transcripts',
    icon: '📹',
  },
  {
    id: 'slack',
    name: 'Slack',
    description: 'Import channel conversations for analysis',
    icon: '💬',
  },
  {
    id: 'qualtrics',
    name: 'Qualtrics',
    description: 'Import survey responses and open-ended data',
    icon: '📊',
  },
];

export default function IntegrationSettingsPanel() {
  const [integrations, setIntegrations] = useState<IntegrationInfo[]>([]);
  const [loading, setLoading] = useState(true);

  const loadIntegrations = async () => {
    try {
      const res = await canvasApi.getIntegrations();
      setIntegrations(res.data.integrations);
    } catch (err: any) {
      if (err.response?.status !== 403) {
        toast.error('Failed to load integrations');
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadIntegrations();
  }, []);

  const handleConnect = async (provider: string) => {
    // In a real implementation, this would redirect to the OAuth flow.
    // For now, show a placeholder message.
    toast('OAuth integration for ' + provider + ' is not yet configured. This is a placeholder.', {
      icon: 'ℹ️',
      duration: 3000,
    });
  };

  const handleDisconnect = async (integrationId: string) => {
    if (!confirm('Disconnect this integration?')) return;
    try {
      await canvasApi.disconnectIntegration(integrationId);
      toast.success('Integration disconnected');
      loadIntegrations();
    } catch {
      toast.error('Failed to disconnect integration');
    }
  };

  const connectedProviders = new Set(integrations.map(i => i.provider));

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
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Integrations</h3>
        <p className="text-sm text-gray-500 mt-1">
          Connect external services to import data into your canvases.
        </p>
      </div>

      <div className="space-y-3">
        {PROVIDERS.map((provider) => {
          const connected = connectedProviders.has(provider.id);
          const integration = integrations.find(i => i.provider === provider.id);

          return (
            <div
              key={provider.id}
              className="flex items-center justify-between p-4 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800"
            >
              <div className="flex items-center gap-3">
                <span className="text-2xl">{provider.icon}</span>
                <div>
                  <h4 className="text-sm font-medium text-gray-900 dark:text-white">{provider.name}</h4>
                  <p className="text-xs text-gray-500">{provider.description}</p>
                  {connected && integration && (
                    <p className="text-[10px] text-green-600 dark:text-green-400 mt-0.5">
                      Connected since {new Date(integration.createdAt).toLocaleDateString()}
                    </p>
                  )}
                </div>
              </div>

              {connected ? (
                <button
                  onClick={() => integration && handleDisconnect(integration.id)}
                  className="px-3 py-1.5 text-xs text-red-600 dark:text-red-400 border border-red-200 dark:border-red-800 rounded hover:bg-red-50 dark:hover:bg-red-900/20"
                >
                  Disconnect
                </button>
              ) : (
                <button
                  onClick={() => handleConnect(provider.id)}
                  className="px-3 py-1.5 text-xs bg-blue-600 text-white rounded hover:bg-blue-700"
                >
                  Connect
                </button>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
