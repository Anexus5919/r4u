import { Types } from 'mongoose'
import type {
  ActivityEntry,
  AdminStats,
  AdminUserRow,
  AuthenticatedRole,
  Paged,
  ReportItem,
  ReportStatus,
  ResumeDesign,
  TemplateMeta,
  UserStatus,
} from '@r4u/shared'
import { AppError, notFound } from '../../lib/AppError.js'
import { logActivity } from '../../lib/activity.js'
import {
  ActivityLogModel,
  RefreshTokenModel,
  ReportModel,
  ResumeModel,
  ReviewModel,
  ShareLinkModel,
  TemplateModel,
  UserModel,
} from '../../models/index.js'
import { getIo, revokeUserSockets } from '../../sockets/emitters.js'
import { liveStats } from '../../sockets/presence.js'
import { publicPayload } from '../share/share.service.js'
import { isRenderer, serializeTemplate } from '../templates/templates.service.js'

const DAYS = 14

function escapeRegex(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function paged<T>(items: T[], page: number, limit: number, total: number): Paged<T> {
  return { items, page, limit, total, totalPages: Math.max(1, Math.ceil(total / limit)) }
}

// ---------------------------------------------------------------- overview

async function perDay(model: typeof UserModel | typeof ResumeModel, since: Date) {
  // an aggregate that groups on createdAt alone, so no resume field is ever projected
  const rows = await (model as typeof UserModel).aggregate<{ _id: string; n: number }>([
    { $match: { createdAt: { $gte: since } } },
    {
      $group: {
        _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
        n: { $sum: 1 },
      },
    },
  ])
  return new Map(rows.map((row) => [row._id, row.n]))
}

export async function stats(): Promise<AdminStats> {
  const since = new Date(Date.now() - (DAYS - 1) * 86_400_000)
  since.setUTCHours(0, 0, 0, 0)

  const [
    byRole,
    blocked,
    resumes,
    activeTemplates,
    reviewTotal,
    reviewActive,
    reviewDone,
    shareLinks,
    regs,
    made,
  ] = await Promise.all([
    UserModel.aggregate<{ _id: string; n: number }>([{ $group: { _id: '$role', n: { $sum: 1 } } }]),
    UserModel.countDocuments({ status: 'blocked' }),
    ResumeModel.countDocuments(),
    TemplateModel.countDocuments({ active: true }),
    ReviewModel.countDocuments(),
    ReviewModel.countDocuments({ status: 'active' }),
    ReviewModel.countDocuments({ status: 'completed' }),
    ShareLinkModel.countDocuments({ enabled: true }),
    perDay(UserModel, since),
    perDay(ResumeModel, since),
  ])

  const roles = Object.fromEntries(byRole.map((row) => [row._id, row.n])) as Record<string, number>
  const series: AdminStats['series'] = []
  for (let offset = DAYS - 1; offset >= 0; offset--) {
    const date = new Date(Date.now() - offset * 86_400_000).toISOString().slice(0, 10)
    series.push({ date, registrations: regs.get(date) ?? 0, resumes: made.get(date) ?? 0 })
  }

  const io = getIo()
  return {
    users: {
      total: (roles.user ?? 0) + (roles.reviewer ?? 0) + (roles.admin ?? 0),
      user: roles.user ?? 0,
      reviewer: roles.reviewer ?? 0,
      admin: roles.admin ?? 0,
      blocked,
    },
    resumes,
    activeTemplates,
    reviews: { total: reviewTotal, active: reviewActive, completed: reviewDone },
    shareLinks,
    live: io
      ? liveStats(io)
      : {
          connectedUsers: 0,
          connectedSockets: 0,
          activeReviewRooms: 0,
          at: new Date().toISOString(),
        },
    series,
  }
}

// ---------------------------------------------------------------- users

export interface UserQuery {
  q?: string
  role?: AuthenticatedRole
  status?: UserStatus
  page: number
  limit: number
}

export async function listUsers(query: UserQuery): Promise<Paged<AdminUserRow>> {
  const filter: Record<string, unknown> = {}
  if (query.role) filter.role = query.role
  if (query.status) filter.status = query.status
  if (query.q) {
    const pattern = new RegExp(escapeRegex(query.q), 'i')
    // sanitizeFilter recurses into a top-level $or, and a RegExp value is never rewritten
    filter.$or = [{ name: pattern }, { email: pattern }]
  }

  const [docs, total] = await Promise.all([
    UserModel.find(filter)
      .select('name email role status createdAt lastSeenAt')
      .sort({ createdAt: -1 })
      .skip((query.page - 1) * query.limit)
      .limit(query.limit),
    UserModel.countDocuments(filter),
  ])

  const counts = await ResumeModel.aggregate<{ _id: Types.ObjectId; n: number }>([
    { $match: { owner: { $in: docs.map((doc) => doc._id) } } },
    { $group: { _id: '$owner', n: { $sum: 1 } } },
  ])
  const byOwner = new Map(counts.map((row) => [String(row._id), row.n]))

  const items: AdminUserRow[] = docs.map((doc) => ({
    id: doc.id,
    name: doc.name,
    email: doc.email,
    role: doc.role,
    status: doc.status,
    resumeCount: byOwner.get(doc.id) ?? 0,
    createdAt: (doc as unknown as { createdAt: Date }).createdAt.toISOString(),
    lastSeenAt: doc.lastSeenAt ? doc.lastSeenAt.toISOString() : null,
  }))

  return paged(items, query.page, query.limit, total)
}

async function target(userId: string, adminId: string) {
  if (userId === adminId) {
    throw new AppError('VALIDATION_FAILED', 'You cannot change your own role or status')
  }
  const user = await UserModel.findById(userId)
  if (!user) throw notFound('User')
  return user
}

export async function setRole(userId: string, role: AuthenticatedRole, adminId: string, ip = '') {
  const user = await target(userId, adminId)
  const from = user.role
  user.role = role
  if (role === 'reviewer' && !user.reviewerProfile) {
    user.reviewerProfile = { bio: '', expertise: [], acceptingRequests: true, openSlots: 3 }
  }
  // sockets carry the role from their handshake, so they reconnect to pick up the new one
  user.tokenVersion += 1
  await user.save()
  await RefreshTokenModel.deleteMany({ user: user._id })
  await revokeUserSockets(user.id, 'role_changed')

  logActivity({
    actor: adminId,
    action: 'admin.role',
    targetType: 'user',
    targetId: user.id,
    meta: { from, to: role },
    ip,
  })
  return (await listUsers({ q: user.email, page: 1, limit: 1 })).items[0]!
}

/** Block takes effect on the very next request: the token version moves and every session ends. */
export async function setStatus(userId: string, status: UserStatus, adminId: string, ip = '') {
  const user = await target(userId, adminId)
  user.status = status
  user.tokenVersion += 1
  await user.save()
  await RefreshTokenModel.deleteMany({ user: user._id })
  if (status === 'blocked') await revokeUserSockets(user.id, 'blocked')

  logActivity({
    actor: adminId,
    action: `admin.${status === 'blocked' ? 'block' : 'unblock'}`,
    targetType: 'user',
    targetId: user.id,
    ip,
  })
  return (await listUsers({ q: user.email, page: 1, limit: 1 })).items[0]!
}

// ---------------------------------------------------------------- templates

export async function listTemplates(): Promise<TemplateMeta[]> {
  const docs = await TemplateModel.find().sort({ order: 1, name: 1 })
  return docs.map(serializeTemplate)
}

export interface TemplateInput {
  key?: string
  baseKey?: string
  name?: string
  category?: string
  description?: string
  active?: boolean
  order?: number
  defaults?: Partial<ResumeDesign>
}

export async function createTemplate(input: TemplateInput, adminId: string, ip = '') {
  if (!input.baseKey || !isRenderer(input.baseKey)) {
    throw new AppError('VALIDATION_FAILED', 'Choose one of the built-in layouts as the base')
  }
  if (await TemplateModel.exists({ key: input.key })) {
    throw new AppError('VALIDATION_FAILED', 'That key is already taken', [
      { path: 'key', message: 'Already taken' },
    ])
  }
  const count = await TemplateModel.countDocuments()
  const doc = await TemplateModel.create({ ...input, builtIn: false, order: input.order ?? count })
  logActivity({
    actor: adminId,
    action: 'template.create',
    targetType: 'template',
    targetId: doc.id,
    meta: { templateKey: doc.key },
    ip,
  })
  return serializeTemplate(doc)
}

export async function updateTemplate(id: string, input: TemplateInput, adminId: string, ip = '') {
  const doc = await TemplateModel.findById(id)
  if (!doc) throw notFound('Template')

  if (input.name !== undefined) doc.name = input.name
  if (input.category !== undefined) doc.category = input.category
  if (input.description !== undefined) doc.description = input.description
  if (input.active !== undefined) doc.active = input.active
  if (input.order !== undefined) doc.order = input.order
  if (input.defaults !== undefined) doc.set('defaults', input.defaults)
  // a built-in's renderer is fixed; a preset may move to another base layout
  if (input.baseKey !== undefined && !doc.builtIn) {
    if (!isRenderer(input.baseKey)) throw new AppError('VALIDATION_FAILED', 'Unknown base layout')
    doc.baseKey = input.baseKey
  }

  await doc.save()
  logActivity({
    actor: adminId,
    action: input.active === false ? 'template.deactivate' : 'template.update',
    targetType: 'template',
    targetId: doc.id,
    meta: { templateKey: doc.key },
    ip,
  })
  return serializeTemplate(doc)
}

// ---------------------------------------------------------------- reports and logs

type NamedRef = { _id: Types.ObjectId; name: string } | null

function person(ref: unknown) {
  const value = ref as NamedRef
  return value && typeof value === 'object' && 'name' in value
    ? { id: String(value._id), name: value.name }
    : null
}

export async function listReports(status: ReportStatus | undefined, page: number, limit: number) {
  const filter: Record<string, unknown> = {}
  if (status) filter.status = status

  const [docs, total] = await Promise.all([
    ReportModel.find(filter)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .populate('reporter', 'name')
      .populate('handledBy', 'name')
      .populate('shareLink', 'hint enabled'),
    ReportModel.countDocuments(filter),
  ])

  const items: ReportItem[] = docs.map((doc) => {
    const link = doc.shareLink as unknown as {
      _id: Types.ObjectId
      hint: string
      enabled: boolean
    } | null
    return {
      id: doc.id,
      targetType: doc.targetType,
      reason: doc.reason,
      snippet: doc.snippet ?? '',
      status: doc.status,
      reporter: person(doc.reporter),
      shareLink:
        link && 'hint' in link
          ? { id: String(link._id), hint: link.hint, enabled: link.enabled }
          : null,
      handledBy: person(doc.handledBy),
      handledAt: doc.handledAt ? doc.handledAt.toISOString() : null,
      createdAt: (doc as unknown as { createdAt: Date }).createdAt.toISOString(),
    }
  })

  return paged(items, page, limit, total)
}

/** Actioning a report disables the share link: the content is judged through the public view only. */
export async function handleReport(
  id: string,
  action: 'disable_link' | 'dismiss',
  adminId: string,
  ip = ''
) {
  const report = await ReportModel.findById(id)
  if (!report) throw notFound('Report')

  if (action === 'disable_link' && report.shareLink) {
    await ShareLinkModel.updateOne({ _id: report.shareLink }, { $set: { enabled: false } })
  }
  report.status = action === 'dismiss' ? 'dismissed' : 'actioned'
  report.handledBy = new Types.ObjectId(adminId)
  report.handledAt = new Date()
  await report.save()

  logActivity({
    actor: adminId,
    action: `report.${report.status}`,
    targetType: 'report',
    targetId: report.id,
    meta: { reason: report.reason },
    ip,
  })
  return (await listReports(undefined, 1, 100)).items.find((item) => item.id === report.id)!
}

export async function listLogs(page: number, limit: number): Promise<Paged<ActivityEntry>> {
  const [docs, total] = await Promise.all([
    ActivityLogModel.find()
      .sort({ at: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .populate('actor', 'name'),
    ActivityLogModel.countDocuments(),
  ])

  const items: ActivityEntry[] = docs.map((doc) => {
    const actor = person(doc.actor)
    // populate leaves null for a deleted account, but still remembers the id it looked up
    return {
      id: doc.id,
      actor,
      actorDeleted: !actor && Boolean(doc.populated('actor')),
      action: doc.action,
      targetType: doc.targetType,
      targetId: doc.targetId ? String(doc.targetId) : null,
      meta: (doc.meta ?? {}) as ActivityEntry['meta'],
      at: doc.at.toISOString(),
    }
  })

  return paged(items, page, limit, total)
}

/** The reported page exactly as the public sees it, and only while it is still public (ADR-008). */
export async function previewReport(id: string) {
  const report = await ReportModel.findById(id).select('shareLink')
  if (!report?.shareLink) throw notFound('Report')
  const link = await ShareLinkModel.findById(report.shareLink)
  if (!link) throw notFound('Share link')
  if (!link.enabled) throw new AppError('SHARE_LINK_DISABLED', 'This link is no longer public')
  if (link.expiresAt && link.expiresAt.getTime() < Date.now()) {
    throw new AppError('SHARE_LINK_EXPIRED', 'This link is no longer public')
  }
  return publicPayload(link)
}
