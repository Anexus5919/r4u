import { trusted } from 'mongoose'
import { notFound } from '../../lib/AppError.js'
import { ResumeModel, ResumeVersionModel } from '../../models/index.js'
import { readResumeContent } from './resumes.access.js'
import type { Principal } from './resumes.access.js'
import type { VersionTrigger } from '../../models/ResumeVersion.js'

/*
  Version history. Snapshots at milestones, and a restore that goes through the normal write path
  so the restore itself becomes a version and nothing is ever actually lost.

  This is the direct answer to the problem the project opened with: a folder of files called
  resume_final_v3 that nobody can tell apart.
*/

const KEEP = 30

const LABELS: Record<VersionTrigger, string> = {
  manual: 'Saved by you',
  template: 'Template changed',
  import: 'Imported',
  restore: 'Restored from history',
  daily: 'First edit of the day',
}

function snapshotOf(resume: Awaited<ReturnType<typeof readResumeContent>>) {
  const plain = resume.toObject() as Record<string, unknown>

  return {
    title: plain.title,
    resumeType: plain.resumeType,
    templateKey: plain.templateKey,
    design: plain.design,
    personal: plain.personal,
    sections: plain.sections,
    notes: plain.notes,
  }
}

export async function snapshot(
  resumeId: string,
  principal: Principal,
  trigger: VersionTrigger,
  label?: string
) {
  const resume = await readResumeContent(resumeId, principal)

  const version = await ResumeVersionModel.create({
    resume: resume._id,
    owner: principal.id,
    data: snapshotOf(resume),
    trigger,
    label: label ?? LABELS[trigger],
    at: resume.version,
  })

  /*
    Trimmed rather than kept forever. Atlas M0 gives 0.5 GB including indexes, and a resume with
    three hundred snapshots is a storage problem long before it is a useful history.
  */
  const stale = await ResumeVersionModel.find({ resume: resume._id })
    .sort({ createdAt: -1 })
    .skip(KEEP)
    .select('_id')

  if (stale.length) {
    await ResumeVersionModel.deleteMany({ _id: trusted({ $in: stale.map((s) => s._id) }) })
  }

  return version
}

/*
  One snapshot per calendar day, taken on the first edit. Enough to answer "what did this look
  like yesterday" without a snapshot per keystroke.
*/
export async function snapshotDaily(resumeId: string, principal: Principal) {
  const since = new Date()
  since.setHours(0, 0, 0, 0)

  const existing = await ResumeVersionModel.countDocuments({
    resume: resumeId,
    createdAt: trusted({ $gte: since }),
  })

  if (existing > 0) return null
  return snapshot(resumeId, principal, 'daily')
}

export async function listVersions(resumeId: string, principal: Principal) {
  // proves ownership, and refuses admin, before any history is returned
  await readResumeContent(resumeId, principal)

  return ResumeVersionModel.find({ resume: resumeId })
    .sort({ createdAt: -1 })
    .select('-data')
    .limit(KEEP)
}

/*
  Restore writes through the normal update path and takes a snapshot of the current state first,
  so the restore is itself undoable. A restore that discards what it replaced is a second way to
  lose work, which is the opposite of what history is for.
*/
export async function restoreVersion(resumeId: string, versionId: string, principal: Principal) {
  const current = await readResumeContent(resumeId, principal)

  const version = await ResumeVersionModel.findOne({ _id: versionId, resume: resumeId })
  if (!version) throw notFound('Version')

  await snapshot(resumeId, principal, 'restore', 'Before restoring')

  const data = version.data as Record<string, unknown>

  await ResumeModel.updateOne(
    { _id: resumeId, owner: principal.id },
    {
      $set: {
        title: data.title,
        resumeType: data.resumeType,
        templateKey: data.templateKey,
        design: data.design,
        personal: data.personal,
        sections: data.sections,
        notes: data.notes,
      },
      $inc: { version: 1 },
    }
  )

  void current
  return readResumeContent(resumeId, principal)
}
