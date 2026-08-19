import { body, param, query } from 'express-validator'
import { RESUME_TYPES } from '@r4u/shared'

export const resumeIdRule = param('id').isMongoId().withMessage('Not a valid resume id')

export const listRules = [
  query('q').optional().isString().trim().isLength({ max: 80 }),
  query('status').optional().isIn(['draft', 'in_review', 'reviewed']),
  query('sort').optional().isIn(['updated', 'created', 'title']),
  query('page').optional().isInt({ min: 1 }).toInt(),
  // capped, because an uncapped limit is a denial-of-service parameter
  query('limit').optional().isInt({ min: 1, max: 100 }).toInt(),
]

export const createRules = [
  body('title')
    .isString()
    .trim()
    .isLength({ min: 1, max: 80 })
    .withMessage('Give the resume a title'),
  body('resumeType').optional().isIn(RESUME_TYPES),
  body('templateKey').optional().isString().trim().isLength({ min: 1, max: 40 }),
]

export const renameRules = [
  resumeIdRule,
  body('title')
    .isString()
    .trim()
    .isLength({ min: 1, max: 80 })
    .withMessage('Give the resume a title'),
]

export const duplicateRules = [
  resumeIdRule,
  body('title').optional().isString().trim().isLength({ min: 1, max: 80 }),
]

export const versionIdRule = param('versionId').isMongoId().withMessage('Not a valid version id')

export const versionLabelRules = [
  resumeIdRule,
  body('label').optional().isString().trim().isLength({ max: 120 }),
]

/*
  The incoming document is validated for shape and size only. fromJsonResume is deliberately
  tolerant about its contents: a file that half-imports and names what it skipped is more useful
  than one that refuses outright.
*/
export const importRules = [
  body('title').optional().isString().trim().isLength({ min: 1, max: 80 }),
  body('document').isObject().withMessage('Provide a JSON Resume document'),
]
