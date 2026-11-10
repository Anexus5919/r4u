import { z } from 'zod'

// one schema per client event, parsed on the server and typed on the client (ADR-009)

export const OBJECT_ID = /^[0-9a-f]{24}$/
const id = z.string().regex(OBJECT_ID, 'Not a valid id')

// comments anchor to the data model, never to geometry, so they survive every template
export const SECTION_KEYS = [
  'personal',
  'summary',
  'education',
  'experience',
  'projects',
  'skills',
  'certifications',
  'achievements',
  'languages',
  'publications',
  'references',
  'custom',
] as const
export type SectionKey = (typeof SECTION_KEYS)[number]

// strips C0 controls except newline and caps blank runs at two, per REALTIME.md 9.1
export function cleanText(value: string): string {
  return (
    value
      // matching control characters is the whole point of this pattern
      // eslint-disable-next-line no-control-regex
      .replace(/[\u0000-\u0009\u000b-\u001f\u007f]/g, '')
      .replace(/\n{3,}/g, '\n\n')
      .trim()
  )
}

const text = (max: number) =>
  z.string().transform(cleanText).pipe(z.string().min(1, 'Write something first').max(max))

export const ClientEvents = {
  'review:join': z.object({ reviewId: id }),
  'review:leave': z.object({ reviewId: id }),
  'review:history': z.object({
    reviewId: id,
    before: id.optional(),
    limit: z.number().int().min(1).max(50).optional(),
  }),
  'review:complete': z.object({ reviewId: id, summary: z.string().max(1000).optional() }),
  'chat:send': z.object({ reviewId: id, clientId: z.string().uuid(), body: text(2000) }),
  'chat:typing': z.object({ reviewId: id, typing: z.boolean() }),
  'chat:read': z.object({ reviewId: id, upTo: id }),
  'comment:create': z.object({
    reviewId: id,
    sectionKey: z.enum(SECTION_KEYS),
    entryId: z.string().max(40).nullable().optional(),
    fieldPath: z.string().max(80).nullable().optional(),
    anchorText: z.string().max(200).optional(),
    body: text(1000),
    clientId: z.string().uuid(),
  }),
  'comment:resolve': z.object({ commentId: id, resolved: z.boolean() }),
  'comment:delete': z.object({ commentId: id }),
  'notify:read': z.object({ ids: z.array(id).max(100) }),
  'notify:read_all': z.object({}),
  'presence:subscribe': z.object({ userIds: z.array(id).max(50) }),
  'presence:unsubscribe': z.object({ userIds: z.array(id).max(50) }),
  'admin:live_subscribe': z.object({}),
} as const

export type ClientEventName = keyof typeof ClientEvents
export type ClientEventPayload<E extends ClientEventName> = z.input<(typeof ClientEvents)[E]>

export const CLIENT_EVENT_NAMES = Object.keys(ClientEvents) as ClientEventName[]

/** Every ack carries ok; a failure carries a stable code and a displayable message. */
export type Ack<T = object> = ({ ok: true } & T) | { ok: false; code: string; message: string }
