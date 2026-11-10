import { Link } from 'react-router-dom'
import { SAMPLE_RESUME, computeMeta, getTemplate } from '@r4u/shared'
import { ButtonLink } from '@/components/ui/Button'
import { buttonClasses } from '@/components/ui/buttonClasses'
import { Icon } from '@/components/ui/Icon'
import { useAuth } from '@/context/AuthContext'
import { Sheet } from './Sheet'

const ASSURANCES = ['Free, with no paywall', 'No card required', 'Private by design']

const meta = computeMeta(SAMPLE_RESUME)
const template = getTemplate(SAMPLE_RESUME.templateKey)

function HeroArtifact() {
  return (
    <figure className="relative mx-auto w-full max-w-[460px] lg:mr-0">
      <Sheet resume={SAMPLE_RESUME} />

      <div className="float absolute top-[46%] -left-10 hidden w-52 rounded-sm border border-ink-04 bg-ink-00 p-4 sm:block">
        <div className="flex items-baseline justify-between">
          <span className="text-xs font-medium text-ink-09">Completeness</span>
          <span className="font-mono text-sm font-semibold text-ink-12">{meta.completeness}%</span>
        </div>
        <div className="mt-3 h-1.5 overflow-hidden rounded-xs bg-ink-03">
          <div className="h-full bg-accent" style={{ width: `${meta.completeness}%` }} />
        </div>
        <p className="mt-3 text-xs text-ink-09">
          {meta.sectionCount} sections, {meta.wordCount} words
        </p>
      </div>

      <div className="float absolute -right-6 bottom-12 hidden items-center gap-3 rounded-sm border border-ink-04 bg-ink-00 px-4 py-3 sm:flex">
        <span className="flex size-8 items-center justify-center rounded-xs bg-accent-subtle text-accent-text">
          <Icon name="check" />
        </span>
        <span>
          <span className="block text-sm font-medium text-ink-12">{template.name} template</span>
          <span className="block text-xs text-ink-09">Single column, reads cleanly by ATS</span>
        </span>
      </div>

      <figcaption className="sr-only">
        A sample resume for {SAMPLE_RESUME.personal.fullName}, rendered live in the {template.name}{' '}
        template.
      </figcaption>
    </figure>
  )
}

export function Hero() {
  const { status } = useAuth()
  const signedIn = status === 'authenticated'

  return (
    <section className="relative overflow-hidden border-b border-ink-04">
      <div className="mx-auto grid max-w-7xl grid-cols-1 items-center gap-16 px-6 pt-16 pb-20 lg:grid-cols-[1.05fr_1fr] lg:px-10 lg:pt-24 lg:pb-28">
        <div className="max-w-xl">
          <p className="inline-flex items-center gap-2 rounded-xs border border-accent-edge bg-accent-subtle px-3 py-1 text-xs font-medium text-accent-text">
            R4U <span className="text-accent-edge">/</span> Resume For You
          </p>

          <h1 className="mt-6 text-[40px] text-ink-12 sm:text-d5 lg:text-[54px]">
            Build a resume that recruiters read and machines understand.
          </h1>

          <p className="mt-6 text-md leading-relaxed text-ink-09 sm:text-lg">
            R4U keeps your resume as structured content, not a formatted file. Write it once, watch
            it take shape on a true A4 page as you type, and move between eight professional
            templates without losing a word.
          </p>

          <div className="mt-9 flex flex-col gap-3 sm:flex-row">
            {signedIn ? (
              <ButtonLink to="/dashboard" variant="primary" size="lg">
                Open your dashboard
                <Icon name="arrow" />
              </ButtonLink>
            ) : (
              <ButtonLink to="/register" variant="primary" size="lg">
                Create your resume
                <Icon name="arrow" />
              </ButtonLink>
            )}
            <a href="#templates" className={buttonClasses('secondary', 'lg')}>
              Browse templates
            </a>
          </div>

          <ul className="mt-9 flex flex-wrap gap-x-6 gap-y-2">
            {ASSURANCES.map((item) => (
              <li key={item} className="flex items-center gap-2 text-sm text-ink-10">
                <Icon name="check" className="text-success" />
                {item}
              </li>
            ))}
          </ul>

          {signedIn ? null : (
            <p className="mt-6 text-sm text-ink-09">
              Already have an account?{' '}
              <Link to="/login" className="font-medium text-accent-text">
                Sign in
              </Link>
            </p>
          )}
        </div>

        <HeroArtifact />
      </div>
    </section>
  )
}
