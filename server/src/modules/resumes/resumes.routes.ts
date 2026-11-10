import express, { Router } from 'express'
import { AutosaveSchema } from '@r4u/shared'
import { requireAuth } from '../../middleware/authenticate.js'
import { validate } from '../../middleware/validate.js'
import { validateBody } from '../../middleware/validateBody.js'
import * as controller from './resumes.controller.js'
import {
  createRules,
  duplicateRules,
  importRules,
  listRules,
  renameRules,
  resumeIdRule,
  versionIdRule,
  versionLabelRules,
} from './resumes.validators.js'

export const resumesRouter = Router()

resumesRouter.use(requireAuth)

resumesRouter.get('/', validate(listRules), controller.list)
resumesRouter.post('/', validate(createRules), controller.create)

// import creates, so it sits beside create with the larger body limit
resumesRouter.post(
  '/import',
  express.json({ limit: '1mb' }),
  validate(importRules),
  controller.importJson
)

// ownership is a service-side owner filter; a miss is 404, never 403
resumesRouter.get('/:id', validate([resumeIdRule]), controller.read)

// 1mb rather than 256kb: a rejected save is the one unrecoverable failure
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

resumesRouter.get('/:id/export.json', validate([resumeIdRule]), controller.exportJson)

resumesRouter.get('/:id/versions', validate([resumeIdRule]), controller.listVersions)
resumesRouter.post('/:id/versions', validate(versionLabelRules), controller.createVersion)
resumesRouter.post(
  '/:id/versions/:versionId/restore',
  validate([resumeIdRule, versionIdRule]),
  controller.restoreVersion
)
