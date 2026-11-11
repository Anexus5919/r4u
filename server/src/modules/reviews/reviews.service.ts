import { randomUUID } from 'node:crypto'
import { Types, trusted } from 'mongoose'
import type {
  ChatMessage,
  PublicResume,
  ResumeDesign,
  ResumePersonal,
  ResumeSection,
  ReviewComment,
  ReviewItem,
} from '@r4u/shared'
import { AppError, notFound } from '../../lib/AppError.js'
import { logActivity } from '../../lib/activity.js'
import { CommentModel, MessageModel, ReviewModel } from '../../models/Review.js'
import type { CommentDoc, MessageDoc, ReviewDoc } from '../../models/Review.js'
import { ResumeModel } from '../../models/Resume.js'
import { UserModel } from '../../models/User.js'
import { emitToRoom } from '../../sockets/emitters.js'
import { notify } from '../notifications/notifications.service.js'
import { readResumeForReview } from '../resumes/resumes.access.js'
import type { Principal } from '../resumes/resumes.access.js'

const PAGE = 30

// ---------------------------------------------------------------- serialisers

interface NamedRef {
  _id: Types.ObjectId
  name: string
}

type PopulatedReview = Omit<ReviewDoc, 'owner' | 'reviewer' | 'resume'> & {
  owner: NamedRef
  reviewer: NamedRef
  resume: { _id: Types.ObjectId; title: string; templateKey: string; status: string } | null
}

const iso = (date?: Date | null) => (date ? date.toISOString() : null)

export function serializeReview(doc: PopulatedReview, viewerId: string): ReviewItem {
  return {
    id: String(doc._id),
    status: doc.status,
    message: doc.message ?? '',
    summary: doc.summary ?? '',
    resume: {
      id: doc.resume ? String(doc.resume._id) : '',
      title: doc.resume?.title ?? 'Deleted resume',
      templateKey: doc.resume?.templateKey ?? 'foundry',
      status: (doc.resume?.status ?? 'draft') as ReviewItem['resume']['status'],
    },
    owner: { id: String(doc.owner._id), name: doc.owner.name },
    reviewer: { id: String(doc.reviewer._id), name: doc.reviewer.name },
    requestedAt: doc.requestedAt.toISOString(),
    respondedAt: iso(doc.respondedAt),
    completedAt: iso(doc.completedAt),
    round: doc.round ?? 1,
    resubmittedAt: iso(doc.resubmittedAt),
    rating: doc.rating ?? null,
    ratingNote: doc.ratingNote ?? '',
    as: String(doc.owner._id) === viewerId ? 'owner' : 'reviewer',
  }
}

export function serializeMessage(doc: MessageDoc, senderName: string): ChatMessage {
  return {
    _id: doc.id,
    reviewId: String(doc.review),
    senderId: String(doc.sender),
    senderName,
    body: doc.deletedAt ? '' : doc.body,
    clientId: doc.clientId,
    createdAt: (doc as unknown as { createdAt: Date }).createdAt.toISOString(),
    editedAt: iso(doc.editedAt),
    deletedAt: iso(doc.deletedAt),
  }
}

export function serializeComment(doc: CommentDoc, authorName: string): ReviewComment {
  return {
    _id: doc.id,
    reviewId: String(doc.review),
    resumeId: String(doc.resume),
    sectionKey: doc.sectionKey,
    entryId: doc.entryId ?? null,
    fieldPath: doc.fieldPath ?? null,
    anchorText: doc.anchorText ?? '',
    body: doc.body,
    authorId: String(doc.author),
    authorName,
    resolved: doc.resolved,
    createdAt: (doc as unknown as { createdAt: Date }).createdAt.toISOString(),
  }
}

async function names(ids: string[]) {
  const unique = [...new Set(ids)].filter((id) => Types.ObjectId.isValid(id))
  const users = await UserModel.find({ _id: trusted({ $in: unique }) })
    .select('name')
    .lean()
  return new Map(users.map((user) => [String(user._id), user.name]))
}

function populated(query: ReturnType<typeof ReviewModel.findOne>) {
  return query
    .populate('owner', 'name')
    .populate('reviewer', 'name')
    .populate('resume', 'title templateKey status')
}

// ---------------------------------------------------------------- access

function denyAdmin(principal: Principal) {
  // a positive refusal: an admin holds a valid token, so nothing else would stop this
  if (principal.role === 'admin') {
    throw new AppError('ADMIN_CONTENT_FORBIDDEN', 'Reviews are not visible to administrators')
  }
}

/** The review, if the caller is its owner or assigned reviewer; 404 for anyone else. */
export async function loadForParty(reviewId: string, principal: Principal) {
  denyAdmin(principal)
  if (!Types.ObjectId.isValid(reviewId)) throw notFound('Review')
  const review = await ReviewModel.findById(reviewId)
  const party =
    review && (String(review.owner) === principal.id || String(review.reviewer) === principal.id)
  if (!review || !party) throw notFound('Review')
  return review
}

export function roleIn(review: ReviewDoc, userId: string): 'owner' | 'reviewer' {
  return String(review.owner) === userId ? 'owner' : 'reviewer'
}

function counterpart(review: ReviewDoc, userId: string) {
  return String(review.owner) === userId ? String(review.reviewer) : String(review.owner)
}

export function isOpenRoom(review: ReviewDoc) {
  return review.status === 'active' || review.status === 'completed'
}

// ---------------------------------------------------------------- REST surface

export async function list(principal: Principal): Promise<ReviewItem[]> {
  denyAdmin(principal)
  // two queries rather than an $or, which sanitizeFilter would otherwise have to be told to trust
  const [asOwner, asReviewer] = await Promise.all([
    populated(ReviewModel.find({ owner: principal.id }) as never),
    populated(ReviewModel.find({ reviewer: principal.id }) as never),
  ])
  const all = [
    ...(asOwner as unknown as PopulatedReview[]),
    ...(asReviewer as unknown as PopulatedReview[]),
  ]
  return all
    .sort(
      (a, b) =>
        (b as unknown as { updatedAt: Date }).updatedAt.getTime() -
        (a as unknown as { updatedAt: Date }).updatedAt.getTime()
    )
    .map((doc) => serializeReview(doc, principal.id))
}

export async function getOne(reviewId: string, principal: Principal): Promise<ReviewItem> {
  await loadForParty(reviewId, principal)
  const doc = (await populated(ReviewModel.findById(reviewId))) as unknown as PopulatedReview
  return serializeReview(doc, principal.id)
}

export interface RequestInput {
  resumeId: string
  reviewerId: string
  message?: string
}

export async function request(principal: Principal, input: RequestInput, ip = '') {
  denyAdmin(principal)

  const resume = await ResumeModel.findOne({ _id: input.resumeId, owner: principal.id }).select(
    'title'
  )
  if (!resume) throw notFound('Resume')

  if (input.reviewerId === principal.id) {
    throw new AppError('VALIDATION_FAILED', 'You cannot review your own resume')
  }

  const reviewer = await UserModel.findOne({
    _id: input.reviewerId,
    role: 'reviewer',
    status: 'active',
  }).select('name reviewerProfile')
  if (!reviewer || reviewer.reviewerProfile?.acceptingRequests === false) {
    throw new AppError('VALIDATION_FAILED', 'That reviewer is not taking requests right now')
  }

  const open = await ReviewModel.exists({
    resume: input.resumeId,
    reviewer: input.reviewerId,
    status: trusted({ $in: ['requested', 'active'] }),
  })
  if (open)
    throw new AppError('VALIDATION_FAILED', 'You already have an open request with this reviewer')

  const review = await ReviewModel.create({
    resume: input.resumeId,
    owner: principal.id,
    reviewer: input.reviewerId,
    message: input.message ?? '',
    participants: [{ user: principal.id }, { user: input.reviewerId }],
  })

  await notify({
    user: input.reviewerId,
    type: 'review_requested',
    actor: principal.id,
    entity: { kind: 'review', id: review.id },
    preview: resume.title,
  })
  logActivity({
    actor: principal.id,
    action: 'review.request',
    targetType: 'review',
    targetId: review.id,
    ip,
  })

  return getOne(review.id, principal)
}

export async function respond(reviewId: string, principal: Principal, accept: boolean, ip = '') {
  const review = await loadForParty(reviewId, principal)
  if (roleIn(review, principal.id) !== 'reviewer') {
    throw new AppError('FORBIDDEN_ROLE', 'Only the assigned reviewer can respond')
  }
  if (review.status !== 'requested') {
    throw new AppError('VALIDATION_FAILED', 'This request has already been answered')
  }

  review.status = accept ? 'active' : 'declined'
  review.respondedAt = new Date()
  await review.save()

  const resume = await ResumeModel.findById(review.resume).select('title status')
  if (accept && resume) {
    resume.status = 'in_review'
    await resume.save()
  }

  await notify({
    user: String(review.owner),
    type: accept ? 'review_accepted' : 'review_declined',
    actor: principal.id,
    entity: { kind: 'review', id: review.id },
    preview: resume?.title ?? '',
  })
  logActivity({
    actor: principal.id,
    action: accept ? 'review.accept' : 'review.decline',
    targetType: 'review',
    targetId: review.id,
    ip,
  })

  return getOne(review.id, principal)
}

/** FR 7.6: the reviewer closes the review and the owner sees the resume as reviewed. */
export async function complete(reviewId: string, principal: Principal, summary = '', ip = '') {
  const review = await loadForParty(reviewId, principal)
  if (roleIn(review, principal.id) !== 'reviewer') {
    throw new AppError('FORBIDDEN_ROLE', 'Only the reviewer can mark a review as completed')
  }
  if (review.status !== 'active') {
    throw new AppError('VALIDATION_FAILED', 'Only an active review can be completed')
  }

  review.status = 'completed'
  review.summary = summary.trim().slice(0, 1000)
  review.completedAt = new Date()
  await review.save()

  await ResumeModel.updateOne({ _id: review.resume }, { $set: { status: 'reviewed' } })

  const event = {
    reviewId: review.id,
    by: principal.id,
    at: review.completedAt.toISOString(),
    summary: review.summary,
  }
  emitToRoom(`review:${review.id}`, 'review:completed', event)
  emitToRoom(`resume:${String(review.resume)}`, 'review:completed', event)

  await notify({
    user: String(review.owner),
    type: 'review_completed',
    actor: principal.id,
    entity: { kind: 'review', id: review.id },
    preview: review.summary || 'Your review is complete',
  })
  logActivity({
    actor: principal.id,
    action: 'review.complete',
    targetType: 'review',
    targetId: review.id,
    ip,
  })

  return getOne(review.id, principal)
}

/** The owner has acted on the feedback and asks the same reviewer to look again. */
export async function resubmit(reviewId: string, principal: Principal, note = '', ip = '') {
  const review = await loadForParty(reviewId, principal)
  if (roleIn(review, principal.id) !== 'owner') {
    throw new AppError('FORBIDDEN_ROLE', 'Only the owner can send the resume back for review')
  }
  if (review.status !== 'active') {
    throw new AppError('VALIDATION_FAILED', 'Only a review in progress can be sent back')
  }

  review.round = (review.round ?? 1) + 1
  review.resubmittedAt = new Date()
  await review.save()

  // the note lands in the chat, so the conversation reads in order with the rest of the review
  const body = note.trim() || 'I have made the changes. Could you take another look?'
  const message = await createMessage(review, principal.id, randomUUID(), body)
  emitToRoom(`review:${review.id}`, 'chat:message', { message })
  emitToRoom(`review:${review.id}`, 'review:resubmitted', {
    reviewId: review.id,
    round: review.round,
    at: review.resubmittedAt.toISOString(),
  })

  const resume = await ResumeModel.findById(review.resume).select('title')
  await notify({
    user: String(review.reviewer),
    type: 'review_resubmitted',
    actor: principal.id,
    entity: { kind: 'review', id: review.id },
    preview: resume?.title ?? '',
  })
  logActivity({
    actor: principal.id,
    action: 'review.resubmit',
    targetType: 'review',
    targetId: review.id,
    meta: { round: review.round },
    ip,
  })

  return getOne(review.id, principal)
}

/** The owner's verdict on a finished review; it is what the reviewer directory averages. */
export async function rate(
  reviewId: string,
  principal: Principal,
  rating: number,
  note = '',
  ip = ''
) {
  const review = await loadForParty(reviewId, principal)
  if (roleIn(review, principal.id) !== 'owner') {
    throw new AppError('FORBIDDEN_ROLE', 'Only the owner can rate a review')
  }
  if (review.status !== 'completed') {
    throw new AppError('VALIDATION_FAILED', 'A review can be rated once it is completed')
  }

  const first = review.rating == null
  review.rating = rating
  review.ratingNote = note.trim().slice(0, 500)
  review.ratedAt = new Date()
  await review.save()

  // a changed mind is recorded quietly; only the first rating is news to the reviewer
  if (first) {
    await notify({
      user: String(review.reviewer),
      type: 'review_rated',
      actor: principal.id,
      entity: { kind: 'review', id: review.id },
      preview: `${rating} out of 5`,
    })
  }
  logActivity({
    actor: principal.id,
    action: 'review.rate',
    targetType: 'review',
    targetId: review.id,
    meta: { rating },
    ip,
  })

  return getOne(review.id, principal)
}

type StoredSection = ResumeSection & { _id?: unknown }

/** What the reviewer reads: the document without private notes or anything hidden. */
export async function resumeForReview(
  reviewId: string,
  principal: Principal
): Promise<PublicResume> {
  denyAdmin(principal)
  const resume = await readResumeForReview(reviewId, principal)
  const plain = resume.toObject() as unknown as {
    title: string
    templateKey: string
    resumeType: PublicResume['resumeType']
    personal: ResumePersonal
    sections: StoredSection[]
    design: ResumeDesign
    updatedAt: Date
  }
  return {
    title: plain.title,
    templateKey: plain.templateKey,
    resumeType: plain.resumeType,
    personal: plain.personal,
    sections: (plain.sections ?? [])
      .filter((section) => !section.hidden)
      .map((section) => ({
        ...section,
        entries: section.entries.filter((entry) => !entry.hidden),
      })),
    design: plain.design,
    updatedAt: plain.updatedAt.toISOString(),
  }
}

export async function comments(reviewId: string, principal: Principal): Promise<ReviewComment[]> {
  const review = await loadForParty(reviewId, principal)
  if (!isOpenRoom(review)) return []
  const docs = await CommentModel.find({ review: review._id }).sort({ createdAt: 1 })
  const byId = await names(docs.map((doc) => String(doc.author)))
  return docs.map((doc) => serializeComment(doc, byId.get(String(doc.author)) ?? 'Someone'))
}

/** Cursor pagination on _id, never skip, so a page cannot shift while messages arrive. */
export async function history(reviewId: string, before?: string, limit = PAGE) {
  const filter: Record<string, unknown> = { review: reviewId }
  if (before && Types.ObjectId.isValid(before))
    filter._id = trusted({ $lt: new Types.ObjectId(before) })

  const docs = await MessageModel.find(filter)
    .sort({ _id: -1 })
    .limit(limit + 1)
  const hasMore = docs.length > limit
  const page = docs.slice(0, limit).reverse()
  const byId = await names(page.map((doc) => String(doc.sender)))

  return {
    messages: page.map((doc) => serializeMessage(doc, byId.get(String(doc.sender)) ?? 'Someone')),
    nextCursor: hasMore ? (page[0]?.id ?? null) : null,
  }
}

export async function messages(reviewId: string, principal: Principal, before?: string) {
  const review = await loadForParty(reviewId, principal)
  if (!isOpenRoom(review)) return { messages: [], nextCursor: null }
  return history(review.id, before)
}

// ---------------------------------------------------------------- writes used by the socket

/** Persists a message; a retry with the same clientId returns the stored one, never a duplicate. */
export async function createMessage(
  review: ReviewDoc,
  senderId: string,
  clientId: string,
  body: string
) {
  let doc: MessageDoc
  try {
    doc = await MessageModel.create({ review: review._id, sender: senderId, clientId, body })
  } catch (error) {
    if ((error as { code?: number }).code !== 11000) throw error
    const existing = await MessageModel.findOne({ review: review._id, clientId })
    if (!existing) throw error
    doc = existing
  }

  await ReviewModel.updateOne({ _id: review._id }, { $set: { updatedAt: new Date() } })
  const sender = await UserModel.findById(senderId).select('name').lean()
  return serializeMessage(doc, sender?.name ?? 'Someone')
}

export interface CommentInput {
  sectionKey: string
  entryId?: string | null
  fieldPath?: string | null
  anchorText?: string
  body: string
  clientId: string
}

export async function createComment(review: ReviewDoc, authorId: string, input: CommentInput) {
  let doc: CommentDoc
  try {
    doc = await CommentModel.create({
      review: review._id,
      resume: review.resume,
      author: authorId,
      sectionKey: input.sectionKey,
      entryId: input.entryId ?? null,
      fieldPath: input.fieldPath ?? null,
      anchorText: input.anchorText ?? '',
      body: input.body,
      clientId: input.clientId,
    })
  } catch (error) {
    if ((error as { code?: number }).code !== 11000) throw error
    const existing = await CommentModel.findOne({ review: review._id, clientId: input.clientId })
    if (!existing) throw error
    doc = existing
  }
  const author = await UserModel.findById(authorId).select('name').lean()
  return serializeComment(doc, author?.name ?? 'Someone')
}

export async function findComment(commentId: string, principal: Principal) {
  if (!Types.ObjectId.isValid(commentId)) throw notFound('Comment')
  const comment = await CommentModel.findById(commentId)
  if (!comment) throw notFound('Comment')
  const review = await loadForParty(String(comment.review), principal)
  return { comment, review }
}

export { counterpart }
