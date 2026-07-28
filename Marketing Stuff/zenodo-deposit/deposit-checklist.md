# Zenodo deposit — operator checklist

Step-by-step for making the QualCanvas methodology deposit at zenodo.org. Everything is pre-drafted; this is a paste-and-confirm session. Budget ~30 minutes.

**Files in this directory**

- `metadata-record.md` — every form field, ready to paste.
- `methodology-whitepaper.md` — the source of the PDF to upload.
- `deposit-checklist.md` — this file.

---

## Before you start

- [ ] **Decide the license.** `metadata-record.md` flags this as an operator decision. Recommendation: CC BY 4.0. You cannot complete the form without choosing one.
- [ ] **Confirm the account identity.** Log in at zenodo.org with the JMS Dev Lab account (GitHub or ORCID sign-in both work). The deposit will be permanently attributed to whatever account publishes it — use the institutional/founder account, not a personal throwaway.
- [ ] **(Optional but recommended) Connect ORCID.** If JMS Dev Lab has an ORCID iD, link it in Zenodo account settings first so the record carries a persistent researcher identifier.

## Step 1 — Compile the PDF

- [ ] Convert `methodology-whitepaper.md` to PDF. Any of:
  - Pandoc: `pandoc "methodology-whitepaper.md" -o qualcanvas-methodology-guide-v1.pdf --pdf-engine=xelatex -V geometry:margin=1in`
  - Or open in a Markdown editor (Typora, VS Code + Markdown PDF, Obsidian) and export to PDF.
- [ ] Name the file `qualcanvas-methodology-guide-v1.pdf`.
- [ ] Open the PDF and check: title page renders, all six chapters present, reference lists intact, the Greek letters (κ, α) and arrows (↔) display correctly, no broken HTML entities.

## Step 2 — Start the upload

- [ ] Go to https://zenodo.org/uploads/new (must be logged in).
- [ ] **Upload files:** drag in `qualcanvas-methodology-guide-v1.pdf`. Wait for the upload to complete before filling fields.

## Step 3 — Fill the form (values from `metadata-record.md`)

- [ ] **Upload type:** Software.
- [ ] **Title:** `QualCanvas: A Practical Methodology Guide for Qualitative Coding (v1.0)`
- [ ] **Creators:** add one creator — family name `JMS Dev Lab`, given names blank (organisational author). Affiliation `JMS Dev Lab`. Add ORCID if available.
- [ ] **Description:** paste the Description block verbatim from `metadata-record.md`.
- [ ] **Version:** `1.0`
- [ ] **Language:** English (eng).
- [ ] **Publication date:** today's date (or 2026-05 if the form accepts a partial date).

## Step 4 — License & access

- [ ] **Access right:** Open Access.
- [ ] **License:** the one you decided above (recommended CC BY 4.0).

## Step 5 — Keywords & related works

- [ ] **Keywords:** add each keyword from `metadata-record.md` as a separate entry (thematic analysis, grounded theory, interpretative phenomenological analysis, IPA, intercoder reliability, CAQDAS, qualitative coding, qualitative data analysis, research ethics, reflexive thematic analysis, Cohen's kappa, Krippendorff's alpha).
- [ ] **Related/alternate identifiers:** add the outbound link to qualcanvas.com.
  - Relation `is supplement to` (or `is documentation of` if offered) → `https://qualcanvas.com`.
  - Optionally add `https://qualcanvas.com/methodology` and `https://qualcanvas.com/cite`.
  - **This outbound link is the entire point of the deposit — do not skip it.**

## Step 6 — Reserve DOI (optional) and publish

- [ ] If you want the DOI before publishing (e.g. to print it inside the PDF), click **Reserve DOI** — otherwise Zenodo mints it on publish.
- [ ] Review every field once against `metadata-record.md`.
- [ ] Click **Publish**. This is irreversible: files in a published record cannot be changed, only superseded by a new version. Confirm the PDF is final before publishing.

## Step 7 — Record the outcome

- [ ] Copy the **concept DOI** (resolves to all versions) and the **version DOI** (this v1.0). Save both somewhere durable (app memory / this directory).
- [ ] Open the version DOI in a private browser window: confirm the record resolves publicly and the outbound qualcanvas.com link is clickable.
- [ ] Hand the version DOI to whoever runs **action 14** (`CitePage.tsx` DOI update).

## Step 8 — Monitor (agent/measurement, not operator)

- Google Scholar indexing: check at ~6 weeks (search the title on scholar.google.com).
- GSC → Links → external / referring domains: watch for `zenodo.org` at 4–6 weeks.

**Kill criterion:** deposit rejected or record never indexed at ~6 weeks → the play is dead. Record it; do not retry or substitute lower-quality directories.

---

### Notes

- Zenodo deposits are free and permanent (CERN-operated). There is no cost and no approval queue — publishing is immediate.
- Editing metadata (title, description, keywords, related links) is allowed after publish; the **files** are locked. So a metadata typo is fixable; a wrong PDF means publishing a new version.
- If a GitHub release-based deposit is ever preferred instead, Zenodo can auto-archive GitHub releases — but that path deposits the code repo, not this whitepaper, and would need the repo to be public. For this action, upload the PDF manually as above.
