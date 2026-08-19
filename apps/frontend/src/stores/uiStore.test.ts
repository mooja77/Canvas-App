import { describe, it, expect, beforeEach, vi } from 'vitest';
import { useUIStore } from './uiStore';

// Reset store state between tests
function resetStore() {
  useUIStore.setState({
    darkMode: false,
    onboardingComplete: false,
    setupWizardComplete: false,
    sidebarCollapsed: false,
    edgeStyle: 'bezier',
    onboardingOwnerId: null,
    onboardingV2Complete: false,
    onboardingChecklistDismissed: false,
    onboardingChecklistComplete: [],
    dismissedJitTooltips: [],
    showFullProductTour: false,
  });
  localStorage.removeItem('qualcanvas-ui');
  // Clean up DOM class
  document.documentElement.classList.remove('dark');
}

describe('uiStore', () => {
  beforeEach(() => {
    resetStore();
  });

  describe('initial state', () => {
    it('has darkMode false when matchMedia returns false', () => {
      // matchMedia is mocked to return matches: false in setup.ts
      expect(useUIStore.getState().darkMode).toBe(false);
    });

    it('has onboarding not complete', () => {
      expect(useUIStore.getState().onboardingComplete).toBe(false);
    });

    it('has bezier edge style by default', () => {
      expect(useUIStore.getState().edgeStyle).toBe('bezier');
    });

    it('has sidebar not collapsed', () => {
      expect(useUIStore.getState().sidebarCollapsed).toBe(false);
    });
  });

  describe('toggleDarkMode', () => {
    it('toggles darkMode state from false to true', () => {
      useUIStore.getState().toggleDarkMode();
      expect(useUIStore.getState().darkMode).toBe(true);
    });

    it('adds dark class to documentElement when enabling', () => {
      useUIStore.getState().toggleDarkMode();
      expect(document.documentElement.classList.contains('dark')).toBe(true);
    });

    it('removes dark class when disabling', () => {
      useUIStore.getState().toggleDarkMode(); // on
      useUIStore.getState().toggleDarkMode(); // off
      expect(useUIStore.getState().darkMode).toBe(false);
      expect(document.documentElement.classList.contains('dark')).toBe(false);
    });
  });

  describe('completeOnboarding / resetOnboarding', () => {
    it('completeOnboarding sets onboardingComplete to true', () => {
      useUIStore.getState().completeOnboarding();
      expect(useUIStore.getState().onboardingComplete).toBe(true);
    });

    it('resetOnboarding sets onboardingComplete back to false', () => {
      useUIStore.getState().completeOnboarding();
      useUIStore.getState().resetOnboarding();
      expect(useUIStore.getState().onboardingComplete).toBe(false);
    });
  });

  describe('completeSetupWizard / resetSetupWizard', () => {
    it('has setupWizardComplete false by default', () => {
      expect(useUIStore.getState().setupWizardComplete).toBe(false);
    });

    it('completeSetupWizard sets setupWizardComplete to true', () => {
      useUIStore.getState().completeSetupWizard();
      expect(useUIStore.getState().setupWizardComplete).toBe(true);
    });

    it('resetSetupWizard sets setupWizardComplete back to false', () => {
      useUIStore.getState().completeSetupWizard();
      useUIStore.getState().resetSetupWizard();
      expect(useUIStore.getState().setupWizardComplete).toBe(false);
    });
  });

  describe('setEdgeStyle', () => {
    it('sets edge style to straight', () => {
      useUIStore.getState().setEdgeStyle('straight');
      expect(useUIStore.getState().edgeStyle).toBe('straight');
    });

    it('sets edge style to step', () => {
      useUIStore.getState().setEdgeStyle('step');
      expect(useUIStore.getState().edgeStyle).toBe('step');
    });

    it('sets edge style to smoothstep', () => {
      useUIStore.getState().setEdgeStyle('smoothstep');
      expect(useUIStore.getState().edgeStyle).toBe('smoothstep');
    });

    it('can change back to bezier', () => {
      useUIStore.getState().setEdgeStyle('straight');
      useUIStore.getState().setEdgeStyle('bezier');
      expect(useUIStore.getState().edgeStyle).toBe('bezier');
    });
  });

  describe('setSidebarCollapsed', () => {
    it('sets sidebar collapsed state', () => {
      useUIStore.getState().setSidebarCollapsed(true);
      expect(useUIStore.getState().sidebarCollapsed).toBe(true);
    });

    it('can uncollapse sidebar', () => {
      useUIStore.getState().setSidebarCollapsed(true);
      useUIStore.getState().setSidebarCollapsed(false);
      expect(useUIStore.getState().sidebarCollapsed).toBe(false);
    });
  });

  describe('account-scoped onboarding', () => {
    it('clears onboarding state when the authenticated account changes', () => {
      useUIStore.setState({
        onboardingOwnerId: 'user-a',
        onboardingV2Complete: true,
        onboardingChecklistDismissed: true,
        dismissedJitTooltips: ['tooltip-a'],
        setupWizardComplete: true,
      });

      useUIStore.getState().prepareOnboardingForAccount('user-b');

      const state = useUIStore.getState();
      expect(state.onboardingOwnerId).toBe('user-b');
      expect(state.onboardingV2Complete).toBe(false);
      expect(state.onboardingChecklistDismissed).toBe(false);
      expect(state.dismissedJitTooltips).toEqual([]);
      expect(state.setupWizardComplete).toBe(false);
    });

    it('hydrates completion and dismissals for the current account', () => {
      useUIStore.getState().hydrateOnboardingForAccount('user-a', {
        completed: true,
        dismissedTooltips: ['quick-code'],
        checklistComplete: ['dismissed'],
      });

      const state = useUIStore.getState();
      expect(state.onboardingOwnerId).toBe('user-a');
      expect(state.onboardingV2Complete).toBe(true);
      expect(state.onboardingChecklistDismissed).toBe(true);
      expect(state.dismissedJitTooltips).toEqual(['quick-code']);
    });

    it('does not erase newer local dismissals when the same account hydrates', () => {
      useUIStore.setState({
        onboardingOwnerId: 'user-a',
        onboardingChecklistDismissed: true,
        dismissedJitTooltips: ['local-tooltip'],
      });

      useUIStore.getState().hydrateOnboardingForAccount('user-a', {
        completed: false,
        dismissedTooltips: ['server-tooltip'],
        checklistComplete: [],
      });

      const state = useUIStore.getState();
      expect(state.onboardingChecklistDismissed).toBe(true);
      expect(state.dismissedJitTooltips).toEqual(['local-tooltip', 'server-tooltip']);
    });

    it('resets checklist completions when the account changes', () => {
      useUIStore.setState({ onboardingOwnerId: 'user-a', onboardingChecklistComplete: ['export-csv'] });

      useUIStore.getState().prepareOnboardingForAccount('user-b');

      expect(useUIStore.getState().onboardingChecklistComplete).toEqual([]);
    });

    it('hydrates checklist completions from the account record', () => {
      useUIStore.getState().hydrateOnboardingForAccount('user-a', {
        completed: false,
        checklistComplete: ['export-csv'],
      });

      expect(useUIStore.getState().onboardingChecklistComplete).toEqual(['export-csv']);
    });

    it('records a checklist completion without duplicating it', () => {
      useUIStore.getState().markChecklistItemComplete('export-csv');
      useUIStore.getState().markChecklistItemComplete('export-csv');

      expect(useUIStore.getState().onboardingChecklistComplete).toEqual(['export-csv']);
    });
  });

  describe('transient state', () => {
    // Abandoning the tour by closing the tab used to re-open a full-screen
    // overlay at step 1 on the next visit, with no gesture from the user.
    it('does not persist showFullProductTour', () => {
      useUIStore.getState().openFullProductTour();

      const raw = localStorage.getItem('qualcanvas-ui');
      expect(raw).not.toBeNull();
      const persisted = JSON.parse(raw as string).state as Record<string, unknown>;
      expect('showFullProductTour' in persisted).toBe(false);
      // Control: neighbouring onboarding state IS still persisted.
      expect('onboardingChecklistDismissed' in persisted).toBe(true);
    });

    it('purges a showFullProductTour flag left behind by an older build', async () => {
      // Read is deliberately left intact (E2E seeds the tour through this
      // key), so a user who abandoned the tour before this fix still sees it
      // hydrate once. The first subsequent write drops it for good.
      vi.resetModules();
      localStorage.setItem(
        'qualcanvas-ui',
        JSON.stringify({ state: { showFullProductTour: true, onboardingComplete: false }, version: 0 }),
      );

      const { useUIStore: freshStore } = await import('./uiStore');
      expect(freshStore.getState().showFullProductTour).toBe(true);

      freshStore.getState().setSidebarCollapsed(true);

      const persisted = JSON.parse(localStorage.getItem('qualcanvas-ui') as string).state as Record<string, unknown>;
      expect('showFullProductTour' in persisted).toBe(false);
    });
  });
});
