import PullQuote from '../../components/marketing/PullQuote';
import EditorialAside from '../../components/marketing/EditorialAside';
import { ChapterSection } from '../../components/marketing/ChapterShell';

export const chapterMeta = {
  number: '2.0',
  title: 'Thematic analysis',
  subtitle:
    "Braun & Clarke's six phases as they're actually practised: with the codebook drift, the reviewer-2 anxiety, and the decisions you defend on the way to a finding.",
  readMin: 12,
  updated: 'May 2026',
};

export const sections: ChapterSection[] = [
  { id: 'what-ta-is', label: 'What thematic analysis is (and isn’t)' },
  { id: 'six-phases', label: "Braun & Clarke's six phases" },
  { id: 'codes-vs-themes', label: 'Codes versus themes' },
  { id: 'codebook', label: 'Building a defensible codebook' },
  { id: 'reflexive-vs-codebook', label: 'Reflexive TA vs codebook TA' },
  { id: 'intercoder', label: 'Intercoder agreement (when it matters)' },
  { id: 'further', label: 'Further reading' },
];

export default function ThematicAnalysisChapter() {
  return (
    <>
      <section id="what-ta-is">
        <h2>What thematic analysis is (and isn&rsquo;t)</h2>

        <p>
          Thematic analysis (TA) is a method for identifying, organising, and interpreting patterns of meaning across
          qualitative data. Braun and Clarke&rsquo;s 2006 article in <em>Qualitative Research in Psychology</em> is the
          canonical reference; it has been cited well over 200,000 times, which is a clue to both its usefulness and the
          trouble that comes with that usefulness.
        </p>

        <p>
          The trouble is this: TA is often picked up as a default method rather than chosen, and presented in methods
          sections as &ldquo;we did thematic analysis&rdquo; without the theoretical orientation that makes the analysis
          defensible. Braun and Clarke have spent the years since 2006 trying to fix that. Their 2021 conceptual paper
          distinguishes <em>reflexive</em> TA, <em>codebook</em> TA, and <em>coding reliability</em> TA &mdash; three
          different methods that share a name and are not interchangeable (Braun &amp; Clarke, 2021).
        </p>

        <p>
          Before the six phases, the choice that matters most is which TA you&rsquo;re doing. The phases are similar
          across variants; the epistemology is not. If a reviewer asks why your codebook didn&rsquo;t go to two coders,
          the answer &mdash; &ldquo;because this is reflexive TA, where the researcher&rsquo;s interpretation is the
          analytic instrument&rdquo; &mdash; is a defensible answer. &ldquo;We forgot&rdquo; is not.
        </p>

        <EditorialAside>
          A useful diagnostic: if you can&rsquo;t state in one sentence whether your themes were generated inductively
          from the data, deductively from a prior framework, or some pragmatic mix, you don&rsquo;t yet know which
          thematic analysis you&rsquo;re doing. Pick before you code, not after.
        </EditorialAside>
      </section>

      <section id="six-phases">
        <h2>Braun &amp; Clarke&rsquo;s six phases</h2>

        <p>
          The phases are not linear. They are recursive. You will go back to phase 2 after starting phase 4, and
          that&rsquo;s the work, not a failure of process. Treat the numbered list as a description of what activity
          dominates at each point.
        </p>

        <h3>1. Familiarisation</h3>
        <p>
          Read the transcripts. Read them again. Write a one-page summary of each one before any coding. The
          familiarisation phase is the only phase where it is acceptable to know nothing and write nothing analytical
          &mdash; you are loading the corpus into your head. Skipping it makes coding faster and the analysis weaker,
          because every code becomes a guess about a transcript you don&rsquo;t fully remember.
        </p>

        <h3>2. Generating initial codes</h3>
        <p>
          Apply short labels to data extracts that strike you as analytically meaningful. Codes at this stage are
          descriptive (&ldquo;mother as primary carer&rdquo;) or in vivo (&ldquo;I had to be someone else&rdquo;).
          Don&rsquo;t worry about consistency yet &mdash; that&rsquo;s phase 5&rsquo;s job. Worry about coverage. If you
          finish a transcript and have only used three codes, you are probably not coding finely enough.
        </p>

        <h3>3. Searching for themes</h3>
        <p>
          Group codes into candidate themes &mdash; clusters of codes that say something coherent about the data. This
          is where TA shifts from descriptive to interpretive. A theme is not a topic (&ldquo;family
          relationships&rdquo;); it is an argument the data is making (&ldquo;family relationships are reframed after a
          caregiving role ends&rdquo;). If your theme would survive being rewritten as a research-question heading,
          it&rsquo;s probably a topic, not a theme.
        </p>

        <h3>4. Reviewing themes</h3>
        <p>
          Test each candidate theme against (a) the coded extracts it&rsquo;s built from, and (b) the full dataset.
          Themes that don&rsquo;t hold up at (b) get demoted, merged, or split. You will discover at this phase that
          some of your early codes were really sub-codes of a more interesting pattern, and a theme you assumed was
          central turns out to be a sub-theme of something else.
        </p>

        <h3>5. Defining and naming themes</h3>
        <p>
          Write a two-to-three-sentence definition of each theme. If you can&rsquo;t, the theme isn&rsquo;t one theme.
          Pick names that do analytic work &mdash; &ldquo;the interrupted self&rdquo; tells a reader what they&rsquo;re
          about to read; &ldquo;identity issues&rdquo; tells them nothing they didn&rsquo;t already assume.
        </p>

        <h3>6. Producing the report</h3>
        <p>
          Write up. The mistake at this phase is treating the report as a separate, post-analytic activity. It
          isn&rsquo;t. Writing surfaces ambiguity, exposes themes that don&rsquo;t hold together, and forces decisions
          you postponed. Expect to return to phases 4 and 5 mid-write-up. The final theme structure often stabilises the
          week the methods section gets drafted.
        </p>

        <PullQuote attribution="Braun & Clarke, 2006">
          &ldquo;Thematic analysis should be seen as a foundational method for qualitative analysis. It is the first
          qualitative method of analysis that researchers should learn, as it provides core skills that will be useful
          for conducting many other forms of qualitative analysis.&rdquo;
        </PullQuote>
      </section>

      <section id="codes-vs-themes">
        <h2>Codes versus themes</h2>

        <p>
          The most-confused distinction in TA: a code is a label applied to a data extract; a theme is an analytic claim
          about a pattern that runs through codes. Codes are the unit of segmentation. Themes are the unit of
          interpretation. A study can have 80 codes and 4 themes, and that is a typical, not a suspicious, ratio.
        </p>

        <p>
          The Braun and Clarke update on this in 2021 was sharper than it sounds: themes are not &ldquo;found&rdquo; in
          the data; they are <em>generated</em> by the analyst from coded extracts. The shift in language matters for
          two reasons. First, it removes the false promise that two analysts coding the same dataset will arrive at the
          same themes &mdash; they should not, if interpretation is doing real work. Second, it forces the methods
          section to take responsibility: it&rsquo;s not that the themes emerged, it&rsquo;s that you wrote them.
        </p>

        <p>
          The practical implication: in QualCanvas, codes are stored objects; themes live in the canvas as the spatial
          groupings you draw between codes. The codebook is not the analysis. The codebook is the working inventory that
          the analysis is built from.
        </p>
      </section>

      <section id="codebook">
        <h2>Building a defensible codebook</h2>

        <p>
          A codebook is the durable record of every code applied to the dataset, with its definition and
          inclusion/exclusion criteria. It is a methodological artefact, not a deliverable. A defensible codebook has
          three properties.
        </p>

        <p>
          <strong>First, code definitions are specific enough to apply.</strong> &ldquo;Caregiving&rdquo; is a topic,
          not a code definition. A code definition that works is: &ldquo;Direct reference to providing care for another
          person, including unpaid family care, paid care work, and the negotiation of care responsibilities. Excludes
          generic discussion of care systems without a specific care relationship.&rdquo; That definition lets you, six
          weeks from now, decide whether a passage about an aunt&rsquo;s end-of-life arrangements gets the code.
        </p>

        <p>
          <strong>Second, the codebook records change over time.</strong> Codes get merged. Codes get split. Codes get
          retired. A codebook that looks the same at the end of analysis as at the start is a codebook that wasn&rsquo;t
          doing analytical work. Keep a short version history alongside the definitions &mdash; what changed and why.
          Reviewer 2 will sometimes ask for this, and even if they don&rsquo;t, having it disciplines your own analysis.
        </p>

        <p>
          <strong>Third, the codebook is exported with the paper.</strong> Most journals now accept a codebook as
          supplementary material. Treat that as the bar. A codebook with definitions, frequencies, and exemplar extracts
          is the qualitative equivalent of releasing your dataset &mdash; not perfectly transparent, but transparent
          enough that a reader can interrogate your interpretive moves.
        </p>

        <p>
          QualCanvas exports the codebook to CSV with definitions, applied-span counts, and per-code exemplar extracts.
          The export goes into the supplementary materials folder. The version history is in the canvas history; you
          don&rsquo;t need to maintain it by hand.
        </p>
      </section>

      <section id="reflexive-vs-codebook">
        <h2>Reflexive TA vs codebook TA</h2>

        <p>
          Reflexive TA (Braun &amp; Clarke, 2019, 2021) treats the analyst&rsquo;s subjectivity as the analytic
          resource, not the analytic problem. There is, deliberately, no second coder. Themes are developed by one
          researcher (or a small team operating as one interpretive voice) and the validity of the analysis rests on the
          depth of engagement and the transparency of the interpretive reasoning.
        </p>

        <p>
          Codebook TA (Boyatzis, 1998; Guest, MacQueen &amp; Namey, 2012; King, 2004) builds the codebook
          collaboratively, applies it consistently across the dataset, and often reports intercoder agreement. The
          analytic stance is closer to a small-scale qualitative content analysis; the goal is replicable coding of a
          defined construct space.
        </p>

        <p>
          The two approaches answer different research questions. If your question is &ldquo;how do recent graduates
          narrate the transition from caregiving back to academic work?&rdquo; that&rsquo;s a reflexive-TA question; the
          analytic instrument <em>is</em> the analyst&rsquo;s reading of the narrative. If your question is &ldquo;what
          proportion of NHS staff reports specific categories of moral distress?&rdquo; that&rsquo;s a codebook-TA
          question, possibly with intercoder reliability reporting.
        </p>

        <p>
          Pick the variant before you start coding and name it in the methods section. The single most common
          methods-paper mistake in TA is doing codebook-style coding (multiple coders, agreement statistics) and calling
          it reflexive TA, or doing reflexive coding (single researcher, deep interpretation) and apologising for the
          lack of a second coder. Pick, defend the choice, move on.
        </p>
      </section>

      <section id="intercoder">
        <h2>Intercoder agreement (when it matters)</h2>

        <p>
          A standing argument in qualitative methods: should you report intercoder reliability for TA? The honest answer
          depends on which TA you&rsquo;re doing. Chapter 5 of this guide goes into the statistics; the summary here is
          methodological.
        </p>

        <p>
          For reflexive TA, intercoder reliability is not just unnecessary; it is conceptually incoherent. The analytic
          instrument is the analyst&rsquo;s interpretive engagement. Demanding two analysts produce the same themes is
          demanding the instrument behave like a different instrument. McDonald, Schoenebeck and Forte (2019) make a
          useful argument that defaulting to κ across all qualitative research imposes a positivist standard on
          interpretive work that doesn&rsquo;t fit.
        </p>

        <p>
          For codebook TA, intercoder reliability is defensible and sometimes expected &mdash; particularly in
          health-services research, in survey-derived qualitative data, and where the codebook is intended to be applied
          by future analysts. Cohen&rsquo;s κ above .70 is the conventional minimum; Krippendorff&rsquo;s α is more
          flexible across coder counts and missing data.
        </p>

        <p>
          The chapter-5 take: pick the agreement statistic that matches the question, report it transparently, and
          don&rsquo;t use a κ above .70 as a substitute for showing that your codes are doing analytical work. A high κ
          on trivially-defined codes is not rigour; it&rsquo;s just two people agreeing on the obvious.
        </p>
      </section>

      <section id="further">
        <h2>Further reading</h2>

        <ul>
          <li>
            Braun, V., &amp; Clarke, V. (2006). Using thematic analysis in psychology.{' '}
            <em>Qualitative Research in Psychology</em>, 3(2), 77&ndash;101.
          </li>
          <li>
            Braun, V., &amp; Clarke, V. (2019). Reflecting on reflexive thematic analysis.{' '}
            <em>Qualitative Research in Sport, Exercise and Health</em>, 11(4), 589&ndash;597.
          </li>
          <li>
            Braun, V., &amp; Clarke, V. (2021). One size fits all? What counts as quality practice in (reflexive)
            thematic analysis? <em>Qualitative Research in Psychology</em>, 18(3), 328&ndash;352.
          </li>
          <li>
            Braun, V., &amp; Clarke, V. (2022). <em>Thematic Analysis: A Practical Guide</em>. SAGE Publications.
          </li>
          <li>
            Boyatzis, R. E. (1998).{' '}
            <em>Transforming Qualitative Information: Thematic Analysis and Code Development</em>. SAGE.
          </li>
          <li>
            Guest, G., MacQueen, K. M., &amp; Namey, E. E. (2012). <em>Applied Thematic Analysis</em>. SAGE.
          </li>
          <li>
            McDonald, N., Schoenebeck, S., &amp; Forte, A. (2019). Reliability and inter-rater reliability in
            qualitative research: Norms and guidelines for CSCW and HCI practice.{' '}
            <em>Proceedings of the ACM on Human-Computer Interaction</em>, 3(CSCW), 1&ndash;23.
          </li>
        </ul>

        <p className="text-sm text-gray-500 dark:text-gray-400 mt-10">
          This chapter is in draft. It has not yet been peer-reviewed by an external methodologist. Reviewer contact:{' '}
          <a href="mailto:methodology@qualcanvas.com" className="underline decoration-ochre-500 underline-offset-2">
            methodology@qualcanvas.com
          </a>
          .
        </p>
      </section>
    </>
  );
}
