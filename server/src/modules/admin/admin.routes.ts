import { Router } from 'express'
import type { Request, Response } from 'express'
import { body, param, query } from 'express-validator'
import { AUTHENTICATED_ROLES, REPORT_STATUSES, TEMPLATE_LIST, USER_STATUSES } from '@r4u/shared'
import type { AuthenticatedRole, ReportStatus, UserStatus } from '@r4u/shared'
import { requireAuth } from '../../middleware/authenticate.js'
import { authorize } from '../../middleware/authorize.js'
import { validate } from '../../middleware/validate.js'
import { clientIp, principalOf } from '../../lib/principal.js'
import * as service from './admin.service.js'
import type { TemplateInput } from './admin.service.js'

const idRule = param('id').isMongoId().withMessage('Not a valid id')
const pageRules = [
  query('page').optional().isInt({ min: 1 }).toInt(),
  query('limit').optional().isInt({ min: 1, max: 100 }).toInt(),
]

const designRules = [
  body('defaults').optional().isObject(),
  body('defaults.accent').optional().isString().isLength({ max: 20 }),
  body('defaults.typeScale').optional().isFloat({ min: 9.5, max: 11.5 }).toFloat(),
  body('defaults.leading').optional().isFloat({ min: 1.2, max: 1.45 }).toFloat(),
  body('defaults.sectionSpacing').optional().isIn(['compact', 'normal', 'airy']),
  body('defaults.margins').optional().isFloat({ min: 16, max: 25 }).toFloat(),
]

const metaRules = (required: boolean) => {
  const field = (name: string) => (required ? body(name) : body(name).optional())
  return [
    field('name').isString().trim().isLength({ min: 2, max: 40 }).withMessage('2 to 40 characters'),
    field('category')
      .isString()
      .trim()
      .isLength({ min: 2, max: 40 })
      .withMessage('2 to 40 characters'),
    body('description').optional().isString().trim().isLength({ max: 200 }),
    body('active').optional().isBoolean().toBoolean(),
    body('order').optional().isInt({ min: 0, max: 999 }).toInt(),
    body('baseKey')
      .optional()
      .isIn(TEMPLATE_LIST.map((t) => t.key))
      .withMessage('Unknown layout'),
    ...designRules,
  ]
}

// set membership, not a ladder: these routes admit admin and nobody else (ADR-008)
export const adminRouter = Router()
adminRouter.use(requireAuth, authorize('admin'))

adminRouter.get('/stats', async (_req: Request, res: Response) => {
  res.json({ data: await service.stats() })
})

adminRouter.get(
  '/users',
  validate([
    query('q').optional().isString().trim().isLength({ max: 80 }),
    query('role').optional().isIn(AUTHENTICATED_ROLES),
    query('status').optional().isIn(USER_STATUSES),
    ...pageRules,
  ]),
  async (req: Request, res: Response) => {
    const input = req.validated as {
      q?: string
      role?: AuthenticatedRole
      status?: UserStatus
      page?: number
      limit?: number
    }
    const result = await service.listUsers({
      ...input,
      page: input.page ?? 1,
      limit: input.limit ?? 20,
    })
    res.json({
      data: { users: result.items },
      meta: {
        page: result.page,
        limit: result.limit,
        total: result.total,
        totalPages: result.totalPages,
      },
    })
  }
)

adminRouter.patch(
  '/users/:id/role',
  validate([idRule, body('role').isIn(AUTHENTICATED_ROLES).withMessage('Choose a role')]),
  async (req: Request, res: Response) => {
    const { id, role } = req.validated as { id: string; role: AuthenticatedRole }
    res.json({
      data: { user: await service.setRole(id, role, principalOf(req).id, clientIp(req)) },
    })
  }
)

adminRouter.patch(
  '/users/:id/status',
  validate([idRule, body('status').isIn(USER_STATUSES).withMessage('Choose active or blocked')]),
  async (req: Request, res: Response) => {
    const { id, status } = req.validated as { id: string; status: UserStatus }
    res.json({
      data: { user: await service.setStatus(id, status, principalOf(req).id, clientIp(req)) },
    })
  }
)

adminRouter.get('/templates', async (_req: Request, res: Response) => {
  res.json({ data: { templates: await service.listTemplates() } })
})

adminRouter.post(
  '/templates',
  validate([
    body('key')
      .isString()
      .trim()
      .isLength({ min: 3, max: 40 })
      .matches(/^[a-z0-9-]+$/)
      .withMessage('Lowercase letters, numbers and hyphens'),
    body('baseKey')
      .isIn(TEMPLATE_LIST.map((t) => t.key))
      .withMessage('Choose a base layout'),
    ...metaRules(true),
  ]),
  async (req: Request, res: Response) => {
    const input = req.validated as TemplateInput
    res.status(201).json({
      data: { template: await service.createTemplate(input, principalOf(req).id, clientIp(req)) },
    })
  }
)

adminRouter.patch(
  '/templates/:id',
  validate([idRule, ...metaRules(false)]),
  async (req: Request, res: Response) => {
    const { id, ...input } = req.validated as unknown as { id: string } & TemplateInput
    res.json({
      data: {
        template: await service.updateTemplate(id, input, principalOf(req).id, clientIp(req)),
      },
    })
  }
)

adminRouter.get(
  '/reports',
  validate([query('status').optional().isIn(REPORT_STATUSES), ...pageRules]),
  async (req: Request, res: Response) => {
    const input = req.validated as { status?: ReportStatus; page?: number; limit?: number }
    const result = await service.listReports(input.status, input.page ?? 1, input.limit ?? 20)
    res.json({
      data: { reports: result.items },
      meta: {
        page: result.page,
        limit: result.limit,
        total: result.total,
        totalPages: result.totalPages,
      },
    })
  }
)

adminRouter.patch(
  '/reports/:id',
  validate([
    idRule,
    body('action').isIn(['disable_link', 'dismiss']).withMessage('Choose an action'),
  ]),
  async (req: Request, res: Response) => {
    const { id, action } = req.validated as { id: string; action: 'disable_link' | 'dismiss' }
    res.json({
      data: { report: await service.handleReport(id, action, principalOf(req).id, clientIp(req)) },
    })
  }
)

adminRouter.get('/reports/:id/preview', validate([idRule]), async (req: Request, res: Response) => {
  const { id } = req.validated as { id: string }
  res.json({ data: { resume: await service.previewReport(id) } })
})

adminRouter.get('/logs', validate(pageRules), async (req: Request, res: Response) => {
  const input = req.validated as { page?: number; limit?: number }
  const result = await service.listLogs(input.page ?? 1, input.limit ?? 25)
  res.json({
    data: { logs: result.items },
    meta: {
      page: result.page,
      limit: result.limit,
      total: result.total,
      totalPages: result.totalPages,
    },
  })
})
