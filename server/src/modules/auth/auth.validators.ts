import { body } from 'express-validator'
import { emailRule, nameRule, passwordRule } from '../../lib/fieldRules.js'

export const registerRules = [nameRule, emailRule, passwordRule('password')]

export const loginRules = [emailRule, body('password').isString().notEmpty()]

export const forgotPasswordRules = [emailRule]

export const resetPasswordRules = [
  body('token').isString().isLength({ min: 20, max: 200 }),
  passwordRule('password'),
]
