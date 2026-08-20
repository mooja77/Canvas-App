import { describe, it, expect, beforeEach, vi } from 'vitest';

/**
 * Regression cover for a class of bug CI is structurally blind to: state
 * persisted by an OLDER build being rehydrated into a newer one. Every normal
 * test run starts with an empty localStorage, so this only ever bites real
 * returning users after a deploy.
 *
 * The specific trap: zustand's default merge is shallow at the TOP level. A
 * store that nests its whole settings map under one key (`flags`, `shortcuts`)
 * therefore had that key REPLACED by the persisted value rather than merged
 * into, so anything added since the user's last visit vanished.
 */

// A flags payload written before inline_ai_suggester and the Brand Tier 2
// flags existed. onboarding_v2 was explicitly turned off for this user, which
// must survive.
const OLD_FLAGS_PAYLOAD = JSON.stringify({
  state: { flags: { activity_bar_v2: false, onboarding_v2: false } },
  version: 0,
});

beforeEach(() => {
  localStorage.clear();
  vi.resetModules();
});

describe('featureFlagsStore rehydration from an older build', () => {
  it('gives flags added since the last visit their coded default', async () => {
    localStorage.setItem('qualcanvas-feature-flags', OLD_FLAGS_PAYLOAD);
    const { useFeatureFlagsStore } = await import('./featureFlagsStore');
    const state = useFeatureFlagsStore.getState();

    // Defaults to true in code. Before the merge fix this resolved false, so
    // the feature was dark for every returning user.
    expect(state.isEnabled('inline_ai_suggester')).toBe(true);
  });

  it('keeps every flag key present, not just the persisted subset', async () => {
    localStorage.setItem('qualcanvas-feature-flags', OLD_FLAGS_PAYLOAD);
    const { useFeatureFlagsStore } = await import('./featureFlagsStore');
    const keys = Object.keys(useFeatureFlagsStore.getState().flags);

    expect(keys).toContain('ink_ochre_palette');
    expect(keys.length).toBeGreaterThan(2);
  });

  it('still lets a persisted value win over the coded default', async () => {
    localStorage.setItem('qualcanvas-feature-flags', OLD_FLAGS_PAYLOAD);
    const { useFeatureFlagsStore } = await import('./featureFlagsStore');

    // onboarding_v2 defaults to true in code but this user opted out of the new
    // flow. Deliberate behaviour: do not yank them onto it.
    expect(useFeatureFlagsStore.getState().isEnabled('onboarding_v2')).toBe(false);
  });

  it('is unaffected when there is nothing persisted', async () => {
    const { useFeatureFlagsStore } = await import('./featureFlagsStore');
    expect(useFeatureFlagsStore.getState().isEnabled('inline_ai_suggester')).toBe(true);
    expect(useFeatureFlagsStore.getState().isEnabled('activity_bar_v2')).toBe(false);
  });
});

describe('shortcutStore rehydration from an older build', () => {
  it('restores shortcuts added since the last visit while keeping rebindings', async () => {
    const fresh = await import('./shortcutStore');
    const defaults = Object.keys(fresh.useShortcutStore.getState().shortcuts);
    expect(defaults.length).toBeGreaterThan(1);

    const [firstAction] = defaults;
    vi.resetModules();
    localStorage.setItem(
      'qualcanvas-shortcuts',
      JSON.stringify({ state: { shortcuts: { [firstAction]: 'mod+shift+9' } }, version: 0 }),
    );

    const { useShortcutStore } = await import('./shortcutStore');
    const shortcuts = useShortcutStore.getState().shortcuts;

    // The user's own rebinding survives...
    expect(shortcuts[firstAction]).toBe('mod+shift+9');
    // ...and every other shortcut is still present rather than dropped.
    expect(Object.keys(shortcuts).sort()).toEqual(defaults.sort());
  });
});
