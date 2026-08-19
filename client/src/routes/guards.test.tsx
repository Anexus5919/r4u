import { render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'
import type { PublicUser } from '@r4u/shared'
import { AuthContext } from '@/context/AuthContext'
import type { AuthContextValue, AuthStatus } from '@/context/AuthContext'
import { RequireAuth, RequireGuest, RequireRole } from './guards'

function makeUser(role: PublicUser['role']): PublicUser {
  return {
    id: 'u1',
    name: 'Aman Sharma',
    email: 'aman@example.com',
    role,
    status: 'active',
    headline: '',
    theme: 'system',
  }
}

function renderAt(
  path: string,
  auth: { status: AuthStatus; user: PublicUser | null },
  tree: React.ReactNode
) {
  const value: AuthContextValue = {
    ...auth,
    error: null,
    login: vi.fn(),
    register: vi.fn(),
    logout: vi.fn(),
    clearError: vi.fn(),
  }

  return render(
    <AuthContext.Provider value={value}>
      <MemoryRouter initialEntries={[path]}>
        <Routes>
          {tree}
          <Route path="/login" element={<p>login screen</p>} />
          <Route path="/dashboard" element={<p>dashboard</p>} />
          <Route path="/admin" element={<p>admin console</p>} />
          <Route path="/403" element={<p>forbidden</p>} />
        </Routes>
      </MemoryRouter>
    </AuthContext.Provider>
  )
}

const PROTECTED = (
  <Route element={<RequireAuth />}>
    <Route path="/private" element={<p>private content</p>} />
  </Route>
)

describe('RequireAuth', () => {
  /*
    The reason 'checking' is a state rather than a boolean. Redirecting during the restore would
    bounce an already-signed-in user to the login screen on every reload.
  */
  it('renders neither the content nor a redirect while the session is restoring', () => {
    renderAt('/private', { status: 'checking', user: null }, PROTECTED)

    expect(screen.queryByText('private content')).not.toBeInTheDocument()
    expect(screen.queryByText('login screen')).not.toBeInTheDocument()
  })

  it('sends a guest to the login screen', () => {
    renderAt('/private', { status: 'guest', user: null }, PROTECTED)

    expect(screen.getByText('login screen')).toBeInTheDocument()
  })

  it('renders the content for an authenticated user', () => {
    renderAt('/private', { status: 'authenticated', user: makeUser('user') }, PROTECTED)

    expect(screen.getByText('private content')).toBeInTheDocument()
  })
})

describe('RequireGuest', () => {
  const GUEST_ONLY = (
    <Route element={<RequireGuest />}>
      <Route path="/login-page" element={<p>sign in form</p>} />
    </Route>
  )

  it('shows the form to a signed-out visitor', () => {
    renderAt('/login-page', { status: 'guest', user: null }, GUEST_ONLY)

    expect(screen.getByText('sign in form')).toBeInTheDocument()
  })

  it('sends a signed-in user to their own surface', () => {
    renderAt('/login-page', { status: 'authenticated', user: makeUser('user') }, GUEST_ONLY)

    expect(screen.getByText('dashboard')).toBeInTheDocument()
  })

  it('sends a signed-in admin to the admin console', () => {
    renderAt('/login-page', { status: 'authenticated', user: makeUser('admin') }, GUEST_ONLY)

    expect(screen.getByText('admin console')).toBeInTheDocument()
  })
})

describe('RequireRole', () => {
  const USER_ONLY = (
    <Route element={<RequireRole allowed={['user', 'reviewer']} />}>
      <Route path="/editor" element={<p>editor</p>} />
    </Route>
  )

  it('admits a role in the set', () => {
    renderAt('/editor', { status: 'authenticated', user: makeUser('reviewer') }, USER_ONLY)

    expect(screen.getByText('editor')).toBeInTheDocument()
  })

  /*
    Set membership, not a rank ladder. A ladder would make admin a superset of every role by
    construction, which is exactly how the "admin cannot read resume content" rule gets broken.
    The client mirrors the server here on purpose.
  */
  it('refuses an admin, because admin is not a superset of user', () => {
    renderAt('/editor', { status: 'authenticated', user: makeUser('admin') }, USER_ONLY)

    expect(screen.queryByText('editor')).not.toBeInTheDocument()
    expect(screen.getByText('forbidden')).toBeInTheDocument()
  })
})
