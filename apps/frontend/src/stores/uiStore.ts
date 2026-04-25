import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type EdgeStyleType = 'bezier' | 'straight' | 'step' | 'smoothstep';

export type ScrollMode = 'zoom' | 'pan';
export type ZoomTier = 'full' | 'reduced' | 'minimal';
export type UserProfile = 'academic' | 'student' | 'ux' | 'team' | null;

export interface FeatureDiscovery {
  analyzeSeen: boolean;
  excerptBrowserSeen: boolean;
  aiPromptSeen: boolean;
  teamPromptSeen: boolean;
  ethicsSeen: boolean;
  exportSeen: boolean;
  planWelcomeSeen: boolean;
}

const DEFAULT_FEATURE_DISCOVERY: FeatureDiscovery = {
  analyzeSeen: false,
  excerptBrowserSeen: false,
  aiPromptSeen: false,
  teamPromptSeen: false,
  ethicsSeen: false,
  exportSeen: false,
  planWelcomeSeen: false,
};

interface UIState {
  darkMode: boolean;
  onboardingComplete: boolean;
  setupWizardComplete: boolean;
  sidebarCollapsed: boolean;
  edgeStyle: EdgeStyleType;
  scrollMode: ScrollMode;
  zoomTier: ZoomTier;
  userProfile: UserProfile;
  featureDiscovery: FeatureDiscovery;

  // Per-day dismissal for the trial countdown banner (YYYY-MM-DD).
  // Banner re-appears the next day so users get nudged again as the
  // trial nears expiry, but not spammed multiple times the same day.
  lastTrialBannerDismissalDate: string | null;

  toggleDarkMode: () => void;
  completeOnboarding: () => void;
  resetOnboarding: () => void;
  completeSetupWizard: () => void;
  resetSetupWizard: () => void;
  setSidebarCollapsed: (v: boolean) => void;
  setEdgeStyle: (style: EdgeStyleType) => void;
  setScrollMode: (mode: ScrollMode) => void;
  setZoomTier: (tier: ZoomTier) => void;
  setUserProfile: (profile: UserProfile) => void;
  markFeatureSeen: (feature: keyof FeatureDiscovery) => void;
  dismissTrialBannerToday: () => void;
}

export const useUIStore = create<UIState>()(
  persist(
    (set) => ({
      darkMode: typeof window !== 'undefined' && window.matchMedia?.('(prefers-color-scheme: dark)').matches,
      onboardingComplete: false,
      setupWizardComplete: false,
      sidebarCollapsed: false,
      edgeStyle: 'bezier' as EdgeStyleType,
      scrollMode: 'zoom' as ScrollMode,
      zoomTier: 'full' as ZoomTier,
      userProfile: null as UserProfile,
      featureDiscovery: { ...DEFAULT_FEATURE_DISCOVERY },
      lastTrialBannerDismissalDate: null,

      toggleDarkMode: () =>
        set((s) => {
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
      completeSetupWizard: () => set({ setupWizardComplete: true }),
      resetSetupWizard: () => set({ setupWizardComplete: false }),
      setSidebarCollapsed: (v) => set({ sidebarCollapsed: v }),
      setEdgeStyle: (style) => set({ edgeStyle: style }),
      setScrollMode: (mode) => set({ scrollMode: mode }),
      setZoomTier: (tier) => set({ zoomTier: tier }),
      setUserProfile: (profile) => set({ userProfile: profile }),
      markFeatureSeen: (feature) =>
        set((s) => ({
          featureDiscovery: { ...s.featureDiscovery, [feature]: true },
        })),
      dismissTrialBannerToday: () => set({ lastTrialBannerDismissalDate: new Date().toISOString().slice(0, 10) }),
    }),
    {
      name: 'qualcanvas-ui',
      partialize: (state) => {
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const { zoomTier, ...persisted } = state;
        return persisted;
      },
    },
  ),
);
