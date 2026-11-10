import { useCallback, useEffect, useState } from 'react'
import type { ShareAnalytics, ShareLinkCreated, ShareLinkItem, ShareRedaction } from '@r4u/shared'
import { useSocketEvent } from '@/context/SocketContext'
import { useToast } from '@/context/ToastContext'
import { apiDelete, apiGet, apiPatch, apiPost, toApiFailure } from '@/lib/api'
import { formatDate, formatRelative } from '@/lib/format'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Icon } from '@/components/ui/Icon'
import { Input } from '@/components/ui/Input'
import { Modal } from '@/components/ui/Modal'

const REDACTIONS: { key: keyof ShareRedaction; label: string }[] = [
  { key: 'email', label: 'Hide email' },
  { key: 'phone', label: 'Hide phone' },
  { key: 'address', label: 'Hide location' },
]

function Toggle({
  checked,
  label,
  onChange,
}: {
  checked: boolean
  label: string
  onChange: (checked: boolean) => void
}) {
  return (
    <label className="flex cursor-pointer items-center gap-2 text-sm text-ink-10">
      <input
        type="checkbox"
        className="size-4 accent-accent"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
      />
      {label}
    </label>
  )
}

// a single accent series on a true time axis; no gradient, no animated counter
function Sparkline({ daily }: { daily: ShareAnalytics['daily'] }) {
  const max = Math.max(1, ...daily.map((day) => day.views))
  return (
    <div>
      <svg
        viewBox={`0 0 ${daily.length * 6} 40`}
        className="h-12 w-full"
        role="img"
        aria-label="Views over the last 30 days"
      >
        {daily.map((day, index) => {
          const height = Math.max(1, (day.views / max) * 38)
          return (
            <rect
              key={day.date}
              x={index * 6 + 1}
              y={40 - height}
              width={4}
              height={height}
              className={day.views ? 'fill-accent' : 'fill-ink-04'}
            >
              <title>{`${day.date}: ${day.views} views, ${day.downloads} downloads`}</title>
            </rect>
          )
        })}
      </svg>
      <div className="mt-1 flex justify-between text-2xs text-ink-08">
        <span>30 days ago</span>
        <span>Today</span>
      </div>
    </div>
  )
}

function LinkRow({
  link,
  onChange,
  onDelete,
}: {
  link: ShareLinkItem
  onChange: (link: ShareLinkItem) => void
  onDelete: (link: ShareLinkItem) => void
}) {
  const { toast } = useToast()
  const [open, setOpen] = useState(false)
  const [analytics, setAnalytics] = useState<ShareAnalytics | null>(null)
  const expired = link.expiresAt ? new Date(link.expiresAt).getTime() < Date.now() : false

  async function patch(body: object) {
    try {
      const { link: updated } = await apiPatch<{ link: ShareLinkItem }>(`/share/${link.id}`, body)
      onChange(updated)
    } catch (caught) {
      toast('danger', toApiFailure(caught).message)
    }
  }

  async function expand() {
    setOpen((value) => !value)
    if (!analytics) {
      setAnalytics(await apiGet<ShareAnalytics>(`/share/${link.id}/analytics`).catch(() => null))
    }
  }

  return (
    <li className="border-t border-ink-04 py-4 first:border-t-0 first:pt-0">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="font-mono text-sm text-ink-12">/r/…{link.hint}</p>
          <p className="mt-0.5 text-xs text-ink-09">
            {!link.enabled ? 'Off' : expired ? 'Expired' : 'Live'} · created{' '}
            {formatRelative(link.createdAt)}
            {link.expiresAt ? ` · until ${formatDate(link.expiresAt)}` : ''}
          </p>
        </div>
        <p className="text-sm text-ink-10 tabular-nums">
          <span className="font-semibold text-ink-12">{link.views}</span> views ·{' '}
          <span className="font-semibold text-ink-12">{link.downloads}</span> downloads
        </p>
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        <Button
          size="sm"
          variant="secondary"
          onClick={() => void patch({ enabled: !link.enabled })}
        >
          {link.enabled ? 'Turn off' : 'Turn on'}
        </Button>
        <Button size="sm" variant="ghost" aria-expanded={open} onClick={() => void expand()}>
          Settings and analytics
        </Button>
        <Button
          size="sm"
          variant="ghost"
          className="ml-auto hover:text-danger"
          onClick={() => onDelete(link)}
        >
          <Icon name="trash" />
          Delete
        </Button>
      </div>

      {open ? (
        <div className="mt-4 flex flex-col gap-4 rounded-xs bg-ink-02 p-4">
          {analytics ? <Sparkline daily={analytics.daily} /> : null}
          <div className="flex flex-wrap gap-x-5 gap-y-2">
            {REDACTIONS.map((item) => (
              <Toggle
                key={item.key}
                label={item.label}
                checked={link.redact[item.key]}
                onChange={(checked) => void patch({ redact: { [item.key]: checked } })}
              />
            ))}
          </div>
          <div className="flex flex-wrap items-end gap-2">
            <div className="flex flex-col gap-1">
              <label htmlFor={`expiry-${link.id}`} className="text-sm font-medium text-ink-11">
                Expires
              </label>
              <Input
                id={`expiry-${link.id}`}
                type="date"
                className="w-44"
                min={new Date(Date.now() + 86_400_000).toISOString().slice(0, 10)}
                defaultValue={link.expiresAt?.slice(0, 10) ?? ''}
                onChange={(event) => {
                  const value = event.target.value
                  if (value) void patch({ expiresAt: new Date(`${value}T23:59:59`).toISOString() })
                }}
              />
            </div>
            {link.expiresAt ? (
              <Button size="sm" variant="ghost" onClick={() => void patch({ expiresAt: null })}>
                Never expire
              </Button>
            ) : null}
          </div>
        </div>
      ) : null}
    </li>
  )
}

export function SharePanel({ resumeId }: { resumeId: string }) {
  const { toast } = useToast()
  const [links, setLinks] = useState<ShareLinkItem[]>([])
  const [created, setCreated] = useState<ShareLinkCreated | null>(null)
  const [redact, setRedact] = useState<ShareRedaction>({
    email: false,
    phone: false,
    address: false,
  })
  const [creating, setCreating] = useState(false)
  const [pendingDelete, setPendingDelete] = useState<ShareLinkItem | null>(null)

  const load = useCallback(() => {
    apiGet<{ links: ShareLinkItem[] }>(`/resumes/${resumeId}/share`)
      .then(({ links: next }) => setLinks(next))
      .catch(() => undefined)
  }, [resumeId])

  useEffect(() => load(), [load])

  // a recruiter opening the link moves the counter here without a refresh
  useSocketEvent<{ linkId: string; views: number; downloads: number }>('share:viewed', (event) => {
    setLinks((current) =>
      current.map((link) =>
        link.id === event.linkId
          ? { ...link, views: event.views, downloads: event.downloads }
          : link
      )
    )
  })

  async function create() {
    setCreating(true)
    try {
      const result = await apiPost<ShareLinkCreated>(`/resumes/${resumeId}/share`, { redact })
      setCreated(result)
      setLinks((current) => [result.link, ...current])
    } catch (caught) {
      toast('danger', toApiFailure(caught).message)
    } finally {
      setCreating(false)
    }
  }

  async function copy(url: string) {
    try {
      await navigator.clipboard.writeText(url)
      toast('success', 'Link copied')
    } catch {
      toast('warning', 'Copy failed. Select the link and copy it by hand.')
    }
  }

  async function confirmDelete() {
    if (!pendingDelete) return
    try {
      await apiDelete(`/share/${pendingDelete.id}`)
      setLinks((current) => current.filter((link) => link.id !== pendingDelete.id))
      toast('success', 'Link deleted. Anyone holding it now sees a not found page.')
    } catch (caught) {
      toast('danger', toApiFailure(caught).message)
    } finally {
      setPendingDelete(null)
    }
  }

  return (
    <Card className="p-5">
      <div className="flex items-center gap-2">
        <Icon name="link" className="text-accent-text" />
        <p className="text-sm font-semibold text-ink-12">Share links</p>
      </div>
      <p className="mt-1.5 text-sm text-ink-09">
        A read-only page a recruiter can open without an account. Never indexed by search engines.
      </p>

      {created ? (
        <div className="mt-4 rounded-xs border border-accent-edge bg-accent-subtle p-3">
          <p className="text-xs font-medium text-accent-text">
            Copy it now: for your privacy only a fingerprint of the link is stored.
          </p>
          <div className="mt-2 flex gap-2">
            <Input
              readOnly
              value={created.url}
              aria-label="New share link"
              onFocus={(e) => e.target.select()}
            />
            <Button variant="primary" onClick={() => void copy(created.url)}>
              Copy
            </Button>
          </div>
        </div>
      ) : null}

      <div className="mt-4 flex flex-col gap-3">
        <div className="flex flex-wrap gap-x-5 gap-y-2">
          {REDACTIONS.map((item) => (
            <Toggle
              key={item.key}
              label={item.label}
              checked={redact[item.key]}
              onChange={(checked) => setRedact((current) => ({ ...current, [item.key]: checked }))}
            />
          ))}
        </div>
        <div>
          <Button variant="secondary" loading={creating} onClick={() => void create()}>
            <Icon name="plus" />
            Create a share link
          </Button>
        </div>
      </div>

      {links.length > 0 ? (
        <ul className="mt-5 border-t border-ink-04 pt-4">
          {links.map((link) => (
            <LinkRow
              key={link.id}
              link={link}
              onChange={(updated) =>
                setLinks((current) =>
                  current.map((item) => (item.id === updated.id ? updated : item))
                )
              }
              onDelete={setPendingDelete}
            />
          ))}
        </ul>
      ) : null}

      <Modal
        open={Boolean(pendingDelete)}
        onClose={() => setPendingDelete(null)}
        title="Delete this share link?"
        description="Anyone who has it will see a not found page. Its view counts are deleted with it."
        footer={
          <>
            <Button variant="ghost" onClick={() => setPendingDelete(null)}>
              Keep it
            </Button>
            <Button variant="danger" onClick={() => void confirmDelete()}>
              Delete link
            </Button>
          </>
        }
      />
    </Card>
  )
}
