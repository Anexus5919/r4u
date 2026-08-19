import { Schema, Types, model } from 'mongoose'
import type { InferSchemaType } from 'mongoose'

/*
  Opaque random string, not a JWT. It has to be checked against the database for revocation
  anyway, so JWT structure buys nothing and only leaks claims to anyone holding it.

  Only the SHA-256 is stored, exactly like a password. A leaked database backup must not hand
  over working sessions.
*/
const refreshTokenSchema = new Schema(
  {
    user: { type: Types.ObjectId, ref: 'User', required: true, index: true },
    tokenHash: { type: String, required: true, unique: true },

    /*
      Rotation family. If a token that was already consumed is presented again, that is the
      signature of a stolen token being replayed alongside the legitimate one, so the entire
      family is revoked rather than just that token.
    */
    family: { type: String, required: true, index: true },
    consumedAt: { type: Date },

    userAgent: { type: String, maxlength: 300, default: '' },
    ip: { type: String, maxlength: 64, default: '' },

    expiresAt: { type: Date, required: true },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
)

refreshTokenSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 })

export type RefreshToken = InferSchemaType<typeof refreshTokenSchema>
export const RefreshTokenModel = model('RefreshToken', refreshTokenSchema)
