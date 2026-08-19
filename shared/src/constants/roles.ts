/*
  Guest is a first-class role, not the absence of a user. Every policy function then handles
  four roles uniformly and the four-role requirement is visible in the code without a fake
  guest row in the users collection.
*/

export const ROLES = ['guest', 'user', 'reviewer', 'admin'] as const
export type Role = (typeof ROLES)[number]

export const AUTHENTICATED_ROLES = ['user', 'reviewer', 'admin'] as const
export type AuthenticatedRole = (typeof AUTHENTICATED_ROLES)[number]

export const USER_STATUSES = ['active', 'blocked'] as const
export type UserStatus = (typeof USER_STATUSES)[number]

export function isAuthenticatedRole(role: Role): role is AuthenticatedRole {
  return role !== 'guest'
}

/*
  Set membership, never a rank ladder. A ladder makes admin a superset by construction, which
  directly violates the rule that an admin cannot read private resume content. See ADR-008.
*/
export function hasRole(role: Role, allowed: readonly Role[]): boolean {
  return allowed.includes(role)
}
