import { useEffect, useMemo, useState } from 'react'
import { io } from 'socket.io-client'
import type { Socket } from 'socket.io-client'
import type { NotificationItem } from '@r4u/shared'
import { describeNotification } from '@/lib/notifications'
import { apiGet, getAccessToken, refreshOnce } from '@/lib/api'
import { useAuth } from './AuthContext'
import { SocketContext } from './SocketContext'
import type { SocketStatus } from './SocketContext'
import { useToast } from './ToastContext'

const SOCKET_URL = (import.meta.env.VITE_SOCKET_URL as string | undefined) || window.location.origin
const WAKE_LIMIT_MS = 90_000

// one socket for the whole app, opened once a session exists and closed when it ends
export function SocketProvider({ children }: { children: React.ReactNode }) {
  const { status: authStatus, user, logout } = useAuth()
  const { toast } = useToast()
  const [socket, setSocket] = useState<Socket | null>(null)
  const [status, setStatus] = useState<SocketStatus>('idle')
  const [unread, setUnread] = useState(0)

  const userId = authStatus === 'authenticated' ? user?.id : undefined
  const role = user?.role

  useEffect(() => {
    if (!userId) return

    // a function, so every reconnect sends the current token rather than the one from page load
    const next = io(SOCKET_URL, {
      auth: (cb) => cb({ token: getAccessToken() }),
      timeout: 45_000,
      reconnectionDelayMax: 10_000,
    })

    let firstFailureAt: number | null = null

    next.on('connect', () => {
      firstFailureAt = null
      setStatus('connected')
    })

    next.on('connect_error', (error: Error & { data?: { code?: string } }) => {
      const code = error.data?.code
      if (code === 'TOKEN_EXPIRED' || code === 'TOKEN_MISSING') {
        // refresh over HTTP, then reconnect, which is the only way to re-run the handshake
        void refreshOnce().then((token) => {
          if (token) next.connect()
          else setStatus('offline')
        })
        return
      }
      if (code === 'ACCOUNT_BLOCKED') {
        setStatus('offline')
        void logout()
        return
      }
      // a sleeping free-tier server is not an error yet: say so quietly, then give up after 90s
      firstFailureAt ??= Date.now()
      setStatus(Date.now() - firstFailureAt > WAKE_LIMIT_MS ? 'offline' : 'waking')
    })

    next.on('disconnect', () => setStatus('connecting'))

    next.on('session:expiring', () => {
      void refreshOnce().then((token) => {
        if (token) next.disconnect().connect()
      })
    })

    next.on('session:revoked', ({ reason }: { reason: string }) => {
      if (reason === 'blocked') {
        toast('danger', 'This account has been blocked by an administrator.')
        void logout()
      } else {
        void refreshOnce().then((token) => {
          if (token) next.connect()
          else void logout()
        })
      }
    })

    next.on('notify:count', ({ unread: count }: { unread: number }) => setUnread(count))
    next.on('notify:new', ({ notification }: { notification: NotificationItem }) => {
      if (window.location.pathname === `/reviews/${notification.entity.id}`) return
      toast('info', describeNotification(notification))
    })

    // the connecting state is set from the event handlers, never synchronously in this effect
    queueMicrotask(() => {
      setSocket(next)
      setStatus('connecting')
    })

    return () => {
      next.removeAllListeners()
      next.disconnect()
      setSocket(null)
      setStatus('idle')
    }
  }, [userId, logout, toast])

  // the badge starts from the server's count; notify:count keeps it in step afterwards
  useEffect(() => {
    if (!userId || role === 'admin') return
    let cancelled = false
    apiGet<{ unread: number }>('/notifications/unread-count')
      .then(({ unread: count }) => {
        if (!cancelled) setUnread(count)
      })
      .catch(() => undefined)
    return () => {
      cancelled = true
    }
  }, [userId, role])

  const value = useMemo(() => ({ socket, status, unread, setUnread }), [socket, status, unread])

  return <SocketContext.Provider value={value}>{children}</SocketContext.Provider>
}
