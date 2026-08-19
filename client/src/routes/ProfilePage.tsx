import { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { THEMES, checkPassword } from '@r4u/shared'
import type { ProfileUser, Theme } from '@r4u/shared'
import { api, apiGet, toApiFailure } from '@/lib/api'
import { useAuth } from '@/context/AuthContext'
import { useTheme } from '@/context/ThemeContext'
import { useToast } from '@/context/ToastContext'
import { PasswordRequirements } from '@/components/auth/PasswordRequirements'
import { Banner } from '@/components/ui/Banner'
import { Button } from '@/components/ui/Button'
import { Card, Skeleton } from '@/components/ui/Card'
import { Field } from '@/components/ui/Field'
import { Icon } from '@/components/ui/Icon'
import { Input } from '@/components/ui/Input'
import { Modal } from '@/components/ui/Modal'
import { PasswordInput } from '@/components/ui/PasswordInput'

function Section({
  title,
  description,
  children,
}: {
  title: string
  description: string
  children: React.ReactNode
}) {
  return (
    <section className="grid gap-6 border-t border-ink-04 py-10 lg:grid-cols-[16rem_1fr] lg:gap-12">
      <div>
        <h2 className="text-md text-ink-12">{title}</h2>
        <p className="mt-1.5 text-sm text-ink-09">{description}</p>
      </div>
      <div className="max-w-md">{children}</div>
    </section>
  )
}

function LoadingProfile() {
  return (
    <div className="flex flex-col gap-4 py-10" aria-busy="true">
      <Skeleton className="h-5 w-48" />
      <Skeleton className="h-9 w-full max-w-md" />
      <Skeleton className="h-9 w-full max-w-md" />
      <Skeleton className="h-9 w-64" />
    </div>
  )
}

export function ProfilePage() {
  const { logout } = useAuth()
  const { setTheme } = useTheme()
  const { toast } = useToast()
  const navigate = useNavigate()

  const [profile, setProfile] = useState<ProfileUser | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)

  useEffect(() => {
    const controller = new AbortController()

    apiGet<{ user: ProfileUser }>('/users/me', controller.signal)
      .then(({ user }) => setProfile(user))
      .catch((error) => {
        if (controller.signal.aborted) return
        setLoadError(toApiFailure(error).message)
      })

    // aborts the request if the user navigates away mid-flight
    return () => controller.abort()
  }, [])

  const onSaved = useCallback((user: ProfileUser) => setProfile(user), [])

  if (loadError) return <Banner className="max-w-md">{loadError}</Banner>
  if (!profile) return <LoadingProfile />

  return (
    <div className="max-w-4xl">
      <h1 className="text-xl text-ink-12">Profile and settings</h1>
      <p className="mt-2 mb-4 text-sm text-ink-09">
        Signed in as {profile.email}. Your email address cannot be changed here.
      </p>

      <Details profile={profile} onSaved={onSaved} />
      <Appearance profile={profile} onSaved={onSaved} setTheme={setTheme} />
      <Avatar profile={profile} onSaved={onSaved} />
      <ChangePassword
        onChanged={async () => {
          toast('success', 'Password updated. Sign in again with your new password.')
          await logout()
          navigate('/login', { replace: true })
        }}
      />
      <DangerZone
        onDeleted={async () => {
          await logout()
          navigate('/', { replace: true })
        }}
      />
    </div>
  )
}

function Details({
  profile,
  onSaved,
}: {
  profile: ProfileUser
  onSaved: (user: ProfileUser) => void
}) {
  const { toast } = useToast()
  const [name, setName] = useState(profile.name)
  const [headline, setHeadline] = useState(profile.headline)
  const [phone, setPhone] = useState(profile.phone)
  const [location, setLocation] = useState(profile.location)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault()
    setSaving(true)
    setError(null)

    try {
      const res = await api.patch('/users/me', { name, headline, phone, location })
      onSaved(res.data.data.user)
      toast('success', 'Profile saved')
    } catch (caught) {
      setError(toApiFailure(caught).message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <Section title="Details" description="How you appear across the application.">
      <form onSubmit={onSubmit} className="flex flex-col gap-5">
        {error ? <Banner>{error}</Banner> : null}

        <Field label="Full name" value={name} max={80}>
          {({ id }) => <Input id={id} value={name} onChange={(e) => setName(e.target.value)} />}
        </Field>

        <Field
          label="Professional headline"
          hint="One line. It appears above your resumes, not inside them."
          value={headline}
          max={80}
        >
          {({ id }) => (
            <Input id={id} value={headline} onChange={(e) => setHeadline(e.target.value)} />
          )}
        </Field>

        <Field label="Contact number" value={phone} max={32}>
          {({ id }) => (
            <Input id={id} type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} />
          )}
        </Field>

        <Field
          label="Location"
          hint="City and state, or city and country."
          value={location}
          max={60}
        >
          {({ id }) => (
            <Input id={id} value={location} onChange={(e) => setLocation(e.target.value)} />
          )}
        </Field>

        <div>
          <Button type="submit" variant="primary" loading={saving}>
            Save details
          </Button>
        </div>
      </form>
    </Section>
  )
}

function Appearance({
  profile,
  onSaved,
  setTheme,
}: {
  profile: ProfileUser
  onSaved: (user: ProfileUser) => void
  setTheme: (theme: Theme) => void
}) {
  const { toast } = useToast()

  /*
    Applied locally first so the change is instant, then persisted. The stored value is what a
    fresh device picks up on first sign in, which is what FR 2.3 means by retaining it.
  */
  async function choose(theme: Theme) {
    setTheme(theme)
    try {
      const res = await api.patch('/users/me', { theme })
      onSaved(res.data.data.user)
    } catch {
      toast('warning', 'Theme applied here, but could not be saved to your account')
    }
  }

  return (
    <Section
      title="Appearance"
      description="System follows your operating system setting and changes with it."
    >
      <div className="flex flex-wrap gap-2" role="group" aria-label="Theme">
        {THEMES.map((option) => (
          <Button
            key={option}
            variant={profile.theme === option ? 'secondary' : 'ghost'}
            aria-pressed={profile.theme === option}
            onClick={() => void choose(option)}
          >
            {option}
          </Button>
        ))}
      </div>
    </Section>
  )
}

// an avatar is the single documented exception to the radius rule, see DESIGN-SYSTEM.md section 6
const AVATAR_SHAPE = 'size-14 shrink-0 rounded-full border border-ink-05' // design-guard-allow

function Avatar({
  profile,
  onSaved,
}: {
  profile: ProfileUser
  onSaved: (user: ProfileUser) => void
}) {
  const { toast } = useToast()
  const input = useRef<HTMLInputElement>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function onPick(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    if (!file) return

    setBusy(true)
    setError(null)

    const form = new FormData()
    form.append('avatar', file)

    try {
      const res = await api.post('/users/me/avatar', form)
      onSaved(res.data.data.user)
      toast('success', 'Photograph updated')
    } catch (caught) {
      setError(toApiFailure(caught).message)
    } finally {
      setBusy(false)
      if (input.current) input.current.value = ''
    }
  }

  return (
    <Section title="Photograph" description="JPEG, PNG or WebP, up to 2 MB. Cropped to a square.">
      <div className="flex flex-col gap-4">
        {error ? <Banner>{error}</Banner> : null}

        <div className="flex items-center gap-4">
          {profile.avatarUrl ? (
            <img src={profile.avatarUrl} alt="" className={`${AVATAR_SHAPE} object-cover`} />
          ) : (
            <div
              className={`${AVATAR_SHAPE} flex items-center justify-center bg-ink-02 text-sm text-ink-09`}
            >
              {profile.name.slice(0, 1).toUpperCase()}
            </div>
          )}

          <Button onClick={() => input.current?.click()} loading={busy}>
            <Icon name="plus" />
            Choose an image
          </Button>
        </div>

        <input
          ref={input}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          onChange={(e) => void onPick(e)}
          className="sr-only"
          tabIndex={-1}
        />
      </div>
    </Section>
  )
}

function ChangePassword({ onChanged }: { onChanged: () => Promise<void> }) {
  const [current, setCurrent] = useState('')
  const [next, setNext] = useState('')
  const [confirm, setConfirm] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const ready = Object.values(checkPassword(next)).every(Boolean)
  const mismatch = confirm.length > 0 && confirm !== next

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault()
    if (!ready || mismatch) return

    setSaving(true)
    setError(null)

    try {
      await api.patch('/users/me/password', { currentPassword: current, password: next })
      await onChanged()
    } catch (caught) {
      setError(toApiFailure(caught).message)
      setSaving(false)
    }
  }

  return (
    <Section
      title="Password"
      description="Changing it signs you out everywhere, on every device, including this one."
    >
      <form onSubmit={onSubmit} className="flex flex-col gap-5">
        {error ? <Banner>{error}</Banner> : null}

        <Field label="Current password">
          {({ id }) => (
            <PasswordInput
              id={id}
              required
              value={current}
              onChange={(e) => setCurrent(e.target.value)}
            />
          )}
        </Field>

        <div className="flex flex-col gap-3">
          <Field label="New password">
            {({ id }) => (
              <PasswordInput
                id={id}
                autoComplete="new-password"
                required
                value={next}
                onChange={(e) => setNext(e.target.value)}
              />
            )}
          </Field>
          <PasswordRequirements value={next} />
        </div>

        <Field
          label="Confirm new password"
          error={mismatch ? 'Both passwords must match' : undefined}
        >
          {({ id, invalid }) => (
            <PasswordInput
              id={id}
              autoComplete="new-password"
              required
              invalid={invalid}
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
            />
          )}
        </Field>

        <div>
          <Button type="submit" variant="primary" loading={saving} disabled={!ready || mismatch}>
            Update password
          </Button>
        </div>
      </form>
    </Section>
  )
}

function DangerZone({ onDeleted }: { onDeleted: () => Promise<void> }) {
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function confirm() {
    setBusy(true)
    setError(null)

    try {
      await api.delete('/users/me')
      await onDeleted()
    } catch (caught) {
      setError(toApiFailure(caught).message)
      setBusy(false)
    }
  }

  return (
    <Section
      title="Delete account"
      description="Removes your account, every resume you own, and every share link pointing at them."
    >
      <div className="flex flex-col gap-4">
        {error ? <Banner>{error}</Banner> : null}

        <Card className="p-5">
          <p className="text-sm text-ink-11">
            This cannot be undone. Export anything you want to keep before continuing.
          </p>
          <div className="mt-4">
            <Button variant="danger" onClick={() => setOpen(true)}>
              Delete my account
            </Button>
          </div>
        </Card>
      </div>

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title="Delete your account?"
        description="Your account, resumes, share links and review history are removed permanently."
        footer={
          <>
            <Button variant="ghost" onClick={() => setOpen(false)}>
              Keep my account
            </Button>
            <Button variant="danger" loading={busy} onClick={() => void confirm()}>
              Delete permanently
            </Button>
          </>
        }
      />
    </Section>
  )
}
