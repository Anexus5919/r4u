import { Router } from 'express'
import type { Request, Response } from 'express'
import { param } from 'express-validator'
import { validate } from '../../middleware/validate.js'
import * as service from './templates.service.js'

// public: the gallery is how a visitor judges the product before signing up
export const templatesRouter = Router()

templatesRouter.get('/', async (_req: Request, res: Response) => {
  res.json({ data: { templates: await service.listActive() } })
})

templatesRouter.get(
  '/:key',
  validate([
    param('key')
      .isString()
      .isLength({ min: 1, max: 40 })
      .matches(/^[a-z0-9-]+$/),
  ]),
  async (req: Request, res: Response) => {
    const { key } = req.validated as { key: string }
    res.json({ data: { template: await service.getByKey(key) } })
  }
)
