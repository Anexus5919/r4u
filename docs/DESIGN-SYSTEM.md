# R4U Design System

The single source of truth for every visual decision in R4U. Read this before building any
component, page or template. Nothing in the product may introduce a colour, radius, duration,
font or shape that is not defined here.

---

## 0. The central trap

R4U's aesthetic brief is "editorial minimalism, neutral palette, serif headings, generous
whitespace, no gradients". That brief, executed literally, produces a catalogued AI tell.

The most-cited slop catalogue lists "Cream + Serif + Sage" as tell #0, with exact signatures:

| Signature     | Exact values named in the catalogue                                                                          |
| ------------- | ------------------------------------------------------------------------------------------------------------ |
| Backgrounds   | `#faf8f5`, `#f5f1e8`, `#f3eee3`, `#fdfbf7`, `#f7f3ec`, Tailwind `bg-stone-50`, `bg-stone-100`, `bg-amber-50` |
| Heading faces | Instrument Serif, Fraunces, Playfair Display, Spectral, Cormorant, DM Serif                                  |
| Body faces    | Inter, Geist, Space Grotesk                                                                                  |
| Accent        | emerald / sage green 700-900 (`#15573a`, `#1a4d3a`)                                                          |
| Geometry      | `border-radius: 9999px` on buttons, uniform `rounded-2xl` / `rounded-3xl`                                    |

The stated cause is that models auto-complete toward "tasteful" when handed a minimalism brief.

**Therefore every choice in this document is a named deviation with a stated reason, not an
execution of the default.** Where a decision looks arbitrary, the reason is written next to it.
Do not "warm up" a value, "round the corners a bit more", or "add a subtle gradient" during
implementation. Each of those moves lands the product back on the list.

---

## 1. Core philosophy

**The application is a frame. The resume is the artefact.**

The chrome is achromatic. Colour appears in exactly two places: the accent, used sparingly and
deliberately, and inside the resume canvas, where the user's own accent choice lives. This is
not a stylistic preference, it is structural. It means every template preview is the only
saturated object on screen, the tool never competes with the document, and the monochrome rule
enforces itself rather than depending on restraint.

**Restraint is arithmetic, not taste.** Most budget aesthetics are not poorly designed, they are
over-decided. Two type weights instead of six. Three radii instead of nine. One accent. Three
motion durations. Every addition to the vocabulary must remove something else.

**Never draw a border to express a relationship that spacing already expresses.** Proximity
first, then whitespace, then a hairline rule, then and only then a container.

---

## 2. Enforceable ban list

These are checked by a CI grep step (`scripts/design-guard.sh`). A hit fails the build.

### Colour

- Any purple, violet, indigo or fuchsia. Any CSS hue between 255 and 280. Specifically banned
  literals: `#6366f1`, `#7c3aed`, `#8b5cf6`, `#a855f7`, `#6d28d9`.
- `bg-gradient-to-*`, `from-*`/`to-*` gradient pairs, radial gradient halos, gradient on running
  text, `bg-clip-text text-transparent`.
- Tailwind `slate-*`, `zinc-*`, `gray-*`, `neutral-*`, `stone-*`. R4U uses the `ink-*` ramp only.
- Any hex literal outside `src/styles/tokens.css`.

### Geometry

- `rounded-full` on anything except a user avatar. `rounded-2xl`, `rounded-3xl`, any radius above 8px.
- Nested cards. A card inside a card is always the wrong answer.
- A hairline border AND a diffuse shadow on the same element. Commit to edge or elevation, never both.
- A small rounded-square icon tile above a heading.
- Thick coloured side-tab accent border on a card.

### Layout

- The literal Tailwind tutorial grid: centred hero, two buttons, `grid-cols-1 md:grid-cols-3` of
  identical icon + heading + two-lines cards.
- Any symmetric 3-up or 6-up grid of identical siblings. See section 8 for the required asymmetry.
- Centred page content in the tool surface. The tool never centres.
- Measure wider than 75ch.

### Type

- A tracked uppercase pill or "eyebrow" above an oversized hero headline.
- Flat hierarchy. Type scale steps below 1.2 ratio.
- One font family for an entire page.
- `letter-spacing` above 0.05em on body text, or `line-height` below 1.3, or body below 12px.
- Justified text anywhere, including inside resume templates.

### Effects and motion

- Glassmorphism as decoration. Neon glow (`shadow-[0_0_*]`).
- `hover:scale-*` or `whileHover={{ scale }}` on cards.
- `animate-pulse`, `animate-bounce`, spring, elastic or bounce easing on UI.
- Scroll-triggered reveal on any section. Page-load stagger. `data-aos`.
- Animating `width`, `height`, `padding`, `margin`, or any layout property.
- A pulsing status dot for presence. Three animated dots for typing.
- Skeleton shimmer sweep. Animated numbers counting up. Confetti. Typewriter effects. Marquees.

### Content and copy

- Emoji in any heading, or emoji used as an icon. The fallback for a missing glyph is a word.
- `undraw`-style blob illustrations. Hero art assembled from generic SVG shapes.
- Lorem ipsum. "Feature One / Feature Two". Placeholder avatars.
- Banned phrases: Transform, Supercharge, Unleash, Effortlessly, seamlessly, reimagined,
  streamline, empower, world-class, enterprise-grade, "Build faster. Ship smarter."
- Em dashes in any UI copy, comment, commit message or document.
- The aphoristic manufactured-contrast cadence: "It's not X. It's Y."

### Explicitly cleared, do not chase

Bento grids, dark mode itself, Tailwind itself, and shadcn itself are **not** tells. The unedited
defaults are the tell, not the tools.

---

## 3. Colour

### 3.1 The ink ramp

A 13-step warm-neutral ramp at OKLCH hue 75, with **chroma ascending into the darks**
(0.000 rising to 0.012).

This is the specific manoeuvre that satisfies "editorial warmth" while dodging the cream tell.
Chroma is held at 0.001 to 0.003 across the top four steps, so the page reads as near-white
**paper**, never cream. The warmth only becomes visible in the ink. Simultaneously, because the
darks carry real chroma, they read as ink rather than as cold slate or zinc.

**The light-end chroma is a locked, non-negotiable constraint.** One step warmer and `#fbfbfa`
becomes `#faf8f5`, which is the first literal on the catalogue's list.

**Light mode** (contrast measured against `ink-00` `#ffffff`):

| Token    | Hex       | Contrast | Role (Radix step semantics)                            |
| -------- | --------- | -------- | ------------------------------------------------------ |
| `ink-00` | `#ffffff` | 1.00     | Paper. The resume document surface.                    |
| `ink-01` | `#fbfbfa` | 1.04     | App background.                                        |
| `ink-02` | `#f6f5f4` | 1.09     | Subtle background, row hover, card ground.             |
| `ink-03` | `#f0eeec` | 1.16     | UI element background.                                 |
| `ink-04` | `#e8e6e3` | 1.25     | Hovered UI element background. **Hairline rules.**     |
| `ink-05` | `#dbd9d5` | 1.41     | Active / selected background. Component edges.         |
| `ink-06` | `#c2bfba` | 1.83     | Subtle borders and separators.                         |
| `ink-07` | `#a39f9a` | 2.63     | Focus ring. **Disabled text only.** Fails AA for body. |
| `ink-08` | `#85817b` | 3.87     | Hovered border. **Fails AA for body text.**            |
| `ink-09` | `#635e58` | 6.42     | **Secondary text. The floor for any readable text.**   |
| `ink-10` | `#48433d` | 9.79     | Tertiary emphasis.                                     |
| `ink-11` | `#2e2924` | 14.40    | Body text.                                             |
| `ink-12` | `#16130f` | 18.52    | Primary text, headings.                                |

**Dark mode** (contrast measured against `ink-00` `#0e0c09`):

| Token    | Hex       | Contrast | Role                                                           |
| -------- | --------- | -------- | -------------------------------------------------------------- |
| `ink-00` | `#0e0c09` | 1.00     | App background. OKLCH L 0.155, inside the endorsed 8-12% band. |
| `ink-01` | `#15120e` | 1.05     | Subtle background.                                             |
| `ink-02` | `#1c1914` | 1.11     | Card ground, row hover.                                        |
| `ink-03` | `#25211c` | 1.22     | UI element background. Popover surface.                        |
| `ink-04` | `#2e2924` | 1.36     | Hovered UI element. **Hairline rules.** Modal surface.         |
| `ink-05` | `#39352f` | 1.60     | Active / selected.                                             |
| `ink-06` | `#4c4741` | 2.13     | Subtle borders.                                                |
| `ink-07` | `#625d56` | 2.99     | Focus ring, disabled text.                                     |
| `ink-08` | `#78746d` | 4.20     | Hovered border.                                                |
| `ink-09` | `#96918c` | 6.26     | **Secondary text floor.**                                      |
| `ink-10` | `#b4b0ac` | 9.06     | Tertiary emphasis.                                             |
| `ink-11` | `#d3d0cd` | 12.72    | Body text.                                                     |
| `ink-12` | `#f3f1f0` | 17.35    | Primary text, headings.                                        |

**Dark mode is a separately tuned ramp, not a mechanical inversion of the light one.** Inverting
produces the muddy result where subtle backgrounds become mid-tones with wrong perceptual spacing.

**Elevation in dark mode is lightness, never shadow.** Shadows are physically meaningless on dark
surfaces: there is no contrast between a dark shadow and a dark ground. A raised surface steps up
the ramp (`ink-02` to `ink-03` to `ink-04`). The only permitted dark-mode shadow is a 1px inset
top highlight at `rgba(255,255,255,0.06)`.

**Never use `#000000` as the dark background.** You cannot cast a shadow on black, which makes
elevation inexpressible at all.

### 3.2 Accent

One accent for the entire product: **print vermillion**, hue 32.

| Token          | Light     | Dark      | Use                                                 |
| -------------- | --------- | --------- | --------------------------------------------------- |
| `accent-solid` | `#c8331a` | `#d7371d` | Filled buttons, active section bar, selected state. |
| `accent-text`  | `#af2d18` | `#f47d67` | Accent-coloured text on the page ground.            |

`#c8331a` measures 5.14:1 on paper and 5.32:1 for white text placed on it, so it passes AA in
both directions. Hue 32 sits nowhere near the AI-purple band (255-280) and nowhere near the sage
green cliche. It reads as a Swiss or editorial print red rather than a brand gradient.

### 3.3 Semantic states

State is communicated by **shape, position or ramp step first**. Colour is added only when the
state is both unexpected and actionable.

The default expression of a state is a glyph plus a text label in `ink-11`, or a hairline left
rule. Never tint an entire surface with a semantic colour. Tint only a 1px rule, a glyph, or a
short text run.

| State     | Light            | Dark             |
| --------- | ---------------- | ---------------- |
| `success` | `#346c42` (6.02) | `#7bb587` (8.19) |
| `warning` | `#976712` (4.76) | `#d9b06b` (9.65) |
| `danger`  | `#ac3031` (6.30) | `#e97871` (6.87) |
| `info`    | `#3b6987` (5.70) | `#82b1d3` (8.54) |

Note that `danger` `#ac3031` sits at hue 25, only 7 degrees from the accent. Brand and danger are
therefore one hue family. **This is why the monochrome rule genuinely survives** rather than being
maintained by an exception list.

### 3.4 Two hard colour rules

1. **Never a green dot for presence.** Online and offline are a filled versus hollow ink glyph.
   This survives colour blindness, survives the monochrome rule, and does not pulse.
2. **Never a coloured pill in a data table.** Role and status render as a text label in `ink-09`
   preceded by a filled or hollow glyph. Coloured pills across a table are the fastest way to
   destroy a monochrome system.

---

## 4. Typography

### 4.1 Families

| Role                  | Family          | Axis                    | Size    | Reason                                                                                                                                                        |
| --------------------- | --------------- | ----------------------- | ------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Display / headings    | **Newsreader**  | wght 200-800, opsz 6-72 | 132 KB  | Widest optical-size range on Google Fonts. Drawn for on-screen news reading, not for looking pretty in a hero. On no slop list.                               |
| UI / body             | **Public Sans** | wght 100-900            | 26.8 KB | US government typeface. Large x-height, unambiguous `1`/`l`/`I`. Cheapest serious body face available, and cheaper than Inter (72.9 KB) or DM Sans (62.7 KB). |
| Numerals / IDs / code | **Geist Mono**  | wght 100-900            | 23.1 KB | Tabular numerals for view counts, dates, IDs and the admin table.                                                                                             |

Total Latin roman budget is roughly 182 KB. Drop Newsreader italic unless a resume template needs it.

**Explicitly rejected, with reasons:**

- _Instrument Serif_: on two slop lists, and ships a single static 400 weight with no variable
  axis, which makes weight-based hierarchy impossible and forces the flat-hierarchy tell.
- _DM Serif Display_: named on the catalogue's heading-face list. This is the face used by the
  reference design file R4U was briefed against.
- _Playfair Display_: on the slop list. Also, it has **no** optical-size axis on Google Fonts
  despite widespread claims. Requesting `opsz@5..1200` returns HTTP 400 and the font fails to load.
- _Fraunces_: on the slop list.
- _Inter_, _Geist_, _Space Grotesk_ as the body face: all three on the slop list.
- _Libre Caslon Text_: static 400/700 only, same hierarchy problem as Instrument Serif.

If Newsreader's 132 KB proves too heavy, the one defensible substitute is **Source Serif 4**
(122 KB, opsz 8-60, wght 200-900), whose optical-size implementation is genuinely typographic:
it opens spacing and thickens thin strokes at small sizes, and tightens spacing and lets contrast
develop at large sizes, the behaviour of historical metal type.

### 4.2 The optical-size axis is a craft signal, use it

Bind `font-variation-settings: 'opsz'` to the rendered size rather than relying on
`font-optical-sizing: auto`, so the values are documented and reviewable:

| Context                            | `opsz` |
| ---------------------------------- | ------ |
| Table cells, form labels, captions | 12-16  |
| Section headings, card headings    | 24-36  |
| Marketing display line             | 60-72  |

This is invisible to a casual look and unmistakable to a designer. Almost no generated site has it.

### 4.3 Weights

Exactly **two body weights** (400 and 500) plus one display weight. Use variable-font intermediate
values rather than the stock ladder: **510** and **590**, not 600 and 700. Reaching a non-standard
weight is only possible with a variable font, and it reads as considered.

Hierarchy in the tool comes from **weight plus ramp step**. Hierarchy on marketing comes from **size**.

### 4.4 Two scales, one family

| Surface                                     | Ratio | Steps (px)                  |
| ------------------------------------------- | ----- | --------------------------- |
| Tool (dashboard, editor, review, admin)     | 1.2   | 12 / 13 / 14 / 16 / 20 / 24 |
| Marketing (landing, gallery, public resume) | 1.333 | 16 / 21 / 28 / 38 / 50 / 67 |

Body line-height 1.5 to 1.6. Measure capped at 75ch. Letter-spacing is loose only on short
uppercase labels, and tighter on large headings.

### 4.5 The document type system is separate

**Critical constraint.** The resume document has its own type system, and it is governed by ATS
parsing, not by editorial taste. See `TEMPLATES.md`.

The collision to know about now: severe editorial minimalism invites wide letter-spacing on
uppercase section headings. Measured, text extraction **breaks** at a letter-spacing to font-size
ratio of about 0.10. At 9pt with 1.0pt tracking, extraction is broken. At 11pt with 1.2pt
tracking, extraction is broken. `EXPERIENCE` extracts as `E X P E R I E N C E` and the parser
fails to match the section heading.

**Hard cap: letter-spacing never exceeds 0.08 x font-size inside a resume template.** Deliver the
editorial look through case, weight, size contrast and hairline rules instead. This cap is
enforced in the theme token layer, not left to template authors.

---

## 5. Space

### 5.1 Two rhythms, shared invariants

One product, two densities. What stays identical across both: font families, the ink ramp, the
accent, the radius set, the motion tokens, the hairline weight.

Only three things vary:

|            | Tool surface                                | Marketing surface                            |
| ---------- | ------------------------------------------- | -------------------------------------------- |
| Spacing    | Strict 4/8 grid, section gap capped at 48px | Optically tuned large gaps, not snapped to 8 |
| Type ratio | 1.2                                         | 1.333                                        |
| Measure    | Edge to edge, 1280-1440px working width     | 680-760px measure inside a 1200px container  |

**The rule that ties them together: the tool never centres a page, and the marketing surface never
uses a card grid with more than two identical siblings.**

Component-level spacing stays on the 4/8 grid everywhere. Page-level section spacing on marketing
is tuned by eye. This is not sloppiness: Linear's own measured section gaps are 39, 47, 51, 56, 69,
79, 91, 95, 99, 111 and 123px, none of them multiples of 8.

### 5.2 Scale

`4 / 8 / 12 / 16 / 20 / 24 / 32 / 40 / 48` for the tool.
Marketing adds `56 / 72 / 96 / 120`.

Consistency failure is measurable and is a catalogued tell: `p-3` mixed with `p-7`, arbitrary
`mt-[37px]`, misalignment to any grid. These are the residue of nobody having made a decision.

---

## 6. Shape

**Three radii, no others:**

| Radius | Applies to                                                    |
| ------ | ------------------------------------------------------------- |
| `2px`  | Inputs, buttons, table cells, badges, small controls          |
| `6px`  | Cards, panels, popovers, modals                               |
| `0px`  | The resume document surface, and every hairline-ruled section |

No pill buttons. No `rounded-full` except the user avatar. Nothing above 8px.

**Edge or elevation, never both.** Default to edge: a 1px `ink-05` border, no shadow. Shadow is
reserved for genuinely floating layers (popover, modal, toast) at a single documented value, and
those layers then carry no border.

Hairline weight is 1px on screen. In the resume templates it is 0.5pt, since print hairlines run
0.08 to 0.15pt and 0.5pt is the thinnest weight that survives consumer printers reliably.

---

## 7. Motion

### 7.1 Three durations, two curves

| Token       | Duration | Applies to                                         |
| ----------- | -------- | -------------------------------------------------- |
| `motion-xs` | 100ms    | Hover, focus ring, checkbox, button press          |
| `motion-sm` | 160ms    | Dropdown, popover, tooltip, toast, panel reveal    |
| `motion-md` | 400ms    | Route change, drawer, modal, template preview swap |

Easing: `cubic-bezier(0.25, 0.46, 0.45, 0.94)` for entrances and most transitions. `linear` for
progress only. Never spring, never bounce, never elastic.

**Animate only `transform` and `opacity`.** Nothing else, ever.

### 7.2 Specific prohibitions

- **Never animate the live resume preview.** Any transition on the preview panel produces jitter
  that reads as broken, and the underlying property is layout reflow, which is the one thing that
  must never be animated. Debounce the render, not the appearance. The preview updates instantly
  and silently.
- **The command palette and any keyboard-driven menu appear with zero motion.** Users open the
  section switcher dozens of times per editing session. Novelty animation becomes friction on
  the tenth repeat.
- **Presence animates only at the moment presence actually changes**, never continuously.

### 7.3 Reduced motion is substitution, not deletion

Structure the CSS opt-in: author no motion by default and declare motion inside
`@media (prefers-reduced-motion: no-preference)`. This avoids a flash of animated content before
the query applies.

Inside `@media (prefers-reduced-motion: reduce)`: keep opacity transitions at 100ms, keep focus
ring transitions, keep progress indicators, and replace every `transform` with a pure opacity
crossfade. Never emit a global `animation: none`.

---

## 8. Gestalt, applied per surface

Definitions are not useful. These are the specific applications.

### 8.1 Resume editor (three panels)

- Express the panel split with a **single 1px `ink-04` rule and background parity**. All three
  panels sit on `ink-01`. Not three cards on a grey field. Uniform connectedness via a rule costs
  less ink than common region via cards.
- **Section list (left):** proximity does the grouping. 4px between entries within a section type,
  20px between groups. The active section gets a **2px accent bar flush to the left edge** plus
  `ink-12` text. Not a filled row.
- **Form column (centre):** each repeatable entry is a common region defined by whitespace plus a
  hairline above it. **Never a nested card.** Reorder handles appear on row hover only, as a plain
  three-line glyph. Drag uses a **1px accent insertion rule**, not a ghost card.
- **Hidden sections** stay visible in the list at `ink-07` with a hairline strikethrough. Figure
  and ground demotion, not removal. The user must be able to see what they have hidden.
- **Completeness** renders as a hairline rule that fills, plus tabular numerals. Never a ring
  chart. Never an animated counter.
- **Preview column (right):** the resume renders on true `#ffffff` at real A4 proportion with a
  visible page edge. The paper must be figure and the app must be ground.

### 8.2 Dashboard card grid

**Break the symmetric 3-up grid deliberately.** It is the single most recognisable AI layout, and
it will appear by default in three places a reviewer looks first: the dashboard, the template
gallery, and the marketing features section. All three need an explicit asymmetry decision.

The most recently edited resume becomes a **wide 2-column tile with a live thumbnail**. The rest
form a 3-up of smaller tiles. Alternatively a 12-column grid with tiles spanning 5 / 4 / 3.

Every tile carries **identical internal anatomy** regardless of size: thumbnail, title in `ink-12`,
role subtitle in `ink-09`, hairline, then a metadata row in Geist Mono at 12px. Scanning stays
predictable even though sizes vary.

Cards are `ink-00` on an `ink-01` page with a 1px `ink-05` edge and **no shadow at rest**.

### 8.3 Admin data table

No zebra striping. No vertical rules. A 1px `ink-04` horizontal rule between rows. Cell padding
12px vertical, 16px horizontal. **Every numeric column right-aligned with `font-variant-numeric:
tabular-nums`.** Sticky header in `ink-09` at 12px with 0.04em tracking, not uppercase.

Continuity: the left edge of the first column and the right edge of the last column align exactly
with the page container.

Row hover is a background shift to `ink-02` only. No border, no shadow, no scale.

Similarity does the work colour would otherwise do: role and status are a text label in `ink-09`
preceded by a filled or hollow glyph.

### 8.4 Review room

- **Comment to section linking uses common fate, not colour or a connector line.** Hovering a
  comment shifts its target section background to `ink-02` and draws a 2px accent left rule. Both
  change together, so the relationship is perceived without drawing anything between them.
- **Chat messages have no bubbles.** A three-column rhythm: timestamp (Geist Mono, `ink-07`, 11px),
  author (`ink-12`, weight 500), body (`ink-11`), separated by whitespace alone. Consecutive
  messages from one author collapse the author line.
- Owner versus reviewer is distinguished by **a single hairline left rule on reviewer messages**.
  Not by alignment. Not by colour.
- Typing indicator is **text**: "Neha is typing". Never three animated dots.
- Presence is a filled versus hollow glyph plus the words "Online" or a "Last seen" line. Never a
  green dot. Detection has a real ceiling of about 45 seconds, so the UI says "last seen" rather
  than claiming precision it does not have.

---

## 9. Iconography

**Do not install an icon library.**

Draw at most **12 glyphs**, each at 16px on a 16px grid, with a **single 1.5px stroke weight** and
a **single 1px corner radius** across the whole set. Identical stroke width and corner radius rules
are what make a hand-drawn set read as a system rather than as clip art.

**Where a glyph is not clearly better than a word, use the word.** Never emoji, under any
circumstance. The fallback for a missing glyph is a word, never an emoji.

For section markers in the editor, use a **two-letter Geist Mono abbreviation** rather than a
pictogram. It is more legible at 12px, costs nothing, and reads as considered.

Banned: thin interchangeable line icons that could illustrate any product, and any rounded-square
icon tile above a heading.

---

## 10. Content and copy

**Populate every screen with real content before reviewing the design.** Write actual resume
entries for a plausible person: a specific job title, a real-sounding company, a real date range,
a bullet containing a number. Real review comments with real critique text. Real admin log lines.

Never lorem. Never "Feature One". Never placeholder avatars.

**Empty states** are written as instructions with one primary action and one line of `ink-09`
explanatory text. No illustration, no icon, no "Nothing here yet".

**Product copy names the literal action.** "Export as A4 PDF". "Share link expires in 30 days".
"Reviewer can comment but cannot edit". "Resume content is not visible to administrators."

That last line is required to appear in the admin UI. It is simultaneously a trust signal and a
sentence no template would ever contain.

---

## 11. Component patterns

Every reusable element lives in `src/components/ui/`. No page defines its own button.

```
Button      radius 2px / 1px ink-05 edge / no shadow / motion-xs on hover
            primary    accent-solid ground, ink-00 text
            secondary  transparent ground, ink-05 edge, ink-11 text
            ghost      transparent, no edge, ink-09 text, ink-02 hover ground
            No pill shapes. No coloured backgrounds other than accent-solid.

Input       radius 2px / 1px ink-05 edge / ink-00 ground
            focus      2px ink-07 ring, no glow, no colour change
            invalid    1px danger edge plus a danger text line below,
                       never a tinted field
            Label above, 12px, ink-09, 0.04em tracking, sentence case.

Card        radius 6px / 1px ink-05 edge / ink-00 ground / no shadow at rest
            hover      ink-04 edge only. No lift, no scale, no shadow.

Modal       radius 6px / no edge / single documented shadow / ink-00 ground
            Backdrop ink-12 at 30% opacity.
            Enter motion-md, opacity plus 4px translate.

Toast       radius 2px / 1px ink-05 edge / no shadow / ink-00 ground
            Hairline left rule carries the semantic colour.
            The surface itself stays neutral.
            Hand-rolled over Context and useReducer. Not react-hot-toast,
            not sonner: both ship pill shapes, drop shadows and spring
            entrances that contradict this system.

Table       see 8.3

Rule        1px ink-04. The primary structural device in the product.
```

---

## 12. Enforcement

`scripts/design-guard.sh` runs in CI and fails on any ban-list hit. Additionally:

- **No hex literal may appear outside `src/styles/tokens.css`.** Everything else reads a token.
- Tailwind v4's `@theme` block defines the ramp in explicit sRGB hex, overriding Tailwind's
  default oklch palette entirely. This is required regardless of aesthetics: `html2canvas` throws
  on `oklch()` and would break thumbnail generation.
- The accent is a separate `--accent` custom property so the resume renderer can drive it at
  runtime from the user's choice.
