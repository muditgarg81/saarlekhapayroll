'use client';
import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface User {
  id: string;
  email: string;
  role: string;
  companyId: string;
  companyName: string;
  mfaEnabled?: boolean;
  employee?: { id: string; firstName: string; lastName: string } | null;
}

interface AuthState {
  user: User | null;
  token: string | null;
  _hasHydrated: boolean;
  setHasHydrated: (state: boolean) => void;
  setAuth: (user: User, token: string) => void;
  logout: () => void;
  isAdmin: () => boolean;
  isHR: () => boolean;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      token: null,
      _hasHydrated: false,
      setHasHydrated: (state) => set({ _hasHydrated: state }),
      setAuth: (user, token) => {
        localStorage.setItem('access_token', token);
        set({ user, token });
      },
      logout: () => {
        localStorage.removeItem('access_token');
        set({ user: null, token: null });
      },
      isAdmin: () => ['SUPER_ADMIN', 'ADMIN'].includes(get().user?.role || ''),
      isHR: () => ['SUPER_ADMIN', 'ADMIN', 'HR_MANAGER'].includes(get().user?.role || ''),
    }),
    {
      name: 'saarlekha-auth',
      partialize: state => ({ user: state.user, token: state.token }),
      onRehydrateStorage: () => (state) => {
        state?.setHasHydrated(true);
      },
    },
  ),
);
