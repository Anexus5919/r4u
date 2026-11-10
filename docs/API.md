# REST API

Base path `/api`. JSON only. The Socket.IO event catalogue lives in `REALTIME.md`.

---

## 1. Conventions

### 1.1 Envelope

```jsonc
// success
{ "data": { }, "meta": { } }          // meta only when paginated

// error
{ "error": { "code": "VALIDATION_FAILED", "message": "...", "details": [ ] } }
```

`code` is a stable machine-readable string. `message` is safe to display. `details` carries
per-field validation errors as `{ path, message }`.

**Stack traces never appear in a response.** The central error middleware logs them through pino
with a request id and returns a controlled shape.

### 1.2 Status codes

| Code | Used for                                                         |
| ---- | ---------------------------------------------------------------- |
| 200  | Successful read or update                                        |
| 201  | Resource created                                                 |
| 204  | Successful delete                                                |
| 400  | Malformed request                                                |
| 401  | Missing, invalid or expired access token                         |
| 403  | Authenticated but not permitted by role                          |
| 404  | Not found, **and also non-owner access to an existing resource** |
| 409  | Version conflict on autosave, or duplicate email on register     |
| 422  | Validation failed                                                |
| 429  | Rate limited                                                     |
| 500  | Unhandled                                                        |

**404 rather than 403 for non-owner resource access.** A 403 confirms the id exists, which is an
enumeration oracle over a collection of PII documents.

### 1.3 Authentication

`Authorization: Bearer <accessToken>` on every protected route. The access token lives in memory
on the client, never in localStorage.

The refresh token is an httpOnly cookie scoped to `Path=/api/auth`, read by exactly two endpoints.
Those two are defended by an `Origin` allowlist, a required `X-Requested-With: r4u` header, and
rejection of any `Content-Type` other than `application/json`. Every other endpoint uses the
bearer header and has no CSRF surface.

### 1.4 Pagination

Query `?page=1&limit=20`, capped at 100. Response carries
`meta: { page, limit, total, totalPages }`.

Chat history is the exception and uses an ObjectId cursor over Socket.IO, never `skip`.

### 1.5 Input handling

Controllers read **only** `req.validated`, produced by `matchedData(req)`. An ESLint
`no-restricted-properties` rule bans `req.body` and `req.query` outside `src/middleware/`.

On Express 5, `req.query` is a getter, so express-validator's sanitizers do not write back to it.
`matchedData(req)` is the only correct read, and this also eliminates mass assignment of `role`,
`owner` and `version` as a class of bug.

### 1.6 Rate limits

| Scope                                | Limit                                                                               |
| ------------------------------------ | ----------------------------------------------------------------------------------- |
| `POST /auth/login`, `/auth/register` | 5 per 15 min per IP, plus persistent `failedLoginCount` and `lockUntil` on the user |
| `POST /auth/forgot-password`         | 3 per hour per IP **and** 3 per hour per email                                      |
| `GET /public/r/:slug`                | 60 per hour per IP                                                                  |
| Everything else                      | 300 per 15 min per IP                                                               |

The in-memory store resets on every Render spin-down, so limits are effectively per-uptime-window.
Stated honestly rather than described as robust brute-force protection. The persistent counters on
the User document are what actually survive a restart.

### 1.7 Body size

`express.json({ limit: '256kb' })` globally, `1mb` only on `PATCH /resumes/:id`,
`express.urlencoded({ limit: '32kb' })`. Multer at 2 MB, one file, memory storage, with
**server-side magic-byte verification**. A client-supplied `mimetype` is not evidence.

---

## 2. Health

| Method | Path          | Guard  |
| ------ | ------------- | ------ |
| GET    | `/api/health` | public |

Returns `{ status, uptime, db: mongoose.connection.readyState }`. Not behind auth. Wired to the
Docker `HEALTHCHECK`, used by the CI smoke test, and fired by the client at boot to trigger a
Render wake-up in parallel with the socket connect.

`readyState` catches the very common "server up, Atlas unreachable" state that otherwise surfaces
as mystery 500s.

---

## 3. Auth

| Method | Path                        | Guard  | Notes                                                                                                        |
| ------ | --------------------------- | ------ | ------------------------------------------------------------------------------------------------------------ |
| POST   | `/api/auth/register`        | guest  | Returns access token, sets refresh cookie. 409 on duplicate email.                                           |
| POST   | `/api/auth/login`           | guest  | Unknown email still runs a bcrypt compare against a fixed dummy hash and returns an identical generic error. |
| POST   | `/api/auth/refresh`         | cookie | Rotates the token. Replay of a consumed token revokes the whole family.                                      |
| POST   | `/api/auth/logout`          | cookie | Deletes the refresh token, clears the cookie.                                                                |
| POST   | `/api/auth/forgot-password` | guest  | **Always 200**, regardless of whether the account exists.                                                    |
| POST   | `/api/auth/reset-password`  | token  | Bumps `tokenVersion` and deletes every refresh token for the user.                                           |

A blocked user is denied at `authenticate`, because blocking bumps `tokenVersion` and every issued
token carries `tv`.

---

## 4. Users

| Method | Path                             | Guard    | Notes                                                                                           |
| ------ | -------------------------------- | -------- | ----------------------------------------------------------------------------------------------- |
| GET    | `/api/users/me`                  | user     |                                                                                                 |
| PATCH  | `/api/users/me`                  | user     | name, headline, phone, location, theme                                                          |
| PATCH  | `/api/users/me/password`         | user     | Requires the current password                                                                   |
| POST   | `/api/users/me/avatar`           | user     | Multipart, streamed to Cloudinary with an eager 256x256 crop                                    |
| DELETE | `/api/users/me`                  | user     | Cascades to resumes, reviews, messages, comments, notifications                                 |
| GET    | `/api/users/reviewers`           | user     | Directory for the review-request modal. Returns only `reviewerProfile` fields and online state. |
| GET    | `/api/users/me/reviewer-profile` | reviewer | The reviewer's own directory profile                                                            |
| PATCH  | `/api/users/me/reviewer-profile` | reviewer | `bio`, `expertise`, `acceptingRequests`, `openSlots`                                            |

`GET /api/users/reviewers` returns reviewers where `acceptingRequests` is true. It never exposes
email or phone.

---

## 5. Resumes

| Method | Path                                     | Guard | Notes                                                                            |
| ------ | ---------------------------------------- | ----- | -------------------------------------------------------------------------------- |
| GET    | `/api/resumes`                           | user  | `?q=&status=&sort=&page=&limit=`. Content stripped by the pre-find hook.         |
| POST   | `/api/resumes`                           | user  | `{ title, templateKey, resumeType }`                                             |
| GET    | `/api/resumes/:id`                       | owner | The one route that opts into `contentScope: 'full'`                              |
| PATCH  | `/api/resumes/:id`                       | owner | Autosave. See 5.1.                                                               |
| DELETE | `/api/resumes/:id`                       | owner |                                                                                  |
| POST   | `/api/resumes/:id/duplicate`             | owner | `{ title?, jobDescription? }`. The JD form is Tailor for a job.                  |
| GET    | `/api/resumes/:id/versions`              | owner |                                                                                  |
| POST   | `/api/resumes/:id/versions`              | owner | Manual snapshot with a label                                                     |
| POST   | `/api/resumes/:id/versions/:vid/restore` | owner | Restores through the normal update path, so the restore itself becomes a version |
| POST   | `/api/resumes/import`                    | user  | JSON Resume or R4U JSON                                                          |
| GET    | `/api/resumes/:id/export.json`           | owner |                                                                                  |

### 5.1 Autosave

```jsonc
PATCH /api/resumes/:id
{
  "version": 41,
  "ops": [
    { "op": "setField", "sectionId": "...", "entryId": "...", "path": "title", "value": "..." },
    { "op": "reorderSections", "order": ["...", "..."] },
    { "op": "toggleSection", "sectionId": "...", "hidden": true }
  ]
}
```

Allowlisted ops only: `setField`, `toggleSection`, `reorderSections`, `addEntry`, `removeEntry`,
`setDesign`. A free-form JSON Patch `path` would let a client write `/owner`, `/version` or
`/meta.completeness`.

Array elements are targeted with `arrayFilters` on subdocument `_id`, never by index.

On conflict, `409` with `{ error: { code: 'VERSION_CONFLICT' }, data: { version, resume } }`. The
client auto-rebases when the conflicting ops touch disjoint paths and prompts only on a same-path
collision. A blanket "reload, you will lose changes" dialog is what makes multi-tab editors feel
broken.

---

## 6. Templates

| Method | Path                  | Guard  |
| ------ | --------------------- | ------ |
| GET    | `/api/templates`      | public |
| GET    | `/api/templates/:key` | public |

Entries are a code renderer (`baseKey`) plus metadata and design `defaults`. Creating a resume with a
preset key stores the renderer key and applies the preset's design; a deactivated entry answers 422.

Returns metadata and `atsProfile`. Never markup. The gallery renders from the repo fixture.

---

## 7. ATS

| Method | Path                   | Guard |
| ------ | ---------------------- | ----- |
| POST   | `/api/resumes/:id/ats` | owner |
| GET    | `/api/resumes/:id/ats` | owner |

```jsonc
POST { "jobDescription": "..." }   // optional; omit for format-only mode

// 200
{ "data": {
    "rubricVersion": "1.0.0",
    "total": 78,
    "mode": "format_only",
    "dimensions": [ { "id": "A", "earned": 24, "possible": 30 } ],
    "checks":     [ { "checkId": "A2", "status": "partial", "earned": 3,
                      "possible": 6, "message": "...", "deepLink": "..." } ],
    "parserPreview": "..."
} }
```

`parserPreview` is returned in the response and **never persisted**. Neither is the job
description. Only check ids, statuses and points are stored, per ADR-011.

Job descriptions are **pasted only**. R4U never fetches one from a URL: server-side scraping of
job boards means CORS workarounds, terms-of-service violations, unpredictable HTML, and a feature
that breaks during the demo.

---

## 8. Sharing

| Method | Path                           | Guard  | Notes                                                     |
| ------ | ------------------------------ | ------ | --------------------------------------------------------- |
| GET    | `/api/resumes/:id/share`       | owner  | Lists the resume's links with counts, never their tokens  |
| POST   | `/api/resumes/:id/share`       | owner  | Creates the link. **Returns the raw token exactly once.** |
| PATCH  | `/api/share/:id`               | owner  | `enabled`, `expiresAt`, `redact`                          |
| DELETE | `/api/share/:id`               | owner  |                                                           |
| GET    | `/api/share/:id/analytics`     | owner  | Lifetime counters plus the daily rollup                   |
| GET    | `/api/public/r/:slug`          | public | Read-only render payload                                  |
| POST   | `/api/public/r/:slug/download` | public | Records a download, returns the render payload            |
| POST   | `/api/public/r/:slug/report`   | public | `{ reason, snippet? }`. 5 per hour per IP                 |

The raw token is shown once at creation. Only its SHA-256 is stored, exactly like a password, so a
leaked backup does not expose every private resume.

`enabled` and `expiresAt` are checked **in the query** rather than TTL-deleting the document, so
view and download counts survive expiry.

Every public response carries `X-Robots-Tag: noindex, nofollow` and `Referrer-Policy: no-referrer`,
honours the `redact` flags, and omits `notes` entirely.

Counting deduplicates on a one-hour window keyed on trusted-proxy IP with a user-agent and
accept-language fallback, and **excludes the owner's own views and downloads**.

---

## 9. Reviews

| Method | Path                        | Guard           | Notes                                                                                        |
| ------ | --------------------------- | --------------- | -------------------------------------------------------------------------------------------- |
| GET    | `/api/reviews`              | user, reviewer  | Scoped to the caller as owner or reviewer                                                    |
| POST   | `/api/reviews`              | owner           | `{ resumeId, reviewerId, message }`. Status `requested`.                                     |
| GET    | `/api/reviews/:id`          | owner, reviewer | **Explicit deny for admin**                                                                  |
| PATCH  | `/api/reviews/:id/respond`  | reviewer        | `{ accept: boolean }`                                                                        |
| PATCH  | `/api/reviews/:id/complete` | reviewer        | `{ summary }`. Sets the owner-visible resume status.                                         |
| GET    | `/api/reviews/:id/comments` | owner, reviewer | Comments are created over the socket; this is the initial load and the Postman-testable path |
| GET    | `/api/reviews/:id/messages` | owner, reviewer | `?before=<messageId>`. Cursor page of 30, the REST twin of `review:history`                  |
| GET    | `/api/reviews/:id/resume`   | owner, reviewer | The document for the room: no private notes, no hidden sections                              |

Assignment is an explicit request the reviewer accepts or declines, per ADR-012. There is no
round-robin and no silent auto-assignment.

**Reviewers have read-only access to resume content.** They can comment and chat; they can never
write to the document. That is what keeps FR 7.2 from colliding with autosave.

---

## 10. Notifications

| Method | Path                              | Guard |
| ------ | --------------------------------- | ----- |
| GET    | `/api/notifications`              | user  | `?filter=all\|unread\|review` |
| PATCH  | `/api/notifications/read`         | user  | `{ ids: [] }`, max 100        |
| PATCH  | `/api/notifications/read-all`     | user  |
| GET    | `/api/notifications/unread-count` | user  | The badge's starting value    |     |

Real-time delivery is `notify:new` to `user:<id>`. These endpoints are the initial load and the
non-socket fallback.

---

## 11. Admin

Every admin route is `authorize('admin')` **as explicit set membership, not a rank ladder**.

| Method | Path                             | Notes                                                                                |
| ------ | -------------------------------- | ------------------------------------------------------------------------------------ |
| GET    | `/api/admin/stats`               | Totals plus live sessions from the prefix-filtered adapter count                     |
| GET    | `/api/admin/users`               | `?q=&role=&status=&page=&limit=`                                                     |
| PATCH  | `/api/admin/users/:id/role`      |                                                                                      |
| PATCH  | `/api/admin/users/:id/status`    | Block or unblock. Bumps `tokenVersion`, so it takes effect immediately.              |
| GET    | `/api/admin/templates`           |                                                                                      |
| POST   | `/api/admin/templates`           | Metadata only. No markup field exists.                                               |
| PATCH  | `/api/admin/templates/:id`       |                                                                                      |
| GET    | `/api/admin/reports`             | `targetType` never includes a private resume                                         |
| PATCH  | `/api/admin/reports/:id`         | `{ action: disable_link                                                              | dismiss }` |
| GET    | `/api/admin/reports/:id/preview` | The reported page as the public sees it, only while its link is live (410 otherwise) |
| GET    | `/api/admin/logs`                | Retention 180 days by TTL                                                            |

**No admin route can select resume content.** The fail-closed `pre(/^find/)` hook strips
`sections`, `personal` and `notes` unless `contentScope: 'full'`, and that option is confined to
one service function that throws `403 ADMIN_CONTENT_FORBIDDEN` for role `admin` unconditionally.

Admin statistics read the denormalised `meta` fields, which is what makes the ban survivable
rather than crippling.

**This carries a dedicated test.** It is the one requirement where a regression is a privacy
breach rather than a bug.

---

## 12. Error codes

| Code                      | Status |
| ------------------------- | ------ |
| `VALIDATION_FAILED`       | 422    |
| `INVALID_CREDENTIALS`     | 401    |
| `TOKEN_EXPIRED`           | 401    |
| `TOKEN_INVALID`           | 401    |
| `ACCOUNT_BLOCKED`         | 403    |
| `FORBIDDEN_ROLE`          | 403    |
| `ADMIN_CONTENT_FORBIDDEN` | 403    |
| `NOT_FOUND`               | 404    |
| `VERSION_CONFLICT`        | 409    |
| `EMAIL_IN_USE`            | 409    |
| `SHARE_LINK_DISABLED`     | 410    |
| `SHARE_LINK_EXPIRED`      | 410    |
| `RATE_LIMITED`            | 429    |
| `INTERNAL`                | 500    |

---

## 13. Postman

A collection lives at `docs/r4u.postman_collection.json` with an environment holding `baseUrl` and
`accessToken`, and a login request that writes the token into the environment automatically.

It covers the happy path for every endpoint plus the error scenarios that matter: 401 without a
token, 403 for the wrong role, 404 for a cross-user resume read, 409 on a stale version, 422 on
each validation rule, and 429 on the login limiter.
