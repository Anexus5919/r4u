import { Schema, Types, model } from 'mongoose'
import type { InferSchemaType } from 'mongoose'

// opaque random string, stored only as SHA-256 so a backup leaks no sessions
const refreshTokenSchema = new Schema(
  {
    user: { type: Types.ObjectId, ref: 'User', required: true, index: true },
    tokenHash: { type: String, required: true, unique: true },

    // replaying a consumed token signals theft, so the whole family is revoked
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
