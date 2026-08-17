# A Practical Methodology Guide for Qualitative Coding

### Thematic analysis, grounded theory, IPA, intercoder reliability, and research ethics

**JMS Dev Lab**

Version 1.0 · May 2026 · Companion documentation to QualCanvas (qualcanvas.com)

---

## About this document

This guide is the methodology documentation that accompanies QualCanvas, a visual workspace for qualitative coding developed by JMS Dev Lab. It sets out the analytical traditions the software is designed to support — reflexive and codebook thematic analysis, grounded theory, Interpretative Phenomenological Analysis, intercoder reliability statistics, and the research-ethics layer that runs through all of them — as they are actually practised, with the decisions an analyst has to defend on the way to a finding.

It is written for graduate students, methodologists, and applied researchers choosing and justifying a qualitative analytical approach. Where a chapter refers to how QualCanvas implements a given procedure, that material is presented as tool documentation and is clearly marked; the methodological content stands independent of the software.

**Status.** These chapters are in draft. They have not yet been peer-reviewed by an external methodologist, and the ethics chapter is not legal advice and has not been reviewed by qualified legal counsel. Reviewer correspondence: methodology@qualcanvas.com.

**Contents**

1. Foundations
2. Thematic analysis
3. Grounded theory
4. Interpretative Phenomenological Analysis
5. Intercoder reliability
6. Ethics in practice

---

# 1. Foundations

_What qualitative coding actually is, why it is interpretive work, and the small set of distinctions you have to get right before any of the later chapters help._

## What coding is (and isn't)

In qualitative research, coding is the act of attaching short labels to extracts of data — words, phrases, paragraphs, sometimes whole exchanges — that index something the analyst wants to track. The labels are the codes; the extracts are what they apply to. Coding is the way an analyst makes a large unstructured corpus interrogable.

It is worth being clear about what coding is not. It is not the same as the "coding" survey researchers do when they translate open-ended responses into a fixed taxonomy of categories. It is not a way of counting (although codes can be counted). It is not a substitute for analysis — it is the scaffolding on which analysis happens.

Saldaña (2021) puts the distinction sharply: a code is "a researcher-generated construct that symbolizes and thus attributes interpreted meaning to each individual datum for later purposes of pattern detection, categorization, theory-building, and other analytic processes." The phrase that matters there is _interpreted meaning_. Coding is not data entry. It is interpretation, performed early and recorded so the interpretation can be argued with later.

## Inductive, deductive, abductive

Three logics of inference, each producing a recognisably different relationship between codes and data.

**Inductive coding.** Codes are generated from the data. The analyst reads, notices, labels, and builds a codebook from the ground up. Inductive coding is the default for exploratory studies and for traditions (reflexive thematic analysis, grounded theory, IPA) that treat the participants' framing as the analytical starting point. The risk is that "purely inductive" coding is a methodological fiction — every analyst arrives with priors, and the right move is to declare them rather than pretend they aren't there.

**Deductive coding.** Codes come from theory, prior literature, or a pre-existing framework, and the analyst applies them to new data. Deductive coding is the default for framework analysis (Ritchie & Spencer, 1994), for studies replicating or extending prior work, and for survey-derived qualitative data. The risk is confirmation: a strong prior framework will see itself in the data even where it doesn't fit.

**Abductive coding.** Codes alternate between inductive generation and deductive testing, organised around anomalies — data that doesn't fit the working theory and forces the theory to revise. Timmermans and Tavory (2012) give the most-cited contemporary statement. In practice, most coding labelled "inductive" in methods sections is in fact abductive, and saying so is more accurate.

> **A note on methods-section language.** The claim "codes were developed inductively from the data" is almost always wrong as written. A version that is closer to what most analysts actually do: "an initial round of open coding generated 80–120 codes inductively; these were refined against the literature on X and consolidated into a working codebook before the full corpus was coded." That is abductive, and it is defensible.

## Codes, categories, themes

These three terms get used interchangeably in undergraduate methods textbooks, which is unfortunate because they are not interchangeable. A clean working set of definitions:

- **A code** is a label applied to a data extract. It is descriptive ("mother as primary carer"), in vivo (a phrase taken directly from a participant: "I had to be someone else"), or analytical ("the interrupted self"). A study typically generates dozens to low hundreds of codes.
- **A category** is a cluster of related codes that share a topic or descriptive domain. "Family relationships" is a category. Categories are organisational, not yet interpretive.
- **A theme** is an analytic claim about a pattern that runs through codes (and sometimes categories). A theme is an argument the data is making. "Family relationships are reframed after a caregiving role ends" is a theme.

A study can have 80 codes, organised into 8 categories, that support 3 themes, and that is a normal, well-shaped analysis. A study with 80 codes and 80 themes has skipped a step. A study with 3 codes and 12 themes is doing something else entirely. Chapter 2 goes into the codes-versus-themes distinction in depth for thematic analysis specifically; the same intuition transfers to grounded theory and IPA.

## Saturation, honestly

Theoretical saturation — the point at which new data stops producing new codes — is the conventional stopping rule in grounded theory and has migrated into thematic analysis methods sections. The problem is that it is, as written, unfalsifiable: the analyst declares saturation reached, and the reader has no way to check.

Two pieces of recent work are worth knowing. Bowen (2008) walked through the operational ambiguity in the term and argued for a transparent reporting standard — how many interviews, what specifically stopped generating new codes, what was the threshold. Hennink, Kaiser and Marconi (2017) showed empirically that for in-depth interview studies, code saturation typically occurred by interview 9, but _meaning saturation_ (further development of existing codes) required 16–24 interviews.

The defensible practice in 2026: state your stopping rule in advance, report what you observed, and stop using "saturation" as if it were a single threshold. Code saturation, meaning saturation, and theoretical saturation are different things; the methods section should say which one you reached.

## Before you start coding

Three small commitments you should make before opening the first transcript:

**1. Decide which methodology you are doing** — reflexive TA, codebook TA, grounded theory, IPA, framework analysis, narrative analysis — before any coding. The choice shapes the coding logic (inductive / deductive / abductive), whether intercoder agreement is required, how the codebook is structured, and what the final report looks like. Picking after the fact is the most common methodological mistake in qualitative theses.

**2. Write a one-paragraph statement of positionality.** Who is doing the coding, what relationship they have to the participants, what they expect to find, and what theoretical priors are in play. The point is not confessional; the point is that those priors will shape the codes and naming them early disciplines the analyst and helps the reader.

**3. Pick a stopping rule — in advance.** "We will code until two consecutive interviews produce no new codes against the working codebook" is a defensible stopping rule. "Until saturation" without further detail isn't.

The five remaining chapters of this guide work through specific methodologies (thematic analysis, grounded theory, IPA), one common analytical question (intercoder reliability), and the ethics layer that runs through all of them. Start with the chapter that matches the methodology you've picked, not the one at the top.

### Further reading

- Saldaña, J. (2021). _The Coding Manual for Qualitative Researchers_ (4th ed.). SAGE.
- Boyatzis, R. E. (1998). _Transforming Qualitative Information: Thematic Analysis and Code Development_. SAGE.
- Timmermans, S., & Tavory, I. (2012). Theory construction in qualitative research: From grounded theory to abductive analysis. _Sociological Theory_, 30(3), 167–186.
- Bowen, G. A. (2008). Naturalistic inquiry and the saturation concept: a research note. _Qualitative Research_, 8(1), 137–152.
- Hennink, M. M., Kaiser, B. N., & Marconi, V. C. (2017). Code saturation versus meaning saturation: How many interviews are enough? _Qualitative Health Research_, 27(4), 591–608.
- Ritchie, J., & Spencer, L. (1994). Qualitative data analysis for applied policy research. In _Analyzing Qualitative Data_ (pp. 173–194). Routledge.

---

# 2. Thematic analysis

_Braun & Clarke's six phases as they're actually practised: with the codebook drift, the reviewer-2 anxiety, and the decisions you defend on the way to a finding._

## What thematic analysis is (and isn't)

Thematic analysis (TA) is a method for identifying, organising, and interpreting patterns of meaning across qualitative data. Braun and Clarke's 2006 article in _Qualitative Research in Psychology_ is the canonical reference; it has been cited well over 200,000 times, which is a clue to both its usefulness and the trouble that comes with that usefulness.

The trouble is this: TA is often picked up as a default method rather than chosen, and presented in methods sections as "we did thematic analysis" without the theoretical orientation that makes the analysis defensible. Braun and Clarke have spent the years since 2006 trying to fix that. Their 2021 conceptual paper distinguishes _reflexive_ TA, _codebook_ TA, and _coding reliability_ TA — three different methods that share a name and are not interchangeable (Braun & Clarke, 2021).

Before the six phases, the choice that matters most is which TA you're doing. The phases are similar across variants; the epistemology is not. If a reviewer asks why your codebook didn't go to two coders, the answer — "because this is reflexive TA, where the researcher's interpretation is the analytic instrument" — is a defensible answer. "We forgot" is not.

> **A useful diagnostic.** If you can't state in one sentence whether your themes were generated inductively from the data, deductively from a prior framework, or some pragmatic mix, you don't yet know which thematic analysis you're doing. Pick before you code, not after.

## Braun & Clarke's six phases

The phases are not linear. They are recursive. You will go back to phase 2 after starting phase 4, and that's the work, not a failure of process. Treat the numbered list as a description of what activity dominates at each point.

**1. Familiarisation.** Read the transcripts. Read them again. Write a one-page summary of each one before any coding. The familiarisation phase is the only phase where it is acceptable to know nothing and write nothing analytical — you are loading the corpus into your head. Skipping it makes coding faster and the analysis weaker, because every code becomes a guess about a transcript you don't fully remember.

**2. Generating initial codes.** Apply short labels to data extracts that strike you as analytically meaningful. Codes at this stage are descriptive ("mother as primary carer") or in vivo ("I had to be someone else"). Don't worry about consistency yet — that's phase 5's job. Worry about coverage. If you finish a transcript and have only used three codes, you are probably not coding finely enough.

**3. Searching for themes.** Group codes into candidate themes — clusters of codes that say something coherent about the data. This is where TA shifts from descriptive to interpretive. A theme is not a topic ("family relationships"); it is an argument the data is making ("family relationships are reframed after a caregiving role ends"). If your theme would survive being rewritten as a research-question heading, it's probably a topic, not a theme.

**4. Reviewing themes.** Test each candidate theme against (a) the coded extracts it's built from, and (b) the full dataset. Themes that don't hold up at (b) get demoted, merged, or split. You will discover at this phase that some of your early codes were really sub-codes of a more interesting pattern, and a theme you assumed was central turns out to be a sub-theme of something else.

**5. Defining and naming themes.** Write a two-to-three-sentence definition of each theme. If you can't, the theme isn't one theme. Pick names that do analytic work — "the interrupted self" tells a reader what they're about to read; "identity issues" tells them nothing they didn't already assume.

**6. Producing the report.** Write up. The mistake at this phase is treating the report as a separate, post-analytic activity. It isn't. Writing surfaces ambiguity, exposes themes that don't hold together, and forces decisions you postponed. Expect to return to phases 4 and 5 mid-write-up. The final theme structure often stabilises the week the methods section gets drafted.

> "Thematic analysis should be seen as a foundational method for qualitative analysis. It is the first qualitative method of analysis that researchers should learn, as it provides core skills that will be useful for conducting many other forms of qualitative analysis."
> — Braun & Clarke, 2006

## Codes versus themes

The most-confused distinction in TA: a code is a label applied to a data extract; a theme is an analytic claim about a pattern that runs through codes. Codes are the unit of segmentation. Themes are the unit of interpretation. A study can have 80 codes and 4 themes, and that is a typical, not a suspicious, ratio.

The Braun and Clarke update on this in 2021 was sharper than it sounds: themes are not "found" in the data; they are _generated_ by the analyst from coded extracts. The shift in language matters for two reasons. First, it removes the false promise that two analysts coding the same dataset will arrive at the same themes — they should not, if interpretation is doing real work. Second, it forces the methods section to take responsibility: it's not that the themes emerged, it's that you wrote them.

The practical implication: in QualCanvas, codes are stored objects; themes live in the canvas as the spatial groupings you draw between codes. The codebook is not the analysis. The codebook is the working inventory that the analysis is built from.

## Building a defensible codebook

A codebook is the durable record of every code applied to the dataset, with its definition and inclusion/exclusion criteria. It is a methodological artefact, not a deliverable. A defensible codebook has three properties.

**First, code definitions are specific enough to apply.** "Caregiving" is a topic, not a code definition. A code definition that works is: "Direct reference to providing care for another person, including unpaid family care, paid care work, and the negotiation of care responsibilities. Excludes generic discussion of care systems without a specific care relationship." That definition lets you, six weeks from now, decide whether a passage about an aunt's end-of-life arrangements gets the code.

**Second, the codebook records change over time.** Codes get merged. Codes get split. Codes get retired. A codebook that looks the same at the end of analysis as at the start is a codebook that wasn't doing analytical work. Keep a short version history alongside the definitions — what changed and why. Reviewer 2 will sometimes ask for this, and even if they don't, having it disciplines your own analysis.

**Third, the codebook is exported with the paper.** Most journals now accept a codebook as supplementary material. Treat that as the bar. A codebook with definitions, frequencies, and exemplar extracts is the qualitative equivalent of releasing your dataset — not perfectly transparent, but transparent enough that a reader can interrogate your interpretive moves.

QualCanvas exports the codebook to CSV with definitions, applied-span counts, and per-code exemplar extracts. The export goes into the supplementary materials folder. The version history is in the canvas history; you don't need to maintain it by hand.

## Reflexive TA vs codebook TA

Reflexive TA (Braun & Clarke, 2019, 2021) treats the analyst's subjectivity as the analytic resource, not the analytic problem. There is, deliberately, no second coder. Themes are developed by one researcher (or a small team operating as one interpretive voice) and the validity of the analysis rests on the depth of engagement and the transparency of the interpretive reasoning.

Codebook TA (Boyatzis, 1998; Guest, MacQueen & Namey, 2012; King, 2004) builds the codebook collaboratively, applies it consistently across the dataset, and often reports intercoder agreement. The analytic stance is closer to a small-scale qualitative content analysis; the goal is replicable coding of a defined construct space.

The two approaches answer different research questions. If your question is "how do recent graduates narrate the transition from caregiving back to academic work?" that's a reflexive-TA question; the analytic instrument _is_ the analyst's reading of the narrative. If your question is "what proportion of NHS staff reports specific categories of moral distress?" that's a codebook-TA question, possibly with intercoder reliability reporting.

Pick the variant before you start coding and name it in the methods section. The single most common methods-paper mistake in TA is doing codebook-style coding (multiple coders, agreement statistics) and calling it reflexive TA, or doing reflexive coding (single researcher, deep interpretation) and apologising for the lack of a second coder. Pick, defend the choice, move on.

## Intercoder agreement (when it matters)

A standing argument in qualitative methods: should you report intercoder reliability for TA? The honest answer depends on which TA you're doing. Chapter 5 of this guide goes into the statistics; the summary here is methodological.

For reflexive TA, intercoder reliability is not just unnecessary; it is conceptually incoherent. The analytic instrument is the analyst's interpretive engagement. Demanding two analysts produce the same themes is demanding the instrument behave like a different instrument. McDonald, Schoenebeck and Forte (2019) make a useful argument that defaulting to κ across all qualitative research imposes a positivist standard on interpretive work that doesn't fit.

For codebook TA, intercoder reliability is defensible and sometimes expected — particularly in health-services research, in survey-derived qualitative data, and where the codebook is intended to be applied by future analysts. Cohen's κ above .70 is the conventional minimum; Krippendorff's α is more flexible across coder counts and missing data.

The chapter-5 take: pick the agreement statistic that matches the question, report it transparently, and don't use a κ above .70 as a substitute for showing that your codes are doing analytical work. A high κ on trivially-defined codes is not rigour; it's just two people agreeing on the obvious.

### Further reading

- Braun, V., & Clarke, V. (2006). Using thematic analysis in psychology. _Qualitative Research in Psychology_, 3(2), 77–101.
- Braun, V., & Clarke, V. (2019). Reflecting on reflexive thematic analysis. _Qualitative Research in Sport, Exercise and Health_, 11(4), 589–597.
- Braun, V., & Clarke, V. (2021). One size fits all? What counts as quality practice in (reflexive) thematic analysis? _Qualitative Research in Psychology_, 18(3), 328–352.
- Braun, V., & Clarke, V. (2022). _Thematic Analysis: A Practical Guide_. SAGE Publications.
- Boyatzis, R. E. (1998). _Transforming Qualitative Information: Thematic Analysis and Code Development_. SAGE.
- Guest, G., MacQueen, K. M., & Namey, E. E. (2012). _Applied Thematic Analysis_. SAGE.
- McDonald, N., Schoenebeck, S., & Forte, A. (2019). Reliability and inter-rater reliability in qualitative research: Norms and guidelines for CSCW and HCI practice. _Proceedings of the ACM on Human-Computer Interaction_, 3(CSCW), 1–23.

---

# 3. Grounded theory

_Charmaz's constructivist grounded theory — from open coding to a theory that's defensible, including the Glaser–Strauss–Charmaz lineage you need to know to pick the right tradition._

## The promise (1967)

Glaser and Strauss's _The Discovery of Grounded Theory_ (1967) made a strong claim: theories about social life can be developed systematically from qualitative data, without first deriving hypotheses from an existing framework. The argument was situated against mid-century American sociology's tendency to test grand theory with quantitative survey work; grounded theory was a rebuttal that put close reading of qualitative data at the centre of theory construction.

The promise has aged unevenly. The methodological apparatus — iterative coding, constant comparison, memo-writing, theoretical sampling, saturation — is widely adopted, often outside the full grounded-theory paradigm. The epistemological claim — that theory _emerges_ from data if the method is followed properly — has been substantially revised by every major contemporary proponent, including Charmaz, who argues we co-construct rather than discover.

## Three traditions, one name

"Grounded theory" refers to three substantially different methods, and a methods section that doesn't name which one is undefendable.

**Classical (Glaserian) grounded theory.** The original 1967 method as Glaser developed it through the 1970s and 80s. Strict separation between data collection and prior theory; the literature review is deferred until after analysis; codes "emerge" from data under a positivist epistemology that treats the analyst as a neutral observer. Glaser's 1992 book _Basics of Grounded Theory Analysis_ is in part a direct rejection of the direction Strauss took the method.

**Strauss-Corbin grounded theory.** Strauss and Corbin's 1990 textbook introduced a more procedural version with explicit coding paradigms (open / axial / selective) and the conditional/consequences matrix. The textbook made grounded theory teachable but Glaser argued it forced data into pre-given analytical categories — the famous "emergence versus forcing" argument. Strauss-Corbin GT remains common in health and nursing research; Corbin's 2008 revision softens some of the earlier positions.

**Constructivist (Charmaz) grounded theory.** Charmaz (2006, 2014) rebuilt grounded theory on constructivist foundations: the analyst is not a neutral observer; data are co-constructed with participants; the resulting theory is interpreted, not discovered. The coding procedure is similar to Strauss-Corbin's in shape (initial → focused → theoretical) but the epistemological claims are weaker and the writing is more reflexive. Constructivist GT is the dominant tradition in qualitative methods courses in 2026.

> "We are not passive receptacles into which data are poured. We are part of what we study" — and the theories we develop carry the imprint of our perspective, our questions, and our analytical choices.
> — Charmaz, 2014

> **Pick the tradition before you cite.** A methods section that lists Glaser, Strauss-Corbin, and Charmaz in one paragraph — without saying which one is being used — is the qualitative equivalent of citing Frequentist, Bayesian, and likelihood-free inference without picking. Reviewers notice.

## Coding: initial → focused → theoretical

Charmaz's coding sequence runs through three phases. The phases are not linear — you return to initial coding when new data complicates focused codes — but the dominant activity changes.

**Initial coding.** Line-by-line or incident-by-incident coding of early transcripts. Codes are short, active, and as close to the data as possible. Charmaz recommends gerund-form codes ("reframing identity," "negotiating care") because they keep the focus on action and process rather than static categories. The output is messy: dozens of codes per transcript, many overlapping.

**Focused coding.** The most-applied and most analytically promising of the initial codes are elevated to focused codes, which are then applied across the remaining data. Focused codes are fewer (typically 15–40) and synthesise across initial codes. This is where the codebook begins to stabilise.

**Theoretical coding.** The relationships between focused codes are themselves coded. What is the conditional structure (when X appears, Y follows; X requires Y as a prerequisite; X and Y are alternative responses to the same condition)? Theoretical coding is the move from a codebook to a theory. Glaser's _Theoretical Sensitivity_ (1978) catalogues coding families that can prompt this move; Charmaz treats them as a non-exhaustive resource rather than a fixed taxonomy.

## Memo-writing as analysis

Memo-writing is the analytical engine of grounded theory. Every code, every emerging category, every theoretical hunch gets a memo. Memos are dated, freeform, and accumulate into the analytic record from which the eventual theory is written.

Three types of memo are worth distinguishing in practice:

- **Code memos** — what a code is for, what it includes, what it excludes, where the boundaries are still ambiguous. Code memos make the codebook defensible.
- **Operational memos** — methodological decisions: why an interview was transcribed differently, why a code was retired, what was changed in the interview guide after the first three participants.
- **Theoretical memos** — speculation about relationships between codes, connections to existing literature, candidate explanations for puzzling patterns. Theoretical memos are the rough drafts of the eventual theory.

A grounded theory study with thin memo-writing is, in practice, just qualitative coding labelled as grounded theory. The memos are not optional documentation; they are the analysis.

## Theoretical sampling and constant comparison

Two procedures distinguish grounded theory from most other qualitative methods.

**Theoretical sampling.** Participant recruitment is iterative and analytically driven. The first round samples for variation on the phenomenon of interest. Each subsequent round is chosen to test, extend, or refine the emerging categories. If your initial codes suggest that experience of X varies by role, the next round of interviews targets participants in roles you haven't yet sampled, even if convenience would point elsewhere. Theoretical sampling continues until saturation (see below).

**Constant comparison.** Every new datum is compared with the existing data, with the existing codes, and with the emerging categories. When a passage doesn't fit an existing code, either the code is wrong or the passage is the start of a new code; either way, the comparison forces a decision and a memo. Constant comparison is what stops grounded-theory coding from becoming autopilot — it converts the act of coding into an analytical question every time.

## Theoretical saturation

Saturation in grounded theory has a specific meaning that has not always survived the term's migration into other methods. It is the point at which theoretical sampling stops producing new properties or dimensions of the existing categories. It is a claim about the categories, not about the interviews.

Charmaz (2014) warns that "saturation" gets invoked as a stopping rule by analysts who haven't done the theoretical sampling that makes the concept meaningful. A study that conveniently sampled 20 interviews and declared saturation has not, technically, reached theoretical saturation — it has run out of interviews. Be specific in the methods section: state the theoretical question, the sampling decisions, and what specifically stopped producing new properties.

## When grounded theory fits

Grounded theory is the right method when:

- The research question is process-oriented ("how does X unfold over time?" or "what social processes constitute Y?") rather than experience-oriented.
- Theory development is the goal, not theory application or description.
- Iterative data collection is feasible — you can recruit participants in subsequent rounds, adapt the interview guide between rounds, and stop when categories saturate. Grounded theory in a study where 30 transcripts are delivered up-front and recruitment is closed is grounded theory in name only.
- The timeline allows for memo-writing alongside coding. Compressed-timeline studies that skip memos should pick a different method and be honest about the choice.

When grounded theory does not fit and a more appropriate method exists, picking the right one is the methodological move. Reflexive thematic analysis (chapter 2) is often the right choice for what gets described as "light-touch grounded theory." IPA (chapter 4) is the right choice for questions about meaning and experience rather than social process.

### Further reading

- Charmaz, K. (2014). _Constructing Grounded Theory_ (2nd ed.). SAGE. The contemporary reference; chapters 4–6 cover the coding sequence in detail.
- Glaser, B. G., & Strauss, A. L. (1967). _The Discovery of Grounded Theory: Strategies for Qualitative Research_. Aldine.
- Strauss, A., & Corbin, J. (1990; 3rd ed. with Corbin 2008). _Basics of Qualitative Research_. SAGE.
- Bryant, A. (2017). _Grounded Theory and Grounded Theorizing: Pragmatism in Research Practice_. Oxford University Press.
- Birks, M., & Mills, J. (2015). _Grounded Theory: A Practical Guide_ (2nd ed.). SAGE.
- Timmermans, S., & Tavory, I. (2012). Theory construction in qualitative research: From grounded theory to abductive analysis. _Sociological Theory_, 30(3), 167–186.

---

# 4. Interpretative Phenomenological Analysis

_Smith's IPA — what the double hermeneutic actually requires of the analyst, why the small sample is a design choice rather than a limitation, and the four-step procedure as it's now written._

## What IPA is

Interpretative Phenomenological Analysis (IPA) is a qualitative method developed by Jonathan Smith in the mid-1990s for the close study of how individuals make sense of major life experiences. Its theoretical commitments are three: _phenomenology_ (a concern with lived experience), _hermeneutics_ (interpretation as the central analytical act), and _idiography_ (a focus on the particular before the general). The combination gives IPA its distinctive small-sample, deep-reading character (Smith, 1996; Smith, Flowers & Larkin, 2022).

IPA is most at home in health psychology, counselling research, illness-narrative work, and other contexts where the research question is some version of "what is it like to live through X, and how do people make sense of it?" It is not the right method for questions about prevalence, about social processes, or about theory construction; chapters 2 and 3 of this guide cover better-fitting alternatives for those.

## The double hermeneutic

The phrase Smith introduced — the double hermeneutic — is the most-cited and least understood part of IPA. It names the layered interpretation involved in IPA work: the participant is interpreting their own experience, and the researcher is interpreting the participant's interpretation. The analyst is one step removed from the experience itself, working on the participant's account of it.

The practical consequence is not philosophical decoration; it is methodological. Three things follow:

- **Verbatim quotation is load-bearing.** IPA papers quote heavily from transcripts because the participant's words are the raw material of the first hermeneutic. Paraphrase loses evidence.
- **The researcher's interpretation is explicit, not hidden.** A good IPA analysis announces its interpretive moves — "what Maya is doing here is locating the disruption in the body rather than in the role" — and lets the reader judge them against the transcript.
- **Positionality matters more than in some other methods.** The researcher's relationship to the phenomenon shapes the second hermeneutic. IPA methods sections routinely include a positionality statement, and the statement is not pro forma.

> "The participant is trying to make sense of their personal and social world; the researcher is trying to make sense of the participant trying to make sense of their personal and social world."
> — Smith, Flowers & Larkin, 2022

## The four-step procedure

Smith, Flowers and Larkin (2022, chapter 5) describe IPA analysis as a six-step procedure; the working summary most analysts actually use is the four-step version. The phases apply to one transcript at a time before cross-case work begins.

**1. Reading and re-reading.** Read the transcript multiple times before analysing. Listen to the audio if you have it. The aim is to let the participant's account become familiar without yet imposing analytical structure. This phase mirrors the "familiarisation" step in thematic analysis but is more pronounced; IPA treats this reading as part of the first hermeneutic.

**2. Exploratory comments.** Annotate the transcript line by line with three layers of comment: _descriptive_ (what is the participant saying), _linguistic_ (how are they saying it — metaphor, pronoun use, repetition, pauses), and _conceptual_ (what does the analyst notice at a more interpretive register). The three layers can be done in passes or interleaved; the output is a transcript with dense margin notes.

**3. Emergent themes.** Group exploratory comments into emergent themes for this case. Themes at this stage are still case-specific; the goal is not yet cross-case synthesis but a coherent map of how this participant makes sense of the phenomenon. Smith, Flowers and Larkin suggest 8–15 emergent themes per case as a working range.

**4. Connecting themes across cases.** After 4–10 cases have been analysed individually, group-level analysis identifies patterns across participants — convergence (where participants share an interpretive move), divergence (where they diverge in instructive ways), and superordinate themes that organise the case-level themes into a higher-order structure. The final write-up moves back and forth between superordinate themes and individual exemplars.

## Why small samples

IPA studies typically use 4–10 participants. This is a design choice grounded in the idiographic commitment, not a pragmatic compromise. The argument: deep interpretive engagement with each case is incompatible with large samples; doubling N halves the analytic attention available per participant, and that attention is what distinguishes IPA from a thinner thematic analysis.

Smith, Flowers and Larkin (2022) suggest specific numbers: undergraduate or master's projects, 3 participants; doctoral theses or papers, 4–10 in homogeneous samples; up to 15 only when the comparison structure of the design warrants it. Larger samples push IPA toward thematic analysis.

> **On generalisation.** The objection that small-N studies don't generalise is the wrong objection. IPA doesn't aim at statistical generalisation. The relevant questions are about transferability and about whether the analysis illuminates the phenomenon in a way that thicker description couldn't. A defensible methods section explains the sampling logic in those terms.

## When IPA fits (and when it doesn't)

IPA is the right method when the research question is about meaning-making in relation to a significant experience, when the sample can be reasonably homogeneous around that experience, and when the timeline allows for deep per-case analysis.

Three signals that IPA is not the right method:

- **The question is about social process or context.** "How do hospital teams negotiate handover practices?" is a grounded-theory question, not an IPA question. IPA's unit of analysis is the individual's sense-making, not the collective practice.
- **The sample is heterogeneous in ways that matter.** IPA assumes participants share enough of the phenomenon for cross-case synthesis to be meaningful. A study of "the experience of chronic illness" across 10 different conditions is too heterogeneous; a study of "the experience of receiving a Type 1 diabetes diagnosis in late adolescence" is the kind of focused sample IPA expects.
- **The data are not narrative.** IPA works on first-person accounts — semi-structured interviews, focus groups (with caveats), diaries, written reflections. Survey free-text responses are usually too thin for the line-by-line work IPA requires.

## Common mistakes in published IPA

Larkin, Watts and Clifton (2006) and Pietkiewicz and Smith (2014) catalogue the most-frequent errors in published IPA. The three worth flagging here:

**Thin interpretation.** Many studies labelled IPA produce what is effectively a descriptive thematic analysis with verbatim quotes — the participant's first hermeneutic is reported, but the analyst's second hermeneutic is missing. The give-away in writing is themes that read as topic labels ("experience of disclosure") rather than interpretive claims ("disclosure as managed risk").

**Over-claiming the sample.** A four-participant IPA study cannot warrant claims about "people with X." The findings are about how these four participants make sense of X. That is a real finding; treating it as a population-level claim is a methodological error reviewers will catch.

**Skipping the idiographic stage.** Studies that go straight to cross-case themes without per-case analysis are not doing IPA. The case-level analysis is what licenses the cross-case work; doing one without the other produces a paper that looks like IPA but reads like thematic analysis.

### Further reading

- Smith, J. A., Flowers, P., & Larkin, M. (2022). _Interpretative Phenomenological Analysis: Theory, Method and Research_ (2nd ed.). SAGE. The contemporary reference.
- Smith, J. A. (1996). Beyond the divide between cognition and discourse: Using interpretative phenomenological analysis in health psychology. _Psychology & Health_, 11(2), 261–271.
- Larkin, M., Watts, S., & Clifton, E. (2006). Giving voice and making sense in interpretative phenomenological analysis. _Qualitative Research in Psychology_, 3(2), 102–120.
- Pietkiewicz, I., & Smith, J. A. (2014). A practical guide to using interpretative phenomenological analysis in qualitative research psychology. _Psychological Journal_, 20(1), 7–14.
- Larkin, M., & Thompson, A. R. (2012). Interpretative phenomenological analysis in mental health and psychotherapy research. In _Qualitative Research Methods in Mental Health and Psychotherapy_ (pp. 99–116). Wiley-Blackwell.

---

# 5. Intercoder reliability

_Cohen's κ, Krippendorff's α, and when each fits — without conceding more than the method actually requires to a positivist framing._

## What you're measuring (and not)

Intercoder reliability (sometimes intercoder agreement, or inter-rater reliability when the coding is numeric) is a statistic that summarises how often two or more coders apply the same code to the same extract. It is not a measure of whether the coding is correct. It is not a measure of whether the codes are good codes. It is a measure of consistency.

The conflation of consistency with correctness is the source of most of the trouble in this area. A codebook can produce κ = .85 across two coders and still be a bad codebook, if the categories are theoretically thin or the inclusion criteria are written so broadly that almost anything fits. The statistic guards against one specific failure mode — idiosyncratic, drifting, or non-replicable coding — and is silent on every other.

With that framing in place, the two statistics worth knowing are Cohen's κ (kappa) and Krippendorff's α (alpha).

## Cohen's κ

Cohen (1960) introduced κ as a chance-corrected agreement statistic for two raters and categorical data. The intuition is straightforward: if two raters agree on 80% of cases, but 60% agreement would happen by chance given the marginal frequencies, then the genuine agreement above chance is what κ captures.

The conventional thresholds (Landis & Koch, 1977) are widely cited and widely overstated:

- **κ < .20** — slight agreement
- **.21–.40** — fair
- **.41–.60** — moderate
- **.61–.80** — substantial
- **.81–1.00** — almost perfect

In practice, .70 is the conventional minimum for publishable qualitative coding, and .80 is the bar in health-services research. The thresholds are heuristic; Landis and Koch invented them without empirical grounding and have been backed away from since (McHugh, 2012).

Cohen's κ has two well-known failure modes. The first is the prevalence problem: with a heavily skewed code (say, 90% of extracts get the code, 10% don't), even high raw agreement can produce a low κ because the chance-correction term is dominated by the marginals. The second is the bias problem: if the two raters apply the code at different overall rates (one rater 30% of extracts, the other 60%), κ penalises that bias even when their agreement on individual decisions is high. Both are well-documented (Feinstein & Cicchetti, 1990).

> **Read the disagreements before believing the number.** A low κ on a heavily-skewed code is sometimes a real signal that the coders disagree on the boundary cases, and sometimes a statistical artefact of the skew. If the disagreements cluster on a definable subset of extracts, fix the codebook entry and recode those cases, then recompute.

## Krippendorff's α

Krippendorff's α (Krippendorff, 2004; Hayes & Krippendorff, 2007) generalises agreement statistics in three useful ways: any number of coders, any level of measurement (nominal, ordinal, interval), and tolerant of missing data. For nominal categorical coding with two coders, α and κ agree to three decimal places in most cases; the choice between them rarely changes the conclusion.

Where α earns its keep:

- **Three or more coders.** Cohen's κ is defined for two raters; the multi-rater extensions (Fleiss's κ, Light's κ) have known instabilities. α handles arbitrary coder counts in one statistic.
- **Partial coverage.** When coders are randomly assigned to subsets of the dataset (a common design when coding is expensive), α handles the unbalanced design correctly; κ does not.
- **Ordinal codes.** If your code is severity-graded (low / moderate / high), α-ordinal credits near-misses appropriately; nominal κ treats low-vs-high as just as wrong as low-vs-moderate.

Conventional α thresholds are similar to κ: above .80 for tentative conclusions, above .67 for cautious conclusions about agreement, below .67 considered unacceptable for substantive claims (Krippendorff, 2004, p. 241).

## The recurring debate

Whether qualitative researchers should report agreement statistics at all is a methodological argument that goes back to the 1980s and resurfaces every few years. The positivist position: any analytical claim should be replicable by another competent analyst; agreement statistics are how you demonstrate that. The interpretivist position: qualitative analysis is, by design, the situated interpretation of a knowledgeable analyst; demanding replicability concedes the wrong epistemology.

The most readable contemporary statement of the interpretivist position is Braun and Clarke (2019), which treats κ as conceptually incoherent for reflexive thematic analysis. The most readable consequence-oriented critique is McDonald, Schoenebeck and Forte (2019) on CSCW/HCI practice: they show that defaulting to κ across all qualitative work produces a fake-rigour aesthetic in journals that reviewers then enforce against work where the statistic doesn't belong.

> "In the absence of meaningful guidelines for when IRR is appropriate, the field has converged on a default that treats κ as a universal marker of qualitative rigour, regardless of whether the underlying methodology actually generates the kind of claim that IRR can support."
> — McDonald, Schoenebeck & Forte, 2019

## A pragmatic position

A defensible practice, written so you can cite it in a methods section:

**Report intercoder agreement when the codebook is intended to be applied beyond a single analyst** — when other researchers will code further data using the same codebook, when coding is part of a structured content analysis with discrete categorical outputs, or when the analytic claim is about prevalence ("X% of participants reported Y") rather than meaning ("participants narrated Y as a turning point").

**Do not report intercoder agreement when the analytic instrument is the analyst's interpretive engagement.** Reflexive thematic analysis, narrative analysis, IPA, and most phenomenological approaches fall here. The methods section should state explicitly that intercoder reliability is not the appropriate quality check for the approach being used, and what is — typically reflexive memos, an audit trail, member checking where appropriate, transparency about the analyst's positionality.

**When you do report κ or α, report it honestly.** Include the per-code breakdown, not just the overall statistic. The overall number can hide a category where κ is .40 and the prose is (intentionally or not) directing the reader to assume the .85 average applies everywhere. The per-category breakdown is also where the actual codebook work shows up.

## In QualCanvas

The intercoder reliability panel (Pro/Team) computes Cohen's κ for any two researchers coding the same canvas and Krippendorff's α when three or more researchers are present. The export gives you the overall statistic, the per-code breakdown, the confusion matrix between any two coders, and a disagreement queue you can step through to refine the codebook.

The disagreement queue is the useful part. The statistic tells you whether you have a problem; the queue tells you what to do about it. Most disagreements cluster on three or four boundary cases per code; an afternoon of joint review and a small codebook clarification usually moves κ from .65 to .80.

### Further reading

- Cohen, J. (1960). A coefficient of agreement for nominal scales. _Educational and Psychological Measurement_, 20(1), 37–46.
- Krippendorff, K. (2004). _Content Analysis: An Introduction to Its Methodology_ (2nd ed.). SAGE.
- Hayes, A. F., & Krippendorff, K. (2007). Answering the call for a standard reliability measure for coding data. _Communication Methods and Measures_, 1(1), 77–89.
- McHugh, M. L. (2012). Interrater reliability: the kappa statistic. _Biochemia Medica_, 22(3), 276–282.
- Feinstein, A. R., & Cicchetti, D. V. (1990). High agreement but low kappa: I. The problems of two paradoxes. _Journal of Clinical Epidemiology_, 43(6), 543–549.
- McDonald, N., Schoenebeck, S., & Forte, A. (2019). Reliability and inter-rater reliability in qualitative research: Norms and guidelines for CSCW and HCI practice. _Proceedings of the ACM on Human-Computer Interaction_, 3(CSCW), 1–23.
- Braun, V., & Clarke, V. (2019). Reflecting on reflexive thematic analysis. _Qualitative Research in Sport, Exercise and Health_, 11(4), 589–597.

---

# 6. Ethics in practice

_Consent as ongoing, the difference between anonymisation and pseudonymisation, retention windows, and when AI assistance becomes a participant-data question._

> This chapter is not legal advice. The jurisdiction-specific obligations under GDPR, HIPAA, NHS Research Ethics, or an institution's IRB are obligations on the researcher; this chapter has not been reviewed by qualified legal counsel.

## Consent as ongoing

The version of consent that most ethics applications describe — signed once, archived in a folder, referenced in the methods section — is the version of consent that's least defensible. Qualitative research participants are consenting to a kind of relationship, not a transaction, and that relationship unfolds in ways that the participant cannot fully anticipate at signing.

The British Psychological Society's _Code of Human Research Ethics_ (2021) frames consent as a process, not an event. The practical reading: a participant who agreed in the recruitment interview to talk about "experiences in higher education" has not, by virtue of that initial agreement, consented to a specific anecdote about a colleague being included in a published paper. Re-consent at publication is the disciplined response; the alternative is the academic-press version of an HR investigation that the participant didn't know they were enabling.

The disciplined practice has four moves:

- **Consent at recruitment** covers participation, recording, and retention. Make the retention window explicit (see below) and time-bounded.
- **Renewable consent** at any unanticipated use beyond the original protocol — a secondary analysis, a conference talk, a book chapter, a teaching example.
- **Right to withdraw** not just from future participation but from the existing dataset, with a clear cutoff (typically until anonymisation is complete and the dataset is locked).
- **An accessible record** of what each participant consented to, version-controlled. If you cannot produce, on request, the precise consent text the participant signed and the date of any subsequent re-consent, the consent record is not actually a record.

## Anonymisation, properly

The terminological confusion is worth getting right: _anonymisation_ is the irreversible removal of identifying information such that re-identification is not reasonably possible by any party. _Pseudonymisation_ is the replacement of direct identifiers with a coded value while the re-identification key is held separately. The two are governed differently — pseudonymised data is still personal data under GDPR Article 4(5); fully anonymised data falls outside GDPR's scope. Most qualitative datasets that describe themselves as "anonymised" are, technically, pseudonymised, and the methods section should say so.

What anonymisation actually requires for interview data:

- **Direct identifiers removed** — names, addresses, dates of birth, phone numbers, email addresses, NHS / SSN numbers.
- **Indirect identifiers altered or generalised** — job titles narrowed to sector, employer disguised, distinctive geographic detail generalised, distinctive biographical events (the specific clinical procedure, the unique role, the named research project) softened or omitted.
- **Within-corpus deduplication.** If two transcripts contain enough overlapping detail that cross-referencing them would re-identify either participant, that's a re-identification risk that removing first names doesn't fix.
- **Test against motivated re-identification.** Ask: could a person who already knew the participant identify them from a published quote? If yes, the quote needs further alteration or shouldn't be quoted verbatim.

The ICO's _Anonymisation Code of Practice_ uses the "motivated intruder" test as the threshold: a reasonably competent person, motivated to re-identify, with access to publicly available resources, should not be able to do so. For qualitative interview data, the motivated intruder is often a colleague of the participant. Plan accordingly.

> **Real anonymisation often degrades the data.** A quote with the job title, the employer, and the specific decision changed becomes a quote that says less. This is a real cost. The right move is to publish less verbatim quotation, not to publish identifiable data with the verb "anonymised" in front of it.

## Retention windows

GDPR Article 5(1)(e) requires personal data to be retained no longer than necessary for the purposes for which it was processed. For qualitative research data, the "necessary" period is usually longer than the active analysis (because of journal verification requests, replication, secondary analysis) and bounded by the consent terms.

Common defensible patterns:

- **Audio recordings:** destroyed within 6–12 months of transcription, unless the audio itself is analytically necessary (e.g. paralinguistic features in conversation analysis).
- **Pseudonymised transcripts:** retained for the funder/institution's minimum (often 10 years in UK research), then either fully anonymised and archived, or destroyed.
- **Re-identification keys (the participant ID ↔ pseudonym mapping):** destroyed at the earliest defensible point, typically once analysis is complete and no foreseeable need to contact participants remains. Keeping the key longer than the dataset is a common protocol violation.
- **Consent forms:** retained for the same minimum period as the data they consent to, stored separately from the data.

## The AI-assistance question

AI-assisted coding raises an ethics question that the 2010s qualitative methods textbooks didn't have to answer: when the analyst's working tool is a third-party large language model, what obligations follow about the data sent to it?

Three pieces of the question matter:

**1. Data transmission.** Sending a transcript excerpt to a model provider is a transfer of (typically pseudonymised) personal data to a processor. Under GDPR, that requires a lawful basis, a Data Processing Agreement with the provider, and disclosure to participants either in the original consent form or via re-consent. Most ethics applications written before 2023 do not cover this. They need amending before AI assistance is used.

**2. Training-data use.** If the model provider may use submitted data to train future models, that is a disclosure that has to be in the consent form, and is in most cases a disclosure that participants would refuse. Use providers and tiers that contractually exclude submitted data from training. QualCanvas's AI calls are routed through providers contracted on zero-data-retention terms; see qualcanvas.com/trust/ai.

**3. The interpretive responsibility.** A code suggested by a model and accepted by an analyst is, ethically, the analyst's code. The methods section should not describe AI-suggested codes as if they were a separate authorial voice. The audit trail should record which codes were AI-suggested; the analytical responsibility remains the researcher's.

> "Researchers retain the responsibility to ensure that their conduct meets relevant ethical standards regardless of the tools they employ."
> — BPS Code of Human Research Ethics, 2021

## IRB / ethics-committee patterns

Three documentation habits make ethics-committee work straightforward at submission and at amendment:

**Version the consent form.** Every change gets a version number and a date. The methods section names the version each participant signed. This sounds bureaucratic; it is — and the day you need to demonstrate to a committee what a participant from 14 months ago actually agreed to, you will be glad of it.

**Keep an analytical audit trail.** Not the codebook (that is its own artefact); a separate log of methodological decisions: when a code was merged, why an interview was excluded, when the AI assistance was disabled for a section, why a quote was paraphrased rather than quoted directly. An audit trail is the qualitative equivalent of a lab notebook. It is the document a viva panel asks for.

**Document the AI usage.** Which provider, which model, which feature (auto-coding, code suggestion, summarisation), what was sent, what was retained. The default UK research ethics committee position in 2026 is that AI-assisted analysis is permissible with explicit disclosure to participants and a written DPA; without those, it is not.

## In QualCanvas

QualCanvas records consent state per participant, retention windows per dataset, and a per-action audit log of AI usage (provider, model, feature, token count). The DPA template at qualcanvas.com/trust/ai is available for download and review by institutional legal or research-governance teams.

What QualCanvas does not do is replace the ethics committee. None of this is legal advice; the jurisdiction-specific obligations under GDPR, HIPAA, NHS Research Ethics, or your institution's IRB are obligations on you. The tooling is here to make compliance with those obligations easier to document.

### Further reading

- British Psychological Society. (2021). _Code of Human Research Ethics_ (3rd ed.). BPS.
- Information Commissioner's Office. (2012; revised draft 2022). _Anonymisation: managing data protection risk code of practice_. ICO.
- European Parliament & Council. (2016). _General Data Protection Regulation_ (Regulation (EU) 2016/679), Articles 4(5), 5(1)(e), 6, 9, 17.
- Iphofen, R. (Ed.). (2020). _Handbook of Research Ethics and Scientific Integrity_. Springer.
- Saldaña, J. (2021). _The Coding Manual for Qualitative Researchers_ (4th ed.). SAGE. Chapter 2 on ethics in coding decisions.
- Mantelero, A. (2023). The Council of Europe and AI in research: _Human Rights Impact Assessment of AI systems_. CoE.
- World Medical Association. (2013, amended 2024). _Declaration of Helsinki_. WMA.

---

## Document metadata

- **Title:** A Practical Methodology Guide for Qualitative Coding
- **Author:** JMS Dev Lab (institutional author)
- **Version:** 1.0
- **Date:** May 2026
- **Companion software:** QualCanvas — https://qualcanvas.com
- **Correspondence:** methodology@qualcanvas.com
- **Keywords:** thematic analysis, grounded theory, interpretative phenomenological analysis, intercoder reliability, CAQDAS, qualitative coding, research ethics

_Draft status: not yet externally peer-reviewed. The ethics chapter is not legal advice._
