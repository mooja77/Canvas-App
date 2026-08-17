# SciCrunch / RRID resource-registration fill-in sheet

**Draft for operator submission.** Register QualCanvas in the SciCrunch Resource Registry to obtain a Research Resource Identifier (RRID). An RRID is the identifier qualitative and health researchers cite in the methods section of a paper when naming the software they used — the same way antibodies, model organisms, and other tools are cited. Registration is free.

- **Where:** https://scicrunch.org/resources → "Submit a resource" (requires a free SciCrunch account; the Tools/Resources registry is the "SCR" namespace that issues `RRID:SCR_xxxxxx` identifiers).
- **What you get:** a persistent `RRID:SCR_######` for QualCanvas that authors cite as e.g. "QualCanvas (RRID:SCR\_######)".

---

## Fields to paste

| SciCrunch field                   | Value                                                                                                                                                                                                                  |
| --------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Resource name**                 | QualCanvas                                                                                                                                                                                                             |
| **Resource type**                 | Software / Tool (select the software/tool category → issues an SCR RRID)                                                                                                                                               |
| **Also known as / abbreviations** | QualCanvas (visual qualitative coding workspace)                                                                                                                                                                       |
| **Resource URL (homepage)**       | https://qualcanvas.com                                                                                                                                                                                                 |
| **Description**                   | See description block below — paste verbatim.                                                                                                                                                                          |
| **Keywords**                      | thematic analysis; grounded theory; interpretative phenomenological analysis; IPA; intercoder reliability; CAQDAS; qualitative coding; qualitative data analysis; Cohen's kappa; Krippendorff's alpha; research ethics |
| **Availability / license**        | Commercial software (proprietary), free tier available; hosted web application                                                                                                                                         |
| **Publisher / provider**          | JMS Dev Lab                                                                                                                                                                                                            |
| **Related documentation**         | https://qualcanvas.com/methodology · https://qualcanvas.com/cite · (add the Zenodo DOI here once issued)                                                                                                               |
| **Contact**                       | methodology@qualcanvas.com                                                                                                                                                                                             |

### Description (paste verbatim)

> QualCanvas is a visual workspace for qualitative coding: a computer-assisted qualitative data analysis software (CAQDAS) application for coding interview transcripts and other qualitative data on a spatial canvas. It supports the major qualitative analytical traditions — reflexive and codebook thematic analysis (Braun & Clarke), grounded theory (Charmaz), and Interpretative Phenomenological Analysis (IPA) — with codebook export (definitions, applied-span counts, exemplar extracts), an intercoder reliability panel computing Cohen's κ (two coders) and Krippendorff's α (three or more coders) with a per-code disagreement queue, and a per-action audit log of AI-assisted coding usage. Companion methodology documentation is published at https://qualcanvas.com/methodology. Developed by JMS Dev Lab.

---

## Notes for the submitter

- **Category matters:** choose the software/tool resource category so SciCrunch mints an `SCR_` identifier (the class cited in methods sections). Do not file it under an unrelated category (e.g. database, organism).
- **Check for an existing record first:** search scicrunch.org for "QualCanvas" before submitting, to avoid creating a duplicate. If none exists, proceed.
- **Curation delay:** SciCrunch resource submissions are reviewed by curators before the RRID is finalised; expect a short queue rather than instant issue.
- **After the RRID issues:**
  - Record the `RRID:SCR_######`.
  - Add it to the SciCrunch "related documentation" and to the Zenodo record if both are live.
  - It can also be surfaced on qualcanvas.com/cite so authors can copy it alongside the BibTeX/APA entries.
- **Only verified facts:** every claim in the description above traces to the QualCanvas methodology chapters and CitePage (intercoder panel = Pro/Team feature computing Cohen's κ and Krippendorff's α with a disagreement queue; codebook CSV export with definitions, applied-span counts, exemplar extracts; per-action AI audit log). Do not add capability claims that are not in the product.

## Sources / provenance

- Feature claims: `apps/frontend/src/content/methodology/thematic-analysis.tsx` (codebook CSV export) and `intercoder-reliability.tsx` ("In QualCanvas" section — κ for two coders, α for three or more, per-code breakdown, confusion matrix, disagreement queue), `ethics-in-practice.tsx` (per-action AI audit log: provider, model, feature, token count).
- Name / positioning ("visual workspace for qualitative coding"): `apps/frontend/src/pages/CitePage.tsx`.
- License status: no LICENSE file in repo; product has paid Pro/Team tiers + free tier (per pricing pages) → described as proprietary with a free tier.
