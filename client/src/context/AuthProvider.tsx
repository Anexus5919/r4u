import { useCallback, useEffect, useMemo, useReducer, useRef } from 'react'
import type { PublicUser, Session } from '@r4u/shared'
import { api, apiPost, setAccessToken, toApiFailure } from '@/lib/api'
import type { ApiFailure } from '@/lib/api'
import { AuthContext } from './AuthContext'
import type { AuthStatus } from './AuthContext'

interface State {
  status: AuthStatus
  user: PublicUser | null
  error: ApiFailure | null
}

type Action =
  | { type: 'signed_in'; user: PublicUser }
  | { type: 'signed_out' }
  | { type: 'failed'; error: ApiFailure }
  | { type: 'clear_error' }

const INITIAL: State = { status: 'checking', user: null, error: null }

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case 'signed_in':
      return { status: 'authenticated', user: action.user, error: null }
    case 'signed_out':
      return { status: 'guest', user: null, error: null }
    case 'failed':
      return { ...state, status: state.user ? state.status : 'guest', error: action.error }
    case 'clear_error':
      return { ...state, error: null }
  }
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = useReducer(reducer, INITIAL)
  const restored = useRef(false)

  /*
    Session restore on boot. The refresh cookie is the only thing that survives a reload, so this
    single call both proves the session and mints a fresh access token.
  */
  useEffect(() => {
    // StrictMode invokes effects twice in development, and a second refresh would rotate again
    if (restored.current) return
    restored.current = true

    let cancelled = false

    apiPost<Session>('/auth/refresh')
      .then((session) => {
        if (cancelled) return
        setAccessToken(session.accessToken)
        dispatch({ type: 'signed_in', user: session.user })
      })
      .catch(() => {
        if (cancelled) return
        setAccessToken(null)
        dispatch({ type: 'signed_out' })
      })

    return () => {
      cancelled = true
    }
  }, [])

  const start = useCallback(async (path: string, body: unknown): Promise<PublicUser> => {
    try {
      const session = await apiPost<Session>(path, body)
      setAccessToken(session.accessToken)
      dispatch({ type: 'signed_in', user: session.user })
      return session.user
    } catch (error) {
      setAccessToken(null)
      const failure = toApiFailure(error)
      dispatch({ type: 'failed', error: failure })
      // rethrown so a form can keep its submitting state honest
      throw failure
    }
  }, [])

  const login = useCallback(
    (email: string, password: string) => start('/auth/login', { email, password }),
    [start]
  )

  const register = useCallback(
    (name: string, email: string, password: string) =>
      start('/auth/register', { name, email, password }),
    [start]
  )

  const logout = useCallback(async () => {
    try {
      await api.post('/auth/logout')
    } finally {
      // the local session ends even if the server never heard about it
      setAccessToken(null)
      dispatch({ type: 'signed_out' })
    }
  }, [])

  const clearError = useCallback(() => dispatch({ type: 'clear_error' }), [])

  const value = useMemo(
    () => ({ ...state, login, register, logout, clearError }),
    [state, login, register, logout, clearError]
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
