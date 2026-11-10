import { body } from 'express-validator'
import { PASSWORD_MAX, PASSWORD_MIN } from '@r4u/shared'

// one definition per rule, so client and server agree on what is valid

export const passwordRule = (field: string) =>
  body(field)
    .isString()
    .isLength({ min: PASSWORD_MIN, max: PASSWORD_MAX })
    .withMessage(`Use between ${PASSWORD_MIN} and ${PASSWORD_MAX} characters`)
    .matches(/[a-z]/)
    .withMessage('Include a lowercase letter')
    .matches(/[A-Z]/)
    .withMessage('Include an uppercase letter')
    .matches(/[0-9]/)
    .withMessage('Include a number')

export const emailRule = body('email')
  .isEmail()
  .withMessage('Enter an email address in the form name@example.com')
  .normalizeEmail({ gmail_remove_dots: false })
  .isLength({ max: 254 })

export const nameRule = body('name')
  .isString()
  .trim()
  .isLength({ min: 2, max: 80 })
  .withMessage('Enter your full name')
