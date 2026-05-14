# 3. Information architecture

← [Plan index](README.md)

## 3.1 Sitemap (target end state)

```
/                                       Landing — interactive demo + workflow + bento + proof
├── /pricing                            Three tiers + Institutions + comparison + FAQ
├── /methodology                        Index page (TOC)
│   ├── /methodology/foundations
│   ├── /methodology/thematic-analysis
│   ├── /methodology/grounded-theory
│   ├── /methodology/ipa
│   ├── /methodology/intercoder-reliability
│   └── /methodology/ethics-in-practice
├── /customers                          Index + asymmetric bento
│   └── /customers/[slug]               Individual story (4 at launch)
├── /for-teams                          Segment page — research groups
├── /for-institutions                   Segment page — IRB, procurement, SSO, DPA
├── /vs                                 Index of comparison pages
│   ├── /vs/nvivo                       Sober, sourced comparison
│   ├── /vs/atlas-ti
│   └── /vs/dedoose
├── /guide                              Product tour (existing, refurbished)
├── /changelog                          Reverse-chron release feed
├── /trust                              Security + privacy + compliance landing
│   ├── /trust/ai                       AI use policy
│   ├── /trust/dpa                      DPA preview + request
│   └── /trust/subprocessors            Live list (externalized from hardcoded array)
├── /privacy                            Policy
├── /terms                              Terms
├── /cookies                            Cookie policy
├── /accessibility-statement            WCAG 2.2 AA conformance
├── /colophon                           Stack, fonts, credits — discreet JMS Dev Lab link
├── /cite                               BibTeX / APA / Chicago for "How to cite QualCanvas"
├── /press                              Press / media kit
└── /login                              Auth (existing)
```

## 3.2 Page intent table

Every marketing page must answer: who is it for, what's it doing, what's the primary CTA, where does it sit in the funnel.

| Path                       | Persona                              | Job                                                            | Primary CTA               | Funnel stage       |
| -------------------------- | ------------------------------------ | -------------------------------------------------------------- | ------------------------- | ------------------ |
| `/`                        | All                                  | Frame the wedge, prove the product in one interaction          | Start free                | Top                |
| `/methodology`             | Maya, Priya                          | Establish authority on the method, not just the tool           | Read a chapter            | Top                |
| `/methodology/[slug]`      | Maya, Priya                          | Teach a method; show QualCanvas as the natural fit             | Try this in QualCanvas    | Mid                |
| `/pricing`                 | All                                  | Convert                                                        | Start Pro / Talk to sales | Bottom             |
| `/customers`               | Dr. Chen, Priya                      | Social proof                                                   | Read a story              | Mid                |
| `/customers/[slug]`        | Dr. Chen, Priya                      | Specific outcome at a specific institution                     | Start a trial             | Mid–Bottom         |
| `/for-teams`               | Dr. Chen                             | Team-specific feature framing                                  | Start Team trial          | Mid–Bottom         |
| `/for-institutions`        | Dana, Dr. Chen                       | Compliance + procurement                                       | Book a 20-min call        | Bottom (sales)     |
| `/vs/[competitor]`         | Maya, Dr. Chen                       | Capture comparison search intent, surface differences honestly | Start free                | Mid                |
| `/guide`                   | Maya                                 | "Show me how it actually works"                                | Start free                | Top–Mid            |
| `/changelog`               | Dr. Chen, returning users            | "Is this product alive?"                                       | Subscribe to RSS          | Retention          |
| `/trust`                   | Dana                                 | Compliance answers                                             | Request DPA / SOC 2       | Bottom (gating)    |
| `/trust/ai`                | Dana, Maya                           | Direct answer to "is my data training a model?"                | Read full policy          | Bottom (gating)    |
| `/cite`                    | Maya                                 | "Can I cite this in my paper?"                                 | (copy bibtex)             | Retention          |
| `/accessibility-statement` | Institutional procurement, advocates | Show conformance                                               | (none)                    | Bottom (gating)    |
| `/colophon`                | Tom                                  | Studio craft signal                                            | Visit JMS Dev Lab         | n/a (dual-purpose) |
| `/press`                   | Journalists, library guides          | Brand assets + fact sheet                                      | Download brand kit        | n/a                |
