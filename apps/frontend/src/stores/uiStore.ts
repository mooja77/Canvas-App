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

  // Sprint F onboarding v2 — has the user finished the 2-screen flow?
  onboardingV2Complete: boolean;
  // Account that owns the persisted onboarding flags below. Visual
  // preferences such as dark mode may span accounts; onboarding state may not.
  onboardingOwnerId: string | null;
  // Whether the user has dismissed the post-onboarding checklist widget.
  // Once dismissed, it stays gone (it's nagware otherwise).
  onboardingChecklistDismissed: boolean;
  // Activation-checklist rows the user has completed through an action we
  // cannot re-derive from canvas content (currently only 'export-csv' - a
  // download leaves no trace on the canvas). Account-scoped: reset by
  // prepareOnboardingForAccount and hydrated from the server-side
  // `onboardingState.checklistComplete` so a brand-new account on a shared
  // browser does not inherit someone else's ticks.
  onboardingChecklistComplete: string[];
  // Per-tooltip dismissal set for the JustInTimeTooltip primitive. Keyed by
  // tooltipId; absence means the tooltip can still fire.
  dismissedJitTooltips: string[];
  // Whether the original 22-step tour (now "Full product tour") is open.
  // Default false; only opens when the user explicitly picks it from the
  // Help menu. Sprint F replaced auto-firing with on-demand surfacing.
  // NOT persisted (see partialize): it is "a tour is on screen right now",
  // not a preference. Persisting it meant abandoning the tour by closing the
  // tab re-opened a full-screen overlay at step 1 on the next visit, with no
  // gesture from the user and no way to predict it.
  showFullProductTour: boolean;

  // Transient "verify in context" highlight. When a user clicks Locate on an
  // AI suggestion, this points the matching TranscriptNode at the exact span
  // so the researcher can confirm the AI anchored to real text. Not persisted.
  verifyHighlight: { transcriptId: string; startOffset: number; endOffset: number } | null;

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
  completeOnboardingV2: () => void;
  resetOnboardingV2: () => void;
  prepareOnboardingForAccount: (userId: string) => void;
  hydrateOnboardingForAccount: (
    userId: string,
    data: { completed: boolean; dismissedTooltips?: string[]; checklistComplete?: string[] },
  ) => void;
  dismissOnboardingChecklist: () => void;
  markChecklistItemComplete: (id: string) => void;
  dismissJitTooltip: (id: string) => void;
  openFullProductTour: () => void;
  closeFullProductTour: () => void;
  setVerifyHighlight: (h: { transcriptId: string; startOffset: number; endOffset: number } | null) => void;
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
      onboardingV2Complete: false,
      onboardingOwnerId: null,
      onboardingChecklistDismissed: false,
      onboardingChecklistComplete: [],
      dismissedJitTooltips: [],
      showFullProductTour: false,
      verifyHighlight: null,

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
      completeOnboardingV2: () => set({ onboardingV2Complete: true }),
      resetOnboardingV2: () =>
        set({
          onboardingV2Complete: false,
          onboardingChecklistDismissed: false,
          onboardingChecklistComplete: [],
          dismissedJitTooltips: [],
        }),
      prepareOnboardingForAccount: (userId) =>
        set((state) => {
          if (state.onboardingOwnerId === userId) return state;
          return {
            onboardingOwnerId: userId,
            onboardingComplete: false,
            setupWizardComplete: false,
            userProfile: null,
            featureDiscovery: { ...DEFAULT_FEATURE_DISCOVERY },
            onboardingV2Complete: false,
            onboardingChecklistDismissed: false,
            onboardingChecklistComplete: [],
            dismissedJitTooltips: [],
            showFullProductTour: false,
          };
        }),
      hydrateOnboardingForAccount: (userId, data) =>
        set((state) => {
          const sameOwner = state.onboardingOwnerId === userId;
          return {
            onboardingOwnerId: userId,
            onboardingV2Complete: data.completed,
            // Dismissal writes are currently local-first. For the same account,
            // merge the server snapshot instead of erasing a newer local choice.
            onboardingChecklistDismissed:
              state.onboardingChecklistDismissed || (data.checklistComplete?.includes('dismissed') ?? false),
            // Same local-first merge: keep this account's local ticks and add
            // whatever the server already recorded (including 'dismissed', so
            // a later patch doesn't drop it).
            onboardingChecklistComplete: Array.from(
              new Set([...(sameOwner ? state.onboardingChecklistComplete : []), ...(data.checklistComplete ?? [])]),
            ),
            dismissedJitTooltips: Array.from(
              new Set([...(sameOwner ? state.dismissedJitTooltips : []), ...(data.dismissedTooltips ?? [])]),
            ),
            // If an old browser-wide value belongs to another account, clear the
            // legacy completion state while hydrating the new owner.
            ...(!sameOwner
              ? {
                  onboardingComplete: false,
                  setupWizardComplete: false,
                  userProfile: null,
                  featureDiscovery: { ...DEFAULT_FEATURE_DISCOVERY },
                  showFullProductTour: false,
                }
              : {}),
          };
        }),
      dismissOnboardingChecklist: () => set({ onboardingChecklistDismissed: true }),
      markChecklistItemComplete: (id) =>
        set((s) =>
          s.onboardingChecklistComplete.includes(id)
            ? s
            : { onboardingChecklistComplete: [...s.onboardingChecklistComplete, id] },
        ),
      dismissJitTooltip: (id) =>
        set((s) => ({
          dismissedJitTooltips: s.dismissedJitTooltips.includes(id)
            ? s.dismissedJitTooltips
            : [...s.dismissedJitTooltips, id],
        })),
      openFullProductTour: () => set({ showFullProductTour: true, onboardingComplete: false }),
      closeFullProductTour: () => set({ showFullProductTour: false, onboardingComplete: true }),
      setVerifyHighlight: (h) => set({ verifyHighlight: h }),
    }),
    {
      name: 'qualcanvas-ui',
      partialize: (state) => {
        // zoomTier, verifyHighlight and showFullProductTour are transient —
        // never persist them. showFullProductTour describes an overlay that is
        // open right now; persisting it re-opened the tour at step 1 for
        // anyone who abandoned it by closing the tab.
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const { zoomTier, verifyHighlight, showFullProductTour, ...persisted } = state;
        return persisted;
      },
    },
  ),
);
