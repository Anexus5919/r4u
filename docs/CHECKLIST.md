# Checklist evidence

How to prove each item of the Full-Stack Project Checklist, twice: once in the code, once in the
running application. Paths are relative to the repository root.

**Live app:** https://r4u-delta.vercel.app · **API:** https://r4u-api.onrender.com/api/health

**Demo accounts** (password `R4uDemo-2026!`): `user@r4u.dev` (owner), `reviewer@r4u.dev` (reviewer),
`kavya@r4u.dev` (reviewer with a pending request), `rahul@r4u.dev` (blocked). Admin: your own registered account, promoted with the admin command.

**Before a demo:** open the API health link a minute early. The free Render instance sleeps when
idle and the first request can take up to a minute.

---

## 1. Frontend development (React + Tailwind CSS)

### Responsive UI

| Item                    | Show in the code                                                                                                        | Show in the app                                                                                             |
| ----------------------- | ----------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| Mobile-friendly layout  | `sm:` / `md:` / `lg:` classes across `client/src` (130+ uses), e.g. `client/src/routes/DashboardPage.tsx`               | DevTools, toggle device toolbar (Ctrl+Shift+M), pick iPhone 12: landing, dashboard and editor all fit       |
| Tablet-friendly layout  | Same breakpoints; the editor stacks form and preview below `lg`                                                         | Device toolbar at 768 px wide                                                                               |
| Desktop-friendly layout | `client/src/routes/AppShell.tsx` (full bar with links above `md`)                                                       | Normal browser window                                                                                       |
| Responsive navigation   | `client/src/routes/AppShell.tsx`, the `drawer` state (line 166, "a drawer below md")                                    | On a phone width, the links collapse into a menu button that opens a drawer                                 |
| Spacing and typography  | `client/src/styles/tokens.css` (one ramp, one type scale), `docs/DESIGN-SYSTEM.md`                                      | Same spacing and type on every page                                                                         |
| Dark/Light mode         | `client/src/context/ThemeProvider.tsx`, dark tokens in `client/src/styles/tokens.css`, toggle in `AppShell.tsx` line 86 | Account menu (top right), Theme: Light / Dark. It is saved to the account and follows you to another device |

### Tailwind CSS

| Item                      | Show in the code                                                                                         | Show in the app                                                        |
| ------------------------- | -------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------- |
| Tailwind used throughout  | `client/src/styles/index.css` line 1 (`@import 'tailwindcss'`), `client/vite.config.ts` plugin           | Every page                                                             |
| Utility classes used well | Any component, e.g. `client/src/components/ui/Button.tsx`, `client/src/components/ui/buttonClasses.ts`   | n/a                                                                    |
| Reusable UI components    | `client/src/components/ui/` (Button, Input, Field, Modal, Table, Card, Banner, Segmented, Avatar...)     | The same buttons, fields and tables on every screen                    |
| Hover, focus, transition  | `hover:` (40+), `focus-visible:` and `transition` classes, e.g. `buttonClasses.ts`                       | Hover any button or resume card; Tab through a form to see focus rings |
| Consistent colour palette | `client/src/styles/tokens.css`; `scripts/design-guard.sh` fails CI if a hex colour appears anywhere else | One blue accent and one grey ramp everywhere                           |

### Interactive UI

| Item                  | Show in the code                                                                                                                                      | Show in the app                                                                                                 |
| --------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------- |
| Forms with validation | `client/src/routes/RegisterPage.tsx` (required, email type, password match at line 100); server rules in `server/src/modules/auth/auth.validators.ts` | Register with a short password or mismatched confirm: field messages appear; register an existing email: banner |
| Loading indicators    | `Skeleton` in `client/src/routes/admin/AdminOverviewPage.tsx` line 153; `loading` prop on `Button`                                                    | Reload the dashboard or admin overview: grey placeholders, spinner on buttons while saving                      |
| Error messages        | `Banner` in `RegisterPage.tsx` line 58; `toast('danger', ...)` in `client/src/routes/admin/AdminReportsPage.tsx`                                      | Sign in with a wrong password: "Email or password is incorrect"                                                 |
| Success notifications | `client/src/context/ToastProvider.tsx`; `toast('success', ...)` in `client/src/components/share/SharePanel.tsx` line 234                              | Preview a resume, create a share link, click Copy: "Link copied" toast                                          |
| Modal/Dialog          | `client/src/components/ui/Modal.tsx`; used in `DashboardPage.tsx` (delete confirm), `RequestReviewModal.tsx`, `SharePanel.tsx`                        | Dashboard, Delete on a resume: confirmation dialog. Or Request review on the preview page                       |
| Search/Filter         | `DashboardPage.tsx` line 265 (search by title, status filter, sort); `client/src/routes/admin/AdminUsersPage.tsx` line 121                            | Dashboard: type in "Search by title", click Draft / In review; Notifications page: All / Unread tabs            |

---

## 2. React concepts

| Item                     | Show in the code                                                                                                                                                                                            | Show in the app                                   |
| ------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------- |
| useState                 | Any page, e.g. `DashboardPage.tsx` line 175 (`pendingDelete`), `AppShell.tsx` line 166 (`drawer`)                                                                                                           | Opening the drawer, the delete dialog             |
| API calls in useEffect   | `client/src/hooks/useResumes.ts`, `client/src/hooks/useTemplates.ts`                                                                                                                                        | Dashboard loads the resume list on mount          |
| Cleanup functions        | `client/src/context/SocketProvider.tsx` lines 95 and 112 (socket listeners), `ThemeProvider.tsx` line 29, `Modal.tsx` line 45, `client/src/hooks/useDebounce.ts`                                            | n/a                                               |
| Proper dependency arrays | `eslint.config.js` line 55 enables `react-hooks` rules; `npm run lint` passes                                                                                                                               | n/a                                               |
| Context API, Provider    | `client/src/context/`: AuthProvider, SocketProvider, ThemeProvider, ToastProvider, wrapped in `client/src/main.tsx`                                                                                         | Signing in once keeps you signed in on every page |
| Custom hook, reused      | `client/src/hooks/useDebounce.ts` used by `DashboardPage.tsx` and `AdminUsersPage.tsx`; `useTemplates` by `NewResumePage.tsx` and `PublicPages.tsx`; plus `useAuth`, `useSocket`, `useToast`, `useAutosave` | Search boxes wait for you to stop typing          |

## 3. State management (Context API, the recommended option)

| Item                    | Show in the code                                                                                                                                       | Show in the app                   |
| ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------- |
| Global state            | `client/src/context/AuthProvider.tsx` line 36 (`useReducer`), `ToastProvider.tsx` line 29                                                              | Name in the top bar, unread badge |
| Multiple contexts       | Four: Auth, Socket, Theme, Toast in `client/src/context/`                                                                                              | n/a                               |
| Efficient state updates | `useMemo` on provider values (`AuthProvider.tsx` line 95, `SocketProvider.tsx` line 117); editor reducer in `client/src/routes/EditorPage.tsx` line 68 | Typing in the editor stays smooth |

---

## 4. Backend REST API

| Item                 | Show in the code                                                                                | Show in the app                                                                                  |
| -------------------- | ----------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| RESTful endpoints    | `server/src/routes.ts` (all groups mounted), one folder per resource in `server/src/modules/`   | DevTools, Network tab, filter `api`: watch the calls while you click                             |
| CRUD                 | `server/src/modules/resumes/resumes.routes.ts`: POST create, GET list/one, PATCH update, DELETE | Create a resume, edit it, rename, duplicate, delete                                              |
| Proper HTTP methods  | Same file; PATCH is autosave (`resumes.autosave.ts`)                                            | Network tab while editing: `PATCH /api/resumes/:id`                                              |
| Correct status codes | `docs/API.md` section 1.2; `server/src/middleware/error.ts`                                     | Network tab: 201 on create, 204 on delete, 401 after sign-out, 404 on a bad id, 422 on bad input |
| API documentation    | `docs/API.md`, `docs/REALTIME.md`, Postman collection `docs/r4u.postman_collection.json`        | Open the Postman collection in Postman                                                           |

## 5. MongoDB + Mongoose

| Item                    | Show in the code                                                                                                                                                                       | Show in the app                                                                                   |
| ----------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------- |
| Database connected      | `server/src/config/db.ts`                                                                                                                                                              | https://r4u-api.onrender.com/api/health shows `"db":1`; Atlas, Browse Collections, database `r4u` |
| Mongoose schemas        | `server/src/models/` (15 models), documented in `docs/DATA-MODEL.md`                                                                                                                   | n/a                                                                                               |
| Validation              | `server/src/models/User.ts` lines 17 to 29 (`required`, `maxlength`, `unique`, `enum`)                                                                                                 | n/a                                                                                               |
| Relationships, populate | `ref:` fields, e.g. `server/src/models/ShareLink.ts`; `.populate()` in `server/src/modules/admin/admin.service.ts` lines 306 and 373, `reviews.service.ts`, `notifications.service.ts` | Admin, Reports or Overview activity show user names resolved from ids                             |
| Indexes                 | `.index()` in `server/src/models/*.ts`; created at boot by `server/src/scripts/indexes.ts` (called in `server/src/index.ts` line 12)                                                   | Atlas, a collection, Indexes tab                                                                  |
| Optimised queries       | `.select()` projections, `.lean()`, pagination and `countDocuments` in the services                                                                                                    | Lists are paginated (admin users, notifications)                                                  |

## 6. Secure REST API

| Item                      | Show in the code                                                                                                                                    | Show in the app                                                                       |
| ------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------- |
| Input validation          | `server/src/middleware/validate.ts`, `*.validators.ts` in every module (express-validator, read with `matchedData`)                                 | Register with bad input: 422 with per-field details                                   |
| Error handling middleware | `server/src/middleware/error.ts` line 68 (`errorHandler`), line 7 (`notFoundHandler`), `server/src/lib/AppError.ts`                                 | Any error returns `{ error: { code, message } }`, never a stack trace                 |
| Environment variables     | `.env.example`, `server/src/config/env.ts` (Zod checks every variable at boot)                                                                      | Render dashboard, r4u-api, Environment                                                |
| bcrypt                    | `server/src/lib/password.ts` (bcryptjs, cost 12)                                                                                                    | Atlas, `users` collection: only `passwordHash` is stored                              |
| Sensitive data protected  | `server/src/models/User.ts` line 29 (`select: false`) and line 61 (stripped from JSON); `server/src/lib/serializers.ts`; share tokens stored hashed | Network tab on `/api/auth/me`: no hash in the response                                |
| Proper logging            | `server/src/config/logger.ts` (pino, pino-http)                                                                                                     | Render dashboard, r4u-api, Logs                                                       |
| Extra hardening           | `server/src/app.ts` (Helmet, exact-origin CORS, body limits), `server/src/middleware/rateLimit.ts`                                                  | Six sign-in attempts within 15 minutes: "Too many requests. Try again shortly." (429) |

## 7. Authentication and authorization

| Item                          | Show in the code                                                                                                                                                     | Show in the app                                                                                                   |
| ----------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| Registration                  | `server/src/modules/auth/auth.routes.ts` (`POST /register`), `client/src/routes/RegisterPage.tsx`                                                                    | /register                                                                                                         |
| Login                         | Same file (`POST /login`), `client/src/routes/LoginPage.tsx`                                                                                                         | /login                                                                                                            |
| JWT generation                | `server/src/lib/tokens.ts` line 19 (`signAccessToken`), rotating refresh token at line 52                                                                            | Network tab, `/api/auth/login` response contains `accessToken`; Application tab shows the httpOnly refresh cookie |
| Protected routes              | Client: `client/src/routes/guards.tsx` used in `router.tsx`. Server: `requireAuth` on every private router                                                           | Sign out, then open /dashboard: redirected to sign-in                                                             |
| Token verification middleware | `server/src/middleware/authenticate.ts` (verifies the JWT and re-reads role, status and tokenVersion)                                                                | Admin blocks a user: that user is signed out on the next request                                                  |
| Logout                        | `POST /logout` in `auth.routes.ts`; account menu in `AppShell.tsx`                                                                                                   | Account menu, Sign out                                                                                            |
| Admin role                    | `role` enum in `server/src/models/User.ts`; `server/src/modules/admin/admin.routes.ts` line 50 (`authorize('admin')`); promoted by `server/src/scripts/admin-cli.ts` | Sign in with your admin account: Overview, Users, Templates, Reports                                              |
| User role                     | `authorize('user', 'reviewer')` on resumes, share, reviews, notifications routers                                                                                    | Sign in as `user@r4u.dev`                                                                                         |
| Role-based access control     | `server/src/middleware/authorize.ts` line 7 (set membership); reviewer-only routes in `users.routes.ts`                                                              | Sign in as `kavya@r4u.dev` (reviewer): a pending request to accept or decline                                     |
| Unauthorized access handled   | 401 / 403 from the middleware, 404 for someone else's resume (`resumes.access.ts`); client guards redirect                                                           | As `user@r4u.dev` open /admin: sent away. Sign in as `rahul@r4u.dev`: "This account is blocked"                   |

---

## 8. Real-time features (Socket.IO)

Use two windows side by side: a normal one signed in as `user@r4u.dev` and an incognito one signed
in as `reviewer@r4u.dev`.

| Item                   | Show in the code                                                                                                                                                                                                     | Show in the app                                                                                                         |
| ---------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| Socket.IO implemented  | `server/src/sockets/index.ts` (own CORS at line 79, auth at line 91); `client/src/context/SocketProvider.tsx` (one shared socket, `auth` as a function at line 31)                                                   | Network tab, WS filter: a `socket.io` WebSocket stays open                                                              |
| Real-time updates      | `share:viewed` emitted in `server/src/modules/share/share.service.ts` line 262                                                                                                                                       | Owner opens Preview of Backend Developer CV; open the share link in the incognito window: views go up without a refresh |
| Live notifications     | `emitToUser(..., 'notify:new')` in `server/src/modules/notifications/notifications.service.ts` line 68                                                                                                               | Reviewer posts a comment: the owner's bell count increases instantly                                                    |
| Live chat              | `chat:send` handler in `server/src/sockets/handlers.ts` line 142; `client/src/routes/ReviewRoomPage.tsx`                                                                                                             | Both open Reviews, Backend Developer CV: messages and typing appear live                                                |
| Connect and disconnect | Server `disconnecting` and `disconnect` handlers, `server/src/sockets/index.ts` lines 111 and 118, presence in `presence.ts`; client `connect`, `connect_error`, `disconnect` in `SocketProvider.tsx` lines 38 to 63 | Close the reviewer window: the owner sees the reviewer go from online to "last seen"                                    |

## 9. Docker

| Item                  | Show in the code                                                              | Show in the app                                                                                             |
| --------------------- | ----------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| Dockerfile            | `server/Dockerfile`, `client/Dockerfile` (multi-stage, non-root, HEALTHCHECK) | n/a                                                                                                         |
| .dockerignore         | `.dockerignore` (no `node_modules`, `.env`, tests or docs in the image)       | n/a                                                                                                         |
| Runs inside Docker    | `docker-compose.yml`                                                          | `docker compose up --build`, then http://localhost:8080; `docker compose ps` shows three healthy containers |
| Environment variables | `environment:` blocks in `docker-compose.yml`                                 | `docker compose exec server env` (shows configuration names)                                                |
| Docker Compose        | `docker-compose.yml`: `mongo`, `server`, `client`                             | Same command                                                                                                |
| In production         | `render.yaml` builds `server/Dockerfile`                                      | Render dashboard, r4u-api header shows "Docker"                                                             |

## 10. DevOps and deployment

| Item                    | Show in the code                                                                                       | Show in the app                                                  |
| ----------------------- | ------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------- |
| Frontend deployed       | `client/vercel.json`                                                                                   | https://r4u-delta.vercel.app                                     |
| Backend deployed        | `render.yaml`                                                                                          | https://r4u-api.onrender.com/api/health                          |
| Database connected      | `MONGODB_URI` is `sync: false` in `render.yaml` (set in the dashboard, never in git)                   | Health shows `"db":1`; sign in with a demo account               |
| Environment variables   | `render.yaml` `envVars`, `client/vercel.json`                                                          | Render, Environment; Vercel, Settings, Environment Variables     |
| Production build        | `npm run build` (root `package.json` line 20)                                                          | Vercel, Deployments: Ready; GitHub Actions, Docker images job    |
| GitHub repository       | `Anexus5919/r4u`                                                                                       | github.com/Anexus5919/r4u                                        |
| GitHub Actions workflow | `.github/workflows/ci.yml` (Verify, Unit and integration, End-to-end, Docker images, Security, Deploy) | GitHub, Actions tab: green runs on `main`                        |
| Automatic deployment    | `autoDeployTrigger: checksPass` in `render.yaml`; Vercel Git integration on `main`                     | Render, Deploys: rows with trigger "Auto-Deploy" after each push |
| Build passes            | `npm run verify`                                                                                       | Actions tab: all jobs green                                      |

---

## 11. Project quality

| Item                        | Show in the code                                                                                                          | Show in the app                |
| --------------------------- | ------------------------------------------------------------------------------------------------------------------------- | ------------------------------ |
| Modular folder structure    | `client/`, `server/`, `shared/` workspaces; `server/src/modules/<resource>/` with routes, controller, service, validators | n/a                            |
| Clean code                  | `npm run lint` and `npm run typecheck` pass; Prettier and ESLint run on every commit through husky                        | n/a                            |
| Reusable components         | `client/src/components/ui/`, shared Zod schemas in `shared/src/`                                                          | n/a                            |
| Comments where necessary    | Short "why" comments, e.g. `client/src/lib/api.ts` line 34, `server/src/sockets/index.ts` line 78                         | n/a                            |
| No unused files or code     | `npm run lint` (unused variables are errors), `npm run typecheck`                                                         | n/a                            |
| Regular, meaningful commits | `git log --oneline` (Conventional Commits, enforced by `commitlint.config.js`)                                            | GitHub, Commits                |
| Feature branches            | Pull requests #1, #2 and #3                                                                                               | GitHub, Pull requests, Closed  |
| README                      | `README.md`: install steps, architecture, API, screenshots, live links, demo accounts                                     | Repository home page on GitHub |
| Documentation               | `docs/ARCHITECTURE.md`, `docs/API.md`, `docs/DATA-MODEL.md`, `docs/screenshots/`                                          | n/a                            |

## 12. Testing

| Item                    | Show in the code                                                                                                                                                     | How to run it                                                                               |
| ----------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------- |
| API tested with Postman | `docs/r4u.postman_collection.json`, `docs/r4u.postman_environment.json` (65 requests)                                                                                | Import both into Postman and run the collection; or `npm run test:api` with the API running |
| Frontend tested         | `client/src/**/*.test.tsx`, Playwright suite `tests/e2e/r4u.spec.ts`                                                                                                 | `npm test`; `npm run test:e2e`                                                              |
| Error scenarios         | e.g. "shows a readable error for a wrong password", "explains an unknown link" in `tests/e2e/r4u.spec.ts`; 401/404/409/422 cases in `server/src/modules/*/*.test.ts` | Same commands                                                                               |
| Authentication          | `server/src/modules/auth/auth.routes.test.ts` (rotation, family revocation, blocked account, lockout)                                                                | `npx vitest run server/src/modules/auth`                                                    |
| Responsive design       | `tests/e2e/r4u.spec.ts`, "no horizontal scroll at 390, 768, 1440 px" and "navigation collapses to a menu on a phone"                                                 | `npm run test:e2e`                                                                          |

All of it at once: `npm run verify` runs the design guard, lint, typecheck and all 452 unit and
integration tests.

## 13. Final deliverables

| Deliverable             | Where                                                          |
| ----------------------- | -------------------------------------------------------------- |
| GitHub repository       | github.com/Anexus5919/r4u                                      |
| Live frontend URL       | https://r4u-delta.vercel.app                                   |
| Live backend URL        | https://r4u-api.onrender.com/api/health                        |
| API documentation       | `docs/API.md`, `docs/REALTIME.md`, Postman collection          |
| README.md               | `README.md`                                                    |
| Dockerfile              | `server/Dockerfile`, `client/Dockerfile`, `docker-compose.yml` |
| GitHub Actions workflow | `.github/workflows/ci.yml`                                     |
| Database schema         | `docs/DATA-MODEL.md`, `server/src/models/`                     |
| Sample test user        | `user@r4u.dev` / `R4uDemo-2026!` (README, Demo accounts)       |
| Project presentation    | `R4U-Presentation.pptx`                                        |
| Demo video (optional)   | Record the walkthrough below                                   |

---

## Beyond the checklist

Three features from the planning document that the checklist does not ask for.

| Feature                              | Show in the code                                                                                                                                                                                | Show in the app                                                                                                                                                                       |
| ------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| ATS Readiness score                  | `shared/src/ats/` (rubric table, dictionary, parser view, scorer, 25 unit tests), `server/src/modules/resumes/resumes.ats.ts`, `client/src/routes/AtsPage.tsx`; rubric in `docs/ATS-RUBRIC.md`  | Preview, ATS check: the score, five bars, every lost point with a Fix link, the Parser Preview; paste a job posting for keywords and Tailor a copy. Public method at /ats-methodology |
| Word export                          | `client/src/render/renderToDocx.ts`, the third adapter over the same layout tree (ADR-020)                                                                                                      | Preview, Download Word: a single-column .docx in Calibri                                                                                                                              |
| Reviewer directory and review rounds | `client/src/routes/ReviewersPage.tsx`, `server/src/modules/users/reviewers.ts` (track record aggregated from reviews), `resubmit` and `rate` in `server/src/modules/reviews/reviews.service.ts` | Reviewers in the menu: search, filter by expertise, sort by rating; in a review room the owner has Edit resume and Send for re-review, and rates a completed review                   |

---

## A ten-minute demo that covers everything

1. **Landing page** on desktop, then the device toolbar at phone width: the menu becomes a drawer (1).
2. **Register** with a short password to show validation, then correctly (1, 7).
3. **Dashboard**: load a sample resume, search and filter, open the delete dialog and cancel (1, 2).
4. **Editor**: type, watch "All changes saved"; Network tab shows `PATCH /api/resumes/:id` (4).
5. **Preview**: switch templates, Download PDF and Download Word, create a share link, Copy toast
   (1, 4). Then ATS check: paste a job posting, show the bars, a Fix link and the Parser Preview.
6. **Real time**: incognito window opens the share link, the owner's count moves; sign in as the
   reviewer in incognito, chat and comment in the review room, the owner's bell updates; the owner clicks Send for re-review and the reviewer's page
   updates live (8).
7. **Roles**: as `user@r4u.dev` try `/admin` (blocked); sign in as your admin account and show
   Users and the activity log, which never shows resume content (7).
8. **Theme**: account menu, Dark (1).
9. **Code and pipeline**: GitHub Actions tab (green), Render Deploys (Auto-Deploy), the repository
   folders, `docs/API.md`, the Postman collection (4, 10, 11, 12).
10. **Docker**: `docker compose up --build`, http://localhost:8080 (9).
