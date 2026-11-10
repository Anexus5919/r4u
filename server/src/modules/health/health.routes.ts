import { Router } from 'express'
import { dbReadyState } from '../../config/db.js'

export const healthRouter = Router()

// never behind auth; readyState catches 'server up, Atlas unreachable'
healthRouter.get('/', (_req, res) => {
  const db = dbReadyState()
  res.status(db === 1 ? 200 : 503).json({
    data: { status: db === 1 ? 'ok' : 'degraded', uptime: Math.round(process.uptime()), db },
  })
})
