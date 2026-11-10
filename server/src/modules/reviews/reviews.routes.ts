import { Router } from 'express'
import type { Request, Response } from 'express'
import { body, param, query } from 'express-validator'
import { requireAuth } from '../../middleware/authenticate.js'
import { authorize } from '../../middleware/authorize.js'
import { validate } from '../../middleware/validate.js'
import { clientIp, principalOf } from '../../lib/principal.js'
import * as service from './reviews.service.js'

const idRule = param('id').isMongoId().withMessage('Not a valid review id')

// set membership: admin is absent here on purpose, and the service refuses it a second time
export const reviewsRouter = Router()
reviewsRouter.use(requireAuth, authorize('user', 'reviewer'))

reviewsRouter.get('/', async (req: Request, res: Response) => {
  res.json({ data: { reviews: await service.list(principalOf(req)) } })
})

reviewsRouter.post(
  '/',
  validate([
    body('resumeId').isMongoId().withMessage('Choose a resume'),
    body('reviewerId').isMongoId().withMessage('Choose a reviewer'),
    body('message').optional().isString().trim().isLength({ max: 500 }),
  ]),
  async (req: Request, res: Response) => {
    const input = req.validated as unknown as service.RequestInput
    const review = await service.request(principalOf(req), input, clientIp(req))
    res.status(201).json({ data: { review } })
  }
)

reviewsRouter.get('/:id', validate([idRule]), async (req: Request, res: Response) => {
  const { id } = req.validated as { id: string }
  res.json({ data: { review: await service.getOne(id, principalOf(req)) } })
})

reviewsRouter.patch(
  '/:id/respond',
  validate([idRule, body('accept').isBoolean().withMessage('Say yes or no').toBoolean()]),
  async (req: Request, res: Response) => {
    const { id, accept } = req.validated as { id: string; accept: boolean }
    const review = await service.respond(id, principalOf(req), accept, clientIp(req))
    res.json({ data: { review } })
  }
)

reviewsRouter.patch(
  '/:id/complete',
  validate([idRule, body('summary').optional().isString().trim().isLength({ max: 1000 })]),
  async (req: Request, res: Response) => {
    const { id, summary } = req.validated as { id: string; summary?: string }
    const review = await service.complete(id, principalOf(req), summary ?? '', clientIp(req))
    res.json({ data: { review } })
  }
)

reviewsRouter.get('/:id/resume', validate([idRule]), async (req: Request, res: Response) => {
  const { id } = req.validated as { id: string }
  res.json({ data: { resume: await service.resumeForReview(id, principalOf(req)) } })
})

reviewsRouter.get('/:id/comments', validate([idRule]), async (req: Request, res: Response) => {
  const { id } = req.validated as { id: string }
  res.json({ data: { comments: await service.comments(id, principalOf(req)) } })
})

reviewsRouter.get(
  '/:id/messages',
  validate([idRule, query('before').optional().isMongoId()]),
  async (req: Request, res: Response) => {
    const { id, before } = req.validated as { id: string; before?: string }
    res.json({ data: await service.messages(id, principalOf(req), before) })
  }
)
