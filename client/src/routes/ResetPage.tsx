import { useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { checkPassword } from '@r4u/shared'
import { apiPost, toApiFailure } from '@/lib/api'
import type { ApiFailure } from '@/lib/api'
import { PasswordRequirements } from '@/components/auth/PasswordRequirements'
import { Banner } from '@/components/ui/Banner'
import { Button } from '@/components/ui/Button'
import { Field } from '@/components/ui/Field'
import { Input } from '@/components/ui/Input'
import { PasswordInput } from '@/components/ui/PasswordInput'
import { AuthLayout } from './AuthLayout'

function RequestLink() {
  const [email, setEmail] = useState('')
  const [sent, setSent] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<ApiFailure | null>(null)

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault()
    setSubmitting(true)
    setError(null)

    try {
      await apiPost('/auth/forgot-password', { email })
      setSent(true)
    } catch (caught) {
      setError(toApiFailure(caught))
    } finally {
      setSubmitting(false)
    }
  }

  /*
    The confirmation is deliberately vague about whether the address exists, matching the
    server's identical-response behaviour. Saying "we could not find that account" here would
    undo the enumeration defence on the endpoint.
  */
  if (sent) {
    return (
      <div className="flex flex-col gap-4">
        <Banner tone="success">If an account exists, we have sent a link.</Banner>
        <p className="text-sm text-ink-09">
          The link is valid for 15 minutes and can be used once. Check your spam folder before
          requesting another.
        </p>
      </div>
    )
  }

  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-col gap-5">
      {error ? <Banner>{error.message}</Banner> : null}

      <Field label="Email address">
        {({ id }) => (
          <Input
            id={id}
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        )}
      </Field>

      <div>
        <Button type="submit" variant="primary" loading={submitting} className="w-full">
          Send reset link
        </Button>
      </div>
    </form>
  )
}

function SetNewPassword({ token }: { token: string }) {
  const navigate = useNavigate()
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<ApiFailure | null>(null)

  const ready = Object.values(checkPassword(password)).every(Boolean)
  const mismatch = confirm.length > 0 && confirm !== password

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault()
    if (!ready || mismatch) return

    setSubmitting(true)
    setError(null)

    try {
      await apiPost('/auth/reset-password', { token, password })
      navigate('/login', { replace: true })
    } catch (caught) {
      setError(toApiFailure(caught))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-col gap-5">
      {error ? <Banner>{error.message}</Banner> : null}

      <div className="flex flex-col gap-3">
        <Field label="New password">
          {({ id }) => (
            <PasswordInput
              id={id}
              autoComplete="new-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          )}
        </Field>

        <PasswordRequirements value={password} />
      </div>

      <Field label="Confirm password" error={mismatch ? 'Both passwords must match' : undefined}>
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

      <p className="text-sm text-ink-09">
        Changing your password signs you out everywhere, on every device.
      </p>

      <div>
        <Button
          type="submit"
          variant="primary"
          loading={submitting}
          disabled={!ready || mismatch}
          className="w-full"
        >
          Update password
        </Button>
      </div>
    </form>
  )
}

export function ResetPage() {
  const [params] = useSearchParams()
  const token = params.get('token')

  return (
    <AuthLayout
      title={token ? 'Choose a new password' : 'Reset your password'}
      intro={
        token
          ? 'This link works once and expires 15 minutes after it was sent.'
          : 'Enter the address on your account and we will send a link.'
      }
      footer={
        <Link to="/login" className="font-medium text-accent-text">
          Back to sign in
        </Link>
      }
    >
      {token ? <SetNewPassword token={token} /> : <RequestLink />}
    </AuthLayout>
  )
}
