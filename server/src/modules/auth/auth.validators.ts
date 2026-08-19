import { body } from 'express-validator'
import { PASSWORD_MAX, PASSWORD_MIN } from '../../lib/password.js'

const password = (field: string) =>
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

const email = body('email')
  .isEmail()
  .withMessage('Enter an email address in the form name@example.com')
  .normalizeEmail({ gmail_remove_dots: false })
  .isLength({ max: 254 })

export const registerRules = [
  body('name').isString().trim().isLength({ min: 2, max: 80 }).withMessage('Enter your full name'),
  email,
  password('password'),
]

export const loginRules = [email, body('password').isString().notEmpty()]

export const forgotPasswordRules = [email]

export const resetPasswordRules = [
  body('token').isString().isLength({ min: 20, max: 200 }),
  password('password'),
]
