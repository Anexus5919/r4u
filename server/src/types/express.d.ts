import type { Role } from '@r4u/shared'

declare global {
  namespace Express {
    interface Request {
      // always present: guest is a role, so policies never handle a null user
      principal: { id: string | null; role: Role }
      /** matchedData(req). The only input a controller may read. */
      validated: Record<string, unknown>
    }
  }
}

export {}
