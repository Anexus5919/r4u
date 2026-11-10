import { StrictMode } from 'react'
import { render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useAuth } from './AuthContext'
import { AuthProvider } from './AuthProvider'

// returns plain values, because a spy that returns a rejected promise trips vitest's tracker
const refresh = vi.fn<() => unknown>()

vi.mock('@/lib/api', () => ({
  api: { post: vi.fn() },
  apiPost: async () => {
    const outcome = refresh()
    if (outcome instanceof Error) throw outcome
    return outcome
  },
  setAccessToken: vi.fn(),
  toApiFailure: (error: unknown) => error,
}))

function Status() {
  const { status, user } = useAuth()
  return <p>{user ? `${status}:${user.name}` : status}</p>
}

function renderStrict() {
  return render(
    <StrictMode>
      <AuthProvider>
        <Status />
      </AuthProvider>
    </StrictMode>
  )
}

describe('AuthProvider session restore', () => {
  beforeEach(() => refresh.mockReset())

  // the regression: a cancelled first effect left status on 'checking' and blanked /register
  it('settles to guest under StrictMode when there is no session', async () => {
    refresh.mockReturnValue(new Error('401'))
    renderStrict()

    expect(await screen.findByText('guest')).toBeInTheDocument()
    expect(refresh).toHaveBeenCalledTimes(1)
  })

  it('settles to authenticated under StrictMode when the cookie is valid', async () => {
    refresh.mockReturnValue({
      accessToken: 'token',
      user: { id: 'u1', name: 'Aman Sharma', role: 'user' },
    })
    renderStrict()

    expect(await screen.findByText('authenticated:Aman Sharma')).toBeInTheDocument()
    expect(refresh).toHaveBeenCalledTimes(1)
  })
})
