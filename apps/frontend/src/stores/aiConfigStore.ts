import { create } from 'zustand';
import { aiSettingsApi } from '../services/api';

/**
 * The researcher's own AI account (QualCanvas never supplies a paid key), and
 * the "Connect your AI account" wizard, which any screen can open.
 */
interface AiConfigState {
  configured: boolean;
  provider: string | null;
  loaded: boolean;
  /** Open wizard, with what the user was trying to do when it opened. */
  wizard: { open: boolean; reason: string | null; provider: 'openai' | 'anthropic' | 'google' | null };
  setConfigured: (configured: boolean, provider?: string) => void;
  fetchConfig: (opts?: { force?: boolean }) => Promise<void>;
  openWizard: (reason?: string, provider?: 'openai' | 'anthropic' | 'google') => void;
  closeWizard: () => void;
}

export const useAiConfigStore = create<AiConfigState>()((set, get) => ({
  configured: false,
  provider: null,
  loaded: false,
  wizard: { open: false, reason: null, provider: null },

  setConfigured: (configured, provider) => set({ configured, provider: provider || null }),

  fetchConfig: async (opts) => {
    if (get().loaded && !opts?.force) return;
    try {
      const res = await aiSettingsApi.getSettings();
      const data = res.data.data;
      set({ configured: data?.hasApiKey || false, provider: data?.provider || null, loaded: true });
    } catch {
      set({ configured: false, provider: null, loaded: true });
    }
  },

  openWizard: (reason, provider) => set({ wizard: { open: true, reason: reason ?? null, provider: provider ?? null } }),
  closeWizard: () => set({ wizard: { open: false, reason: null, provider: null } }),
}));
