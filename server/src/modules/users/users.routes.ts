import { Router } from 'express'
import { requireAuth } from '../../middleware/authenticate.js'
import { validate } from '../../middleware/validate.js'
import { avatarUpload } from '../../lib/upload.js'
import { authorize } from '../../middleware/authorize.js'
import * as controller from './users.controller.js'
import {
  getReviewerProfile,
  listReviewers,
  reviewerProfileRules,
  updateReviewerProfile,
} from './reviewers.js'
import { changePasswordRules, updateProfileRules } from './users.validators.js'

export const usersRouter = Router()

// every route here acts on the caller's own account, so there is no :id to authorise against
usersRouter.use(requireAuth)

usersRouter.get('/reviewers', authorize('user', 'reviewer'), listReviewers)
usersRouter.get('/me/reviewer-profile', authorize('reviewer'), getReviewerProfile)
usersRouter.patch(
  '/me/reviewer-profile',
  authorize('reviewer'),
  validate(reviewerProfileRules),
  updateReviewerProfile
)
usersRouter.get('/me', controller.getMe)
usersRouter.patch('/me', validate(updateProfileRules), controller.updateMe)
usersRouter.patch('/me/password', validate(changePasswordRules), controller.changePassword)
usersRouter.post('/me/avatar', avatarUpload, controller.uploadAvatar)
usersRouter.delete('/me', controller.deleteMe)
