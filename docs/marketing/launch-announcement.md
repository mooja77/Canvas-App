# QualCanvas — Launch Announcement Kit

Three audience-cut versions of the same announcement. Pick the one that fits the venue; don't post the same copy in all three places — academics will notice.

---

## V1 — Show HN (140 char title + 300 word body)

**Title:**

> Show HN: QualCanvas – a visual canvas for qualitative coding (alternative to NVivo / Atlas.ti)

**Body:**

I built QualCanvas because every qualitative-research tool I tried looked like it had given up on visual design around 2009. NVivo, Atlas.ti, MAXQDA — all powerful, all institutionally priced ($100s/seat/year), all painful to recommend to grad students or independent researchers.

QualCanvas is a web-based, visually-oriented qualitative coding environment. You import interview transcripts, highlight passages, attach codes, and the relationships between codes + transcripts + cases render as a live React Flow canvas. 10 analysis surfaces are built in (frequency, co-occurrence, intercoder reliability via Cohen κ + Krippendorff α, code weighting, code maps, etc.).

What's actually different:

- **Canvas-first IA.** Codes, transcripts, cases, and analyses are nodes on a workspace, not buried 4 tabs deep.
- **Bring-your-own-AI key.** Auto-coding suggestions are gated behind your own OpenAI / Anthropic / Google key — your transcripts never touch our servers for inference. Cost is yours, transparency is yours.
- **Methods Statement export.** Generates an academically-citable summary of every coding decision + reliability score, ready to drop into a thesis methods chapter.
- **Free tier is genuinely usable.** 1 canvas, 2 transcripts, 5K words, 5 codes. Pro is $12/mo, Team is $29/seat/mo, 40% academic discount.

Stack: React 18 + Vite, Express + Prisma + Postgres, Tailwind, React Flow, i18next (en/es/fr/de). Hosted on Railway (US) + Cloudflare Pages.

Trust + privacy page: https://qualcanvas.com/trust
Pricing: https://qualcanvas.com/pricing

Happy to answer questions on the architecture, the LLM cost model, the intercoder reliability math, or the academic GTM.

---

## V2 — r/AskAcademia / r/PhD post (no title, conversational)

I've been building a qualitative coding tool for the past few months and just shipped the public version. Wanted to share it here because the qual-research community has been the loudest about needing alternatives to NVivo / Atlas.ti / MAXQDA — the existing tools are expensive, slow to learn, and the UX feels like it was last updated in 2014.

It's called QualCanvas (qualcanvas.com). The TL;DR for what's different:

1. **Canvas-first.** Your transcripts, codes, cases, and analyses are nodes on a workspace, not a 7-tab interface. You can actually see the structure of your study.
2. **Bring-your-own AI key.** If you want auto-coding suggestions, you paste in your own OpenAI / Anthropic / Google key. The transcripts go straight from your browser to that vendor — we don't proxy or store the content. You get to choose your model, you pay the actual API cost (cents), and there's no rent-seeking middle layer.
3. **Real reliability math.** Cohen κ for 2 coders, Krippendorff α + Fleiss κ for 3+, plus per-code agreement breakdown. (Most competitors treat this as a Pro-tier feature; we put it on Team but the math itself is open in the audit trail.)
4. **Methods Statement export.** One-click generates an academically-citable summary of every coding decision + reliability score + coder roster — ready to drop into a thesis methods chapter.
5. **Free tier is usable** (1 canvas, 2 transcripts, 5K words, 5 codes). Pro is $12/mo. 40% off for .edu emails.

Things I'd genuinely like feedback on:

- Is the canvas IA actually intuitive once you have ~20+ codes? I find it gets crowded; we have auto-layout but it's not magical yet.
- What's the killer reliability metric for your field? We have κ + α + Fleiss; should we add something else?
- For published-paper users — what would make the Methods Statement export accepted by your committee / reviewers more easily?

Open to DMs from anyone who wants a free Pro account for 3 months to kick the tyres + tell me what's broken. Also reachable at feedback@qualcanvas.com.

---

## V3 — Substack / personal-blog launch (long-form)

### Title

> I built the qualitative coding tool I wished existed in grad school

### Subtitle / Lede

QualCanvas is a visual, browser-based alternative to NVivo and Atlas.ti. It's $12/month, 40% off for academic emails, and your transcripts never leave your browser when you use auto-code.

### Body

In 2018 I was a research assistant on a study with 40 interview transcripts that needed thematic coding. We had a budget for software, so we bought NVivo. Three days into onboarding, the lead PI quit using it and went back to a colour-coded Word doc. The transcripts were one tab, the codebook was another, the analyses were three more — and you couldn't see the actual structure of the study without printing things out and arranging them on the floor.

QualCanvas is the tool I wished we'd had.

**It is a canvas.** Everything is a node — transcripts, codes, cases, themes, analyses. Relationships are edges. You can see your study.

**It is fast.** It is a modern React app built on a real database. There is no syncing, no project file corruption, no "rebuilding index" dialog that hangs for 90 seconds.

**It is honest about AI.** I think most "AI for qualitative research" tools today are dangerous — they upload your interview content to a vendor's server and run a prompt over it without consent from your participants or your IRB. QualCanvas does the opposite: if you want AI coding suggestions, you paste in your own API key, and the calls go directly from your browser to the model provider. We never proxy. We never store the transcript content for inference. You can review every prompt, every response, every coding decision in the audit trail.

**It is built for academic outputs.** The Methods Statement export generates a citable summary of every coding decision, every coder, every reliability score (Cohen κ, Krippendorff α, Fleiss κ). It is ready to drop into a thesis methods chapter or a journal submission.

**It is fairly priced.** Free tier (1 canvas, 2 transcripts, 5K words) is usable for a small pilot. Pro is $12/month — about a tenth of what NVivo costs annually for a personal license. Team is $29/seat/month with unlimited shares + intercoder reliability. 40% off for .edu emails via Stripe.

### What's next

The next three months: institutional features (SSO, EU region), more analysis surfaces (sentiment, narrative arc), and a coaching package for departments adopting the tool at scale.

### Try it

[qualcanvas.com](https://qualcanvas.com) — sign up is email or Google, no credit card. The demo login `CANVAS-DEMO2025` gets you a pre-loaded canvas with a real study so you can poke at it without uploading your own data first.

If you're a researcher, methodologist, or grad student, I would love your feedback. The fastest way to reach me is feedback@qualcanvas.com.

---

_Posted on launch day. The pricing-page URL and Trust page are stable; copy can be updated without re-syndicating._
