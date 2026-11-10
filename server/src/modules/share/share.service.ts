import { createHash, randomBytes } from 'node:crypto'
import { ipKeyGenerator } from 'express-rate-limit'
import type { Request } from 'express'
import type {
  PublicResume,
  ResumeDesign,
  ResumePersonal,
  ResumeSection,
  ShareAnalytics,
  ShareLinkCreated,
  ShareLinkItem,
  ShareRedaction,
} from '@r4u/shared'
import { env } from '../../config/env.js'
import { AppError, notFound } from '../../lib/AppError.js'
import { logActivity } from '../../lib/activity.js'
import { ResumeModel } from '../../models/Resume.js'
import { ShareDailyModel, ShareLinkModel, ShareViewModel } from '../../models/ShareLink.js'
import type { ShareLinkDoc } from '../../models/ShareLink.js'
import { emitToUser } from '../../sockets/emitters.js'
import { readResumeForShare } from '../resumes/resumes.access.js'

const MAX_LINKS_PER_RESUME = 10
const DEDUPE_WINDOW_MS = 60 * 60 * 1000

export function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex')
}

export function serializeLink(link: ShareLinkDoc): ShareLinkItem {
  return {
    id: link.id,
    resumeId: String(link.resume),
    hint: link.hint,
    enabled: link.enabled,
    expiresAt: link.expiresAt ? link.expiresAt.toISOString() : null,
    redact: {
      email: Boolean(link.redact?.email),
      phone: Boolean(link.redact?.phone),
      address: Boolean(link.redact?.address),
    },
    views: link.views,
    downloads: link.downloads,
    lastViewedAt: link.lastViewedAt ? link.lastViewedAt.toISOString() : null,
    createdAt: (link as unknown as { createdAt: Date }).createdAt.toISOString(),
  }
}

async function assertOwner(resumeId: string, ownerId: string) {
  const exists = await ResumeModel.exists({ _id: resumeId, owner: ownerId })
  if (!exists) throw notFound('Resume')
}

async function ownedLink(linkId: string, ownerId: string) {
  const link = await ShareLinkModel.findOne({ _id: linkId, owner: ownerId })
  if (!link) throw notFound('Share link')
  return link
}

export interface LinkInput {
  enabled?: boolean
  expiresAt?: string | null
  redact?: Partial<ShareRedaction>
}

export async function createLink(
  resumeId: string,
  ownerId: string,
  input: LinkInput,
  ip = ''
): Promise<ShareLinkCreated> {
  await assertOwner(resumeId, ownerId)

  const count = await ShareLinkModel.countDocuments({ resume: resumeId })
  if (count >= MAX_LINKS_PER_RESUME) {
    throw new AppError(
      'VALIDATION_FAILED',
      `A resume can have at most ${MAX_LINKS_PER_RESUME} links`
    )
  }

  // 24 random bytes, base64url: unguessable, URL safe, and never stored in the clear
  const token = randomBytes(24).toString('base64url')

  const link = await ShareLinkModel.create({
    resume: resumeId,
    owner: ownerId,
    tokenHash: hashToken(token),
    hint: token.slice(-4),
    expiresAt: input.expiresAt ? new Date(input.expiresAt) : null,
    redact: { email: false, phone: false, address: false, ...input.redact },
  })

  logActivity({
    actor: ownerId,
    action: 'share.create',
    targetType: 'resume',
    targetId: resumeId,
    ip,
  })

  return { link: serializeLink(link), token, url: `${env.APP_URL}/r/${token}` }
}

export async function listLinks(resumeId: string, ownerId: string) {
  await assertOwner(resumeId, ownerId)
  const links = await ShareLinkModel.find({ resume: resumeId, owner: ownerId }).sort({
    createdAt: -1,
  })
  return links.map(serializeLink)
}

export async function updateLink(linkId: string, ownerId: string, input: LinkInput) {
  const link = await ownedLink(linkId, ownerId)

  if (input.enabled !== undefined) link.enabled = input.enabled
  if (input.expiresAt !== undefined) {
    link.expiresAt = input.expiresAt ? new Date(input.expiresAt) : null
  }
  if (input.redact) {
    link.redact = {
      email: input.redact.email ?? Boolean(link.redact?.email),
      phone: input.redact.phone ?? Boolean(link.redact?.phone),
      address: input.redact.address ?? Boolean(link.redact?.address),
    }
  }

  await link.save()
  return serializeLink(link)
}

export async function deleteLink(linkId: string, ownerId: string) {
  const link = await ownedLink(linkId, ownerId)
  await Promise.all([
    link.deleteOne(),
    ShareViewModel.deleteMany({ shareLink: link._id }),
    ShareDailyModel.deleteMany({ shareLink: link._id }),
  ])
}

function dayKey(date: Date) {
  return date.toISOString().slice(0, 10)
}

export async function analytics(linkId: string, ownerId: string): Promise<ShareAnalytics> {
  const link = await ownedLink(linkId, ownerId)
  const rows = await ShareDailyModel.find({ shareLink: link._id }).sort({ date: 1 }).lean()
  const byDate = new Map(rows.map((row) => [row.date, row]))

  // thirty days with zero-filled gaps, so the sparkline has a true time axis
  const daily: ShareAnalytics['daily'] = []
  for (let offset = 29; offset >= 0; offset--) {
    const date = dayKey(new Date(Date.now() - offset * 24 * 60 * 60 * 1000))
    const row = byDate.get(date)
    daily.push({ date, views: row?.views ?? 0, downloads: row?.downloads ?? 0 })
  }

  return { link: serializeLink(link), daily }
}

// ---------------------------------------------------------------- public side

export async function resolveToken(token: string) {
  const link = await ShareLinkModel.findOne({ tokenHash: hashToken(token) })
  if (!link) throw notFound('Share link')
  if (!link.enabled) throw new AppError('SHARE_LINK_DISABLED', 'The owner has turned this link off')
  if (link.expiresAt && link.expiresAt.getTime() < Date.now()) {
    throw new AppError('SHARE_LINK_EXPIRED', 'This link has expired')
  }
  return link
}

type StoredSection = ResumeSection & { _id?: unknown }

// hidden sections and entries were hidden on purpose, so they never leave the server
function visibleSections(sections: StoredSection[]): ResumeSection[] {
  return sections
    .filter((section) => !section.hidden)
    .map((section) => ({
      ...section,
      entries: (section.entries ?? []).filter((entry) => !entry.hidden),
    }))
}

export async function publicPayload(link: ShareLinkDoc): Promise<PublicResume> {
  const resume = await readResumeForShare(String(link.resume))
  const plain = resume.toObject() as unknown as {
    title: string
    templateKey: string
    resumeType: PublicResume['resumeType']
    personal: ResumePersonal
    sections: StoredSection[]
    design: ResumeDesign
    updatedAt: Date
  }

  const personal: ResumePersonal = { ...plain.personal }
  if (link.redact?.email) personal.email = ''
  if (link.redact?.phone) personal.phone = ''
  if (link.redact?.address) personal.location = ''

  return {
    title: plain.title,
    templateKey: plain.templateKey,
    resumeType: plain.resumeType,
    personal,
    sections: visibleSections(plain.sections ?? []),
    design: plain.design,
    updatedAt: plain.updatedAt.toISOString(),
  }
}

function fingerprint(req: Request) {
  const parts = [
    ipKeyGenerator(req.ip ?? ''),
    req.get('user-agent') ?? '',
    req.get('accept-language') ?? '',
  ]
  return createHash('sha256').update(parts.join('|')).digest('hex')
}

/** Counts a view or download once per visitor per clock hour, and never the owner's own. */
export async function recordHit(
  link: ShareLinkDoc,
  kind: 'view' | 'download',
  req: Request,
  viewerId: string | null
): Promise<boolean> {
  if (viewerId && viewerId === String(link.owner)) return false

  const now = new Date()
  try {
    await ShareViewModel.create({
      shareLink: link._id,
      resume: link.resume,
      fingerprint: fingerprint(req),
      kind,
      bucket: Math.floor(now.getTime() / DEDUPE_WINDOW_MS),
    })
  } catch (error) {
    // atomic dedupe: a repeat or a racing twin hits the unique index and is simply not counted
    if ((error as { code?: number }).code === 11000) return false
    throw error
  }

  const counter = kind === 'view' ? 'views' : 'downloads'
  const stamp = kind === 'view' ? 'lastViewedAt' : 'lastDownloadedAt'

  const updated = await ShareLinkModel.findByIdAndUpdate(
    link._id,
    { $inc: { [counter]: 1 }, $set: { [stamp]: now } },
    { returnDocument: 'after' }
  )

  await ShareDailyModel.updateOne(
    { shareLink: link._id, date: dayKey(now) },
    { $inc: { [counter]: 1 } },
    { upsert: true }
  )

  if (updated) {
    emitToUser(String(link.owner), 'share:viewed', {
      resumeId: String(link.resume),
      linkId: updated.id,
      views: updated.views,
      downloads: updated.downloads,
    })
  }

  return true
}
