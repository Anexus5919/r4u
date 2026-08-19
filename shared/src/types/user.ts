import type { AuthenticatedRole, UserStatus } from '../constants/roles.js'
import type { Theme } from '../constants/theme.js'

/**
 * Exactly what the API returns for a user. Deliberately narrow: no password hash, no token
 * version, no lockout counters. If a field is not here, it does not leave the server.
 */
export interface PublicUser {
  id: string
  name: string
  email: string
  role: AuthenticatedRole
  status: UserStatus
  headline: string
  theme: Theme
}

export interface Session {
  user: PublicUser
  accessToken: string
}
