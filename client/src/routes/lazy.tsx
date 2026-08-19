import { Suspense, lazy } from 'react'

/*
  Route chunks that stay out of the main bundle.

  The editor pulls in dnd-kit and is the heaviest surface in the product, and it is only reachable
  after signing in. The design specimen is a review tool no real user ever opens. Phase 7 adds the
  PDF renderer, another 454 kB gzip, which is deferred for the same reason.

  These live here rather than in router.tsx so that file exports only its route table. A module
  that mixes component definitions with other exports breaks React Fast Refresh.
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

export function LazyEditorPage() {
  return (
    <Deferred>
      <EditorPage />
    </Deferred>
  )
}

export function LazyDesignSpecimen() {
  return (
    <Deferred>
      <DesignSpecimen />
    </Deferred>
  )
}
