import { body } from 'express-validator'
import { THEMES } from '@r4u/shared'
import { passwordRule } from '../../lib/fieldRules.js'

// role, status and tokenVersion have no chain, so matchedData drops them
export const updateProfileRules = [
  body('name').optional().isString().trim().isLength({ min: 2, max: 80 }),
  body('headline').optional().isString().trim().isLength({ max: 80 }),
  body('phone')
    .optional()
    .isString()
    .trim()
    .isLength({ max: 32 })
    .matches(/^[0-9+\-() ]*$/)
    .withMessage('Use digits, spaces and the characters + - ( ) only'),
  body('location').optional().isString().trim().isLength({ max: 60 }),
  body('theme').optional().isIn(THEMES),
]

export const changePasswordRules = [
  body('currentPassword').isString().notEmpty().withMessage('Enter your current password'),
  passwordRule('password'),
]
