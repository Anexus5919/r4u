# ATS Readiness Rubric v1.0.0

R4U's flagship feature. A deterministic, explainable, versioned 100-point rubric.

**Publishing this rubric is itself the differentiator.** Jobscan, Rezi, Teal, Resume Worded and
Enhancv all show a number and none of them publish how it is computed. R4U publishes the whole
thing at `/ats-methodology`.

---

## 1. What an ATS actually does

Get this right in the product copy, because a viva panel member who has recruited will know.

Real ATS products (Workday, Oracle Taleo, Greenhouse, Lever, iCIMS, SAP SuccessFactors, Bullhorn)
**do not score and reject resumes**. They extract text, segment it into sections by matching
header text, and write structured fields into a searchable database that recruiters then query.

- Greenhouse does not score or rank resumes at all.
- Lever's recruiters work purely from search results.
- 83% of 630 polled recruiters, and 97% of experienced ones, said their ATS does not auto-reject
  on resume content.

**Therefore R4U never claims the score predicts rejection.** The number is labelled
"ATS Readiness", never "chance of passing the ATS". The failure mode being measured is real but
narrower: if the parser cannot extract your work history, you do not appear in the recruiter's
search results at all.

**Never print "75% of resumes are rejected by ATS."** It has been traced and has no source. The
citable figure is the HBS and Accenture 2021 "Hidden Workers" paper: 88% of employers say
qualified candidates are rejected by criteria mismatch, and that is about recruiter-configured
filters, not parsers.

### 1.1 The primary source

iCIMS and Bullhorn both license Textkernel (formerly Sovren) as their parsing engine, and
Textkernel publishes a machine-readable **Resume Quality** code list: a real parser's own
definition of a machine-readable resume. That is what this rubric is built on, not blog folklore.

Four severity tiers, abbreviated:

| Tier                | Examples                                                                                                                                                                                                                                                                      |
| ------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Fatal (400s)        | 412 no sections found / 413 work history absent / 417 non-standard headers, only first work section parsed / 418 date ranges written vertically / 419 employment section lacks dates / 433 columnar data rearranged / 441 neither email nor phone found                       |
| Major (300s)        | 300 format is PDF / 302 first and last name not located / 311 contact info not at top / 323 multiple sections of identical type / 324 sections with headers but no content / 325 sections found with no header                                                                |
| Data missing (200s) | 211 no email / 212 no phone / 221 positions with no job title / 222 positions with no company / 224 missing start dates / 225 missing end dates                                                                                                                               |
| Suggested (100s)    | 111 references section unnecessary / 112 skills should appear in the context of work history / 121-124 driving licence, passport, marital status, date of birth are privacy risks / 131-133 more than one address, email or phone / 151 section headers not on their own line |

Textkernel states plainly: "Every section should have a clear, unambiguous, commonly-used header
on a separate line directly above the content associated with it."

Its canonical section enum is short and fixed: `WORK HISTORY`, `EDUCATION`, `OBJECTIVE`,
`SUMMARY`, `SKILLS`, `CERTIFICATIONS`, `PATENTS`, `SPEAKING`, `OTHER_PUBLICATIONS`, `REFERENCES`.
Anything outside it (Projects, Achievements, Languages, Volunteering) lands in a generic bucket at
best, and is absorbed into the preceding section at worst.

---

## 2. How R4U scores

R4U owns the structured resume JSON and the template metadata, so it never parses a PDF.

```
serializeToParserView(resume, template) -> string
```

Emits the exact plain-text reading order a line-oriented extractor would produce, **deliberately
interleaving columns when `template.columns === 2`**, which is precisely how a two-column resume
degrades in the wild.

Scoring runs against three inputs: the structured JSON, that serialised string, and the template
`atsProfile`. Completely reproducible, no PDF extraction, no machine learning.

### 2.1 Persistence

Store only this, per ADR-008 and ADR-011:

```ts
{ resumeId, rubricVersion: '1.0.0', total, mode,
  dimensions: [{ id, earned, possible }],
  checks: [{ checkId, status: 'pass' | 'partial' | 'fail', earned, possible }] }
```

**Never persist extracted resume text or the pasted job description beyond the request.**

### 2.2 Total

| Dimension                         | Points  |
| --------------------------------- | ------- |
| A. Parseability and export safety | 30      |
| B. Structure and sections         | 20      |
| C. Contact and identity           | 10      |
| D. Content quality                | 20      |
| E. Job-description match          | 20      |
| **Total**                         | **100** |

With no job description pasted, report `round(earned / 80 * 100)` and label the mode
**"Format only"** in the UI. Never silently zero dimension E.

---

## 3. Dimension A: parseability and export safety (30)

| ID  | Pts | Check                                                                     |
| --- | --- | ------------------------------------------------------------------------- |
| A1  | 8   | Export produces a real text layer                                         |
| A2  | 6   | Single-column reading order                                               |
| A3  | 3   | No tables, text boxes or absolutely positioned blocks                     |
| A4  | 3   | No images, photo, logos, icon glyphs or skill bars                        |
| A5  | 3   | Contact block is in the body flow, not a page header or footer            |
| A6  | 3   | Body font is on the safe list and embedded with a complete ToUnicode CMap |
| A7  | 2   | Body 10-12pt, headings 14-16pt, margins at least 0.5in, at most 2 pages   |
| A8  | 2   | Bullet glyph is one of the plain set                                      |

**A2 is graded, not binary.** 6 if `columns === 1`. 3 if two columns and the sidebar holds only
contact details and a skills list. 0 if any experience, education or summary content sits in a
sidebar.

**A6 safe list:** Arial, Calibri, Helvetica, Georgia, Cambria, Garamond, Palatino, Tahoma,
Verdana, Times New Roman. Discretionary ligatures disabled.

**A8 permitted glyphs:** `-` and the plain round, square and hollow bullets only.

### 3.1 A-GATE: invisible text, hard zero

If any text node's colour is within delta-E 10 of its background, or any font size is below 6pt,
or any element carries `opacity: 0` or `visibility: hidden` while containing text:

**Return a score of 0 and block export.**

> We found text hidden from human readers. Parsers extract colour-blind raw text, so hidden
> keywords show up in recruiter exports and searchable records. This gets applications
> blacklisted, not boosted.

### 3.2 Remediation copy

- **A1:** "Your PDF is a picture of a resume. Rasterised exports contain zero machine-readable
  characters, so every ATS extracts an empty document. Nothing else on this page matters until
  this is fixed."
- **A2:** "Parsers read line by line, not column by column. Your two-column layout extracts as
  interleaved fragments. Textkernel raises quality code 433 and Lever silently drops sidebar
  content. Switch to a single-column template."
- **A3:** "Tables and text boxes are dropped entirely by five of eight major parsers, including
  Workday. Everything on your resume must be plain flowing text."
- **A4:** "Skill bars and icons carry no text. Write `Java (Expert)` instead of a five-dot rating,
  and replace the phone icon with the word `Phone:`."
- **A5:** "Content placed in a page header or footer is invisible to most parsers. Move your name
  and contact line into the first lines of the document body (code 311)."
- **A6:** "Decorative fonts can export without a correct character map, which makes your text
  extract as blank or garbled symbols. Use a standard document face for body text."
- **A7:** "Body text below 10pt and margins under half an inch push content into zones that get
  cropped or mis-ordered. Keep the resume to two pages."
- **A8:** "Checkmarks, arrows and emoji bullets are dingbat glyphs with no Unicode meaning. They
  extract as junk or delete the line. Use a plain round bullet."

---

## 4. Dimension B: structure and sections (20)

| ID  | Pts | Check                                                                 |
| --- | --- | --------------------------------------------------------------------- |
| B1  | 5   | Experience heading matches the whitelist                              |
| B2  | 3   | Education heading matches the whitelist                               |
| B3  | 3   | Skills heading matches the whitelist                                  |
| B4  | 2   | Every heading sits on its own line directly above its content         |
| B5  | 2   | No duplicate section types, no heading with zero visible entries      |
| B6  | 2   | Experience and education in reverse-chronological order by start date |
| B7  | 3   | Every experience entry has dates, a title and an employer             |

**Whitelists.**

- B1: Work Experience, Professional Experience, Experience, Employment History, Work History,
  Career History, Relevant Experience.
- B2: Education, Education and Training, Academic Background.
- B3: Skills, Technical Skills. Amber at 2 of 3 for "Core Competencies", which some engines
  recognise and others miss.

**B7 scores proportionally:** `3 * (complete entries / total entries)`.

**B-FORMAT**, folded into B7 with no extra points. Dates render as `MMM YYYY - MMM YYYY` or
`MMM YYYY - Present`, with an en dash, on one line, identically for every entry.

Rejected: bare year ranges on roles under five years old, apostrophe years, season names, "to" as
a separator, and any layout stacking a date range across two lines. That last one is Textkernel
code 418 and is a common casualty of right-aligned date columns.

### 4.1 Remediation copy

- **B1:** "Parsers find sections by matching header text. A custom heading means your entire
  employment history is either mis-filed or dropped (codes 413 and 417). Rename this section
  `Work Experience`."
- **B2:** "Rename to `Education`. Anything else risks your degree never reaching the education
  field (code 414)."
- **B4:** "Section headings must sit alone on a line above their content (code 151). Inline or
  side-by-side headings are read as body text."
- **B5:** "You have an empty section heading, or two sections of the same type. Parsers raise
  codes 323 and 324 and may keep only the first. Use the hide-section control instead of leaving
  an empty heading."
- **B7:** "Role {n} is missing a {field}. A role without dates cannot be placed on your timeline
  (codes 224, 225, 419), and a role without a title or company may be discarded entirely
  (codes 221, 222)."

---

## 5. Dimension C: contact and identity (10)

| ID  | Pts | Check                                                                                     |
| --- | --- | ----------------------------------------------------------------------------------------- |
| C1  | 3   | Exactly one valid email in plain text, not an icon, not a mailto-only link                |
| C2  | 2   | Exactly one phone number, digits and separators only, no icon prefix                      |
| C3  | 2   | Name is the first text line of the body, at least two tokens, plain text                  |
| C4  | 1   | City and state or country present, no full street address                                 |
| C5  | 2   | No date of birth, marital status, passport, driving licence, gender, nationality or photo |

- **C1:** "A resume with no readable email cannot become a candidate record. Textkernel treats a
  missing email and phone as a fatal parse (code 441). List exactly one address (code 132)."
- **C3:** "Your name must be the first line of the document. Parsers that cannot isolate a first
  and last name build a nameless record (code 302)."
- **C4:** "Include City, State. Recruiters filter on location. Leave off the street address."
- **C5:** "Remove {field}. In the US, UK, Australia and New Zealand these are treated as
  compliance risk and some systems flag the record (codes 121 to 124)."

---

## 6. Dimension D: content quality (20)

| ID  | Pts | Check                                              |
| --- | --- | -------------------------------------------------- |
| D1  | 3   | Each experience entry carries 3 to 6 bullets       |
| D2  | 4   | Share of bullets opening with a strong action verb |
| D3  | 4   | Share of bullets containing a quantification token |
| D4  | 3   | No bullet opens with a weak or passive phrase      |
| D5  | 2   | No first-person pronouns                           |
| D6  | 2   | Mean bullet length 8 to 35 words                   |
| D7  | 2   | Total word count 400 to 1600, at most 2 pages      |

**D2 awards `4 * min(1, share / 0.8)`.** Full marks at 80%, not 100%.
**D3 awards `4 * min(1, share / 0.5)`.** Full marks at 50%.

**D4 regex:**

```
/^(responsible for|was responsible|worked on|worked with|helped( to)?|assisted (with|in)|
involved in|participated in|duties included|tasked with|in charge of|part of|
contributed to|handled|dealt with)\b/i
```

**D5 regex:** `/\b(I|I'm|I've|my|me|we|our|us)\b/`

### 6.1 Action verb list

Roughly 180 verbs in six buckets. Check **only the first token** of each bullet, after stripping
leading punctuation, and allow present tense only when `entry.isCurrent`.

| Bucket      | Verbs                                                                                                                                               |
| ----------- | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| Leadership  | led, directed, managed, coordinated, oversaw, supervised, chaired, spearheaded, orchestrated, mentored                                              |
| Build       | built, developed, engineered, designed, architected, implemented, deployed, programmed, prototyped, migrated, refactored, integrated, containerised |
| Improve     | optimized, optimised, improved, reduced, increased, accelerated, streamlined, automated, scaled, consolidated, standardised, hardened               |
| Analyse     | analyzed, evaluated, researched, modeled, forecasted, diagnosed, audited, benchmarked, profiled                                                     |
| Deliver     | delivered, launched, shipped, executed, completed, achieved, won, secured, closed                                                                   |
| Communicate | presented, authored, documented, negotiated, trained, facilitated, published                                                                        |

**Blocklist**, from Rezi's 102,944-resume corpus: worked, work, make, study, made, took, show,
take, leave, showed, helped, assisted.

### 6.2 Quantification regex, with the guard that makes it work

```
currency      /[$INR EUR GBP]\s?\d[\d,]*(\.\d+)?\s?(k|m|mn|bn|b|lakh|crore)?/i
percentage    /\b\d[\d,]*(\.\d+)?\s?%/
multiplier    /\b\d+(\.\d+)?\s?[x]\b/i
counted nouns /\b\d[\d,]*(\.\d+)?\+?\s+(?:[a-z][a-z-]*\s+){0,2}[a-z]{3,}s\b/i
units         /\b\d[\d,]*(\.\d+)?\+?\s?(ms|kb|mb|gb|tb|rps|qps|fps|k|
              million|billion|thousand|lakh|crore)\b/i
delta phrase  /\b(reduced|increased|improved|grew|cut|raised|lowered|saved|
              accelerated)\b[^.]{0,40}\d/i
```

**GUARD, and this is the part that matters.** Reject any match whose number is a year
`/(19|20)\d{2}/`, a version `/v?\d+\.\d+(\.\d+)?/`, or the entry's own date range.

Without it, every bullet in a 2021 to 2023 role scores as quantified, the D3 metric becomes noise,
and users notice immediately when a duty-only bullet earns full marks.

**Correction, made during implementation.** An enumerated noun list was the original design and
it is the wrong shape: real bullets count services, minutes, deploys, incidents and failures,
and any fixed list is one word short of the next resume someone writes. A number followed by a
plural noun, with up to two words in between, generalises correctly. Verified against the sample
resume, where three of eight bullets failed the enumerated version. The explicit list survives
only for units that are not plural, such as ms and gb.

### 6.3 Filler list

Feeds hints only, no points: team player, hard worker, hard-working, go-getter, detail-oriented,
results-driven, self-starter, think outside the box, synergy, dynamic, passionate, guru, ninja,
rockstar, proven track record, excellent communication skills.

> These phrases are claims without evidence. Replace with the bullet that proves it.

### 6.4 Remediation copy

- **D2:** "{k} of your {n} bullets do not start with an action verb. Lead with the verb: Led,
  Built, Designed, Implemented, Reduced, Automated, Negotiated, Migrated."
- **D3:** "Only {k} of {n} bullets contain a number. Use Google's X-Y-Z shape, accomplished X as
  measured by Y by doing Z. For example: `Reduced page load time by 40% by adding server-side
caching.`"
- **D4:** "Bullet {n} opens with `{phrase}`, which describes an assignment, not an outcome.
  Rewrite it starting with what you did."
- **D5:** "Remove pronouns. Resume bullets are written in implied first person: `Managed a team of
six`, not `I managed a team of six`."

---

## 7. Dimension E: job-description match (20)

| ID  | Pts | Check                             |
| --- | --- | --------------------------------- |
| E1  | 10  | Hard-skill coverage               |
| E2  | 3   | Job-title alignment               |
| E3  | 3   | Required qualifications present   |
| E4  | 2   | General and soft keyword coverage |
| E5  | 2   | Placement and context             |

**E1:** `10 * min(1, matchedHardSkills / max(1, ceil(0.75 * totalHardSkillsInJD)))`.
Matching 75% of the posting's hard skills earns full marks. Demanding 100% is what drives stuffing.

**E5:** `2 * (matched hard skills appearing at least once OUTSIDE the skills list / matched hard skills)`.
Textkernel records the section a skill was found in and treats skills evidenced inside dated roles
as stronger, which is code 112.

### 7.1 E-CAP: anti-stuffing, as a cap not a penalty

Cap dimension E at 12 of 20 and show a warning if **any** of:

- a single keyword's occurrence count exceeds `max(3, 1.5% of total resume words)`
- the skills section holds more than 30 items
- more than 50% of skills-section entries appear nowhere else in the document

> This reads as keyword stuffing. Repetition earns nothing here, since each keyword counts once,
> and recruiters read the extracted text, where a padded skills list is obvious.

A cap rather than a negative score, because negative scores stop the total summing to 100 and
become impossible to explain.

### 7.2 Keyword pipeline

1. **Normalise.** NFKC, lowercase, strip punctuation except `+ # . - /` so `C++`, `C#`,
   `Node.js`, `CI/CD` and `.NET` survive.
2. **Strip boilerplate.** Drop blocks under headings matching
   `/equal opportunit|about (us|the company)|benefits|perks|we offer|diversity|accommodation|salary range/i`.
3. **Tokenise** with `natural.RegexpTokenizer`, then build unigrams, bigrams and trigrams.
4. **Dictionary match first.** Seed `skills.json` from ESCO, whose `preferredLabel` plus
   `altLabels` give free synonym sets, filtered to tech and business, shaped as
   `{ id, canonical, aliases[], type: 'hard' | 'soft' | 'tool' | 'cert' | 'degree' }`.
   **Never stem dictionary entries.**
5. **Fallback bucket** for unmatched terms: non-stopword unigrams and bigrams occurring twice or
   more, or once inside a Requirements or Must-have block. Weight requirement-block terms 2x.
6. **Stem only the fallback bucket**, with `natural.PorterStemmer`, on both sides.
7. **Acronyms live in the dictionary, not the algorithm:**
   `{ canonical: 'Search Engine Optimization', aliases: ['SEO'] }`. A match on either form counts.
   Remediation asks for both once: "Write it as `Search Engine Optimization (SEO)` so you match
   either search."
8. **Never fuzzy-match skills.** Levenshtein at distance 1 is permitted only on tokens of 8 or
   more characters and only to surface a "possible typo" hint, never to award points.
9. **Symbol-safe boundaries:** build regexes as `(?<![\w+#.])ESCAPED(?![\w+#.])` so `C++` and
   `.NET` match and `Java` does not match `JavaScript`.

### 7.3 Two traps

**Do not stem the skills dictionary.** Porter turns `SAS` and `SASS` into neighbours, mangles the
`Redis` and `Redux` family, and destroys single-letter languages like R and Go.

**Do not fuzzy-match.** Levenshtein or Dice on short skill tokens produces confident garbage:
React and Reach, SAS and SASS, Go and Got, R and RE, Java and Jira.

**Paste only, never fetch a job description from a URL.** Server-side scraping of job boards means
CORS workarounds, terms-of-service violations, unpredictable HTML, and a feature that breaks
during the demo.

---

## 8. Presentation

Show three artefacts, never one number.

1. **Dimension bars A to E**, with earned over possible.
2. **The itemised failed checks**, each with its point cost, its remediation, and a deep link
   straight to the offending section in the editor.
3. **A Parser Preview pane** rendering `serializeToParserView()` verbatim: the raw text a machine
   sees. This is the most persuasive element in the entire product and costs nothing extra.

Under the score, one line of methodology:

> Scored against the published resume-quality rules of the Textkernel/Sovren parsing engine used
> by iCIMS, Bullhorn and others. Rubric v1.0.0. See the full 100-point breakdown.

**Remediation never auto-rewrites the resume.** Every fix deep-links to the field and lets the
user decide. An auto-fix that rewrites bullets is exactly the generated feel the design direction
rejects, and it breaks the honesty premise of the whole feature.

---

## 9. Integration constraints

- **Bind the checker to the template gallery.** Every template carries `atsProfile`, is badged
  with its maximum achievable A-dimension score, and the checker can say "this template caps you
  at 21 of 30 on parseability, switch to Foundry to recover 9 points."
- **A two-column gallery without this badging is a trap.** Ship beautiful two-column templates,
  score them 0 of 6 on layout, and users will read the checker as broken.
- **Reconcile with the character-limit validator.** Per-bullet limit is roughly 240 characters so
  it agrees with D6's 8 to 35 words. Summary limit roughly 600. Two features disagreeing about
  length is the fastest way to look unfinished.
- **Completeness percentage derives from the rule pass rate**, not from filled-field count. A
  100%-complete resume full of unquantified duty statements is a worse outcome than an 85% one
  that is well written.
- **Gate the linter on `resumeType`.** An academic CV is 3 to 6 pages, wants named references with
  contact details, must not bullet-limit publications, and "quantify every bullet" is actively
  wrong for a publications list.

## 10. Attribution

ESCO requires acknowledgement of the European Commission. O*NET data is CC BY 4.0 and requires an
attribution notice. Both lines ship in the ATS methodology panel. A licence violation in a graded
project is an avoidable own goal.

## 11. Implementation notes

Recorded during phase 10, so the code and this document never disagree. See ADR-020.

- **Where it runs.** `shared/src/ats/` holds the rubric table, the dictionary, the parser view and
  the scorer, with no dependency, so the browser and the server share one implementation.
  `POST /api/resumes/:id/ats` scores and stores ids and points only.
- **Dimension A from template metadata.** A1 always passes because export is a real text layer.
  A2 to A8 read the template's `atsProfile`, and the dimension is then capped at
  `maxDimensionAScore`, which is what the gallery badges and the ceiling notice report.
- **A6 safe list.** The rubric's list plus the faces R4U ships as static per-weight TTFs (Source
  Sans 3, Source Serif 4 and the rest), because those embed with a complete character map, which
  is what A6 protects. DOCX export uses Calibri and Cambria from the rubric's own list.
- **A-GATE.** Text under 6pt, or within delta-E 10 of every surface it could sit on, zeroes the
  score and blocks PDF and Word export. Grounds and filled boxes count as surfaces, so light text
  on a dark band is not flagged.
- **Dictionary.** Hand-curated, about 300 skills with acronym aliases. Short and everyday-word
  aliases (Go, R, C, Express, Swift) match case-sensitively; a single letter also refuses a
  following hyphen or ampersand, so R&D and C-suite are not languages. Never stemmed, never fuzzy.
- **Fallback bucket.** A regular-expression tokeniser and a small suffix stripper, applied to the
  fallback terms only, stand in for `natural`.
- **Gating on resume type.** An academic CV may run to six pages and 4,000 words under A7 and D7.
- **D7 copy.** The 400-word floor is advice, not a verdict: a short one-page resume is told there is
  room for more evidence, never that it is thin, since the editor may already report it full.
