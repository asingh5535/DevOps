import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { AuthState } from '@/types'

interface AuthStore extends AuthState {
  login: (token: string, serverVersion: string, serverUrl: string) => void
  logout: () => void
}

export const useAuthStore = create<AuthStore>()(
  persist(
    (set) => ({
      token: null,
      serverVersion: null,
      serverUrl: null,
      isAuthenticated: false,

      login: (token, serverVersion, serverUrl) =>
        set({ token, serverVersion, serverUrl, isAuthenticated: true }),

      logout: () =>
        set({ token: null, serverVersion: null, serverUrl: null, isAuthenticated: false }),
    }),
    {
      name: 'kubevision-auth',
      partialize: (s) => ({
        token: s.token,
        serverVersion: s.serverVersion,
        serverUrl: s.serverUrl,
        isAuthenticated: s.isAuthenticated,
      }),
    }
  )
)
