# Requirements Traceability

Every functional requirement from the project specification, carried forward verbatim in intent,
with the phase that delivers it and the artefact that verifies it.

**Count correction:** the specification defines **59** numbered requirements across ten modules,
not 63. Breakdown: M1 ten, M2 four, M3 seven, M4 six, M5 five, M6 five, M7 seven, M8 four,
M9 six, M10 five.

Status values: `planned`, `building`, `done`.

---

## Module 1: Authentication and Authorization

| ID | Requirement | Phase | Delivered in | Verified by |
|---|---|---|---|---|
| FR 1.1 | Register with full name, email, password | 2 | `modules/auth` | supertest: register |
| FR 1.2 | Validate email format and password strength, client and server | 2 | `shared/schemas/auth` | zod unit test |
| FR 1.3 | Passwords hashed with bcrypt, hash never returned in any response | 2 | `models/User` (`select: false`) | supertest: response shape |
| FR 1.4 | Issue a JWT on successful login | 2 | `auth.service` | supertest: login |
| FR 1.5 | Verify the token in middleware before any protected route | 2 | `middleware/authenticate` | supertest: 401 without token |
| FR 1.6 | Default role `user`, support `reviewer` and `admin` | 2 | `models/User` | schema test |
| FR 1.7 | Restrict every protected page and endpoint by role | 2 | `middleware/authorize` | supertest: 403 wrong role |
| FR 1.8 | Password reset via an expiring emailed link | 2 | `modules/auth` | supertest: expiry and single use |
| FR 1.9 | Logout clears the token and redirects to login | 2 | `context/AuthContext` | RTL |
| FR 1.10 | Clear message and redirect on direct unauthorized route access | 2 | `routes/RouteGuard` | RTL |

**Note on FR 1.4 and 1.9.** The access token lives in memory, never localStorage, and logout also
revokes the refresh-token family server-side. See ADR-003 and `ARCHITECTURE.md` section 5.

---

## Module 2: Profile and Account Management

| ID | Requirement | Phase | Delivered in | Verified by |
|---|---|---|---|---|
| FR 2.1 | View and update name, contact number, headline, photograph | 3 | `modules/users` | supertest |
| FR 2.2 | Password change only after current password verified | 3 | `users.service` | supertest: wrong current rejected |
| FR 2.3 | Light and dark theme toggle, preference retained | 3 | `context/ThemeContext` | RTL |
| FR 2.4 | Delete account, removing all resumes and chat records | 3 | `users.service` | supertest: cascade |

---

## Module 3: Resume Management

| ID | Requirement | Phase | Delivered in | Verified by |
|---|---|---|---|---|
| FR 3.1 | Create any number of resumes, each with a user-defined title | 4 | `modules/resumes` | supertest |
| FR 3.2 | List resumes with title, template thumbnail, status, last modified | 4 | `routes/dashboard` | RTL |
| FR 3.3 | Open for editing, preview, duplicate or delete | 4 | `modules/resumes` | supertest |
| FR 3.4 | Confirmation modal before delete | 4 | `components/ui/Modal` | RTL |
| FR 3.5 | Autosave at intervals and on section change | 5 | `hooks/useDebounce` + PATCH | RTL + supertest |
| FR 3.6 | Search by title, filter by status, sort by date or title | 4 | `resumes.controller` | supertest |
| FR 3.7 | A user can access only their own resumes | 4 | `resumes.policy` | **supertest: cross-user returns 404** |

**FR 3.2** is why `html2canvas-pro` stays in the stack: the thumbnail is a raster snapshot of the
user's actual resume, which is genuinely the right tool for that job. See ADR-001.

**FR 3.5.** Autosave is a debounced HTTP PATCH with an allowlisted op vocabulary and a hand-managed
`version` field, never a socket message. See `ARCHITECTURE.md` section 7.

**FR 3.7** returns **404, not 403**. A 403 confirms the id exists, which is an enumeration oracle
over a collection of PII documents.

---

## Module 4: Resume Content Editor

| ID | Requirement | Phase | Delivered in | Verified by |
|---|---|---|---|---|
| FR 4.1 | Sections for personal, summary, education, experience, projects, skills, certifications, achievements, languages, references | 5 | `shared/SECTION_REGISTRY` | schema test |
| FR 4.2 | Multiple entries per section, addable, editable, reorderable, removable | 5 | `@dnd-kit` + editor reducer | **reducer unit test** |
| FR 4.3 | Hide an optional section from output without deleting its data | 5 | `sections[].hidden` | reducer unit test |
| FR 4.4 | Validate mandatory values, email and phone patterns, links, and end date not before start date | 5 | `shared/schemas/resume` | zod cross-field test |
| FR 4.5 | Bullet fields with a visible character limit indicator | 5 | `SECTION_REGISTRY` limits | RTL |
| FR 4.6 | Completeness indicator as a percentage | 5 | `meta.completeness` | **arithmetic unit test** |

**FR 4.6 is computed from the rule pass rate, not from filled-field count.** A resume that is
100% complete and full of unquantified duty statements is a worse outcome than an 85% one that is
well written. See `ATS-RUBRIC.md` section 9.

**FR 4.5** limits are reconciled with the ATS rubric's D6 check: bullet cap 220 characters, warning
at 170, which agrees with the 8 to 35 word band. Two features disagreeing about length is the
fastest way to look unfinished.

---

## Module 5: Template Selection and Live Preview

| ID | Requirement | Phase | Delivered in | Verified by |
|---|---|---|---|---|
| FR 5.1 | Gallery of admin-maintained templates with thumbnails | 6 | `modules/templates` | supertest |
| FR 5.2 | Apply a template and change it later without content loss | 6 | `slots` map + `recommendedOrder` | **switch test: no section lost** |
| FR 5.3 | Customise accent colour, font size, section spacing | 6 | the five knobs | RTL |
| FR 5.4 | Live preview updating as the user types | 6 | `renderToDom` | RTL |
| FR 5.5 | Preview checkable at mobile, tablet and desktop widths | 6 | preview scale control | manual |

**FR 5.2** is the requirement that exposes the two-column data hazard. Any section not named in a
template's `slots` map falls into `main`, so switching one column to two can never make a section
vanish or duplicate. Template switch **never silently reorders**; it prompts.

**FR 5.3** exposes exactly five knobs and no more, and the accent touches rules and section
headings only, never body text. See `TEMPLATES.md` section 8.

---

## Module 6: Export and Sharing

| ID | Requirement | Phase | Delivered in | Verified by |
|---|---|---|---|---|
| FR 6.1 | Export as A4 PDF with the applied template | 7 | `renderToPdf` | **CI text-extraction test** |
| FR 6.2 | Generate a unique public link on demand | 7 | `modules/share` | supertest |
| FR 6.3 | Enable, disable or set an expiry on a public link | 7 | `ShareLink` | supertest |
| FR 6.4 | Read-only public view for a valid link, no login | 7 | `routes/r/:slug` | supertest + Playwright |
| FR 6.5 | Record views and downloads per shared resume | 7 | `ShareView` + rollup | supertest: dedup and owner exclusion |

**FR 6.1 is where the specification was wrong and R4U deviates.** `html2canvas` produces a raster
PDF with zero extractable text, which no ATS can read. Measured: 305 KB and 0 text items, against
3 KB and 34 text items from `@react-pdf/renderer`. See ADR-001.

CI renders every template and asserts that the name, section headings, employers and date ranges
extract intact and in reading order.

**FR 6.5** deduplicates within a one-hour window and excludes the owner's own visits. Without both,
the counters are noise and the feature actively looks broken.

---

## Module 7: Review, Feedback and Real Time Communication

| ID | Requirement | Phase | Delivered in | Verified by |
|---|---|---|---|---|
| FR 7.1 | Raise a review request and assign it to an available reviewer | 8 | `modules/reviews` | supertest |
| FR 7.2 | Reviewer posts comments linked to a section | 8 | `Comment.sectionKey` | supertest |
| FR 7.3 | One-to-one chat over WebSocket | 8 | `sockets/handlers/chat` | socket integration test |
| FR 7.4 | Every message and comment delivered instantly, no refresh | 8 | `review:<id>` room | socket integration test |
| FR 7.5 | Show online or offline presence, handle connect and disconnect | 8 | derived presence | socket integration test |
| FR 7.6 | Reviewer marks a review complete, updating the owner's status | 8 | `review:complete` | supertest |
| FR 7.7 | Persist chat history for rejoin | 8 | `Message` + cursor pagination | supertest |

**FR 7.1.** "Available" is defined as an explicit request the reviewer accepts or declines, not
auto-allocation. See ADR-012.

**FR 7.2.** Comments anchor to stable section and entry ids in the data model, never to DOM
geometry, so they survive both renderers and every template switch.

**FR 7.5.** Presence is derived from room membership with a 10-second grace period, never stored as
a boolean. A boolean is wrong four separate ways, listed in `REALTIME.md` section 4.

---

## Module 8: Notification

| ID | Requirement | Phase | Delivered in | Verified by |
|---|---|---|---|---|
| FR 8.1 | Push a notification on review assigned, comment added, message received | 8 | `notifyUser` | socket integration test |
| FR 8.2 | Unread count on the navigation bar | 8 | `NotificationContext` | RTL |
| FR 8.3 | Notification centre listing all, with read and unread state | 8 | `routes/notifications` | RTL |
| FR 8.4 | Success or error message for every create, update, delete | 3 | `ToastContext` | RTL |

**FR 8.1** coalesces chat notifications with an upsert and `$inc`. A 40-message burst produces one
unread row, not forty. Emitting one per message buries the centre and makes FR 8.2 meaningless.

---

## Module 9: Administration

| ID | Requirement | Phase | Delivered in | Verified by |
|---|---|---|---|---|
| FR 9.1 | Dashboard with total users, resumes, active templates, live sessions | 9 | `modules/admin` | supertest |
| FR 9.2 | Registered users in a searchable, paginated table | 9 | `admin.controller` | supertest |
| FR 9.3 | Change a user's role, block or unblock an account | 9 | `admin.service` | supertest: blocked user denied a session |
| FR 9.4 | Add, edit, activate or deactivate a template | 9 | `modules/templates` | supertest |
| FR 9.5 | Display reported content and an activity log | 9 | `Report`, `ActivityLog` | supertest |
| FR 9.6 | Admin cannot open a user's private resume content | 2 | **`pre(/^find/)` hook** | **dedicated privacy test** |

**FR 9.1 "live sessions"** is a prefix-filtered count over `adapter.rooms`.
`io.engine.clientsCount` counts tabs, not users, and `adapter.rooms.size` includes one implicit
self-room per socket. Both are wrong.

**FR 9.3.** Blocking bumps `User.tokenVersion`, which invalidates every issued access token
immediately rather than at next expiry.

**FR 9.5 and FR 9.6 contradict as written.** Resolved structurally: only a resume with an **active
public share link** is reportable, `targetType` omits private resumes entirely, and the queue
renders through the public share view. The admin never gains a privileged read. See ADR-008.

**FR 9.6 is delivered in Phase 2, not Phase 9**, deliberately. It is enforced at the query layer
fail-closed, so it must exist before any read path is written. It is the one requirement where a
regression is a privacy breach rather than a bug, and it therefore carries a dedicated test.

---

## Module 10: Interface and System Level

| ID | Requirement | Phase | Delivered in | Verified by |
|---|---|---|---|---|
| FR 10.1 | Responsive across mobile, tablet, desktop | all | Tailwind breakpoints | manual + Playwright |
| FR 10.2 | Loading indicator or skeleton while a request is in progress | 3 | `components/ui` | RTL |
| FR 10.3 | Readable message for validation, network and server errors | 3 | error middleware + toast | supertest + RTL |
| FR 10.4 | Consistent palette with hover, focus and transition effects | 1 | `styles/tokens.css` | **`design-guard.sh` in CI** |
| FR 10.5 | Reusable button, input, card, modal, toast as shared components | 1 | `components/ui/` | RTL |

**FR 10.2.** Skeletons are static `ink-03` blocks. No shimmer sweep, per the design system.

**FR 10.4** is machine-enforced. `design-guard.sh` fails the build on any ban-list hit, and no hex
literal may appear outside `tokens.css`.

---

## R4U additions beyond the specification

Numbered `AR n` so they stay distinguishable from specified requirements in the report.

| ID | Addition | Phase | Rationale |
|---|---|---|---|
| AR 1 | ATS Readiness checker, published 100-point rubric | 10 | Section 2.4 excludes **machine-learning** ATS scoring only, so a deterministic rule-based checker is in scope. Flagship feature. |
| AR 2 | Parser Preview pane showing the raw text a machine sees | 10 | The most persuasive UI element in the product, and free once `serializeToParserView` exists. |
| AR 3 | Tailor for this job: duplicate plus pasted JD plus keyword match | 10 | Turns FR 3.1 from a storage feature into a workflow. Pure set intersection. |
| AR 4 | Version history at milestones, with restore | 6 | Directly answers the specification's own "resume_final_v3" problem statement. |
| AR 5 | Guest drafts in localStorage, merged on signup | 4 | Largest conversion lever in the category. |
| AR 6 | JSON Resume import and export | 6 | Trivial, and makes the product interoperable. |
| AR 7 | Live page-overflow warning in millimetres, with three ranked remedies | 6 | Genuinely missing from most competitors. |
| AR 8 | `linearize()` ATS variant of any template | 7 | Makes "ATS-safe: no" a soft property rather than a dead end. |
| AR 9 | Share-link redaction flags for email, phone, address | 7 | Largest single reduction in PII exposure for sharing. |
| AR 10 | Private `notes` field, never rendered, redacted from every share payload | 5 | One textarea, and a concrete demonstration of the redaction policy. |
| AR 11 | DOCX export | 11 | Textkernel logs "format is PDF" as a code-300 issue. A text-layer DOCX is measurably safer. |
| AR 12 | `design-guard.sh` CI check | 1 | Turns the design ban list into something enforceable and demonstrable. |

---

## Specification section 4.11: the grading checklist

Treated as binding.

| Checklist area | Where it is demonstrably satisfied |
|---|---|
| Responsive UI with Tailwind | Tailwind v4 `@theme` tokens, three breakpoints, `components/ui/` library, light and dark |
| React hooks, useState and useEffect | Editor state, autosave effect with dependency arrays and cleanup of timers and sockets |
| Context API and custom hooks | `AuthContext`, `ThemeContext`, `NotificationContext`, `SocketContext`, `ToastContext`; `useApi`, `useAuth`, `useSocket`, `useDebounce`. **No TanStack Query**, per ADR-010 |
| REST API with CRUD | Resource endpoints for users, resumes, templates, reviews, notifications, correct verbs and status codes. See `API.md` |
| MongoDB with Mongoose | Fourteen collections, references and population, schema validation, explicit indexes, TTLs. See `DATA-MODEL.md` |
| Secure API | Central error middleware, `AppError`, zod-validated env at boot, bcrypt, helmet, tiered rate limiting, controlled error responses |
| JWT authentication and roles | 15-minute access token, rotating opaque refresh token with family revocation, `authorize()` as set membership not a rank ladder |
| Real time features | Socket.IO rooms per review, live chat, live comment delivery, derived presence, coalesced push notifications. See `REALTIME.md` |
| Docker | Multi-stage Dockerfiles for client and server, `.dockerignore`, Compose running client, server and database together |
| CI/CD | GitHub Actions: install, lint, typecheck, test, `design-guard.sh`, PDF extraction test, build, deploy |
| Testing | Vitest projects for client and server, RTL, supertest, `mongodb-memory-server`, one Playwright E2E, `@axe-core/playwright` |

The rubric asks for `useReducer` implicitly under Context API. The editor document is a
`useReducer` whose actions are domain verbs, which gives free undo and redo and makes socket
events simply more dispatched actions. That is the most persuasive demonstration available.
