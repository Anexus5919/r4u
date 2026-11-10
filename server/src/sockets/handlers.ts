import { trusted } from 'mongoose'
import type { Server, Socket } from 'socket.io'
import type { z } from 'zod'
import { ClientEvents } from '@r4u/shared'
import type { ClientEventName } from '@r4u/shared'
import { AppError } from '../lib/AppError.js'
import { logger } from '../config/logger.js'
import { ReviewModel } from '../models/Review.js'
import { UserModel } from '../models/User.js'
import * as notifications from '../modules/notifications/notifications.service.js'
import * as reviews from '../modules/reviews/reviews.service.js'
import type { Principal } from '../modules/resumes/resumes.access.js'
import { presentIn } from './emitters.js'
import { broadcastRoomPresence, ensureLiveTicker, liveStats, onlineIn } from './presence.js'

type Payload<E extends ClientEventName> = z.output<(typeof ClientEvents)[E]>
type Reply = (response: object) => void

function principal(socket: Socket): Principal {
  return { id: String(socket.data.user.id), role: socket.data.user.role }
}

// the explicit deny REALTIME.md section 8 asks for: an admin's valid token opens no review room
function refuseAdmin(socket: Socket) {
  if (socket.data.user.role === 'admin') {
    throw new AppError('ADMIN_CONTENT_FORBIDDEN', 'Reviews are not visible to administrators')
  }
}

/** Parses with the shared schema, runs the handler, and always answers the ack. */
function on<E extends ClientEventName>(
  socket: Socket,
  event: E,
  handler: (payload: Payload<E>) => Promise<object | void>
) {
  socket.on(event as string, async (raw: unknown, ack?: Reply) => {
    const reply: Reply = typeof ack === 'function' ? ack : () => undefined
    const input = typeof raw === 'function' || raw === undefined ? {} : raw
    const parsed = ClientEvents[event].safeParse(input)

    if (!parsed.success) {
      reply({
        ok: false,
        code: 'VALIDATION_FAILED',
        message: parsed.error.issues[0]?.message ?? 'Invalid',
      })
      return
    }

    try {
      const result = await handler(parsed.data as Payload<E>)
      reply({ ok: true, ...(result ?? {}) })
    } catch (error) {
      if (error instanceof AppError) {
        reply({ ok: false, code: error.code, message: error.message })
      } else {
        logger.error({ err: error, event }, 'socket handler failed')
        reply({ ok: false, code: 'INTERNAL', message: 'Something went wrong' })
      }
    }
  })
}

async function requireRoom(socket: Socket, reviewId: string) {
  refuseAdmin(socket)
  const review = await reviews.loadForParty(reviewId, principal(socket))
  // room membership is the capability, re-checked against the database every time
  if (!socket.rooms.has(`review:${reviewId}`)) {
    throw new AppError('FORBIDDEN_ROLE', 'Join the review before posting to it')
  }
  return review
}

async function participants(io: Server, review: Awaited<ReturnType<typeof reviews.loadForParty>>) {
  const users = await UserModel.find({ _id: trusted({ $in: [review.owner, review.reviewer] }) })
    .select('name')
    .lean()
  return users.map((user) => ({
    id: String(user._id),
    name: user.name,
    role: String(user._id) === String(review.owner) ? 'owner' : 'reviewer',
    online: onlineIn(io, `user:${String(user._id)}`),
  }))
}

export function registerHandlers(io: Server, socket: Socket) {
  const me = String(socket.data.user.id)

  on(socket, 'review:join', async ({ reviewId }) => {
    refuseAdmin(socket)
    const review = await reviews.loadForParty(reviewId, principal(socket))
    if (!reviews.isOpenRoom(review)) {
      throw new AppError('VALIDATION_FAILED', 'This review opens once the reviewer accepts it')
    }

    const target = `review:${reviewId}`
    // one review room per socket, which caps fan-out enumeration
    for (const room of socket.rooms) {
      if (room.startsWith('review:') && room !== target) {
        await socket.leave(room)
        await broadcastRoomPresence(io, room)
      }
    }
    await socket.join(target)

    const [item, people, page, comments] = await Promise.all([
      reviews.getOne(reviewId, principal(socket)),
      participants(io, review),
      reviews.history(reviewId),
      reviews.comments(reviewId, principal(socket)),
    ])

    socket.to(target).emit('review:participant_joined', {
      reviewId,
      user: { id: me, name: socket.data.user.name },
      at: new Date().toISOString(),
    })
    await broadcastRoomPresence(io, target)

    return { review: item, participants: people, ...page, comments }
  })

  on(socket, 'review:leave', async ({ reviewId }) => {
    const room = `review:${reviewId}`
    await socket.leave(room)
    socket
      .to(room)
      .emit('review:participant_left', { reviewId, user: { id: me }, at: new Date().toISOString() })
    await broadcastRoomPresence(io, room)
  })

  on(socket, 'review:history', async ({ reviewId, before, limit }) => {
    await requireRoom(socket, reviewId)
    return reviews.history(reviewId, before, limit ?? 30)
  })

  on(socket, 'review:complete', async ({ reviewId, summary }) => {
    refuseAdmin(socket)
    return { review: await reviews.complete(reviewId, principal(socket), summary ?? '') }
  })

  on(socket, 'chat:send', async ({ reviewId, clientId, body }) => {
    const review = await requireRoom(socket, reviewId)
    if (review.status !== 'active') throw new AppError('VALIDATION_FAILED', 'This review is closed')

    // persist, broadcast to the whole room including the sender's other tabs, then notify absentees
    const message = await reviews.createMessage(review, me, clientId, body)
    const room = `review:${reviewId}`
    io.to(room).emit('chat:message', { message })

    const other = reviews.counterpart(review, me)
    if (!(await presentIn(room)).has(other)) {
      await notifications.notify({
        user: other,
        type: 'chat',
        actor: me,
        entity: { kind: 'review', id: reviewId },
        preview: body,
      })
    }
    return { message }
  })

  // volatile: a typing hint is worthless after a reconnect, so it is never buffered
  on(socket, 'chat:typing', async ({ reviewId, typing }) => {
    if (!socket.rooms.has(`review:${reviewId}`)) return
    socket.to(`review:${reviewId}`).volatile.emit('chat:typing_state', {
      reviewId,
      userId: me,
      name: socket.data.user.name,
      typing,
    })
  })

  on(socket, 'chat:read', async ({ reviewId, upTo }) => {
    await requireRoom(socket, reviewId)
    const at = new Date()
    await ReviewModel.updateOne(
      { _id: reviewId, 'participants.user': me },
      { $set: { 'participants.$.lastReadMessageId': upTo, 'participants.$.lastReadAt': at } }
    )
    socket
      .to(`review:${reviewId}`)
      .emit('chat:read_state', { reviewId, userId: me, upTo, at: at.toISOString() })
  })

  on(socket, 'comment:create', async (input) => {
    const review = await requireRoom(socket, input.reviewId)
    if (review.status !== 'active') throw new AppError('VALIDATION_FAILED', 'This review is closed')

    const comment = await reviews.createComment(review, me, input)
    const room = `review:${input.reviewId}`
    io.to(room).emit('comment:created', { comment })
    io.to(`resume:${String(review.resume)}`).emit('comment:created', { comment })

    const other = reviews.counterpart(review, me)
    if (!(await presentIn(room)).has(other)) {
      await notifications.notify({
        user: other,
        type: 'comment',
        actor: me,
        entity: { kind: 'review', id: input.reviewId },
        preview: input.body,
      })
    }
    return { comment }
  })

  on(socket, 'comment:resolve', async ({ commentId, resolved }) => {
    refuseAdmin(socket)
    const { comment, review } = await reviews.findComment(commentId, principal(socket))
    // the owner resolves feedback on their resume; an author may also resolve their own note
    if (String(review.owner) !== me && String(comment.author) !== me) {
      throw new AppError('FORBIDDEN_ROLE', 'Only the resume owner can resolve this')
    }
    comment.resolved = resolved
    await comment.save()
    const name = (await UserModel.findById(comment.author).select('name').lean())?.name ?? 'Someone'
    const payload = reviews.serializeComment(comment, name)
    io.to(`review:${String(review._id)}`).emit('comment:updated', { comment: payload })
    return { comment: payload }
  })

  on(socket, 'comment:delete', async ({ commentId }) => {
    refuseAdmin(socket)
    const { comment, review } = await reviews.findComment(commentId, principal(socket))
    if (String(comment.author) !== me)
      throw new AppError('FORBIDDEN_ROLE', 'Only the author can delete this')
    await comment.deleteOne()
    io.to(`review:${String(review._id)}`).emit('comment:deleted', {
      commentId,
      reviewId: String(review._id),
      sectionKey: comment.sectionKey,
    })
  })

  on(socket, 'notify:read', async ({ ids }) => ({ unread: await notifications.markRead(me, ids) }))
  on(socket, 'notify:read_all', async () => ({ unread: await notifications.markAllRead(me) }))

  on(socket, 'presence:subscribe', async ({ userIds }) => {
    for (const id of userIds) await socket.join(`presence:${id}`)
    return { online: userIds.filter((id) => onlineIn(io, `user:${id}`)) }
  })

  on(socket, 'presence:unsubscribe', async ({ userIds }) => {
    for (const id of userIds) await socket.leave(`presence:${id}`)
  })

  on(socket, 'admin:live_subscribe', async () => {
    if (socket.data.user.role !== 'admin')
      throw new AppError('FORBIDDEN_ROLE', 'Administrators only')
    await socket.join('admin:live')
    ensureLiveTicker(io)
    return { snapshot: liveStats(io) }
  })
}
