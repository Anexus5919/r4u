import { SAMPLE_RESUME } from '@r4u/shared'
import type { Resume } from '@r4u/shared'
import { Logo } from '@/components/brand/Logo'
import { Icon } from '@/components/ui/Icon'
import { Sheet } from './landing/Sheet'

const SHOWCASE: Partial<Resume> = { ...SAMPLE_RESUME, templateKey: 'placard' }

const POINTS = [
  'Eight professional templates, switch at any time',
  'A live A4 preview that updates as you type',
  'Free, with nothing locked behind a paywall',
]

// the form on the left, and on wide screens the thing it produces on the right
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
    <div className="grid min-h-dvh grid-cols-1 bg-ink-00 lg:grid-cols-2">
      <div className="flex min-w-0 flex-col px-6 sm:px-10 lg:px-16">
        <header className="flex h-16 shrink-0 items-center">
          <Logo tagline />
        </header>

        <main className="flex flex-1 items-center py-12">
          <div className="mx-auto w-full max-w-sm">
            <h1 className="text-[28px] text-ink-12">{title}</h1>
            <p className="mt-2 text-sm leading-relaxed text-ink-09">{intro}</p>

            <div className="mt-8">{children}</div>

            <div className="mt-8 border-t border-ink-04 pt-5 text-sm text-ink-09">{footer}</div>
          </div>
        </main>
      </div>

      <aside
        aria-label="What you can build with R4U"
        className="hidden min-w-0 flex-col justify-center border-l border-ink-04 bg-ink-02 px-16 py-16 lg:flex"
      >
        <div className="mx-auto w-full max-w-sm">
          <Sheet resume={SHOWCASE} />

          <ul className="mt-10 flex flex-col gap-3">
            {POINTS.map((point) => (
              <li key={point} className="flex items-center gap-3 text-sm text-ink-10">
                <span className="flex size-6 shrink-0 items-center justify-center rounded-xs bg-accent-subtle text-accent-text">
                  <Icon name="check" />
                </span>
                {point}
              </li>
            ))}
          </ul>
        </div>
      </aside>
    </div>
  )
}
