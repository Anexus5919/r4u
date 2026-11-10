import type { Server } from 'socket.io'

// every emission goes through here, so a multi-instance adapter is one change in one file
let io: Server | null = null

export function attachIo(server: Server | null) {
  io = server
}

export function getIo(): Server | null {
  return io
}

export function emitToUser(userId: string, event: string, payload: unknown) {
  io?.to(`user:${userId}`).emit(event, payload)
}

export function emitToRoom(room: string, event: string, payload: unknown) {
  io?.to(room).emit(event, payload)
}

/** User ids with at least one socket in a room, used to skip notifying people already present. */
export async function presentIn(room: string): Promise<Set<string>> {
  if (!io) return new Set()
  const sockets = await io.in(room).fetchSockets()
  return new Set(sockets.map((socket) => String(socket.data.user?.id ?? '')))
}

export function isOnline(userId: string): boolean {
  return Boolean(io?.of('/').adapter.rooms.get(`user:${userId}`)?.size)
}

/** Ends every socket a user holds, for a block or a role change. */
export async function revokeUserSockets(userId: string, reason: string) {
  if (!io) return
  io.to(`user:${userId}`).emit('session:revoked', { reason })
  const sockets = await io.in(`user:${userId}`).fetchSockets()
  for (const socket of sockets) socket.disconnect(true)
}
