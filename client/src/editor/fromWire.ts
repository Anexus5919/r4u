import type { ResumeDetail } from '@r4u/shared'
import type { EditorResume, EditorSection } from './types'

/*
  The wire type carries optional ids because the same schema describes a resume being created.
  By the time one reaches the editor the server has assigned them all, so this narrows once at
  the boundary rather than forcing a null check on every line of the editor.
*/
export function fromWire(resume: ResumeDetail): EditorResume {
  /*
    Field by field rather than a spread over defaults. A spread would let an explicit
    `fullName: undefined` from the wire wipe the default it was meant to fall back to.
  */
  const personal = resume.personal ?? {}

  return {
    id: resume.id,
    title: resume.title,
    status: resume.status,
    resumeType: resume.resumeType,
    templateKey: resume.templateKey,
    version: resume.version,
    notes: resume.notes ?? '',
    personal: {
      fullName: personal.fullName ?? '',
      headline: personal.headline ?? '',
      email: personal.email ?? '',
      phone: personal.phone ?? '',
      location: personal.location ?? '',
      links: personal.links ?? [],
    },
    design: resume.design,
    sections: (resume.sections ?? []).map((section): EditorSection => ({
      _id: String(section._id),
      type: section.type,
      title: section.title,
      hidden: Boolean(section.hidden),
      locked: Boolean(section.locked),
      keepTogether: Boolean(section.keepTogether),
      startOnNewPage: Boolean(section.startOnNewPage),
      entries: (section.entries ?? []).map((entry) => ({
        _id: String(entry._id),
        hidden: Boolean(entry.hidden),
        data: (entry.data ?? {}) as Record<string, unknown>,
      })),
    })),
  }
}
