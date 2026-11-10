import nodemailer from 'nodemailer'
import type { Transporter } from 'nodemailer'
import { env, isProduction, isTest } from '../config/env.js'
import { logger } from '../config/logger.js'

export const mailConfigured = Boolean(env.SMTP_HOST && env.SMTP_USER && env.SMTP_PASS)

let transport: Transporter | null = null

function transporter(): Transporter | null {
  if (!mailConfigured) return null
  transport ??= nodemailer.createTransport({
    host: env.SMTP_HOST,
    port: env.SMTP_PORT,
    // 465 is implicit TLS; 587 upgrades with STARTTLS, which nodemailer requires here
    secure: env.SMTP_PORT === 465,
    requireTLS: env.SMTP_PORT !== 465,
    auth: { user: env.SMTP_USER, pass: env.SMTP_PASS },
  })
  return transport
}

export interface Mail {
  to: string
  subject: string
  text: string
  html: string
}

/** Sends, or in development logs, a message. Never throws: mail is never on a request's critical path. */
export async function sendMail(mail: Mail): Promise<boolean> {
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
