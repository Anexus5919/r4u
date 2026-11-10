import type { Request, Response } from 'express'
import { AppError } from '../../lib/AppError.js'
import { profileUser } from '../../lib/serializers.js'
import * as service from './users.service.js'
import type { ProfilePatch } from './users.service.js'

function principalId(req: Request): string {
  const id = req.principal.id
  if (!id) throw new AppError('TOKEN_MISSING', 'Sign in to continue')
  return id
}

export async function getMe(req: Request, res: Response) {
  const user = await service.getProfile(principalId(req))
  res.json({ data: { user: profileUser(user) } })
}

export async function updateMe(req: Request, res: Response) {
  const patch = req.validated as ProfilePatch
  const user = await service.updateProfile(principalId(req), patch)
  res.json({ data: { user: profileUser(user) } })
}

export async function changePassword(req: Request, res: Response) {
  const { currentPassword, password } = req.validated as {
    currentPassword: string
    password: string
  }

  await service.changePassword(principalId(req), currentPassword, password)

  // 204 with no session: every session just ended, so the client signs in again
  res.status(204).end()
}

export async function uploadAvatar(req: Request, res: Response) {
  if (!req.file) throw new AppError('VALIDATION_FAILED', 'Choose an image to upload')

  const user = await service.setAvatar(principalId(req), req.file.buffer)
  res.json({ data: { user: profileUser(user) } })
}

export async function deleteMe(req: Request, res: Response) {
  await service.deleteAccount(principalId(req))
  res.status(204).end()
}
