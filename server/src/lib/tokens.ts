import { createHash, randomBytes, randomUUID } from 'node:crypto'
import jwt from 'jsonwebtoken'
import type { SignOptions } from 'jsonwebtoken'
import { env } from '../config/env.js'
import { AppError } from './AppError.js'
import type { AuthenticatedRole } from '@r4u/shared'

const ISSUER = 'r4u'
const AUDIENCE = 'r4u-web'

export interface AccessClaims {
  sub: string
  role: AuthenticatedRole
  /** token version, so blocking an account or resetting a password revokes immediately */
  tv: number
}

/*
  The payload carries an id, a role and a version. No email, no name.

  A JWT payload is base64, not encryption. Anyone holding the token reads every claim, and this
  product's users are identifiable people attached to a PII document.
*/
export function signAccessToken(claims: AccessClaims): string {
  const options: SignOptions = {
    issuer: ISSUER,
    audience: AUDIENCE,
    jwtid: randomUUID(),
    expiresIn: env.JWT_ACCESS_TTL as SignOptions['expiresIn'],
  }
  return jwt.sign(claims, env.JWT_ACCESS_SECRET, options)
}

export function verifyAccessToken(token: string): AccessClaims {
  try {
    const payload = jwt.verify(token, env.JWT_ACCESS_SECRET, {
      issuer: ISSUER,
      audience: AUDIENCE,
      // RFC 8725: verify issuer and audience, and allow a small amount of clock drift
      clockTolerance: 5,
    })
    return payload as unknown as AccessClaims
  } catch (error) {
    const name = (error as Error).name
    if (name === 'TokenExpiredError') throw new AppError('TOKEN_EXPIRED', 'Session expired')
    throw new AppError('TOKEN_INVALID', 'Invalid token')
  }
}

/*
  The refresh token is opaque, not a JWT. It must be checked against the database for revocation
  regardless, so JWT structure would add nothing and leak claims to whoever holds it.
*/
export interface RefreshTokenParts {
  token: string
  tokenHash: string
  family: string
}

export function createRefreshToken(family?: string): RefreshTokenParts {
  const token = randomBytes(32).toString('base64url')
  return { token, tokenHash: hashToken(token), family: family ?? randomUUID() }
}

/** Stored instead of the token itself, so a leaked backup hands over no working sessions. */
export function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex')
}

export function refreshExpiryDate(): Date {
  const days = Number.parseInt(env.JWT_REFRESH_TTL, 10) || 30
  return new Date(Date.now() + days * 24 * 60 * 60 * 1000)
}
