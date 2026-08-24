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
  // `jwt` remains an optional action field solely for migration compatibility
  // with old callers. The backend no longer returns tokens in response bodies;
  // authentication is carried only by an httpOnly cookie.
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
    /**
     * Set when this email identity is the SAME person who was already signed
     * in - i.e. linking an email to an existing access-code account. Carries
     * the local research data forward instead of wiping it as a new account.
     */
    sameIdentity?: boolean;
  }) => void;
  setEmailVerified: (verified: boolean) => void;
  setName: (name: string) => void;
  updatePlan: (plan: string) => void;
  /**
   * Record the EFFECTIVE plan only (the trial-overlaid tier the server gates
   * on). Deliberately does not touch `plan`, which must keep meaning "the tier
   * this account actually pays for".
   */
  setEffectivePlan: (effectivePlan: string) => void;
  setTrialState: (data: { plan?: string; effectivePlan: string; trialEndsAt: string | null }) => void;
  logout: (options?: { preserveLocalData?: boolean }) => void;
}

/**
 * Per-canvas research data that lives ONLY in localStorage - there is no server
 * copy of any of it: reflexivity journals, code weights, sticky notes, theme
 * groups, node colours, bookmarks, edge waypoints, and the offline write queue.
 */
const LOCAL_RESEARCH_PREFIXES = ['canvas-'];
const LOCAL_RESEARCH_KEYS = ['qualcanvas-cross-refs', 'qualcanvas-offline-queue'];

/** Identity of the last account to authenticate in this browser. */
const IDENTITY_KEY = 'qualcanvas-last-identity';

function clearLocalResearchData(): void {
  try {
    for (let index = localStorage.length - 1; index >= 0; index--) {
      const key = localStorage.key(index);
      if (!key) continue;
      if (LOCAL_RESEARCH_PREFIXES.some((prefix) => key.startsWith(prefix)) || LOCAL_RESEARCH_KEYS.includes(key)) {
        localStorage.removeItem(key);
      }
    }
  } catch {
    // Storage can throw in private mode; nothing here is worth failing auth for.
  }
}

/**
 * Wipe the previous account's local research data when a DIFFERENT identity
 * signs in on this browser.
 *
 * This is where the shared-browser guarantee belongs. It used to sit in
 * `logout()`, which meant an *involuntary* logout - an expired 24h JWT, or the
 * 35-minute idle timer - destroyed the user's own journals and weights before
 * they had touched anything. Closing the tab, by far the commonest way to end a
 * session, never wiped any of it, so the sweep was inconsistent rather than
 * protective. Tying it to a change of identity keeps the next account from
 * seeing the previous one's notes while letting the same person come back to
 * their own work.
 */
function clearIfDifferentIdentity(identity: string): void {
  try {
    const previous = localStorage.getItem(IDENTITY_KEY);
    if (previous && previous !== identity) clearLocalResearchData();
    localStorage.setItem(IDENTITY_KEY, identity);
  } catch {
    // Ignored - see clearLocalResearchData.
  }
}

/**
 * Record a new identity string for the SAME person, without wiping anything.
 *
 * Linking an email to a legacy access-code account changes the identity key
 * from `legacy:<dashboardAccessId>` to `email:<userId>`, and
 * clearIfDifferentIdentity read that as a different account signing in - so
 * accepting the product's own "Add an email to secure your account" prompt
 * destroyed the user's sticky notes, code weights, theme groups, node colours,
 * bookmarks and edge waypoints, none of which have a server copy, plus any
 * queued offline mutations that had not yet reached the server.
 *
 * Nothing about the person changes at link time: same DashboardAccess, same
 * canvases (the server repoints them to the new userId). So carry the identity
 * forward instead of treating the upgrade as a stranger.
 */
function adoptIdentity(identity: string): void {
  try {
    localStorage.setItem(IDENTITY_KEY, identity);
  } catch {
    // Ignored - see clearLocalResearchData.
  }
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
      setAuth: (data) => {
        // A different account signing in on this browser clears the previous
        // one's local research data. See clearIfDifferentIdentity.
        clearIfDifferentIdentity(`legacy:${data.dashboardAccessId}`);
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
        });
      },

      // Email login — jwt payload intentionally not stored
      setEmailAuth: (data) => {
        if (data.sameIdentity) adoptIdentity(`email:${data.userId}`);
        else clearIfDifferentIdentity(`email:${data.userId}`);
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
        });
      },

      setEmailVerified: (verified) => set({ emailVerified: verified }),

      setName: (name) => set({ name }),

      updatePlan: (plan) => set({ plan }),

      setEffectivePlan: (effectivePlan) => set({ effectivePlan }),

      setTrialState: (data) =>
        set({
          ...(data.plan ? { plan: data.plan } : {}),
          effectivePlan: data.effectivePlan,
          trialEndsAt: data.trialEndsAt,
        }),

      logout: (options) => {
        // Fire-and-forget: clear the httpOnly cookie on the server. Local
        // state clears immediately regardless so the UI doesn't wait on
        // network — a failed request just leaves a stale cookie that the
        // next login will overwrite.
        const apiBase = (import.meta.env.VITE_API_URL || '/api').replace(/\/$/, '');
        void fetch(`${apiBase}/auth/logout`, {
          method: 'POST',
          credentials: 'include',
          keepalive: true,
        }).catch(() => {});
        // A DELIBERATE logout still clears local research data, so nothing is
        // left behind for the next account on a shared browser.
        //
        // An INVOLUNTARY one must not. An expired 24h JWT (there is no refresh
        // endpoint, so every user hits this) or the 35-minute idle timer would
        // otherwise destroy the user's reflexivity journals, code weights,
        // sticky notes, theme groups, node colours and bookmarks - none of
        // which exist server-side - before they had done anything at all. The
        // shared-browser guarantee is preserved by clearIfDifferentIdentity(),
        // which wipes when a different account signs in.
        if (!options?.preserveLocalData) {
          clearLocalResearchData();
          try {
            localStorage.removeItem(IDENTITY_KEY);
          } catch {
            // Ignored.
          }
        }
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
            if (!import.meta.env.VITE_E2E) {
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              delete (state as any).jwt;
            }
          }
        };
      },
    },
  ),
);
