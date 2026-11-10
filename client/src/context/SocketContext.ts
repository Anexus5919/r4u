import { createContext, useContext, useEffect, useRef } from 'react'
import type { Socket } from 'socket.io-client'
import type { ClientEventName, ClientEventPayload } from '@r4u/shared'

export type SocketStatus = 'idle' | 'connecting' | 'connected' | 'waking' | 'offline'

export interface SocketContextValue {
  socket: Socket | null
  status: SocketStatus
  unread: number
  setUnread: (unread: number) => void
}

export const SocketContext = createContext<SocketContextValue | null>(null)

export function useSocket(): SocketContextValue {
  const value = useContext(SocketContext)
  if (!value) throw new Error('useSocket must be used inside SocketProvider')
  return value
}

/** Subscribes for the life of the component; the latest handler always runs, with no resubscribe. */
export function useSocketEvent<T>(event: string, handler: (payload: T) => void) {
  const { socket } = useSocket()
  const latest = useRef(handler)

  useEffect(() => {
    latest.current = handler
  })

  useEffect(() => {
    if (!socket) return
    const listener = (payload: T) => latest.current(payload)
    socket.on(event, listener)
    return () => {
      socket.off(event, listener)
    }
  }, [socket, event])
}

export type AckResult<T> = ({ ok: true } & T) | { ok: false; code: string; message: string }

/** Emits with an ack and a timeout; a dropped connection resolves as a failure, never hangs. */
export async function emitWithAck<T extends object, E extends ClientEventName>(
  socket: Socket | null,
  event: E,
  payload: ClientEventPayload<E>,
  timeout = 10_000
): Promise<AckResult<T>> {
  if (!socket?.connected) {
    return { ok: false, code: 'OFFLINE', message: 'Not connected. Trying again shortly.' }
  }
  try {
    return (await socket.timeout(timeout).emitWithAck(event, payload)) as AckResult<T>
  } catch {
    return { ok: false, code: 'TIMEOUT', message: 'The server did not answer in time.' }
  }
}
