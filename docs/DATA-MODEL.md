# Data Model

Fourteen collections. Every index is created explicitly, because `autoIndex` is off in production.

---

## 1. Index budget

Atlas M0 gives **0.5 GB total, including indexes**, and enforces 100 operations per second.
Mongoose's default `autoIndex: true` rebuilds indexes on every process start, and this service
spins down after 15 minutes idle, so it boots often. Set `autoIndex: false` in production and
create indexes explicitly in a migration script.

Four collections grow without bound and carry TTL indexes:

| Collection               | TTL                            |
| ------------------------ | ------------------------------ |
| `Notification.createdAt` | 90 days                        |
| `ActivityLog.at`         | 180 days                       |
| `ShareView.createdAt`    | 48 hours                       |
| `RefreshToken.expiresAt` | 0 (expires at the stored time) |

Without these, an admin activity log plus a free-tier cluster is how the database dies.

---

## 2. User

```ts
{
  _id, name, email,                    // email lowercased, trimmed
  passwordHash,                        // bcryptjs, cost 12, select: false
  role: 'user' | 'reviewer' | 'admin', // default 'user'
  status: 'active' | 'blocked',
  tokenVersion: Number,                // bumped to invalidate all sessions
  headline, phone, location,
  avatar: { publicId, version },       // Cloudinary, never a full URL
  theme: 'light' | 'dark' | 'system',
  lastSeenAt: Date,                    // throttled, see REALTIME.md
  failedLoginCount: Number,
  lockUntil: Date,
  reviewerProfile: {                   // only when role === 'reviewer'
    bio, expertise: [String],
    acceptingRequests: Boolean,
    openSlots: Number
  },
  createdAt, updatedAt
}
```

Indexes: `{ email: 1 }` unique. `{ role: 1, status: 1 }` for the admin table.

- `passwordHash` carries `select: false`. It must never appear in an API response.
- **Never store `resumes: [ObjectId]`.** Unbounded arrays are the classic MongoDB antipattern.
  Query `Resume.find({ owner })` instead.
- `lockUntil` and `failedLoginCount` back the login rate limiter with persistent state.
  `express-rate-limit`'s in-memory store is wiped on every Render restart, which resets an
  attacker's brute-force budget.
- `tokenVersion` appears in the access token as `tv`. Bumping it invalidates every issued token,
  which is what makes "block this user" and "password was reset" take effect immediately.

---

## 3. Resume

The central document. One document per resume, per ADR-007.

```ts
{
  _id, owner: ref User,
  title,                               // user-defined, e.g. "Backend Developer CV"
  resumeType: 'fresher' | 'professional' | 'technical' | 'academic',
  status: 'draft' | 'in_review' | 'reviewed',
  templateKey,                         // maps to a repo function, see ARCHITECTURE.md
  design: {
    accent, typeScale, leading, sectionSpacing, margins
  },
  personal: {                          // stripped by the pre-find hook
    fullName, headline, email, phone, location,
    links: [{ label, url }]
  },
  sections: [{                         // stripped by the pre-find hook
    _id, type, title, hidden, locked,
    keepTogether, startOnNewPage,
    entries: [{ _id, hidden, data }]   // data validated per type by SECTION_REGISTRY
  }],
  notes,                               // never rendered, redacted from every share payload
  meta: {                              // denormalised so admin queries never touch content
    completeness, wordCount, sectionCount, pageCount, atsScore
  },
  version: Number,                     // hand-managed optimistic concurrency
  createdAt, updatedAt
}
```

Indexes: `{ owner: 1, updatedAt: -1 }` for the dashboard list.
`{ owner: 1, title: 'text' }` for FR 3.6 search. Atlas M0 has no Atlas Search, so a text index or
a regex is the only option.

### 3.1 Section ordering

**Array position is the authoritative order.** No `order` field, no fractional indices. At 15
sections and 30 entries a reorder is one whole-array `$set`.

`hidden` exists on both the section and every entry. FR 4.3 only asks for section level; entry
level costs one checkbox and is something the incumbents do poorly.

### 3.2 The content strip

```ts
resumeSchema.pre(/^find/, function () {
  if (this.getOptions().contentScope !== 'full') {
    this.select('-sections -personal -notes')
  }
})
```

Fail-closed. `contentScope: 'full'` is confined to one service function that throws
`403 ADMIN_CONTENT_FORBIDDEN` for role `admin` unconditionally. See ADR-008.

`meta` is denormalised on every write precisely so that admin dashboards and analytics never need
to opt in.

### 3.3 Writing rules

- **Never call `.save()` on a Resume.** `Schema.Types.Mixed` paths are not change-tracked.
  Mutating `resume.sections[0].entries[1].data.company` and saving persists nothing without
  `markModified()`.
- Use `updateOne` with explicit `$set` paths.
- Target array elements with `arrayFilters` on subdocument `_id`, **never by index**. Indices
  shift the moment a section is reordered or deleted, so an in-flight index-based patch corrupts
  a neighbouring entry.
- `version` sits in the `updateOne` filter with `$inc: { version: 1 }`. Do not use Mongoose's
  `optimisticConcurrency`: it only fires on `doc.save()`, which rewrites the whole document.

### 3.4 SECTION_REGISTRY

`entry.data` is validated per section `type` against a shared constant in `shared/`, imported by
both the Express validators and the React form renderer. One source of truth for field names,
types and character limits, so the client counter and the server rejection can never disagree.

Types: `summary`, `education`, `experience`, `projects`, `skills`, `certifications`,
`achievements`, `languages`, `references`, `publications`, `custom`.

Custom sections are a **typed choice**, not a generic key-value blob: "this custom section holds
items shaped like Experience / Education / Skills / plain text". That yields a real form and a
real template renderer for free.

---

## 4. ResumeVersion

```ts
{ _id, resume: ref Resume, owner: ref User,
  data,                                // full structuredClone snapshot
  label,                               // 'Template changed to Ledger', 'Manual save'
  trigger: 'template' | 'import' | 'restore' | 'manual' | 'daily',
  createdAt }
```

Index: `{ resume: 1, createdAt: -1 }`.

**Snapshot at milestones only**, never per autosave. Per-keystroke snapshots explode storage and
make the version list useless. Restore writes the snapshot back through the normal update path, so
the restore itself becomes a new version and nothing is ever lost.

---

## 5. Template

Metadata only. No markup, ever. See ADR-005.

```ts
{ _id, key, name, category, thumbnail: { publicId },
  active, order,
  defaults: { typeScale, leading, gap, margins, accent },
  recommendedOrder: [String],
  slots: { main: [String], aside: [String] },
  atsProfile: {
    columns, hasTables, hasImages, headerFooterContent,
    bodyFont, bulletGlyph, dateLayout, maxDimensionAScore
  },
  createdAt, updatedAt }
```

Index: `{ key: 1 }` unique, `{ active: 1, order: 1 }`.

`maxDimensionAScore` is what lets the ATS checker say "this template caps you at 21 of 30 on
parseability, switch to Foundry to recover 9 points."

A deactivated template is hidden from new resumes without affecting existing ones, per FR 9.4.

---

## 6. Review

```ts
{ _id, resume: ref Resume, owner: ref User, reviewer: ref User,
  status: 'requested' | 'declined' | 'active' | 'completed',
  message,                             // the owner's request note
  summary,                             // the reviewer's closing note
  participants: [{
    user: ref User,
    lastReadMessageId: ObjectId,
    lastReadAt: Date
  }],
  requestedAt, respondedAt, completedAt,
  round,                               // 1, then +1 each time the owner sends an update back
  resubmittedAt,
  rating, ratingNote, ratedAt }        // the owner's 1 to 5 verdict on a completed review
```

Indexes: `{ owner: 1, status: 1 }`, `{ reviewer: 1, status: 1 }`, `{ resume: 1 }`.

Read receipts live on the participant subdocument as `lastReadMessageId` plus `lastReadAt`. That
is O(participants) storage. A per-message `readBy` array is O(messages x participants), rewrites
hot documents on every scroll, and grows without bound.

The reviewer directory aggregates `status`, `rating` and `respondedAt - requestedAt` per reviewer
in one `$group` over `{ reviewer: 1, status: 1 }`, so a reviewer's record is what they did here,
never what they typed into their profile.

Per ADR-012, `requested` and `declined` exist because assignment is an explicit request the
reviewer accepts or refuses, not auto-allocation.

---

## 7. Comment

Own collection, not embedded. Written by a different actor than the resume owner, so embedding
creates write contention on one hot document, and it needs independent cursor pagination.

```ts
{ _id, review: ref Review, resume: ref Resume,
  author: ref User,
  sectionKey,                          // enum shared with the editor
  entryId,                             // ObjectId or null
  fieldPath,                           // string or null
  anchorText,                          // max 200 chars, for orphan display
  body,                                // 1 to 1000 chars, plain text
  resolved: Boolean,
  createdAt, updatedAt }
```

Index: `{ resume: 1, createdAt: -1 }`, `{ review: 1, resolved: 1 }`.

Comments anchor to **stable section and entry ids in the data model**, never to DOM geometry. That
is what lets them survive both renderers and every template switch.

---

## 8. Message

```ts
{ _id, review: ref Review, sender: ref User,
  body,                                // 1 to 2000 chars, plain text
  clientId,                            // uuid, client-generated, for dedup
  editedAt, deletedAt, createdAt }
```

Indexes: `{ review: 1, _id: -1 }` for cursor pagination.
`{ review: 1, clientId: 1 }` **unique partial**, which is what makes retry idempotent.

Paginate with an ObjectId cursor, never `skip`:

```js
find({ review, _id: { $lt: cursor } })
  .sort({ _id: -1 })
  .limit(30)
```

Skip-based pagination degrades quadratically and, worse, shifts and duplicates rows when new
messages arrive between page fetches.

**The server always stamps `createdAt`.** Never trust a client clock for ordering. The client
supplies only `clientId`.

---

## 9. Notification

```ts
{ _id, user: ref User, type, actor: ref User,
  entity: { kind: 'review' | 'resume' | 'comment', id },
  preview,
  count: Number,                       // coalescing counter
  readAt, createdAt }
```

Indexes: `{ user: 1, readAt: 1, createdAt: -1 }`. TTL on `createdAt`, 90 days.

**Coalesce chat notifications** by upserting on
`{ user, type: 'chat', 'entity.id': reviewId, readAt: null }` with `$inc: { count: 1 }`. A
40-message burst produces one unread row, not forty. Emitting one notification per chat message
buries the notification centre and makes the unread badge meaningless.

---

## 10. ShareLink

```ts
{ _id, resume: ref Resume, owner: ref User,
  tokenHash,                           // SHA-256 of the token. The token itself is never stored.
  slug,                                // nanoid(12), the public path segment
  enabled: Boolean,
  expiresAt: Date,
  redact: { email: Boolean, phone: Boolean, address: Boolean },
  views: Number, downloads: Number,
  lastViewedAt, lastDownloadedAt,
  createdAt }
```

Index: `{ tokenHash: 1 }` unique, `{ resume: 1 }`.

- Token format `r4u_sh_` plus 32 random bytes base64url. **Store only the SHA-256**, exactly like
  a password. An unhashed token in the database means a leaked backup exposes every private resume.
- **Never use the resume `_id` as the public token.** It leaks the creation timestamp and is
  partially sequential.
- Check `enabled` and `expiresAt` in the query rather than TTL-deleting the document, so view and
  download counts survive expiry.
- `redact` is both a product feature and the single largest reduction in PII exposure for sharing.

Every share response sends `X-Robots-Tag: noindex, nofollow` and `Referrer-Policy: no-referrer`.
A resume is a PII document, and the defaults are for Google to index it and for any outbound link
to leak the share URL in the `Referer` header.

---

## 11. ShareView

```ts
{ _id, shareLink: ref ShareLink, resume: ref Resume,
  fingerprint,                         // hash of trusted-proxy IP + UA + accept-language
  kind: 'view' | 'download',
  createdAt }
```

Index: `{ shareLink: 1, fingerprint: 1, kind: 1, bucket: 1 }` **unique**, where `bucket` is the clock hour
(hours since the epoch). The unique index is what makes the dedupe atomic: two overlapping requests
from one visitor cannot both insert, so neither can both count. TTL 48 hours on `createdAt`.

Deduplicate within a **one-hour window** and **exclude the owner's own visits**. Without both, the
counters are noise and the analytics feature actively looks broken, which is worse than not
shipping it.

A daily rollup `{ resume, date, views, downloads }` with a unique compound index backs the
sparkline on the share page and costs one extra upsert.

---

## 12. ActivityLog

```ts
{ _id, actor: ref User, action, targetType, targetId,
  meta,                                // explicit field allowlist, never raw
  ip, at }
```

Index: `{ at: -1 }`, `{ actor: 1, at: -1 }`. TTL on `at`, 180 days.

Written through a **buffered writer** flushed every 2 seconds or on `setImmediate`. Logging must
never block a request.

**`meta` is serialised through an explicit field allowlist.** A `Mixed` field with no allowlist
will eventually capture a request body containing resume content, at which point the admin
activity-log view leaks exactly what ADR-008 exists to protect.

---

## 13. Report

```ts
{ _id, reporter: ref User, shareLink: ref ShareLink,
  targetType: 'share_link' | 'user' | 'comment',   // NOT 'resume'
  reason, snippet,                     // reporter-supplied, stored on the report
  status: 'open' | 'actioned' | 'dismissed',
  handledBy: ref User, handledAt, createdAt }
```

Index: `{ status: 1, createdAt: -1 }`.

**`targetType` deliberately omits a private resume.** Only a resume with an active public share
link is reportable, and the admin queue renders through that public share view. This is the
schema-level resolution of the FR 9.5 versus FR 9.6 contradiction. See ADR-008.

---

## 14. RefreshToken

```ts
{ _id, user: ref User,
  tokenHash,                           // SHA-256
  family,                              // rotation family id
  consumedAt, userAgent, ip,
  expiresAt, createdAt }
```

Index: `{ tokenHash: 1 }` unique, `{ user: 1 }`, TTL on `expiresAt`.

Rotate on every use. If a consumed token is replayed, **revoke the entire family**: that is the
signature of a stolen token being used alongside the legitimate one.

On password reset, bump `User.tokenVersion` and delete every RefreshToken for that user. A reset
must kill every existing session, which is the entire point of resetting after a compromise.

---

## 15. AtsScore

```ts
{ _id, resume: ref Resume, owner: ref User, rubricVersion,
  total, mode: 'full' | 'format_only',
  dimensions: [{ id, earned, possible }],
  checks: [{ checkId, status, earned, possible }],
  createdAt }
```

Index: `{ resume: 1, createdAt: -1 }`.

**No resume text. No job description text.** Only check ids, statuses and points. An ATS-score
collection full of resume prose would violate ADR-008 in spirit and in any database dump.

---

## 16. PasswordResetToken

```ts
{ _id, user: ref User, tokenHash, usedAt, expiresAt, createdAt }
```

SHA-256 hashed, 15 minute expiry, single use. TTL on `expiresAt`.

---

## 17. Schema evolution

Use Zod with `.catch(default)` per field and a permissive top-level object, so a resume saved under
an older schema always loads with sane defaults instead of erroring.

This replaces database migrations for the document body, which is what makes it possible to keep
shipping template and metadata changes throughout the project without breaking existing resumes.
