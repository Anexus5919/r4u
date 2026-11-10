import { Router } from 'express'
import type { Request, Response } from 'express'
import { body, query } from 'express-validator'
import { requireAuth } from '../../middleware/authenticate.js'
import { authorize } from '../../middleware/authorize.js'
import { validate } from '../../middleware/validate.js'
import { principalOf } from '../../lib/principal.js'
import * as service from './notifications.service.js'

// the initial load and the non-socket fallback; live delivery is notify:new over the socket
export const notificationsRouter = Router()
notificationsRouter.use(requireAuth, authorize('user', 'reviewer'))

notificationsRouter.get(
  '/',
  validate([query('filter').optional().isIn(['all', 'unread', 'review'])]),
  async (req: Request, res: Response) => {
    const { filter } = req.validated as { filter?: 'all' | 'unread' | 'review' }
    const result = await service.list(principalOf(req).id, filter ?? 'all')
    res.json({ data: { notifications: result.items, unread: result.unread } })
  }
)

notificationsRouter.get('/unread-count', async (req: Request, res: Response) => {
  res.json({ data: { unread: await service.unreadCount(principalOf(req).id) } })
})

notificationsRouter.patch(
  '/read',
  validate([
    body('ids').isArray({ min: 1, max: 100 }).withMessage('Send between 1 and 100 ids'),
    body('ids.*').isMongoId(),
  ]),
  async (req: Request, res: Response) => {
    const { ids } = req.validated as { ids: string[] }
    res.json({ data: { unread: await service.markRead(principalOf(req).id, ids) } })
  }
)

notificationsRouter.patch('/read-all', async (req: Request, res: Response) => {
  res.json({ data: { unread: await service.markAllRead(principalOf(req).id) } })
})
