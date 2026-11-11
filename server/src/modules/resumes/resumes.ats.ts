import type { Request, Response } from 'express'
import { body } from 'express-validator'
import { scoreResume } from '@r4u/shared'
import type { Resume } from '@r4u/shared'
import { principalOf } from '../../lib/principal.js'
import { AtsScoreModel } from '../../models/AtsScore.js'
import { ResumeModel } from '../../models/Resume.js'
import { readResumeContent } from './resumes.access.js'
import { resumeIdRule } from './resumes.validators.js'

const HISTORY = 10

export const atsRules = [
  resumeIdRule,
  // pasted only: R4U never fetches a posting from a URL (API.md section 7)
  body('jobDescription').optional().isString().isLength({ max: 20000 }),
  body('pageCount').optional().isInt({ min: 1, max: 20 }).toInt(),
]

export async function scoreForOwner(req: Request, res: Response) {
  const { id, jobDescription, pageCount } = req.validated as {
    id: string
    jobDescription?: string
    pageCount?: number
  }
  const principal = principalOf(req)
  const resume = await readResumeContent(id, principal)

  const result = scoreResume(resume.toObject() as unknown as Partial<Resume>, {
    jobDescription,
    pageCount,
  })

  await AtsScoreModel.create({
    resume: resume._id,
    owner: principal.id,
    rubricVersion: result.rubricVersion,
    total: result.total,
    mode: result.mode,
    dimensions: result.dimensions.map(({ id: dimension, earned, possible }) => ({
      id: dimension,
      earned,
      possible,
    })),
    checks: result.checks.map(({ checkId, status, earned, possible }) => ({
      checkId,
      status,
      earned,
      possible,
    })),
  })
  // a score is not an edit, so the resume keeps its updatedAt
  await ResumeModel.updateOne(
    { _id: resume._id },
    { $set: { 'meta.atsScore': result.total } },
    { timestamps: false }
  )

  res.json({ data: result })
}

export async function historyForOwner(req: Request, res: Response) {
  const { id } = req.validated as { id: string }
  const resume = await readResumeContent(id, principalOf(req))
  const scores = await AtsScoreModel.find({ resume: resume._id })
    .sort({ createdAt: -1 })
    .limit(HISTORY)
    .select('total mode rubricVersion createdAt')
    .lean()
  res.json({
    data: {
      history: scores.map((score) => ({
        total: score.total,
        mode: score.mode,
        rubricVersion: score.rubricVersion,
        at: (score as unknown as { createdAt: Date }).createdAt.toISOString(),
      })),
    },
  })
}
