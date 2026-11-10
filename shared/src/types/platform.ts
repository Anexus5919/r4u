import type { AuthenticatedRole, UserStatus } from '../constants/roles.js'
import type { ResumeDesign, ResumePersonal, ResumeSection } from '../resume/schema.js'
import type { ResumeType } from '../resume/sections.js'
import type { ResumeStatus } from './resume.js'

// ---------------------------------------------------------------- templates

/** A gallery entry: a code renderer plus a metadata and design preset, never markup (ADR-005). */
export interface TemplateMeta {
  id: string
  key: string
  /** the code renderer in the shared registry this entry draws with */
  baseKey: string
  name: string
  category: string
  description: string
  atsSafe: 'safe' | 'caution' | 'unsafe'
  active: boolean
  order: number
  builtIn: boolean
  defaults: Partial<ResumeDesign>
}

// ---------------------------------------------------------------- sharing

export interface ShareRedaction {
  email: boolean
  phone: boolean
  address: boolean
}

export interface ShareLinkItem {
  id: string
  resumeId: string
  /** last four characters of the token; the token itself is stored only as a hash */
  hint: string
  enabled: boolean
  expiresAt: string | null
  redact: ShareRedaction
  views: number
  downloads: number
  lastViewedAt: string | null
  createdAt: string
}

/** Returned once, at creation. The full URL can never be read back afterwards. */
export interface ShareLinkCreated {
  link: ShareLinkItem
  url: string
  token: string
}

export interface ShareAnalytics {
  link: ShareLinkItem
  daily: { date: string; views: number; downloads: number }[]
}

/** The read-only payload behind /r/:slug. No notes, no owner email, redaction applied. */
export interface PublicResume {
  title: string
  templateKey: string
  resumeType: ResumeType
  personal: ResumePersonal
  sections: ResumeSection[]
  design: ResumeDesign
  updatedAt: string
}

// ---------------------------------------------------------------- people

export interface ReviewerCard {
  id: string
  name: string
  headline: string
  bio: string
  expertise: string[]
  openSlots: number
  online: boolean
}

export interface PersonRef {
  id: string
  name: string
}

// ---------------------------------------------------------------- reviews

export const REVIEW_STATUSES = ['requested', 'declined', 'active', 'completed'] as const
export type ReviewStatus = (typeof REVIEW_STATUSES)[number]

export interface ReviewItem {
  id: string
  status: ReviewStatus
  message: string
  summary: string
  resume: { id: string; title: string; templateKey: string; status: ResumeStatus }
  owner: PersonRef
  reviewer: PersonRef
  requestedAt: string
  respondedAt: string | null
  completedAt: string | null
  /** the caller's side of the review */
  as: 'owner' | 'reviewer'
}

export interface ChatMessage {
  _id: string
  reviewId: string
  senderId: string
  senderName: string
  body: string
  clientId: string
  createdAt: string
  editedAt: string | null
  deletedAt: string | null
}

export interface ReviewComment {
  _id: string
  reviewId: string
  resumeId: string
  sectionKey: string
  entryId: string | null
  fieldPath: string | null
  anchorText: string
  body: string
  authorId: string
  authorName: string
  resolved: boolean
  createdAt: string
}

export interface ReviewParticipant extends PersonRef {
  role: 'owner' | 'reviewer'
  online: boolean
}

// ---------------------------------------------------------------- notifications

export const NOTIFICATION_TYPES = [
  'review_requested',
  'review_accepted',
  'review_declined',
  'review_completed',
  'comment',
  'chat',
] as const
export type NotificationType = (typeof NOTIFICATION_TYPES)[number]

export interface NotificationItem {
  _id: string
  userId: string
  type: NotificationType
  actorId: string | null
  actorName: string
  entity: { kind: 'review' | 'resume' | 'comment'; id: string }
  preview: string
  count: number
  readAt: string | null
  createdAt: string
}

// ---------------------------------------------------------------- admin

export interface AdminStats {
  users: { total: number; user: number; reviewer: number; admin: number; blocked: number }
  resumes: number
  activeTemplates: number
  reviews: { total: number; active: number; completed: number }
  shareLinks: number
  live: LiveStats
  series: { date: string; registrations: number; resumes: number }[]
}

export interface LiveStats {
  connectedUsers: number
  connectedSockets: number
  activeReviewRooms: number
  at: string
}

export interface AdminUserRow {
  id: string
  name: string
  email: string
  role: AuthenticatedRole
  status: UserStatus
  resumeCount: number
  createdAt: string
  lastSeenAt: string | null
}

export interface ActivityEntry {
  id: string
  actor: PersonRef | null
  action: string
  targetType: string
  targetId: string | null
  meta: Record<string, string | number | boolean>
  at: string
}

export const REPORT_STATUSES = ['open', 'actioned', 'dismissed'] as const
export type ReportStatus = (typeof REPORT_STATUSES)[number]

export interface ReportItem {
  id: string
  targetType: 'share_link' | 'user' | 'comment'
  reason: string
  snippet: string
  status: ReportStatus
  reporter: PersonRef | null
  shareLink: { id: string; hint: string; enabled: boolean } | null
  handledBy: PersonRef | null
  handledAt: string | null
  createdAt: string
}

export interface Paged<T> {
  items: T[]
  page: number
  limit: number
  total: number
  totalPages: number
}
