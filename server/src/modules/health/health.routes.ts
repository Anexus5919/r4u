import { Router } from 'express'
import { dbReadyState } from '../../config/db.js'

export const healthRouter = Router()

/*
  Never behind auth. The Docker healthcheck, the CI smoke test and the client's cold-start
  wake-up all call this. readyState catches "server up, Atlas unreachable", which otherwise
  surfaces as unexplained 500s across every route.
*/
healthRouter.get('/', (_req, res) => {
  const db = dbReadyState()
  res.status(db === 1 ? 200 : 503).json({
    data: { status: db === 1 ? 'ok' : 'degraded', uptime: Math.round(process.uptime()), db },
  })
})
