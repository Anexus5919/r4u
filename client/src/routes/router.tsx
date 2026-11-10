import { createBrowserRouter } from 'react-router-dom'
import { AppShell } from './AppShell'
import { DashboardPage } from './DashboardPage'
import { LoginPage } from './LoginPage'
import { NewResumePage } from './NewResumePage'
import { NotificationsPage } from './NotificationsPage'
import { PreviewPage } from './PreviewPage'
import { ProfilePage } from './ProfilePage'
import { AboutPage, PrivacyPage, TemplatesPage, TermsPage } from './PublicPages'
import { RegisterPage } from './RegisterPage'
import { ResetPage } from './ResetPage'
import { ReviewsPage } from './ReviewsPage'
import { RequireAuth, RequireGuest, RequireRole } from './guards'
import { LandingPage } from './landing/LandingPage'
import {
  LazyAdminOverviewPage,
  LazyAdminReportsPage,
  LazyAdminTemplatesPage,
  LazyAdminUsersPage,
  LazyEditorPage,
  LazyPublicResumePage,
  LazyReviewRoomPage,
} from './lazy'
import { ForbiddenPage, NotFoundPage } from './placeholders'

// guards are layout routes, so a new child inherits its protection by position
// RequireRole is set membership, matching the server: admin and user branches are siblings
export const router = createBrowserRouter([
  { path: '/', element: <LandingPage /> },
  { path: '/templates', element: <TemplatesPage /> },
  { path: '/about', element: <AboutPage /> },
  { path: '/privacy', element: <PrivacyPage /> },
  { path: '/terms', element: <TermsPage /> },
  { path: '/r/:slug', element: <LazyPublicResumePage /> },

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
              { path: '/resume/new', element: <NewResumePage /> },
              { path: '/resume/:id/edit', element: <LazyEditorPage /> },
              { path: '/resume/:id', element: <PreviewPage /> },
              { path: '/reviews', element: <ReviewsPage /> },
              { path: '/reviews/:id', element: <LazyReviewRoomPage /> },
              { path: '/notifications', element: <NotificationsPage /> },
            ],
          },
          {
            element: <RequireRole allowed={['admin']} />,
            children: [
              { path: '/admin', element: <LazyAdminOverviewPage /> },
              { path: '/admin/users', element: <LazyAdminUsersPage /> },
              { path: '/admin/templates', element: <LazyAdminTemplatesPage /> },
              { path: '/admin/reports', element: <LazyAdminReportsPage /> },
            ],
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
