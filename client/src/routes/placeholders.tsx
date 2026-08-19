import { useAuth } from '@/context/AuthContext'
import { ButtonLink } from '@/components/ui/Button'
import { EmptyState } from '@/components/ui/Card'

/*
  Real copy, never lorem. These say plainly what is not built yet and which phase builds it,
  which is more useful than a grey box and keeps the design reviewable.
*/

export function LandingPage() {
  return (
    <div className="min-h-dvh bg-ink-01">
      <div className="mx-auto flex min-h-dvh max-w-6xl flex-col px-6 lg:px-10">
        <header className="flex h-16 shrink-0 items-center justify-between">
          <span className="font-display text-lg tracking-tight text-ink-12">R4U</span>
          <ButtonLink to="/login" variant="ghost" size="sm">
            Sign in
          </ButtonLink>
        </header>

        <main className="flex flex-1 items-start pt-16">
          <div className="max-w-xl">
            <h1 className="font-display text-[38px] leading-tight text-ink-12">
              Build a resume a machine can actually read
            </h1>
            <p className="mt-4 text-md text-ink-09">
              Your content is stored as structured data, so one dataset renders through any
              template, exports to a real text-layer A4 PDF, and publishes as a link you control. No
              paywall at download.
            </p>

            <div className="mt-8">
              <ButtonLink to="/register" variant="primary">
                Create an account
              </ButtonLink>
            </div>

            <p className="mt-10 border-t border-ink-04 pt-5 text-xs text-ink-09">
              The hero lockup, where the 4 holds as a pivot and R4U expands into RESUME 4 YOU, is
              specified in docs/LANDING.md and built in phase 11 against real product screens.
            </p>
          </div>
        </main>
      </div>
    </div>
  )
}

export function DashboardPage() {
  const { user } = useAuth()

  return (
    <div className="max-w-3xl">
      <h1 className="text-xl text-ink-12">Signed in as {user?.name}</h1>
      <p className="mt-2 text-sm text-ink-09">
        Role: {user?.role}. Authentication, role guards and the privacy boundary are in place.
      </p>

      <div className="mt-10 border-t border-ink-04 pt-8">
        <EmptyState
          title="No resumes yet"
          description="Resume creation, the dashboard grid and the editor arrive in phases 4 and 5."
        />
      </div>
    </div>
  )
}

export function AdminPage() {
  return (
    <div className="max-w-3xl">
      <h1 className="text-xl text-ink-12">Admin</h1>
      <p className="mt-2 text-sm text-ink-09">
        Platform statistics, user management and the moderation queue arrive in phase 9.
      </p>
      <p className="mt-6 text-xs text-ink-09">Resume content is not visible to administrators.</p>
    </div>
  )
}

function ErrorPage({ code, title, body }: { code: string; title: string; body: string }) {
  const { status } = useAuth()
  const signedIn = status === 'authenticated'

  return (
    <div className="min-h-dvh bg-ink-01">
      <div className="mx-auto flex min-h-dvh max-w-6xl items-start px-6 pt-32 lg:px-10">
        <div className="max-w-md">
          <p className="font-mono text-2xs tracking-wide text-ink-07 uppercase">{code}</p>
          <h1 className="mt-3 text-xl text-ink-12">{title}</h1>
          <p className="mt-2 text-sm text-ink-09">{body}</p>

          <div className="mt-8">
            <ButtonLink to={signedIn ? '/dashboard' : '/'} variant="secondary">
              {signedIn ? 'Back to your dashboard' : 'Back to the home page'}
            </ButtonLink>
          </div>
        </div>
      </div>
    </div>
  )
}

export function NotFoundPage() {
  return (
    <ErrorPage
      code="404"
      title="That page does not exist"
      body="The address may be mistyped, or the resource may have been deleted."
    />
  )
}

export function ForbiddenPage() {
  return (
    <ErrorPage
      code="403"
      title="Your account cannot open this"
      body="Access is decided by role. If you believe this is wrong, ask an administrator to check yours."
    />
  )
}
