import PullQuote from '../../components/marketing/PullQuote';
import EditorialAside from '../../components/marketing/EditorialAside';
import { ChapterSection } from '../../components/marketing/ChapterShell';

export const chapterMeta = {
  number: '4.0',
  title: 'Interpretative Phenomenological Analysis',
  subtitle:
    "Smith's IPA — what the double hermeneutic actually requires of the analyst, why the small sample is a design choice rather than a limitation, and the four-step procedure as it's now written.",
  readMin: 8,
  updated: 'May 2026',
};

export const sections: ChapterSection[] = [
  { id: 'what-ipa-is', label: 'What IPA is' },
  { id: 'double-hermeneutic', label: 'The double hermeneutic' },
  { id: 'four-steps', label: 'The four-step procedure' },
  { id: 'sample-size', label: 'Why small samples' },
  { id: 'when-it-fits', label: 'When IPA fits (and when it doesn’t)' },
  { id: 'common-mistakes', label: 'Common mistakes in published IPA' },
  { id: 'further', label: 'Further reading' },
];

export default function IpaChapter() {
  return (
    <>
      <section id="what-ipa-is">
        <h2>What IPA is</h2>

        <p>
          Interpretative Phenomenological Analysis (IPA) is a qualitative method developed by Jonathan Smith in the
          mid-1990s for the close study of how individuals make sense of major life experiences. Its theoretical
          commitments are three: <em>phenomenology</em> (a concern with lived experience), <em>hermeneutics</em>{' '}
          (interpretation as the central analytical act), and <em>idiography</em> (a focus on the particular before the
          general). The combination gives IPA its distinctive small-sample, deep-reading character (Smith, 1996; Smith,
          Flowers &amp; Larkin, 2022).
        </p>

        <p>
          IPA is most at home in health psychology, counselling research, illness-narrative work, and other contexts
          where the research question is some version of &ldquo;what is it like to live through X, and how do people
          make sense of it?&rdquo; It is not the right method for questions about prevalence, about social processes, or
          about theory construction; chapters 2 and 3 of this guide cover better-fitting alternatives for those.
        </p>
      </section>

      <section id="double-hermeneutic">
        <h2>The double hermeneutic</h2>

        <p>
          The phrase Smith introduced &mdash; the double hermeneutic &mdash; is the most-cited and least understood part
          of IPA. It names the layered interpretation involved in IPA work: the participant is interpreting their own
          experience, and the researcher is interpreting the participant&rsquo;s interpretation. The analyst is one step
          removed from the experience itself, working on the participant&rsquo;s account of it.
        </p>

        <p>The practical consequence is not philosophical decoration; it is methodological. Three things follow:</p>

        <ul>
          <li>
            <strong>Verbatim quotation is load-bearing.</strong> IPA papers quote heavily from transcripts because the
            participant&rsquo;s words are the raw material of the first hermeneutic. Paraphrase loses evidence.
          </li>
          <li>
            <strong>The researcher&rsquo;s interpretation is explicit, not hidden.</strong> A good IPA analysis
            announces its interpretive moves &mdash; &ldquo;what Maya is doing here is locating the disruption in the
            body rather than in the role&rdquo; &mdash; and lets the reader judge them against the transcript.
          </li>
          <li>
            <strong>Positionality matters more than in some other methods.</strong> The researcher&rsquo;s relationship
            to the phenomenon shapes the second hermeneutic. IPA methods sections routinely include a positionality
            statement, and the statement is not pro forma.
          </li>
        </ul>

        <PullQuote attribution="Smith, Flowers & Larkin, 2022">
          &ldquo;The participant is trying to make sense of their personal and social world; the researcher is trying to
          make sense of the participant trying to make sense of their personal and social world.&rdquo;
        </PullQuote>
      </section>

      <section id="four-steps">
        <h2>The four-step procedure</h2>

        <p>
          Smith, Flowers and Larkin (2022, chapter 5) describe IPA analysis as a six-step procedure; the working summary
          most analysts actually use is the four-step version. The phases apply to one transcript at a time before
          cross-case work begins.
        </p>

        <h3>1. Reading and re-reading</h3>
        <p>
          Read the transcript multiple times before analysing. Listen to the audio if you have it. The aim is to let the
          participant&rsquo;s account become familiar without yet imposing analytical structure. This phase mirrors the
          &ldquo;familiarisation&rdquo; step in thematic analysis but is more pronounced; IPA treats this reading as
          part of the first hermeneutic.
        </p>

        <h3>2. Exploratory comments</h3>
        <p>
          Annotate the transcript line by line with three layers of comment: <em>descriptive</em> (what is the
          participant saying), <em>linguistic</em> (how are they saying it &mdash; metaphor, pronoun use, repetition,
          pauses), and <em>conceptual</em> (what does the analyst notice at a more interpretive register). The three
          layers can be done in passes or interleaved; the output is a transcript with dense margin notes.
        </p>

        <h3>3. Emergent themes</h3>
        <p>
          Group exploratory comments into emergent themes for this case. Themes at this stage are still case-specific;
          the goal is not yet cross-case synthesis but a coherent map of how this participant makes sense of the
          phenomenon. Smith, Flowers and Larkin suggest 8&ndash;15 emergent themes per case as a working range.
        </p>

        <h3>4. Connecting themes across cases</h3>
        <p>
          After 4&ndash;10 cases have been analysed individually, group-level analysis identifies patterns across
          participants &mdash; convergence (where participants share an interpretive move), divergence (where they
          diverge in instructive ways), and superordinate themes that organise the case-level themes into a higher-order
          structure. The final write-up moves back and forth between superordinate themes and individual exemplars.
        </p>
      </section>

      <section id="sample-size">
        <h2>Why small samples</h2>

        <p>
          IPA studies typically use 4&ndash;10 participants. This is a design choice grounded in the idiographic
          commitment, not a pragmatic compromise. The argument: deep interpretive engagement with each case is
          incompatible with large samples; doubling N halves the analytic attention available per participant, and that
          attention is what distinguishes IPA from a thinner thematic analysis.
        </p>

        <p>
          Smith, Flowers and Larkin (2022) suggest specific numbers: undergraduate or master&rsquo;s projects, 3
          participants; doctoral theses or papers, 4&ndash;10 in homogeneous samples; up to 15 only when the comparison
          structure of the design warrants it. Larger samples push IPA toward thematic analysis.
        </p>

        <EditorialAside>
          The objection that small-N studies don&rsquo;t generalise is the wrong objection. IPA doesn&rsquo;t aim at
          statistical generalisation. The relevant questions are about transferability and about whether the analysis
          illuminates the phenomenon in a way that thicker description couldn&rsquo;t. A defensible methods section
          explains the sampling logic in those terms.
        </EditorialAside>
      </section>

      <section id="when-it-fits">
        <h2>When IPA fits (and when it doesn&rsquo;t)</h2>

        <p>
          IPA is the right method when the research question is about meaning-making in relation to a significant
          experience, when the sample can be reasonably homogeneous around that experience, and when the timeline allows
          for deep per-case analysis.
        </p>

        <p>Three signals that IPA is not the right method:</p>

        <ul>
          <li>
            <strong>The question is about social process or context.</strong> &ldquo;How do hospital teams negotiate
            handover practices?&rdquo; is a grounded-theory question, not an IPA question. IPA&rsquo;s unit of analysis
            is the individual&rsquo;s sense-making, not the collective practice.
          </li>
          <li>
            <strong>The sample is heterogeneous in ways that matter.</strong> IPA assumes participants share enough of
            the phenomenon for cross-case synthesis to be meaningful. A study of &ldquo;the experience of chronic
            illness&rdquo; across 10 different conditions is too heterogeneous; a study of &ldquo;the experience of
            receiving a Type 1 diabetes diagnosis in late adolescence&rdquo; is the kind of focused sample IPA expects.
          </li>
          <li>
            <strong>The data are not narrative.</strong> IPA works on first-person accounts &mdash; semi-structured
            interviews, focus groups (with caveats), diaries, written reflections. Survey free-text responses are
            usually too thin for the line-by-line work IPA requires.
          </li>
        </ul>
      </section>

      <section id="common-mistakes">
        <h2>Common mistakes in published IPA</h2>

        <p>
          Larkin, Watts and Clifton (2006) and Pietkiewicz and Smith (2014) catalogue the most-frequent errors in
          published IPA. The three worth flagging here:
        </p>

        <p>
          <strong>Thin interpretation.</strong> Many studies labelled IPA produce what is effectively a descriptive
          thematic analysis with verbatim quotes &mdash; the participant&rsquo;s first hermeneutic is reported, but the
          analyst&rsquo;s second hermeneutic is missing. The give-away in writing is themes that read as topic labels
          (&ldquo;experience of disclosure&rdquo;) rather than interpretive claims (&ldquo;disclosure as managed
          risk&rdquo;).
        </p>

        <p>
          <strong>Over-claiming the sample.</strong> A four-participant IPA study cannot warrant claims about
          &ldquo;people with X.&rdquo; The findings are about how these four participants make sense of X. That is a
          real finding; treating it as a population-level claim is a methodological error reviewers will catch.
        </p>

        <p>
          <strong>Skipping the idiographic stage.</strong> Studies that go straight to cross-case themes without
          per-case analysis are not doing IPA. The case-level analysis is what licenses the cross-case work; doing one
          without the other produces a paper that looks like IPA but reads like thematic analysis.
        </p>
      </section>

      <section id="further">
        <h2>Further reading</h2>

        <ul>
          <li>
            Smith, J. A., Flowers, P., &amp; Larkin, M. (2022).{' '}
            <em>Interpretative Phenomenological Analysis: Theory, Method and Research</em> (2nd ed.). SAGE. The
            contemporary reference.
          </li>
          <li>
            Smith, J. A. (1996). Beyond the divide between cognition and discourse: Using interpretative
            phenomenological analysis in health psychology. <em>Psychology &amp; Health</em>, 11(2), 261&ndash;271.
          </li>
          <li>
            Larkin, M., Watts, S., &amp; Clifton, E. (2006). Giving voice and making sense in interpretative
            phenomenological analysis. <em>Qualitative Research in Psychology</em>, 3(2), 102&ndash;120.
          </li>
          <li>
            Pietkiewicz, I., &amp; Smith, J. A. (2014). A practical guide to using interpretative phenomenological
            analysis in qualitative research psychology. <em>Psychological Journal</em>, 20(1), 7&ndash;14.
          </li>
          <li>
            Larkin, M., &amp; Thompson, A. R. (2012). Interpretative phenomenological analysis in mental health and
            psychotherapy research. In <em>Qualitative Research Methods in Mental Health and Psychotherapy</em> (pp.
            99&ndash;116). Wiley-Blackwell.
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
