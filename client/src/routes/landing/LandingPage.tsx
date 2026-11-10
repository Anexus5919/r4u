import { useCallback, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { SECTION_TYPES, TEMPLATE_LIST } from '@r4u/shared'
import { Logo } from '@/components/brand/Logo'
import { ButtonLink } from '@/components/ui/Button'
import { Icon } from '@/components/ui/Icon'
import { useAuth } from '@/context/AuthContext'
import { useDismiss } from '@/hooks/useDismiss'
import { Features } from './Features'
import { Hero } from './Hero'
import { TemplateGallery } from './TemplateGallery'

const ANCHORS = [
  { href: '#features', label: 'Features' },
  { href: '#templates', label: 'Templates' },
  { href: '#how-it-works', label: 'How it works' },
]

// every figure here is read from the product, so the strip cannot overstate it
const FACTS = [
  { value: String(TEMPLATE_LIST.length), label: 'Professional templates' },
  { value: String(SECTION_TYPES.length), label: 'Section types, from summary to publications' },
  { value: 'A4', label: 'True-scale live preview' },
  { value: '0', label: 'Paywalls or watermarks' },
]

const STEPS = [
  {
    title: 'Create a free account',
    body: 'Choose the kind of resume you need: fresher, professional, technical or academic. R4U seeds the right sections in the right order.',
  },
  {
    title: 'Fill in guided sections',
    body: 'Structured fields with live validation. Drag to reorder, hide a section without deleting it, and let the coach flag weak bullets as you type.',
  },
  {
    title: 'Choose a template and refine',
    body: 'Check the result on a true A4 page, tune the accent, type size and spacing, and keep a version for every role you apply to.',
  },
]

function LandingNav() {
  const { status } = useAuth()
  const signedIn = status === 'authenticated'
  const [open, setOpen] = useState(false)
  const root = useRef<HTMLElement>(null)
  const close = useCallback(() => setOpen(false), [])

  useDismiss(root, open, close)

  return (
    <header ref={root} className="sticky top-0 z-20 border-b border-ink-04 bg-ink-00">
      <div className="mx-auto flex h-16 max-w-7xl items-center gap-4 px-6 lg:px-10">
        <Logo tagline />

        <nav aria-label="Sections" className="ml-10 hidden items-center gap-1 md:flex">
          {ANCHORS.map((anchor) => (
            <a
              key={anchor.href}
              href={anchor.href}
              className="t-xs rounded-xs px-3 py-2 text-sm font-medium text-ink-09 no-underline transition-colors hover:bg-ink-02 hover:text-ink-12"
            >
              {anchor.label}
            </a>
          ))}
        </nav>

        <div className="ml-auto hidden items-center gap-2 sm:flex">
          {signedIn ? (
            <ButtonLink to="/dashboard" variant="primary">
              Go to dashboard
            </ButtonLink>
          ) : (
            <>
              <ButtonLink to="/login" variant="ghost">
                Sign in
              </ButtonLink>
              <ButtonLink to="/register" variant="primary">
                Get started
              </ButtonLink>
            </>
          )}
        </div>

        <button
          type="button"
          aria-label={open ? 'Close menu' : 'Open menu'}
          aria-expanded={open}
          aria-controls="landing-menu"
          onClick={() => setOpen((value) => !value)}
          className="ml-auto flex size-10 items-center justify-center rounded-xs text-ink-10 hover:bg-ink-02 sm:ml-2 md:hidden"
        >
          <Icon name={open ? 'close' : 'grip'} />
        </button>
      </div>

      {open ? (
        <nav
          id="landing-menu"
          aria-label="Sections"
          className="flex flex-col gap-1 border-t border-ink-04 px-6 py-4 md:hidden"
        >
          {ANCHORS.map((anchor) => (
            <a
              key={anchor.href}
              href={anchor.href}
              onClick={close}
              className="rounded-xs px-3 py-2.5 text-sm font-medium text-ink-11 no-underline hover:bg-ink-02"
            >
              {anchor.label}
            </a>
          ))}
          <div className="mt-3 grid grid-cols-2 gap-2 border-t border-ink-04 pt-4 sm:hidden">
            {signedIn ? (
              <ButtonLink to="/dashboard" variant="primary" className="col-span-2">
                Go to dashboard
              </ButtonLink>
            ) : (
              <>
                <ButtonLink to="/login" variant="secondary">
                  Sign in
                </ButtonLink>
                <ButtonLink to="/register" variant="primary">
                  Get started
                </ButtonLink>
              </>
            )}
          </div>
        </nav>
      ) : null}
    </header>
  )
}

function FactStrip() {
  return (
    <section aria-label="R4U in numbers" className="border-b border-ink-04 bg-ink-00">
      <dl className="mx-auto grid max-w-7xl grid-cols-2 gap-y-10 px-6 py-12 lg:grid-cols-4 lg:px-10">
        {FACTS.map((fact) => (
          <div key={fact.label} className="flex flex-col gap-1 border-l border-ink-04 pl-5">
            <dt className="order-2 text-sm text-ink-09">{fact.label}</dt>
            <dd className="order-1 text-d4 font-semibold tracking-tight text-ink-12">
              {fact.value}
            </dd>
          </div>
        ))}
      </dl>
    </section>
  )
}

function HowItWorks() {
  return (
    <section id="how-it-works" className="scroll-mt-20 border-b border-ink-04 bg-ink-01">
      <div className="mx-auto grid max-w-7xl grid-cols-1 gap-14 px-6 py-24 lg:grid-cols-[1fr_1.2fr] lg:px-10">
        <div className="max-w-md">
          <p className="text-sm font-semibold text-accent-text">How it works</p>
          <h2 className="mt-3 text-d4 text-ink-12">From a blank page to a finished resume</h2>
          <p className="mt-4 text-lg text-ink-09">
            No formatting, no fighting margins. You write the content; R4U handles the layout.
          </p>
          <ButtonLink to="/register" variant="primary" size="lg" className="mt-8">
            Start for free
            <Icon name="arrow" />
          </ButtonLink>
        </div>

        <ol className="flex flex-col">
          {STEPS.map((step, index) => (
            <li
              key={step.title}
              className="flex gap-5 border-t border-ink-04 py-7 first:border-t-0 first:pt-0"
            >
              <span className="flex size-10 shrink-0 items-center justify-center rounded-xs bg-accent text-sm font-semibold text-accent-on">
                {index + 1}
              </span>
              <div>
                <h3 className="text-lg">{step.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-ink-09">{step.body}</p>
              </div>
            </li>
          ))}
        </ol>
      </div>
    </section>
  )
}

function CallToAction() {
  return (
    <section className="bg-ink-01 px-6 py-24 lg:px-10">
      <div className="mx-auto flex max-w-7xl flex-col items-start gap-8 rounded-sm bg-accent px-8 py-14 sm:px-14 lg:flex-row lg:items-center lg:justify-between">
        <div className="max-w-2xl">
          <h2 className="text-d3 text-accent-on sm:text-d4">Your next resume starts here.</h2>
          <p className="mt-3 text-lg text-accent-on opacity-85">
            Free to use, with nothing locked behind a paywall. It takes about fifteen minutes.
          </p>
        </div>
        <ButtonLink to="/register" variant="secondary" size="lg" className="shrink-0">
          Create your free account
        </ButtonLink>
      </div>
    </section>
  )
}

function Footer() {
  return (
    <footer className="border-t border-ink-04 bg-ink-00">
      <div className="mx-auto grid max-w-7xl grid-cols-1 gap-10 px-6 py-14 sm:grid-cols-2 lg:grid-cols-[2fr_1fr_1fr] lg:px-10">
        <div className="max-w-sm">
          <Logo tagline />
          <p className="mt-4 text-sm text-ink-09">
            An ATS-aware resume builder. Structured content, a live A4 preview and professional
            templates, free for everyone.
          </p>
        </div>

        <div>
          <p className="text-sm font-semibold text-ink-12">Product</p>
          <ul className="mt-4 flex flex-col gap-2.5">
            {ANCHORS.map((anchor) => (
              <li key={anchor.href}>
                <a
                  href={anchor.href}
                  className="text-sm text-ink-09 no-underline hover:text-ink-12"
                >
                  {anchor.label}
                </a>
              </li>
            ))}
          </ul>
        </div>

        <div>
          <p className="text-sm font-semibold text-ink-12">Account</p>
          <ul className="mt-4 flex flex-col gap-2.5">
            <li>
              <Link to="/login" className="text-sm text-ink-09 no-underline hover:text-ink-12">
                Sign in
              </Link>
            </li>
            <li>
              <Link to="/register" className="text-sm text-ink-09 no-underline hover:text-ink-12">
                Create an account
              </Link>
            </li>
            <li>
              <Link to="/reset" className="text-sm text-ink-09 no-underline hover:text-ink-12">
                Reset your password
              </Link>
            </li>
          </ul>
        </div>
      </div>

      <div className="border-t border-ink-04">
        <div className="mx-auto flex max-w-7xl flex-col gap-2 px-6 py-6 text-xs text-ink-09 sm:flex-row sm:justify-between lg:px-10">
          <p>© {new Date().getFullYear()} R4U, Resume For You.</p>
          <p>Built by Adarsh Singh.</p>
        </div>
      </div>
    </footer>
  )
}

export function LandingPage() {
  return (
    <div className="min-h-dvh bg-ink-00">
      <LandingNav />
      <main>
        <Hero />
        <FactStrip />
        <Features />
        <TemplateGallery />
        <HowItWorks />
        <CallToAction />
      </main>
      <Footer />
    </div>
  )
}
