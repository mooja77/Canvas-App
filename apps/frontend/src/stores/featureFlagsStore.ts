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

const DEFAULT_FLAGS: Record<FeatureFlag, boolean> = {
  activity_bar_v2: false,
  onboarding_v2: false,
  inline_ai_suggester: false,
  pricing_v2: false,
  krippendorff_alpha: false,
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
