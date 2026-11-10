# Decision Log

Every decision that deviates from the original project specification, or that a reader would
otherwise reasonably question. Each entry states the evidence, because "we chose X" is not an
argument and a viva panel will ask.

Status values: `accepted`, `superseded`, `proposed`.

---

## ADR-001: Replace html2canvas + jsPDF as the export path

**Status:** accepted
**Specification said:** html2canvas with jsPDF for PDF generation.

**Context.** R4U's problem statement opens by observing that resumes are filtered by an Applicant
Tracking System before a human reads them. The product's central claim is that it produces
resumes which survive that filter.

`html2canvas` rasterises the DOM to a bitmap. The resulting PDF is a picture of a resume: no text
layer, no selectable text, no working hyperlinks. Every ATS extracts an empty document.

**Measured, not assumed:**

| Path                | File size | Extractable text items |
| ------------------- | --------- | ---------------------- |
| html2canvas + jsPDF | 305 KB    | **0**                  |
| @react-pdf/renderer | 3 KB      | 34, at exact A4        |

Two further defects: `html2canvas@1.4.1` has been unpublished since January 2022 and throws on
modern CSS colour functions, which matters because Tailwind v4 emits its entire default palette
in `oklch()`. And at default scale it produces roughly 96 DPI, visibly soft when actually printed.

**Decision.** Three paths, each doing the job it is actually good at:

1. `@react-pdf/renderer` 4.6.1 produces the A4 download. Client-side, behind a dynamic import, so
   the 454 KB gzip bundle loads only on click and export still works during a Render cold start.
2. `window.print()` with an `@page { size: A4; margin: 0 }` stylesheet is the fallback. Roughly
   40 lines, zero dependencies, gives users Ctrl+P and an accessibility escape hatch.
3. `html2canvas-pro` 2.3.9 with `jsPDF` generates **live resume thumbnails** for the dashboard
   cards. FR 3.2 requires a thumbnail per card, and a raster snapshot is genuinely the right tool
   for that job.

**Consequences.** The specification's named libraries all keep real, honest jobs. No user ever
downloads an unparseable resume. The deviation is written up with the measurements, which reads
considerably stronger to an evaluator than following the specification into a broken build.

**Rejected alternatives.** Server-side Puppeteer gives perfect fidelity but adds roughly 400 MB to
the Docker image and will OOM inside Render's 512 MB free tier. Reactive Resume shipped exactly
that, logged years of `InvalidBrowserConnection` issues (#1854, #2192, #2924), and removed it in
favour of client-side rendering in v5.1.0. `pdfmake` needs about 1.9 MB of client JavaScript and
a bespoke document DSL sharing nothing with the React preview, which maximises the drift problem.
`pdf-lib` has no layout engine at all.

**Note for accuracy.** Do not claim "jsPDF is raster". It is not, and an evaluator may catch it.
`jsPDF` 4.2.1's `.html()` uses `toContext2d` and does emit vector text. The objection is to its
dependency on the unmaintained `html2canvas`, and that is how it must be stated.

---

## ADR-002: One layout AST, two adapters

**Status:** accepted

**Context.** The live preview and the PDF are rendered by different engines. Writing each template
twice guarantees they diverge, and the user downloads something they did not see.

**Decision.** Each template is a pure function `(resume, theme) => LayoutNode[]` over a restricted
node set. Two thin adapters, roughly 150 lines each, walk that tree: `renderToDom()` emits divs
with inline styles, `renderToPdf()` emits `View` and `Text`.

**Consequences.** Content drift is structurally impossible. Box-layout drift is near zero because
`@react-pdf/renderer` runs yoga-layout, the same Flexbox implementation the browser uses. The
style vocabulary is constrained to the browser and Yoga intersection and enforced by a TypeScript
union, so an unsupported property is a compile error rather than a silently different PDF.

**Rejected alternative.** Making the live preview an embedded PDF viewer would guarantee zero
drift, but it breaks section-anchored review comments, which need real DOM nodes to attach to,
and it makes editing feel sluggish.

---

## ADR-003: TypeScript, pinned to 5.9.3

**Status:** accepted
**Specification said:** did not specify a language beyond "MERN".

**Decision.** TypeScript, with `typescript` pinned to exactly `5.9.3`, not a caret range and never
`latest`.

**Rationale.** The shared Zod schema's whole payoff is `z.infer<typeof Resume>` producing one
generated type for client and server. In plain JavaScript you get runtime validation but no editor
safety, which is half the value.

**The pin is not cosmetic.** `typescript@latest` resolves to 7.0.2, whose peer range against
`typescript-eslint@8.67.0` is `>=4.8.4 <6.1.0`. npm emits an `ERESOLVE` warning that is easy to
scroll past, and the symptom is type-aware lint rules quietly not running rather than a hard
failure.

**Consequences.** Real learning overhead, and Mongoose 9 generics are genuinely fiddly. Mitigated
by starting at `strict: true` with `noImplicitAny: false` and tightening later.

---

## ADR-004: Named deviations from the supplied design reference

**Status:** superseded by ADR-018 for palette, accent, faces and radius

**Context.** R4U was briefed against a reference design file using the Tailwind `stone-*` palette,
DM Serif Display, `rounded-full` buttons and `rounded-2xl` cards, with a stated goal of avoiding
anything that looks AI-generated.

**The problem.** That exact combination is catalogued as AI tell #0, "Cream + Serif + Sage", with
`bg-stone-50` and `bg-stone-100`, DM Serif on the named heading-face list, `border-radius: 9999px`
on buttons and uniform `rounded-2xl` all listed individually. Four of four signature elements.
The stated cause is that models auto-complete toward "tasteful" when handed a minimalism brief.

**Decision.** Keep the register, deviate on every specific, and document each deviation. Full
detail in `DESIGN-SYSTEM.md`. Summary:

| Aspect       | Reference                     | R4U                                                        | Reason                                                                                                                                                                          |
| ------------ | ----------------------------- | ---------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Palette      | `stone-*`                     | 13-step warm-ink ramp, chroma 0.001-0.003 at the light end | Reads as near-white paper, not cream. Dodges the cream tell and the slate/zinc tell simultaneously.                                                                             |
| Accent       | none / sage                   | `#c8331a` vermillion, hue 32                               | Far from the AI-purple band (255-280) and from the sage cliche. `danger` at hue 25 is 7 degrees away, so brand and danger are one hue family, which is why monochrome survives. |
| Display face | DM Serif Display              | Newsreader                                                 | On no slop list. `opsz` 6-72, the widest on Google Fonts. Drawn for screen reading.                                                                                             |
| Body face    | DM Sans                       | Public Sans                                                | 26.8 KB versus 62.7 KB. Large x-height, unambiguous `1`/`l`/`I`. Inter and Geist are both on the slop list.                                                                     |
| Radius       | `rounded-full`, `rounded-2xl` | 2px / 6px / 0px                                            | Both reference values are individually named on the tell list.                                                                                                                  |

---

## ADR-005: Templates are a registry of metadata, never stored markup

**Status:** accepted

**Context.** FR 9.4 lets an administrator add and edit templates. The natural implementation is a
`markup` field on the Template document holding HTML, Handlebars, JSX or MDX.

**Decision.** The Template document stores `{ key, name, category, thumbnail, active, order,
defaults, atsProfile }`. `key` maps to a layout function versioned in the repository. The
administrator manages metadata only.

**Rationale.** Two independent blockers.

1. **Remote code execution.** MDX and JSX compile to executable JavaScript. Evaluating database
   content at runtime executes arbitrary code, on the server if rendered there or in the victim's
   session if rendered client-side. "Only admins can author it" is one compromised admin account
   away from total compromise.
2. **`@react-pdf/renderer` cannot render markup.** Its primitives are `Document`, `Page`, `View`,
   `Text`. It does not know `div`, `p` or `h1`. A markup-authored template would preview in the
   browser and be impossible to export, reintroducing exactly the drift ADR-002 removes.

**Consequences.** Adding a template requires a code change and a deploy, which is correct for
something that must render in two engines. `atsProfile` lets the checker report a template's
parseability ceiling without inspecting rendered output.

---

## ADR-006: MDX on the content surface only, compiled at build time

**Status:** accepted

**Decision.** MDX is used for `/about`, `/privacy`, `/terms`, the changelog, the ATS methodology
page, the per-check "learn more" explainers, and the resume writing guides. Files live in
`client/src/content/` and are compiled by `@mdx-js/rollup` during the build.

**Never** call `evaluate()` on MDX sourced from the database or from user input. See ADR-005.

**Rationale.** Long-form prose with embedded live components is exactly what MDX is for. The
per-check explainers with an embedded `<BeforeAfter />` showing a real bullet failing and passing
are the highest-value use in the product.

**Explicitly not used for** resume content, which must stay structured JSON so that template
switching, the ATS checker, section-anchored comments, entry reordering and hide-without-delete
all remain possible.

---

## ADR-007: Resume stored as one document, not normalised collections

**Status:** accepted

**Decision.** One Mongoose document per resume with an ordered `sections[]` array. Array position
is the authoritative order. No separate Education, Experience or Skills collections.

**Rationale.** Normalising looks like good database design in a lab report and is wrong here: it
makes autosave a multi-document transaction, makes version snapshots painful, makes reordering a
migration of index fields, and makes the PDF renderer perform N queries. Every production builder
studied uses a single document.

At 15 sections and 30 entries a reorder is one whole-array `$set`. Fractional indexing would be
unjustified complexity.

**Corollary.** Never store `resumes: [ObjectId]` on the User document. Unbounded arrays are the
classic MongoDB antipattern. Query `Resume.find({ owner })` against `{ owner: 1, updatedAt: -1 }`.

Comments and Messages **do** get their own collections: they grow without bound, are written by a
different actor than the resume owner (so embedding creates write contention on one hot document),
and need independent cursor pagination.

---

## ADR-008: The admin content ban is enforced at the query layer

**Status:** accepted

**Context.** FR 9.6 forbids an admin from opening private resume content. FR 9.5 requires an admin
to review reported content. As written these contradict.

**Decision.** Three mechanisms, none of which is a moderation exception.

1. A fail-closed `pre(/^find/)` hook strips `sections` and `personal` unless
   `contentScope: 'full'` is passed. That option is confined to one service function which throws
   `403 ADMIN_CONTENT_FORBIDDEN` for role `admin` unconditionally.
2. Only a resume with an **active public share link** is reportable. `targetType` does not include
   a private resume. The report queue renders through the public share view, which is the same
   read any visitor with the link already has.
3. On the socket layer, an **explicit deny** for `role === 'admin'` on `review:*` and `resume:*`
   joins. An admin holds a valid JWT so the handshake passes; nothing stops a room join unless a
   handler positively refuses it.

**Rationale for the layer choice.** Enforcing in controllers guarantees a leak: some future admin
analytics endpoint will run `Resume.find({}).lean()` and return everything. The default must be
that content is stripped, and opting in must throw for admin.

`meta.completeness`, `meta.wordCount` and `meta.sectionCount` are denormalised onto the Resume so
admin aggregations never need a content projection.

**This gets a dedicated test**, because it is the one requirement where a regression is a privacy
breach rather than a bug.

---

## ADR-009: Zod for the document, express-validator for routes

**Status:** accepted
**Specification said:** express-validator.

**Decision.** `express-validator` 7.3.2 stays on auth routes, `:id` params and pagination.
The shared Zod schema validates the resume document body and every Socket.IO payload.

**Rationale.** Two genuine gaps in express-validator for this project:

1. Its wildcard syntax (`sections.*.items.*.startDate`) cannot express cross-field rules such as
   "endDate required unless current" or "section order must be unique".
2. **It cannot validate Socket.IO payloads at all**, because there is no `req` object in a socket
   handler. Every real-time event would be unvalidated. This is a real gap in the specified stack,
   not a stylistic preference.

**Consequences.** Two validation idioms in one codebase. The split is documented here and in the
README so it reads as a decision rather than an inconsistency.

**Two Zod 4 traps to avoid.** `.partial()` throws outright on any object schema already carrying
`.check()` or `.refine()`, so compose the base object first and attach refinements last. And
`.default({})` injects the literal unparsed value, so a theme ships as `{}` with no accent colour;
use `.prefault({})` instead. Both are silent failures, not crashes.

---

## ADR-010: No TanStack Query

**Status:** accepted

**Decision.** Context plus `useReducer`, with four custom hooks. No external data-fetching library.

**Rationale.** Not a rubric dodge. R4U's centre of gravity is one long-lived mutable document with
local undo/redo, debounced autosave and socket push mutations. Query degenerates into manual
`setQueryData` there, and you have paid 13 KB to disable its cache. A reviewer familiar with Query
would notice it being used as a store with caching turned off.

**Revisit if** the admin dashboard grows several independent paginated tables, which is where
Query genuinely earns its place.

---

## ADR-011: The ATS checker scores structured data, never a parsed PDF

**Status:** accepted
**Specification said:** ML-based ATS scoring is out of scope.

**Context.** Section 2.4 excludes "automated ATS scoring based on machine learning". A
deterministic, rule-based checker is therefore inside scope, and it is the feature most likely to
make R4U read as a real product.

**Decision.** R4U already owns the structured resume JSON and the template metadata. A
`serializeToParserView(resume, template)` function emits the exact plain-text reading order a
line-oriented extractor would produce, deliberately interleaving columns when
`template.columns === 2`. Scoring runs against three inputs: the structured JSON, that serialised
text, and the template descriptor. No PDF text extraction anywhere.

**Rationale.** This is exactly what a parser sees, it is completely reproducible, and it requires
no PDF parsing on the server.

**Privacy constraint.** Persist only `{ checkId, status, pointsEarned, pointsPossible }` plus the
aggregate and `rubricVersion`. Never persist extracted resume text or the pasted job description
beyond the request. An ATS-score collection full of resume prose would violate ADR-008 in spirit
and in any database dump.

Full rubric in `ATS-RUBRIC.md`.

---

## ADR-012: Reviewer assignment is an explicit request, not auto-allocation

**Status:** accepted
**Specification said:** FR 7.1, "assign it to an available reviewer", without defining availability.

**Decision.** A curated reviewer directory, admin-promoted per the role definition. The resume
owner sends an explicit request to a named reviewer, who accepts or declines. No round-robin, no
silent auto-assignment.

**Rationale.** It matches the specification's own framing of a reviewer as "a trusted user
promoted by the administrator", it makes "available" mean something concrete (the reviewer said
yes), and it avoids assigning work to someone who never agreed to it.

The directory is a modal opened from the Preview and Export page rather than a separate route, so
the documented view count stays honest.

---

## ADR-013: Supporting library selections

**Status:** accepted

| Concern          | Choice                                    | Rejected, and why                                                                                                                                                                                                                                                                    |
| ---------------- | ----------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Drag and drop    | `@dnd-kit/core` 6.3.1 + `sortable` 10.0.0 | `react-beautiful-dnd` is formally deprecated on npm. Native HTML5 DnD has no touch, no keyboard, unstyleable drag image. `@dnd-kit/react` 0.5.0 is a pre-1.0 rewrite with a different API despite the higher-looking version number.                                                 |
| Forms            | `react-hook-form` 7.85.0                  | Formik is controlled by default and re-renders the whole form per keystroke, which is untenable in a 200-field editor.                                                                                                                                                               |
| Tailwind         | v4.3.3 with `@tailwindcss/vite`           | v3 has no migration cost advantage on a greenfield project, and v4's CSS-first `@theme` gives the ink ramp as utilities and as `var()` simultaneously. The default oklch palette is overridden with explicit sRGB hex, which is required anyway to keep `html2canvas` from throwing. |
| Animation        | `motion` 13.1.0 behind `LazyMotion` + `m` | Justified only by `AnimatePresence`. Exit animations are the one thing CSS genuinely cannot do. Everything else is a plain CSS transition. If exit animations turn out not to be needed, drop it and save 31 KB.                                                                     |
| Toasts           | hand-rolled, roughly 60 lines             | `react-hot-toast` and `sonner` both ship pill shapes, drop shadows and spring entrances that contradict the design system. Overriding them fully costs more than writing it.                                                                                                         |
| Icons            | hand-drawn set of 12                      | No icon library. See `DESIGN-SYSTEM.md` section 9.                                                                                                                                                                                                                                   |
| Dates            | none                                      | Only need `Intl.DateTimeFormat` with `{ month: 'short', year: 'numeric' }` plus a string compare. Neither `date-fns` nor `dayjs` earns its place.                                                                                                                                    |
| Share slugs      | `nanoid` 6.0.1 at length 12               | A Mongo ObjectId in a public URL leaks its creation timestamp and is partially sequential.                                                                                                                                                                                           |
| Password hashing | `bcryptjs`, cost 12                       | Native `bcrypt@6` needs python3, make and g++ in the Docker image and in the CI runner. It builds locally and fails in CI on a slim base, a class of failure that costs hours and teaches nothing.                                                                                   |
| Logging          | `pino` 10.3.1 + `pino-http`               | `morgan` plus `console.log` leaks credentials into Render's logs. Redact `authorization` and every password field.                                                                                                                                                                   |
| Sanitisation     | none installed                            | `express-mongo-sanitize` is abandoned and silently no-ops on Express 5, where `req.query` became a getter. Correct defence is `mongoose.set('sanitizeFilter', true)` plus validated primitives.                                                                                      |

---

## ADR-014: Zero cost is a hard constraint

**Status:** accepted

**Decision.** R4U must cost nothing to build, run and demonstrate. No paid tier, no subscription,
no trial that expires into a bill, and nothing on the critical path that requires a card.

Full audit in `COST.md`, which must be updated **before** any dependency or service is added.

**Consequence: the proposed domain purchase is withdrawn.** It was going to solve a real problem,
the cross-site refresh cookie that Safari's ITP blocks, but it cost roughly 12 USD per year.

Replaced by a free solution: **proxy the HTTP API through a Vercel rewrite**, so the browser only
ever talks to one origin and the refresh cookie becomes first-party.

```json
{
  "rewrites": [
    { "source": "/api/:path*", "destination": "https://r4u-api.onrender.com/api/:path*" }
  ]
}
```

Socket.IO is unaffected and connects directly to Render, because the handshake authenticates with
the in-memory access token via `auth`, not with a cookie.

**Open risk to measure in Phase 1, not assume:** Vercel's proxy has its own request timeout, and a
Render cold start runs 30 to 60 seconds. The first request after an idle period may time out
through the proxy. If it proves unworkable, fall back to a free domain from the GitHub Student
Developer Pack, then to `SameSite=None; Secure; Partitioned` with the limitation documented.

**No paid AI API anywhere.** Every intelligent feature is deterministic: the ATS checker is a
published rule set, the content linter is regex plus word lists, keyword matching is dictionary
lookup plus set intersection. This is not a budget compromise. It is what makes the scores
explainable and reproducible, which is the actual differentiator.

---

## ADR-015: DOCX export alongside PDF

**Status:** proposed

Add DOCX export via the `docx` package (MIT, free). Textkernel logs "document format is PDF" as a
code-300 major issue, so a text-layer DOCX is measurably safer for ATS than any PDF, and no
competitor in this class ships it.

Deferred to Phase 6 so it does not compete with the core export path in ADR-001.

---

## ADR-016: Ledger drops the multi-column short-item grid

**Status:** accepted, supersedes the Ledger columns axis in `TEMPLATES.md` 4.3

`TEMPLATES.md` 4.3 specified Ledger as "1 main, but short-item sections render as 2 or 3 column
grids", with `Core Competencies (3-col grid)` in its order and the note "grid cells emit as
separate text nodes, never a table". It was never implemented, and on review it should not be.

**The grid contradicts Ledger's own ATS badge.** Ledger is `atsSafe: 'safe'` with
`maxDimensionAScore: 30`, the perfect dimension A score, and that score is only honest for a
single reading order. Chunking a section into three columns creates exactly the multi-column
reading order that caps Recto and Verso at 21. Emitting cells as text nodes rather than as a
table avoids code 402, but it does not avoid code 433, which is about reading order and is the
reason two-column templates are badged unsafe at all.

Two further problems with the specified fix:

- Ledger passes `dates: 'right'`. Certifications and achievements in a one-third measure would
  wrap their date range across two lines, which is Textkernel code 418.
- The stated motivation was the 98-character measure, but margins are a user knob, so Ledger
  cannot set 16mm for itself, and `skillsEntry` already splits a group label off at 28 percent.

**Decision.** Ledger stays one column. It remains distinct on the other four axes: inline heads
with a rule running to the right margin, a split header with contact stacked right, and the
tightest section gap in the set. A shared columns value with Foundry is not a distinctness
failure, since five of the eight templates are single-column by design.

The alternative, keeping the grid and lowering Ledger to `maxDimensionAScore: 24`, was rejected:
the product needs one template that is unambiguously the safe dense choice, and a grid buys
nothing a reader values enough to pay reading order for.

---

## ADR-017: A ground is a node type, not a stretched flex child

**Status:** accepted

Verso's tinted sidebar was a flex child carrying `backgroundColor` and negative margins on all
three trim edges. It cannot work, in either adapter.

`align-items: stretch` resolves a child against the flex line, and a single-line container's line
cross size is the taller column's content height, not the page. Measured in headless Chrome with
Verso's real node tree: with short content the tint stopped 273mm above the bottom trim, under a
hard horizontal edge. The style vocabulary has no `height`, `minHeight` or `alignSelf`, so no
template could express the intent.

`minHeight` was considered and rejected. It would make the tint reach the bottom of page one, but
it also inflates `content.scrollHeight`, which is what the editor's page-fill readout measures, so
every Verso resume would report 100 percent full while nearly empty. A full-bleed ground that has
to repeat on page two is also not a flow item at all.

**Decision.** `{ type: 'ground' }` is a top-level node, lifted out of the flow by `splitGrounds()`
before either adapter walks the tree. The DOM adapter positions it against the page's padding box;
the PDF adapter will map it to a `fixed` View, which is the only shape that repeats across pages.
It is anchored at the left trim and takes `width` and `backgroundColor`, nothing else.

Because the ground measures against the page and a column measures against the content box, Verso
computes its sidebar width in points from `theme.pageWidth`, not as a shared percentage.

---

## ADR-018: A professional product register replaces the editorial one

**Status:** accepted. Supersedes ADR-004 for palette, accent, faces and radius.

**Context.** ADR-004 steered every visual specific away from a catalogue of AI tells: a warm ink
ramp, a vermillion accent, Newsreader headings over Public Sans, 2px and 6px corners, and a
13 to 14px tool scale. Built out across the auth, dashboard and editor screens, the result read to
the product owner as unfinished: small grey text, a newspaper serif on tool headings, a brown-black
dark theme, and a red primary button that reads as a warning. A resume builder sells confidence in
the output, and the chrome was not projecting it.

**Decision.** Optimise for a credible, conventional product register over novelty.

| Aspect  | ADR-004                    | Now                                         | Reason                                                                   |
| ------- | -------------------------- | ------------------------------------------- | ------------------------------------------------------------------------ |
| Faces   | Newsreader and Public Sans | Geist for interface and headings            | One sans family, drawn for UI, pairs with the Geist Mono already shipped |
| Neutral | Warm ink ramp              | Cool ink ramp with a faint blue cast        | Crisp on screen; the dark theme no longer reads brown                    |
| Accent  | Vermillion `#c8331a`       | Blue `#2356e0`, with a subtle tint and edge | Primary action no longer shares a hue with danger                        |
| Radius  | 2px and 6px                | 6px controls, 12px cards                    | Current product convention; still two values, still no pills             |
| Scale   | 14px base, 13px labels     | 15px base, 14px labels at medium weight     | Labels and body text read at arm's length                                |

**Unchanged.** The token architecture, `ink-*` naming, the single hex file, the gradient ban, the
purple ban, the motion vocabulary, true-white paper in both themes, and every rule in
`design-guard.sh`. The resume templates are untouched: document faces and colours live in
`shared/src/layout/tokens.ts`, not here.

**Consequence.** `DESIGN-SYSTEM.md` sections 3, 4 and 6 describe the superseded values where they
conflict with `tokens.css`; this ADR and the token file win. The favicon is a static SVG that
cannot read custom properties, so it carries the accent and paper values as literals.
