import { Schema, model } from 'mongoose'
import type { InferSchemaType, HydratedDocument } from 'mongoose'
import { AUTHENTICATED_ROLES, USER_STATUSES, THEMES } from '@r4u/shared'

const reviewerProfileSchema = new Schema(
  {
    bio: { type: String, maxlength: 400, default: '' },
    expertise: { type: [String], default: [] },
    acceptingRequests: { type: Boolean, default: true },
    openSlots: { type: Number, min: 0, max: 20, default: 3 },
  },
  { _id: false }
)

const userSchema = new Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 80 },

    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      maxlength: 254,
    },

    /*
      select: false means every query omits it unless explicitly asked for. A password hash must
      never reach a response by accident, and this makes the safe path the default one.
    */
    passwordHash: { type: String, required: true, select: false },

    role: { type: String, enum: AUTHENTICATED_ROLES, default: 'user', index: true },
    status: { type: String, enum: USER_STATUSES, default: 'active', index: true },

    /*
      Carried in the access token as `tv`. Bumping it invalidates every token already issued,
      which is what makes blocking an account and resetting a password take effect immediately
      rather than at the next 15 minute expiry.
    */
    tokenVersion: { type: Number, default: 0 },

    headline: { type: String, maxlength: 80, default: '' },
    phone: { type: String, maxlength: 32, default: '' },
    location: { type: String, maxlength: 60, default: '' },

    avatar: {
      publicId: { type: String, default: '' },
      version: { type: Number, default: 0 },
    },

    theme: { type: String, enum: THEMES, default: 'system' },

    lastSeenAt: { type: Date },

    /*
      express-rate-limit keeps its counters in memory, which a free-tier restart wipes and an
      attacker's brute-force budget along with it. These two survive.
    */
    failedLoginCount: { type: Number, default: 0 },
    lockUntil: { type: Date },

    reviewerProfile: { type: reviewerProfileSchema, default: undefined },
  },
  {
    timestamps: true,
    toJSON: {
      virtuals: true,
      transform(_doc, ret: Record<string, unknown>) {
        delete ret.passwordHash
        delete ret.__v
        delete ret.failedLoginCount
        delete ret.lockUntil
        delete ret.tokenVersion
        return ret
      },
    },
  }
)

userSchema.index({ role: 1, status: 1 })

userSchema.virtual('isLocked').get(function () {
  return Boolean(this.lockUntil && this.lockUntil.getTime() > Date.now())
})

export type User = InferSchemaType<typeof userSchema>
export type UserDoc = HydratedDocument<User> & { isLocked: boolean }

export const UserModel = model('User', userSchema)
