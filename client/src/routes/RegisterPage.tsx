import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { checkPassword } from '@r4u/shared'
import { useAuth } from '@/context/AuthContext'
import { PasswordRequirements } from '@/components/auth/PasswordRequirements'
import { Banner } from '@/components/ui/Banner'
import { Button } from '@/components/ui/Button'
import { Field } from '@/components/ui/Field'
import { Input } from '@/components/ui/Input'
import { PasswordInput } from '@/components/ui/PasswordInput'
import { AuthLayout } from './AuthLayout'

export function RegisterPage() {
  const { register, error, clearError } = useAuth()
  const navigate = useNavigate()

  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const checks = checkPassword(password)
  const passwordReady = Object.values(checks).every(Boolean)
  const mismatch = confirm.length > 0 && confirm !== password

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault()
    if (!passwordReady || mismatch) return

    clearError()
    setSubmitting(true)

    try {
      const user = await register(name, email, password)
      navigate(user.role === 'admin' ? '/admin' : '/dashboard', { replace: true })
    } catch {
      // surfaced through the auth context
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <AuthLayout
      title="Create an account"
      intro="Free, with no paywall at download. Every template and every export, from the first day."
      footer={
        <>
          Already have an account?{' '}
          <Link to="/login" className="font-medium text-accent-text">
            Sign in
          </Link>
        </>
      }
    >
      <form onSubmit={onSubmit} noValidate className="flex flex-col gap-5">
        {error ? <Banner>{error.message}</Banner> : null}

        <Field label="Full name" value={name} max={80}>
          {({ id }) => (
            <Input
              id={id}
              autoComplete="name"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          )}
        </Field>

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

        <div className="flex flex-col gap-3">
          <Field label="Password">
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

        <div>
          <Button
            type="submit"
            variant="primary"
            className="w-full"
            loading={submitting}
            disabled={!passwordReady || mismatch}
          >
            Create account
          </Button>
        </div>
      </form>
    </AuthLayout>
  )
}
