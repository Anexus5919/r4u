import type { Server as HttpServer } from 'node:http'
import { Server } from 'socket.io'
import type { Socket } from 'socket.io'
import { isAllowedOrigin } from '../app.js'
import { AppError } from '../lib/AppError.js'
import { verifyAccessToken } from '../lib/tokens.js'
import { UserModel } from '../models/User.js'
import { attachIo } from './emitters.js'
import { installGuard } from './guard.js'
import { registerHandlers } from './handlers.js'
import {
  announceOnline,
  broadcastRoomPresence,
  scheduleOffline,
  stopLiveTicker,
  touchLastSeen,
} from './presence.js'
import { logger } from '../config/logger.js'

const EXPIRY_WARNING_MS = 60_000

// the JWT arrives in the handshake auth object, never extraHeaders, which a WebSocket upgrade drops
async function authenticate(socket: Socket, next: (err?: Error) => void) {
  try {
    const token: unknown = socket.handshake.auth?.token
    if (typeof token !== 'string' || !token)
      throw new AppError('TOKEN_MISSING', 'Sign in to continue')

    const claims = verifyAccessToken(token) as ReturnType<typeof verifyAccessToken> & {
      exp: number
    }
    const user = await UserModel.findById(claims.sub).select('name role status tokenVersion')

    if (!user) throw new AppError('TOKEN_INVALID', 'Invalid token')
    if (user.tokenVersion !== claims.tv) throw new AppError('TOKEN_EXPIRED', 'Session expired')
    if (user.status === 'blocked') throw new AppError('ACCOUNT_BLOCKED', 'This account is blocked')

    socket.data.user = { id: user.id, role: user.role, name: user.name }
    socket.data.tokenExp = claims.exp
    next()
  } catch (error) {
    const code = error instanceof AppError ? error.code : 'TOKEN_INVALID'
    // err.data tells the client to refresh and reconnect rather than retry the dead token
    const rejection = new Error(
      error instanceof Error ? error.message : 'Unauthorised'
    ) as Error & {
      data?: { code: string }
    }
    rejection.data = { code }
    next(rejection)
  }
}

function scheduleExpiry(socket: Socket) {
  const ms = socket.data.tokenExp * 1000 - Date.now()
  const timers = [
    setTimeout(
      () =>
        socket.emit('session:expiring', {
          expiresAt: new Date(socket.data.tokenExp * 1000).toISOString(),
        }),
      Math.max(0, ms - EXPIRY_WARNING_MS)
    ),
    setTimeout(
      () => {
        socket.emit('session:revoked', { reason: 'expired' })
        socket.disconnect(true)
      },
      Math.max(0, ms)
    ),
  ]
  for (const timer of timers) timer.unref()
  socket.once('disconnect', () => timers.forEach(clearTimeout))
}

export function initSockets(httpServer: HttpServer): Server {
  const io = new Server(httpServer, {
    // Express cors() never runs on the Engine.IO handshake, so the socket needs its own
    cors: {
      origin(origin, callback) {
        if (!origin) return callback(null, true)
        callback(null, isAllowedOrigin(origin))
      },
      credentials: true,
    },
    // a latency optimisation only; the correctness path is re-joining and reconciling by _id
    connectionStateRecovery: { maxDisconnectionDuration: 120_000, skipMiddlewares: false },
    maxHttpBufferSize: 1e5,
  })

  io.use(authenticate)

  io.on('connection', (socket) => {
    const userId = String(socket.data.user.id)

    installGuard(socket)
    scheduleExpiry(socket)
    void socket.join(`user:${userId}`)
    announceOnline(io, userId)
    void touchLastSeen(userId)

    socket.emit('session:ready', {
      userId,
      role: socket.data.user.role,
      serverTime: new Date().toISOString(),
      recovered: socket.recovered,
    })

    registerHandlers(io, socket)

    socket.on('disconnecting', () => {
      const reviewRooms = [...socket.rooms].filter((room) => room.startsWith('review:'))
      setImmediate(() => {
        for (const room of reviewRooms) void broadcastRoomPresence(io, room)
      })
    })

    socket.on('disconnect', () => scheduleOffline(io, userId))
    socket.on('error', (error) => logger.warn({ err: error }, 'socket error'))
  })

  attachIo(io)
  return io
}

export function closeSockets(io: Server): Promise<void> {
  stopLiveTicker()
  attachIo(null)
  return new Promise((resolve) => {
    void io.close(() => resolve())
  })
}
