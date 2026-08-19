# R4U

**Resume For You.** An ATS-aware resume builder with a live A4 preview, real-time mentor review,
and role-based access control.

Built on the MERN stack for the Full Stack Development laboratory. Adarsh Singh, D15A, roll 52.

---

## What it does

A resume is stored as **structured data, never as a formatted file**. Content and presentation
stay separate, so the same information renders through any of eight templates, exports to a real
A4 PDF, and publishes as a controlled public link, without the user ever adjusting a layout.

Four roles, separated by access control rather than by interface:

| Role | Can |
|---|---|
| Guest | Browse, open a valid share link, register |
| User | Own, edit, template, export, share and submit resumes for review |
| Reviewer | Comment on and chat about a resume shared with them. **Cannot edit content.** |
| Admin | Manage users, templates and reports. **Cannot read private resume content.** |

---

## Three things that make it more than a CRUD project

**1. The PDF has a real text layer.**
The obvious implementation, rasterising the DOM to a bitmap, produces a file that every applicant
tracking system extracts as empty. Measured: 305 KB with zero extractable text, against 3 KB with
34 real text items from a vector renderer. R4U ships the vector path, so a resume it produces can
actually be read by the systems it is built to survive. See `docs/DECISIONS.md`, ADR-001.

**2. The ATS score is published, not asserted.**
A deterministic 100-point rubric across five dimensions, built on the published resume-quality
codes of the Textkernel parsing engine used by iCIMS and Bullhorn. No machine learning, no API
key, nothing hidden. The full rubric is a page in the app, and every failed check deep links to
the exact field that caused it. A Parser Preview pane shows the raw text a machine actually sees.
See `docs/ATS-RUBRIC.md`.

**3. The admin genuinely cannot read your resume.**
Enforced at the Mongoose query layer with a fail-closed hook, not by hiding a button. Admin
statistics read denormalised counters. Only publicly shared resumes are reportable, and the
moderation queue renders through the same public view any visitor has. The guarantee carries a
dedicated test. See `docs/DECISIONS.md`, ADR-008.

---

## Stack

| Layer | Technology |
|---|---|
| Frontend | React 19, Vite, TypeScript, React Router, Tailwind CSS v4, Axios, Context API with useReducer, Socket.IO client |
| Backend | Node 22, Express 5, JSON Web Token, bcryptjs, Socket.IO, express-validator, Zod |
| Database | MongoDB Atlas with Mongoose |
| PDF | `@react-pdf/renderer` for export, `@page` print CSS as fallback, `html2canvas-pro` for thumbnails |
| Editor | react-hook-form, dnd-kit |
| Testing | Vitest, Testing Library, Supertest, mongodb-memory-server, Playwright |
| Ops | Docker, Docker Compose, GitHub Actions, Vercel, Render, Cloudinary, pino |

**Everything is free.** No paid tier, no subscription, no API key, nothing requiring a card. The
full audit is in `docs/COST.md` and must be updated before any dependency is added.

---

## Repository layout

```
r4u/
  client/        React application
  server/        Express API and Socket.IO
  shared/        Zod schemas, types, constants, layout AST, fixtures
  docs/          see below
  scripts/       design-guard.sh, index migration, seeds
```

`shared/` is a real workspace package imported by both sides. One definition of every field and
character limit means the client counter and the server rejection can never disagree.

---

## Documentation

| File | Contents |
|---|---|
| `docs/DESIGN-SYSTEM.md` | Token set, enforceable ban list, per-surface Gestalt rules |
| `docs/ARCHITECTURE.md` | Topology, the layout AST, auth, RBAC, autosave |
| `docs/DECISIONS.md` | Every deviation from the original specification, with evidence |
| `docs/DATA-MODEL.md` | Fourteen collections, indexes, TTL budget |
| `docs/API.md` | REST endpoint catalogue, error codes, rate limits |
| `docs/REALTIME.md` | Socket.IO rooms, event catalogue, presence |
| `docs/TEMPLATES.md` | The eight templates and document typography |
| `docs/ATS-RUBRIC.md` | The published 100-point rubric |
| `docs/REQUIREMENTS.md` | Traceability for all 59 specified requirements |
| `docs/ROUTES.md` | Twenty-four routes with guards and navigation flows |
| `docs/ROADMAP.md` | Twelve build phases with exit criteria |
| `docs/COST.md` | Free-tier audit and licence obligations |

---

## Setup

Requires Node 22 and npm 10.

```bash
git clone https://github.com/Anexus5919/r4u.git
cd r4u
npm install

cp .env.example server/.env      # fill in MONGODB_URI, JWT secrets, Cloudinary
npm run dev                      # client on 5173, server on 5000
```

With Docker:

```bash
docker compose up
```

### Scripts

| Command | Does |
|---|---|
| `npm run dev` | Client and server in watch mode |
| `npm run build` | Production build of both |
| `npm run lint` | ESLint across the workspace |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run test` | Vitest, client and server projects |
| `npm run test:e2e` | Playwright |
| `npm run design-guard` | Fails on any design ban-list violation |
| `npm run seed` | Templates, and demo user, reviewer and admin accounts |

---

## Conventions

- **Conventional Commits.** One commit per feature or decision, not per file.
- **No em dashes** anywhere: code, comments, documentation, UI copy, commit messages.
- **Comments explain why, never what.** Short, and only where the reason is not obvious.
- **No hex literal outside `client/src/styles/tokens.css`.** CI enforces it.
- **Never `--no-verify`.** If a hook fails, fix the cause.
- **Never commit `.env`.** `gitleaks` runs in CI.

---

## Known limitations

Stated rather than hidden.

- Render's free tier sleeps after 15 minutes idle, so the first request after a quiet period waits
  30 to 60 seconds. The UI explains the wait instead of showing a spinner. No keep-alive cron is
  used, because a permanently warm service consumes 720 of the 750 monthly instance hours.
- Rate limiting uses an in-memory store that resets on every restart, so limits are effectively
  per-uptime-window. Login attempts are additionally tracked persistently on the user document,
  which is what actually survives a restart.
- Atlas M0 has no Atlas Search, so resume search uses a text index rather than `$search`. It also
  auto-pauses after 30 days with no connections.
- Two-column templates are honestly labelled as not ATS-safe, and ship with a one-click linearised
  variant rather than being quietly presented as equivalent.

---

## Attribution

Skills taxonomy derived from **ESCO**, published by the European Commission. Occupation data from
**O\*NET**, licensed CC BY 4.0. Both are acknowledged in the application's ATS methodology page.

Typefaces: Newsreader, Public Sans, Source Serif 4, Source Sans 3, EB Garamond, IBM Plex Serif and
Spectral under the SIL Open Font License 1.1. Geist Mono under the SIL OFL 1.1.
