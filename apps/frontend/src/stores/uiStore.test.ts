import { describe, it, expect, beforeEach } from 'vitest';
import { useUIStore } from './uiStore';

// Reset store state between tests
function resetStore() {
  useUIStore.setState({
    darkMode: false,
    onboardingComplete: false,
    setupWizardComplete: false,
    sidebarCollapsed: false,
    edgeStyle: 'bezier',
  });
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
});
