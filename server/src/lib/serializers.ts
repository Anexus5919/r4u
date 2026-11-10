import { env } from '../config/env.js'
import type { ProfileUser, PublicUser, ResumeDetail, ResumeSummary } from '@r4u/shared'
import type { UserDoc } from '../models/User.js'
import type { ResumeDoc } from '../models/Resume.js'

// built from public id and version, so the URL never rots and caches forever
function avatarUrl(avatar?: { publicId?: string; version?: number } | null): string | null {
  if (!avatar?.publicId || !env.CLOUDINARY_CLOUD_NAME) return null
  const version = avatar.version ? `v${avatar.version}/` : ''
  return `https://res.cloudinary.com/${env.CLOUDINARY_CLOUD_NAME}/image/upload/${version}${avatar.publicId}`
}

// the only place a user becomes a response: unlisted fields never leave
export function publicUser(user: UserDoc): PublicUser {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    status: user.status,
    headline: user.headline,
    theme: user.theme,
    avatarUrl: avatarUrl(user.avatar),
  }
}

/** Only ever returned to the account holder, from GET and PATCH /users/me. */
export function profileUser(user: UserDoc): ProfileUser {
  return { ...publicUser(user), phone: user.phone, location: user.location }
}

// summary has no content field; detail only via readResumeContent(). see ADR-008
export function resumeSummary(resume: ResumeDoc): ResumeSummary {
  return {
    id: resume.id,
    title: resume.title,
    status: resume.status,
    resumeType: resume.resumeType,
    templateKey: resume.templateKey,
    meta: {
      completeness: resume.meta?.completeness ?? 0,
      wordCount: resume.meta?.wordCount ?? 0,
      sectionCount: resume.meta?.sectionCount ?? 0,
      pageCount: resume.meta?.pageCount ?? 1,
      atsScore: resume.meta?.atsScore ?? 0,
    },
    createdAt: resume.createdAt.toISOString(),
    updatedAt: resume.updatedAt.toISOString(),
  }
}

export function resumeDetail(resume: ResumeDoc): ResumeDetail {
  return {
    ...resumeSummary(resume),
    personal: (resume.personal ?? {}) as ResumeDetail['personal'],
    sections: (resume.sections ?? []) as unknown as ResumeDetail['sections'],
    design: resume.design as unknown as ResumeDetail['design'],
    notes: resume.notes ?? '',
    version: resume.version,
  }
}
