import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * Session overrides (`?flags=...`) must never touch localStorage.
 *
 * `partialize` already excludes `overrides`, but zustand-persist writes the
 * WHOLE partialized snapshot on every `set()` - so writing an override also
 * froze that build's DEFAULT_FLAGS into the user's persisted `flags` map.
 * Because `merge` lets persisted values win over coded defaults, anyone who
 * had ever opened a `?flags=` URL (soft-launch cohort, support-issued
 * overrides, internal QA) never received another default flip again.
 */

const STORAGE_KEY = 'qualcanvas-feature-flags';

beforeEach(() => {
  localStorage.clear();
  vi.resetModules();
  window.history.replaceState({}, '', '/');
});

describe('URL flag overrides', () => {
  it('applies the override without persisting anything', async () => {
    window.history.replaceState({}, '', '/?flags=activity_bar_v2=true');
    const { applyUrlFlagOverrides, useFeatureFlagsStore } = await import('./featureFlagsStore');

    applyUrlFlagOverrides();

    expect(useFeatureFlagsStore.getState().isEnabled('activity_bar_v2')).toBe(true);
    expect(localStorage.getItem(STORAGE_KEY)).toBeNull();
  });

  it('does not pin the current defaults for a user with nothing persisted', async () => {
    window.history.replaceState({}, '', '/?flags=activity_bar_v2=true,onboarding_v2=false');
    const { applyUrlFlagOverrides } = await import('./featureFlagsStore');

    applyUrlFlagOverrides();

    // Nothing persisted means the next build's defaults still reach this user.
    expect(localStorage.getItem(STORAGE_KEY)).toBeNull();
  });

  it('leaves an already-persisted map exactly as it was', async () => {
    const persisted = JSON.stringify({ state: { flags: { onboarding_v2: false } }, version: 0 });
    localStorage.setItem(STORAGE_KEY, persisted);
    window.history.replaceState({}, '', '/?flags=activity_bar_v2=true');
    const { applyUrlFlagOverrides } = await import('./featureFlagsStore');

    applyUrlFlagOverrides();

    expect(localStorage.getItem(STORAGE_KEY)).toBe(persisted);
  });

  it('does not persist when overrides are cleared', async () => {
    const { useFeatureFlagsStore } = await import('./featureFlagsStore');

    useFeatureFlagsStore.getState().setOverride('activity_bar_v2', true);
    useFeatureFlagsStore.getState().clearOverrides();

    expect(useFeatureFlagsStore.getState().overrides).toEqual({});
    expect(localStorage.getItem(STORAGE_KEY)).toBeNull();
  });

  it('still persists a deliberate setFlag write', async () => {
    const { useFeatureFlagsStore } = await import('./featureFlagsStore');

    useFeatureFlagsStore.getState().setFlag('activity_bar_v2', true);

    const raw = localStorage.getItem(STORAGE_KEY);
    expect(raw).not.toBeNull();
    expect(JSON.parse(raw as string).state.flags.activity_bar_v2).toBe(true);
  });
});

describe('feature flag inventory', () => {
  it('has a consumer for every declared flag', async () => {
    const { useFeatureFlagsStore } = await import('./featureFlagsStore');
    const declared = Object.keys(useFeatureFlagsStore.getState().flags).sort();

    // Every flag below is read by application code. A flag with no consumer is
    // dead config that reads as a shipped gate to whoever finds it next -
    // delete it (or wire it up) rather than growing this list.
    expect(declared).toEqual(
      ['activity_bar_v2', 'fraunces_display', 'ink_ochre_palette', 'inline_ai_suggester', 'onboarding_v2'].sort(),
    );
  });
});
