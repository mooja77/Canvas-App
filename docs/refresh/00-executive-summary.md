# 0. Executive summary

← [Plan index](README.md)

## What we're building

A six-to-seven-week refresh of the QualCanvas marketing site, executed in five shippable phases. Each phase ends in a deployable state — no big-bang launch, no broken middle ground. The destination is a site that sits visually between **Pitch** (editorial confidence) and **Raycast** (craft tier) with **Overleaf**'s institutional credibility — well above NVivo / ATLAS.ti / Dedoose / MAXQDA, all of which are documented as visibly behind (see [01](01-strategic-positioning.md) §1.3 and [19](19-appendix.md)).

## The single insight that organizes everything

**Every QDA competitor markets the tool. We market the method.** Linear didn't win developer-tool marketing by listing features — they wrote `linear.app/method`, six numbered chapters of opinionated engineering doctrine. We do the equivalent for qualitative research: a real, written, illustrated methodology guide that researchers will cite in advisor emails. Delve has tried this and stayed shallow; nobody else has tried at all. This is the moat.

## The seven highest-leverage moves

1. **Build `/methodology` as six numbered chapters** in Linear Method's structure.
2. **Embed an interactive coding micro-demo above the fold** — highlight a sample transcript, see a code chip appear, codebook updates live. Persisted in IndexedDB so refresh keeps it. None of the six competitors has anything like this.
3. **Show real pricing on the page.** Only Dedoose currently does. Ours is $0 / $12 / $29 plus stated 40% .edu — clean and the inverse of NVivo / ATLAS.ti / MAXQDA opacity.
4. **Publish `/vs/nvivo`, `/vs/atlas-ti`, `/vs/dedoose`** — sober, sourced comparison pages. Captures `"nvivo alternative"` and `"atlas.ti alternative"` search intent the competitors won't write themselves.
5. **Activate Tier 2 brand** (Ink + Ochre, Fraunces + Inter) — already shipped behind flags; promote to default on marketing routes only. Editorial register.
6. **Stripe-style `/trust` page** with What / How / Benefit triad, three compliance tiles, transparent admissions. ATLAS.ti `/security` and Lumivero `/trust` both 404 today — the bar is on the floor. Plus a dedicated `/trust/ai` answering the researcher's most acute fear: are my transcripts being used to train an LLM?
7. **Discreet "Built by JMS Dev Lab →" footer** linking to jmsdevlab.com/apps.html#qualcanvas (which already showcases QualCanvas back). Closes the loop. No banners.

## What we're explicitly not doing

WebGL hero, particle effects, custom cursors, scroll-jacking, founder photos, gradient blob meshes, illustrated cartoon mascots, exclamation marks in headlines, "Jane Doe" placeholder testimonials (a real Lumivero failure mode, see [19](19-appendix.md)), pricing badges that say "Most Popular" (Linear pricing doesn't use one — confidence sells in 2026).

## Cost shape

Roughly 6–7 focused weeks for one person; less if work is parallelized. Most of the cost is content (case studies, methodology chapters, /vs/ pages) and the interactive demo. Pure visual refresh is fast.
