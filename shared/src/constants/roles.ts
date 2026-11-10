// guest is a real role, so every policy handles four uniformly with no fake users row

export const ROLES = ['guest', 'user', 'reviewer', 'admin'] as const
export type Role = (typeof ROLES)[number]

export const AUTHENTICATED_ROLES = ['user', 'reviewer', 'admin'] as const
export type AuthenticatedRole = (typeof AUTHENTICATED_ROLES)[number]

export const USER_STATUSES = ['active', 'blocked'] as const
export type UserStatus = (typeof USER_STATUSES)[number]

export function isAuthenticatedRole(role: Role): role is AuthenticatedRole {
  return role !== 'guest'
}

// set membership, never a ladder: a ladder makes admin a superset. see ADR-008
export function hasRole(role: Role, allowed: readonly Role[]): boolean {
  return allowed.includes(role)
}
