import { randomUUID } from 'node:crypto'
import { SAMPLE_RESUME, computeMeta } from '@r4u/shared'
import type { Resume as ResumeShape } from '@r4u/shared'
import { env, isProduction } from '../config/env.js'
import { hashPassword } from '../lib/password.js'
import {
  ActivityLogModel,
  CommentModel,
  MessageModel,
  NotificationModel,
  ResumeModel,
  ReviewModel,
  ShareDailyModel,
  ShareLinkModel,
  UserModel,
} from '../models/index.js'
import * as resumes from '../modules/resumes/resumes.service.js'
import { createLink } from '../modules/share/share.service.js'
import { syncTemplates } from '../modules/templates/templates.service.js'

// the documented demo password; production must supply SEED_PASSWORD instead
export const DEMO_PASSWORD = 'R4uDemo-2026!'

export const DEMO_ACCOUNTS = {
  admin: { name: 'Platform Admin', email: 'admin@r4u.dev', role: 'admin' as const },
  reviewer: { name: 'Neha Verma', email: 'reviewer@r4u.dev', role: 'reviewer' as const },
  reviewer2: { name: 'Kavya Iyer', email: 'kavya@r4u.dev', role: 'reviewer' as const },
  user: { name: 'Aman Sharma', email: 'user@r4u.dev', role: 'user' as const },
  user2: { name: 'Divya Rao', email: 'divya@r4u.dev', role: 'user' as const },
  blocked: { name: 'Rahul Nair', email: 'rahul@r4u.dev', role: 'user' as const },
}

export interface SeedResult {
  seeded: boolean
  templates: number
  shareUrl?: string
}

function seedPassword() {
  if (env.SEED_PASSWORD) return env.SEED_PASSWORD
  if (isProduction) throw new Error('Set SEED_PASSWORD before seeding a production database')
  return DEMO_PASSWORD
}

async function sampleResume(ownerId: string, title: string, fullName: string, email: string) {
  const sample = SAMPLE_RESUME
  const doc = await ResumeModel.create({
    owner: ownerId,
    title,
    resumeType: sample.resumeType,
    templateKey: sample.templateKey,
    design: sample.design,
    personal: { ...sample.personal, fullName, email },
    sections: sample.sections,
    notes: 'Mention the Kafka migration if they ask about scale.',
  })
  const meta = computeMeta(doc.toObject() as unknown as ResumeShape)
  await ResumeModel.updateOne({ _id: doc._id }, { $set: { meta: { ...doc.meta, ...meta } } })
  return doc
}

/** Idempotent: does nothing beyond syncing templates once the admin account exists. */
export async function seedDemo(): Promise<SeedResult> {
  const templates = await syncTemplates()

  if (await UserModel.exists({ email: DEMO_ACCOUNTS.admin.email })) {
    return { seeded: false, templates }
  }

  const passwordHash = await hashPassword(seedPassword())
  const make = (account: (typeof DEMO_ACCOUNTS)[keyof typeof DEMO_ACCOUNTS], extra = {}) =>
    UserModel.create({ ...account, passwordHash, ...extra })

  await make(DEMO_ACCOUNTS.admin)
  const neha = await make(DEMO_ACCOUNTS.reviewer, {
    headline: 'Engineering manager, 9 years hiring backend teams',
    reviewerProfile: {
      bio: 'I read a few hundred engineering resumes a year. I focus on impact and clarity.',
      expertise: ['Backend', 'Platform', 'Hiring'],
      acceptingRequests: true,
      openSlots: 4,
    },
  })
  const kavya = await make(DEMO_ACCOUNTS.reviewer2, {
    headline: 'Placement mentor for final year students',
    reviewerProfile: {
      bio: 'Fresher and internship resumes, campus drives and first applications.',
      expertise: ['Freshers', 'Internships', 'Data'],
      acceptingRequests: true,
      openSlots: 6,
    },
  })
  const aman = await make(DEMO_ACCOUNTS.user, { headline: 'Backend developer' })
  const divya = await make(DEMO_ACCOUNTS.user2, { headline: 'Data analyst' })
  await make(DEMO_ACCOUNTS.blocked, { status: 'blocked' })

  // Aman: a complete sample, a fresher draft and a second complete resume
  const backend = await sampleResume(aman.id, 'Backend Developer CV', aman.name, aman.email)
  const internship = await resumes.create(aman.id, {
    title: 'Internship Resume',
    resumeType: 'fresher',
    templateKey: 'quire',
  })
  await sampleResume(aman.id, 'Platform Engineer CV', aman.name, aman.email)
  const divyaResume = await sampleResume(divya.id, 'Data Analyst CV', divya.name, divya.email)

  // an active review with history, so the room is never empty on first open
  const active = await ReviewModel.create({
    resume: backend._id,
    owner: aman._id,
    reviewer: neha._id,
    status: 'active',
    message: 'Could you check my experience bullets before the campus drive next week?',
    participants: [{ user: aman._id }, { user: neha._id }],
    respondedAt: new Date(),
  })
  await ResumeModel.updateOne({ _id: backend._id }, { $set: { status: 'in_review' } })

  const chat = [
    [neha, 'Thanks for sharing. The summary is strong; I have left two comments on the page.'],
    [aman, 'Thank you. Should the Kafka migration go into the first role?'],
    [neha, 'Yes, as one quantified bullet. Lead with the outcome, then the method.'],
    [aman, 'Updated it now. Does the skills section read better?'],
  ] as const
  for (const [sender, body] of chat) {
    await MessageModel.create({
      review: active._id,
      sender: sender._id,
      body,
      clientId: randomUUID(),
    })
  }

  await CommentModel.create([
    {
      review: active._id,
      resume: backend._id,
      author: neha._id,
      sectionKey: 'summary',
      anchorText: 'Summary',
      body: 'Strong opening. Cut the second sentence to keep it under four lines.',
      clientId: randomUUID(),
    },
    {
      review: active._id,
      resume: backend._id,
      author: neha._id,
      sectionKey: 'experience',
      anchorText: 'Work Experience',
      body: 'Put the 41 percent latency result first; it is your best number.',
      clientId: randomUUID(),
    },
  ])

  // a request waiting on a reviewer, and a finished review that set its resume to reviewed
  const pending = await ReviewModel.create({
    resume: internship._id,
    owner: aman._id,
    reviewer: kavya._id,
    status: 'requested',
    message: 'First internship application, would love a quick look.',
    participants: [{ user: aman._id }, { user: kavya._id }],
  })

  const completed = await ReviewModel.create({
    resume: divyaResume._id,
    owner: divya._id,
    reviewer: neha._id,
    status: 'completed',
    message: 'Applying for analyst roles next month.',
    summary: 'Clear and well quantified. Move SQL to the top of the skills list.',
    participants: [{ user: divya._id }, { user: neha._id }],
    respondedAt: new Date(),
    completedAt: new Date(),
  })
  await ResumeModel.updateOne({ _id: divyaResume._id }, { $set: { status: 'reviewed' } })

  await NotificationModel.create([
    {
      user: kavya._id,
      type: 'review_requested',
      actor: aman._id,
      entity: { kind: 'review', id: pending._id },
      preview: 'Internship Resume',
    },
    {
      user: aman._id,
      type: 'review_accepted',
      actor: neha._id,
      entity: { kind: 'review', id: active._id },
      preview: 'Backend Developer CV',
      readAt: new Date(),
    },
    {
      user: aman._id,
      type: 'comment',
      actor: neha._id,
      entity: { kind: 'review', id: active._id },
      preview: 'Put the 41 percent latency result first; it is your best number.',
    },
    {
      user: divya._id,
      type: 'review_completed',
      actor: neha._id,
      entity: { kind: 'review', id: completed._id },
      preview: 'Clear and well quantified.',
    },
  ])

  // a live share link with a fortnight of history, so the analytics have something to draw
  const created = await createLink(backend.id, aman.id, {})
  const linkId = created.link.id
  let views = 0
  let downloads = 0
  for (let offset = 13; offset >= 0; offset--) {
    const date = new Date(Date.now() - offset * 86_400_000).toISOString().slice(0, 10)
    const day = { views: (offset * 7) % 5, downloads: offset % 4 === 0 ? 1 : 0 }
    views += day.views
    downloads += day.downloads
    await ShareDailyModel.create({ shareLink: linkId, date, ...day })
  }
  await ShareLinkModel.updateOne(
    { _id: linkId },
    { $set: { views, downloads, lastViewedAt: new Date() } }
  )

  await ActivityLogModel.create([
    { actor: aman._id, action: 'auth.register', targetType: 'user', targetId: aman._id },
    { actor: aman._id, action: 'resume.create', targetType: 'resume', targetId: backend._id },
    { actor: aman._id, action: 'review.request', targetType: 'review', targetId: active._id },
    { actor: neha._id, action: 'review.accept', targetType: 'review', targetId: active._id },
    { actor: neha._id, action: 'review.complete', targetType: 'review', targetId: completed._id },
  ])

  return { seeded: true, templates, shareUrl: created.url }
}
