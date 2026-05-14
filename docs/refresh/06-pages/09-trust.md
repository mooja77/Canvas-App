# 6.9 `/trust`

← [Pages index](README.md) · [Plan index](../README.md)

Stripe-pattern. Three compliance tiles + five sections + transparent admission paragraph. Externalize sub-processors. Hard-gated by legal sign-off before publish. Eyebrow + H1 + sub from [04 §4.7](../04-brand-design-system.md).

## Current state (TrustPage.tsx, 230 lines)

Scaffolding shipped; sub-processors hardcoded; gated behind `trust_page` flag (default off per `featureFlagsStore.ts:63`); commented "TBD pending legal audit" but no explicit TBD markers. Sections: hosting, encryption, auth, sub-processors, audit logging, DSR/GDPR, DPA, vuln disclosure.

## New structure (Stripe-pattern)

1. **Three compliance tiles** immediately below H1:
   - `[ SOC 2 Type II ]   [ GDPR ]   [ HIPAA-ready BAA ]`
   - Each with its own CTA: `Request SOC 2 report →` / `Read DPA →` / `Request BAA →`.
2. **Five sections**, each using **What it is / How we do it / What it means for you** triad in prose, not bullets:
   - Standards & compliance
   - Data residency
   - Encryption & access
   - Research-specific controls (this is unique to us — IRB letters, retention windows, participant export/deletion APIs)
   - Posture & disclosure
3. **Externalize sub-processors table** out of the component (`SUB_PROCESSORS` array, `TrustPage.tsx:216-230`) into a JSON config so updates don't require a deploy.
4. **Transparent admission paragraph** at bottom — Linear move: _"We don't yet hold ISO 27001. Targeting it in 2027. Our SOC 2 Type II is current as of [date]."_

## Hard gate

This page changes go live **only after legal sign-off** on the new copy. Visual + copy land together, not separately.
