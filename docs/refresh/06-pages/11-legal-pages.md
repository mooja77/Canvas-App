# 6.10 + 6.16 Legal pages: `/privacy`, `/terms`, `/cookies`, `/accessibility-statement`

← [Pages index](README.md) · [Plan index](../README.md)

## 6.10 `/privacy`, `/terms`, `/cookies`

**Current state.** Privacy 168 lines, Terms 43 lines (too thin), Cookie 128 lines. All English-only (no `useTranslation()` call).

**Changes.**

- Apply Tier 2 styling.
- Wire `useTranslation()` — or scope EN-canonical explicitly with a banner ("Legal text is canonical in English; translations are informational"). Decision in [12](../12-open-decisions.md) #4.
- Extend Terms to a real document: research-conduct clauses, data-deletion guarantee, API ToS, institutional customer terms. Co-edit with legal.
- Verify `/legal/dpa.md` link (TrustPage:182) resolves; build the DPA preview page.

## 6.16 `/accessibility-statement`

**Intent.** Required reading for many `.edu` and `.gov` procurement processes. Also a small public-good signal.

**Content.**

- WCAG 2.2 AA targeted across all marketing pages.
- Conformance level claimed (target: AA; document any AAA where it lands).
- Known limitations: name them honestly (e.g., _"The canvas workspace itself has known keyboard-navigation gaps in zoom/pan; targeted Q3 2026."_).
- Contact: `accessibility@qualcanvas.com` for accessibility feedback.
- Testing: list the tooling (axe-core, NVDA, VoiceOver) and the human reviewers.
- Last reviewed date.

**Length.** ~400 words. Single page, no chrome.
