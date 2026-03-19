import { create } from 'zustand';
import { aiSettingsApi } from '../services/api';

interface AiConfigState {
  configured: boolean;
  provider: string | null;
  loaded: boolean;
  setConfigured: (configured: boolean, provider?: string) => void;
  fetchConfig: () => Promise<void>;
}

export const useAiConfigStore = create<AiConfigState>()((set, get) => ({
  configured: false,
  provider: null,
  loaded: false,

  setConfigured: (configured, provider) =>
    set({ configured, provider: provider || null }),

  fetchConfig: async () => {
    if (get().loaded) return;
    try {
      const res = await aiSettingsApi.getSettings();
      const data = res.data.data;
      set({
        configured: data?.hasApiKey || false,
        provider: data?.provider || null,
        loaded: true,
      });
    } catch {
      set({ configured: false, provider: null, loaded: true });
    }
  },
}));
