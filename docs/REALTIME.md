# Real-Time Architecture

Socket.IO v4. One namespace, rooms for everything.

---

## 1. Namespace and rooms

**One namespace (`/`).** Never create a namespace per review. Dynamic namespaces are retained for
the process lifetime unless `cleanupEmptyChildNamespaces` is true, and it defaults to false, so
every review ever opened leaks. A second namespace also forces an extra connection per tab.

Room names are `entity:id`, lowercase, colon-delimited. **Every join is server-authorised.**

| Room | Joined by | Carries |
|---|---|---|
| `user:<userId>` | every socket, on connect | notifications, cross-tab sync, forced logout, and the presence source of truth |
| `review:<reviewId>` | owner and assigned reviewer only | chat, section comments, typing, room presence |
| `resume:<resumeId>` | the owner's editor tab | a reviewer's new comment lights the section badge without the owner being in the review room |
| `presence:<targetUserId>` | watchers of one user's online state | e.g. the owner watching an assigned reviewer |
| `admin:live` | admin dashboard only | live counters |

The implicit `socket.id` room is used for per-tab replies.

**Reject any client-supplied id not matching `/^[0-9a-f]{24}$/`.**

**Cap a socket at one `review:*` room at a time**, to prevent fanout enumeration.

---

## 2. Authentication

```ts
// client
const socket = io(API_URL, {
  auth: (cb) => cb({ token: getAccessToken() }),   // MUST be a function
  timeout: 45000,
  reconnectionAttempts: Infinity,
  reconnectionDelayMax: 10000,
})
```

```ts
// server
io.use((socket, next) => {
  const payload = verifyAccess(socket.handshake.auth.token)
  socket.data.user = { id: payload.sub, role: payload.role }
  socket.data.tokenExp = payload.exp
  next()
})
```

**`auth` must be a function, not a static object.** A static `auth: { token }` replays the token
captured at page load on every reconnect. Once the access token expires, the socket enters an
infinite reconnect-then-reject loop that also hammers a sleeping Render instance.

**Never put the JWT in `extraHeaders`.** It works in local development because polling carries
headers, then breaks the moment the connection upgrades to WebSocket in production. The failure
presents as intermittent auth loss rather than an obvious bug.

Reject with `err.data = { code: 'TOKEN_EXPIRED' }` so the client refreshes and reconnects rather
than retrying blindly.

### 2.1 Mid-connection expiry

Two mechanisms:

1. A per-socket `setTimeout` at `exp - 60s` emitting `session:expiring`, and at `exp` emitting
   `session:revoked` then `socket.disconnect(true)`.
2. A cheap `socket.use()` guard rejecting any packet where `Date.now() / 1000 > socket.data.tokenExp`.

After an HTTP refresh the client calls `socket.disconnect().connect()`. That is the **only** way
to re-run handshake middleware.

---

## 3. Event catalogue

Naming: `domain:action`, lowercase, colon-delimited. Client-to-server uses imperative verbs.
Server-to-client uses past tense or a `_state` noun.

**Never reuse one name in both directions.** That is the single most common source of echo bugs.

### 3.1 Client to server

Each takes one object argument plus an ack callback.

| Event | Payload | Ack |
|---|---|---|
| `review:join` | `{ reviewId }` | `{ ok, review, participants: [{ id, name, role, online }], messages: [30 newest], nextCursor, comments }` |
| `review:leave` | `{ reviewId }` | `{ ok }` |
| `review:history` | `{ reviewId, before, limit <= 50 }` | `{ messages, nextCursor }` |
| `review:complete` | `{ reviewId, summary? }` | `{ ok, review }` |
| `chat:send` | `{ reviewId, clientId, body, replyTo? }` | `{ ok, message }` or `{ ok: false, code }` |
| `chat:typing` | `{ reviewId, typing }` | none, volatile |
| `chat:read` | `{ reviewId, upTo }` | `{ ok }` |
| `comment:create` | `{ reviewId, resumeId, sectionKey, entryId, fieldPath, anchorText, body, clientId }` | `{ ok, comment }` |
| `comment:resolve` | `{ commentId, resolved }` | `{ ok, comment }` |
| `comment:delete` | `{ commentId }` | `{ ok }` |
| `notify:read` | `{ ids: [] }` | `{ ok, unread }` |
| `notify:read_all` | none | `{ ok, unread }` |
| `presence:subscribe` | `{ userIds: [] }` | `{ ok, online: [] }` |
| `presence:unsubscribe` | `{ userIds: [] }` | `{ ok }` |
| `admin:live_subscribe` | none | `{ ok, snapshot }` |

### 3.2 Server to client

**To the socket:**

`session:ready { userId, role, serverTime, recovered }`
`session:expiring { expiresAt }`
`session:revoked { reason }`
`error:event { event, code, message, details? }`, the fallback channel for events whose ack was
already consumed.

**To `review:<id>`:**

| Event | Payload | Note |
|---|---|---|
| `chat:message` | `{ message }` | Sent to the **whole room including the sender**. See 5.2. |
| `chat:typing_state` | `{ reviewId, userId, typing }` | excludes sender |
| `chat:read_state` | `{ reviewId, userId, upTo, at }` | |
| `comment:created` / `updated` / `deleted` | `{ comment }` / `{ commentId, reviewId, sectionKey }` | |
| `review:participant_joined` / `_left` | `{ reviewId, user, at }` | |
| `review:presence` | `{ reviewId, online: [userId] }` | **full idempotent snapshot** on every membership change. Cheap for 2 or 3 people and immune to drift. |
| `review:completed` | `{ reviewId, by, at, summary }` | |

**To `resume:<id>`:** `comment:created`, `comment:updated`, `comment:deleted`, `review:completed`.

**To `user:<id>`:** `notify:new { notification }`, `notify:count { unread }` for cross-tab badge
sync, `share:viewed { resumeId, views, downloads }`.

**To `presence:<targetId>`:** `presence:changed { userId, online, lastSeenAt }`.

**To `admin:live`:** `admin:live_stats { connectedUsers, connectedSockets, activeReviewRooms, at }`.

### 3.3 Frozen payload shapes

```ts
message      { _id, reviewId, senderId, senderName, body, clientId,
               createdAt, editedAt|null, deletedAt|null }

comment      { _id, reviewId, resumeId, sectionKey, entryId|null,
               fieldPath|null, anchorText, body, authorId, authorName,
               resolved, createdAt }

notification { _id, userId, type, actorId, actorName,
               entity: { kind, id }, preview, count, readAt|null, createdAt }
```

`sectionKey` is the enum shared with the editor: `personal | summary | education | experience |
projects | skills | certifications | achievements | languages | references`.

---

## 4. Presence

**Derive it. Never store a boolean.**

```ts
// connect
socket.join(`user:${id}`)
if (roomSizeJustWentZeroToOne) emitTo(`presence:${id}`, 'presence:changed', { online: true })

// disconnecting
setTimeout(() => {
  if (io.of('/').adapter.rooms.get(`user:${id}`) === undefined) {
    emitTo(`presence:${id}`, 'presence:changed', { online: false })
  }
}, 10_000)
```

The 10-second grace period absorbs page reloads, tab switches and mobile network flaps.

Persist only `lastSeenAt`, throttled to at most one write per 60 seconds per user, plus one on
the final offline transition.

**A naive `isOnline` boolean on the user document is wrong four separate ways:**

1. Closing one of three tabs marks the user offline.
2. A killed browser or lost network never fires `disconnect`, stranding the flag at `true` forever.
3. A server restart or Render spin-down strands **every** user at `true`.
4. Reconnect flapping on mobile turns it into a write hot spot on the users collection.

**Detection has a real ceiling.** A hard-killed tab is only noticed after
`pingInterval + pingTimeout`, which is 45 seconds at defaults. The UI therefore says "last seen",
never claiming precision it does not have.

---

## 5. Messaging

### 5.1 The one write path

Every real-time mutation follows this order:

1. **Persist to MongoDB.**
2. `io.to(room).emit(...)`
3. Compute absent recipients and create notifications:

```ts
const present = new Set(
  (await io.in(`review:${id}`).fetchSockets()).map(s => s.data.user.id)
)
for (const uid of recipients.filter(r => !present.has(r))) {
  const n = await upsertNotification(uid, ...)
  io.to(`user:${uid}`).emit('notify:new', n)
}
```

**Emit success is never proof of delivery. The notification row is.**

### 5.2 Broadcast to the whole room, then dedupe

`chat:message` goes to the entire room **including the sender**, and the originating tab dedupes
on `clientId`.

The alternative, `socket.to(room).emit` to exclude the sender, avoids the duplicate but then the
sender's **other tabs never receive the message**, which is silently broken multi-tab.

### 5.3 Message loss and idempotent retry

```
client                          server
  |  clientId = crypto.randomUUID()
  |  render bubble, status 'pending'
  |  socket.timeout(10000).emit('chat:send', { clientId, ... })
  |                                 persist, unique partial index
  |                                 on { review, clientId }
  |  <-- ack { ok, message }        E11000 on retry -> look up
  |  swap by clientId, 'sent'       existing doc, return { ok: true }
  |
  |  timeout or error -> status 'failed', retry affordance
  |  retry re-sends the SAME clientId
```

The unique partial index on `{ review: 1, clientId: 1 }` is what makes retry idempotent rather
than duplicating.

Dedupe incoming broadcasts against a `Map<clientId, _id>` so the sender never sees its own message
twice.

### 5.4 History

Cursor pagination on `_id`, never `skip`:

```js
find({ review, _id: { $lt: cursor } }).sort({ _id: -1 }).limit(30)
```

Skip degrades quadratically and shifts and duplicates rows when new messages arrive between page
fetches.

---

## 6. Reconnection

```ts
connectionStateRecovery: {
  maxDisconnectionDuration: 120_000,
  skipMiddlewares: false,              // set explicitly, so JWT middleware re-runs
}
```

**Treat connection state recovery as a latency optimisation only.** It buffers in server memory
and is destroyed by every redeploy, and on Render's free tier the instance restarts after each
15-minute idle spin-down. The Redis adapter does not support it at all.

**The correctness path** is: on every connect, re-emit `review:join` and reconcile by fetching
messages newer than the last `_id` the client holds. That is what survives redeploys and spin-ups.

### 6.1 Cold-start UX

Fire `fetch('/api/health')` at app boot in parallel with `socket.connect()`.

On the **first** `connect_error`, do not show an error. Switch a Context flag to `waking` and
render one quiet line of body text:

> Connecting to the server. This can take up to a minute after a period of inactivity.

Only after roughly 90 seconds, or on a `connect_error` carrying auth `err.data`, does it become a
real error state. No spinner beyond a slow opacity change, per the design system.

---

## 7. Admin live counters

```ts
const rooms = io.of('/').adapter.rooms
let users = 0, reviews = 0
for (const k of rooms.keys()) {
  if (k.startsWith('user:')) users++
  else if (k.startsWith('review:')) reviews++
}
```

**`io.engine.clientsCount` counts tabs, not users.** **`adapter.rooms.size` includes one implicit
self-room per socket.** Only a prefix-filtered count is correct for FR 9.1.

Emit `admin:live_stats` on a 5-second interval that runs **only while**
`adapter.rooms.get('admin:live')?.size` is non-zero.

---

## 8. Authorisation on every event

**Authorise against the database, not just the handshake.** Room membership is a capability and a
room name is not a secret.

`review:join` re-verifies that `socket.data.user.id` is the resume owner or the assigned reviewer
for that `reviewId`.

**Explicit deny for `role === 'admin'`** on `review:*` and `resume:*` joins and on every `chat:*`
and `comment:*` handler.

This is a positive check, not an absence of a grant. An admin holds a valid JWT, so the handshake
middleware passes and nothing stops a room join unless a handler refuses it. The "admin must not
read private resume content" requirement gets violated by omission rather than by an obvious
mistake, which is exactly why it needs a line of code a reviewer can point at.

---

## 9. Anti-abuse

A single `socket.use()` guard, in this order:

1. Reject if `!ALLOWED_EVENTS.has(event)`.
2. Reject if the payload is not a single plain object. This blocks argument-array smuggling.
3. `rate-limiter-flexible` `RateLimiterMemory` keyed on `socket.data.user.id`:
   global 30 points per 10s, `chat:send` 10 per 10s, `comment:create` 20 per 60s.
4. Zod `safeParse` against a per-event schema shared with the client.

**`express-validator` cannot do any of this.** It is request-only and there is no `req` object in
a socket handler. This is a genuine gap in the specified stack, resolved in ADR-009.

`maxHttpBufferSize: 1e5` (100 KB), since nothing binary crosses the socket. Cloudinary uploads go
over HTTP via Multer.

### 9.1 Limits

| Field | Limit |
|---|---|
| chat body | 1 to 2000 chars, trimmed |
| comment body | 1 to 1000 chars |
| `anchorText` | 200 chars |
| `notify:read` ids | 100 entries |
| `presence:subscribe` userIds | 50 |

Reject empty-after-trim. Strip C0 control characters except newline. Cap consecutive newlines at 2.

**Store plain text and render escaped.** Never `dangerouslySetInnerHTML` a message or comment body.

### 9.2 Typing indicator

Throttle client-side to at most once per 2 seconds while composing, plus an explicit
`typing: false` after 3 seconds idle and on send. Drop server-side above 1 per second **silently**,
not with an error.

Send with `socket.volatile.emit` so it is never buffered and replayed after a reconnect.

---

## 10. Deployment

One Render instance. No Redis. No sticky sessions. Default in-memory adapter.

```ts
new Server(httpServer, {
  cors: { origin: originChecker, credentials: true },
  connectionStateRecovery: { maxDisconnectionDuration: 120_000, skipMiddlewares: false },
  maxHttpBufferSize: 1e5,
})
```

**Socket.IO needs its own `cors` option.** The Express `cors()` middleware does not run on the
Engine.IO handshake. HTTP works, sockets fail, and the error message points at CORS so you spend
an hour editing the wrong config.

Attach `io` to Express through a module singleton so REST controllers can emit. Never construct a
second `new Server()`.

**Do not add a keep-alive cron.** The free tier grants 750 instance hours per month and a
permanently warm service consumes about 720. Exceeding it suspends the service for the rest of the
month. It is also unnecessary: Engine.IO's 25-second heartbeats already count as inbound traffic
whenever a user has the app open.

**If R4U ever runs two or more instances**, add `@socket.io/mongo-adapter` against the existing
Atlas cluster (it is a replica set, so change streams work, and unlike the Redis adapter it
supports connection state recovery), and force `transports: ['websocket']` to sidestep missing
session affinity. Without an adapter, broadcasts silently reach only the sockets on the emitting
instance: no error, just messages half the room never sees.

All emissions go through `sockets/emitters.ts` (`notifyUser`, `broadcastReview`), so that change
is one line and touches no service code.

---

## 11. Design constraints on real-time UI

Presence and typing indicators are exactly where generated-looking UI creeps in. Per the design
system, and repeated here because this is where it gets improvised:

- Presence is a **filled versus hollow ink glyph**. Never a green dot. Never pulsing.
- Typing is **text**: "Neha is typing". Never three animated dots.
- Unread counts are tabular numerals in the ink ramp. Never a coloured badge.
- The connection-status indicator is one line of body text, not an icon with a colour state.
