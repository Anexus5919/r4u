import { useNavigate } from 'react-router-dom'
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
