import { describe, it, expect, beforeEach, vi } from 'vitest';
import { useAiConfigStore } from './aiConfigStore';

vi.mock('../services/api', () => ({
  aiSettingsApi: {
    getSettings: vi.fn(),
  },
}));

import { aiSettingsApi } from '../services/api';

const mockGetSettings = vi.mocked(aiSettingsApi.getSettings);

function resetStore() {
  useAiConfigStore.setState({
    configured: false,
    provider: null,
    loaded: false,
  });
}

describe('aiConfigStore', () => {
  beforeEach(() => {
    resetStore();
    vi.clearAllMocks();
  });

  describe('initial state', () => {
    it('is not configured and not loaded', () => {
      const state = useAiConfigStore.getState();
      expect(state.configured).toBe(false);
      expect(state.provider).toBeNull();
      expect(state.loaded).toBe(false);
    });
  });

  describe('fetchConfig', () => {
    it('sets configured=true when API returns config with hasApiKey', async () => {
      mockGetSettings.mockResolvedValue({
        data: { data: { hasApiKey: true, provider: 'openai' } },
      } as never);

      await useAiConfigStore.getState().fetchConfig();

      const state = useAiConfigStore.getState();
      expect(state.configured).toBe(true);
      expect(state.loaded).toBe(true);
    });

    it('sets configured=false when API returns no key', async () => {
      mockGetSettings.mockResolvedValue({
        data: { data: { hasApiKey: false, provider: null } },
      } as never);

      await useAiConfigStore.getState().fetchConfig();

      const state = useAiConfigStore.getState();
      expect(state.configured).toBe(false);
      expect(state.loaded).toBe(true);
    });

    it('sets provider name from API response', async () => {
      mockGetSettings.mockResolvedValue({
        data: { data: { hasApiKey: true, provider: 'anthropic' } },
      } as never);

      await useAiConfigStore.getState().fetchConfig();

      expect(useAiConfigStore.getState().provider).toBe('anthropic');
    });

    it('handles network error gracefully', async () => {
      mockGetSettings.mockRejectedValue(new Error('Network error'));

      await useAiConfigStore.getState().fetchConfig();

      const state = useAiConfigStore.getState();
      expect(state.configured).toBe(false);
      expect(state.provider).toBeNull();
      expect(state.loaded).toBe(true);
    });

    it('does not re-fetch if already loaded', async () => {
      mockGetSettings.mockResolvedValue({
        data: { data: { hasApiKey: true, provider: 'openai' } },
      } as never);

      await useAiConfigStore.getState().fetchConfig();
      await useAiConfigStore.getState().fetchConfig();

      expect(mockGetSettings).toHaveBeenCalledTimes(1);
    });
  });

  describe('setConfigured', () => {
    it('manually sets configured and provider', () => {
      useAiConfigStore.getState().setConfigured(true, 'openai');

      const state = useAiConfigStore.getState();
      expect(state.configured).toBe(true);
      expect(state.provider).toBe('openai');
    });
  });
});
