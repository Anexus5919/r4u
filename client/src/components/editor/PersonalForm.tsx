import { MAX_LINKS, PERSONAL_FIELDS } from '@r4u/shared'
import type { ResumePersonal } from '@r4u/shared'
import { Button } from '@/components/ui/Button'
import { Icon } from '@/components/ui/Icon'
import { Input } from '@/components/ui/Input'
import { Label } from '@/components/ui/Field'
import { FieldControl } from './fields'

// the contact block, not a section: no template can hide it, so it sits outside sections
export function PersonalForm({
  personal,
  onChange,
}: {
  personal: ResumePersonal
  onChange: (field: string, value: unknown) => void
}) {
  const links = personal.links ?? []

  function setLink(index: number, patch: { label?: string; url?: string }) {
    onChange(
      'links',
      links.map((link, i) => (i === index ? { ...link, ...patch } : link))
    )
  }

  return (
    <div className="flex flex-col gap-8">
      <div className="grid gap-x-4 gap-y-5 sm:grid-cols-2">
        {PERSONAL_FIELDS.map((spec) => (
          <div key={spec.key} className={spec.key === 'headline' ? 'sm:col-span-2' : ''}>
            <FieldControl
              spec={spec}
              value={personal[spec.key as keyof ResumePersonal]}
              onChange={(value) => onChange(spec.key, value)}
            />
          </div>
        ))}
      </div>

      <div className="flex flex-col gap-3 border-t border-ink-04 pt-6">
        <div className="flex items-baseline justify-between">
          <Label>Links</Label>
          <span className="font-mono text-2xs text-ink-07 tabular-nums">
            {links.length}/{MAX_LINKS}
          </span>
        </div>
        <p className="-mt-1 text-xs text-ink-09">
          Write the address as text, not as a word linked to a URL. Parsers read the text.
        </p>

        <ul className="flex flex-col gap-2">
          {links.map((link, index) => (
            <li key={index} className="flex items-center gap-2">
              <Input
                value={link.label}
                maxLength={30}
                aria-label={`Link ${index + 1} label`}
                placeholder="GitHub"
                className="w-32 shrink-0"
                onChange={(e) => setLink(index, { label: e.target.value })}
              />
              <Input
                value={link.url}
                maxLength={200}
                aria-label={`Link ${index + 1} address`}
                placeholder="github.com/alexmercer"
                onChange={(e) => setLink(index, { url: e.target.value })}
              />
              <button
                type="button"
                aria-label={`Remove link ${index + 1}`}
                onClick={() =>
                  onChange(
                    'links',
                    links.filter((_, i) => i !== index)
                  )
                }
                className="t-xs text-ink-07 transition-colors hover:text-danger"
              >
                <Icon name="close" />
              </button>
            </li>
          ))}
        </ul>

        <Button
          size="sm"
          className="self-start"
          disabled={links.length >= MAX_LINKS}
          onClick={() => onChange('links', [...links, { label: '', url: '' }])}
        >
          <Icon name="plus" />
          Add a link
        </Button>
      </div>
    </div>
  )
}
