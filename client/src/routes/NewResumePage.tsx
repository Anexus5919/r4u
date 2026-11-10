import { useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { PAGE_TARGET, RESUME_TYPES } from '@r4u/shared'
import type { ResumeType } from '@r4u/shared'
import { api, toApiFailure } from '@/lib/api'
import { TemplateGrid } from '@/components/resume/TemplateGrid'
import { useTemplates } from '@/hooks/useTemplates'
import { Banner } from '@/components/ui/Banner'
import { Button, ButtonLink } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Field } from '@/components/ui/Field'
import { Icon } from '@/components/ui/Icon'
import { Input } from '@/components/ui/Input'
import { Segmented } from '@/components/ui/Segmented'

const TYPE_LABEL: Record<ResumeType, string> = {
  fresher: 'Fresher',
  professional: 'Professional',
  technical: 'Technical',
  academic: 'Academic CV',
}

// career stage drives section order and length, so it is chosen here, before any typing
export function NewResumePage() {
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const templates = useTemplates()
  const [templateKey, setTemplateKey] = useState(params.get('template') ?? 'foundry')
  const [title, setTitle] = useState('')
  const [resumeType, setResumeType] = useState<ResumeType>('professional')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const chosen = templates?.find((template) => template.key === templateKey)

  async function create() {
    if (!title.trim()) {
      setError('Give the resume a title, for example the role you are applying for.')
      return
    }
    setBusy(true)
    setError(null)
    try {
      const res = await api.post('/resumes', { title: title.trim(), resumeType, templateKey })
      navigate(`/resume/${res.data.data.resume.id}/edit`)
    } catch (caught) {
      setError(toApiFailure(caught).message)
      setBusy(false)
    }
  }

  return (
    <div className="mx-auto max-w-7xl">
      <ButtonLink to="/dashboard" variant="ghost" size="sm" className="-ml-3">
        <Icon name="arrow" className="rotate-180" />
        My resumes
      </ButtonLink>
      <h1 className="mt-2 text-xl text-ink-12">New resume</h1>
      <p className="mt-1.5 text-sm text-ink-09">
        Name it, pick your career stage and a starting template. All three can change later.
      </p>

      <Card className="mt-8 p-6">
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_auto] lg:items-end">
          <Field label="Title" value={title} max={80} required>
            {({ id }) => (
              <Input
                id={id}
                placeholder="Backend Developer CV"
                value={title}
                maxLength={80}
                onChange={(event) => setTitle(event.target.value)}
              />
            )}
          </Field>
          <div className="flex flex-col gap-1.5">
            <span className="text-sm font-medium text-ink-11">Career stage</span>
            <Segmented
              label="Career stage"
              value={resumeType}
              onChange={setResumeType}
              options={RESUME_TYPES.map((type) => ({ value: type, label: TYPE_LABEL[type] }))}
            />
          </div>
        </div>
        <p className="mt-3 text-xs text-ink-09">
          Target length for this stage: {PAGE_TARGET[resumeType]}.
        </p>

        {error ? <Banner className="mt-4">{error}</Banner> : null}

        <div className="mt-5 flex flex-wrap items-center gap-3 border-t border-ink-04 pt-5">
          <Button variant="primary" size="lg" loading={busy} onClick={() => void create()}>
            Create with {chosen?.name ?? 'this template'}
            <Icon name="arrow" />
          </Button>
          <span className="text-sm text-ink-09">Opens the editor straight away.</span>
        </div>
      </Card>

      <h2 className="mt-12 text-lg text-ink-12">Choose a template</h2>
      <div className="mt-4">
        <TemplateGrid
          templates={templates}
          selected={templateKey}
          actionLabel="Choose"
          onSelect={(template) => setTemplateKey(template.key)}
        />
      </div>
    </div>
  )
}
