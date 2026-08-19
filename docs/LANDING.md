# Landing Page

Built in Phase 11, deliberately last, so it can be assembled from real product screens rather than
from promises. This file exists now so the concept is not lost or diluted in the meantime.

---

## 1. The hero lockup

The centrepiece is the wordmark, set large, and it resolves itself:

```
        R          4          U
     RESUME        4         YOU
```

The **4 is a fixed pivot** and never moves. The **R travels left** while `ESUME` fills in behind
it. The **U travels right** while `YO` fills in ahead of it. The mark expands out of itself into
the sentence it always was.

This works because of an accident of the name that is worth exploiting: `R` is the first letter of
RESUME and `U` is the last letter of YOU. The two outer glyphs are already in the right place. Only
the interior is missing.

### 1.1 Why it is not decoration

Every other option here is a tell. An animated gradient headline, a floating mockup, a typewriter
effect, a scroll-triggered stagger on identical feature cards: all catalogued, all listed in
`DESIGN-SYSTEM.md` section 2.

This is a typographic idea rather than an effect. It explains the product in one gesture, it is
made entirely of live text, and it could not be lifted onto any other product because it depends
on this specific name.

---

## 2. Implementation

### 2.1 The DOM holds the expanded state

Render `RESUME 4 YOU` as real text. That is what a screen reader announces, what search engines
index, and what copies to the clipboard. The collapsed `R4U` is a **visual transform of the final
layout**, never a separate string that gets swapped.

```
<h1 aria-label="R4U, Resume For You">
  <span class="lockup">
    <span class="outer">R</span><span class="fill">ESUME</span>
    <span class="pivot">4</span>
    <span class="fill">YO</span><span class="outer">U</span>
  </span>
</h1>
```

### 2.2 Transform and opacity only

The initial state translates the outer glyphs inward and hides the fill:

- `.outer` (R): `translateX(+width of ESUME)`
- `.outer` (U): `translateX(-width of YO)`
- `.fill`: `opacity: 0`, with a small inward `translateX`

Reveal removes the transforms. Nothing animates `width`, `letter-spacing` or `margin`, all of which
are layout properties and are banned outright. This is the whole reason for building it as a
transform of the final layout rather than as a growing string.

### 2.3 The centring problem, and it is real

`width(ESUME)` and `width(YO)` are not equal, so naively collapsing the lockup leaves `R4U`
off-centre by half their difference.

Fix: apply a compensating `translateX` to `.lockup` of `(width(ESUME) - width(YO)) / 2` in the
collapsed state, animating to `0`. Measure both fills with a `ResizeObserver` after
`document.fonts.ready`, because the widths are font-dependent and measuring before load gives the
fallback face's metrics.

Do not hard-code the offset in `em`. Newsreader's optical-size axis changes glyph widths with
rendered size, so a value tuned at one breakpoint is wrong at the next.

### 2.4 Timing

The expansion runs once, on load, after fonts are ready. It does not replay on scroll and it does
not replay on navigation back to the landing page within a session.

Sequence: pivot present, then outer glyphs travel, then fill fades in trailing the travel by about
40 percent of the duration so the letters appear to be revealed by the movement rather than
alongside it.

---

## 3. Two named exceptions to the design system

Both are recorded rather than quietly taken. This is the only surface where either applies.

### 3.1 A fourth motion duration

`DESIGN-SYSTEM.md` section 7.1 defines exactly three durations, the longest being 400ms. The
expansion needs roughly 800ms to read as deliberate rather than twitchy.

**Add `--motion-hero: 800ms`, scoped to the landing hero only.** It must not be reachable from the
tool surface, and no other component may use it.

### 3.2 One scroll-linked element

The ban list forbids scroll-triggered reveals. That rule exists to stop `data-aos` being sprayed
across every section, which is what makes a page read as generated.

**The exception is the hero lockup alone.** As the page scrolls, it translates up and fades,
handing the viewport to the content beneath. Requirements:

- `transform` and `opacity` only, driven by scroll position
- Prefer a CSS scroll-driven animation (`animation-timeline: view()`) over a JavaScript scroll
  listener, so it runs off the main thread
- Nothing else on the page is scroll-linked. Sections below simply exist when scrolled to

If a second element ever wants scroll-linked motion, that is the signal the rule is eroding.

---

## 4. Reduced motion

`prefers-reduced-motion: reduce` gets the **expanded state immediately**, fully legible, with no
travel and no parallax. Not a faster version, and not a fade-in: the final state, rendered.

The lockup must be readable and correct with JavaScript disabled and with animation unavailable.
Build the expanded state as the default and treat the collapse as progressive enhancement applied
by script, so a failure mode leaves the page correct rather than blank.

---

## 5. Colour

Per `DESIGN-SYSTEM.md`. The chrome is achromatic, so the lockup is ink, not a gradient and not a
colour wash.

- `RESUME` and `YOU` in `ink-12`
- The `4` pivot in `accent-solid`, the one saturated mark on the screen

That single accent glyph is the entire colour budget of the hero. It marks the pivot, so the colour
is doing structural work rather than decorating. Never a gradient across the letters, never a
per-letter colour ramp.

---

## 6. Below the fold

Everything under the hero follows the marketing rhythm in `DESIGN-SYSTEM.md` section 5.

- **The hero artefact is a real resume**, the Alex Mercer fixture rendered through Foundry at true
  A4 proportion. Not an illustration, not a floating browser mockup, not a generic SVG.
- **No symmetric three-up grid of identical icon cards.** That is the literal Tailwind tutorial
  layout and it is the first thing a reviewer's eye lands on.
- **Real screenshots of real screens** over icon-and-heading cards.
- The copy states plainly that there is **no paywall at download**, which is the loudest complaint
  in the category and free differentiation.
- The ATS claim is stated honestly and links to `/ats-methodology`. Never the unsourced
  "75 percent of resumes are rejected by ATS" figure.

---

## 7. Checklist before this ships

- [ ] Accessible name is "R4U, Resume For You" and the visible text is live, selectable text
- [ ] Nothing animates a layout property
- [ ] Correct with JavaScript disabled
- [ ] Correct under `prefers-reduced-motion: reduce`
- [ ] Centred correctly at every breakpoint, measured after `document.fonts.ready`
- [ ] `--motion-hero` is not referenced anywhere outside the landing hero
- [ ] The hero is the only scroll-linked element on the page
- [ ] `design-guard.sh` passes
