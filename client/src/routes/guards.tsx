import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { hasRole } from '@r4u/shared'
import type { Role } from '@r4u/shared'
import { useAuth } from '@/context/AuthContext'

// render nothing while restoring: an 80ms spinner reads as jank
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

// a signed-in visitor to /login goes to the surface their role owns
export function RequireGuest() {
  const { status, user } = useAuth()

  if (status === 'checking') return <Pending />
  if (status === 'authenticated') {
    return <Navigate to={user?.role === 'admin' ? '/admin' : '/dashboard'} replace />
  }

  return <Outlet />
}

// set membership, matching the server: RequireRole('user') denies an admin
export function RequireRole({ allowed }: { allowed: Role[] }) {
  const { status, user } = useAuth()

  if (status === 'checking') return <Pending />
  if (status === 'guest') return <Navigate to="/login" replace />
  if (!user || !hasRole(user.role, allowed)) return <Navigate to="/403" replace />

  return <Outlet />
}
