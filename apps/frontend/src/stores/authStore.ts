import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type AuthType = 'email' | 'legacy';

interface AuthState {
  // Common
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
  // Effective plan for UI gating — equals `plan` for paid users, but reads
  // 'pro' for free users on an active trial. The trial countdown banner
  // reads `trialEndsAt` to pick its state. Both come from /auth/me.
  effectivePlan: string | null;
  trialEndsAt: string | null;
  emailVerified: boolean;

  // Actions
  // `jwt` is still accepted in the action payload because login responses
  // still include it (backend body hasn't dropped it yet) — we just don't
  // persist it anywhere. Auth is carried by an httpOnly cookie.
  setAuth: (data: {
    dashboardCode: string;
    jwt?: string;
    name: string;
    role: string;
    dashboardAccessId: string;
  }) => void;
  setEmailAuth: (data: {
    jwt?: string;
    email: string;
    userId: string;
    name: string;
    role: string;
    plan: string;
    effectivePlan?: string;
    trialEndsAt?: string | null;
    emailVerified?: boolean;
  }) => void;
  setEmailVerified: (verified: boolean) => void;
  updatePlan: (plan: string) => void;
  setTrialState: (data: { effectivePlan: string; trialEndsAt: string | null }) => void;
  logout: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      name: null,
      role: null,
      authenticated: false,
      authType: null,

      dashboardCode: null,
      dashboardAccessId: null,

      email: null,
      userId: null,
      plan: null,
      effectivePlan: null,
      trialEndsAt: null,
      emailVerified: false,

      // Legacy access-code login — jwt payload intentionally not stored
      setAuth: (data) =>
        set({
          dashboardCode: data.dashboardCode,
          name: data.name,
          role: data.role,
          dashboardAccessId: data.dashboardAccessId,
          authenticated: true,
          authType: 'legacy',
          plan: 'pro', // Grandfathered
          effectivePlan: 'pro',
          trialEndsAt: null,
        }),

      // Email login — jwt payload intentionally not stored
      setEmailAuth: (data) =>
        set({
          email: data.email,
          userId: data.userId,
          name: data.name,
          role: data.role,
          plan: data.plan,
          effectivePlan: data.effectivePlan ?? data.plan,
          trialEndsAt: data.trialEndsAt ?? null,
          emailVerified: data.emailVerified ?? false,
          authenticated: true,
          authType: 'email',
          dashboardCode: null,
          dashboardAccessId: null,
        }),

      setEmailVerified: (verified) => set({ emailVerified: verified }),

      updatePlan: (plan) => set({ plan }),

      setTrialState: (data) => set({ effectivePlan: data.effectivePlan, trialEndsAt: data.trialEndsAt }),

      logout: () => {
        // Fire-and-forget: clear the httpOnly cookie on the server. Local
        // state clears immediately regardless so the UI doesn't wait on
        // network — a failed request just leaves a stale cookie that the
        // next login will overwrite.
        void fetch('/api/auth/logout', { method: 'POST', credentials: 'include' }).catch(() => {});
        set({
          dashboardCode: null,
          name: null,
          role: null,
          dashboardAccessId: null,
          authenticated: false,
          authType: null,
          email: null,
          userId: null,
          plan: null,
          effectivePlan: null,
          trialEndsAt: null,
          emailVerified: false,
        });
      },
    }),
    {
      name: 'qualcanvas-auth',
      onRehydrateStorage: () => {
        return (state) => {
          // Auth is now carried by an httpOnly cookie, not by anything we can
          // see from JS. The persisted profile fields are still useful (the
          // UI shows the user's name / plan during the brief window before
          // /auth/me lands). If no cookie is present server-side, the first
          // API call returns 401 and the 401 interceptor clears state.
          if (state) {
            // Strip any stale jwt that older versions persisted.
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            delete (state as any).jwt;
          }
        };
      },
    },
  ),
);
