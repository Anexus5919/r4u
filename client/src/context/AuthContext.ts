import { createContext, useContext } from 'react'
import type { PublicUser } from '@r4u/shared'
import type { ApiFailure } from '@/lib/api'

/*
  'checking' is a real state, not a boolean flag.

  Without it the app renders the guest tree for one frame on every reload, which flashes the
  login screen at an already-signed-in user and, worse, fires a redirect before the session has
  had a chance to restore.
*/
export type AuthStatus = 'checking' | 'authenticated' | 'guest'

export interface AuthContextValue {
  status: AuthStatus
  user: PublicUser | null
  error: ApiFailure | null
  /** Resolves with the signed-in user, so a caller can route by role without a render cycle. */
  login: (email: string, password: string) => Promise<PublicUser>
  register: (name: string, email: string, password: string) => Promise<PublicUser>
  logout: () => Promise<void>
  clearError: () => void
}

export const AuthContext = createContext<AuthContextValue | null>(null)

export function useAuth(): AuthContextValue {
  const value = useContext(AuthContext)
  if (!value) throw new Error('useAuth must be used inside AuthProvider')
  return value
}
