import type { Request, Response } from 'express'
import { fromJsonResume, toJsonResume } from '@r4u/shared'
import type { ResumeOp, ResumeType } from '@r4u/shared'
import { AppError } from '../../lib/AppError.js'
import { resumeDetail, resumeSummary } from '../../lib/serializers.js'
import { ResumeModel } from '../../models/index.js'
import { VersionConflict, applyOps } from './resumes.autosave.js'
import * as service from './resumes.service.js'
import * as versionService from './resumes.versions.js'
import type { Principal } from './resumes.access.js'

function principal(req: Request): Principal {
  const id = req.principal.id
  if (!id) throw new AppError('TOKEN_MISSING', 'Sign in to continue')
  return { id, role: req.principal.role }
}

export async function list(req: Request, res: Response) {
  const input = req.validated as {
    q?: string
    status?: 'draft' | 'in_review' | 'reviewed'
    sort?: 'updated' | 'created' | 'title'
    page?: number
    limit?: number
  }

  const { items, meta } = await service.list(principal(req).id, {
    ...input,
    page: input.page ?? 1,
    limit: input.limit ?? 20,
  })

  res.json({ data: { resumes: items.map(resumeSummary) }, meta })
}

export async function create(req: Request, res: Response) {
  const input = req.validated as { title: string; resumeType?: ResumeType; templateKey?: string }

  const resume = await service.create(principal(req).id, {
    ...input,
    resumeType: input.resumeType ?? 'professional',
  })

  res.status(201).json({ data: { resume: resumeDetail(resume) } })
}

export async function read(req: Request, res: Response) {
  const { id } = req.validated as { id: string }
  const resume = await service.read(id, principal(req))

  res.json({ data: { resume: resumeDetail(resume) } })
}

/*
  Autosave. The version in the body is the client's view of the document, and a mismatch is a
  409 carrying the current state so the client can rebase rather than being told to reload and
  lose its work.
*/
export async function autosave(req: Request, res: Response) {
  const { id, version, ops } = req.validated as {
    id: string
    version: number
    ops: ResumeOp[]
  }

  try {
    const result = await applyOps(id, principal(req), version, ops)
    res.json({ data: { version: result.version, meta: result.meta } })
  } catch (error) {
    if (error instanceof VersionConflict) {
      res.status(409).json({
        error: { code: 'VERSION_CONFLICT', message: error.message },
        data: { resume: resumeDetail(error.current) },
      })
      return
    }
    throw error
  }
}

export async function rename(req: Request, res: Response) {
  const { id, title } = req.validated as { id: string; title: string }
  const resume = await service.rename(id, principal(req).id, title)

  res.json({ data: { resume: resumeSummary(resume) } })
}

export async function duplicate(req: Request, res: Response) {
  const { id, title } = req.validated as { id: string; title?: string }
  const resume = await service.duplicate(id, principal(req), title)

  res.status(201).json({ data: { resume: resumeDetail(resume) } })
}

/* ---------------------------------------------------------------- version history */

export async function listVersions(req: Request, res: Response) {
  const { id } = req.validated as { id: string }
  const versions = await versionService.listVersions(id, principal(req))

  res.json({
    data: {
      versions: versions.map((version) => ({
        id: version.id,
        label: version.label,
        trigger: version.trigger,
        createdAt: version.createdAt.toISOString(),
      })),
    },
  })
}

export async function createVersion(req: Request, res: Response) {
  const { id, label } = req.validated as { id: string; label?: string }
  const version = await versionService.snapshot(id, principal(req), 'manual', label)

  res.status(201).json({ data: { version: { id: version.id, label: version.label } } })
}

export async function restoreVersion(req: Request, res: Response) {
  const { id, versionId } = req.validated as { id: string; versionId: string }
  const resume = await versionService.restoreVersion(id, versionId, principal(req))

  res.json({ data: { resume: resumeDetail(resume) } })
}

/* ---------------------------------------------------------------- interchange */

export async function exportJson(req: Request, res: Response) {
  const { id } = req.validated as { id: string }
  const resume = await service.read(id, principal(req))

  const filename = resume.title.replace(/[^a-z0-9]+/gi, '-').toLowerCase() || 'resume'
  res.setHeader('Content-Disposition', `attachment; filename="${filename}.json"`)

  // the interchange document itself, not wrapped in the API envelope: it is a file
  res.json(toJsonResume(resume.toObject() as never))
}

/*
  Import creates a new resume rather than overwriting one. An import that silently replaces what
  is already there is a second way to lose work, and the user has no way back from it.
*/
export async function importJson(req: Request, res: Response) {
  const { title, document } = req.validated as { title?: string; document: Record<string, unknown> }
  const owner = principal(req)

  const { personal, sections, skipped } = fromJsonResume(document)

  const resume = await service.create(owner.id, {
    title: title ?? String(personal.fullName || 'Imported resume'),
    resumeType: 'professional',
  })

  await ResumeModel.updateOne(
    { _id: resume._id, owner: owner.id },
    { $set: { personal, sections }, $inc: { version: 1 } }
  )

  // written straight to the document, so the denormalised summary has to be brought up to date
  await service.refreshMeta(resume.id, owner)
  await versionService.snapshot(resume.id, owner, 'import')

  const saved = await service.read(resume.id, owner)
  res.status(201).json({ data: { resume: resumeDetail(saved), skipped } })
}

export async function remove(req: Request, res: Response) {
  const { id } = req.validated as { id: string }
  await service.remove(id, principal(req).id)

  res.status(204).end()
}
