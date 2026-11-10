import { useCallback, useEffect, useState } from 'react'
import { ACCENT_CHOICES, SAMPLE_RESUME, TEMPLATE_LIST } from '@r4u/shared'
import type { ResumeDesign, TemplateMeta } from '@r4u/shared'
import { useToast } from '@/context/ToastContext'
import { apiGet, apiPatch, apiPost, toApiFailure } from '@/lib/api'
import type { ApiFailure } from '@/lib/api'
import { Banner } from '@/components/ui/Banner'
import { Button } from '@/components/ui/Button'
import { Card, StatusLabel } from '@/components/ui/Card'
import { Field } from '@/components/ui/Field'
import { Icon } from '@/components/ui/Icon'
import { Input, Textarea } from '@/components/ui/Input'
import { Modal } from '@/components/ui/Modal'
import { Segmented } from '@/components/ui/Segmented'
import { Sheet } from '../landing/Sheet'
import { AdminHeader } from './AdminHeader'

const ATS_TEXT = { safe: 'ATS safe', caution: 'Check before ATS', unsafe: 'Best read by people' }

// previews always render the sample fixture, never a user's resume
function previewOf(template: Pick<TemplateMeta, 'baseKey' | 'defaults'>) {
  return {
    ...SAMPLE_RESUME,
    templateKey: template.baseKey,
    design: { ...SAMPLE_RESUME.design, ...template.defaults },
  }
}

interface Draft {
  key: string
  baseKey: string
  name: string
  category: string
  description: string
  order: number
  defaults: Partial<ResumeDesign>
}

const EMPTY: Draft = {
  key: '',
  baseKey: 'foundry',
  name: '',
  category: 'Standard',
  description: '',
  order: 99,
  defaults: {},
}

function errorFor(failure: ApiFailure | null, path: string) {
  return failure?.details?.find((detail) => detail.path === path)?.message
}

function TemplateForm({
  draft,
  setDraft,
  creating,
  failure,
  builtIn,
}: {
  draft: Draft
  setDraft: (draft: Draft) => void
  creating: boolean
  failure: ApiFailure | null
  builtIn: boolean
}) {
  const set = (patch: Partial<Draft>) => setDraft({ ...draft, ...patch })
  const setDesign = (patch: Partial<ResumeDesign>) =>
    set({ defaults: { ...draft.defaults, ...patch } })

  return (
    <div className="grid grid-cols-1 gap-5 md:grid-cols-[1fr_220px]">
      <div className="flex flex-col gap-4">
        {creating ? (
          <Field
            label="Key"
            hint="Lowercase, numbers and hyphens. Fixed once created."
            error={errorFor(failure, 'key')}
          >
            {({ id, describedBy, invalid }) => (
              <Input
                id={id}
                aria-describedby={describedBy}
                invalid={invalid}
                value={draft.key}
                onChange={(e) => set({ key: e.target.value })}
              />
            )}
          </Field>
        ) : null}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Name" error={errorFor(failure, 'name')}>
            {({ id, invalid }) => (
              <Input
                id={id}
                invalid={invalid}
                value={draft.name}
                onChange={(e) => set({ name: e.target.value })}
              />
            )}
          </Field>
          <Field label="Category" error={errorFor(failure, 'category')}>
            {({ id, invalid }) => (
              <Input
                id={id}
                invalid={invalid}
                value={draft.category}
                onChange={(e) => set({ category: e.target.value })}
              />
            )}
          </Field>
        </div>
        <Field label="Who it is for" value={draft.description} max={200}>
          {({ id }) => (
            <Textarea
              id={id}
              rows={2}
              value={draft.description}
              onChange={(e) => set({ description: e.target.value })}
            />
          )}
        </Field>
        <Field
          label="Base layout"
          hint={
            builtIn
              ? 'A built-in entry always uses its own layout.'
              : 'Layouts ship as reviewed code (ADR-005).'
          }
        >
          {({ id, describedBy }) => (
            <select
              id={id}
              aria-describedby={describedBy}
              disabled={builtIn}
              value={draft.baseKey}
              onChange={(e) => set({ baseKey: e.target.value })}
              className="h-10 rounded-xs border border-ink-05 bg-ink-00 px-3 text-sm text-ink-12 disabled:opacity-60"
            >
              {TEMPLATE_LIST.map((t) => (
                <option key={t.key} value={t.key}>
                  {t.name}
                </option>
              ))}
            </select>
          )}
        </Field>
        <div className="flex flex-col gap-2">
          <span className="text-sm font-medium text-ink-11">Accent</span>
          <Segmented
            label="Accent"
            size="sm"
            value={draft.defaults.accent ?? ''}
            onChange={(accent) => setDesign({ accent })}
            options={ACCENT_CHOICES.map((choice) => ({ value: choice.key, label: choice.name }))}
          />
        </div>
        <div className="flex flex-col gap-2">
          <span className="text-sm font-medium text-ink-11">Section spacing</span>
          <Segmented
            label="Section spacing"
            size="sm"
            value={draft.defaults.sectionSpacing ?? 'normal'}
            onChange={(sectionSpacing) => setDesign({ sectionSpacing })}
            options={[
              { value: 'compact', label: 'Compact' },
              { value: 'normal', label: 'Normal' },
              { value: 'airy', label: 'Airy' },
            ]}
          />
        </div>
      </div>
      <div className="hidden md:block">
        <p className="mb-2 text-xs font-medium text-ink-09">Preview</p>
        <Sheet resume={previewOf(draft)} />
      </div>
    </div>
  )
}

export function AdminTemplatesPage() {
  const { toast } = useToast()
  const [templates, setTemplates] = useState<TemplateMeta[]>([])
  const [error, setError] = useState<string | null>(null)
  const [editing, setEditing] = useState<TemplateMeta | null>(null)
  const [creating, setCreating] = useState(false)
  const [draft, setDraft] = useState<Draft>(EMPTY)
  const [failure, setFailure] = useState<ApiFailure | null>(null)
  const [busy, setBusy] = useState(false)

  const load = useCallback(() => {
    apiGet<{ templates: TemplateMeta[] }>('/admin/templates')
      .then(({ templates: list }) => setTemplates(list))
      .catch((caught) => setError(toApiFailure(caught).message))
  }, [])

  useEffect(() => load(), [load])

  function openEdit(template: TemplateMeta) {
    setFailure(null)
    setEditing(template)
    setDraft({
      key: template.key,
      baseKey: template.baseKey,
      name: template.name,
      category: template.category,
      description: template.description,
      order: template.order,
      defaults: template.defaults,
    })
  }

  function openCreate() {
    setFailure(null)
    setDraft(EMPTY)
    setCreating(true)
  }

  async function toggle(template: TemplateMeta) {
    try {
      await apiPatch(`/admin/templates/${template.id}`, { active: !template.active })
      toast(
        'success',
        template.active
          ? `${template.name} is hidden from new resumes`
          : `${template.name} is offered again`
      )
      load()
    } catch (caught) {
      toast('danger', toApiFailure(caught).message)
    }
  }

  async function save() {
    setBusy(true)
    setFailure(null)
    const { key, ...rest } = draft
    try {
      if (creating) await apiPost('/admin/templates', { key, ...rest })
      else if (editing)
        await apiPatch(
          `/admin/templates/${editing.id}`,
          editing.builtIn ? { ...rest, baseKey: undefined } : rest
        )
      toast('success', creating ? 'Template added to the gallery' : 'Template saved')
      setCreating(false)
      setEditing(null)
      load()
    } catch (caught) {
      setFailure(toApiFailure(caught))
    } finally {
      setBusy(false)
    }
  }

  const open = creating || Boolean(editing)

  return (
    <div className="mx-auto max-w-7xl">
      <AdminHeader
        title="Templates"
        intro="What the gallery offers, in what order. Layouts are code; here you control metadata and presets."
        action={
          <Button variant="primary" onClick={openCreate}>
            <Icon name="plus" />
            Add a preset
          </Button>
        }
      />

      {error ? <Banner className="mt-6">{error}</Banner> : null}

      <ul className="mt-8 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
        {templates.map((template) => (
          <li key={template.id}>
            <Card className="flex h-full flex-col overflow-hidden">
              <div className="h-48 overflow-hidden border-b border-ink-04 bg-ink-02 px-6 pt-5">
                <Sheet resume={previewOf(template)} />
              </div>
              <div className="flex flex-1 flex-col p-4">
                <div className="flex items-baseline justify-between gap-2">
                  <h2 className="text-md">{template.name}</h2>
                  <span className="text-xs text-ink-09">
                    {template.builtIn ? 'Built in' : 'Preset'}
                  </span>
                </div>
                <p className="mt-1 text-xs text-ink-09">
                  {template.category} · {ATS_TEXT[template.atsSafe]} · order {template.order}
                </p>
                <p className="mt-2 flex-1 text-sm text-ink-10">{template.description}</p>
                <div className="mt-4 flex items-center gap-2 border-t border-ink-04 pt-3">
                  <StatusLabel on={template.active}>
                    {template.active ? 'Active' : 'Inactive'}
                  </StatusLabel>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="ml-auto"
                    onClick={() => openEdit(template)}
                  >
                    Edit
                  </Button>
                  <Button size="sm" variant="secondary" onClick={() => void toggle(template)}>
                    {template.active ? 'Deactivate' : 'Activate'}
                  </Button>
                </div>
              </div>
            </Card>
          </li>
        ))}
      </ul>

      <Modal
        open={open}
        size="lg"
        onClose={() => {
          setCreating(false)
          setEditing(null)
        }}
        title={creating ? 'Add a preset' : `Edit ${editing?.name ?? ''}`}
        description="Metadata and design defaults only. There is no field that could hold markup."
        footer={
          <>
            <Button
              variant="ghost"
              onClick={() => {
                setCreating(false)
                setEditing(null)
              }}
            >
              Cancel
            </Button>
            <Button variant="primary" loading={busy} onClick={() => void save()}>
              {creating ? 'Add template' : 'Save'}
            </Button>
          </>
        }
      >
        {failure && !failure.details ? <Banner className="mb-4">{failure.message}</Banner> : null}
        {open ? (
          <TemplateForm
            draft={draft}
            setDraft={setDraft}
            creating={creating}
            failure={failure}
            builtIn={Boolean(editing?.builtIn)}
          />
        ) : null}
      </Modal>
    </div>
  )
}
