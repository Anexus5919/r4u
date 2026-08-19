import { Router } from 'express'
import { validate } from '../../middleware/validate.js'
import { requireAuth } from '../../middleware/authenticate.js'
import { cookieGuard } from '../../middleware/cookieGuard.js'
import { authLimiter, passwordResetLimiter } from '../../middleware/rateLimit.js'
import * as controller from './auth.controller.js'
import {
  forgotPasswordRules,
  loginRules,
  registerRules,
  resetPasswordRules,
} from './auth.validators.js'

export const authRouter = Router()

authRouter.get('/me', requireAuth, controller.me)

authRouter.post('/register', authLimiter, validate(registerRules), controller.register)
authRouter.post('/login', authLimiter, validate(loginRules), controller.login)

// the only two endpoints that read the refresh cookie, hence the guard
authRouter.post('/refresh', cookieGuard, controller.refresh)
authRouter.post('/logout', cookieGuard, controller.logout)

authRouter.post(
  '/forgot-password',
  passwordResetLimiter,
  validate(forgotPasswordRules),
  controller.forgotPassword
)
authRouter.post(
  '/reset-password',
  authLimiter,
  validate(resetPasswordRules),
  controller.resetPassword
)
