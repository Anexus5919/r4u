import type { AuthenticatedRole, UserStatus } from '../constants/roles.js'
import type { Theme } from '../constants/theme.js'

/** deliberately narrow: if a field is not here, it does not leave the server */
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

/** the owner's own view, from GET /users/me only. the session payload stays minimal */
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
