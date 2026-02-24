import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface UIState {
  darkMode: boolean;
  onboardingComplete: boolean;
  sidebarCollapsed: boolean;

  toggleDarkMode: () => void;
  completeOnboarding: () => void;
  resetOnboarding: () => void;
  setSidebarCollapsed: (v: boolean) => void;
}

export const useUIStore = create<UIState>()(
  persist(
    (set) => ({
      darkMode: false,
      onboardingComplete: false,
      sidebarCollapsed: false,

      toggleDarkMode: () => set((s) => {
        const next = !s.darkMode;
        if (next) {
          document.documentElement.classList.add('dark');
        } else {
          document.documentElement.classList.remove('dark');
        }
        return { darkMode: next };
      }),

      completeOnboarding: () => set({ onboardingComplete: true }),
      resetOnboarding: () => set({ onboardingComplete: false }),
      setSidebarCollapsed: (v) => set({ sidebarCollapsed: v }),
    }),
    { name: 'canvas-app-ui' }
  )
);
