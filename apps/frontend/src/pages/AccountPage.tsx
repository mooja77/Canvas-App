import { useState, useEffect } from 'react';
import { useNavigate, Link, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuthStore } from '../stores/authStore';
import { authApi, billingApi, aiSettingsApi } from '../services/api';
import { usePageMeta } from '../hooks/usePageMeta';
import toast from 'react-hot-toast';

interface UserProfile {
  user: {
    id?: string;
    email?: string;
    name: string;
    role: string;
    plan: string;
    emailVerified?: boolean;
    createdAt?: string;
  };
  subscription: {
    status: string;
    currentPeriodEnd: string;
    cancelAtPeriodEnd: boolean;
  } | null;
  usage: {
    canvasCount: number;
    totalTranscripts: number;
    totalCodes: number;
    totalShares: number;
  } | null;
  authType: string;
}

export default function AccountPage() {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { authenticated, logout, authType: _authType } = useAuthStore();
  usePageMeta('Account — QualCanvas', 'Manage your QualCanvas account, profile, plan, and billing.');

  // Edit profile state
  const [editName, setEditName] = useState('');
  const [editEmail, setEditEmail] = useState('');
  const [savingProfile, setSavingProfile] = useState(false);

  // Change password state
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [savingPassword, setSavingPassword] = useState(false);

  // Delete account state
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deletePassword, setDeletePassword] = useState('');
  const [deleting, setDeleting] = useState(false);

  // AI Settings state
  const [aiProvider, setAiProvider] = useState('openai');
  const [aiApiKey, setAiApiKey] = useState('');
  const [aiModel, setAiModel] = useState('');
  const [aiHasKey, setAiHasKey] = useState(false);
  const [aiSaving, setAiSaving] = useState(false);
  const [_aiTesting, _setAiTesting] = useState(false);
  const [showAiKey, setShowAiKey] = useState(false);

  // Post-upgrade welcome state
  const [searchParams, setSearchParams] = useSearchParams();
  const [showWelcome, setShowWelcome] = useState(false);

  useEffect(() => {
    if (searchParams.get('session_id')) {
      setShowWelcome(true);
      // Clean the URL
      searchParams.delete('session_id');
      setSearchParams(searchParams, { replace: true });
      // Auto-dismiss after 10 seconds
      const timer = setTimeout(() => setShowWelcome(false), 10000);
      return () => clearTimeout(timer);
    }
  }, [searchParams, setSearchParams]);

  useEffect(() => {
    if (!authenticated) {
      navigate('/login');
      return;
    }
    authApi.getMe()
      .then(res => {
        const data = res.data.data;
        setProfile(data);
        setEditName(data.user.name);
        setEditEmail(data.user.email || '');
      })
      .catch(() => toast.error('Failed to load profile'))
      .finally(() => setLoading(false));

    // Load AI settings
    aiSettingsApi.getSettings()
      .then(res => {
        const data = res.data.data;
        if (data) {
          setAiProvider(data.provider || 'openai');
          setAiModel(data.model || '');
          setAiHasKey(data.hasApiKey || false);
        }
      })
      .catch(() => { /* no AI config yet */ });
  }, [authenticated, navigate]);

  const handleManageBilling = async () => {
    try {
      const res = await billingApi.createPortal();
      const { url } = res.data.data;
      if (url) window.location.href = url;
    } catch {
      toast.error('Failed to open billing portal');
    }
  };

  const handleSaveProfile = async () => {
    if (!editName.trim()) return;
    setSavingProfile(true);
    try {
      const data: Record<string, string> = {};
      if (editName.trim() !== profile?.user.name) data.name = editName.trim();
      if (editEmail.trim() !== profile?.user.email) data.email = editEmail.trim();
      if (Object.keys(data).length === 0) {
        toast('No changes to save');
        return;
      }
      const res = await authApi.updateProfile(data);
      setProfile(prev => prev ? { ...prev, user: { ...prev.user, ...res.data.data } } : prev);
      toast.success('Profile updated');
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Failed to update profile');
    } finally {
      setSavingProfile(false);
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword !== confirmPassword) {
      toast.error('Passwords do not match');
      return;
    }
    if (newPassword.length < 8) {
      toast.error('Password must be at least 8 characters');
      return;
    }
    setSavingPassword(true);
    try {
      await authApi.changePassword(currentPassword, newPassword);
      toast.success('Password changed');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Failed to change password');
    } finally {
      setSavingPassword(false);
    }
  };

  const handleDeleteAccount = async () => {
    if (!deletePassword) return;
    setDeleting(true);
    try {
      await authApi.deleteAccount(deletePassword);
      toast.success('Account deleted');
      logout();
      navigate('/');
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Failed to delete account');
    } finally {
      setDeleting(false);
    }
  };

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
        <p className="text-gray-500">Loading...</p>
      </div>
    );
  }

  if (!profile) return null;

  const planLabel = profile.user.plan === 'free' ? 'Free' : profile.user.plan === 'pro' ? 'Pro' : 'Team';
  const isEmailAuth = profile.authType === 'email';

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="max-w-2xl mx-auto px-4 py-12">
        <div className="flex items-center justify-between mb-8">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">{t('account.title')}</h1>
          <Link to="/canvas" className="text-sm text-brand-600 dark:text-brand-400 hover:underline">
            Back to canvas
          </Link>
        </div>

        {showWelcome && (
          <div
            className="mb-6 p-4 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-xl flex items-start gap-3 animate-slide-down cursor-pointer"
            onClick={() => setShowWelcome(false)}
            role="status"
          >
            <svg className="w-6 h-6 text-green-600 dark:text-green-400 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12c0 1.268-.63 2.39-1.593 3.068a3.745 3.745 0 01-1.043 3.296 3.745 3.745 0 01-3.296 1.043A3.745 3.745 0 0112 21c-1.268 0-2.39-.63-3.068-1.593a3.746 3.746 0 01-3.296-1.043 3.745 3.745 0 01-1.043-3.296A3.745 3.745 0 013 12c0-1.268.63-2.39 1.593-3.068a3.745 3.745 0 011.043-3.296 3.746 3.746 0 013.296-1.043A3.746 3.746 0 0112 3c1.268 0 2.39.63 3.068 1.593a3.746 3.746 0 013.296 1.043 3.745 3.745 0 011.043 3.296A3.745 3.745 0 0121 12z" />
            </svg>
            <div>
              <p className="font-semibold text-green-800 dark:text-green-200">Welcome to Pro!</p>
              <p className="text-sm text-green-700 dark:text-green-300 mt-0.5">
                You now have unlimited canvases, all analysis tools, and more. Click to dismiss.
              </p>
            </div>
          </div>
        )}

        {/* Edit Profile */}
        <div className="bg-white dark:bg-gray-800 rounded-xl ring-1 ring-gray-200 dark:ring-gray-700 p-6 mb-6">
          <h2 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-4">{t('account.profile')}</h2>
          {isEmailAuth ? (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t('account.name')}</label>
                <input
                  type="text"
                  value={editName}
                  onChange={e => setEditName(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-brand-500 focus:border-transparent text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Email
                  {profile.user.emailVerified !== undefined && (
                    <>
                      <span className={`ml-2 text-xs font-normal ${profile.user.emailVerified ? 'text-green-600 dark:text-green-400' : 'text-amber-600 dark:text-amber-400'}`}>
                        {profile.user.emailVerified ? 'Verified' : 'Unverified'}
                      </span>
                      {!profile.user.emailVerified && (
                        <button
                          type="button"
                          onClick={async () => {
                            try {
                              await authApi.updateProfile({ email: profile.user.email });
                              toast.success('Verification email sent');
                            } catch {
                              toast.error('Failed to send verification email');
                            }
                          }}
                          className="ml-2 text-xs text-brand-600 dark:text-brand-400 hover:underline font-normal"
                        >
                          Resend verification
                        </button>
                      )}
                    </>
                  )}
                </label>
                <input
                  type="email"
                  value={editEmail}
                  onChange={e => setEditEmail(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-brand-500 focus:border-transparent text-sm"
                />
              </div>
              <button
                onClick={handleSaveProfile}
                disabled={savingProfile}
                className="px-4 py-2 bg-brand-600 hover:bg-brand-700 text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-50"
              >
                {savingProfile ? t('common.loading') : t('account.saveChanges')}
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="flex justify-between">
                <span className="text-sm text-gray-600 dark:text-gray-400">Name</span>
                <span className="text-sm font-medium text-gray-900 dark:text-white">{profile.user.name}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-gray-600 dark:text-gray-400">Account type</span>
                <span className="text-sm font-medium text-gray-900 dark:text-white">Access Code (Legacy)</span>
              </div>
              <div className="mt-4 p-3 bg-amber-50 dark:bg-amber-900/20 rounded-lg">
                <p className="text-sm text-amber-800 dark:text-amber-200">
                  Add an email to secure your account and access billing features.
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Plan & Subscription */}
        <div className="bg-white dark:bg-gray-800 rounded-xl ring-1 ring-gray-200 dark:ring-gray-700 p-6 mb-6">
          <h2 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-4">{t('account.planSection')}</h2>
          <div className="flex items-center justify-between mb-4">
            <span className={`inline-block text-xs font-semibold px-2.5 py-1 rounded-full ${
              profile.user.plan === 'free'
                ? 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300'
                : 'bg-brand-100 dark:bg-brand-900/30 text-brand-700 dark:text-brand-300'
            }`}>
              {planLabel}
            </span>
            {profile.user.plan === 'free' && (
              <Link to="/pricing" className="text-sm text-brand-600 dark:text-brand-400 hover:underline font-medium">
                Upgrade
              </Link>
            )}
          </div>
          {profile.subscription && (
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-600 dark:text-gray-400">Status</span>
                <span className={`font-medium ${
                  profile.subscription.status === 'active' ? 'text-green-600 dark:text-green-400' : 'text-amber-600 dark:text-amber-400'
                }`}>
                  {profile.subscription.status}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600 dark:text-gray-400">Next billing date</span>
                <span className="text-gray-900 dark:text-white">
                  {new Date(profile.subscription.currentPeriodEnd).toLocaleDateString()}
                </span>
              </div>
              {profile.subscription.cancelAtPeriodEnd && (
                <p className="text-amber-600 dark:text-amber-400 text-xs">
                  Cancels at end of billing period
                </p>
              )}
              <button
                onClick={handleManageBilling}
                className="mt-2 text-sm text-brand-600 dark:text-brand-400 hover:underline"
              >
                Manage subscription
              </button>
            </div>
          )}
        </div>

        {/* Usage */}
        {profile.usage && (
          <div className="bg-white dark:bg-gray-800 rounded-xl ring-1 ring-gray-200 dark:ring-gray-700 p-6 mb-6">
            <h2 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-4">{t('account.usageSection')}</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {(() => {
                const limits = profile.user.plan === 'free'
                  ? { canvases: 1, transcripts: 2, codes: 5, shares: 0 }
                  : null;
                const items = [
                  { label: 'Canvases', value: profile.usage.canvasCount, max: limits?.canvases },
                  { label: 'Transcripts', value: profile.usage.totalTranscripts, max: limits?.transcripts },
                  { label: 'Codes', value: profile.usage.totalCodes, max: limits?.codes },
                  { label: 'Share codes', value: profile.usage.totalShares, max: limits?.shares },
                ];
                return items.map(item => (
                  <div key={item.label} className="text-center p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                    <p className="text-2xl font-bold text-gray-900 dark:text-white">
                      {item.max !== undefined ? `${item.value}/${item.max}` : item.value}
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">{item.label}</p>
                    {item.max !== undefined && item.max > 0 && (
                      <div className="mt-2 h-1.5 bg-gray-200 dark:bg-gray-600 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all ${
                            item.value / item.max >= 0.8 ? 'bg-red-500' :
                            item.value / item.max >= 0.5 ? 'bg-amber-500' : 'bg-green-500'
                          }`}
                          style={{ width: `${Math.min(100, (item.value / item.max) * 100)}%` }}
                        />
                      </div>
                    )}
                  </div>
                ));
              })()}
            </div>
          </div>
        )}

        {/* AI Settings */}
        {isEmailAuth && (
          <div className="bg-white dark:bg-gray-800 rounded-xl ring-1 ring-gray-200 dark:ring-gray-700 p-6 mb-6">
            <div className="flex items-center gap-2 mb-4">
              <svg className="h-4 w-4 text-purple-500" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904 9 18.75l-.813-2.846a4.5 4.5 0 0 0-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 0 0 3.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 0 0 3.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 0 0-3.09 3.09Z" />
              </svg>
              <h2 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">AI Settings</h2>
            </div>
            <p className="text-xs text-gray-500 dark:text-gray-400 mb-4">
              Connect your own AI provider API key to use AI-powered features like coding suggestions, research assistant, and transcription. Your key is encrypted and never shared.
            </p>

            <div className="space-y-3">
              {/* Provider */}
              <div>
                <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Provider</label>
                <select
                  value={aiProvider}
                  onChange={e => { setAiProvider(e.target.value); setAiApiKey(''); }}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
                >
                  <option value="openai">OpenAI (GPT-4o, Whisper transcription)</option>
                  <option value="anthropic">Anthropic (Claude)</option>
                  <option value="google">Google (Gemini)</option>
                </select>
              </div>

              {/* API Key */}
              <div>
                <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
                  API Key {aiHasKey && !aiApiKey && <span className="text-green-500 ml-1">configured</span>}
                </label>
                <div className="relative">
                  <input
                    type={showAiKey ? 'text' : 'password'}
                    placeholder={aiHasKey ? 'Enter new key to change...' : aiProvider === 'openai' ? 'sk-...' : aiProvider === 'anthropic' ? 'sk-ant-...' : 'AI...'}
                    value={aiApiKey}
                    onChange={e => setAiApiKey(e.target.value)}
                    autoComplete="off"
                    className="w-full px-3 py-2 pr-10 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
                  />
                  <button
                    type="button"
                    onClick={() => setShowAiKey(!showAiKey)}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  >
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                      {showAiKey ? (
                        <path strokeLinecap="round" strokeLinejoin="round" d="M3.98 8.223A10.477 10.477 0 0 0 1.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.451 10.451 0 0 1 12 4.5c4.756 0 8.773 3.162 10.065 7.498a10.522 10.522 0 0 1-4.293 5.774M6.228 6.228 3 3m3.228 3.228 3.65 3.65m7.894 7.894L21 21m-3.228-3.228-3.65-3.65m0 0a3 3 0 1 0-4.243-4.243m4.242 4.242L9.88 9.88" />
                      ) : (
                        <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 0 1 0-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178ZM15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
                      )}
                    </svg>
                  </button>
                </div>
              </div>

              {/* Model (optional) */}
              <div>
                <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Model (optional)</label>
                <input
                  type="text"
                  placeholder={aiProvider === 'openai' ? 'gpt-4o-mini' : aiProvider === 'anthropic' ? 'claude-sonnet-4-20250514' : 'gemini-2.0-flash'}
                  value={aiModel}
                  onChange={e => setAiModel(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
                />
              </div>

              {/* Provider-specific note */}
              <div className="rounded-lg bg-gray-50 dark:bg-gray-700/50 px-3 py-2">
                <p className="text-[11px] text-gray-500 dark:text-gray-400">
                  {aiProvider === 'openai' && 'OpenAI supports all AI features: coding suggestions, chat, summaries, embeddings, and audio transcription.'}
                  {aiProvider === 'anthropic' && 'Anthropic supports coding suggestions, chat, and summaries. Transcription and embeddings (RAG indexing) require an OpenAI key.'}
                  {aiProvider === 'google' && 'Google supports coding suggestions, chat, summaries, and embeddings. Transcription requires an OpenAI key.'}
                </p>
              </div>

              {/* Actions */}
              <div className="flex items-center gap-2 pt-1">
                <button
                  onClick={async () => {
                    if (!aiApiKey && !aiHasKey) { toast.error('Enter an API key'); return; }
                    if (!aiApiKey && aiHasKey) { toast('No changes — key already configured'); return; }
                    setAiSaving(true);
                    try {
                      await aiSettingsApi.updateSettings({
                        provider: aiProvider,
                        apiKey: aiApiKey,
                        model: aiModel || undefined,
                      });
                      setAiHasKey(true);
                      setAiApiKey('');
                      toast.success('AI settings saved and key verified');
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (err: any) {
                      toast.error(err.response?.data?.error || 'Failed to save AI settings');
                    } finally {
                      setAiSaving(false);
                    }
                  }}
                  disabled={aiSaving || (!aiApiKey && !aiHasKey)}
                  className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-50"
                >
                  {aiSaving ? 'Verifying & saving...' : 'Save AI Settings'}
                </button>
                {aiHasKey && (
                  <button
                    onClick={async () => {
                      try {
                        await aiSettingsApi.deleteSettings();
                        setAiHasKey(false);
                        setAiApiKey('');
                        setAiModel('');
                        toast.success('API key removed');
                      } catch {
                        toast.error('Failed to remove key');
                      }
                    }}
                    className="px-3 py-2 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 text-sm rounded-lg transition-colors"
                  >
                    Remove Key
                  </button>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Change Password */}
        {isEmailAuth && (
          <div className="bg-white dark:bg-gray-800 rounded-xl ring-1 ring-gray-200 dark:ring-gray-700 p-6 mb-6">
            <h2 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-4">{t('account.changePassword')}</h2>
            <form onSubmit={handleChangePassword} className="space-y-3">
              <input
                type="password"
                placeholder="Current password"
                value={currentPassword}
                onChange={e => setCurrentPassword(e.target.value)}
                autoComplete="current-password"
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-brand-500 focus:border-transparent"
              />
              <input
                type="password"
                placeholder="New password (min 8 characters)"
                value={newPassword}
                onChange={e => setNewPassword(e.target.value)}
                autoComplete="new-password"
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-brand-500 focus:border-transparent"
              />
              <input
                type="password"
                placeholder="Confirm new password"
                value={confirmPassword}
                onChange={e => setConfirmPassword(e.target.value)}
                autoComplete="new-password"
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-brand-500 focus:border-transparent"
              />
              <button
                type="submit"
                disabled={savingPassword || !currentPassword || !newPassword || !confirmPassword}
                className="px-4 py-2 bg-brand-600 hover:bg-brand-700 text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-50"
              >
                {savingPassword ? 'Changing...' : 'Change Password'}
              </button>
            </form>
          </div>
        )}

        <button
          onClick={handleLogout}
          className="w-full py-3 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 font-medium text-sm transition-colors mb-6"
        >
          Sign Out
        </button>

        {/* Danger Zone */}
        {isEmailAuth && (
          <div className="bg-white dark:bg-gray-800 rounded-xl ring-2 ring-red-200 dark:ring-red-900/50 p-6">
            <h2 className="text-sm font-semibold text-red-600 dark:text-red-400 uppercase tracking-wider mb-2">{t('account.dangerZone')}</h2>
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
              Permanently delete your account and all associated data. This action cannot be undone.
            </p>
            {!showDeleteConfirm ? (
              <button
                onClick={() => setShowDeleteConfirm(true)}
                className="px-4 py-2 border border-red-300 dark:border-red-700 text-red-600 dark:text-red-400 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 text-sm font-medium transition-colors"
              >
                Delete Account
              </button>
            ) : (
              <div className="space-y-3 p-4 bg-red-50 dark:bg-red-900/10 rounded-lg">
                <p className="text-sm text-red-700 dark:text-red-300 font-medium">
                  Enter your password to confirm account deletion:
                </p>
                <input
                  type="password"
                  placeholder="Your password"
                  value={deletePassword}
                  onChange={e => setDeletePassword(e.target.value)}
                  className="w-full px-3 py-2 border border-red-300 dark:border-red-700 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-red-500 focus:border-transparent"
                />
                <div className="flex gap-3">
                  <button
                    onClick={() => { setShowDeleteConfirm(false); setDeletePassword(''); }}
                    className="flex-1 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg text-sm font-medium hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleDeleteAccount}
                    disabled={deleting || !deletePassword}
                    className="flex-1 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
                  >
                    {deleting ? 'Deleting...' : 'Delete Forever'}
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
