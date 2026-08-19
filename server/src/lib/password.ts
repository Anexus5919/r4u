import bcrypt from 'bcryptjs'
import { env } from '../config/env.js'

export { PASSWORD_MAX, PASSWORD_MIN } from '@r4u/shared'

/*
  bcryptjs rather than the native bcrypt. The native module needs python3, make and g++ in the
  Docker image and in the CI runner, builds fine locally and fails on a slim base. The CPU
  difference is irrelevant at this scale.
*/

export function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, env.BCRYPT_ROUNDS)
}

export function verifyPassword(plain: string, hash: string): Promise<boolean> {
  return bcrypt.compare(plain, hash)
}

/*
  Compared against when the email is unknown, so a failed login costs the same time and returns
  the same message whether or not the account exists. Without it, response timing and wording
  enumerate registered accounts.
*/
const DUMMY_HASH = '$2b$12$C6UzMDM.H6dfI/f/IKcEe.7Nn5Bq9Ig1YQ0wRXtGRRQfp5aDwLh2K'

export async function wasteTimeLikeAVerify(): Promise<void> {
  await bcrypt.compare('not-the-password', DUMMY_HASH)
}
