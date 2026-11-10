import { createBrowserRouter } from 'react-router-dom'
import { AppShell } from './AppShell'
import { DashboardPage } from './DashboardPage'
import { LoginPage } from './LoginPage'
import { ProfilePage } from './ProfilePage'
import { RegisterPage } from './RegisterPage'
import { ResetPage } from './ResetPage'
import { RequireAuth, RequireGuest, RequireRole } from './guards'
import { LazyDesignSpecimen, LazyEditorPage } from './lazy'
import { LandingPage } from './landing/LandingPage'
import { PreviewPage } from './PreviewPage'
import { AdminPage, ForbiddenPage, NotFoundPage } from './placeholders'

/*
  Guards are layout routes rather than per-page wrappers, so a new child route inherits its
  protection by position instead of by someone remembering to add it.

  RequireRole is set membership, matching the server: the admin branch and the user branch are
  siblings, and neither contains the other.
*/
export const router = createBrowserRouter([
  { path: '/', element: <LandingPage /> },

  // kept for design review until the real surfaces exist. removed in phase 11.
  { path: '/design', element: <LazyDesignSpecimen /> },

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
              { path: '/resume/:id/edit', element: <LazyEditorPage /> },
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
