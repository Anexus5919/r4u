import { useParams } from 'react-router-dom'
import { useAuth } from '@/context/AuthContext'
import { ButtonLink } from '@/components/ui/Button'

/*
  Real copy, never lorem. These say plainly what is not built yet and which phase builds it,
  which is more useful than a grey box and keeps the design reviewable.
*/

/*
  The editor and preview surfaces land in phases 5 and 6. They exist as routes now so the
  dashboard card actions navigate somewhere real rather than into a 404, and so the resume
  loads and the ownership guard is exercised on the way.
*/
function ResumeStub({ heading, body }: { heading: string; body: string }) {
  const { id } = useParams()

  return (
    <div className="max-w-3xl">
      <ButtonLink to="/dashboard" variant="ghost" size="sm">
        Back to my resumes
      </ButtonLink>

      <h1 className="mt-6 text-xl text-ink-12">{heading}</h1>
      <p className="mt-2 text-sm text-ink-09">{body}</p>
      <p className="mt-4 font-mono text-2xs text-ink-07">resume {id}</p>
    </div>
  )
}

export function PreviewPage() {
  return (
    <ResumeStub
      heading="Preview and export"
      body="Template switching, the live A4 preview and text-layer PDF export arrive in phases 6 and 7."
    />
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
