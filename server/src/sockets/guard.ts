import type { Socket } from 'socket.io'
import { CLIENT_EVENT_NAMES } from '@r4u/shared'

const ALLOWED = new Set<string>(CLIENT_EVENT_NAMES)

// points per window, per user; typing over its budget is dropped silently, never answered
const LIMITS: Record<string, { points: number; windowMs: number }> = {
  global: { points: 30, windowMs: 10_000 },
  'chat:send': { points: 10, windowMs: 10_000 },
  'comment:create': { points: 20, windowMs: 60_000 },
  'chat:typing': { points: 1, windowMs: 1_000 },
}

const buckets = new Map<string, { count: number; resetAt: number }>()

function take(key: string, limit: { points: number; windowMs: number }) {
  const now = Date.now()
  const bucket = buckets.get(key)
  if (!bucket || bucket.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + limit.windowMs })
    return true
  }
  bucket.count += 1
  return bucket.count <= limit.points
}

function sweep() {
  if (buckets.size < 5000) return
  const now = Date.now()
  for (const [key, bucket] of buckets) if (bucket.resetAt <= now) buckets.delete(key)
}

export function resetLimits() {
  buckets.clear()
}

type Ack = (reply: { ok: false; code: string; message: string }) => void

/** One socket.use() guard, in the order REALTIME.md section 9 gives. */
export function installGuard(socket: Socket) {
  socket.use((packet, next) => {
    const [event, payload] = packet as [string, unknown]
    const last = packet[packet.length - 1]
    const ack = typeof last === 'function' ? (last as Ack) : null

    const reject = (code: string, message: string) => {
      if (ack) ack({ ok: false, code, message })
      else socket.emit('error:event', { event, code, message })
    }

    if (Date.now() / 1000 > (socket.data.tokenExp ?? 0)) {
      socket.emit('session:revoked', { reason: 'expired' })
      socket.disconnect(true)
      return
    }

    if (!ALLOWED.has(event)) return reject('UNKNOWN_EVENT', 'Unknown event')

    // blocks argument-array smuggling: one plain object, or nothing for no-argument events
    const plain =
      payload === undefined ||
      typeof payload === 'function' ||
      (typeof payload === 'object' && payload !== null && !Array.isArray(payload))
    if (!plain) return reject('VALIDATION_FAILED', 'Send one object')

    sweep()
    const userId = String(socket.data.user?.id ?? socket.id)

    if (event === 'chat:typing') {
      if (!take(`${userId}:typing`, LIMITS['chat:typing']!)) return
      return next()
    }

    if (!take(`${userId}:global`, LIMITS.global!))
      return reject('RATE_LIMITED', 'Slow down a little')

    const specific = LIMITS[event]
    if (specific && !take(`${userId}:${event}`, specific)) {
      return reject('RATE_LIMITED', 'Slow down a little')
    }

    next()
  })
}
