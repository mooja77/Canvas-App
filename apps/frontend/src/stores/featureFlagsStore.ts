/**
 * Simple Zustand-backed feature flag store.
 *
 * Defaults are baked at code level. URL query param `?flags=name=true,other=false`
 * provides per-session overrides for QA without changing persisted state.
 *
 * When we outgrow this (need per-user / per-plan targeting beyond static checks),
 * upgrade to a GrowthBook / LaunchDarkly delivery. Keep the `useFeatureFlag` hook
 * stable so consumers don't change.
 */

import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type FeatureFlag =
  // V3 Sprint G — IA redesign
  | 'activity_bar_v2'
  // V3 Sprint F — onboarding redesign
  | 'onboarding_v2'
  // V3 Sprint H — inline AI tag suggestions
  | 'inline_ai_suggester'
  // V3 Sprint C — pricing v2 (defaults off; ship to new signups only)
  | 'pricing_v2'
  // V3 Sprint D — Krippendorff α surface
  | 'krippendorff_alpha'
  // V3 Sprint E — Trust page
  | 'trust_page'
  // Brand Tier 2 — Ink + Ochre palette
  | 'ink_ochre_palette'
  // Brand Tier 2 — Fraunces display serif
  | 'fraunces_display'
  // AI prompt upgrade — Methods Statement export
  | 'methods_statement_export'
  // V3 — typed sockets (edge validation)
  | 'typed_sockets'
  // V3 — Magic Cluster
  | 'magic_cluster'
  // V3 — Cmd+J context AI chat
  | 'ai_chat_cmd_j';

interface FeatureFlagsState {
  flags: Record<FeatureFlag, boolean>;
  overrides: Partial<Record<FeatureFlag, boolean>>;
  setFlag: (flag: FeatureFlag, enabled: boolean) => void;
  setOverride: (flag: FeatureFlag, enabled: boolean) => void;
  clearOverrides: () => void;
  isEnabled: (flag: FeatureFlag) => boolean;
}

// Sprint F + H rollout — flags flipped on for new signups once their
// respective sprints landed CI green (Sprint F: dc68c28 / 68907b2,
// Sprint H: 70d3f8a). Persisted overrides in localStorage still win, so
// existing users who already saw the old flow won't see a sudden change.
// Sprint D (Krippendorff α) also flips on — the surface is gated by
// Team plan check inside the component, so it's safe to default-enable.
const DEFAULT_FLAGS: Record<FeatureFlag, boolean> = {
  activity_bar_v2: false,
  onboarding_v2: true,
  inline_ai_suggester: true,
  pricing_v2: false,
  krippendorff_alpha: true,
  trust_page: false,
  ink_ochre_palette: false,
  fraunces_display: false,
  methods_statement_export: false,
  typed_sockets: false,
  magic_cluster: false,
  ai_chat_cmd_j: false,
};

export const useFeatureFlagsStore = create<FeatureFlagsState>()(
  persist(
    (set, get) => ({
      flags: DEFAULT_FLAGS,
      overrides: {},
      setFlag: (flag, enabled) => {
        set((s) => ({ flags: { ...s.flags, [flag]: enabled } }));
      },
      setOverride: (flag, enabled) => {
        set((s) => ({ overrides: { ...s.overrides, [flag]: enabled } }));
      },
      clearOverrides: () => set({ overrides: {} }),
      isEnabled: (flag) => {
        const { flags, overrides } = get();
        if (flag in overrides) return overrides[flag] as boolean;
        return flags[flag] ?? false;
      },
    }),
    {
      name: 'qualcanvas-feature-flags',
      partialize: (state) => ({ flags: state.flags }), // don't persist overrides
      // The whole flag map lives under one key, and zustand's default merge is
      // shallow at the TOP level - so a persisted `flags` object replaced
      // DEFAULT_FLAGS wholesale instead of filling gaps. Any flag added after a
      // user's last visit was simply absent, and `isEnabled`'s `?? false` made
      // it resolve off: features shipped default-on never reached existing
      // users, silently. (Krippendorff alpha and the inline AI suggester were
      // both dark for returning users because of this.)
      //
      // Defaults first, persisted values second: new keys get their coded
      // default, keys the user already has keep whatever they had - so the
      // deliberate case in the DEFAULT_FLAGS comment above, where someone who
      // saw the old onboarding is not yanked onto the new one, still holds.
      //
      // Deliberately NO `version` bump: zustand discards persisted state on a
      // version mismatch unless a `migrate` is supplied, which would wipe user
      // settings - worse than the bug.
      merge: (persisted, current) => ({
        ...current,
        flags: {
          ...DEFAULT_FLAGS,
          ...((persisted as { flags?: Partial<Record<FeatureFlag, boolean>> } | undefined)?.flags ?? {}),
        },
      }),
    },
  ),
);

/**
 * React hook — subscribes to a single flag.
 */
export function useFeatureFlag(flag: FeatureFlag): boolean {
  return useFeatureFlagsStore((s) => s.isEnabled(flag));
}

/**
 * Read URL `?flags=...` and apply as session overrides.
 * Call this once at app startup (e.g. in main.tsx after store hydration).
 */
export function applyUrlFlagOverrides() {
  if (typeof window === 'undefined') return;
  const params = new URLSearchParams(window.location.search);
  const flagsParam = params.get('flags');
  if (!flagsParam) return;
  const setOverride = useFeatureFlagsStore.getState().setOverride;
  for (const kv of flagsParam.split(',')) {
    const [name, value] = kv.split('=');
    if (!name) continue;
    setOverride(name.trim() as FeatureFlag, value !== 'false');
  }
}
