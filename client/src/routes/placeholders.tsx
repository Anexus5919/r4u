import { useAuth } from '@/context/AuthContext'
import { Logo } from '@/components/brand/Logo'
import { ButtonLink } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'

// the console is built in phase 9; until then the route exists so the role guard is exercised
export function AdminPage() {
  return (
    <div className="mx-auto max-w-7xl">
      <h1 className="text-xl text-ink-12">Admin console</h1>
      <p className="mt-1.5 text-sm text-ink-09">
        Platform statistics, user management, templates and moderation.
      </p>

      <Card className="mt-8 max-w-2xl p-6">
        <h2 className="text-md text-ink-12">The console is being built</h2>
        <p className="mt-2 text-sm text-ink-09">
          User search, role changes, blocking, the template library and the reports queue will
          appear here. Your administrator role is already active and enforced on every request.
        </p>
        <p className="mt-5 border-t border-ink-04 pt-4 text-sm text-ink-10">
          Resume content is not visible to administrators, by design.
        </p>
      </Card>
    </div>
  )
}

function ErrorPage({ code, title, body }: { code: string; title: string; body: string }) {
  const { status, user } = useAuth()
  const signedIn = status === 'authenticated'
  const home = user?.role === 'admin' ? '/admin' : '/dashboard'

  return (
    <div className="flex min-h-dvh flex-col bg-ink-01">
      <header className="flex h-16 items-center border-b border-ink-04 bg-ink-00 px-6 lg:px-10">
        <Logo tagline />
      </header>

      <main className="flex flex-1 items-center justify-center px-6 py-20">
        <div className="max-w-md text-center">
          <p className="text-d5 leading-none font-semibold tracking-tight text-accent">{code}</p>
          <h1 className="mt-6 text-xl text-ink-12">{title}</h1>
          <p className="mx-auto mt-3 text-sm leading-relaxed text-ink-09">{body}</p>

          <div className="mt-8 flex justify-center gap-2">
            <ButtonLink to={signedIn ? home : '/'} variant="primary">
              {signedIn ? 'Back to your dashboard' : 'Back to the home page'}
            </ButtonLink>
            {signedIn ? null : (
              <ButtonLink to="/login" variant="secondary">
                Sign in
              </ButtonLink>
            )}
          </div>
        </div>
      </main>
    </div>
  )
}

export function NotFoundPage() {
  return (
    <ErrorPage
      code="404"
      title="That page does not exist"
      body="The address may be mistyped, or the page may have moved. Nothing you saved is affected."
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
