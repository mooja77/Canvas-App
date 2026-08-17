# Zenodo deposit — metadata record

**Draft for operator submission. Do not submit until the license question (below) is decided.**

This file lists, field by field, exactly what to enter in the Zenodo "New upload" form (zenodo.org/uploads/new). The file to upload is the compiled PDF of `methodology-whitepaper.md` (this directory). Compile that Markdown to PDF first — see `deposit-checklist.md`.

---

## Upload type

- **Upload type:** Software

> Rationale: the deposit records the methodology documentation for QualCanvas, a piece of research software. Zenodo's software type is what mints a citable software DOI and syncs cleanly with the `@software{...}` citation already published on qualcanvas.com/cite. The uploaded PDF is the methodology whitepaper that documents the software's analytical model.

## Files

- `qualcanvas-methodology-guide-v1.pdf` — compiled from `methodology-whitepaper.md`.

## Basic information

| Field                   | Value                                                                   |
| ----------------------- | ----------------------------------------------------------------------- |
| **Title**               | QualCanvas: A Practical Methodology Guide for Qualitative Coding (v1.0) |
| **Authors / Creators**  | JMS Dev Lab (organisational/institutional author)                       |
| **Creator affiliation** | JMS Dev Lab                                                             |
| **Publication date**    | 2026-05 (use the exact deposit date if the form requires a full date)   |
| **Description**         | See "Description" block below — paste verbatim.                         |
| **Version**             | 1.0                                                                     |
| **Language**            | English (eng)                                                           |

> Note on the author field: Zenodo's creator field expects a "Family name, Given names" personal-name structure. For an institutional author, enter the organisation name **JMS Dev Lab** in the family-name box and leave given-names empty; Zenodo supports organisational creators this way. Do not enter an individual's personal name — the canonical citation on /cite uses `{{JMS Dev Lab}}` as an institutional author and this deposit must match it.

### Description (paste verbatim)

> A practical methodology guide for qualitative coding, documenting the analytical traditions supported by QualCanvas (a visual workspace for qualitative coding). Six chapters cover: (1) foundations of qualitative coding — the inductive/deductive/abductive distinction, codes vs. categories vs. themes, and saturation; (2) thematic analysis, including Braun & Clarke's six phases and the reflexive/codebook/coding-reliability variants; (3) grounded theory across the Glaser, Strauss–Corbin, and Charmaz traditions; (4) Interpretative Phenomenological Analysis (IPA), the double hermeneutic, and the four-step procedure; (5) intercoder reliability — Cohen's κ and Krippendorff's α and when each applies; and (6) research ethics in practice — ongoing consent, anonymisation vs. pseudonymisation, retention windows, and the data-protection questions raised by AI-assisted coding. The guide is written for graduate students, methodologists, and applied qualitative researchers choosing and justifying an analytical approach. Companion software: QualCanvas, https://qualcanvas.com. Draft status: not yet externally peer-reviewed; the ethics chapter is not legal advice.

## License and access

- **Access right:** Open Access
- **License:** **OPERATOR DECISION REQUIRED — see note.**

> The QualCanvas repository contains no LICENSE file and `package.json` declares no license, so no license is inherited automatically. The software itself is proprietary commercial SaaS (paid Pro/Team tiers). The item being deposited, however, is a **documentation whitepaper** intended to be read, cited, and shared.
>
> Recommended: **Creative Commons Attribution 4.0 International (CC BY 4.0)** for the whitepaper. It permits the citation-and-sharing use this deposit exists to enable, is Zenodo's most common scholarly-document license, and does not touch the proprietary status of the QualCanvas software (only the PDF is licensed, not the codebase).
>
> Alternative if JMS Dev Lab wants to restrict reuse: **CC BY-NC-ND 4.0** (no commercial reuse, no derivatives) — still Open Access and citable, more restrictive on reuse.
>
> Do NOT select an open-source software license (MIT, Apache, GPL): this deposit is a document, not source code, and the software is not being open-sourced.

## Keywords

Enter each as a separate keyword:

- thematic analysis
- grounded theory
- interpretative phenomenological analysis
- IPA
- intercoder reliability
- CAQDAS
- qualitative coding
- qualitative data analysis
- research ethics
- reflexive thematic analysis
- Cohen's kappa
- Krippendorff's alpha

## Related / alternate identifiers

Add these under "Related works" (relation → identifier):

| Relation                | Identifier (URL)                   | Resource type |
| ----------------------- | ---------------------------------- | ------------- |
| **is documentation of** | https://qualcanvas.com             | Software      |
| **is supplement to**    | https://qualcanvas.com/methodology | Publication   |
| **is cited by**         | https://qualcanvas.com/cite        | Other         |

> The primary purpose of the deposit is the outbound link from the Zenodo record to qualcanvas.com. "is documentation of → https://qualcanvas.com" is the load-bearing relation. If Zenodo's relation vocabulary does not offer "is documentation of", use **"is supplement to"** or **"references"** pointing at https://qualcanvas.com.

## Publisher / other

| Field                        | Value                                                                    |
| ---------------------------- | ------------------------------------------------------------------------ |
| **Publisher**                | Zenodo (default) — or "JMS Dev Lab" if a self-publisher field is offered |
| **Contact / correspondence** | methodology@qualcanvas.com                                               |

---

## Post-deposit follow-through

1. Zenodo issues a **concept DOI** (all versions) and a **version DOI** (this v1.0). Record both.
2. Hand the version DOI to whoever executes **action 14** of the UA plan (`CitePage.tsx` — replace the bare `https://qualcanvas.com` URL in all four citation formats with the DOI).
3. Confirm the record resolves publicly and the outbound link to qualcanvas.com is live.
4. Watch for Google Scholar indexing at ~6 weeks and zenodo.org appearing in GSC → Links → referring domains at 4–6 weeks.

**Kill criterion (from the UA plan):** if the deposit is rejected or the record is never indexed, the play is dead — record the outcome, do not retry or substitute lower-quality directories.

## Sources / provenance

- Whitepaper content: `apps/frontend/src/content/methodology/{foundations,thematic-analysis,grounded-theory,ipa,intercoder-reliability,ethics-in-practice}.tsx`.
- Citation title / author / version: `apps/frontend/src/pages/CitePage.tsx` (`CITATIONS` object) — "QualCanvas: A Visual Workspace for Qualitative Coding", author `{{JMS Dev Lab}}`, year 2026, version 1.0, url https://qualcanvas.com.
- Version number `1.0.0`: root `package.json`.
- License status: no LICENSE file present; `package.json` has no `license` field (verified 2026-07-28).
