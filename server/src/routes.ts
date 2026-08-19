import { Router } from 'express'
import { attachPrincipal } from './middleware/authenticate.js'
import { healthRouter } from './modules/health/health.routes.js'
import { authRouter } from './modules/auth/auth.routes.js'
import { usersRouter } from './modules/users/users.routes.js'

export const apiRouter = Router()

apiRouter.use('/health', healthRouter)

/*
  Every route below this line has req.principal set, defaulting to the guest role. Nothing
  downstream has to handle a null user.
*/
apiRouter.use(attachPrincipal)

apiRouter.use('/auth', authRouter)
apiRouter.use('/users', usersRouter)
