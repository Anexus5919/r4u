import { createServer } from 'node:http'
import type { Server as HttpServer } from 'node:http'
import type { Server } from 'socket.io'
import { createApp } from './app.js'
import { disconnectDb } from './config/db.js'
import { logger } from './config/logger.js'
import { flushActivity } from './lib/activity.js'
import { closeSockets, initSockets } from './sockets/index.js'

export interface Running {
  httpServer: HttpServer
  io: Server
  close: () => Promise<void>
}

/** HTTP and Socket.IO on one port, so one Render service and one Docker container serve both. */
export async function startServer(port: number): Promise<Running> {
  const httpServer = createServer(createApp())
  const io = initSockets(httpServer)

  await new Promise<void>((resolve) => httpServer.listen(port, resolve))

  let closing: Promise<void> | null = null

  // stop accepting, close sockets, flush the activity buffer, then let go of the database
  async function close() {
    closing ??= (async () => {
      await closeSockets(io)
      await new Promise<void>((resolve) => httpServer.close(() => resolve()))
      await flushActivity()
      await disconnectDb()
    })()
    return closing
  }

  return { httpServer, io, close }
}

/** SIGTERM on every Render deploy: drain, and give up after ten seconds rather than hang. */
export function handleSignals(running: Running, extra?: () => Promise<void>) {
  const shutdown = (signal: string) => {
    logger.info(`${signal} received, draining`)
    setTimeout(() => {
      logger.error('drain timed out, exiting')
      process.exit(1)
    }, 10_000).unref()

    void running
      .close()
      .then(() => extra?.())
      .finally(() => process.exit(0))
  }

  process.on('SIGTERM', () => shutdown('SIGTERM'))
  process.on('SIGINT', () => shutdown('SIGINT'))
}
