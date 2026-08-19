import { useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '@/context/AuthContext'
import { Banner } from '@/components/ui/Banner'
import { Button } from '@/components/ui/Button'
import { Field } from '@/components/ui/Field'
import { Input } from '@/components/ui/Input'
import { PasswordInput } from '@/components/ui/PasswordInput'
import { AuthLayout } from './AuthLayout'

export function LoginPage() {
  const { login, error, clearError } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [submitting, setSubmitting] = useState(false)

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault()
    clearError()
    setSubmitting(true)

    try {
      const user = await login(email, password)
      const from = (location.state as { from?: string } | null)?.from
      navigate(from ?? (user.role === 'admin' ? '/admin' : '/dashboard'), { replace: true })
    } catch {
      // surfaced through the auth context, and the field values are kept
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <AuthLayout
      title="Sign in"
      intro="Your resumes, templates and reviews are on the other side of this form."
      footer={
        <>
          New here?{' '}
          <Link to="/register" className="text-ink-12">
            Create an account
          </Link>
        </>
      }
    >
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

        <Field label="Password">
          {({ id }) => (
            <PasswordInput
              id={id}
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          )}
        </Field>

        <div className="flex items-center justify-between gap-4">
          <Button type="submit" variant="primary" loading={submitting}>
            Sign in
          </Button>
          <Link to="/reset" className="text-sm text-ink-09">
            Forgot your password?
          </Link>
        </div>
      </form>
    </AuthLayout>
  )
}
