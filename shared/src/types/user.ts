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
  /** null when no avatar is set, or when image hosting is not configured */
  avatarUrl: string | null
}

/**
 * The owner's own view of their account. Wider than PublicUser, and returned only from
 * GET /users/me. The session payload stays minimal so a token refresh does not ship contact
 * details around on every call.
 */
export interface ProfileUser extends PublicUser {
  phone: string
  location: string
}

/** What the profile screen edits. Everything is optional so a partial save is a normal case. */
export interface ProfilePatch {
  name?: string
  headline?: string
  phone?: string
  location?: string
  theme?: Theme
}

export interface Session {
  user: PublicUser
  accessToken: string
}
