import { Router } from 'express'
import { attachPrincipal } from './middleware/authenticate.js'
import { healthRouter } from './modules/health/health.routes.js'
import { authRouter } from './modules/auth/auth.routes.js'
import { usersRouter } from './modules/users/users.routes.js'
import { resumesRouter } from './modules/resumes/resumes.routes.js'
import { publicShareRouter, resumeShareRouter, shareRouter } from './modules/share/share.routes.js'
import { templatesRouter } from './modules/templates/templates.routes.js'
import { reviewsRouter } from './modules/reviews/reviews.routes.js'
import { notificationsRouter } from './modules/notifications/notifications.routes.js'
import { adminRouter } from './modules/admin/admin.routes.js'

export const apiRouter = Router()

apiRouter.use('/health', healthRouter)

/*
  Every route below this line has req.principal set, defaulting to the guest role. Nothing
  downstream has to handle a null user.
*/
apiRouter.use(attachPrincipal)

apiRouter.use('/auth', authRouter)
apiRouter.use('/users', usersRouter)
apiRouter.use('/templates', templatesRouter)
apiRouter.use('/public/r', publicShareRouter)

// mounted before the resumes router so its auth wall does not answer for this path first
apiRouter.use('/resumes/:id/share', resumeShareRouter)
apiRouter.use('/resumes', resumesRouter)
apiRouter.use('/share', shareRouter)
apiRouter.use('/reviews', reviewsRouter)
apiRouter.use('/notifications', notificationsRouter)
apiRouter.use('/admin', adminRouter)
