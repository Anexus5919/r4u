import { Schema, Types, model } from 'mongoose'
import type { InferSchemaType } from 'mongoose'

const passwordResetTokenSchema = new Schema(
  {
    user: { type: Types.ObjectId, ref: 'User', required: true, index: true },
    tokenHash: { type: String, required: true, unique: true },
    usedAt: { type: Date },
    expiresAt: { type: Date, required: true },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
)

passwordResetTokenSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 })

export type PasswordResetToken = InferSchemaType<typeof passwordResetTokenSchema>
export const PasswordResetTokenModel = model('PasswordResetToken', passwordResetTokenSchema)
