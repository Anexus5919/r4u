import { createBrowserRouter } from 'react-router-dom'
import { AppShell } from './AppShell'
import { DesignSpecimen } from './DesignSpecimen'
import { LoginPage } from './LoginPage'
import { RegisterPage } from './RegisterPage'
import { ResetPage } from './ResetPage'
import { RequireAuth, RequireGuest, RequireRole } from './guards'
import { AdminPage, DashboardPage, ForbiddenPage, LandingPage, NotFoundPage } from './placeholders'

/*
  Guards are layout routes rather than per-page wrappers, so a new child route inherits its
  protection by position instead of by someone remembering to add it.

  RequireRole is set membership, matching the server: the admin branch and the user branch are
  siblings, and neither contains the other.
*/
export const router = createBrowserRouter([
  { path: '/', element: <LandingPage /> },

  // kept for design review until the real surfaces exist. removed in phase 11.
  { path: '/design', element: <DesignSpecimen /> },

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
            children: [{ path: '/dashboard', element: <DashboardPage /> }],
          },
          {
            element: <RequireRole allowed={['admin']} />,
            children: [{ path: '/admin', element: <AdminPage /> }],
          },
        ],
      },
    ],
  },

  { path: '/403', element: <ForbiddenPage /> },
  { path: '*', element: <NotFoundPage /> },
])
