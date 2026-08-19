import type { Role } from '@r4u/shared'

declare global {
  namespace Express {
    interface Request {
      /*
        Always present. Guest is a first-class role rather than a null user, so every policy
        function handles four roles uniformly.
      */
      principal: { id: string | null; role: Role }
      /** matchedData(req). The only input a controller may read. */
      validated: Record<string, unknown>
    }
  }
}

export {}
