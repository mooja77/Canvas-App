# 6.13 `<SiteFooter>`

← [Pages index](README.md) · [Plan index](../README.md)

**Current state** (`SiteFooter.tsx`, 131 lines): JMS Dev Lab link buried in the Company column. Footer is a 4-col grid: Product / Account / Legal / Company.

## Changes

- Keep 4-col structure.
- Add bottom rail (below copyright line) with three small items:
  - `Built by JMS Dev Lab →` (ochre underline on hover, opens jmsdevlab.com/apps.html#qualcanvas in new tab)
  - `Colophon →` (links to `/colophon`)
  - `<ThemeToggle>` (system / light / dark — three-state, like Are.na)
- Remove the duplicate JMS Dev Lab link in the Company column (now lives in the bottom rail).
- Add status indicator: small green dot + `All systems operational` linking to `status.qualcanvas.com` ([12](../12-open-decisions.md) #18 — recommend buying Better Uptime / Instatus).
- Add a single newsletter line: `Get the methodology field guide by email — one chapter a month` ([12](../12-open-decisions.md) #14).

## Footer copy bottom row

```
© 2026 QualCanvas    ·    Built by JMS Dev Lab →    ·    Colophon    ·    ☀ ◐ ☾
                                                                       (system / light / dark)
                                  ● All systems operational
```

## Studio link anchor

Verify `https://www.jmsdevlab.com/apps.html#qualcanvas` resolves to the correct section heading at Phase 1 ([10](../10-risks-and-rollback.md) R11).
