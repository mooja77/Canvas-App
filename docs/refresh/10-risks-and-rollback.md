# 10. Risk register + rollback plan

← [Plan index](README.md)

## 10. Risk register

| #   | Risk                                                                      | Likelihood               | Impact                     | Mitigation                                                                                                                                                |
| --- | ------------------------------------------------------------------------- | ------------------------ | -------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| R1  | Tier 2 contrast fails WCAG somewhere on first flip                        | High                     | Medium                     | Phase 1 contrast audit before flip; have rollback flag                                                                                                    |
| R2  | Re-shooting guide screenshots blocked by app not on Tier 2                | High                     | Medium                     | Either ship app Tier 2 first, or sequence guide refresh to Phase 3 end and accept short inconsistency                                                     |
| R3  | Real case study sourcing fails (<3 yeses from 15 outreach)                | Medium                   | High (delays Phase 3)      | **Start outreach at Phase 1 day 1, not Phase 3.** Have 2 well-labeled "worked example" cases ready as backup                                              |
| R4  | Methodology chapters not written in time                                  | Medium                   | High                       | Founder/internal v1 with disclosed authorship; outsource refinement later. Chapter outlines in [08 §8.5](08-content-strategy.md) mean no planning blocker |
| R5  | Legal sign-off on new `/trust`, `/terms`, `/trust/ai` delayed             | Medium                   | High                       | Start legal review at Phase 1; ship visual refresh without copy changes if needed; keep current `/trust` content as fallback                              |
| R6  | Stripe Price IDs forgotten on `/pricing` (`VITE_STRIPE_*` env vars)       | Medium                   | Critical (checkout breaks) | Phase 2 acceptance test (Phase 2 task 5): complete real checkout in staging for all 4 tier/cadence combos                                                 |
| R7  | OG image still broken at launch (file missing per `index.html:13`)        | High → mitigated Phase 1 | High                       | Phase 1 task 9 builds + uploads static OG; Phase 4 adds dynamic                                                                                           |
| R8  | Prerender CSS drifts from Tier 2 → bots see stale markup                  | Medium                   | Medium                     | Either bake a generator script in Phase 1 or punt to SSG ([05 §5.4](05-component-inventory.md)); document in PR review checklist                          |
| R9  | Interactive demo blows out timeline                                       | Medium                   | High                       | Phase 4-scoped, not Phase 2; if cut, plan is still world-class minus one tier                                                                             |
| R10 | Guide re-shoot while app refresh is in flight breaks both                 | Low–Medium               | Medium                     | Defer guide refresh to after app Tier 2 cutover; communicate dependency early                                                                             |
| R11 | JMS Dev Lab `/apps.html#qualcanvas` anchor doesn't exist as expected      | Low                      | Low                        | Verify anchor at Phase 1; coordinate with JMS Dev Lab maintainer to ensure section id matches                                                             |
| R12 | Logo-wall logos used without explicit permission                          | Medium                   | High (legal)               | Only show logos with written permission per institution; placeholder gracefully until ≥ 4 secured                                                         |
| R13 | Methodology copy is read as light-touch by experts → reputation cost      | Medium                   | High                       | Each chapter peer-reviewed by a credentialed researcher before publish                                                                                    |
| R14 | `/trust/ai` published claim becomes wrong if architecture changes         | Medium                   | Medium                     | Publish as principles (not exact model list). Architecture-promise reviewed quarterly.                                                                    |
| R15 | `/vs/[competitor]` pages get stale or attract legal letters               | Medium                   | Medium                     | Footer date + "Reviewed quarterly." Sourced claims only. No competitive trash-talk. Defamation review by legal before publish.                            |
| R16 | SSG migration introduces hydration bugs late in Phase 4                   | Medium                   | Medium                     | Tag SSG as a Phase 4 stretch goal, not a critical path item. Keep SPA fallback ready.                                                                     |
| R17 | Email outreach to users for case studies feels intrusive                  | Low                      | Low–Medium                 | Honorarium offered. Frame as "would you tell our other users about your work." Easy opt-out.                                                              |
| R18 | MDX schema drift over time breaks old content                             | Low                      | Medium                     | Zod schemas migrate forward only; version frontmatter; build-time validator catches breaks.                                                               |
| R19 | Phase 5 launch causes signup conversion regression                        | Medium                   | High                       | Rollback plan in §10.1; flag-gated; soft-launch first.                                                                                                    |
| R20 | Press kit assets shipped without permission for sample testimonial quotes | Low                      | High                       | Explicit written permission documented per quote before publish.                                                                                          |

## 10.1 Rollback plan

If Phase 5 launch goes badly — Lighthouse drops below baseline, signup conversion drops >10%, accessibility complaints, anything visible to users — we want a < 10-minute rollback path.

**Immediate rollback (<10 min).**

1. Push a hotfix flipping `ink_ochre_palette` and `fraunces_display` flag defaults back to `false` in `featureFlagsStore.ts`. PR auto-merges with `[hotfix]` label, bypasses normal review.
2. Cloudflare Pages production deploy picks up the change in ~2 min.
3. Verify on `qualcanvas.com` that the site has returned to indigo + Inter rendering.

**Per-user emergency override** (for users in the middle of a flow who report breakage):

- `?flags=ink_ochre_palette=false,fraunces_display=false` URL params — already supported by `featureFlagsStore` (per the internal audit, `applyUrlFlagOverrides()` called in `main.tsx`).
- Communicated via support email if needed.

**Communicate.**

- Post in #ops Slack with the symptom and the rollback action.
- Update the soft-launch testers within 30 min.
- If conversion dropped, draft a private post-mortem within 24 hours.

**Triage path.**

- **Bug is visual.** Revert the offending PR, keep flags off, ship the fix in next cycle.
- **Bug is functional** (demo broken, checkout broken). Revert immediately; investigate before re-flipping.
- **Bug is analytics-only** (event not firing). Keep flags on, fix the event in a follow-up.

**Phase 5 success criteria for _not_ rolling back:**

- Lighthouse Performance ≥ 90 on `/` (target was 95; this gives 5 points of headroom).
- Signup conversion within ±15% of pre-launch baseline.
- Zero accessibility complaints in first 7 days.
- No P0 / P1 errors in production Sentry.
- No regressions in Stripe checkout (verified via daily check of completed-checkout count vs. `signup_started` events).

**Re-launch protocol if rollback happens.**

- Root-cause analysis documented before re-flip.
- Soft-launch group expanded to 30 users.
- 7-day observation window.
- Default-on flip only after all four success criteria above are clear.
