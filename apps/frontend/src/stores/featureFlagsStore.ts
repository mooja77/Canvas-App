/**
 * Simple Zustand-backed feature flag store.
 *
 * Defaults are baked at code level. URL query param `?flags=name=true,other=false`
 * provides per-session overrides for QA without changing persisted state.
 *
 * When we outgrow this (need per-user / per-plan targeting beyond static checks),
 * upgrade to a GrowthBook / LaunchDarkly delivery. Keep the `useFeatureFlag` hook
 * stable so consumers don't change.
 *
 * Every flag declared here MUST have a consumer. A flag nothing reads is dead
 * config that looks like a shipped gate to the next person who finds it -
 * `featureFlagsStore.test.ts` asserts the inventory to keep that honest.
 */

import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

export type FeatureFlag =
  // V3 Sprint G - IA redesign (read by CanvasPage / ActivityBar)
  | 'activity_bar_v2'
  // V3 Sprint F - onboarding redesign (read by CanvasPage)
  | 'onboarding_v2'
  // V3 Sprint H - inline AI tag suggestions (read by CanvasWorkspace)
  | 'inline_ai_suggester'
  // Brand Tier 2 - Ink + Ochre palette (read by main.tsx / PageShell)
  | 'ink_ochre_palette'
  // Brand Tier 2 - Fraunces display serif (read by main.tsx / PageShell)
  | 'fraunces_display';

interface FeatureFlagsState {
  flags: Record<FeatureFlag, boolean>;
  overrides: Partial<Record<FeatureFlag, boolean>>;
  setFlag: (flag: FeatureFlag, enabled: boolean) => void;
  setOverride: (flag: FeatureFlag, enabled: boolean) => void;
  clearOverrides: () => void;
  isEnabled: (flag: FeatureFlag) => boolean;
}

// Sprint F + H rollout - flags flipped on for new signups once their
// respective sprints landed CI green (Sprint F: dc68c28 / 68907b2,
// Sprint H: 70d3f8a). Persisted overrides in localStorage still win, so
// existing users who already saw the old flow won't see a sudden change.
const DEFAULT_FLAGS: Record<FeatureFlag, boolean> = {
  activity_bar_v2: false,
  onboarding_v2: true,
  inline_ai_suggester: true,
  ink_ochre_palette: false,
  fraunces_display: false,
};

const STORAGE_KEY = 'qualcanvas-feature-flags';

// Session overrides must not reach localStorage. `partialize` already drops
// the `overrides` key, but zustand-persist writes the ENTIRE partialized
// snapshot on every set() - so writing an override also froze that build's
// DEFAULT_FLAGS into the user's persisted `flags` map. Since `merge` lets
// persisted values win over coded defaults, anyone who had ever opened a
// `?flags=` URL (soft-launch cohort, support-issued overrides, internal QA)
// stopped receiving default flips for good.
//
// A guarded storage is the smallest fix that keeps the store shape and the
// public API intact: override actions run inside `withoutPersisting`, and the
// setItem that zustand fires synchronously right after their set() is dropped.
let suppressPersist = false;

function withoutPersisting<T>(fn: () => T): T {
  suppressPersist = true;
  try {
    return fn();
  } finally {
    suppressPersist = false;
  }
}

const guardedStorage = createJSONStorage(() => ({
  getItem: (name: string) => (typeof localStorage === 'undefined' ? null : localStorage.getItem(name)),
  setItem: (name: string, value: string) => {
    if (suppressPersist || typeof localStorage === 'undefined') return;
    localStorage.setItem(name, value);
  },
  removeItem: (name: string) => {
    if (typeof localStorage === 'undefined') return;
    localStorage.removeItem(name);
  },
}));

export const useFeatureFlagsStore = create<FeatureFlagsState>()(
  persist(
    (set, get) => ({
      flags: DEFAULT_FLAGS,
      overrides: {},
      setFlag: (flag, enabled) => {
        set((s) => ({ flags: { ...s.flags, [flag]: enabled } }));
      },
      setOverride: (flag, enabled) => {
        withoutPersisting(() => set((s) => ({ overrides: { ...s.overrides, [flag]: enabled } })));
      },
      clearOverrides: () => withoutPersisting(() => set({ overrides: {} })),
      isEnabled: (flag) => {
        const { flags, overrides } = get();
        if (flag in overrides) return overrides[flag] as boolean;
        return flags[flag] ?? false;
      },
    }),
    {
      name: STORAGE_KEY,
      storage: guardedStorage,
      partialize: (state) => ({ flags: state.flags }), // don't persist overrides
      // The whole flag map lives under one key, and zustand's default merge is
      // shallow at the TOP level - so a persisted `flags` object replaced
      // DEFAULT_FLAGS wholesale instead of filling gaps. Any flag added after a
      // user's last visit was simply absent, and `isEnabled`'s `?? false` made
      // it resolve off: features shipped default-on never reached existing
      // users, silently. (The inline AI suggester was dark for returning users
      // because of this.)
      //
      // Defaults first, persisted values second: new keys get their coded
      // default, keys the user already has keep whatever they had - so the
      // deliberate case in the DEFAULT_FLAGS comment above, where someone who
      // saw the old onboarding is not yanked onto the new one, still holds.
      // Keys no longer declared are dropped, so a retired flag doesn't live on
      // in localStorage forever.
      //
      // Deliberately NO `version` bump: zustand discards persisted state on a
      // version mismatch unless a `migrate` is supplied, which would wipe user
      // settings - worse than the bug.
      merge: (persisted, current) => {
        const persistedFlags =
          (persisted as { flags?: Partial<Record<FeatureFlag, boolean>> } | undefined)?.flags ?? {};
        const flags = { ...DEFAULT_FLAGS };
        for (const key of Object.keys(DEFAULT_FLAGS) as FeatureFlag[]) {
          const value = persistedFlags[key];
          if (typeof value === 'boolean') flags[key] = value;
        }
        return { ...current, flags };
      },
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
 *
 * Unknown flag names are ignored: a stale bookmark for a retired flag must not
 * inject junk keys into the store.
 */
export function applyUrlFlagOverrides() {
  if (typeof window === 'undefined') return;
  const params = new URLSearchParams(window.location.search);
  const flagsParam = params.get('flags');
  if (!flagsParam) return;
  const setOverride = useFeatureFlagsStore.getState().setOverride;
  for (const kv of flagsParam.split(',')) {
    const [name, value] = kv.split('=');
    const flag = name?.trim();
    if (!flag || !(flag in DEFAULT_FLAGS)) continue;
    setOverride(flag as FeatureFlag, value !== 'false');
  }
}
