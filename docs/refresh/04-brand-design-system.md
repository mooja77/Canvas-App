# 4. Brand & design system

← [Plan index](README.md)

This is the system every page draws from. Concrete tokens, type, motion, color, voice.

## 4.1 Color tokens (with role mapping)

Tier 2 (`ink_ochre_palette` flag, currently in `tailwind.config.js`) gives us nine stops of Ink and nine stops of Ochre. We bind those to **semantic roles** so individual components don't reach for raw stops.

**Light mode**

| Role            | Token           | Hex                      |
| --------------- | --------------- | ------------------------ |
| `bg.page`       | `ink.50`        | `#F4F6F8`                |
| `bg.card`       | `white`         | `#FFFFFF`                |
| `bg.inset`      | `ink.100`       | `#E5E9EF`                |
| `fg.primary`    | `ink.900`       | `#0B1530`                |
| `fg.secondary`  | `ink.700`       | `#22304A`                |
| `fg.muted`      | `ink.500`       | `#475569`                |
| `fg.subtle`     | `ink.400`       | `#6A7891`                |
| `rule.hairline` | `ink.200` @ 50% | rgba(199, 206, 217, 0.5) |
| `accent`        | `ochre.500`     | `#B7841F`                |
| `accent.hover`  | `ochre.600`     | `#956914`                |
| `accent.muted`  | `ochre.100`     | `#F5E9CC`                |
| `focus.ring`    | `ochre.400`     | `#CC9C3A`                |

**Dark mode (designed, not inverted)**

| Role            | Token             | Hex                   |
| --------------- | ----------------- | --------------------- |
| `bg.page`       | `ink.950`         | `#050B1F`             |
| `bg.card`       | `ink.900`         | `#0B1530`             |
| `bg.inset`      | `ink.800`         | `#16213D`             |
| `fg.primary`    | `ink.100`         | `#E5E9EF`             |
| `fg.secondary`  | `ink.200`         | `#C7CED9`             |
| `fg.muted`      | `ink.300`         | `#9CA7B9`             |
| `fg.subtle`     | `ink.400`         | `#6A7891`             |
| `rule.hairline` | `ink.700`         | `#22304A`             |
| `accent`        | `ochre.300`       | `#DDB761`             |
| `accent.hover`  | `ochre.200`       | `#EBD295`             |
| `accent.muted`  | `ochre.900` @ 40% | rgba(54, 36, 12, 0.4) |
| `focus.ring`    | `ochre.400`       | `#CC9C3A`             |

**Ochre discipline.** Ochre is the editor's pencil. It appears only at _decisions_:

- The 1px rule above an H1.
- The vertical bar on a pull quote.
- The primary CTA fill.
- The focus ring.
- The underline on the current chapter in `/methodology` TOC.

Anything else gets ink scale. Three rules: ochre never fills a card. Ochre never colors body copy. Ochre never tints images.

## 4.2 Type ramp

Self-host **Fraunces** (variable) — currently `@import`-ed from Google in `brand-v2.css:15`, which costs us a CLS hit. Move to a local `woff2` with `font-display: swap`, `size-adjust`, `ascent-override`, `descent-override` to nail zero-CLS, and `font-feature-settings: "ss01", "ss02"`. Inter is already self-hostable.

| Token        | Family          | Desktop / Mobile | Weight                   | Tracking | Leading |
| ------------ | --------------- | ---------------- | ------------------------ | -------- | ------- |
| `display-xl` | Fraunces        | 88 / 56          | 540 (light) / 460 (dark) | -2%      | 1.05    |
| `display-lg` | Fraunces        | 64 / 44          | 560 / 480                | -1.5%    | 1.10    |
| `display-md` | Fraunces        | 48 / 36          | 580 / 500                | -1%      | 1.15    |
| `h1`         | Fraunces        | 40 / 32          | 600                      | -0.5%    | 1.20    |
| `h2`         | Fraunces        | 30 / 26          | 600                      | 0        | 1.30    |
| `h3`         | Inter           | 22 / 20          | 600                      | 0        | 1.35    |
| `body-lg`    | Inter           | 19 / 18          | 400                      | 0        | 1.65    |
| `body`       | Inter           | 17 / 16          | 400                      | 0        | 1.60    |
| `body-sm`    | Inter           | 15 / 14          | 400                      | 0        | 1.55    |
| `eyebrow`    | Inter           | 13 / 12          | 600                      | +8%      | 1.20    |
| `mono-meta`  | Inter           | 14 / 13          | 500                      | +2%      | 1.40    |
| `pull-quote` | Fraunces italic | 28 / 22          | 500                      | -0.5%    | 1.40    |
| `caption`    | Inter italic    | 14 / 13          | 400                      | 0        | 1.50    |

**Fraunces variable axes locked:**

- `opsz` matches the size token (88 → ~144, 17 → 9).
- `SOFT` = 50 (slight roundness, not full).
- `WONK` off for prose, on only for the wordmark and `display-xl` hero.

**Body measure:** 640px max for prose (`/methodology/*`), 720px for marketing copy.

## 4.3 Spacing scale

Eight-point scale, named by role for legibility in design discussions:

| Token           | px  | Use                                                              |
| --------------- | --- | ---------------------------------------------------------------- |
| `space.hair`    | 1   | Rules                                                            |
| `space.tight`   | 4   | Inline chip padding                                              |
| `space.snug`    | 8   | Stack between related lines                                      |
| `space.cozy`    | 12  | Card inner gap, inline-button padding                            |
| `space.body`    | 16  | Default paragraph spacing                                        |
| `space.section` | 24  | Between paragraphs in flow                                       |
| `space.gap`     | 40  | Between sibling sections                                         |
| `space.rest`    | 64  | Section breathers                                                |
| `space.silence` | 120 | Major page-section pause (after hero, before CTA)                |
| `space.vast`    | 200 | Editorial breathing room (only on `/methodology` chapter starts) |

`space.silence` and `space.vast` are the editorial choices that separate this from typical SaaS density. Use sparingly.

## 4.4 Motion vocabulary

Seven motion moments. Most pages should use 2–3, not all.

1. **Hero word-stagger reveal** — display headline reveals word-by-word, 40ms stagger, opacity 0→1, y +6px → 0, cubic-bezier(0.22, 1, 0.36, 1), 320ms each. Once per page-load.
2. **Counter roll-up** — stat blocks, 0 → value over 900ms, ease-out-expo. Skip under `prefers-reduced-motion`.
3. **Hairline draw-in** — the 1px ochre rule above an H1 or pull quote, `width: 0` → `width: 48px` over 240ms when entering viewport.
4. **Card lift on hover** — translate-y -2px, shadow softens, 180ms ease-out.
5. **Pull-quote ochre-rule grow** — left vertical rule grows `height: 0` → `100%` over 360ms; text fades in 120ms after.
6. **View Transitions API** between `/methodology/*` chapters and inter-story navigation on `/customers/*`. Title cross-fades, body slides 24px in nav direction. Native browser support; graceful fallback.
7. **FLIP tab underline glide** — on `/changelog` filter or `/customers` filter, active underline slides between tabs over 220ms cubic-bezier(0.4, 0, 0.2, 1).

**Forbidden:** scroll-jacked sections, parallax, marquee logo walls, particle backgrounds, frosted-glass navs.

**`prefers-reduced-motion`:** scroll-driven animations degrade to static stack; counter roll-up skips to final value; hairline draw-ins appear instantly; word-stagger collapses to a single fade.

## 4.5 Iconography & imagery

**Icons.** Heroicons (already installed via `@heroicons/react`) at 1.5 stroke weight, never filled. One exception: the QualCanvas logo glyph (the four-point sparkle), which stays as-is.

**Imagery direction.**

- Product screenshots: real (sample) canvas state, with real-feeling activity log entries ("Maya, added code 'identity-as-resistance', 2m ago"). Linear's signature credibility move.
- Photography: muted, ink-cast, never stock. If we don't have authentic photos of researchers in offices, we don't ship a section that needs them.
- Illustration: zero. Editorial illustration dilutes the type-as-hero discipline.

**Dark mode image treatment.** Apply `filter: saturate(0.92) brightness(0.96)` to screenshots in dark mode.

## 4.6 Voice & tone — rules

The current `landing.heroTitle` is `"Code transcripts on a visual canvas —"` and `landing.heroDescription` opens with `"QualCanvas is a drag-and-drop workspace for…"`. That's functional but generic. The new register is editorial-academic.

**Three rules.**

1. **No exclamation points.** Anywhere. (Dedoose's hero has them. They read as 2017.)
2. **No "powerful," "intuitive," "seamless," "modern," "robust," "world-class," "next-generation," "enterprise-grade."** These signal absence of an actual claim.
3. **Specificity over adjectives.** "Code 800 interviews in six weeks" beats "powerful enough for any project."

**Voice character.** Confident, plain, methodologically literate. Reads like a senior PhD student writing for their committee, not a growth marketer writing for VCs.

**Sentence shape.** Short and long alternate. Lists are short. Em-dashes earn their keep — they don't decorate.

## 4.7 Copy bank — draft strings for every primary surface

These are _drafts_. A copywriter / methodologist will improve them. They are concrete enough to build with and clear enough to argue with.

### Landing `/`

**Hero**

- Eyebrow: `A QUALITATIVE WORKSPACE`
- H1 (Fraunces display-xl, 2 lines): `Code interviews like you think. Visually.`
- Sub (Inter 19px): `QualCanvas is a visual workspace for coding transcripts, finding themes, and writing memos you can defend in front of a committee.`
- Primary CTA: `Start free`
- Secondary CTA: `See the method →`
- Microcopy: `No credit card. Free forever for basic use.`

**Numbered workflow strip**

- 1.0 Import — `Bring transcripts, field notes, and consent letters into one canvas. PDF, DOCX, audio, video.`
- 2.0 Code — `Highlight a span, name a code. Move it. Merge it. Split it. The way real coding actually goes.`
- 3.0 Theme — `Drag codes into the patterns you're seeing. Watch the codebook breathe.`
- 4.0 Memo — `Tie a memo to a span, a code, a theme, or a case. Reflexivity lives in the margins.`
- 5.0 Export — `Out to QDPX for NVivo and ATLAS.ti. Or to PDF. Or to your institution's preservation archive.`

**Bento (6 tiles)**

- Auto-code: `Apply patterns across hundreds of transcripts in seconds. Review every match before it lands. The model assists; you decide.`
- Intercoder κ: `Cohen's κ and Krippendorff's α — calculated live as your team codes. Methods-paper-ready CSV export included.`
- Ethics & consent: `Track consent, set retention windows, anonymize fields. The audit trail your IRB will ask for is already running.`
- Cases & cross-case: `Group transcripts into cases. Compare coding across them in a framework matrix that updates as you code.`
- 12 live analyses: `Word cloud, co-occurrence, clustering, sentiment, treemap, framework matrix, and more — computed as you change the data, not before.`
- Export QDPX: `Take everything to NVivo or ATLAS.ti if you need to. Or hand a clean PDF to your committee. No lock-in by design.`

**Stats strip**

- `12` — `analysis tools`
- `50,000` — `words per transcript`
- `40%` — `discount on .edu`

**Case study card (one)**

- Eyebrow: `CASE STUDY`
- Headline: `How [Lab name] coded 22 caregiving interviews in six weeks`
- 2-line tease: `[Method, N, outcome]`
- CTA: `Read the story →`

**Testimonials (three, draft pattern — to be replaced with real once sourced)**

- `"The Kappa export saved me a methods-section argument with reviewer 2." — Dr. K., postdoc, social work`
- `"My students stopped asking me about NVivo." — Prof. M., methods course lead`
- `"I cited QualCanvas in my dissertation methodology and my advisor didn't blink." — Maya, PhD candidate, sociology`

**Pricing teaser headline**

- `Free to start. Paid when your dissertation gets serious.`

**FAQ (five questions, drafted)**

- **What is qualitative coding?**
  _A research method where you label segments of qualitative data — interview transcripts, field notes, open-ended survey responses — to identify themes and build theory. It's the foundation of methods like thematic analysis, grounded theory, and IPA._
- **Who is QualCanvas for?**
  _Qualitative researchers and graduate students working on theses or papers, research labs running multi-coder studies, and UX teams running longitudinal research. If your method has a name with a hyphen in it — cross-case, in-vivo, semi-structured — you're our audience._
- **How is this different from NVivo or ATLAS.ti?**
  _Three things. (1) Pricing is on this page; theirs isn't. (2) Your codes, transcripts, and themes live on a visual canvas you can see all at once — not behind menus. (3) You can export to QDPX whenever you want. No lock-in._
- **Is my research data secure? Are you training a model on my transcripts?**
  _Yes; no. TLS 1.3 in transit, AES-256 at rest, EU and US residency options. Your transcripts are never used to train any model — by us or by the model provider. The full posture is on `/trust` and the AI-specific policy is on `/trust/ai`._
- **How do I cite QualCanvas in a paper?**
  _BibTeX, APA, and Chicago entries on `/cite`. Send it to your advisor._

**Closing CTA stripe**

- Headline: `Start coding. Free.`
- Sub: `No credit card. .edu discount automatic. Cancel any time.`
- CTA: `Start free`

### `/pricing`

- Eyebrow: `PRICING`
- H1: `Pricing.`
- Sub: `Start free. Upgrade when your dissertation does.`
- `.edu strip`: `40% off Pro and Team with a .edu email. Applied automatically at checkout.`
- Comparison row eyebrow: `HOW WE COMPARE`
- Comparison row sub: `Prices as published by each vendor on [date]. We link the source.`
- Money-back: `30-day money-back guarantee. Email us and we'll refund the last charge — no form, no script.`

### `/methodology` index

- Eyebrow: `A SHORT FIELD GUIDE`
- H1: `Doing qualitative research with QualCanvas.`
- Sub: `Six chapters · roughly 45 minutes · updated monthly.`
- Closing line: `New chapter monthly. Subscribe via RSS.`

### `/customers` index

- Eyebrow: `RESEARCH STORIES`
- H1: `What researchers do with QualCanvas.`
- Sub: `Real labs, real methods, real artifacts. Anonymized when participants need it.`

### `/for-teams`

- Eyebrow: `FOR RESEARCH GROUPS`
- H1: `Code together. Disagree productively. Ship the paper.`
- Sub: `Shared codebooks, intercoder reliability calculated live, audit trails for the IRB — for research groups, methods courses, and labs.`
- Primary CTA: `Start your team trial`

### `/for-institutions`

- Eyebrow: `FOR INSTITUTIONS`
- H1: `Department-wide qualitative research, without forking your IT review.`
- Sub: `SSO and SCIM, custom retention windows, DPA, BAA, dedicated research-desk contact. Procurement-ready, IRB-friendly.`
- Primary CTA: `Book a 20-minute call`

### `/trust`

- Eyebrow: `TRUST & SECURITY`
- H1: `Research-grade data handling. By design.`
- Sub: `QualCanvas is built for the data your IRB cares about most: participant transcripts, sensitive themes, audit trails.`
- Transparent-admission paragraph (Linear move): `We don't yet hold ISO 27001. We're targeting it in 2027. Our SOC 2 Type II is current as of [date]. We publish every sub-processor and our incident history.`

### `/trust/ai`

- Eyebrow: `AI USE POLICY`
- H1: `Where AI is in QualCanvas — and where it isn't.`
- Sub: `Three things every researcher and IRB asks. Direct answers, with the architecture to back them up.`
- Three Q&A:
  - _Are my transcripts being used to train a model?_
    _No. Inference requests go directly from your account to the provider you choose (OpenAI, Anthropic, Google). QualCanvas does not proxy them, store them beyond the session, or send them to any other vendor. The model providers we support contractually exclude API traffic from training; we link to each provider's policy below._
  - _What does QualCanvas use AI for?_
    _Three things: auto-code suggestions, theme summarization, and framework synthesis. All three are opt-in per project, and every AI output is reviewable and reversible. We never silently apply codes._
  - _Who can see the AI's responses?_
    _Only the user who triggered them. AI activity is logged in the project audit trail (which model, which prompt summary — never the transcript content — and the user's decision to accept or reject)._

### `/colophon`

```
COLOPHON

This site is set in Fraunces (Undercase Type) and Inter (Rasmus Andersson). The two
colors are Ink — the deepest blue we could find without making it black — and Ochre,
a single warm gold that appears only at decisions: a heading rule, a focus ring, a
primary action.

Built with React, Vite, and Tailwind. Deployed on Cloudflare Pages. Designed and
built by JMS Dev Lab in Ireland — a studio that builds custom software for
businesses too unique for off-the-shelf tools.

Accessibility: we target WCAG 2.2 AA across all marketing pages. The interactive
coding demo is fully keyboard-navigable. Motion respects prefers-reduced-motion.
A formal accessibility statement is available at /accessibility-statement.

Performance budget for marketing pages: < 80 KB JS, < 30 KB CSS, LCP under 1.2s on 4G.
We test on a four-year-old Pixel and an iPhone SE.

Last reviewed: [date].
```

### `/cite`

- Eyebrow: `CITATION`
- H1: `How to cite QualCanvas.`
- Sub: `Pick a format. Copy. Paste into your manuscript.`
- Tabs: `BibTeX · APA · Chicago · RIS`

### `/vs/[competitor]`

- Eyebrow: `COMPARISON`
- H1 pattern: `QualCanvas vs. [Competitor]`
- Sub: `An honest comparison. Updated [month] [year]. We cite each claim.`
- Section H2s (every comparison page uses the same six):
  1. Quick verdict
  2. Pricing
  3. Where [competitor] is better
  4. Where QualCanvas is better
  5. Migration path
  6. FAQ

## 4.8 Writing rules for any new copy

- **One claim, one citation.** If a sentence makes a competitive claim, footnote or hyperlink the source. Especially on `/vs/` pages and on the comparison row of `/pricing`.
- **Active voice unless passive is honest.** "We back up your data weekly" beats "data is backed up weekly."
- **Names, not roles.** Where a story names a person and institution, name them — never "a researcher at a top university."
- **Numbers, not adjectives.** "22 interviews" beats "many interviews."
- **Verbs do work.** Headlines start with the verb where they can. "Code together" not "Collaboration features."
- **No "we believe."** State the position. The fact that we believe it is implied.

## 4.9 Component states matrix

Every interactive primitive needs five states defined; some need seven. This is the contract a developer can build against without ambiguity.

| Component         | Default                                 | Hover                                      | Focus-visible              | Active / pressed                     | Disabled                   | Loading                        | Error                 |
| ----------------- | --------------------------------------- | ------------------------------------------ | -------------------------- | ------------------------------------ | -------------------------- | ------------------------------ | --------------------- |
| Primary CTA       | `accent` bg, ink-900 fg                 | `accent.hover` bg, scale 1.01              | 2px ochre ring, 2px offset | scale 0.99                           | `ochre.200` bg, ink-400 fg | spinner replaces label         | shake 200ms + toast   |
| Secondary CTA     | transparent, ink-700 fg, ink-300 border | `ink.50` bg                                | ochre ring                 | `ink.100` bg                         | ink-300 fg                 | n/a                            | toast only            |
| Tier card         | white bg, ink-200 border                | translate-y -2px, shadow 0 8px 24px ink/10 | ochre ring on card         | n/a                                  | n/a                        | skeleton (same shape)          | n/a                   |
| Demo span         | underline on hover                      | underline thickens to 2px                  | ochre ring around span     | selected: ochre-100 bg, ink-700 fg   | n/a                        | n/a                            | n/a                   |
| Demo code chip    | `ochre.100` bg, ink-700 fg              | `ochre.200` bg                             | ochre ring                 | applied: ink-900 bg, white fg        | n/a                        | n/a                            | n/a                   |
| Codebook entry    | row + code color dot                    | `ink.50` bg                                | ochre ring                 | expanded shows span count            | n/a                        | n/a                            | n/a                   |
| Pull quote        | Fraunces italic, ochre vertical rule    | n/a                                        | n/a                        | n/a                                  | n/a                        | n/a                            | n/a                   |
| Chapter prev/next | Inter, hover ochre underline            | underline appears                          | ochre ring                 | n/a                                  | end of nav: muted          | n/a                            | n/a                   |
| Comparison cell   | Inter 16px, ink-700 fg                  | n/a (decorative)                           | n/a                        | n/a                                  | n/a                        | n/a                            | n/a                   |
| FAQ accordion     | summary closed, hairline above          | `ink.50` bg on summary                     | ochre ring                 | chevron rotated, body visible        | n/a                        | n/a                            | n/a                   |
| Theme toggle      | 3 icons, current outlined               | ochre on icon hover                        | ochre ring                 | current pressed                      | n/a                        | n/a                            | n/a                   |
| Pricing toggle    | `ink.100` track, ochre slider           | n/a                                        | ochre ring                 | slider slides                        | n/a                        | n/a                            | n/a                   |
| Customer card     | image + overlay                         | translate-y -2px, shadow                   | ochre ring on card         | n/a                                  | n/a                        | skeleton matching final aspect | n/a                   |
| Citation tab      | Inter caps, ink-500                     | `ink.50` bg                                | ochre ring                 | active: ink-900 fg + ochre underline | n/a                        | n/a                            | n/a                   |
| Copy-to-clipboard | Inter 13px ochre                        | underline                                  | ochre ring                 | "Copied." for 1.5s                   | n/a                        | n/a                            | "Couldn't copy" toast |

**Universal rules.**

- `outline: 2px solid var(--focus-ring)` with `outline-offset: 2px`. **Never** `outline: none`.
- Hover transitions: 180ms; color-only transitions: 120ms.
- Disabled buttons get `cursor: not-allowed` and `aria-disabled="true"`.
- Loading skeletons have exactly the same dimensions as final content (zero CLS).
- Error states use ink-bg toast in the top-right, NOT a colored border on the input — borders are visually noisy in editorial layouts.
- Every state must pass contrast in BOTH light and dark mode. Test both before considering a state shipped.
