import { create } from 'zustand';
import { persist } from 'zustand/middleware';

/**
 * Marketing-only three-state theme preference. The canvas app keeps its own
 * binary `darkMode` in useUIStore; this store layers a "system" option on top
 * for the marketing ThemeToggle (system/light/dark cycle) per
 * docs/refresh/06-pages/14-site-footer.md.
 *
 * Setting the preference also updates document.documentElement.classList:
 * - 'system' resolves via prefers-color-scheme and toggles .dark accordingly.
 * - 'light' / 'dark' set .dark explicitly and ignore system.
 *
 * The marketing toggle reads `preference` (one of three states); existing
 * canvas dark-mode listeners on useUIStore are unaffected.
 */

export type ThemePreference = 'system' | 'light' | 'dark';

interface ThemePreferenceState {
  preference: ThemePreference;
  setPreference: (next: ThemePreference) => void;
}

const resolveSystemDark = (): boolean =>
  typeof window !== 'undefined' && window.matchMedia?.('(prefers-color-scheme: dark)').matches === true;

const applyTheme = (preference: ThemePreference) => {
  if (typeof document === 'undefined') return;
  const shouldBeDark = preference === 'dark' || (preference === 'system' && resolveSystemDark());
  document.documentElement.classList.toggle('dark', shouldBeDark);
};

export const useThemePreferenceStore = create<ThemePreferenceState>()(
  persist(
    (set) => ({
      preference: 'system',
      setPreference: (next) => {
        applyTheme(next);
        set({ preference: next });
      },
    }),
    {
      name: 'qualcanvas-theme-preference',
      onRehydrateStorage: () => (state) => {
        // Re-apply the persisted preference after hydration so the class on
        // <html> matches what the user picked last session.
        if (state) applyTheme(state.preference);
      },
    },
  ),
);

// Listen for OS theme changes; only re-apply if the user is on 'system'.
if (typeof window !== 'undefined' && window.matchMedia) {
  const mq = window.matchMedia('(prefers-color-scheme: dark)');
  mq.addEventListener('change', () => {
    const pref = useThemePreferenceStore.getState().preference;
    if (pref === 'system') applyTheme('system');
  });
}
