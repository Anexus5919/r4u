import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { hasRole } from '@r4u/shared'
import type { Role } from '@r4u/shared'
import { useAuth } from '@/context/AuthContext'

/*
  While the session is restoring, render nothing rather than a spinner. The check resolves in a
  single request, and a spinner that appears for 80ms reads as jank. A protected route is never
  rendered before the token is verified.
*/
function Pending() {
  return <div className="min-h-dvh bg-ink-01" aria-busy="true" />
}

export function RequireAuth() {
  const { status } = useAuth()
  const location = useLocation()

  if (status === 'checking') return <Pending />

  // remember where they were headed, so login can return them there
  if (status === 'guest')
    return <Navigate to="/login" replace state={{ from: location.pathname }} />

  return <Outlet />
}

/*
  Landing on /login while already signed in is a dead end. Send them to the surface their role
  actually owns.
*/
export function RequireGuest() {
  const { status, user } = useAuth()

  if (status === 'checking') return <Pending />
  if (status === 'authenticated') {
    return <Navigate to={user?.role === 'admin' ? '/admin' : '/dashboard'} replace />
  }

  return <Outlet />
}

/*
  Set membership, matching the server. RequireRole('user') denies an admin, which is the point:
  an administrator is not a superset of a user.
*/
export function RequireRole({ allowed }: { allowed: Role[] }) {
  const { status, user } = useAuth()

  if (status === 'checking') return <Pending />
  if (status === 'guest') return <Navigate to="/login" replace />
  if (!user || !hasRole(user.role, allowed)) return <Navigate to="/403" replace />

  return <Outlet />
}
