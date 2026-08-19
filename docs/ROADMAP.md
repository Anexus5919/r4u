# Build Roadmap

Twelve phases. Each phase has an exit criterion that is checkable, not a feeling.

**Commit granularity: one commit per feature or decision, not per file.** A phase produces roughly
six to fifteen commits. Conventional Commits, imperative mood, lowercase subject, no trailing
period, no em dashes, no attribution of any tool or assistant.

Types in use: `feat`, `fix`, `refactor`, `docs`, `test`, `chore`, `build`, `ci`, `perf`, `style`.

---

## Phase 0: Repository and planning

**Status: done.**

Repository created private at `Anexus5919/r4u`. Line endings normalised. Full documentation set:
design system, architecture, decisions, data model, realtime, templates, ATS rubric, requirements,
routes, API, cost audit, roadmap.

**Exit criterion.** Every subsequent phase can be built without re-deriving a decision.

---

## Phase 1: Foundation

**Status: done.**

**Goal.** The design system exists as code and is machine-enforced before any feature is built.

- npm workspaces monorepo: `client`, `server`, `shared`
- Vite, React 19, TypeScript pinned to exactly `5.9.3`, Tailwind v4 with `@tailwindcss/vite`
- `styles/tokens.css`: the 13-step ink ramp in explicit sRGB hex for both themes, accent,
  semantics, radii, motion durations and curves, the two spacing scales
- Self-hosted fonts: Newsreader, Public Sans, Geist Mono, subset to Latin
- `components/ui/`: Button, Input, Label, Card, Modal, Toast, Table, Rule, Skeleton
- The twelve-glyph icon set, 16px grid, 1.5px stroke, 1px corner radius
- `ThemeContext` and `ToastContext`
- `scripts/design-guard.sh`
- ESLint 10 flat config, Prettier with `prettier-plugin-tailwindcss`, husky, lint-staged, commitlint
- GitHub Actions: install, lint, typecheck, design-guard, build

**Exit criterion.** A page composed only of `components/ui` renders correctly in both themes,
`design-guard.sh` passes, and deliberately introducing `rounded-full` or a purple hex fails CI.

**Deferred to phase 12.** The Vercel rewrite proxy measurement against a cold Render instance
belongs with deployment. Development runs both services locally, where the cookie is same-site
and the question does not arise.

---

## Phase 2: Authentication, RBAC and the privacy boundary

**Status: done.**

**Goal.** Every role boundary exists and is tested before any content route is written.

- `config/env.ts` with zod validation at boot, refusing to start on a short secret
- Mongoose connection, `autoIndex: false`, explicit index migration script
- `User`, `RefreshToken`, `PasswordResetToken`
- Register, login, refresh with family rotation, logout, forgot, reset
- `authenticate`, `authorize(...roles)` as **set membership**, `requireOwner`
- **The fail-closed `pre(/^find/)` content-strip hook on the Resume schema**
- Central error middleware, `AppError`, the error-code table
- helmet, CORS allowlist, tiered rate limiting, `trust proxy` set to `1`
- `AuthContext` with an explicit `checking` state, `useApi` with refresh-and-retry
- Route guards, `/login`, `/register`, `/reset`

**Exit criterion.** Supertest proves: 401 without a token, 403 for the wrong role, 404 for a
cross-user resume read, a blocked user denied immediately after blocking, and
**an admin read of resume content returning 403 `ADMIN_CONTENT_FORBIDDEN`**.

That last test is written in this phase and never deleted. It is the one requirement where a
regression is a privacy breach rather than a bug.

**FR:** 1.1 to 1.10, 9.6.

---

## Phase 3: Profile, theme, feedback

**Status: done.** Avatar upload requires Cloudinary credentials and reports itself unavailable
without them; everything else works with no third-party account.

- `GET`/`PATCH /users/me`, password change, avatar upload to Cloudinary with magic-byte checks
- Account deletion with cascade
- `/profile`
- Theme persistence, loading and skeleton states, error surfaces, toast queue

**Exit criterion.** Theme survives a reload, every mutation raises a toast, a network failure shows
a readable message rather than a blank screen.

**FR:** 2.1 to 2.4, 8.4, 10.2, 10.3.

---

## Phase 4: Resume CRUD and dashboard

- `Resume` model with `sections[]`, `meta`, `version`
- `shared/SECTION_REGISTRY` and the base Zod schemas, composed base-object-first
- CRUD, duplicate, search, filter, sort
- `/dashboard` with the deliberately asymmetric grid and the three-door empty state
- Guest drafts in localStorage, merged on registration
- `shared/fixtures/sample-resume.ts`, the Alex Mercer fixture

**Exit criterion.** A user creates, lists, searches, duplicates and deletes resumes, and a second
user gets 404 on all of them.

**FR:** 3.1 to 3.4, 3.6, 3.7. **AR:** 5.

---

## Phase 5: The editor

**The largest phase. Split it across many commits.**

- Editor `useReducer` with domain-verb actions and past/future stacks for undo and redo
- Section forms driven by `SECTION_REGISTRY`, react-hook-form, character counters
- `@dnd-kit` reordering for sections and entries, keyboard accessible
- Per-section and per-entry visibility toggles
- Cross-field validation including end-date-not-before-start-date
- Debounced PATCH autosave, allowlisted ops, `arrayFilters`, version conflict handling,
  `beforeunload` guard
- The content linter and coaching panel
- Completeness from the rule pass rate
- Private `notes` field

**Exit criterion.** Reducer unit tests cover reorder, hide and undo. Autosave survives a forced 409. Two tabs editing disjoint sections both converge.

**FR:** 3.5, 4.1 to 4.6. **AR:** 10.

---

## Phase 6: Templates and live preview

- The `LayoutNode` union and the restricted `Style` type
- `renderToDom()`
- The eight templates: Foundry, Quire, Ledger, Placard, Recto, Verso, Marginalia, Broadsheet
- `Template` model and the registry, seeded
- The five customisation knobs driven by CSS custom properties
- Template switching with the `slots` map and the reorder prompt
- `ResumeVersion` with milestone snapshots and restore
- JSON Resume import and export
- Live page-overflow warning with the three ranked remedies

**Exit criterion.** Switching any template to any other loses no section and duplicates none.
The overflow warning names the overflow in millimetres and updates live.

**FR:** 5.1 to 5.5. **AR:** 4, 6, 7.

---

## Phase 7: Export and sharing

- `renderToPdf()` behind a dynamic import, with the 5-second `Promise.race` guard
- Static font registration per weight
- `wrap={false}` on atomic entries
- Page count read from the PDF render, not the DOM
- `@page A4` print stylesheet
- `html2canvas-pro` thumbnails, awaiting `document.fonts.ready`
- `linearize()` and the ATS variant toggle
- `ShareLink`, `ShareView`, the daily rollup, redaction flags, analytics
- `/r/:slug` with the security headers

**Exit criterion.** **The CI text-extraction test passes for all eight templates**: name, section
headings, employers and date ranges extract intact and in reading order. A disabled or expired
link renders a message, not content. The owner's own views do not increment the counter.

**FR:** 6.1 to 6.5. **AR:** 8, 9.

---

## Phase 8: Reviews, real time and notifications

- `Review`, `Comment`, `Message`, `Notification`
- Socket server, JWT handshake with `auth` as a function, the `socket.use()` guard
- Rooms, the full event catalogue, derived presence with the 10-second grace
- `SocketContext` with a single shared instance, cold-start UX
- Reviewer directory, request, accept and decline
- Review room: comments, chat with optimistic send and `clientId` dedup, cursor history
- Coalesced notifications, unread counts, `/notifications`
- **Explicit admin deny on `review:*` and `resume:*`**

**Exit criterion.** Two browser contexts exchange messages instantly. Killing one shows the other
offline after the grace period. History restores on rejoin. A retried send does not duplicate. An
admin token is refused at `review:join`.

**FR:** 7.1 to 7.7, 8.1 to 8.3.

---

## Phase 9: Administration

- `/admin` overview with the prefix-filtered live-session count and monochrome charts
- `/admin/users` with the table design from the design system
- `/admin/templates`, metadata only, previews from the fixture
- `Report` and `ActivityLog` with the buffered writer and the meta allowlist
- `/admin/reports` with the two tabs
- The "Resume content is not visible to administrators" line in the UI

**Exit criterion.** No admin endpoint can select `sections`, `personal` or `notes`. `targetType`
has no private-resume value. Blocking a user ends their session immediately.

**FR:** 9.1 to 9.5.

---

## Phase 10: ATS Readiness

**The flagship. Ship it well or not at all.**

- `serializeToParserView(resume, template)`
- All five dimensions, the A-GATE hard zero, the E-CAP stuffing guard
- The action-verb list, the quantification regex **with the year and version guard**
- The keyword pipeline, ESCO-seeded `skills.json`
- `AtsScore` persisting check ids and points only
- `/resume/:id/ats`: dimension bars, itemised checks with deep links, the Parser Preview pane
- Template ATS badging with the parseability ceiling
- Tailor for a job

**Exit criterion.** Unit tests per check. A duty-only bullet in a 2021 to 2023 role scores zero on
D3, which is the single test that proves the quantification guard works. Every failed check deep
links to the right field.

**AR:** 1, 2, 3.

---

## Phase 11: Content, accessibility and polish

- MDX pipeline, `/about`, `/privacy`, `/terms`, `/guides`, `/ats-methodology`
- Per-check explainers with `<BeforeAfter />`
- ESCO and O*NET attribution
- The landing page and the hero lockup, built last, when there is a real product to screenshot.
  Full spec in `LANDING.md`, including the two named exceptions it takes to the design system
- DOCX export
- `prefers-reduced-motion` audit, focus order, keyboard paths, `@axe-core/playwright`
- One Playwright E2E: register, create, fill, reorder by drag, share, open in a second context,
  assert the counter incremented

**Exit criterion.** The full keyboard path works end to end. Axe reports no violations on the five
principal screens.

**FR:** 10.1, 10.4, 10.5. **AR:** 11, 12.

---

## Phase 12: Containerisation and deployment

- Multi-stage Dockerfiles for client and server, `USER node`, `--init`, `.dockerignore`
- Fonts baked into the image
- `docker-compose.yml` running client, server and MongoDB together
- Graceful SIGTERM: stop accepting, `io.close()`, drain, close Mongoose
- GitHub Actions deploy job, `gitleaks`, `npm audit --audit-level=high`
- `mongodb-memory-server` binary cached with `actions/cache`
- Render and Vercel configured, the rewrite proxy in `vercel.json`
- `.env.example`, README setup steps, the Postman collection

**Exit criterion.** `docker compose up` gives a working stack from a clean clone. A push to `main`
builds, tests, and deploys. The health endpoint reports `db: 1` in production.

---

## Standing rules

1. **Never commit `.env`.** `gitleaks` runs in CI, but the discipline comes first.
2. **Never use `--no-verify`.** If a hook fails, fix the cause.
3. **Every phase leaves `main` deployable.** Feature branches merge only when CI is green.
4. **`COST.md` is updated before any dependency or service is added**, not after.
5. **No em dashes** in code, comments, documentation, UI copy or commit messages.
6. **No attribution** of any tool or assistant in any commit, file, comment or artefact.
7. Comments are short and explain **why**, never what. No multi-line comment blocks describing
   obvious code.
8. When a decision is made that a future reader would question, it goes in `DECISIONS.md` in the
   same commit that implements it.

---

## Demo checklist

Run through this before any demonstration or viva.

- [ ] Resume the Atlas M0 cluster if the project has been idle 30 days
- [ ] Warm the Render instance with a real request several minutes beforehand
- [ ] Confirm the seeded admin, reviewer and user accounts log in
- [ ] Confirm one resume has a live share link and a non-zero view count
- [ ] Confirm one review has chat history, so the room is not empty on open
- [ ] Open the exported PDF and select text in it, on screen, in front of the panel
- [ ] Have `/ats-methodology` open in a tab, since publishing the rubric is the differentiator
