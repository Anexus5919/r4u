# R4U Architecture

How the system is put together and why. Read `DECISIONS.md` for the deviations from the original
project specification and the evidence behind each one.

---

## 1. Topology

```
  Browser
    |
    |  HTTPS (REST, JSON)          WSS (Socket.IO)
    |                                    |
    v                                    v
  Vercel                            Render (Docker)
  client/ static build              server/ Express 5 + Socket.IO
                                         |
                                         |  Mongoose
                                         v
                                    MongoDB Atlas M0

  Cloudinary  <-- avatars, template thumbnails (never proxied through Render)
```

The PDF is generated **in the browser**, not on the server. This is deliberate. It costs the
server nothing, and it keeps working during Render's free-tier cold start, which is the single
worst user-facing failure mode on this deployment. The server renders a PDF only for public share
links (`/r/:slug.pdf`), where a cold start is far more forgivable.

---

## 2. Repository layout

npm workspaces monorepo. Three packages, because the shared schema is the load-bearing idea.

```
r4u/
  client/                 React 19 + Vite + Tailwind v4
  server/                 Express 5 + Socket.IO + Mongoose
  shared/                 Zod schemas, types, constants, the layout AST
  docs/
  scripts/
  .github/workflows/
```

`shared/` is a real workspace package imported by both sides, never a copy-pasted file. One
definition of every character limit means the client counter and the server rejection can never
disagree. The Docker build copies `shared/` into both images.

### 2.1 Server tree

Feature-first, not layer-first. Layer-first folders force four distant edits per feature change
across eleven features. The filename suffixes still satisfy any rubric that wants to see
controllers and services.

```
server/src/
  modules/
    auth/         auth.routes.ts  auth.controller.ts  auth.service.ts
                  auth.policy.ts  auth.validators.ts
    users/
    resumes/
    templates/
    reviews/
    comments/
    messages/
    notifications/
    share/
    ats/
    admin/
  models/         one directory, barrel index.ts, because they cross-reference heavily
  middleware/     authenticate, authorize, validate, error, rateLimit
  sockets/        index.ts  emitters.ts  handlers/  guards.ts
  config/         env.ts (zod-validated at boot)  db.ts  logger.ts
  utils/
```

### 2.2 Client tree

```
client/src/
  routes/         one file per route from ROUTES.md
  components/
    ui/           Button Input Card Modal Toast Table Rule  (the only place they exist)
    editor/
    review/
    admin/
  templates/      the eight resume layout functions
  render/         renderToDom.tsx  renderToPdf.tsx  linearize.ts
  context/        AuthContext  ThemeContext  NotificationContext  SocketContext  ToastContext
  hooks/          useApi  useAuth  useSocket  useDebounce  useResumeReducer
  styles/         tokens.css   (the only file permitted to contain a hex literal)
  content/        MDX: guides, ATS methodology, per-check explainers, legal pages
```

---

## 3. The load-bearing decision: one layout AST, two adapters

The hardest problem in a resume builder is **template drift**: the live HTML preview and the
exported PDF are rendered by different engines, so they diverge, and the user downloads something
they did not see.

Solving it by writing each template twice guarantees drift. Solving it by making the preview an
embedded PDF viewer breaks section-anchored review comments, which need real DOM nodes.

R4U solves it with a restricted intermediate representation.

```
  template.ts :: (resume, theme) => LayoutNode[]
                        |
          +-------------+-------------+
          |                           |
    renderToDom()               renderToPdf()
    divs + inline styles        View / Text / Page
    live preview, comments      the A4 download
```

```ts
type LayoutNode =
  | { type: 'stack'; style: Style; children: LayoutNode[] }
  | { type: 'row'; style: Style; children: LayoutNode[] }
  | { type: 'text'; style: Style; value: string }
  | { type: 'rule'; style: Style }
  | { type: 'spacer'; style: Style }
```

Content drift becomes structurally impossible: both adapters walk the same tree. Box-layout drift
is near zero because `@react-pdf/renderer` runs yoga-layout, the same Flexbox implementation the
browser uses.

**The style vocabulary is restricted to the browser and Yoga intersection, enforced by a
TypeScript union type.** Permitted: `flexDirection`, `gap`, `padding`, `margin`, `width` as a
percentage, `alignItems`, `justifyContent`, `fontSize`, `fontFamily`, `fontWeight`, `lineHeight`,
`color`, `borderBottom`, `position: relative | absolute`.

Banned at the type level: CSS Grid, `float`, `text-shadow`, `background-image`. `@react-pdf`
supports none of them, and a compile error is far cheaper than a silently different PDF.

**Never use Tailwind class names inside a template.** `@react-pdf` has no CSS cascade and no class
resolution. Both adapters consume the same plain design-token object.

### 3.1 Guards

- Every client-side render is wrapped in a `Promise.race` timeout of about 5 seconds.
  `@react-pdf/renderer` has an open infinite-loop issue (#2659) involving `minPresenceAhead`,
  `margin` and `break`, which are exactly the props a resume template leans on. A hang in the
  browser freezes the user's tab.
- `wrap={false}` on each atomic entry (one job, one degree, one project) so an entry never splits
  across an A4 boundary. `break` is reserved for a user-initiated "start this section on a new page".
- Page count and overflow warnings are read from the **PDF render**, not from DOM measurement.
  Render takes 50 to 170ms, so debounce roughly 400ms, render in the background, and read
  `numPages`. No DOM heuristic can be as accurate, and this eliminates preview-versus-export
  mismatch on the one question users actually care about.

---

## 4. Template registry, and why templates are not markup

`FR 9.4` lets an administrator add, edit, activate and deactivate templates. The administrator
manages **metadata**, never markup.

```
Template {
  key            'foundry' | 'quire' | 'ledger' | ...   maps to a repo function
  name, category, thumbnail, active, order
  defaults       { typeScale, leading, gap, margins, accent }
  atsProfile     { columns, hasTables, hasImages, headerFooterContent,
                   bodyFont, bulletGlyph, dateLayout }
}
```

Storing template markup (HTML, Handlebars, MDX, JSX) in the database is rejected for two
independent reasons:

1. **It is an injection vector.** MDX and JSX compile to executable JavaScript. Evaluating
   database content at runtime is remote code execution, on the server if rendered there or in
   the victim's session if rendered client-side. An admin-only authoring path is not a mitigation.
2. **`@react-pdf/renderer` cannot render it.** Its primitives are `Document`, `Page`, `View`,
   `Text`. It does not know `div`, `p`, `h1`. A markup-authored template would preview in the
   browser and be impossible to export, reintroducing exactly the drift section 3 removes.

`atsProfile` is what lets the ATS checker say "this template caps you at 21 of 30 on parseability,
switch to Foundry to recover 9 points" without inspecting the rendered output.

### 4.1 Where MDX is used

MDX is used, but only on the content surface, compiled at build time from files in the repo:

- `/about`, `/privacy`, `/terms`, changelog
- the ATS methodology page that publishes the rubric
- per-check "learn more" explainers with an embedded `<BeforeAfter />` component
- resume writing guides

**Never `evaluate()` MDX from the database.** Build-time compilation only.

---

## 5. Authentication

| Token   | Form                                                  | Lifetime | Storage                                                  |
| ------- | ----------------------------------------------------- | -------- | -------------------------------------------------------- |
| Access  | HS256 JWT, claims `{ sub, role, tv, jti }` only       | 15 min   | React module variable / Context. **Never localStorage.** |
| Refresh | Opaque `crypto.randomBytes(32).toString('base64url')` | 30 days  | httpOnly cookie, `Path=/api/auth`                        |

The access token carries **no email and no name**. JWT payloads are base64, not encrypted, and
R4U's users are identifiable people attached to a PII document.

The refresh token is deliberately **not** a JWT. It has to be checked against the database for
revocation anyway, so JWT structure buys nothing and only leaks claims. The server stores its
SHA-256, rotates it on every use, and tracks a `family` id so that replaying a consumed token
revokes the entire family.

An in-memory access token dies with the tab. A localStorage token survives the page and can be
exfiltrated by any XSS for later use.

### 5.1 The cross-site cookie problem

Vercel and Render are different sites, so the refresh cookie is a third-party cookie requiring
`SameSite=None; Secure`. Safari's ITP blocks that outright regardless of the value. The symptom
is auth that works perfectly in Chrome and logs users out on every reload in Safari.

**Fix, and it is free.** Proxy the HTTP API through a Vercel rewrite so the browser only ever
talks to one origin:

```json
{
  "rewrites": [
    { "source": "/api/:path*", "destination": "https://r4u-api.onrender.com/api/:path*" }
  ]
}
```

The cookie is then first-party and Safari is a non-issue. **Socket.IO is unaffected** and connects
directly to Render, because the handshake authenticates with the in-memory access token via
`auth`, not with a cookie. Nothing in the real-time layer depends on the proxy.

**Risk to measure in Phase 1:** Vercel's proxy has its own request timeout and a Render cold start
runs 30 to 60 seconds, so the first request after idle may time out through the proxy. Fallbacks,
in order: a free domain from the GitHub Student Developer Pack, then
`SameSite=None; Secure; Partitioned` with the limitation documented rather than hidden.

See `COST.md`.

### 5.2 CSRF

No CSRF library. Only two endpoints read the cookie, `POST /api/auth/refresh` and
`POST /api/auth/logout`, and they are defended by three conditions that a cross-site attacker
cannot satisfy without a preflight:

1. strict `Origin` header allowlist
2. a required `X-Requested-With: r4u` custom header
3. rejection of any `Content-Type` other than `application/json`

Every other endpoint uses `Authorization: Bearer` and has no CSRF surface at all.

---

## 6. Authorization, and the admin content ban

Four first-class roles. Guest is modelled as `req.principal = req.user ?? { role: 'guest' }`
rather than `null`, so every policy function handles four roles uniformly and the requirement is
visible in the code without a fake guest row in the database.

**`authorize(...allowedRoles)` is explicit set membership, never a rank ladder.** A numeric
hierarchy where `admin: 3` beats everything is the natural way to write it and it structurally
violates the requirement that an admin cannot read resume content. Write the ladder and you will
later "fix" the admin case with a special-case `if` that the next route forgets.

### 6.1 Enforcement at the data layer

The rule that an administrator cannot read private resume content is enforced **at the query
layer, fail-closed**, not in controllers.

```ts
resumeSchema.pre(/^find/, function () {
  if (this.getOptions().contentScope !== 'full') {
    this.select('-sections -personal')
  }
})
```

`contentScope: 'full'` is confined to one service function, which throws
`403 ADMIN_CONTENT_FORBIDDEN` for role `admin` unconditionally. Enforcing this only in controllers
guarantees a leak: some future admin analytics endpoint will run `Resume.find({}).lean()` for a
stats query and return everything.

To make the ban survivable rather than crippling, `meta.completeness`, `meta.wordCount` and
`meta.sectionCount` are denormalised onto the Resume document on every write, so admin
aggregations never need a content projection.

**Non-owner reads return 404, never 403.** A 403 confirms the id exists, which is an enumeration
oracle over a collection of PII documents.

### 6.2 The FR 9.5 / FR 9.6 contradiction

The specification requires an admin to moderate reported content and forbids an admin from reading
private resume content. This is resolved structurally, not by granting a moderation exception:

- **Only a resume with an active public share link is reportable.** `targetType` does not include
  a private resume at all.
- The report queue renders that resume **through its public share view**, the same read any
  visitor with the link already has.
- The reporter-supplied snippet is stored on the Report document.

The admin therefore never gains a privileged read, and the requirement holds at the schema level.

The same boundary is enforced on the socket layer with an **explicit deny** for `role === 'admin'`
on `review:*` and `resume:*` joins, rather than by absence of a grant. An admin holds a valid JWT,
so the handshake passes and nothing stops a room join unless a handler refuses it.

---

## 7. Autosave and concurrency

Autosave is a **debounced HTTP PATCH, never a socket message**. HTTP gives retries, idempotency,
rate limiting, real status codes, and an endpoint that can be demonstrated in Postman. The socket
is used only to broadcast "resume updated" into the review room.

- 500ms debounce, with a visible four-state indicator: idle, saving, saved, error.
- A `beforeunload` guard while changes are pending.
- The request body is an **allowlisted op vocabulary**, not raw JSON Patch:
  `setField`, `toggleSection`, `reorderSections`, `addEntry`, `removeEntry`, `setDesign`.
  A free-form `path` would let a client write `/owner`, `/version` or `/meta.completeness`.
- Array elements are targeted with `arrayFilters` on subdocument `_id`, **never by index**.
  Indices shift the moment a section is reordered, so an in-flight index-based patch corrupts a
  neighbouring entry.
- A hand-managed `version` field sits in the `updateOne` filter with `$inc: { version: 1 }`.
  Mongoose's `optimisticConcurrency` is the wrong tool: it only fires on `doc.save()`, which
  rewrites the entire document on every keystroke batch.
- On `409 VERSION_CONFLICT` the server returns the current version and document. The client
  auto-rebases when the conflicting ops touch disjoint paths, and prompts only on a same-path
  collision.

Never call `.save()` on a Resume. `Schema.Types.Mixed` paths are not change-tracked, so mutating
`resume.sections[0].entries[1].data.company` and saving persists nothing without `markModified()`.

---

## 8. State management on the client

Context plus `useReducer`, no external store, no TanStack Query.

Skipping TanStack Query is an architectural fit judgement, not a rubric dodge. R4U's centre of
gravity is one long-lived mutable document with local undo/redo, debounced autosave and socket
push mutations. Query degenerates into manual `setQueryData` there, and you have paid 13 KB to
disable its cache.

The editor document lives in a `useReducer` whose actions are domain verbs: `FIELD_SET`,
`ENTRY_ADD`, `ENTRY_REORDER`, `SECTION_REORDER`, `SECTION_TOGGLE_VISIBILITY`. This gives free
undo and redo by keeping past and future stacks, and makes socket events simply more dispatched
actions.

Four custom hooks, each solving a real bug the naive version has:

| Hook          | What it does                                                                                                                                                     |
| ------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `useApi`      | One axios instance, interceptor attaching the JWT, `401` triggers refresh then one retry, `AbortController` tied to unmount                                      |
| `useAuth`     | Context over `{ user, status, error }` with an explicit `checking` state so the app never flashes the login screen on refresh                                    |
| `useSocket`   | **One shared socket instance in Context**, not one per component. Typed emit and subscribe with automatic cleanup, plus a connection-status value the UI renders |
| `useDebounce` | Drives autosave and the preview render                                                                                                                           |

---

## 9. Deployment reality

Render's free tier tightened in April 2026: spin-down at 15 minutes idle (was 30), bandwidth
5 GB per month (was 100 GB).

- **Do not add a keep-alive cron.** The free tier grants 750 instance hours per month and a
  permanently warm service consumes about 720, leaving no margin. Exceeding it suspends the
  service for the rest of the month, which converts a graceful-degradation problem into a
  quota-exhaustion problem mid-demo.
- Handle spin-down in the UI instead. After 3 seconds without a response, show a quiet line of
  body text: "Connecting to the server. This can take up to a minute after a period of
  inactivity." No spinner beyond a slow opacity change. Only after roughly 90 seconds does it
  become a real error state.
- Serve images from Cloudinary directly. Never proxy them through Render, against that 5 GB cap.
- Atlas M0 gives 0.5 GB including indexes and 100 operations per second. Set `autoIndex: false`
  in production and create indexes explicitly, because Mongoose rebuilds them on every boot and
  this service boots often.
- **Atlas M0 auto-pauses after 30 days with zero connections.** If the project sits idle between
  submission and viva, resume the cluster before the examiner opens the link.
- Bake fonts into the Docker image. Render's filesystem is ephemeral and wiped on every
  spin-down, so anything cached at runtime is re-fetched on every cold start.
- Run the container as `USER node`, `NODE_ENV=production`, `npm ci --omit=dev`, multi-stage build,
  `--init` for signal handling. Implement graceful SIGTERM shutdown: stop accepting connections,
  `io.close()`, drain in flight, then `mongoose.connection.close()`, so rolling deploys do not
  sever active review rooms mid-write.

---

## 10. Cross-cutting rules

- `req.validated` from `matchedData(req)` is the only input a controller may read. An ESLint
  `no-restricted-properties` rule bans `req.body` and `req.query` outside `src/middleware/`.
  On Express 5, sanitized values exist nowhere else, and this eliminates mass assignment of
  `role`, `owner` and `version` as a class of bug.
- Express 5 forwards async rejections automatically. There is no `catchAsync` wrapper anywhere.
- `app.set('trust proxy', 1)`, the exact hop count on Render. Setting `true` takes the leftmost
  attacker-controlled `X-Forwarded-For` entry and lets one client forge unlimited IPs to bypass
  every rate limiter.
- `sanitizeFilter` cannot distinguish a server-authored `# R4U Architecture

How the system is put together and why. Read `DECISIONS.md` for the deviations from the original
project specification and the evidence behind each one.

---

## 1. Topology

```
  Browser
    |
    |  HTTPS (REST, JSON)          WSS (Socket.IO)
    |                                    |
    v                                    v
  Vercel                            Render (Docker)
  client/ static build              server/ Express 5 + Socket.IO
                                         |
                                         |  Mongoose
                                         v
                                    MongoDB Atlas M0

  Cloudinary  <-- avatars, template thumbnails (never proxied through Render)
```

The PDF is generated **in the browser**, not on the server. This is deliberate. It costs the
server nothing, and it keeps working during Render's free-tier cold start, which is the single
worst user-facing failure mode on this deployment. The server renders a PDF only for public share
links (`/r/:slug.pdf`), where a cold start is far more forgivable.

---

## 2. Repository layout

npm workspaces monorepo. Three packages, because the shared schema is the load-bearing idea.

```
r4u/
  client/                 React 19 + Vite + Tailwind v4
  server/                 Express 5 + Socket.IO + Mongoose
  shared/                 Zod schemas, types, constants, the layout AST
  docs/
  scripts/
  .github/workflows/
```

`shared/` is a real workspace package imported by both sides, never a copy-pasted file. One
definition of every character limit means the client counter and the server rejection can never
disagree. The Docker build copies `shared/` into both images.

### 2.1 Server tree

Feature-first, not layer-first. Layer-first folders force four distant edits per feature change
across eleven features. The filename suffixes still satisfy any rubric that wants to see
controllers and services.

```
server/src/
  modules/
    auth/         auth.routes.ts  auth.controller.ts  auth.service.ts
                  auth.policy.ts  auth.validators.ts
    users/
    resumes/
    templates/
    reviews/
    comments/
    messages/
    notifications/
    share/
    ats/
    admin/
  models/         one directory, barrel index.ts, because they cross-reference heavily
  middleware/     authenticate, authorize, validate, error, rateLimit
  sockets/        index.ts  emitters.ts  handlers/  guards.ts
  config/         env.ts (zod-validated at boot)  db.ts  logger.ts
  utils/
```

### 2.2 Client tree

```
client/src/
  routes/         one file per route from ROUTES.md
  components/
    ui/           Button Input Card Modal Toast Table Rule  (the only place they exist)
    editor/
    review/
    admin/
  templates/      the eight resume layout functions
  render/         renderToDom.tsx  renderToPdf.tsx  linearize.ts
  context/        AuthContext  ThemeContext  NotificationContext  SocketContext  ToastContext
  hooks/          useApi  useAuth  useSocket  useDebounce  useResumeReducer
  styles/         tokens.css   (the only file permitted to contain a hex literal)
  content/        MDX: guides, ATS methodology, per-check explainers, legal pages
```

---

## 3. The load-bearing decision: one layout AST, two adapters

The hardest problem in a resume builder is **template drift**: the live HTML preview and the
exported PDF are rendered by different engines, so they diverge, and the user downloads something
they did not see.

Solving it by writing each template twice guarantees drift. Solving it by making the preview an
embedded PDF viewer breaks section-anchored review comments, which need real DOM nodes.

R4U solves it with a restricted intermediate representation.

```
  template.ts :: (resume, theme) => LayoutNode[]
                        |
          +-------------+-------------+
          |                           |
    renderToDom()               renderToPdf()
    divs + inline styles        View / Text / Page
    live preview, comments      the A4 download
```

```ts
type LayoutNode =
  | { type: 'stack'; style: Style; children: LayoutNode[] }
  | { type: 'row'; style: Style; children: LayoutNode[] }
  | { type: 'text'; style: Style; value: string }
  | { type: 'rule'; style: Style }
  | { type: 'spacer'; style: Style }
```

Content drift becomes structurally impossible: both adapters walk the same tree. Box-layout drift
is near zero because `@react-pdf/renderer` runs yoga-layout, the same Flexbox implementation the
browser uses.

**The style vocabulary is restricted to the browser and Yoga intersection, enforced by a
TypeScript union type.** Permitted: `flexDirection`, `gap`, `padding`, `margin`, `width` as a
percentage, `alignItems`, `justifyContent`, `fontSize`, `fontFamily`, `fontWeight`, `lineHeight`,
`color`, `borderBottom`, `position: relative | absolute`.

Banned at the type level: CSS Grid, `float`, `text-shadow`, `background-image`. `@react-pdf`
supports none of them, and a compile error is far cheaper than a silently different PDF.

**Never use Tailwind class names inside a template.** `@react-pdf` has no CSS cascade and no class
resolution. Both adapters consume the same plain design-token object.

### 3.1 Guards

- Every client-side render is wrapped in a `Promise.race` timeout of about 5 seconds.
  `@react-pdf/renderer` has an open infinite-loop issue (#2659) involving `minPresenceAhead`,
  `margin` and `break`, which are exactly the props a resume template leans on. A hang in the
  browser freezes the user's tab.
- `wrap={false}` on each atomic entry (one job, one degree, one project) so an entry never splits
  across an A4 boundary. `break` is reserved for a user-initiated "start this section on a new page".
- Page count and overflow warnings are read from the **PDF render**, not from DOM measurement.
  Render takes 50 to 170ms, so debounce roughly 400ms, render in the background, and read
  `numPages`. No DOM heuristic can be as accurate, and this eliminates preview-versus-export
  mismatch on the one question users actually care about.

---

## 4. Template registry, and why templates are not markup

`FR 9.4` lets an administrator add, edit, activate and deactivate templates. The administrator
manages **metadata**, never markup.

```
Template {
  key            'foundry' | 'quire' | 'ledger' | ...   maps to a repo function
  name, category, thumbnail, active, order
  defaults       { typeScale, leading, gap, margins, accent }
  atsProfile     { columns, hasTables, hasImages, headerFooterContent,
                   bodyFont, bulletGlyph, dateLayout }
}
```

Storing template markup (HTML, Handlebars, MDX, JSX) in the database is rejected for two
independent reasons:

1. **It is an injection vector.** MDX and JSX compile to executable JavaScript. Evaluating
   database content at runtime is remote code execution, on the server if rendered there or in
   the victim's session if rendered client-side. An admin-only authoring path is not a mitigation.
2. **`@react-pdf/renderer` cannot render it.** Its primitives are `Document`, `Page`, `View`,
   `Text`. It does not know `div`, `p`, `h1`. A markup-authored template would preview in the
   browser and be impossible to export, reintroducing exactly the drift section 3 removes.

`atsProfile` is what lets the ATS checker say "this template caps you at 21 of 30 on parseability,
switch to Foundry to recover 9 points" without inspecting the rendered output.

### 4.1 Where MDX is used

MDX is used, but only on the content surface, compiled at build time from files in the repo:

- `/about`, `/privacy`, `/terms`, changelog
- the ATS methodology page that publishes the rubric
- per-check "learn more" explainers with an embedded `<BeforeAfter />` component
- resume writing guides

**Never `evaluate()` MDX from the database.** Build-time compilation only.

---

## 5. Authentication

| Token   | Form                                                  | Lifetime | Storage                                                  |
| ------- | ----------------------------------------------------- | -------- | -------------------------------------------------------- |
| Access  | HS256 JWT, claims `{ sub, role, tv, jti }` only       | 15 min   | React module variable / Context. **Never localStorage.** |
| Refresh | Opaque `crypto.randomBytes(32).toString('base64url')` | 30 days  | httpOnly cookie, `Path=/api/auth`                        |

The access token carries **no email and no name**. JWT payloads are base64, not encrypted, and
R4U's users are identifiable people attached to a PII document.

The refresh token is deliberately **not** a JWT. It has to be checked against the database for
revocation anyway, so JWT structure buys nothing and only leaks claims. The server stores its
SHA-256, rotates it on every use, and tracks a `family` id so that replaying a consumed token
revokes the entire family.

An in-memory access token dies with the tab. A localStorage token survives the page and can be
exfiltrated by any XSS for later use.

### 5.1 The cross-site cookie problem

Vercel and Render are different sites, so the refresh cookie is a third-party cookie requiring
`SameSite=None; Secure`. Safari's ITP blocks that outright regardless of the value. The symptom
is auth that works perfectly in Chrome and logs users out on every reload in Safari.

**Fix, and it is free.** Proxy the HTTP API through a Vercel rewrite so the browser only ever
talks to one origin:

```json
{
  "rewrites": [
    { "source": "/api/:path*", "destination": "https://r4u-api.onrender.com/api/:path*" }
  ]
}
```

The cookie is then first-party and Safari is a non-issue. **Socket.IO is unaffected** and connects
directly to Render, because the handshake authenticates with the in-memory access token via
`auth`, not with a cookie. Nothing in the real-time layer depends on the proxy.

**Risk to measure in Phase 1:** Vercel's proxy has its own request timeout and a Render cold start
runs 30 to 60 seconds, so the first request after idle may time out through the proxy. Fallbacks,
in order: a free domain from the GitHub Student Developer Pack, then
`SameSite=None; Secure; Partitioned` with the limitation documented rather than hidden.

See `COST.md`.

### 5.2 CSRF

No CSRF library. Only two endpoints read the cookie, `POST /api/auth/refresh` and
`POST /api/auth/logout`, and they are defended by three conditions that a cross-site attacker
cannot satisfy without a preflight:

1. strict `Origin` header allowlist
2. a required `X-Requested-With: r4u` custom header
3. rejection of any `Content-Type` other than `application/json`

Every other endpoint uses `Authorization: Bearer` and has no CSRF surface at all.

---

## 6. Authorization, and the admin content ban

Four first-class roles. Guest is modelled as `req.principal = req.user ?? { role: 'guest' }`
rather than `null`, so every policy function handles four roles uniformly and the requirement is
visible in the code without a fake guest row in the database.

**`authorize(...allowedRoles)` is explicit set membership, never a rank ladder.** A numeric
hierarchy where `admin: 3` beats everything is the natural way to write it and it structurally
violates the requirement that an admin cannot read resume content. Write the ladder and you will
later "fix" the admin case with a special-case `if` that the next route forgets.

### 6.1 Enforcement at the data layer

The rule that an administrator cannot read private resume content is enforced **at the query
layer, fail-closed**, not in controllers.

```ts
resumeSchema.pre(/^find/, function () {
  if (this.getOptions().contentScope !== 'full') {
    this.select('-sections -personal')
  }
})
```

`contentScope: 'full'` is confined to one service function, which throws
`403 ADMIN_CONTENT_FORBIDDEN` for role `admin` unconditionally. Enforcing this only in controllers
guarantees a leak: some future admin analytics endpoint will run `Resume.find({}).lean()` for a
stats query and return everything.

To make the ban survivable rather than crippling, `meta.completeness`, `meta.wordCount` and
`meta.sectionCount` are denormalised onto the Resume document on every write, so admin
aggregations never need a content projection.

**Non-owner reads return 404, never 403.** A 403 confirms the id exists, which is an enumeration
oracle over a collection of PII documents.

### 6.2 The FR 9.5 / FR 9.6 contradiction

The specification requires an admin to moderate reported content and forbids an admin from reading
private resume content. This is resolved structurally, not by granting a moderation exception:

- **Only a resume with an active public share link is reportable.** `targetType` does not include
  a private resume at all.
- The report queue renders that resume **through its public share view**, the same read any
  visitor with the link already has.
- The reporter-supplied snippet is stored on the Report document.

The admin therefore never gains a privileged read, and the requirement holds at the schema level.

The same boundary is enforced on the socket layer with an **explicit deny** for `role === 'admin'`
on `review:*` and `resume:*` joins, rather than by absence of a grant. An admin holds a valid JWT,
so the handshake passes and nothing stops a room join unless a handler refuses it.

---

## 7. Autosave and concurrency

Autosave is a **debounced HTTP PATCH, never a socket message**. HTTP gives retries, idempotency,
rate limiting, real status codes, and an endpoint that can be demonstrated in Postman. The socket
is used only to broadcast "resume updated" into the review room.

- 500ms debounce, with a visible four-state indicator: idle, saving, saved, error.
- A `beforeunload` guard while changes are pending.
- The request body is an **allowlisted op vocabulary**, not raw JSON Patch:
  `setField`, `toggleSection`, `reorderSections`, `addEntry`, `removeEntry`, `setDesign`.
  A free-form `path` would let a client write `/owner`, `/version` or `/meta.completeness`.
- Array elements are targeted with `arrayFilters` on subdocument `_id`, **never by index**.
  Indices shift the moment a section is reordered, so an in-flight index-based patch corrupts a
  neighbouring entry.
- A hand-managed `version` field sits in the `updateOne` filter with `$inc: { version: 1 }`.
  Mongoose's `optimisticConcurrency` is the wrong tool: it only fires on `doc.save()`, which
  rewrites the entire document on every keystroke batch.
- On `409 VERSION_CONFLICT` the server returns the current version and document. The client
  auto-rebases when the conflicting ops touch disjoint paths, and prompts only on a same-path
  collision.

Never call `.save()` on a Resume. `Schema.Types.Mixed` paths are not change-tracked, so mutating
`resume.sections[0].entries[1].data.company` and saving persists nothing without `markModified()`.

---

## 8. State management on the client

Context plus `useReducer`, no external store, no TanStack Query.

Skipping TanStack Query is an architectural fit judgement, not a rubric dodge. R4U's centre of
gravity is one long-lived mutable document with local undo/redo, debounced autosave and socket
push mutations. Query degenerates into manual `setQueryData` there, and you have paid 13 KB to
disable its cache.

The editor document lives in a `useReducer` whose actions are domain verbs: `FIELD_SET`,
`ENTRY_ADD`, `ENTRY_REORDER`, `SECTION_REORDER`, `SECTION_TOGGLE_VISIBILITY`. This gives free
undo and redo by keeping past and future stacks, and makes socket events simply more dispatched
actions.

Four custom hooks, each solving a real bug the naive version has:

| Hook          | What it does                                                                                                                                                     |
| ------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `useApi`      | One axios instance, interceptor attaching the JWT, `401` triggers refresh then one retry, `AbortController` tied to unmount                                      |
| `useAuth`     | Context over `{ user, status, error }` with an explicit `checking` state so the app never flashes the login screen on refresh                                    |
| `useSocket`   | **One shared socket instance in Context**, not one per component. Typed emit and subscribe with automatic cleanup, plus a connection-status value the UI renders |
| `useDebounce` | Drives autosave and the preview render                                                                                                                           |

---

## 9. Deployment reality

Render's free tier tightened in April 2026: spin-down at 15 minutes idle (was 30), bandwidth
5 GB per month (was 100 GB).

- **Do not add a keep-alive cron.** The free tier grants 750 instance hours per month and a
  permanently warm service consumes about 720, leaving no margin. Exceeding it suspends the
  service for the rest of the month, which converts a graceful-degradation problem into a
  quota-exhaustion problem mid-demo.
- Handle spin-down in the UI instead. After 3 seconds without a response, show a quiet line of
  body text: "Connecting to the server. This can take up to a minute after a period of
  inactivity." No spinner beyond a slow opacity change. Only after roughly 90 seconds does it
  become a real error state.
- Serve images from Cloudinary directly. Never proxy them through Render, against that 5 GB cap.
- Atlas M0 gives 0.5 GB including indexes and 100 operations per second. Set `autoIndex: false`
  in production and create indexes explicitly, because Mongoose rebuilds them on every boot and
  this service boots often.
- **Atlas M0 auto-pauses after 30 days with zero connections.** If the project sits idle between
  submission and viva, resume the cluster before the examiner opens the link.
- Bake fonts into the Docker image. Render's filesystem is ephemeral and wiped on every
  spin-down, so anything cached at runtime is re-fetched on every cold start.
- Run the container as `USER node`, `NODE_ENV=production`, `npm ci --omit=dev`, multi-stage build,
  `--init` for signal handling. Implement graceful SIGTERM shutdown: stop accepting connections,
  `io.close()`, drain in flight, then `mongoose.connection.close()`, so rolling deploys do not
  sever active review rooms mid-write.

---

## 10. Cross-cutting rules

- `req.validated` from `matchedData(req)` is the only input a controller may read. An ESLint
  `no-restricted-properties` rule bans `req.body` and `req.query` outside `src/middleware/`.
  On Express 5, sanitized values exist nowhere else, and this eliminates mass assignment of
  `role`, `owner` and `version` as a class of bug.
- Express 5 forwards async rejections automatically. There is no `catchAsync` wrapper anywhere.
- `app.set('trust proxy', 1)`, the exact hop count on Render. Setting `true` takes the leftmost
  attacker-controlled `X-Forwarded-For` entry and lets one client forge unlimited IPs to bypass
  every rate limiter.
  operator from a client-supplied one.
  Any filter containing `$exists`, `$gt`, `$in` and so on must wrap it in `trusted({ ... })`, or
  Mongoose rewrites it to `{ $eq: { ... } }`, fails to cast, and throws a `CastError` that the
  error handler reports as a 404.
- `mongoose.set('sanitizeFilter', true)` with mongoose pinned at `^9.9.3`. Do **not** install
  `express-mongo-sanitize`: it is abandoned and silently breaks on Express 5, where `req.query`
  became a getter.
- Every environment variable is validated with zod at boot in `config/env.ts`. The process refuses
  to start on a missing or short secret. This converts "works locally, 500s on Render" into a
  loud startup failure.
- All socket emissions go through `sockets/emitters.ts`, so adding a multi-instance adapter later
  is a one-line change that touches no service code.
