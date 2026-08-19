import express, { Router } from 'express'
import { AutosaveSchema } from '@r4u/shared'
import { requireAuth } from '../../middleware/authenticate.js'
import { validate } from '../../middleware/validate.js'
import { validateBody } from '../../middleware/validateBody.js'
import * as controller from './resumes.controller.js'
import {
  createRules,
  duplicateRules,
  listRules,
  renameRules,
  resumeIdRule,
} from './resumes.validators.js'

export const resumesRouter = Router()

resumesRouter.use(requireAuth)

resumesRouter.get('/', validate(listRules), controller.list)
resumesRouter.post('/', validate(createRules), controller.create)

/*
  Ownership is enforced inside the service by filtering on owner, and a miss returns 404 rather
  than 403. A 403 would confirm the id exists, which enumerates a collection of PII documents.
*/
resumesRouter.get('/:id', validate([resumeIdRule]), controller.read)

/*
  Autosave carries a 1mb limit rather than the global 256kb, because a long academic CV is a
  genuinely large document and rejecting a save is the one failure a user cannot recover from.
*/
resumesRouter.patch(
  '/:id',
  express.json({ limit: '1mb' }),
  validate([resumeIdRule]),
  validateBody(AutosaveSchema),
  controller.autosave
)

resumesRouter.patch('/:id/title', validate(renameRules), controller.rename)
resumesRouter.delete('/:id', validate([resumeIdRule]), controller.remove)
resumesRouter.post('/:id/duplicate', validate(duplicateRules), controller.duplicate)
