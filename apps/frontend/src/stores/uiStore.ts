import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type EdgeStyleType = 'bezier' | 'straight' | 'step' | 'smoothstep';

interface UIState {
  darkMode: boolean;
  onboardingComplete: boolean;
  sidebarCollapsed: boolean;
  edgeStyle: EdgeStyleType;

  toggleDarkMode: () => void;
  completeOnboarding: () => void;
  resetOnboarding: () => void;
  setSidebarCollapsed: (v: boolean) => void;
  setEdgeStyle: (style: EdgeStyleType) => void;
}

export const useUIStore = create<UIState>()(
  persist(
    (set) => ({
      darkMode: typeof window !== 'undefined' && window.matchMedia?.('(prefers-color-scheme: dark)').matches,
      onboardingComplete: false,
      sidebarCollapsed: false,
      edgeStyle: 'bezier' as EdgeStyleType,

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
      setEdgeStyle: (style) => set({ edgeStyle: style }),
    }),
    { name: 'canvas-app-ui' }
  )
);
