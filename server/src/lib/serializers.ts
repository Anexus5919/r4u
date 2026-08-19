import { env } from '../config/env.js'
import type { ProfileUser, PublicUser } from '@r4u/shared'
import type { UserDoc } from '../models/User.js'

/*
  Built from the stored public id and version rather than persisting a full URL. Cloudinary's
  host and delivery prefix are deployment details, and a stored URL would rot the moment either
  changes. The version segment is what makes the asset cacheable forever.
*/
function avatarUrl(avatar?: { publicId?: string; version?: number } | null): string | null {
  if (!avatar?.publicId || !env.CLOUDINARY_CLOUD_NAME) return null
  const version = avatar.version ? `v${avatar.version}/` : ''
  return `https://res.cloudinary.com/${env.CLOUDINARY_CLOUD_NAME}/image/upload/${version}${avatar.publicId}`
}

/*
  The single place a user becomes a response. If a field is not listed here it does not leave
  the server, which is why passwordHash, tokenVersion, failedLoginCount and lockUntil cannot
  reach a client even if a future route forgets to project them away.
*/
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
