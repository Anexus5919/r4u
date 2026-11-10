import type { ResumeDetail } from '@r4u/shared'
import type { EditorResume, EditorSection } from './types'

// the server has assigned every id by now, so narrow once at the boundary
export function fromWire(resume: ResumeDetail): EditorResume {
  // field by field: a spread would let an explicit undefined wipe the default
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
