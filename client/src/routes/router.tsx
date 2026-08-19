import { Suspense, lazy } from 'react'
import { createBrowserRouter } from 'react-router-dom'
import { AppShell } from './AppShell'
import { DashboardPage } from './DashboardPage'
import { LoginPage } from './LoginPage'
import { ProfilePage } from './ProfilePage'
import { RegisterPage } from './RegisterPage'
import { ResetPage } from './ResetPage'
import { RequireAuth, RequireGuest, RequireRole } from './guards'
import { AdminPage, ForbiddenPage, LandingPage, NotFoundPage, PreviewPage } from './placeholders'

/*
  Two routes are split out of the main bundle.

  The editor pulls in dnd-kit and is the heaviest surface in the product, and it is only reachable
  after signing in. The design specimen is a review tool no real user ever opens. Phase 7 adds the
  PDF renderer, which is another 454 kB gzip and must be deferred for the same reason.
*/
const EditorPage = lazy(() =>
  import('./EditorPage').then((module) => ({ default: module.EditorPage }))
)

const DesignSpecimen = lazy(() =>
  import('./DesignSpecimen').then((module) => ({ default: module.DesignSpecimen }))
)

/*
  A blank ground rather than a spinner. These chunks resolve well inside the time a spinner would
  take to stop reading as jank, and painting the ground colour avoids a flash between routes.
*/
function Deferred({ children }: { children: React.ReactNode }) {
  return (
    <Suspense fallback={<div className="min-h-dvh bg-ink-01" aria-busy="true" />}>
      {children}
    </Suspense>
  )
}

/*
  Guards are layout routes rather than per-page wrappers, so a new child route inherits its
  protection by position instead of by someone remembering to add it.

  RequireRole is set membership, matching the server: the admin branch and the user branch are
  siblings, and neither contains the other.
*/
export const router = createBrowserRouter([
  { path: '/', element: <LandingPage /> },

  // kept for design review until the real surfaces exist. removed in phase 11.
  {
    path: '/design',
    element: (
      <Deferred>
        <DesignSpecimen />
      </Deferred>
    ),
  },

  {
    element: <RequireGuest />,
    children: [
      { path: '/login', element: <LoginPage /> },
      { path: '/register', element: <RegisterPage /> },
      { path: '/reset', element: <ResetPage /> },
    ],
  },

  {
    element: <RequireAuth />,
    children: [
      {
        element: <AppShell />,
        children: [
          {
            element: <RequireRole allowed={['user', 'reviewer']} />,
            children: [
              { path: '/dashboard', element: <DashboardPage /> },
              {
                path: '/resume/:id/edit',
                element: (
                  <Deferred>
                    <EditorPage />
                  </Deferred>
                ),
              },
              { path: '/resume/:id', element: <PreviewPage /> },
            ],
          },
          {
            element: <RequireRole allowed={['admin']} />,
            children: [{ path: '/admin', element: <AdminPage /> }],
          },
          {
            element: <RequireRole allowed={['user', 'reviewer', 'admin']} />,
            children: [{ path: '/profile', element: <ProfilePage /> }],
          },
        ],
      },
    ],
  },

  { path: '/403', element: <ForbiddenPage /> },
  { path: '*', element: <NotFoundPage /> },
])
