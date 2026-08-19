import { useState } from 'react'
import { useTheme } from '@/context/ThemeContext'
import { useToast } from '@/context/ToastContext'
import { Button } from '@/components/ui/Button'
import { Card, EmptyState, Rule, Skeleton, StatusLabel } from '@/components/ui/Card'
import { Field } from '@/components/ui/Field'
import { Icon, SectionMark } from '@/components/ui/Icon'
import { Input, Textarea } from '@/components/ui/Input'
import { Modal } from '@/components/ui/Modal'
import { TBody, TD, TH, THead, TR, Table } from '@/components/ui/Table'
import type { Theme } from '@r4u/shared'

/*
  Swatch classes are written out in full. Tailwind scans source text statically, so an
  interpolated `bg-${token}` is never generated and the swatch would render transparent.
*/
const RAMP = [
  { token: 'ink-00', swatch: 'bg-ink-00', role: 'paper, resume surface', ratio: '1.00' },
  { token: 'ink-01', swatch: 'bg-ink-01', role: 'app background', ratio: '1.04' },
  { token: 'ink-02', swatch: 'bg-ink-02', role: 'row hover, card ground', ratio: '1.09' },
  { token: 'ink-03', swatch: 'bg-ink-03', role: 'ui element, skeleton', ratio: '1.16' },
  { token: 'ink-04', swatch: 'bg-ink-04', role: 'hairline rules', ratio: '1.25' },
  { token: 'ink-05', swatch: 'bg-ink-05', role: 'component edges', ratio: '1.41' },
  { token: 'ink-06', swatch: 'bg-ink-06', role: 'subtle borders', ratio: '1.83' },
  { token: 'ink-07', swatch: 'bg-ink-07', role: 'focus ring, disabled', ratio: '2.63' },
  { token: 'ink-08', swatch: 'bg-ink-08', role: 'hovered border', ratio: '3.87' },
  { token: 'ink-09', swatch: 'bg-ink-09', role: 'secondary text floor', ratio: '6.42' },
  { token: 'ink-10', swatch: 'bg-ink-10', role: 'tertiary emphasis', ratio: '9.79' },
  { token: 'ink-11', swatch: 'bg-ink-11', role: 'body text', ratio: '14.40' },
  { token: 'ink-12', swatch: 'bg-ink-12', role: 'headings', ratio: '18.52' },
] as const

const TONES = [
  { name: 'success', swatch: 'bg-success' },
  { name: 'warning', swatch: 'bg-warning' },
  { name: 'danger', swatch: 'bg-danger' },
  { name: 'info', swatch: 'bg-info' },
] as const

const THEMES: Theme[] = ['light', 'dark', 'system']

function Section({
  mark,
  title,
  children,
}: {
  mark: string
  title: string
  children: React.ReactNode
}) {
  return (
    <section className="flex flex-col gap-5 py-10">
      <div className="flex items-baseline gap-2.5">
        <SectionMark>{mark}</SectionMark>
        <h2 className="text-xl">{title}</h2>
      </div>
      {children}
    </section>
  )
}

export function DesignSpecimen() {
  const { theme, resolved, setTheme } = useTheme()
  const { toast } = useToast()
  const [modalOpen, setModalOpen] = useState(false)
  const [headline, setHeadline] = useState('Backend engineer, distributed systems')

  return (
    <div className="min-h-dvh bg-ink-01">
      <header className="sticky top-0 z-10 border-b border-ink-04 bg-ink-01/95 backdrop-blur-sm">
        <div className="flex h-14 items-center justify-between px-6 lg:px-10">
          <div className="flex items-baseline gap-3">
            <span className="font-display text-lg tracking-tight text-ink-12">R4U</span>
            <span className="text-xs text-ink-09">Design system specimen</span>
          </div>

          <div className="flex items-center gap-1" role="group" aria-label="Theme">
            {THEMES.map((t) => (
              <Button
                key={t}
                size="sm"
                variant={theme === t ? 'secondary' : 'ghost'}
                aria-pressed={theme === t}
                onClick={() => setTheme(t)}
              >
                {t}
              </Button>
            ))}
          </div>
        </div>
      </header>

      <main className="px-6 pb-24 lg:px-10">
        <div className="divide-y divide-ink-04">
          <Section mark="in" title="Ink ramp">
            <p className="text-sm text-ink-09">
              Thirteen steps, hue 75, chroma ascending into the darks. Currently painting{' '}
              <span className="text-ink-12">{resolved}</span>. Contrast ratios are measured against
              the light-mode ground. ink-07 and ink-08 fail AA for body text, so ink-09 is the
              floor.
            </p>

            <div className="grid grid-cols-1 gap-px overflow-hidden rounded-sm border border-ink-05 bg-ink-04 sm:grid-cols-2 lg:grid-cols-3">
              {RAMP.map((step) => (
                <div key={step.token} className="flex items-center gap-3 bg-ink-00 px-3 py-2.5">
                  <span
                    className={`size-8 shrink-0 rounded-xs border border-ink-05 ${step.swatch}`}
                    aria-hidden
                  />
                  <span className="flex-1 font-mono text-2xs text-ink-11">{step.token}</span>
                  <span className="flex-1 text-xs text-ink-09">{step.role}</span>
                  <span className="font-mono text-2xs text-ink-07 tabular-nums">{step.ratio}</span>
                </div>
              ))}
            </div>
          </Section>

          <Section mark="ac" title="Accent and semantics">
            <p className="text-sm text-ink-09">
              One accent, print vermillion at hue 32. Danger sits at hue 25, seven degrees away, so
              brand and danger are one hue family. That is why the monochrome rule survives instead
              of being maintained by an exception list.
            </p>

            <div className="flex flex-wrap items-center gap-3">
              <span className="flex items-center gap-2 rounded-xs border border-ink-05 px-3 py-2">
                <span className="size-4 rounded-xs bg-accent" aria-hidden />
                <span className="font-mono text-2xs text-ink-11">accent</span>
              </span>
              {TONES.map((tone) => (
                <span
                  key={tone.name}
                  className="flex items-center gap-2 rounded-xs border border-ink-05 px-3 py-2"
                >
                  <span className={`size-4 rounded-xs ${tone.swatch}`} aria-hidden />
                  <span className="font-mono text-2xs text-ink-11">{tone.name}</span>
                </span>
              ))}
            </div>
          </Section>

          <Section mark="ty" title="Type">
            <p className="text-sm text-ink-09">
              Newsreader for display with the optical-size axis bound to rendered size, Public Sans
              for interface, Geist Mono for figures. Two ratios: 1.2 in the tool, 1.333 on
              marketing.
            </p>

            <div className="flex flex-col gap-4">
              <p className="font-display text-[38px] leading-tight text-ink-12">
                Build a resume a machine can actually read
              </p>
              <Rule />
              <div className="flex flex-col gap-2">
                <p className="text-md text-ink-12">Interface text at 16px, Public Sans</p>
                <p className="text-base text-ink-11">Body text at 14px, the working default</p>
                <p className="text-sm text-ink-09">Secondary text at 13px, ink-09</p>
                <p className="font-mono text-xs text-ink-09 tabular-nums">
                  1,024 resumes · 248 users · 12 templates · 07 live
                </p>
              </div>
            </div>
          </Section>

          <Section mark="co" title="Controls">
            <div className="flex flex-wrap items-center gap-3">
              <Button variant="primary">Export as A4 PDF</Button>
              <Button variant="secondary">Copy share link</Button>
              <Button variant="ghost">Cancel</Button>
              <Button variant="danger">Delete resume</Button>
              <Button variant="secondary" loading>
                Saving
              </Button>
              <Button variant="secondary" disabled>
                Disabled
              </Button>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {(
                [
                  'plus',
                  'close',
                  'check',
                  'chevron',
                  'arrow',
                  'search',
                  'grip',
                  'eye',
                  'eyeOff',
                  'trash',
                  'download',
                  'link',
                ] as const
              ).map((name) => (
                <span
                  key={name}
                  className="flex size-9 items-center justify-center rounded-xs border border-ink-05 text-ink-09"
                  title={name}
                >
                  <Icon name={name} />
                </span>
              ))}
            </div>
          </Section>

          <Section mark="fo" title="Fields">
            <div className="grid gap-6 md:max-w-xl">
              <Field label="Professional headline" value={headline} max={80} required>
                {({ id, describedBy, invalid }) => (
                  <Input
                    id={id}
                    aria-describedby={describedBy}
                    invalid={invalid}
                    value={headline}
                    onChange={(e) => setHeadline(e.target.value)}
                  />
                )}
              </Field>

              <Field
                label="Email address"
                error="Enter an email address in the form name@example.com"
              >
                {({ id, describedBy, invalid }) => (
                  <Input
                    id={id}
                    aria-describedby={describedBy}
                    invalid={invalid}
                    defaultValue="adarsh@"
                  />
                )}
              </Field>

              <Field
                label="Profile summary"
                hint="Three to five sentences. Aim for around 57 words."
                value=""
                max={600}
              >
                {({ id, describedBy }) => (
                  <Textarea
                    id={id}
                    aria-describedby={describedBy}
                    placeholder="Start with what you do and the result you are known for."
                  />
                )}
              </Field>
            </div>
          </Section>

          <Section mark="su" title="Surfaces">
            <div className="grid gap-4 lg:grid-cols-[2fr_1fr]">
              <Card interactive className="p-6">
                <div className="flex flex-col gap-1">
                  <h3 className="text-md text-ink-12">Backend Developer CV</h3>
                  <p className="text-sm text-ink-09">Foundry, single column, ATS safe</p>
                </div>
                <Rule className="my-4" />
                <div className="flex items-center gap-4 font-mono text-2xs text-ink-07 tabular-nums">
                  <span>Updated 12 Aug 2026</span>
                  <span>2 pages</span>
                  <span>ATS 92</span>
                </div>
              </Card>

              <Card className="p-6">
                <EmptyState
                  title="No reviews yet"
                  description="Ask a mentor to look at a resume. They can comment but cannot edit it."
                  action={<Button size="sm">Request a review</Button>}
                />
              </Card>
            </div>

            <div className="flex flex-col gap-2">
              <Skeleton className="h-4 w-64" />
              <Skeleton className="h-4 w-40" />
            </div>
          </Section>

          <Section mark="ta" title="Table">
            <Card className="overflow-hidden">
              <Table>
                <THead>
                  <TR className="hover:bg-transparent">
                    <TH>Name</TH>
                    <TH>Email</TH>
                    <TH>Role</TH>
                    <TH numeric>Resumes</TH>
                    <TH>Status</TH>
                  </TR>
                </THead>
                <TBody>
                  {[
                    ['Aman Sharma', 'aman@example.com', 'User', 4, true],
                    ['Neha Verma', 'neha@example.com', 'Reviewer', 2, true],
                    ['Rahul Nair', 'rahul@example.com', 'User', 1, false],
                    ['Divya Rao', 'divya@example.com', 'User', 6, true],
                  ].map(([name, email, role, count, active]) => (
                    <TR key={name as string}>
                      <TD>{name as string}</TD>
                      <TD className="text-ink-09">{email as string}</TD>
                      <TD className="text-ink-09">{role as string}</TD>
                      <TD numeric>{count as number}</TD>
                      <TD>
                        <StatusLabel on={active as boolean}>
                          {active ? 'Active' : 'Blocked'}
                        </StatusLabel>
                      </TD>
                    </TR>
                  ))}
                </TBody>
              </Table>
            </Card>
            <p className="text-xs text-ink-09">Resume content is not visible to administrators.</p>
          </Section>

          <Section mark="fe" title="Feedback">
            <div className="flex flex-wrap gap-3">
              <Button
                size="sm"
                onClick={() => toast('success', 'Share link copied to the clipboard')}
              >
                Success toast
              </Button>
              <Button size="sm" onClick={() => toast('warning', 'Content exceeds page 1 by 34 mm')}>
                Warning toast
              </Button>
              <Button size="sm" onClick={() => toast('danger', 'Could not reach the server')}>
                Danger toast
              </Button>
              <Button size="sm" onClick={() => setModalOpen(true)}>
                Open modal
              </Button>
            </div>
          </Section>
        </div>
      </main>

      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title="Delete this resume?"
        description="This removes the resume, its share link and its review history. It cannot be undone."
        footer={
          <>
            <Button variant="ghost" onClick={() => setModalOpen(false)}>
              Keep it
            </Button>
            <Button
              variant="danger"
              onClick={() => {
                setModalOpen(false)
                toast('success', 'Resume deleted')
              }}
            >
              Delete resume
            </Button>
          </>
        }
      />
    </div>
  )
}
