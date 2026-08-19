import { Link, Outlet, useNavigate } from 'react-router-dom'
import type { Theme } from '@r4u/shared'
import { useAuth } from '@/context/AuthContext'
import { useTheme } from '@/context/ThemeContext'
import { Button } from '@/components/ui/Button'

const THEMES: Theme[] = ['light', 'dark', 'system']

/*
  The tool surface. Edge to edge, never centred, split from the content by a single hairline
  rather than by a card on a tinted field.
*/
export function AppShell() {
  const { user, logout } = useAuth()
  const { theme, setTheme } = useTheme()
  const navigate = useNavigate()

  async function onSignOut() {
    await logout()
    navigate('/login', { replace: true })
  }

  return (
    <div className="min-h-dvh bg-ink-01">
      <header className="sticky top-0 z-10 border-b border-ink-04 bg-ink-01/95 backdrop-blur-sm">
        <div className="flex h-14 items-center justify-between gap-6 px-6 lg:px-10">
          <div className="flex items-baseline gap-6">
            <Link
              to="/dashboard"
              className="font-display text-lg tracking-tight text-ink-12 no-underline"
            >
              R4U
            </Link>
            {user ? <span className="text-xs text-ink-09">{user.email}</span> : null}
          </div>

          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1" role="group" aria-label="Theme">
              {THEMES.map((option) => (
                <Button
                  key={option}
                  size="sm"
                  variant={theme === option ? 'secondary' : 'ghost'}
                  aria-pressed={theme === option}
                  onClick={() => setTheme(option)}
                >
                  {option}
                </Button>
              ))}
            </div>
            <Button size="sm" variant="ghost" onClick={onSignOut}>
              Sign out
            </Button>
          </div>
        </div>
      </header>

      <main className="px-6 py-10 lg:px-10">
        <Outlet />
      </main>
    </div>
  )
}
