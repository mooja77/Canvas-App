import { useState } from 'react';
import { createPortal } from 'react-dom';
import { aiSettingsApi } from '../../../services/api';
import { useAiConfigStore } from '../../../stores/aiConfigStore';
import toast from 'react-hot-toast';

const PROVIDERS = [
  {
    id: 'openai',
    name: 'OpenAI',
    description: 'GPT-4o, Whisper transcription, embeddings',
    features: ['AI coding', 'Chat', 'Summaries', 'Transcription', 'RAG search'],
    placeholder: 'sk-...',
    defaultModel: 'gpt-4o-mini',
    docsUrl: 'https://platform.openai.com/api-keys',
    color: '#10a37f',
  },
  {
    id: 'anthropic',
    name: 'Anthropic',
    description: 'Claude — strong reasoning and analysis',
    features: ['AI coding', 'Chat', 'Summaries'],
    limitations: ['No transcription', 'No embeddings/RAG indexing'],
    placeholder: 'sk-ant-...',
    defaultModel: 'claude-sonnet-4-20250514',
    docsUrl: 'https://console.anthropic.com/settings/keys',
    color: '#d4a574',
  },
  {
    id: 'google',
    name: 'Google',
    description: 'Gemini — fast and cost-effective',
    features: ['AI coding', 'Chat', 'Summaries', 'Embeddings'],
    limitations: ['No transcription'],
    placeholder: 'AI...',
    defaultModel: 'gemini-2.0-flash',
    docsUrl: 'https://aistudio.google.com/apikey',
    color: '#4285f4',
  },
];

interface AiSetupGuideProps {
  onClose: () => void;
  trigger?: string; // what feature triggered this
}

export default function AiSetupGuide({ onClose, trigger }: AiSetupGuideProps) {
  const [step, setStep] = useState<'choose' | 'configure' | 'success'>('choose');
  const [selectedProvider, setSelectedProvider] = useState<string | null>(null);
  const [apiKey, setApiKey] = useState('');
  const [showKey, setShowKey] = useState(false);
  const [saving, setSaving] = useState(false);
  const { setConfigured } = useAiConfigStore();

  const provider = PROVIDERS.find((p) => p.id === selectedProvider);

  const handleSave = async () => {
    if (!selectedProvider || !apiKey.trim()) return;
    setSaving(true);
    try {
      await aiSettingsApi.updateSettings({
        provider: selectedProvider,
        apiKey: apiKey.trim(),
      });
      setConfigured(true, selectedProvider);
      setStep('success');
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error || 'Failed to verify API key';
      toast.error(msg);
    } finally {
      setSaving(false);
    }
  };

  return createPortal(
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50 backdrop-blur-sm" onClick={onClose}>
      <div
        className="w-full max-w-lg mx-4 rounded-2xl bg-white shadow-2xl dark:bg-gray-900 overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="bg-gradient-to-r from-purple-600 to-blue-600 px-6 py-5 text-white">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/20">
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904 9 18.75l-.813-2.846a4.5 4.5 0 0 0-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 0 0 3.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 0 0 3.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 0 0-3.09 3.09ZM18.259 8.715 18 9.75l-.259-1.035a3.375 3.375 0 0 0-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 0 0 2.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 0 0 2.455 2.456L21.75 6l-1.036.259a3.375 3.375 0 0 0-2.455 2.456Z" />
                </svg>
              </div>
              <div>
                <h2 className="text-lg font-semibold">Set Up AI Features</h2>
                <p className="text-sm text-white/80">
                  {trigger
                    ? `Connect your AI provider to use ${trigger}`
                    : 'Connect your own AI provider to get started'}
                </p>
              </div>
            </div>
            <button onClick={onClose} className="rounded-lg p-1 text-white/60 hover:bg-white/10 hover:text-white">
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Step indicator */}
          <div className="mt-4 flex items-center gap-2">
            {['Choose provider', 'Add API key', 'Ready'].map((label, i) => {
              const stepIndex = step === 'choose' ? 0 : step === 'configure' ? 1 : 2;
              return (
                <div key={label} className="flex items-center gap-2">
                  <div className={`flex h-6 w-6 items-center justify-center rounded-full text-xs font-medium ${
                    i <= stepIndex ? 'bg-white text-purple-600' : 'bg-white/20 text-white/60'
                  }`}>
                    {i < stepIndex ? (
                      <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
                      </svg>
                    ) : (
                      i + 1
                    )}
                  </div>
                  <span className={`text-xs ${i <= stepIndex ? 'text-white' : 'text-white/50'}`}>{label}</span>
                  {i < 2 && <div className={`h-px w-6 ${i < stepIndex ? 'bg-white/60' : 'bg-white/20'}`} />}
                </div>
              );
            })}
          </div>
        </div>

        {/* Body */}
        <div className="p-6">
          {/* Step 1: Choose provider */}
          {step === 'choose' && (
            <div className="space-y-3">
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                Your API key is encrypted and stored securely. You pay your AI provider directly — we never charge for AI usage.
              </p>
              {PROVIDERS.map((p) => (
                <button
                  key={p.id}
                  onClick={() => { setSelectedProvider(p.id); setStep('configure'); }}
                  className={`w-full flex items-start gap-4 rounded-xl border-2 p-4 text-left transition-all hover:shadow-md ${
                    selectedProvider === p.id
                      ? 'border-purple-400 bg-purple-50 dark:bg-purple-900/20'
                      : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
                  }`}
                >
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl" style={{ backgroundColor: p.color + '15' }}>
                    <span className="text-lg font-bold" style={{ color: p.color }}>
                      {p.name[0]}
                    </span>
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold text-gray-900 dark:text-gray-100">{p.name}</span>
                      {p.id === 'openai' && (
                        <span className="rounded-full bg-green-100 px-1.5 py-0.5 text-[9px] font-medium text-green-700 dark:bg-green-900/30 dark:text-green-400">
                          Recommended
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{p.description}</p>
                    <div className="mt-2 flex flex-wrap gap-1">
                      {p.features.map((f) => (
                        <span key={f} className="rounded bg-gray-100 px-1.5 py-0.5 text-[10px] text-gray-600 dark:bg-gray-700 dark:text-gray-400">
                          {f}
                        </span>
                      ))}
                    </div>
                  </div>
                  <svg className="h-5 w-5 shrink-0 text-gray-300 dark:text-gray-600" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="m8.25 4.5 7.5 7.5-7.5 7.5" />
                  </svg>
                </button>
              ))}
            </div>
          )}

          {/* Step 2: Configure */}
          {step === 'configure' && provider && (
            <div className="space-y-4">
              <button onClick={() => setStep('choose')} className="flex items-center gap-1 text-xs text-gray-500 hover:text-gray-700 dark:hover:text-gray-300">
                <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5 8.25 12l7.5-7.5" />
                </svg>
                Back to providers
              </button>

              <div className="rounded-xl bg-gray-50 dark:bg-gray-800 p-4">
                <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-2">
                  Get your {provider.name} API key
                </h3>
                <ol className="space-y-2 text-xs text-gray-600 dark:text-gray-400">
                  <li className="flex gap-2">
                    <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-purple-100 text-[10px] font-bold text-purple-600 dark:bg-purple-900/30 dark:text-purple-400">1</span>
                    <span>Go to <a href={provider.docsUrl} target="_blank" rel="noopener noreferrer" className="text-purple-600 underline hover:text-purple-700 dark:text-purple-400">{provider.name} API Keys page</a></span>
                  </li>
                  <li className="flex gap-2">
                    <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-purple-100 text-[10px] font-bold text-purple-600 dark:bg-purple-900/30 dark:text-purple-400">2</span>
                    <span>Create a new API key (name it &ldquo;QualCanvas&rdquo;)</span>
                  </li>
                  <li className="flex gap-2">
                    <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-purple-100 text-[10px] font-bold text-purple-600 dark:bg-purple-900/30 dark:text-purple-400">3</span>
                    <span>Copy the key and paste it below</span>
                  </li>
                </ol>
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">API Key</label>
                <div className="relative">
                  <input
                    type={showKey ? 'text' : 'password'}
                    placeholder={provider.placeholder}
                    value={apiKey}
                    onChange={(e) => setApiKey(e.target.value)}
                    autoComplete="off"
                    autoFocus
                    className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 pr-10 text-sm dark:border-gray-600 dark:bg-gray-700 dark:text-white"
                  />
                  <button
                    type="button"
                    onClick={() => setShowKey(!showKey)}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  >
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" d={showKey
                        ? "M3.98 8.223A10.477 10.477 0 0 0 1.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.451 10.451 0 0 1 12 4.5c4.756 0 8.773 3.162 10.065 7.498a10.522 10.522 0 0 1-4.293 5.774M6.228 6.228 3 3m3.228 3.228 3.65 3.65m7.894 7.894L21 21m-3.228-3.228-3.65-3.65m0 0a3 3 0 1 0-4.243-4.243m4.242 4.242L9.88 9.88"
                        : "M2.036 12.322a1.012 1.012 0 0 1 0-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178ZM15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z"
                      } />
                    </svg>
                  </button>
                </div>
                <p className="mt-1.5 text-[10px] text-gray-400 dark:text-gray-500">
                  Your key is encrypted with AES-256 and never leaves our server unencrypted.
                </p>
              </div>

              {provider.limitations && (
                <div className="rounded-lg bg-amber-50 dark:bg-amber-900/20 px-3 py-2">
                  <p className="text-[11px] text-amber-700 dark:text-amber-400">
                    <strong>Note:</strong> {provider.name} doesn&apos;t support: {provider.limitations.join(', ')}. You can add an OpenAI key later for those features.
                  </p>
                </div>
              )}

              <button
                onClick={handleSave}
                disabled={saving || !apiKey.trim()}
                className="w-full rounded-lg bg-purple-600 py-2.5 text-sm font-medium text-white hover:bg-purple-700 disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {saving ? (
                  <>
                    <div className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                    Verifying key...
                  </>
                ) : (
                  'Connect & Verify'
                )}
              </button>
            </div>
          )}

          {/* Step 3: Success */}
          {step === 'success' && provider && (
            <div className="text-center py-4">
              <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-green-100 dark:bg-green-900/30">
                <svg className="h-8 w-8 text-green-500" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
                </svg>
              </div>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                You&apos;re all set!
              </h3>
              <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
                {provider.name} is connected. AI features are now available across your workspace.
              </p>
              <div className="mt-4 flex flex-wrap justify-center gap-2">
                {provider.features.map((f) => (
                  <span key={f} className="rounded-full bg-green-100 px-2.5 py-1 text-xs font-medium text-green-700 dark:bg-green-900/30 dark:text-green-400">
                    {f}
                  </span>
                ))}
              </div>
              <button
                onClick={onClose}
                className="mt-6 rounded-lg bg-purple-600 px-6 py-2.5 text-sm font-medium text-white hover:bg-purple-700"
              >
                Start Using AI
              </button>
            </div>
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
}
