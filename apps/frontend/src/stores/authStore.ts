import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface AuthState {
  dashboardCode: string | null;
  jwt: string | null;
  name: string | null;
  role: string | null;
  dashboardAccessId: string | null;
  authenticated: boolean;

  setAuth: (data: { dashboardCode: string; jwt: string; name: string; role: string; dashboardAccessId: string }) => void;
  logout: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      dashboardCode: null,
      jwt: null,
      name: null,
      role: null,
      dashboardAccessId: null,
      authenticated: false,

      setAuth: (data) => set({
        dashboardCode: data.dashboardCode,
        jwt: data.jwt,
        name: data.name,
        role: data.role,
        dashboardAccessId: data.dashboardAccessId,
        authenticated: true,
      }),

      logout: () => set({
        dashboardCode: null,
        jwt: null,
        name: null,
        role: null,
        dashboardAccessId: null,
        authenticated: false,
      }),
    }),
    { name: 'canvas-app-auth' }
  )
);
