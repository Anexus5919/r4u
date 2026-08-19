import { Link } from 'react-router-dom'

/*
  Not a centred card on a tinted field. The column sits left of centre on wide screens and the
  content is left aligned, which reads as a document rather than as a dialog. Phase 6 puts a
  rendered resume in the space on the right, once there is a renderer to put there.
*/
export function AuthLayout({
  title,
  intro,
  children,
  footer,
}: {
  title: string
  intro: string
  children: React.ReactNode
  footer: React.ReactNode
}) {
  return (
    <div className="min-h-dvh bg-ink-01">
      <div className="mx-auto flex min-h-dvh max-w-6xl flex-col px-6 lg:px-10">
        <header className="flex h-16 shrink-0 items-center">
          <Link to="/" className="font-display text-lg tracking-tight text-ink-12 no-underline">
            R4U
          </Link>
        </header>

        <main className="flex flex-1 items-start pt-10 pb-20 lg:pt-24">
          <div className="w-full max-w-sm">
            <h1 className="text-xl text-ink-12">{title}</h1>
            <p className="mt-2 text-sm text-ink-09">{intro}</p>

            <div className="mt-8">{children}</div>

            <div className="mt-8 border-t border-ink-04 pt-5 text-sm text-ink-09">{footer}</div>
          </div>
        </main>
      </div>
    </div>
  )
}
