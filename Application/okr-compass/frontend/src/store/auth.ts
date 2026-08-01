import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { AuthState } from '@/types'

interface AuthStore extends AuthState {
  login: (token: string, username: string) => void
  logout: () => void
}

export const useAuthStore = create<AuthStore>()(
  persist(
    (set) => ({
      token: null,
      username: null,
      isAuthenticated: false,

      login: (token, username) => set({ token, username, isAuthenticated: true }),
      logout: () => set({ token: null, username: null, isAuthenticated: false }),
    }),
    {
      name: 'okr-compass-auth',
      partialize: (s) => ({ token: s.token, username: s.username, isAuthenticated: s.isAuthenticated }),
    }
  )
)
