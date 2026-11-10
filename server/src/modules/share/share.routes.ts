import { Router } from 'express'
import type { NextFunction, Request, Response } from 'express'
import { body, param } from 'express-validator'
import { requireAuth } from '../../middleware/authenticate.js'
import { authorize } from '../../middleware/authorize.js'
import { publicShareLimiter, reportLimiter } from '../../middleware/rateLimit.js'
import { validate } from '../../middleware/validate.js'
import { clientIp, principalOf } from '../../lib/principal.js'
import { logActivity } from '../../lib/activity.js'
import { ReportModel } from '../../models/Moderation.js'
import * as service from './share.service.js'
import type { LinkInput } from './share.service.js'

const idRule = param('id').isMongoId().withMessage('Not a valid id')
const tokenRule = param('slug')
  .isString()
  .isLength({ min: 16, max: 64 })
  .matches(/^[A-Za-z0-9_-]+$/)
  .withMessage('Not a valid link')

const linkRules = [
  body('enabled').optional().isBoolean().toBoolean(),
  body('expiresAt')
    .optional({ values: 'null' })
    .isISO8601()
    .withMessage('Give a valid date')
    .custom((value: string) => new Date(value).getTime() > Date.now())
    .withMessage('Pick a date in the future'),
  body('redact.email').optional().isBoolean().toBoolean(),
  body('redact.phone').optional().isBoolean().toBoolean(),
  body('redact.address').optional().isBoolean().toBoolean(),
]

// ---------------------------------------------------------------- owner side

export const resumeShareRouter = Router({ mergeParams: true })
resumeShareRouter.use(requireAuth, authorize('user', 'reviewer'))

resumeShareRouter.get('/', validate([idRule]), async (req: Request, res: Response) => {
  const { id } = req.validated as { id: string }
  res.json({ data: { links: await service.listLinks(id, principalOf(req).id) } })
})

resumeShareRouter.post(
  '/',
  validate([idRule, ...linkRules]),
  async (req: Request, res: Response) => {
    const { id, ...input } = req.validated as unknown as { id: string } & LinkInput
    const created = await service.createLink(id, principalOf(req).id, input, clientIp(req))
    res.status(201).json({ data: created })
  }
)

export const shareRouter = Router()
shareRouter.use(requireAuth, authorize('user', 'reviewer'))

shareRouter.patch('/:id', validate([idRule, ...linkRules]), async (req: Request, res: Response) => {
  const { id, ...input } = req.validated as unknown as { id: string } & LinkInput
  res.json({ data: { link: await service.updateLink(id, principalOf(req).id, input) } })
})

shareRouter.delete('/:id', validate([idRule]), async (req: Request, res: Response) => {
  const { id } = req.validated as { id: string }
  await service.deleteLink(id, principalOf(req).id)
  res.status(204).end()
})

shareRouter.get('/:id/analytics', validate([idRule]), async (req: Request, res: Response) => {
  const { id } = req.validated as { id: string }
  res.json({ data: await service.analytics(id, principalOf(req).id) })
})

// ---------------------------------------------------------------- public side

// a resume is a PII document: never indexed, never leaked through a Referer, never cached
function privateHeaders(_req: Request, res: Response, next: NextFunction) {
  res.set({
    'X-Robots-Tag': 'noindex, nofollow',
    'Referrer-Policy': 'no-referrer',
    'Cache-Control': 'no-store',
  })
  next()
}

export const publicShareRouter = Router()
publicShareRouter.use(privateHeaders, publicShareLimiter)

publicShareRouter.get('/:slug', validate([tokenRule]), async (req: Request, res: Response) => {
  const { slug } = req.validated as { slug: string }
  const link = await service.resolveToken(slug)
  const resume = await service.publicPayload(link)
  await service.recordHit(link, 'view', req, req.principal.id)
  res.json({ data: { resume } })
})

publicShareRouter.post(
  '/:slug/download',
  validate([tokenRule]),
  async (req: Request, res: Response) => {
    const { slug } = req.validated as { slug: string }
    const link = await service.resolveToken(slug)
    const resume = await service.publicPayload(link)
    await service.recordHit(link, 'download', req, req.principal.id)
    res.json({ data: { resume } })
  }
)

// only a resume with a live public link is reportable; a private resume has no route here at all
publicShareRouter.post(
  '/:slug/report',
  reportLimiter,
  validate([
    tokenRule,
    body('reason')
      .isIn(['spam', 'impersonation', 'offensive', 'personal_data', 'other'])
      .withMessage('Choose a reason'),
    body('snippet').optional().isString().trim().isLength({ max: 500 }),
  ]),
  async (req: Request, res: Response) => {
    const { slug, reason, snippet } = req.validated as {
      slug: string
      reason: string
      snippet?: string
    }
    const link = await service.resolveToken(slug)
    const report = await ReportModel.create({
      reporter: req.principal.id ?? null,
      shareLink: link._id,
      targetType: 'share_link',
      reason,
      snippet: snippet ?? '',
    })
    logActivity({
      actor: req.principal.id,
      action: 'report.create',
      targetType: 'report',
      targetId: report.id,
      meta: { reason },
      ip: clientIp(req),
    })
    res.status(201).json({ data: { ok: true } })
  }
)
