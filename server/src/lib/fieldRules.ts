import { body } from 'express-validator'
import { PASSWORD_MAX, PASSWORD_MIN } from '@r4u/shared'

/*
  One definition of each rule, shared by every module that validates it. The messages match the
  requirement list the client renders from the same shared module, so the two can never disagree
  about what a valid password is.
*/

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
