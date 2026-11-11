import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useParams } from 'react-router-dom'
import type {
  ChatMessage,
  PublicResume,
  Resume,
  ReviewComment,
  ReviewItem,
  ReviewParticipant,
  SectionKey,
} from '@r4u/shared'
import { ResumePreview } from '@/render/ResumePreview'
import { useAuth } from '@/context/AuthContext'
import { emitWithAck, useSocket, useSocketEvent } from '@/context/SocketContext'
import { useToast } from '@/context/ToastContext'
import { apiGet, apiPatch, toApiFailure } from '@/lib/api'
import { cn } from '@/lib/cn'
import { formatRelative } from '@/lib/format'
import { PresenceGlyph, RequestReviewModal } from '@/components/review/RequestReviewModal'
import { Banner } from '@/components/ui/Banner'
import { Button, ButtonLink } from '@/components/ui/Button'
import { Card, Skeleton, StatusLabel } from '@/components/ui/Card'
import { Field } from '@/components/ui/Field'
import { Icon } from '@/components/ui/Icon'
import { Textarea } from '@/components/ui/Input'
import { Modal } from '@/components/ui/Modal'
import { Segmented } from '@/components/ui/Segmented'

type Delivery = 'pending' | 'sent' | 'failed'
type LocalMessage = ChatMessage & { delivery: Delivery }

interface JoinReply {
  review: ReviewItem
  participants: ReviewParticipant[]
  messages: ChatMessage[]
  nextCursor: string | null
  comments: ReviewComment[]
}

const TYPING_THROTTLE_MS = 2000
const TYPING_IDLE_MS = 3000

function time(iso: string) {
  return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}

// keyed on clientId, so a broadcast of our own message replaces its pending copy rather than doubling it
function merge(current: LocalMessage[], incoming: ChatMessage[]): LocalMessage[] {
  const byClient = new Map(current.map((message) => [message.clientId, message]))
  for (const message of incoming) byClient.set(message.clientId, { ...message, delivery: 'sent' })
  return [...byClient.values()].sort((a, b) => a.createdAt.localeCompare(b.createdAt))
}

function ChatLine({
  message,
  mine,
  fromReviewer,
  onRetry,
}: {
  message: LocalMessage
  mine: boolean
  fromReviewer: boolean
  onRetry: () => void
}) {
  return (
    <li
      className={cn(
        'grid grid-cols-[3.5rem_1fr] gap-x-3 py-2',
        fromReviewer && 'border-l border-ink-06 pl-3',
        message.delivery === 'pending' && 'opacity-60'
      )}
    >
      <span className="pt-0.5 font-mono text-2xs text-ink-08 tabular-nums">
        {time(message.createdAt)}
      </span>
      <div className="min-w-0">
        <p className="text-xs font-semibold text-ink-11">{mine ? 'You' : message.senderName}</p>
        <p className="mt-0.5 text-sm break-words whitespace-pre-wrap text-ink-12">{message.body}</p>
        {message.delivery === 'failed' ? (
          <button
            type="button"
            onClick={onRetry}
            className="mt-1 text-xs font-medium text-danger underline"
          >
            Not sent. Retry
          </button>
        ) : null}
      </div>
    </li>
  )
}

export function ReviewRoomPage() {
  const { id = '' } = useParams()
  const { user } = useAuth()
  const { socket, status } = useSocket()
  const { toast } = useToast()

  const [review, setReview] = useState<ReviewItem | null>(null)
  const [participants, setParticipants] = useState<ReviewParticipant[]>([])
  const [present, setPresent] = useState<string[]>([])
  const [messages, setMessages] = useState<LocalMessage[]>([])
  const [cursor, setCursor] = useState<string | null>(null)
  const [comments, setComments] = useState<ReviewComment[]>([])
  const [resume, setResume] = useState<PublicResume | null>(null)
  const [typingName, setTypingName] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [tab, setTab] = useState<'chat' | 'comments'>('chat')
  const [draft, setDraft] = useState('')
  const [completing, setCompleting] = useState(false)
  const [summary, setSummary] = useState('')
  const [resubmitting, setResubmitting] = useState(false)
  const [note, setNote] = useState('')
  const [sending, setSending] = useState(false)
  const [askAgain, setAskAgain] = useState(false)

  const me = user?.id ?? ''
  const list = useRef<HTMLUListElement>(null)
  const lastTypingSent = useRef(0)
  const idleTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const typingClear = useRef<ReturnType<typeof setTimeout> | null>(null)

  const loadResume = useCallback(
    () =>
      apiGet<{ resume: PublicResume }>(`/reviews/${id}/resume`)
        .then(({ resume: doc }) => setResume(doc))
        .catch((caught) => setError(toApiFailure(caught).message)),
    [id]
  )

  useEffect(() => {
    void loadResume()
  }, [loadResume])

  // re-join on every connect: the correctness path that survives restarts and lost buffers
  useEffect(() => {
    if (!socket || status !== 'connected') return
    let cancelled = false

    void emitWithAck<JoinReply, 'review:join'>(socket, 'review:join', { reviewId: id }).then(
      (reply) => {
        if (cancelled) return
        if (!reply.ok) {
          setError(reply.message)
          return
        }
        setReview(reply.review)
        setParticipants(reply.participants)
        setComments(reply.comments)
        setMessages((current) => merge(current, reply.messages))
        setCursor(reply.nextCursor)
      }
    )

    return () => {
      cancelled = true
      // volatile, so a leave is never buffered and replayed after the next join
      socket.volatile.emit('review:leave', { reviewId: id })
    }
  }, [socket, status, id])

  useSocketEvent<{ message: ChatMessage }>('chat:message', ({ message }) => {
    if (message.reviewId !== id) return
    setMessages((current) => merge(current, [message]))
    if (message.senderId !== me) setTypingName(null)
  })

  useSocketEvent<{ reviewId: string; userId: string; name: string; typing: boolean }>(
    'chat:typing_state',
    (event) => {
      if (event.reviewId !== id || event.userId === me) return
      if (typingClear.current) clearTimeout(typingClear.current)
      setTypingName(event.typing ? event.name : null)
      if (event.typing) typingClear.current = setTimeout(() => setTypingName(null), 5000)
    }
  )

  useSocketEvent<{ comment: ReviewComment }>('comment:created', ({ comment }) => {
    if (comment.reviewId !== id) return
    setComments((current) =>
      current.some((c) => c._id === comment._id) ? current : [...current, comment]
    )
  })
  useSocketEvent<{ comment: ReviewComment }>('comment:updated', ({ comment }) => {
    setComments((current) => current.map((c) => (c._id === comment._id ? comment : c)))
  })
  useSocketEvent<{ commentId: string }>('comment:deleted', ({ commentId }) => {
    setComments((current) => current.filter((c) => c._id !== commentId))
  })
  useSocketEvent<{ reviewId: string; online: string[] }>('review:presence', (event) => {
    if (event.reviewId === id) setPresent(event.online)
  })
  // the owner sent a new version: the reviewer reads it without reloading the page
  useSocketEvent<{ reviewId: string; round: number; at: string }>('review:resubmitted', (event) => {
    if (event.reviewId !== id) return
    setReview((current) =>
      current ? { ...current, round: event.round, resubmittedAt: event.at } : current
    )
    void loadResume()
  })
  useSocketEvent<{ reviewId: string; summary: string; at: string }>('review:completed', (event) => {
    if (event.reviewId !== id) return
    setReview((current) =>
      current
        ? { ...current, status: 'completed', summary: event.summary, completedAt: event.at }
        : current
    )
  })

  // newest at the bottom, and a read receipt for the latest message from the other side
  const newestId = messages.at(-1)?._id
  useEffect(() => {
    list.current?.scrollTo({ top: list.current.scrollHeight })
    const last = [...messages].reverse().find((m) => m.delivery === 'sent' && m.senderId !== me)
    if (last && socket?.connected && /^[0-9a-f]{24}$/.test(last._id)) {
      socket.emit('chat:read', { reviewId: id, upTo: last._id })
    }
    // only the newest id matters here, not every re-render of the list
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [newestId])

  async function deliver(message: LocalMessage) {
    const reply = await emitWithAck<{ message: ChatMessage }, 'chat:send'>(socket, 'chat:send', {
      reviewId: id,
      clientId: message.clientId,
      body: message.body,
    })
    setMessages((current) =>
      current.map((m) =>
        m.clientId === message.clientId
          ? reply.ok
            ? { ...reply.message, delivery: 'sent' }
            : { ...m, delivery: 'failed' }
          : m
      )
    )
    if (!reply.ok && reply.code !== 'OFFLINE' && reply.code !== 'TIMEOUT')
      toast('danger', reply.message)
  }

  function send() {
    const body = draft.trim()
    if (!body || !user) return
    const clientId = crypto.randomUUID()
    const optimistic: LocalMessage = {
      _id: clientId,
      reviewId: id,
      senderId: me,
      senderName: user.name,
      body,
      clientId,
      createdAt: new Date().toISOString(),
      editedAt: null,
      deletedAt: null,
      delivery: 'pending',
    }
    setMessages((current) => [...current, optimistic])
    setDraft('')
    socket?.volatile.emit('chat:typing', { reviewId: id, typing: false })
    void deliver(optimistic)
  }

  // at most one typing signal every two seconds, and an explicit stop after three idle seconds
  function onDraft(value: string) {
    setDraft(value)
    if (!socket?.connected) return
    const now = Date.now()
    if (now - lastTypingSent.current > TYPING_THROTTLE_MS) {
      lastTypingSent.current = now
      socket.volatile.emit('chat:typing', { reviewId: id, typing: true })
    }
    if (idleTimer.current) clearTimeout(idleTimer.current)
    idleTimer.current = setTimeout(() => {
      socket.volatile.emit('chat:typing', { reviewId: id, typing: false })
    }, TYPING_IDLE_MS)
  }

  async function loadEarlier() {
    if (!cursor) return
    const reply = await emitWithAck<
      { messages: ChatMessage[]; nextCursor: string | null },
      'review:history'
    >(socket, 'review:history', { reviewId: id, before: cursor })
    if (reply.ok) {
      setMessages((current) => merge(current, reply.messages))
      setCursor(reply.nextCursor)
    }
  }

  async function complete() {
    const reply = await emitWithAck<{ review: ReviewItem }, 'review:complete'>(
      socket,
      'review:complete',
      {
        reviewId: id,
        summary,
      }
    )
    if (reply.ok) {
      setReview(reply.review)
      setCompleting(false)
      toast('success', 'Review completed. The owner has been told.')
    } else toast('danger', reply.message)
  }

  async function resubmit() {
    setSending(true)
    try {
      const { review: next } = await apiPatch<{ review: ReviewItem }>(`/reviews/${id}/resubmit`, {
        note,
      })
      setReview(next)
      setNote('')
      setResubmitting(false)
      setTab('chat')
      toast('success', `Sent. ${next.reviewer.name} has been told it is ready for another look.`)
    } catch (caught) {
      toast('danger', toApiFailure(caught).message)
    } finally {
      setSending(false)
    }
  }

  if (error) {
    return (
      <div className="mx-auto max-w-xl py-10">
        <Banner>{error}</Banner>
        <ButtonLink to="/reviews" variant="secondary" className="mt-6">
          Back to reviews
        </ButtonLink>
      </div>
    )
  }

  if (!review || !resume) {
    return (
      <div className="mx-auto grid max-w-7xl grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_400px]">
        <Skeleton className="aspect-[210/297] w-full" />
        <Skeleton className="h-96" />
      </div>
    )
  }

  const other = participants.find((p) => p.id !== me)
  const otherHere = other ? present.includes(other.id) : false
  const active = review.status === 'active'
  const isReviewer = review.as === 'reviewer'
  const isOwner = review.as === 'owner'
  const openComments = comments.filter((comment) => !comment.resolved).length
  const sectionTitles = new Map<string, string>([['personal', 'Personal details']])
  for (const section of resume.sections) sectionTitles.set(section.type, section.title)

  return (
    <div className="mx-auto max-w-7xl">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <ButtonLink to="/reviews" variant="ghost" size="sm" className="-ml-3">
            <Icon name="arrow" className="rotate-180" />
            Reviews
          </ButtonLink>
          <h1 className="mt-2 truncate text-xl text-ink-12">{review.resume.title}</h1>
          <div className="mt-1.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-ink-09">
            <StatusLabel on={active}>
              {active ? 'In review' : 'Completed'}
              {review.round > 1 ? `, round ${review.round}` : ''}
            </StatusLabel>
            {other ? (
              <span className="inline-flex items-center gap-1.5">
                <PresenceGlyph online={otherHere || other.online} />
                {other.name},{' '}
                {otherHere ? 'in this review' : other.online ? 'online' : 'last seen recently'}
              </span>
            ) : null}
          </div>
        </div>
        {isReviewer && active ? (
          <Button variant="primary" onClick={() => setCompleting(true)}>
            <Icon name="check" />
            Mark as reviewed
          </Button>
        ) : null}
        {isOwner ? (
          <div className="flex flex-wrap gap-2">
            <ButtonLink to={`/resume/${review.resume.id}/edit`} variant="secondary">
              Edit resume
            </ButtonLink>
            {active ? (
              <Button variant="primary" onClick={() => setResubmitting(true)}>
                Send for re-review
              </Button>
            ) : (
              <Button variant="primary" onClick={() => setAskAgain(true)}>
                Ask for another round
              </Button>
            )}
          </div>
        ) : null}
      </div>

      {active && review.round > 1 && review.resubmittedAt ? (
        <Banner tone="info" className="mt-6">
          {isReviewer
            ? `${review.owner.name} sent an updated version (round ${review.round}) ${formatRelative(review.resubmittedAt)}. The page below is the latest.`
            : `You sent round ${review.round} to ${review.reviewer.name} ${formatRelative(review.resubmittedAt)}. They have been notified.`}
        </Banner>
      ) : null}

      {isOwner && active && review.round === 1 ? (
        <p className="mt-4 max-w-3xl text-sm text-ink-09">
          Work through the comments in the editor, resolve each one here, then choose Send for
          re-review so {review.reviewer.name} knows the new version is ready.
        </p>
      ) : null}

      {review.status === 'completed' && review.summary ? (
        <Banner tone="success" className="mt-6">
          Review completed. {review.summary}
        </Banner>
      ) : null}

      {isOwner && review.status === 'completed' ? (
        <RatingPanel review={review} onRated={setReview} />
      ) : null}

      {isReviewer && review.status === 'completed' && review.rating !== null ? (
        <p className="mt-4 text-sm text-ink-10">
          {review.owner.name} rated this review {review.rating} out of 5
          {review.ratingNote ? `: “${review.ratingNote}”` : '.'}
        </p>
      ) : null}

      <div className="mt-6 grid grid-cols-1 items-start gap-6 lg:grid-cols-[minmax(0,1fr)_420px]">
        <div className="rounded-sm border border-ink-04 bg-ink-02 p-4 sm:p-8">
          <div className="sheet mx-auto w-full max-w-[794px]">
            <ResumePreview resume={resume as unknown as Partial<Resume>} />
          </div>
        </div>

        <Card className="flex flex-col p-0 lg:sticky lg:top-24">
          <div className="border-b border-ink-04 p-3">
            <Segmented
              label="Panel"
              value={tab}
              onChange={setTab}
              stretch
              options={[
                { value: 'chat', label: 'Chat' },
                { value: 'comments', label: `Comments ${comments.length}` },
              ]}
            />
          </div>

          {tab === 'chat' ? (
            <div className="flex h-[min(70vh,640px)] flex-col">
              <ul ref={list} className="flex-1 overflow-y-auto px-4 py-3" aria-live="polite">
                {cursor ? (
                  <li className="pb-2 text-center">
                    <Button size="sm" variant="ghost" onClick={() => void loadEarlier()}>
                      Load earlier messages
                    </Button>
                  </li>
                ) : null}
                {messages.length === 0 ? (
                  <li className="py-8 text-center text-sm text-ink-09">
                    No messages yet. Say hello.
                  </li>
                ) : null}
                {messages.map((message) => (
                  <ChatLine
                    key={message.clientId}
                    message={message}
                    mine={message.senderId === me}
                    fromReviewer={message.senderId === review.reviewer.id}
                    onRetry={() => {
                      setMessages((current) =>
                        current.map((m) =>
                          m.clientId === message.clientId ? { ...m, delivery: 'pending' } : m
                        )
                      )
                      void deliver({ ...message, delivery: 'pending' })
                    }}
                  />
                ))}
              </ul>
              <p className="h-5 px-4 text-xs text-ink-09" aria-live="polite">
                {typingName ? `${typingName} is typing` : ''}
              </p>
              <form
                className="flex gap-2 border-t border-ink-04 p-3"
                onSubmit={(event) => {
                  event.preventDefault()
                  send()
                }}
              >
                <Textarea
                  rows={2}
                  aria-label="Message"
                  placeholder={active ? 'Write a message' : 'This review is closed'}
                  disabled={!active}
                  value={draft}
                  maxLength={2000}
                  onChange={(event) => onDraft(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' && !event.shiftKey) {
                      event.preventDefault()
                      send()
                    }
                  }}
                />
                <Button
                  type="submit"
                  variant="primary"
                  disabled={!active || !draft.trim()}
                  className="self-end"
                >
                  Send
                </Button>
              </form>
            </div>
          ) : (
            <CommentsPanel
              reviewId={id}
              active={active}
              me={me}
              isOwner={isOwner}
              comments={comments}
              sectionTitles={sectionTitles}
            />
          )}
        </Card>
      </div>

      <Modal
        open={completing}
        onClose={() => setCompleting(false)}
        title="Mark this review as completed"
        description="The owner sees the resume as reviewed, with your closing note. Chat closes."
        footer={
          <>
            <Button variant="ghost" onClick={() => setCompleting(false)}>
              Not yet
            </Button>
            <Button variant="primary" onClick={() => void complete()}>
              Complete review
            </Button>
          </>
        }
      >
        <Field label="Closing note" value={summary} max={1000}>
          {({ id: fieldId }) => (
            <Textarea
              id={fieldId}
              rows={4}
              value={summary}
              onChange={(event) => setSummary(event.target.value)}
            />
          )}
        </Field>
      </Modal>

      <Modal
        open={resubmitting}
        onClose={() => setResubmitting(false)}
        title="Send for re-review"
        description={`${review.reviewer.name} is notified at once and sees the latest version of the resume. Your note goes into the chat.`}
        footer={
          <>
            <Button variant="ghost" onClick={() => setResubmitting(false)}>
              Not yet
            </Button>
            <Button variant="primary" loading={sending} onClick={() => void resubmit()}>
              Send round {review.round + 1}
            </Button>
          </>
        }
      >
        <div className="flex flex-col gap-4">
          {openComments > 0 ? (
            <Banner tone="warning">
              {openComments === 1
                ? '1 comment is still open.'
                : `${openComments} comments are still open.`}{' '}
              You can send now, or resolve them in the Comments tab first.
            </Banner>
          ) : null}
          <Field label="What changed" value={note} max={2000}>
            {({ id: fieldId }) => (
              <Textarea
                id={fieldId}
                rows={4}
                placeholder="Moved the latency result to the top and cut the summary to three lines."
                value={note}
                onChange={(event) => setNote(event.target.value)}
              />
            )}
          </Field>
        </div>
      </Modal>

      <RequestReviewModal
        open={askAgain}
        resumeId={review.resume.id}
        reviewer={review.reviewer}
        title={`Ask ${review.reviewer.name} for another round`}
        onClose={() => setAskAgain(false)}
      />

      <p className="mt-6 text-xs text-ink-08">
        Updated {formatRelative(resume.updatedAt)}. Reviewers read this resume; they cannot edit it.
      </p>
    </div>
  )
}

function CommentsPanel({
  reviewId,
  active,
  me,
  isOwner,
  comments,
  sectionTitles,
}: {
  reviewId: string
  active: boolean
  me: string
  isOwner: boolean
  comments: ReviewComment[]
  sectionTitles: Map<string, string>
}) {
  const { socket } = useSocket()
  const { toast } = useToast()
  const [section, setSection] = useState<string>([...sectionTitles.keys()][1] ?? 'personal')
  const [body, setBody] = useState('')
  const [busy, setBusy] = useState(false)

  const grouped = useMemo(() => {
    const map = new Map<string, ReviewComment[]>()
    for (const comment of comments)
      map.set(comment.sectionKey, [...(map.get(comment.sectionKey) ?? []), comment])
    return map
  }, [comments])

  async function add() {
    if (!body.trim()) return
    setBusy(true)
    const reply = await emitWithAck<{ comment: ReviewComment }, 'comment:create'>(
      socket,
      'comment:create',
      {
        reviewId,
        sectionKey: section as SectionKey,
        anchorText: sectionTitles.get(section) ?? section,
        body,
        clientId: crypto.randomUUID(),
      }
    )
    setBusy(false)
    if (reply.ok) setBody('')
    else toast('danger', reply.message)
  }

  async function resolve(comment: ReviewComment) {
    const reply = await emitWithAck(socket, 'comment:resolve', {
      commentId: comment._id,
      resolved: !comment.resolved,
    })
    if (!reply.ok) toast('danger', reply.message)
  }

  async function remove(comment: ReviewComment) {
    const reply = await emitWithAck(socket, 'comment:delete', { commentId: comment._id })
    if (!reply.ok) toast('danger', reply.message)
  }

  return (
    <div className="flex h-[min(70vh,640px)] flex-col">
      <div className="flex-1 overflow-y-auto px-4 py-3">
        {comments.length === 0 ? (
          <p className="py-8 text-center text-sm text-ink-09">
            {isOwner
              ? 'No comments yet. They appear here as the reviewer pins them to sections.'
              : 'No comments yet. Pin one to a section below.'}
          </p>
        ) : null}
        {[...grouped.entries()].map(([key, items]) => (
          <section key={key} className="mb-5">
            <h3 className="text-xs font-semibold tracking-[0.06em] text-ink-09 uppercase">
              {sectionTitles.get(key) ?? items[0]?.anchorText ?? key}
            </h3>
            <ul className="mt-2 flex flex-col gap-2">
              {items.map((comment) => (
                <li
                  key={comment._id}
                  className={cn(
                    'rounded-xs border border-ink-04 bg-ink-00 p-3',
                    comment.resolved && 'opacity-60'
                  )}
                >
                  <p className="text-sm text-ink-12">{comment.body}</p>
                  <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-ink-09">
                    <span>
                      {comment.authorName} · {formatRelative(comment.createdAt)}
                      {comment.resolved ? ' · resolved' : ''}
                    </span>
                    {active && (isOwner || comment.authorId === me) ? (
                      <button
                        type="button"
                        className="font-medium text-accent-text"
                        onClick={() => void resolve(comment)}
                      >
                        {comment.resolved ? 'Reopen' : 'Resolve'}
                      </button>
                    ) : null}
                    {active && comment.authorId === me ? (
                      <button
                        type="button"
                        className="font-medium text-ink-09 hover:text-danger"
                        onClick={() => void remove(comment)}
                      >
                        Delete
                      </button>
                    ) : null}
                  </div>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>

      {active && isOwner && comments.length > 0 ? (
        <p className="border-t border-ink-04 p-3 text-xs text-ink-09">
          Make each change in the editor, then Resolve the comment. When you are done, use Send for
          re-review at the top of the page.
        </p>
      ) : null}

      {/* the comment composer is the reviewer's tool; the owner answers by editing the resume */}
      {active && !isOwner ? (
        <div className="flex flex-col gap-2 border-t border-ink-04 p-3">
          <label htmlFor="comment-section" className="text-xs font-medium text-ink-09">
            Pin to section
          </label>
          <select
            id="comment-section"
            value={section}
            onChange={(event) => setSection(event.target.value)}
            className="h-9 rounded-xs border border-ink-05 bg-ink-00 px-2 text-sm text-ink-12"
          >
            {[...sectionTitles.entries()].map(([key, title]) => (
              <option key={key} value={key}>
                {title}
              </option>
            ))}
          </select>
          <Textarea
            rows={2}
            aria-label="Comment"
            placeholder="What should change, and why?"
            maxLength={1000}
            value={body}
            onChange={(event) => setBody(event.target.value)}
          />
          <Button
            variant="primary"
            loading={busy}
            disabled={!body.trim()}
            onClick={() => void add()}
          >
            Add comment
          </Button>
        </div>
      ) : null}
    </div>
  )
}

const RATING_OPTIONS = (['1', '2', '3', '4', '5'] as const).map((value) => ({
  value,
  label: value,
}))

// the owner's verdict is what the reviewer directory averages, so it lives where the review ends
function RatingPanel({
  review,
  onRated,
}: {
  review: ReviewItem
  onRated: (review: ReviewItem) => void
}) {
  const { toast } = useToast()
  const [rating, setRating] = useState<string>(review.rating ? String(review.rating) : '')
  const [note, setNote] = useState(review.ratingNote)
  const [editing, setEditing] = useState(review.rating === null)
  const [saving, setSaving] = useState(false)

  async function save() {
    if (!rating) return
    setSaving(true)
    try {
      const { review: next } = await apiPatch<{ review: ReviewItem }>(
        `/reviews/${review.id}/rating`,
        { rating: Number(rating), note }
      )
      onRated(next)
      setEditing(false)
      toast('success', 'Thank you. Your rating helps others choose a reviewer.')
    } catch (caught) {
      toast('danger', toApiFailure(caught).message)
    } finally {
      setSaving(false)
    }
  }

  if (!editing && review.rating !== null) {
    return (
      <p className="mt-4 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-ink-10">
        You rated this review {review.rating} out of 5
        {review.ratingNote ? `: “${review.ratingNote}”` : '.'}
        <button
          type="button"
          className="text-sm font-medium text-accent-text"
          onClick={() => setEditing(true)}
        >
          Change
        </button>
      </p>
    )
  }

  return (
    <Card className="mt-6 p-5">
      <h2 className="text-md text-ink-12">How useful was this review?</h2>
      <p className="mt-1 text-sm text-ink-09">
        1 is not useful, 5 is excellent. Your rating appears in {review.reviewer.name}&rsquo;s
        record in the reviewer directory; your note is shown only to them.
      </p>
      <div className="mt-4 flex flex-col gap-4 sm:flex-row sm:items-end">
        <Segmented
          label="Rating out of 5"
          value={rating as (typeof RATING_OPTIONS)[number]['value']}
          onChange={setRating}
          options={RATING_OPTIONS}
        />
        <div className="flex-1">
          <Field label="A note for the reviewer (optional)" value={note} max={500}>
            {({ id }) => (
              <Textarea
                id={id}
                rows={1}
                value={note}
                onChange={(event) => setNote(event.target.value)}
              />
            )}
          </Field>
        </div>
        <Button variant="primary" loading={saving} disabled={!rating} onClick={() => void save()}>
          Save rating
        </Button>
      </div>
    </Card>
  )
}
