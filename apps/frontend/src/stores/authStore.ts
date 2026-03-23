import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type AuthType = 'email' | 'legacy';

interface AuthState {
  // Common
  jwt: string | null;
  name: string | null;
  role: string | null;
  authenticated: boolean;
  authType: AuthType | null;

  // Legacy access-code auth
  dashboardCode: string | null;
  dashboardAccessId: string | null;

  // Email auth
  email: string | null;
  userId: string | null;
  plan: string | null;
  emailVerified: boolean;

  // Actions
  setAuth: (data: { dashboardCode: string; jwt: string; name: string; role: string; dashboardAccessId: string }) => void;
  setEmailAuth: (data: { jwt: string; email: string; userId: string; name: string; role: string; plan: string; emailVerified?: boolean }) => void;
  setEmailVerified: (verified: boolean) => void;
  updatePlan: (plan: string) => void;
  logout: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
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
      emailVerified: false,

      // Legacy access-code login
      setAuth: (data) => set({
        dashboardCode: data.dashboardCode,
        jwt: data.jwt,
        name: data.name,
        role: data.role,
        dashboardAccessId: data.dashboardAccessId,
        authenticated: true,
        authType: 'legacy',
        plan: 'pro', // Grandfathered
      }),

      // Email login
      setEmailAuth: (data) => set({
        jwt: data.jwt,
        email: data.email,
        userId: data.userId,
        name: data.name,
        role: data.role,
        plan: data.plan,
        emailVerified: data.emailVerified ?? false,
        authenticated: true,
        authType: 'email',
        dashboardCode: null,
        dashboardAccessId: null,
      }),

      setEmailVerified: (verified) => set({ emailVerified: verified }),

      updatePlan: (plan) => set({ plan }),

      logout: () => set({
        dashboardCode: null,
        jwt: null,
        name: null,
        role: null,
        dashboardAccessId: null,
        authenticated: false,
        authType: null,
        email: null,
        userId: null,
        plan: null,
        emailVerified: false,
      }),
    }),
    {
      name: 'canvas-app-auth',
      onRehydrateStorage: () => {
        return (state) => {
          // If authenticated but missing JWT, reset to logged-out state
          if (state && state.authenticated && !state.jwt) {
            state.authenticated = false;
            state.jwt = null;
            state.authType = null;
            state.email = null;
            state.userId = null;
            state.plan = null;
            state.dashboardCode = null;
            state.dashboardAccessId = null;
            state.name = null;
            state.role = null;
          }
        };
      },
    }
  )
);
