import nodemailer from 'nodemailer'
import type { Transporter } from 'nodemailer'
import { env, isProduction, isTest } from '../config/env.js'
import { logger } from '../config/logger.js'

const smtpConfigured = Boolean(env.SMTP_HOST && env.SMTP_USER && env.SMTP_PASS)
export const mailConfigured = Boolean(env.BREVO_API_KEY) || smtpConfigured

let transport: Transporter | null = null

function transporter(): Transporter | null {
  if (!smtpConfigured) return null
  transport ??= nodemailer.createTransport({
    host: env.SMTP_HOST,
    port: env.SMTP_PORT,
    // 465 is implicit TLS; 587 upgrades with STARTTLS, which nodemailer requires here
    secure: env.SMTP_PORT === 465,
    requireTLS: env.SMTP_PORT !== 465,
    auth: { user: env.SMTP_USER, pass: env.SMTP_PASS },
    // a blocked port must fail in seconds, not hang for minutes
    connectionTimeout: 10_000,
    greetingTimeout: 10_000,
    socketTimeout: 20_000,
  })
  return transport
}

export interface Mail {
  to: string
  subject: string
  text: string
  html: string
}

/** "R4U <you@example.com>" as name and address; a bare address keeps R4U as the name. */
export function parseFrom(from: string): { name: string; email: string } {
  const match = /^\s*"?([^"<]*?)"?\s*<([^>]+)>\s*$/.exec(from)
  if (match) return { name: match[1]!.trim() || 'R4U', email: match[2]!.trim() }
  return { name: 'R4U', email: from.trim() }
}

/** The Brevo transactional request. Pure, so the payload is tested without a network. */
export function brevoRequest(mail: Mail, from: string, apiKey: string) {
  return {
    url: 'https://api.brevo.com/v3/smtp/email',
    init: {
      method: 'POST',
      headers: {
        'api-key': apiKey,
        'content-type': 'application/json',
        accept: 'application/json',
      },
      body: JSON.stringify({
        sender: parseFrom(from),
        to: [{ email: mail.to }],
        subject: mail.subject,
        textContent: mail.text,
        htmlContent: mail.html,
      }),
    },
  }
}

// HTTPS, not SMTP: Render's free plan blocks outbound mail ports, so a hosted API is the only way out
async function sendWithBrevo(mail: Mail, apiKey: string) {
  const { url, init } = brevoRequest(mail, env.MAIL_FROM, apiKey)
  const res = await fetch(url, { ...init, signal: AbortSignal.timeout(15_000) })
  if (!res.ok) throw new Error(`Brevo answered ${res.status}: ${(await res.text()).slice(0, 200)}`)
}

/** Sends, or in development logs, a message. Never throws: mail is never on a request's critical path. */
export async function sendMail(mail: Mail): Promise<boolean> {
  if (env.BREVO_API_KEY && !isTest) {
    try {
      await sendWithBrevo(mail, env.BREVO_API_KEY)
      return true
    } catch (error) {
      logger.error({ err: error, to: mail.to }, 'mail delivery failed')
      return false
    }
  }

  const smtp = transporter()

  if (!smtp) {
    if (isTest) return false
    // the link is shown only off production, where reading it from the log is the dev workflow
    if (isProduction) logger.warn({ to: mail.to, subject: mail.subject }, 'smtp not configured')
    else logger.info({ to: mail.to, subject: mail.subject, body: mail.text }, 'mail (not sent)')
    return false
  }

  try {
    await smtp.sendMail({ from: env.MAIL_FROM, ...mail })
    return true
  } catch (error) {
    logger.error({ err: error, to: mail.to }, 'mail delivery failed')
    return false
  }
}

function escape(value: string) {
  return value.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`)
}

export function resetPasswordMail(to: string, name: string, url: string, minutes: number): Mail {
  const greeting = name ? `Hello ${name},` : 'Hello,'
  const text = [
    greeting,
    '',
    'Someone asked to reset the password on your R4U account. If that was you, open this link:',
    url,
    '',
    `The link works once and expires in ${minutes} minutes. If you did not ask for this, ignore this message; your password has not changed.`,
    '',
    'R4U, Resume For You',
  ].join('\n')

  // email clients cannot read custom properties, so the token values are inlined as rgb
  const html = `<div style="font-family:Arial,sans-serif;font-size:15px;line-height:1.5;color:rgb(17,23,34);max-width:520px">
<p>${escape(greeting)}</p>
<p>Someone asked to reset the password on your R4U account. If that was you, use the button below.</p>
<p><a href="${escape(url)}" style="display:inline-block;background:rgb(35,86,224);color:rgb(255,255,255);padding:10px 18px;border-radius:6px;text-decoration:none">Choose a new password</a></p>
<p style="color:rgb(90,101,119)">The link works once and expires in ${minutes} minutes. If you did not ask for this, ignore this message; your password has not changed.</p>
<p style="color:rgb(90,101,119)">R4U, Resume For You</p>
</div>`

  return { to, subject: 'Reset your R4U password', text, html }
}
