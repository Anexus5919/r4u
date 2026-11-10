# Cost Audit

**Hard constraint: R4U must cost nothing to build, run and demonstrate. No paid tier, no
subscription, no trial that expires into a bill, no card required for anything on the critical
path.**

This document exists so that constraint is checkable rather than assumed. Anything added to the
project later must be added to this table first.

---

## 1. Runtime and hosting

| Service       | Plan                             | Limits that actually bite                                                                                                                                          | Cost |
| ------------- | -------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---- |
| Vercel        | Hobby                            | Non-commercial use only, which a coursework project satisfies. 100 GB bandwidth per month.                                                                         | Free |
| Render        | Free web service                 | Spins down after 15 min idle, 30 to 60s cold start. 750 instance hours per month. 5 GB bandwidth per month (cut from 100 GB in April 2026). 512 MB RAM.            | Free |
| MongoDB Atlas | M0                               | 0.5 GB storage **including indexes**. 100 operations per second. No Atlas Search. Auto-pauses after 30 days with zero connections.                                 | Free |
| Cloudinary    | Free                             | 25 monthly credits. Transformations billed per 1,000, so build URLs with a helper and use eager transforms rather than on-the-fly transforms inside a list render. | Free |
| SMTP          | Gmail app password or Brevo free | Gmail: 500 messages per day on a personal account. Brevo: 300 per day, no card. Password reset is the only mail R4U sends.                                         | Free |
| GitHub        | Free, private repo               | 2,000 Actions minutes per month for private repositories. R4U's CI run is roughly 3 to 4 minutes, so that is comfortably over 400 pushes.                          | Free |

**Render is the constraint to watch.** If the free web service becomes unusable, the closest free
substitutes for a Docker container that must hold WebSocket connections are Koyeb's free instance
and Fly.io's free allowance. Both are noted as fallbacks, neither is currently needed.

**Do not add a keep-alive cron to defeat the spin-down.** A permanently warm service consumes
about 720 of the 750 monthly hours, leaving no margin, and exceeding the grant suspends the
service for the rest of the month. That converts a graceful-degradation problem into a
quota-exhaustion problem during a demo. Handle it in the UI instead.

---

## 2. Libraries

Every runtime and build dependency is MIT, Apache-2.0 or ISC. No dual-licensed package, no
"free for open source only" package, no package requiring a key.

| Concern       | Package                                                                                | Licence          |
| ------------- | -------------------------------------------------------------------------------------- | ---------------- |
| PDF           | `@react-pdf/renderer`                                                                  | MIT              |
| Thumbnails    | `html2canvas-pro`, `jspdf`                                                             | MIT              |
| Forms         | `react-hook-form`, `@hookform/resolvers`                                               | MIT              |
| Validation    | `zod`, `express-validator`                                                             | MIT              |
| Drag and drop | `@dnd-kit/*`                                                                           | MIT              |
| Animation     | `motion`                                                                               | MIT              |
| Styling       | `tailwindcss` v4                                                                       | MIT              |
| Realtime      | `socket.io`, `socket.io-client`                                                        | MIT              |
| Email         | `nodemailer`                                                                           | MIT-0            |
| Data          | `mongoose`                                                                             | MIT              |
| Auth          | `jsonwebtoken`, `bcryptjs`                                                             | MIT / ISC        |
| Security      | `helmet`, `express-rate-limit`, `rate-limiter-flexible`                                | MIT              |
| Uploads       | `multer`, `cloudinary`                                                                 | MIT              |
| Logging       | `pino`, `pino-http`                                                                    | MIT              |
| IDs           | `nanoid`                                                                               | MIT              |
| NLP           | `natural`                                                                              | MIT              |
| Content       | `@mdx-js/rollup`                                                                       | MIT              |
| Testing       | `vitest`, `@testing-library/react`, `supertest`, `mongodb-memory-server`, `playwright` | MIT / Apache-2.0 |

**No paid AI API anywhere.** Every "intelligent" feature in R4U is deterministic:

- The ATS checker is a published 100-point rule set.
- The content linter is regex plus JSON word lists.
- Keyword matching is dictionary lookup plus set intersection.

This is not a compromise forced by budget. It is what makes the scores explainable and
reproducible, which is the actual product differentiator. See `ATS-RUBRIC.md`.

---

## 3. Fonts and data

| Asset                                                                       | Source       | Licence                   | Obligation                                   |
| --------------------------------------------------------------------------- | ------------ | ------------------------- | -------------------------------------------- |
| Geist, Source Serif 4, Source Sans 3, EB Garamond, IBM Plex Serif, Spectral | Google Fonts | SIL Open Font License 1.1 | None beyond keeping the licence file         |
| Geist Mono                                                                  | Vercel       | SIL OFL 1.1               | None                                         |
| Skills taxonomy                                                             | ESCO         | Free                      | **Must acknowledge the European Commission** |
| Occupation data                                                             | O*NET        | CC BY 4.0                 | **Must ship an attribution notice**          |

Both attribution lines appear in the ATS methodology panel. A licence violation in a graded
project is an avoidable own goal.

Fonts are self-hosted from the repository rather than loaded from Google's CDN. That is required
anyway: `@react-pdf/renderer` rejects WOFF2, and Render's ephemeral filesystem would re-fetch
anything cached at runtime on every cold start.

---

## 4. The one paid item, removed

**ADR-014 previously proposed buying a domain for roughly 12 USD per year. That is withdrawn.**

The problem it solved is real: Vercel and Render are different sites, so the refresh-token cookie
is a third-party cookie requiring `SameSite=None; Secure`. Safari's Intelligent Tracking
Prevention blocks that outright. The symptom is auth working perfectly in Chrome and logging users
out on every page reload in Safari, plausibly including on an examiner's laptop.

Three free ways to solve it, in order of preference.

### 4.1 Preferred: proxy the HTTP API through Vercel

Add to `vercel.json`:

```json
{
  "rewrites": [
    { "source": "/api/:path*", "destination": "https://r4u-api.onrender.com/api/:path*" }
  ]
}
```

The browser then only ever talks to one origin for HTTP, so the refresh cookie is **first-party**
and Safari is a non-issue. No domain, no cost, no configuration on the Render side.

**Socket.IO connects directly to Render and is unaffected**, because the socket handshake
authenticates with the in-memory access token via `auth`, not with a cookie. Nothing about the
real-time layer depends on the proxy.

**Known risk, stated honestly:** Vercel's proxy has its own request timeout, and a Render cold
start can run 30 to 60 seconds. The first request after an idle period may time out through the
proxy rather than waiting. Mitigation is the same cold-start handling already specified: fire
`/api/health` at app boot, show the "waking the server" line, and retry. This needs to be measured
during Phase 1 rather than assumed, and if it proves unworkable, fall back to 4.2.

### 4.2 Free domain via the GitHub Student Developer Pack

The pack is free for verified students and includes a free domain for one year from Namecheap
(`.me`) and from Name.com, plus free DNS. Point `app.r4u.me` at Vercel and `api.r4u.me` at Render,
and scope the cookie `Domain=.r4u.me; SameSite=Lax; Secure; HttpOnly; Path=/api/auth`.

This is the cleanest solution technically and costs a student nothing. It is second only because
it depends on an approval process with a lead time, and the project should not block on it.

### 4.3 Zero-configuration fallback

Ship `SameSite=None; Secure; Partitioned` and document the Safari limitation in the README rather
than hiding it.

**Do not use a free subdomain service such as `is-a.dev` or `js.org` for this.** Many are on the
Public Suffix List, which means the browser refuses to set a cookie scoped to the shared parent
domain, and the cross-site problem returns in a form that is harder to diagnose.

---

## 5. Also withdrawn

Nothing else. **DOCX export via the `docx` package stays**, since that package is MIT and costs
nothing. It remains recommended: Textkernel logs "document format is PDF" as a code-300 major
issue, so a text-layer DOCX is measurably safer for ATS than any PDF.

---

## 6. Standing rule

Before adding any dependency or service, check three things:

1. Is it free permanently, not free-for-14-days?
2. Does it require a card to register, even for the free tier?
3. Does its licence require attribution, and has that attribution shipped?

If any answer is unsatisfactory, it does not go in, and the reason is recorded in `DECISIONS.md`.
