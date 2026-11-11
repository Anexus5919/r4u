import { Types } from 'mongoose'
import { isTest } from '../config/env.js'
import { logger } from '../config/logger.js'
import { ActivityLogModel } from '../models/Moderation.js'

// the only keys meta may carry; a request body can never reach the admin log through here
const META_ALLOWLIST = new Set([
  'role',
  'from',
  'to',
  'status',
  'templateKey',
  'resumeType',
  'title',
  'reason',
  'count',
  'round',
  'rating',
])

export interface ActivityInput {
  actor?: string | null
  action: string
  targetType: string
  targetId?: string | null
  meta?: Record<string, unknown>
  ip?: string
}

function cleanMeta(meta: Record<string, unknown> = {}) {
  const out: Record<string, string | number | boolean> = {}
  for (const [key, value] of Object.entries(meta)) {
    if (!META_ALLOWLIST.has(key)) continue
    if (typeof value === 'string') out[key] = value.slice(0, 80)
    else if (typeof value === 'number' || typeof value === 'boolean') out[key] = value
  }
  return out
}

const buffer: ActivityInput[] = []
let timer: NodeJS.Timeout | null = null

async function flush() {
  timer = null
  const batch = buffer.splice(0, buffer.length)
  if (batch.length === 0) return

  try {
    await ActivityLogModel.insertMany(
      batch.map((entry) => ({
        actor: entry.actor && Types.ObjectId.isValid(entry.actor) ? entry.actor : null,
        action: entry.action,
        targetType: entry.targetType,
        targetId: entry.targetId && Types.ObjectId.isValid(entry.targetId) ? entry.targetId : null,
        meta: cleanMeta(entry.meta),
        ip: entry.ip ?? '',
        at: new Date(),
      })),
      { ordered: false }
    )
  } catch (error) {
    logger.warn({ err: error }, 'activity log flush failed')
  }
}

/** Buffered and flushed every two seconds: logging must never hold up a request. */
export function logActivity(entry: ActivityInput) {
  buffer.push(entry)
  if (isTest) {
    void flush()
    return
  }
  timer ??= setTimeout(() => void flush(), 2000)
}

/** Drains the buffer, for graceful shutdown and for tests. */
export async function flushActivity() {
  if (timer) clearTimeout(timer)
  await flush()
}
