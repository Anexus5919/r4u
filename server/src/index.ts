import { createServer } from 'node:http'
import express from 'express'

const app = express()

app.disable('x-powered-by')

/*
  The exact hop count on Render, never `true`. With `true` Express returns the leftmost
  X-Forwarded-For entry, which the client controls, letting one caller forge unlimited addresses
  and bypass every rate limiter.
*/
app.set('trust proxy', 1)

app.use(express.json({ limit: '256kb' }))
app.use(express.urlencoded({ extended: true, limit: '32kb' }))

/*
  Never behind auth. This is what the Docker healthcheck, the CI smoke test and the client's
  cold-start wake-up all call. Phase 2 adds mongoose.connection.readyState, which catches the
  common "server up, database unreachable" state that otherwise surfaces as mystery 500s.
*/
app.get('/api/health', (_req, res) => {
  res.json({ data: { status: 'ok', uptime: Math.round(process.uptime()) } })
})

const port = Number(process.env.PORT ?? 5000)
const server = createServer(app)

server.listen(port, () => {
  // eslint-disable-next-line no-console -- pino replaces this in phase 2
  console.log(`r4u server listening on ${port}`)
})

/*
  Render sends SIGTERM on every rolling deploy. Draining rather than dying keeps an in-flight
  write from being severed mid-request, and phase 8 adds io.close() to the same sequence.
*/
function shutdown(signal: string) {
  // eslint-disable-next-line no-console -- pino replaces this in phase 2
  console.log(`${signal} received, draining`)
  server.close(() => process.exit(0))
  setTimeout(() => process.exit(1), 10_000).unref()
}

process.on('SIGTERM', () => shutdown('SIGTERM'))
process.on('SIGINT', () => shutdown('SIGINT'))

export { app }
