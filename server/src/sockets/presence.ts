import type { Server } from 'socket.io'
import type { LiveStats } from '@r4u/shared'
import { UserModel } from '../models/User.js'

const GRACE_MS = 10_000
const LAST_SEEN_THROTTLE_MS = 60_000
const LIVE_INTERVAL_MS = 5_000

const lastSeenWrites = new Map<string, number>()
let liveTimer: NodeJS.Timeout | null = null

/** Writes lastSeenAt at most once a minute per user, plus once on the final offline transition. */
export async function touchLastSeen(userId: string, force = false) {
  const now = Date.now()
  if (!force && now - (lastSeenWrites.get(userId) ?? 0) < LAST_SEEN_THROTTLE_MS) return
  lastSeenWrites.set(userId, now)
  await UserModel.updateOne({ _id: userId }, { $set: { lastSeenAt: new Date(now) } }).catch(
    () => undefined
  )
}

// presence is derived from room membership, never stored as a boolean that strands at true
export function onlineIn(io: Server, room: string) {
  return Boolean(io.of('/').adapter.rooms.get(room)?.size)
}

export function announceOnline(io: Server, userId: string) {
  if (io.of('/').adapter.rooms.get(`user:${userId}`)?.size === 1) {
    io.to(`presence:${userId}`).emit('presence:changed', { userId, online: true, lastSeenAt: null })
  }
}

/** Waits out reloads and network flaps before declaring anyone offline. */
export function scheduleOffline(io: Server, userId: string) {
  setTimeout(() => {
    if (onlineIn(io, `user:${userId}`)) return
    const at = new Date().toISOString()
    io.to(`presence:${userId}`).emit('presence:changed', { userId, online: false, lastSeenAt: at })
    void touchLastSeen(userId, true)
  }, GRACE_MS).unref()
}

/** A full, idempotent snapshot of who is in a review room: cheap for two people, immune to drift. */
export async function broadcastRoomPresence(io: Server, room: string) {
  const sockets = await io.in(room).fetchSockets()
  const online = [...new Set(sockets.map((socket) => String(socket.data.user?.id)))]
  io.to(room).emit('review:presence', { reviewId: room.slice('review:'.length), online })
}

// io.engine.clientsCount counts tabs; only a prefix-filtered count over rooms counts people
export function liveStats(io: Server): LiveStats {
  let connectedUsers = 0
  let activeReviewRooms = 0
  for (const key of io.of('/').adapter.rooms.keys()) {
    if (key.startsWith('user:')) connectedUsers++
    else if (key.startsWith('review:')) activeReviewRooms++
  }
  return {
    connectedUsers,
    connectedSockets: io.of('/').sockets.size,
    activeReviewRooms,
    at: new Date().toISOString(),
  }
}

/** Runs only while at least one admin dashboard is subscribed. */
export function ensureLiveTicker(io: Server) {
  if (liveTimer) return
  liveTimer = setInterval(() => {
    if (!io.of('/').adapter.rooms.get('admin:live')?.size) {
      if (liveTimer) clearInterval(liveTimer)
      liveTimer = null
      return
    }
    io.to('admin:live').emit('admin:live_stats', liveStats(io))
  }, LIVE_INTERVAL_MS)
  liveTimer.unref()
}

export function stopLiveTicker() {
  if (liveTimer) clearInterval(liveTimer)
  liveTimer = null
}
