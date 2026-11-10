import { useCallback, useRef, useState } from 'react'
import { Link, NavLink, Outlet, useNavigate } from 'react-router-dom'
import type { Role, Theme } from '@r4u/shared'
import { Logo } from '@/components/brand/Logo'
import { Avatar } from '@/components/ui/Avatar'
import { Icon } from '@/components/ui/Icon'
import { useAuth } from '@/context/AuthContext'
import { useTheme } from '@/context/ThemeContext'
import { useDismiss } from '@/hooks/useDismiss'
import { cn } from '@/lib/cn'

const THEMES: { value: Theme; label: string }[] = [
  { value: 'light', label: 'Light' },
  { value: 'dark', label: 'Dark' },
  { value: 'system', label: 'System' },
]

interface NavItem {
  to: string
  label: string
}

// admin and user surfaces are siblings, so each role sees only the links it can open
function navFor(role: Role | undefined): NavItem[] {
  if (role === 'admin') {
    return [
      { to: '/admin', label: 'Admin console' },
      { to: '/profile', label: 'Profile' },
    ]
  }
  return [
    { to: '/dashboard', label: 'My resumes' },
    { to: '/profile', label: 'Profile' },
  ]
}

function navClass({ isActive }: { isActive: boolean }) {
  return cn(
    'rounded-xs px-3 py-2 text-sm font-medium no-underline t-xs transition-colors',
    isActive ? 'bg-ink-03 text-ink-12' : 'text-ink-09 hover:bg-ink-02 hover:text-ink-12'
  )
}

function ThemeSwitch() {
  const { theme, setTheme } = useTheme()

  return (
    <div
      role="group"
      aria-label="Theme"
      className="grid grid-cols-3 gap-1 rounded-xs bg-ink-02 p-1"
    >
      {THEMES.map((option) => (
        <button
          key={option.value}
          type="button"
          aria-pressed={theme === option.value}
          onClick={() => setTheme(option.value)}
          className={cn(
            't-xs h-7 rounded-xs text-xs font-medium transition-colors',
            theme === option.value ? 'lift bg-ink-00 text-ink-12' : 'text-ink-09 hover:text-ink-12'
          )}
        >
          {option.label}
        </button>
      ))}
    </div>
  )
}

function UserMenu({ onSignOut }: { onSignOut: () => void }) {
  const { user } = useAuth()
  const [open, setOpen] = useState(false)
  const root = useRef<HTMLDivElement>(null)
  const close = useCallback(() => setOpen(false), [])

  useDismiss(root, open, close)

  if (!user) return null

  return (
    <div ref={root} className="relative">
      <button
        type="button"
        aria-expanded={open}
        aria-controls="user-menu"
        aria-label="Account menu"
        onClick={() => setOpen((value) => !value)}
        className="t-xs flex items-center gap-2 rounded-xs py-1 pr-2 pl-1 transition-colors hover:bg-ink-02"
      >
        <Avatar name={user.name} src={user.avatarUrl} />
        <span className="hidden max-w-40 truncate text-sm font-medium text-ink-12 sm:inline">
          {user.name}
        </span>
        <Icon name="chevron" className="text-ink-08" />
      </button>

      {open ? (
        <div
          id="user-menu"
          className="float absolute top-full right-0 z-30 mt-2 w-72 rounded-sm border border-ink-04 bg-ink-00 p-1.5"
        >
          <div className="flex items-center gap-3 px-3 py-2.5">
            <Avatar name={user.name} src={user.avatarUrl} size="md" />
            <div className="min-w-0">
              <p className="truncate text-sm font-medium text-ink-12">{user.name}</p>
              <p className="truncate text-xs text-ink-09">{user.email}</p>
            </div>
          </div>

          <div className="my-1 border-t border-ink-04" />

          <div className="px-3 py-2">
            <p className="mb-2 text-xs font-medium text-ink-09">Appearance</p>
            <ThemeSwitch />
          </div>

          <div className="my-1 border-t border-ink-04" />

          <Link
            to="/profile"
            onClick={close}
            className="block rounded-xs px-3 py-2 text-sm text-ink-11 no-underline hover:bg-ink-02"
          >
            Profile and settings
          </Link>
          <button
            type="button"
            onClick={() => {
              close()
              onSignOut()
            }}
            className="block w-full rounded-xs px-3 py-2 text-left text-sm text-ink-11 hover:bg-ink-02"
          >
            Sign out
          </button>
        </div>
      ) : null}
    </div>
  )
}

// the tool surface: edge to edge, a white bar over the ground, and a drawer below md
export function AppShell() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const [drawer, setDrawer] = useState(false)

  const items = navFor(user?.role)
  const home = user?.role === 'admin' ? '/admin' : '/dashboard'

  async function onSignOut() {
    await logout()
    navigate('/login', { replace: true })
  }

  return (
    <div className="min-h-dvh bg-ink-01">
      <header className="sticky top-0 z-20 border-b border-ink-04 bg-ink-00">
        <div className="flex h-16 items-center gap-2 px-4 sm:px-6 lg:px-10">
          <button
            type="button"
            aria-label={drawer ? 'Close navigation' : 'Open navigation'}
            aria-expanded={drawer}
            aria-controls="app-drawer"
            onClick={() => setDrawer((value) => !value)}
            className="-ml-1 flex size-10 items-center justify-center rounded-xs text-ink-10 hover:bg-ink-02 md:hidden"
          >
            <Icon name={drawer ? 'close' : 'grip'} />
          </button>

          <Logo to={home} />

          <nav aria-label="Primary" className="ml-8 hidden items-center gap-1 md:flex">
            {items.map((item) => (
              <NavLink key={item.to} to={item.to} className={navClass}>
                {item.label}
              </NavLink>
            ))}
          </nav>

          <div className="ml-auto">
            <UserMenu onSignOut={() => void onSignOut()} />
          </div>
        </div>

        {drawer ? (
          <nav
            id="app-drawer"
            aria-label="Primary"
            className="flex flex-col gap-1 border-t border-ink-04 px-4 py-3 md:hidden"
          >
            {items.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                className={navClass}
                onClick={() => setDrawer(false)}
              >
                {item.label}
              </NavLink>
            ))}
            <div className="mt-2 border-t border-ink-04 px-3 pt-3">
              <p className="mb-2 text-xs font-medium text-ink-09">Appearance</p>
              <ThemeSwitch />
            </div>
          </nav>
        ) : null}
      </header>

      <main className="px-6 py-10 lg:px-10">
        <Outlet />
      </main>
    </div>
  )
}
