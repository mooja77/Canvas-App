import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type EdgeStyleType = 'bezier' | 'straight' | 'step' | 'smoothstep';

export type ScrollMode = 'zoom' | 'pan';
export type ZoomTier = 'full' | 'reduced' | 'minimal';

interface UIState {
  darkMode: boolean;
  onboardingComplete: boolean;
  sidebarCollapsed: boolean;
  edgeStyle: EdgeStyleType;
  scrollMode: ScrollMode;
  zoomTier: ZoomTier;

  toggleDarkMode: () => void;
  completeOnboarding: () => void;
  resetOnboarding: () => void;
  setSidebarCollapsed: (v: boolean) => void;
  setEdgeStyle: (style: EdgeStyleType) => void;
  setScrollMode: (mode: ScrollMode) => void;
  setZoomTier: (tier: ZoomTier) => void;
}

export const useUIStore = create<UIState>()(
  persist(
    (set) => ({
      darkMode: typeof window !== 'undefined' && window.matchMedia?.('(prefers-color-scheme: dark)').matches,
      onboardingComplete: false,
      sidebarCollapsed: false,
      edgeStyle: 'bezier' as EdgeStyleType,
      scrollMode: 'zoom' as ScrollMode,
      zoomTier: 'full' as ZoomTier,

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
      setScrollMode: (mode) => set({ scrollMode: mode }),
      setZoomTier: (tier) => set({ zoomTier: tier }),
    }),
    {
      name: 'canvas-app-ui',
      partialize: (state) => {
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const { zoomTier, ...persisted } = state;
        return persisted;
      },
    }
  )
);
