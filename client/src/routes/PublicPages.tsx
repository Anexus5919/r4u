import { useNavigate } from 'react-router-dom'
import { CHECKS, DIMENSIONS, RUBRIC_VERSION, TEMPLATE_LIST } from '@r4u/shared'
import { useAuth } from '@/context/AuthContext'
import { TemplateGrid } from '@/components/resume/TemplateGrid'
import { useTemplates } from '@/hooks/useTemplates'
import { ButtonLink } from '@/components/ui/Button'
import { Footer, LandingNav } from './landing/LandingPage'

function PublicLayout({
  title,
  intro,
  children,
}: {
  title: string
  intro: string
  children: React.ReactNode
}) {
  return (
    <div className="flex min-h-dvh flex-col bg-ink-01">
      <LandingNav />
      <main className="mx-auto w-full max-w-7xl flex-1 px-6 py-16 lg:px-10">
        <h1 className="text-d4 text-ink-12">{title}</h1>
        <p className="mt-4 max-w-2xl text-lg text-ink-09">{intro}</p>
        <div className="mt-10">{children}</div>
      </main>
      <Footer />
    </div>
  )
}

export function TemplatesPage() {
  const navigate = useNavigate()
  const { status } = useAuth()
  const templates = useTemplates()

  return (
    <PublicLayout
      title="Templates"
      intro="Every template reads the same structured content. Each one is rendered here from the same sample resume, so you see exactly what you would get. Switch at any time without losing a word."
    >
      <TemplateGrid
        templates={templates}
        actionLabel="Use this template"
        onSelect={(template) =>
          navigate(
            status === 'authenticated' ? `/resume/new?template=${template.key}` : '/register'
          )
        }
      />
    </PublicLayout>
  )
}

function Prose({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex max-w-3xl flex-col gap-8 text-md leading-relaxed text-ink-10">
      {children}
    </div>
  )
}

function Block({ heading, children }: { heading: string; children: React.ReactNode }) {
  return (
    <section>
      <h2 className="text-xl text-ink-12">{heading}</h2>
      <div className="mt-3 flex flex-col gap-3">{children}</div>
    </section>
  )
}

export function AboutPage() {
  return (
    <PublicLayout
      title="About R4U"
      intro="R4U, short for Resume For You, is an ATS-aware resume builder. It keeps your resume as structured content, so it can render through any template, export a real text-layer PDF and publish as a link you control."
    >
      <Prose>
        <Block heading="Why it exists">
          <p>
            Most resumes are still written in word processors, where formatting takes longer than
            writing and every version lives in a file called final_v3. Most online builders put
            templates and downloads behind a subscription. R4U is free, with nothing behind a
            paywall.
          </p>
        </Block>
        <Block heading="What it does">
          <p>
            A guided editor with live validation and a writing coach. A true A4 preview that updates
            as you type. Eight professional templates and presets. PDF export with selectable text.
            Share links with expiry, redaction and view counts. Real-time review with mentors, who
            comment and chat but never edit.
          </p>
        </Block>
        <Block heading="How it is built">
          <p>
            React, Tailwind CSS and the Context API on the client; Node.js, Express, MongoDB with
            Mongoose and Socket.IO on the server; JWT authentication with role-based access control.
            It is a Full Stack Development laboratory project by Adarsh Singh.
          </p>
        </Block>
        <Block heading="Contact">
          <p>
            Questions, bugs or a resume that renders oddly: write to{' '}
            <a className="font-medium text-accent-text" href="mailto:hello@r4u.dev">
              hello@r4u.dev
            </a>
            .
          </p>
        </Block>
        <div>
          <ButtonLink to="/register" variant="primary" size="lg">
            Create your resume
          </ButtonLink>
        </div>
      </Prose>
    </PublicLayout>
  )
}

export function PrivacyPage() {
  return (
    <PublicLayout
      title="Privacy"
      intro="What R4U stores, who can see it, and how to remove it. Written to be read, not to be skimmed past."
    >
      <Prose>
        <Block heading="What we store">
          <p>
            Your account: name, email, a password stored only as a bcrypt hash, and the profile
            fields you choose to fill. Your resumes, their versions, share links and reviews. A
            short activity log of significant actions, kept for 180 days.
          </p>
        </Block>
        <Block heading="Who can see your resume">
          <p>
            Only you. A reviewer you invite can read it while the review is open, without your
            private notes. Anyone with a share link you create can read that page until you turn it
            off, delete it or it expires. Administrators cannot open resume content: this is
            enforced where the data is read, not hidden behind a button.
          </p>
        </Block>
        <Block heading="Share links">
          <p>
            Links are stored only as a fingerprint, are never indexed by search engines and do not
            leak through a referrer. You can hide your email, phone and location on any link. View
            counts are kept per link and never count your own visits.
          </p>
        </Block>
        <Block heading="Cookies">
          <p>
            One cookie keeps you signed in. It is httpOnly, so scripts cannot read it, and it is
            used only by the sign-in endpoints. There is no advertising or analytics tracking.
          </p>
        </Block>
        <Block heading="Deleting your data">
          <p>
            Deleting your account in Profile removes your resumes, versions, share links, reviews,
            messages, comments and notifications at once.
          </p>
        </Block>
      </Prose>
    </PublicLayout>
  )
}

export function TermsPage() {
  return (
    <PublicLayout
      title="Terms"
      intro="The short version: it is free, your content stays yours, and do not use it to harm anyone."
    >
      <Prose>
        <Block heading="Your content">
          <p>
            You own what you write. You give R4U only the permission it needs to store, render and
            share it as you direct. You are responsible for its accuracy.
          </p>
        </Block>
        <Block heading="Acceptable use">
          <p>
            No impersonation, no other people&apos;s personal data, no spam and nothing unlawful.
            Shared pages can be reported, and administrators may turn off a link that breaks these
            terms or block an account that abuses the service.
          </p>
        </Block>
        <Block heading="The service">
          <p>
            R4U is provided free and as is, as a student project, without a guarantee of
            availability. Keep a downloaded PDF of anything you cannot afford to lose.
          </p>
        </Block>
      </Prose>
    </PublicLayout>
  )
}

// generated from the same table the scorer reads, so the published method cannot drift from the real one
export function AtsMethodologyPage() {
  return (
    <PublicLayout
      title="How the ATS Readiness score works"
      intro={`A deterministic, explainable 100-point rubric, version ${RUBRIC_VERSION}. The same resume and job posting always produce the same score, and every point lost names the rule behind it.`}
    >
      <Prose>
        <Block heading="What an applicant tracking system actually does">
          <p>
            Workday, Taleo, Greenhouse, Lever, iCIMS and the rest do not score and reject resumes.
            They extract the text, split it into sections by matching headings, and write fields
            into a database that recruiters search. If the parser cannot read your work history, you
            do not appear in those searches at all. That is the failure this score measures.
          </p>
          <p>
            So the number is called ATS Readiness, never a chance of passing. It is built on the
            published resume-quality codes of the Textkernel (Sovren) parser that iCIMS and Bullhorn
            license, not on folklore.
          </p>
        </Block>

        <Block heading="How R4U scores">
          <p>
            R4U already holds your resume as structured data, so it never has to guess by reading a
            PDF. It writes out the exact plain text a line-by-line parser would see, interleaving
            the columns of a two-column template the way a real parser does, and scores that text,
            the structured data and the template together.
          </p>
          <p>
            Without a job description the score covers dimensions A to D, out of 80, scaled to 100
            and labelled Format only. Paste a posting to add dimension E.
          </p>
        </Block>

        <section>
          <h2 className="text-xl text-ink-12">The 100 points</h2>
          <div className="mt-4 overflow-x-auto rounded-sm border border-ink-04 bg-ink-00">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-ink-04 text-xs text-ink-09">
                <tr>
                  <th className="px-4 py-2.5 font-medium">Check</th>
                  <th className="px-4 py-2.5 font-medium">What it looks for</th>
                  <th className="px-4 py-2.5 text-right font-medium">Points</th>
                </tr>
              </thead>
              {DIMENSIONS.map((dimension) => (
                <tbody key={dimension.id} className="border-b border-ink-04 last:border-b-0">
                  <tr className="bg-ink-01">
                    <th colSpan={2} className="px-4 py-2 font-semibold text-ink-12">
                      {dimension.id}. {dimension.title}
                    </th>
                    <td className="px-4 py-2 text-right font-semibold text-ink-12 tabular-nums">
                      {dimension.points}
                    </td>
                  </tr>
                  {CHECKS.filter((c) => c.dimension === dimension.id).map((c) => (
                    <tr key={c.id} className="border-t border-ink-03">
                      <td className="px-4 py-2 font-mono text-xs text-ink-09">{c.id}</td>
                      <td className="px-4 py-2 text-ink-11">{c.title}</td>
                      <td className="px-4 py-2 text-right text-ink-11 tabular-nums">{c.points}</td>
                    </tr>
                  ))}
                </tbody>
              ))}
            </table>
          </div>
        </section>

        <Block heading="Three safeguards">
          <p>
            <strong className="text-ink-12">Hidden text scores zero.</strong> Text in the page
            colour or below 6pt is extracted by every parser and shows up in recruiter exports. It
            gets applications blacklisted, so R4U refuses to export it.
          </p>
          <p>
            <strong className="text-ink-12">Keyword stuffing is capped, not rewarded.</strong> Each
            keyword counts once. If one is repeated beyond reason, the skills list passes 30 items,
            or most listed skills appear nowhere else, dimension E stops at 12 of 20.
          </p>
          <p>
            <strong className="text-ink-12">Nothing is rewritten for you.</strong> Every failed
            check links to the field it concerns. You decide what to change.
          </p>
        </Block>

        <section>
          <h2 className="text-xl text-ink-12">Template ceilings</h2>
          <p className="mt-3">
            A template&rsquo;s layout limits how well it can parse. Each one is badged with the most
            it can earn on dimension A, so a two-column design never looks like a broken checker.
          </p>
          <dl className="mt-4 grid max-w-md grid-cols-[1fr_auto] gap-x-6 gap-y-1.5 text-sm">
            {TEMPLATE_LIST.map((template) => (
              <div key={template.key} className="contents">
                <dt className="text-ink-11">{template.name}</dt>
                <dd className="text-right text-ink-12 tabular-nums">
                  {template.atsProfile.maxDimensionAScore} of 30
                </dd>
              </div>
            ))}
          </dl>
        </section>

        <Block heading="What is stored">
          <p>
            Only the check ids, their pass or fail status and the points, so you can see your score
            change over time. Neither your resume text nor the job description you paste is ever
            stored with a score.
          </p>
        </Block>
      </Prose>
    </PublicLayout>
  )
}
