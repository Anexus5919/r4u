import { Suspense, lazy } from 'react'
import type { ComponentType } from 'react'

// route chunks kept out of the main bundle; this file exports components only, for Fast Refresh

function deferred<T extends Record<string, unknown>>(loader: () => Promise<T>, name: keyof T) {
  const Page = lazy(() => loader().then((module) => ({ default: module[name] as ComponentType })))

  // a blank ground rather than a spinner: these chunks resolve before a spinner would read as calm
  return function Deferred() {
    return (
      <Suspense fallback={<div className="min-h-dvh bg-ink-01" aria-busy="true" />}>
        <Page />
      </Suspense>
    )
  }
}

export const LazyEditorPage = deferred(() => import('./EditorPage'), 'EditorPage')
export const LazyReviewRoomPage = deferred(() => import('./ReviewRoomPage'), 'ReviewRoomPage')
export const LazyPublicResumePage = deferred(() => import('./PublicResumePage'), 'PublicResumePage')
export const LazyAdminOverviewPage = deferred(
  () => import('./admin/AdminOverviewPage'),
  'AdminOverviewPage'
)
export const LazyAdminUsersPage = deferred(() => import('./admin/AdminUsersPage'), 'AdminUsersPage')
export const LazyAdminTemplatesPage = deferred(
  () => import('./admin/AdminTemplatesPage'),
  'AdminTemplatesPage'
)
export const LazyAdminReportsPage = deferred(
  () => import('./admin/AdminReportsPage'),
  'AdminReportsPage'
)
