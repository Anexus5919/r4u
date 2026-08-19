import type { Request, Response } from 'express'
import type { ResumeOp, ResumeType } from '@r4u/shared'
import { AppError } from '../../lib/AppError.js'
import { resumeDetail, resumeSummary } from '../../lib/serializers.js'
import { VersionConflict, applyOps } from './resumes.autosave.js'
import * as service from './resumes.service.js'
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

export async function remove(req: Request, res: Response) {
  const { id } = req.validated as { id: string }
  await service.remove(id, principal(req).id)

  res.status(204).end()
}
