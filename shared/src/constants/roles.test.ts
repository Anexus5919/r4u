import { describe, expect, it } from 'vitest'
import { AUTHENTICATED_ROLES, ROLES, hasRole, isAuthenticatedRole } from './roles.js'

describe('roles', () => {
  it('treats guest as a first-class role', () => {
    expect(ROLES).toContain('guest')
    expect(isAuthenticatedRole('guest')).toBe(false)
    expect(AUTHENTICATED_ROLES).not.toContain('guest')
  })

  it('resolves authorisation by set membership', () => {
    expect(hasRole('reviewer', ['user', 'reviewer'])).toBe(true)
    expect(hasRole('user', ['admin'])).toBe(false)
    expect(hasRole('guest', [])).toBe(false)
  })

  // a rank ladder would silently grant admin every user capability. see ADR-008
  it('does not let admin satisfy a check it was not granted', () => {
    expect(hasRole('admin', ['user'])).toBe(false)
    expect(hasRole('admin', ['owner' as never])).toBe(false)
    expect(hasRole('admin', ['user', 'reviewer'])).toBe(false)
  })
})
