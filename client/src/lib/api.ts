import axios from 'axios'
import type { AxiosError, AxiosInstance, InternalAxiosRequestConfig } from 'axios'
import type { ApiErrorShape, ErrorCode } from '@r4u/shared'

/*
  The access token lives here, in a module variable, and nowhere else.

  localStorage would survive the tab, so any XSS could exfiltrate a credential usable later. An
  in-memory token dies with the page, which is the whole reason the refresh cookie exists.
*/
let accessToken: string | null = null

export function setAccessToken(token: string | null) {
  accessToken = token
}

export function getAccessToken() {
  return accessToken
}

export const REFRESH_PATH = '/auth/refresh'

export const api: AxiosInstance = axios.create({
  baseURL: '/api',
  // sends the refresh cookie, which is scoped to /api/auth
  withCredentials: true,
  timeout: 60_000,
  headers: {
    /*
      Required by the server's cookie guard on /auth/refresh and /auth/logout. A custom header
      forces a CORS preflight, which a cross-site attacker cannot satisfy. Harmless elsewhere.
    */
    'X-Requested-With': 'r4u',
  },
})

api.interceptors.request.use((config) => {
  if (accessToken) config.headers.Authorization = `Bearer ${accessToken}`
  return config
})

/*
  One refresh at a time. Without this, three concurrent 401s fire three refreshes, and because
  the server rotates on every use, two of them replay a consumed token and revoke the family,
  logging the user out for doing nothing wrong.
*/
let refreshing: Promise<string | null> | null = null

async function refreshOnce(): Promise<string | null> {
  refreshing ??= api
    .post(REFRESH_PATH)
    .then((res) => {
      const token = res.data?.data?.accessToken as string | undefined
      setAccessToken(token ?? null)
      return token ?? null
    })
    .catch(() => {
      setAccessToken(null)
      return null
    })
    .finally(() => {
      refreshing = null
    })

  return refreshing
}

type Retryable = InternalAxiosRequestConfig & { _retried?: boolean }

api.interceptors.response.use(
  (response) => response,
  async (error: AxiosError<ApiErrorShape>) => {
    const config = error.config as Retryable | undefined
    const code = error.response?.data?.error?.code

    const recoverable = code === 'TOKEN_EXPIRED' || code === 'TOKEN_MISSING'
    const isRefreshCall = config?.url === REFRESH_PATH

    // retry exactly once, and never recurse through the refresh call itself
    if (config && recoverable && !isRefreshCall && !config._retried) {
      config._retried = true
      const token = await refreshOnce()
      if (token) return api(config)
    }

    return Promise.reject(error)
  }
)

export interface ApiFailure {
  code: ErrorCode | 'NETWORK'
  message: string
  details?: { path: string; message: string }[]
}

/** Turns any axios rejection into the same shape, so callers never branch on transport details. */
export function toApiFailure(error: unknown): ApiFailure {
  const axiosError = error as AxiosError<ApiErrorShape>
  const body = axiosError.response?.data?.error

  if (body) {
    return {
      code: body.code,
      message: body.message,
      ...(body.details && { details: body.details }),
    }
  }

  return {
    code: 'NETWORK',
    message: 'Could not reach the server. Check your connection and try again.',
  }
}

/** Unwraps the { data } envelope so callers work with the payload directly. */
export async function apiGet<T>(url: string, signal?: AbortSignal): Promise<T> {
  const res = await api.get(url, { signal })
  return res.data.data as T
}

export async function apiPost<T>(url: string, body?: unknown, signal?: AbortSignal): Promise<T> {
  const res = await api.post(url, body, { signal })
  return res.data?.data as T
}
