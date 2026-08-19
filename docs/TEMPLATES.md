# Resume Templates

Eight templates. The document has its own type system, governed by ATS parsing and print, not by
the application's editorial direction. `DESIGN-SYSTEM.md` governs the chrome. This file governs
the paper.

---

## 1. The differentiation rule

Templates are differentiated on **five structural axes**, so that no two are recolours of each
other:

1. **Columns** (one, two with right sidebar, two with left sidebar, one with a date rail)
2. **Header treatment** (left-aligned, centred masthead, full-bleed reversed band, header inside
   the sidebar, no header block at all)
3. **Divider system** (rule below headings, rule above headings, rule-to-margin, double rule,
   no rules at all)
4. **Section-head placement** (stacked above content, inline with a rule, hung in a rail, centred)
5. **Density** (body size, leading, section gap, margins)

A template that differs only in accent colour is not a template.

---

## 2. Typography rules for the document

These override anything the design system says, because the constraints are different.

### 2.1 The letter-spacing cap

**Letter-spacing never exceeds 0.08 x font-size inside a resume template.** Enforced in the theme
token layer, not left to template authors.

Measured, text extraction breaks at a ratio of about 0.10. At 9pt with 1.0pt tracking it is
broken. At 11pt with 1.2pt tracking it is broken. `EXPERIENCE` extracts as `E X P E R I E N C E`
and the parser fails to match the section heading, which cascades into Textkernel codes 413 and
417 and loses the entire employment history.

This is a direct collision between severe editorial minimalism and ATS parsing. It is resolved
here, deliberately, before templates are built.

### 2.2 The amateur tells

The typography advice found in every resume blog is exactly what makes a resume look Word-made:
section headings at 14 to 16pt bold, name at 24pt, 1.5 line spacing. **Do not follow it.**

Typeset resumes set section heads **at or barely above body size** and differentiate with case,
small caps, tracking within the cap, and a hairline rule.

Other rules:

- **All-caps headings without added tracking is the single most common amateur tell.** Any
  uppercase or small-caps run needs +0.06 to +0.08em, inside the cap above.
- **Verify real small caps.** Faux small caps, where the browser just scales capitals, look worse
  than plain uppercase. If the face does not ship real small caps, use letterspaced uppercase.
- **Rag right, always, in every template.** Justified text on a resume is a trap: the measure is
  long, the vocabulary is full of long unbreakable tokens (technology names, company names), and
  hyphenation is off. The result is rivers and awful spacing.
- **Watch the measure.** A single column on A4 at 10.5pt gives roughly a 98-character measure,
  well past the readable 45 to 90 range. Fix with 22 to 25mm margins, a 12 to 15mm body indent
  under full-width heads, or multi-column short-item sections.
- **Hairlines are 0.5pt.** Print hairlines run 0.08 to 0.15pt, and 0.5pt is the thinnest weight
  that survives consumer printers reliably.

### 2.3 What the accent may touch

The user-chosen accent applies to **rules and section headings only**. Never to body text. It is
disabled entirely on ATS variants.

Coloured body text adds nothing a parser can read and is the fastest route to an unreadable resume
and a contrast failure.

### 2.4 Never build these

Skill proficiency bars, star ratings, donut charts, timeline graphics. They are simultaneously the
highest-signal "AI-generated template" marker, unparseable by every ATS, and unverifiable claims.

**Do not build them even as an option.** The moment they exist, users will pick them.

Proficiency renders as a typographic label: `Native`, `C1`, `Java (Expert)`. Contact rows render
as text separated by a middot or a rule, never as icon glyphs.

---

## 3. Font strategy

`@react-pdf/renderer` requires **static per-weight TTF files**. Two traps:

1. **Variable fonts appear to work and do not.** The documentation says they are unsupported, but
   fontkit silently instantiates the default `wght 400` named instance. Bold and italic then
   render as regular with no error, which is worse than an outright failure.
2. **Neither obvious source of static TTFs works.** Google Fonts' CSS API serves WOFF2, which
   `@react-pdf` rejects, and the GitHub repository now ships variable-only files for many
   families (`ofl/lora` contains only `Lora[wght].ttf`). Budget time to generate static instances
   with `fonttools`.

**Six document families**, shared across the eight templates, subset to Latin, static instances
per weight, committed to the repository and baked into the Docker image. Render's filesystem is
ephemeral and wiped on every spin-down, so anything fetched at runtime is re-fetched on every cold
start.

| Family | Weights | Used by |
|---|---|---|
| Source Serif 4 | 400, 600 | Foundry, Marginalia |
| Source Sans 3 | 400, 600 | Foundry, Marginalia, Ledger |
| EB Garamond | 400, 600 | Quire, Broadsheet |
| IBM Plex Serif | 400, 600 | Ledger |
| Spectral | 400, 600 | Placard, Verso |
| Newsreader | 400, 600 | Recto, Broadsheet |

Public Sans is already loaded for the application chrome and is reused by Placard, Recto and Verso.

Always `await document.fonts.ready` before any thumbnail snapshot. Canvas snapshots taken before
font load silently ship in a fallback face while the on-screen preview looks correct.

### 3.1 The extraction test replaces the folklore

The conventional "ATS-safe font list" (Arial, Calibri, Georgia, Garamond, and so on) is a proxy
for the real requirement, which is that the font embeds a **complete ToUnicode CMap** so text
extracts correctly, with discretionary ligatures disabled.

R4U does not rely on the proxy. **CI renders every template to PDF and extracts the text**,
asserting that the name, each section heading, each employer and each date range come back
intact and in reading order. Check A6 reports against that measured result.

This turns folklore into a guarantee, and it catches the exact class of failure (a font exporting
without a correct character map) that the folklore is a rumour about.

---

## 4. The eight templates

### 4.1 FOUNDRY

The ATS-safe default. Everyone starts here.

```
Columns      1
Margins      20mm
Header       left-aligned. Name 22pt Source Serif 4 small caps.
             One contact line joined by middots.
Section head 10pt Source Sans 3, uppercase, +0.08em, 0.5pt hairline BELOW,
             spanning the full measure.
Entry        role + org bold left, dates right-aligned tabular figures,
             location italic on line 2, bullets with 4mm hanging indent.
Order        Summary / Experience / Projects / Education / Skills / Certifications
Type         Source Serif 4 (name, heads) + Source Sans 3 10.5pt / 1.35
ATS          SAFE
```

### 4.2 QUIRE

Freshers and students with thin content. Deliberately low density so a short resume fills a page
without padding.

```
Columns      1
Margins      24mm
Header       name 30pt EB Garamond, contact beneath at 9pt uppercase +0.08em
Divider      NONE. Separation is 18pt of space above each head.
Section head 9pt Public Sans uppercase +0.08em, left, no rule
Body         11pt / 1.45
Order        Education / Projects / Skills / Experience and Internships /
             Achievements / Positions of Responsibility / Certifications
Type         EB Garamond + Public Sans
ATS          SAFE
```

### 4.3 LEDGER

Senior, 10 or more years, two pages.

```
Columns      1 main, but short-item sections render as 2 or 3 column grids
Margins      16mm
Body         10pt / 1.25, section gap 10pt
Header       name 20pt left, contact stacked right at 8.5pt
Signature    section heads set INLINE with a 0.5pt rule running from the end
             of the heading to the right margin
Order        Summary / Core Competencies (3-col grid) / Professional Experience /
             Selected Projects / Education / Certifications / Awards
Type         IBM Plex Serif + Source Sans 3
ATS          SAFE. Grid cells emit as separate text nodes, never a table.
```

### 4.4 PLACARD

Business, consulting, finance, mid-career.

```
Columns      1
Header       full-bleed reversed band, 36mm tall, near-black ground,
             paper-white text: name + target title + contact
Signature    0.5pt rule ABOVE each section heading. Structurally opposite
             to Foundry.
Body         10.5pt / 1.32
Order        Summary / Experience / Education / Skills / Certifications / Languages
Type         Spectral + Public Sans
ATS          SAFE, but ONLY because the band is real text over a background
             rectangle. NEVER rasterise it.
```

### 4.5 RECTO

Experienced professionals with long skill inventories. Human-reviewed and referral applications.

```
Columns      2, sidebar RIGHT at 32%
Header       full-width split band above both columns, name left, contact right
Divider      0.5pt vertical hairline in the gutter
Main         Summary, Experience, Projects
Sidebar      Contact, Skills, Certifications, Languages, Education
Body         10pt / 1.3
Type         Newsreader + Public Sans
ATS          NOT SAFE. Ships with a one-click linearised variant.
```

### 4.6 VERSO

Design, marketing, career-changers, where skills must lead.

```
Columns      2, sidebar LEFT at 34% on a 4% neutral tint ground
Header       NONE as a separate block. The name lives inside the sidebar,
             stacked top-left. Structurally distinct from Recto.
Divider      no rules. Separation by whitespace and the tint edge.
Sidebar      name, contact, skills, tools, languages, interests
Main         Summary, Experience, Projects, Education
Body         10pt / 1.35
Type         Spectral + Public Sans
ATS          NOT SAFE. Linearised variant required.
```

### 4.7 MARGINALIA

The most editorial layout in the set. Researchers, long chronologies, many short entries.

```
Columns      1 with a 26mm LEFT DATE RAIL
Rail         dates and section headings sit right-aligned in the rail
Body         all content in the main body. Heads are hung, not stacked.
Margins      18mm, body 10.5pt / 1.4
Type         Source Serif 4 + Source Sans 3
ATS          CAUTION. Rail content can interleave. Offers a variant that
             moves dates inline and headings above.
```

### 4.8 BROADSHEET

Academic CV, multi-page.

```
Columns      1, centred
Header       name 24pt Newsreader small caps +0.08em, centred contact line,
             classic masthead double rule (1pt over 0.25pt, 2mm apart)
Section head centred, small caps, +0.08em, NO rules
Signature    publications use a bibliographic hanging indent, second line
             indented 6mm. No other template has this.
Footer       running "Lastname / Curriculum Vitae / p. n of m"
Body         11pt / 1.4, margins 25mm, 3 to 6 pages
Order        Contact / Education / Appointments / Research Interests /
             Publications (sub-grouped: peer-reviewed, chapters, proceedings,
             under review) / Grants and Fellowships / Honours and Awards /
             Invited Talks / Teaching / Supervision / Service / Affiliations /
             Skills and Languages / References
Type         Newsreader + EB Garamond
ATS          NOT SAFE, and correctly so. Academic hiring uses Interfolio and
             AJO, which take the PDF whole.
```

---

## 5. Section order is a function of career stage

Seed `resumeType` at creation: `fresher | professional | technical | academic`.

It drives the default template, the default section order, the length target (1 page / 1 to 2 /
1 to 2 / 3 to 6), and **which linter rules fire**.

This is the single highest-leverage piece of coaching in the product, because section order is a
function of career stage, not of taste. A fresher leading with Experience buries the Education
that is actually their strongest asset.

**Gate the linter on `resumeType` or it will fight the user.** An academic CV must not be
bullet-limited on publications, wants named references with contact details (which resumes must
omit), and "quantify every bullet" is actively wrong for a publications list.

---

## 6. Section order is per-resume data, not per-template

```ts
resume.sections    // ordered array, position is authoritative
template.recommendedOrder
template.slots     // { main: [...], aside: [...] }
```

**On template switch, never silently reorder.** Prompt: "Apply this template's recommended order?"

**Any section not named in `slots` falls into `main`.** This is the rule that prevents the
two-column data hazard: if section order is a flat array and the template has two slots, switching
from one column to two has no defined destination for each section, and sections either duplicate
or vanish.

---

## 7. linearize(): one shared ATS variant

One renderer that any template falls back to, exposed as an "ATS version" toggle in the export
dialog:

- collapse to a single column
- splice sidebar sections back into canonical order
- replace a reversed band with left-aligned plain text
- replace icons with word labels (`Email:`, `GitHub:`)
- replace any rating or bar with a comma-joined grouped list
- drop the photo
- normalise section names to the canonical Textkernel set
- keep hairline rules, which are harmless

This makes "ATS-safe: no" a soft property rather than a dead end, and it means R4U can ship
genuinely beautiful two-column templates honestly.

---

## 8. The five customisation knobs, and no more

| Knob | Range |
|---|---|
| Accent colour | applies to rules and section heads only. Disabled on ATS variants. |
| Type scale | 9.5 to 11.5pt in 0.5pt steps |
| Line height | 1.2 / 1.3 / 1.45 |
| Section spacing | compact / normal / airy |
| Margins | 16 / 20 / 25 mm |

This matches FR 5.3, maps onto the documented fitting knobs, and prevents users from destroying
the typographic system.

Every template reads its typography from CSS custom properties on the page root
(`--body-size`, `--leading`, `--gap`, `--measure-indent`, `--rule-weight`, `--accent`), so the
five knobs are a single style object, templates stay pure layout, and the fit-to-page auto-tuner
is a three-line function.

---

## 9. Page overflow

**A warning that only appears at export time is useless.** By then the user has finished writing.

The warning is live, attached to the page it belongs to, and names the overflow in millimetres:

> Content exceeds page 1 by 34 mm

Three one-click remedies, in this priority order, which teaches the right instinct (content before
design):

1. **Trim content.** Jumps to the longest bullet.
2. **Fit to page.** Steps type scale 11 to 10.5 to 10pt, then section gap, before it touches
   margins.
3. **Move remaining sections to page 2.**

Page count comes from the **PDF render**, not from DOM measurement. `@react-pdf` renders in 50 to
170ms, so debounce roughly 400ms, render in the background, and read `numPages`.

Per-section `keepTogether` and `startOnNewPage` booleans are exposed. Page-break control is
genuinely missing from most competitors.

---

## 10. Preview geometry

Build the preview as a real `210mm x 297mm` box (`width: 210mm; height: 297mm;
box-sizing: border-box` with mm padding), scaled with `transform: scale(k)` and
`transform-origin: top left`. Drive re-measurement with a `ResizeObserver`, never polling.

Authoring the preview in millimetres rather than pixels removes an entire class of px-to-mm
rounding drift against the PDF.

The resume renders on true `#ffffff` with a visible page edge. The paper is figure, the app is
ground.

---

## 11. Content linting

Runs on every keystroke and feeds the coaching panel. No AI, a JSON word-list file. Full scoring
rubric in `ATS-RUBRIC.md`; these are the live editor hints.

| Trigger | Message |
|---|---|
| Bullet has no numeral | Add a measurable result. Accomplished X as measured by Y by doing Z. |
| Bullet over 30 words or wrapping to 3 lines | Too long, split it. |
| Opens with Responsible for / Worked on / Helped with / Duties included / Assisted with | Lead with an action verb. |
| First-person pronoun | Error. |
| Present-tense verb in an entry with an end date | Tense error. Inverse for current roles. |
| Same action verb used more than twice | Repetition warning. |
| Fewer than 3 or more than 5 bullets on a role | Nudge toward 4. |
| Under 50% of bullets quantified | Only {k} of {n} bullets are quantified. |
| Cliche list hit | Strike it. |
| Summary outside 50 to 100 words | Aim for 3 to 5 sentences. |
| Inconsistent date formats across entries | Flag. |
| "References available on request" on a non-CV | Remove. |

### 11.1 Character limits

Hard maximums, soft warning at 80%:

| Field | Max | Warn |
|---|---|---|
| Name | 60 | |
| Headline | 80 | |
| Summary | 600 | 480 |
| Bullet | 220 | 170 (roughly 30 words) |
| Role title | 80 | |
| Organisation | 80 | |
| Location | 60 | |
| Project name | 80 | |
| Skill token | 40 | |
| Skill group name | 30 | |
| Certification | 100 | |
| Achievement | 200 | |
| Language | 40 | |

Entry caps: 8 bullets per entry (warn above 5), 12 entries per section, 30 skills (warn above 20),
6 relevant-coursework items.

---

## 12. Admin previews use a fixture, never a user document

The admin template gallery and template-management screens render from a fixed demo fixture, a
fictional `Alex Mercer` resume shipped in the repository at `shared/fixtures/sample-resume.ts`.

Template management is the one admin screen where the content boundary from ADR-008 is easiest to
breach by accident.

The same fixture backs the "Start from a sample" onboarding door and every design review, which
satisfies the design system's requirement that no screen is ever reviewed with placeholder content.

---

## 13. Rich text is a closed set

Bold, italic, underline, link, bullet list, numbered list. Nothing else. No headings, no tables,
no font sizes, no arbitrary colours inside bullet text.

Unconstrained rich text is what makes exported PDFs and templates fall apart, and retrofitting
constraints later means migrating stored HTML. If rich text is stored at all, sanitise on the
server before persisting, not only at render, so a share link or the PDF renderer cannot resurrect
stored XSS.

---

## 14. Do not ship a functional resume format

The skills-based or "functional" format is the format recruiters most distrust and parsers handle
worst, because no dates attach to the skill claims.

Offer **hybrid** instead, which achieves the same "lead with skills" goal while keeping a
parseable chronology. Verso is that hybrid.
