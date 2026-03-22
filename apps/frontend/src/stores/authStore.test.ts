import { describe, it, expect, beforeEach } from 'vitest';
import { useAuthStore } from './authStore';

function resetStore() {
  useAuthStore.setState({
    jwt: null,
    name: null,
    role: null,
    authenticated: false,
    authType: null,
    dashboardCode: null,
    dashboardAccessId: null,
    email: null,
    userId: null,
    plan: null,
  });
}

describe('authStore', () => {
  beforeEach(() => {
    resetStore();
  });

  describe('initial state', () => {
    it('is not authenticated', () => {
      const state = useAuthStore.getState();
      expect(state.authenticated).toBe(false);
      expect(state.jwt).toBeNull();
      expect(state.authType).toBeNull();
    });

    it('has no user identity', () => {
      const state = useAuthStore.getState();
      expect(state.name).toBeNull();
      expect(state.role).toBeNull();
      expect(state.email).toBeNull();
      expect(state.userId).toBeNull();
      expect(state.plan).toBeNull();
    });

    it('has no legacy auth fields', () => {
      const state = useAuthStore.getState();
      expect(state.dashboardCode).toBeNull();
      expect(state.dashboardAccessId).toBeNull();
    });
  });

  describe('setAuth (legacy)', () => {
    it('sets legacy auth state and marks as authenticated', () => {
      useAuthStore.getState().setAuth({
        dashboardCode: 'DEMO-CODE',
        jwt: 'legacy-jwt-token',
        name: 'Test User',
        role: 'admin',
        dashboardAccessId: 'access-123',
      });

      const state = useAuthStore.getState();
      expect(state.authenticated).toBe(true);
      expect(state.authType).toBe('legacy');
      expect(state.jwt).toBe('legacy-jwt-token');
      expect(state.name).toBe('Test User');
      expect(state.role).toBe('admin');
      expect(state.dashboardCode).toBe('DEMO-CODE');
      expect(state.dashboardAccessId).toBe('access-123');
      expect(state.plan).toBe('pro'); // Legacy users grandfathered to Pro
    });
  });

  describe('setEmailAuth', () => {
    it('sets email auth state and clears legacy fields', () => {
      // First set legacy auth to ensure it gets cleared
      useAuthStore.getState().setAuth({
        dashboardCode: 'OLD-CODE',
        jwt: 'old-jwt',
        name: 'Old User',
        role: 'admin',
        dashboardAccessId: 'old-access',
      });

      useAuthStore.getState().setEmailAuth({
        jwt: 'email-jwt-token',
        email: 'user@example.com',
        userId: 'user-789',
        name: 'Email User',
        role: 'user',
        plan: 'free',
      });

      const state = useAuthStore.getState();
      expect(state.authenticated).toBe(true);
      expect(state.authType).toBe('email');
      expect(state.jwt).toBe('email-jwt-token');
      expect(state.email).toBe('user@example.com');
      expect(state.userId).toBe('user-789');
      expect(state.name).toBe('Email User');
      expect(state.role).toBe('user');
      expect(state.plan).toBe('free');
      // Legacy fields should be cleared
      expect(state.dashboardCode).toBeNull();
      expect(state.dashboardAccessId).toBeNull();
    });
  });

  describe('updatePlan', () => {
    it('updates the plan without affecting other state', () => {
      useAuthStore.getState().setEmailAuth({
        jwt: 'jwt',
        email: 'user@example.com',
        userId: 'u1',
        name: 'User',
        role: 'user',
        plan: 'free',
      });

      useAuthStore.getState().updatePlan('pro');

      const state = useAuthStore.getState();
      expect(state.plan).toBe('pro');
      expect(state.authenticated).toBe(true);
      expect(state.email).toBe('user@example.com');
    });
  });

  describe('logout', () => {
    it('clears all auth state after legacy login', () => {
      useAuthStore.getState().setAuth({
        dashboardCode: 'CODE',
        jwt: 'jwt',
        name: 'User',
        role: 'admin',
        dashboardAccessId: 'access-1',
      });

      useAuthStore.getState().logout();

      const state = useAuthStore.getState();
      expect(state.authenticated).toBe(false);
      expect(state.jwt).toBeNull();
      expect(state.authType).toBeNull();
      expect(state.name).toBeNull();
      expect(state.role).toBeNull();
      expect(state.dashboardCode).toBeNull();
      expect(state.dashboardAccessId).toBeNull();
      expect(state.email).toBeNull();
      expect(state.userId).toBeNull();
      expect(state.plan).toBeNull();
    });

    it('clears all auth state after email login', () => {
      useAuthStore.getState().setEmailAuth({
        jwt: 'jwt',
        email: 'user@test.com',
        userId: 'u1',
        name: 'User',
        role: 'user',
        plan: 'pro',
      });

      useAuthStore.getState().logout();

      const state = useAuthStore.getState();
      expect(state.authenticated).toBe(false);
      expect(state.jwt).toBeNull();
      expect(state.email).toBeNull();
      expect(state.userId).toBeNull();
      expect(state.plan).toBeNull();
    });
  });
});
