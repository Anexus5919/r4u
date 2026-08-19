# Routes and Views

The specification numbers sixteen views. Its own navigation flow diagram also shows `/templates`
and `/about` in the entry layer, and the admin sidebar implies `/admin/reports` and `/admin/logs`.
Adding the MDX content surface, the real route table is **twenty-four**.

Guard values: `public`, `guest-only`, `user`, `reviewer`, `owner`, `admin`.

---

## 1. Route table

| #   | Route                      | View                       | Guard                 |
| --- | -------------------------- | -------------------------- | --------------------- |
| 1   | `/`                        | Landing                    | public                |
| 2   | `/templates`               | Public template gallery    | public                |
| 3   | `/about`                   | About and contact          | public                |
| 4   | `/privacy`, `/terms`       | Legal (MDX)                | public                |
| 5   | `/ats-methodology`         | Published rubric (MDX)     | public                |
| 6   | `/guides`, `/guides/:slug` | Writing guides (MDX)       | public                |
| 7   | `/register`                | Registration               | guest-only            |
| 8   | `/login`                   | Login                      | guest-only            |
| 9   | `/reset`                   | Forgot and reset password  | guest-only            |
| 10  | `/r/:slug`                 | Public resume view         | public                |
| 11  | `/dashboard`               | User dashboard             | user                  |
| 12  | `/resume/new`              | Template selection         | user                  |
| 13  | `/resume/:id/edit`         | Resume editor              | owner                 |
| 14  | `/resume/:id`              | Preview and export         | owner                 |
| 15  | `/resume/:id/ats`          | ATS Readiness report       | owner                 |
| 16  | `/reviews`                 | Review list                | user, reviewer        |
| 17  | `/reviews/:id`             | Review room with live chat | owner, reviewer       |
| 18  | `/notifications`           | Notification centre        | user, reviewer        |
| 19  | `/profile`                 | Profile and settings       | user, reviewer, admin |
| 20  | `/admin`                   | Admin overview             | admin                 |
| 21  | `/admin/users`             | Manage users               | admin                 |
| 22  | `/admin/templates`         | Manage templates           | admin                 |
| 23  | `/admin/reports`           | Reported content           | admin                 |
| 24  | `*`                        | Error and not found        | public                |

**`guest-only`** redirects an authenticated user to their dashboard. Landing on `/login` while
already signed in is a dead end otherwise.

**`/admin/logs`** is folded into `/admin/reports` as a second tab rather than a separate route,
since both are moderation surfaces and neither carries enough content to justify its own page.

---

## 2. Public surface

### 2.1 Landing (`/`)

**Purpose.** Introduce the product and convert the visit into a registration.

**Components.** Sticky navigation with wordmark and links Home, Templates, Guides, About, plus
Login and Sign Up. Hero with the headline and two primary actions. A real rendered resume as the
hero artefact, not an illustration. Feature section. Sample template strip. Footer.

**Design constraints.** The hero must not be a centred headline over two buttons above a
`grid-cols-1 md:grid-cols-3` of identical icon cards. That is the literal Tailwind tutorial grid
and is a catalogued tell. The feature section uses asymmetric spans, and the hero artefact is the
Alex Mercer fixture rendered through Foundry at real A4 proportion.

**Copy.** States plainly that there is no paywall at download. The loudest complaint in the entire
category is the download paywall, and refusing it is free differentiation.

**Output.** Responsive marketing page, all actions working, no layout shift on font load.

### 2.2 Public template gallery (`/templates`)

**Purpose.** Let a visitor evaluate the templates before registering.

**Components.** Grid of the eight templates rendered from the Alex Mercer fixture, never from a
user document. Category filter. Each card badges its ATS status honestly: safe, caution, or
not safe with a linearised variant available.

**Output.** A visitor can see exactly what they would get, and the ATS badging is visible before
signup rather than being a surprise later.

### 2.3 Registration (`/register`)

**Components.** Full name, email, password, confirm password. Password strength indicator. Show
and hide control. Inline validation under each field. Create Account with a loading state. Link
to login.

**Guest draft merge.** If a localStorage draft exists, registration merges it into the new account
and lands the user in the editor on that resume rather than on an empty dashboard.

**Output.** User document created with a hashed password, access token issued in memory, refresh
cookie set, user lands on the dashboard or the merged draft.

### 2.4 Login (`/login`)

**Components.** Email and password with validation. Show password. Forgot password link. Loading
state. Error banner for invalid credentials or a blocked account. Link to registration.

**Navigation.** `user` and `reviewer` go to `/dashboard`. `admin` goes to `/admin`.

**Security.** An unknown email still runs a bcrypt compare against a fixed dummy hash and returns
the identical generic error. Otherwise response timing and message wording enumerate registered
accounts.

### 2.5 Forgot and reset (`/reset`)

**Components.** Email input to request a link. Confirmation message. New password and confirm on
the reset screen. Expiry notice.

**Security.** Always responds 200 with "if an account exists, we have sent a link", regardless of
outcome. Rate limited to 3 per hour per IP and 3 per hour per email address. Reset tokens are
SHA-256 hashed, expire in 15 minutes and are single use. A successful reset bumps `tokenVersion`
and deletes every refresh token, killing all sessions.

### 2.6 Public resume view (`/r/:slug`)

**Purpose.** Show a read-only resume to a recruiter through a valid share link, with no login.

**Components.** The resume rendered in its template. Download as PDF. A one-line footer. A clear
message when the link is disabled, expired or invalid.

**Headers.** `X-Robots-Tag: noindex, nofollow` and `Referrer-Policy: no-referrer` on every
response. A resume is a PII document, and the defaults are for Google to index it and for any
outbound link to leak the share URL in the `Referer`.

**Redaction.** Honours the owner's `redact` flags for email, phone and address. The private
`notes` field is never included in the payload at all.

**Counting.** A view increments through `ShareView` with one-hour deduplication and owner
exclusion.

**Output.** A valid link renders without a login. A disabled or expired link renders a clear
message, not the content.

### 2.7 ATS methodology (`/ats-methodology`)

**Purpose.** Publish the full 100-point rubric. None of Jobscan, Rezi, Teal, Resume Worded or
Enhancv do this, which makes it a genuine differentiator rather than a nice-to-have.

**Components.** MDX, compiled at build time. Every check with its point value and remediation.
Embedded `<BeforeAfter />` components showing real bullets failing and passing. ESCO and O*NET
attribution.

**Copy constraint.** Never claims the score predicts rejection. Greenhouse does not score resumes,
Lever's recruiters work from search results, and 83% of polled recruiters said their ATS does not
auto-reject on content. Never prints the unsourced "75% of resumes are rejected by ATS" figure.

---

## 3. Tool surface

### 3.1 Dashboard (`/dashboard`)

**Purpose.** Home screen for an authenticated user, listing every resume they own.

**Components.** Top bar with wordmark, theme toggle, notification bell with unread count, profile
menu. Side navigation: Dashboard, My Resumes, Templates, Reviews, Notifications, Profile, Logout.
Search box, status filter, sort control, New Resume. Resume cards with live thumbnail, title, last
modified, and Edit, Preview, Share. Statistics strip: total resumes, shared links, pending
reviews, downloads. Empty state.

**Layout.** The grid is deliberately asymmetric. The most recently edited resume is a wide
two-column tile with a live thumbnail; the rest are a three-up of smaller tiles. Every tile shares
identical internal anatomy so scanning stays predictable despite the size difference. A symmetric
three-up is a catalogued tell and this is one of the three places a reviewer looks first.

**Empty state.** Three doors, not one button: Start from scratch, Start from a sample, Import.
Written as an instruction with one line of `ink-09` explanation, no illustration.

**Output.** Search, filter and sort update the list without a page reload.

### 3.2 Template selection (`/resume/new`)

**Components.** Grid of template cards from the fixture. Category filter. Enlarged preview in a
modal. Resume title input. `resumeType` selector (fresher, professional, technical, academic).
Continue.

**Why `resumeType` is here.** It drives the default template, the default section order, the length
target and which linter rules fire. Section order is a function of career stage, not of taste, and
this is the highest-leverage coaching moment in the product.

**Output.** Resume document created with the chosen template and a seeded section structure, and
the editor opens.

### 3.3 Resume editor (`/resume/:id/edit`)

**Purpose.** The core working screen.

**Components.** Section list with drag handles and per-section visibility toggles. Section form
with labelled inputs, add and remove controls, character counters. Live preview at real A4
proportion. Autosave status with four states. Field-level validation. Section completeness.
Live coaching panel from the content linter. Live page-overflow warning in millimetres.

**Layout.** Three panels split by a single 1px `ink-04` rule with background parity, not three
cards on a grey field. The active section carries a 2px accent bar flush to the left edge, not a
filled row. Each repeatable entry is a common region made of whitespace plus a hairline, never a
nested card. Drag shows a 1px accent insertion rule, not a ghost card. Hidden sections stay in the
list at `ink-07` with a hairline strikethrough.

**Motion.** The preview never animates. It updates instantly and silently. Debounce the render,
not the appearance.

**Responsive.** Mobile collapses the editor into a stacked step-by-step wizard. Tablet is a
two-column split with collapsible navigation. Desktop is the full three-panel layout.

**Output.** Every keystroke updates the preview, autosave persists with optimistic concurrency,
mandatory-field warnings surface inline.

### 3.4 Preview and export (`/resume/:id`)

**Components.** Full rendered resume at A4 proportion. Template switcher and accent palette.
Export panel: Download as PDF, Download ATS version, Print, Copy Share Link, Set Link Expiry,
Redaction toggles, Request Review, Duplicate, Tailor for a job, Delete. Version history. Toasts.

**Request Review** opens the reviewer directory as a modal, so the documented view count stays
honest. The owner sends an explicit request; the reviewer accepts or declines.

**Output.** A real text-layer A4 PDF downloads, and a share link is generated and copied.

### 3.5 ATS Readiness (`/resume/:id/ats`)

**Components.** Three artefacts, never one number. Dimension bars A to E. Itemised failed checks
with point cost and remediation, each deep-linking to the offending field in the editor. The
Parser Preview pane rendering the raw text a machine sees. Optional job-description paste box.
Methodology line with the rubric version.

**Constraint.** Remediation never auto-rewrites the resume. An auto-fix that rewrites bullets is
exactly the generated feel the design direction rejects, and it breaks the honesty premise of the
feature.

### 3.6 Review list and room (`/reviews`, `/reviews/:id`)

**Components.** Request list with status on the left. Resume document in the centre with
section-anchored pinned comments. Chat panel on the right with timestamps and presence. Message
input with a typing indicator. Mark as Reviewed, available to the reviewer only.

**Design.** No chat bubbles. A three-column rhythm of timestamp, author, body separated by
whitespace. Reviewer messages carry a single hairline left rule. Presence is a filled or hollow
glyph, never a green dot. Typing is the text "Neha is typing", never three animated dots. Hovering
a comment shifts its target section to `ink-02` and draws a 2px accent left rule, so the link is
perceived without a connector line.

**Guard.** Owner or assigned reviewer only, re-verified against the database on every
`review:join`. **Explicit deny for `admin`.**

**Output.** Messages and comments appear on both clients instantly, and history restores on rejoin
via cursor pagination.

### 3.7 Notification centre (`/notifications`)

**Components.** List with source, message and timestamp. Unread highlighted. Mark All as Read.
Filter for all, unread, review-related. Empty state.

**Output.** New notifications appear at the top in real time and the navigation bar count updates
in the same moment via `notify:count` to `user:<id>`, which also keeps other tabs in sync.

### 3.8 Profile and settings (`/profile`)

**Components.** Avatar with upload. Editable name, headline, phone, location. Change password
requiring the current password. Theme toggle. Reviewer profile fields when the role is `reviewer`.
Delete account behind a confirmation modal.

**Output.** Updates reflect across the interface, theme persists across sessions, deletion cascades
to resumes and chat records.

---

## 4. Admin surface

Every admin screen carries the line **"Resume content is not visible to administrators"** in the
UI. It is simultaneously a trust signal and a sentence no template would contain.

### 4.1 Overview (`/admin`)

**Components.** Statistic cards for total users, resumes created, active templates, live sessions.
Side navigation. A chart of registrations and resumes over time. Recent activity table.

**Live sessions** is a prefix-filtered count over `adapter.rooms`, pushed on a 5-second interval
that runs only while an admin is subscribed.

**Charts are monochrome from the outset**: a single accent series plus ink ramp steps for
comparison series, ordered by value rather than distinguished by hue. The admin dashboard is the
second most likely place for colour to leak back into a monochrome system.

### 4.2 Manage users (`/admin/users`)

**Components.** Searchable, paginated table with name, email, role, resume count, status. Role
selector. Block and unblock with confirmation. Status shown as a text label preceded by a filled
or hollow glyph, never a coloured pill.

**Table design.** No zebra striping, no vertical rules, 1px `ink-04` horizontal rules, numeric
columns right-aligned with tabular numerals.

**Output.** A role change or block takes effect immediately, because blocking bumps
`tokenVersion` and invalidates every issued access token rather than waiting for expiry.

### 4.3 Manage templates (`/admin/templates`)

**Components.** Template list with thumbnail, name, category, active state, and its ATS profile.
Add and edit forms covering metadata and defaults only. Preview modal rendered from the fixture.

**Constraint.** The admin edits metadata, never markup. See ADR-005. Previews render from the
Alex Mercer fixture, never from a user document, since this is the admin screen where the content
boundary is easiest to breach by accident.

**Output.** A newly activated template appears in the user-facing gallery. A deactivated one is
hidden from new resumes without affecting existing ones.

### 4.4 Reported content and activity (`/admin/reports`)

**Components.** Two tabs. Reports queue with reporter, reason, reporter-supplied snippet and
status. Activity log, paginated, with a retention notice.

**Constraint.** Only a resume with an **active public share link** is reportable, and the queue
renders through the public share view. `targetType` omits private resumes entirely. This is the
structural resolution of FR 9.5 against FR 9.6.

**Retention.** Activity logs expire after 180 days by TTL index, and the UI says so.

---

## 5. Error and not found (`*`)

**Components.** Status code, a short explanation, and one button returning the visitor to a safe
route based on authentication state. No illustration, no icon.

Covers unknown routes, unauthorized access attempts, and unexpected application errors via a
per-route React error boundary. There is an additional dedicated boundary around the preview and
PDF renderer, because that is the most crash-prone surface and a global boundary would blank the
whole editor and lose unsaved work.

---

## 6. Navigation flows

| Flow             | Sequence                                                                                                        |
| ---------------- | --------------------------------------------------------------------------------------------------------------- |
| New user         | Landing, Register, guard, Dashboard                                                                             |
| Returning user   | Landing, Login, guard, Dashboard                                                                                |
| Guest draft      | Landing, Templates, editor in localStorage, Register, merge, Dashboard                                          |
| Resume creation  | Dashboard, Template selection, Editor, Preview and Export                                                       |
| ATS improvement  | Editor, ATS Readiness, deep link back to the failing field, Editor                                              |
| Sharing          | Preview and Export, share link created, recruiter opens `/r/:slug` without a login                              |
| Review           | Preview and Export or side navigation, reviewer directory modal, request sent, Review Room, Notification Centre |
| Tailor for a job | Preview and Export, duplicate with JD attached, ATS Readiness in full mode                                      |
| Account          | Side navigation, Profile, Logout to Login                                                                       |
| Admin            | Login, guard, Admin Overview, Manage Users or Templates, Reports                                                |
| Recovery         | Login, Forgot and Reset, Login                                                                                  |

**A protected route never renders before the token is verified.** `AuthContext` carries an explicit
`checking` state so the application never flashes the login screen on refresh. An unauthenticated
visitor requesting a protected route is redirected to login; an authenticated user requesting a
route their role does not permit is redirected to the error page.

---

## 7. Responsive behaviour

Three breakpoints across every view.

| Width   | Behaviour                                                                                                             |
| ------- | --------------------------------------------------------------------------------------------------------------------- |
| Mobile  | Single column. Side navigation becomes a drawer. The editor becomes a stacked step-by-step wizard with Back and Next. |
| Tablet  | Two-column split with a collapsible navigation panel. The editor shows form and preview side by side.                 |
| Desktop | Full three-panel layout. Working width 1280 to 1440px, never centred.                                                 |
