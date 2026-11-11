import { describe, expect, it } from 'vitest'
import { brevoRequest, parseFrom, resetPasswordMail } from './mailer.js'

describe('mail', () => {
  it('splits a display name from the address, and copes with a bare address', () => {
    expect(parseFrom('R4U <reset@example.com>')).toEqual({
      name: 'R4U',
      email: 'reset@example.com',
    })
    expect(parseFrom('"R4U Team" <reset@example.com>')).toEqual({
      name: 'R4U Team',
      email: 'reset@example.com',
    })
    expect(parseFrom('reset@example.com')).toEqual({ name: 'R4U', email: 'reset@example.com' })
  })

  it('builds the Brevo request with the key in a header and both bodies', () => {
    const mail = resetPasswordMail('aman@example.com', 'Aman', 'https://r4u.test/reset?t=abc', 30)
    const { url, init } = brevoRequest(mail, 'R4U <reset@example.com>', 'key-123')
    const body = JSON.parse(init.body)

    expect(url).toBe('https://api.brevo.com/v3/smtp/email')
    expect(init.headers['api-key']).toBe('key-123')
    expect(body.sender).toEqual({ name: 'R4U', email: 'reset@example.com' })
    expect(body.to).toEqual([{ email: 'aman@example.com' }])
    expect(body.textContent).toContain('https://r4u.test/reset?t=abc')
    expect(body.htmlContent).toContain('Choose a new password')
  })
})
