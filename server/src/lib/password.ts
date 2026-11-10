import bcrypt from 'bcryptjs'
import { env } from '../config/env.js'

export { PASSWORD_MAX, PASSWORD_MIN } from '@r4u/shared'

// bcryptjs: native bcrypt needs a toolchain and fails on a slim image

export function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, env.BCRYPT_ROUNDS)
}

export function verifyPassword(plain: string, hash: string): Promise<boolean> {
  return bcrypt.compare(plain, hash)
}

// an unknown email still costs a compare, so timing cannot enumerate accounts
const DUMMY_HASH = '$2b$12$C6UzMDM.H6dfI/f/IKcEe.7Nn5Bq9Ig1YQ0wRXtGRRQfp5aDwLh2K'

export async function wasteTimeLikeAVerify(): Promise<void> {
  await bcrypt.compare('not-the-password', DUMMY_HASH)
}
