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
    wizard: { open: false, reason: null, provider: null },
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

    it('re-fetches when forced (after connecting or removing a key)', async () => {
      mockGetSettings.mockResolvedValue({ data: { data: { hasApiKey: false } } } as never);
      await useAiConfigStore.getState().fetchConfig();
      mockGetSettings.mockResolvedValue({ data: { data: { hasApiKey: true, provider: 'openai' } } } as never);
      await useAiConfigStore.getState().fetchConfig({ force: true });
      expect(useAiConfigStore.getState().configured).toBe(true);
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

  describe('wizard', () => {
    it('opens with a reason and provider, and closes', () => {
      useAiConfigStore.getState().openWizard('Audio transcription', 'openai');
      expect(useAiConfigStore.getState().wizard).toEqual({
        open: true,
        reason: 'Audio transcription',
        provider: 'openai',
      });
      useAiConfigStore.getState().closeWizard();
      expect(useAiConfigStore.getState().wizard.open).toBe(false);
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
