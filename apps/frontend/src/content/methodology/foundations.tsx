import EditorialAside from '../../components/marketing/EditorialAside';
import { ChapterSection } from '../../components/marketing/ChapterShell';

export const chapterMeta = {
  number: '1.0',
  title: 'Foundations',
  subtitle:
    'What qualitative coding actually is, why it is interpretive work, and the small set of distinctions you have to get right before any of the later chapters help.',
  readMin: 7,
  updated: 'May 2026',
};

export const sections: ChapterSection[] = [
  { id: 'what-coding-is', label: 'What coding is (and isn’t)' },
  { id: 'inductive-deductive-abductive', label: 'Inductive, deductive, abductive' },
  { id: 'codes-categories-themes', label: 'Codes, categories, themes' },
  { id: 'saturation', label: 'Saturation, honestly' },
  { id: 'before-you-start', label: 'Before you start coding' },
  { id: 'further', label: 'Further reading' },
];

export default function FoundationsChapter() {
  return (
    <>
      <section id="what-coding-is">
        <h2>What coding is (and isn&rsquo;t)</h2>

        <p>
          In qualitative research, coding is the act of attaching short labels to extracts of data &mdash; words,
          phrases, paragraphs, sometimes whole exchanges &mdash; that index something the analyst wants to track. The
          labels are the codes; the extracts are what they apply to. Coding is the way an analyst makes a large
          unstructured corpus interrogable.
        </p>

        <p>
          It is worth being clear about what coding is not. It is not the same as the &ldquo;coding&rdquo; survey
          researchers do when they translate open-ended responses into a fixed taxonomy of categories. It is not a way
          of counting (although codes can be counted). It is not a substitute for analysis &mdash; it is the scaffolding
          on which analysis happens.
        </p>

        <p>
          Saldaña (2021) puts the distinction sharply: a code is &ldquo;a researcher-generated construct that symbolizes
          and thus attributes interpreted meaning to each individual datum for later purposes of pattern detection,
          categorization, theory-building, and other analytic processes.&rdquo; The phrase that matters there is{' '}
          <em>interpreted meaning</em>. Coding is not data entry. It is interpretation, performed early and recorded so
          the interpretation can be argued with later.
        </p>
      </section>

      <section id="inductive-deductive-abductive">
        <h2>Inductive, deductive, abductive</h2>

        <p>Three logics of inference, each producing a recognisably different relationship between codes and data.</p>

        <h3>Inductive coding</h3>
        <p>
          Codes are generated from the data. The analyst reads, notices, labels, and builds a codebook from the ground
          up. Inductive coding is the default for exploratory studies and for traditions (reflexive thematic analysis,
          grounded theory, IPA) that treat the participants&rsquo; framing as the analytical starting point. The risk is
          that &ldquo;purely inductive&rdquo; coding is a methodological fiction &mdash; every analyst arrives with
          priors, and the right move is to declare them rather than pretend they aren&rsquo;t there.
        </p>

        <h3>Deductive coding</h3>
        <p>
          Codes come from theory, prior literature, or a pre-existing framework, and the analyst applies them to new
          data. Deductive coding is the default for framework analysis (Ritchie &amp; Spencer, 1994), for studies
          replicating or extending prior work, and for survey-derived qualitative data. The risk is confirmation: a
          strong prior framework will see itself in the data even where it doesn&rsquo;t fit.
        </p>

        <h3>Abductive coding</h3>
        <p>
          Codes alternate between inductive generation and deductive testing, organised around anomalies &mdash; data
          that doesn&rsquo;t fit the working theory and forces the theory to revise. Timmermans and Tavory (2012) give
          the most-cited contemporary statement. In practice, most coding labelled &ldquo;inductive&rdquo; in methods
          sections is in fact abductive, and saying so is more accurate.
        </p>

        <EditorialAside>
          The methods-section claim &ldquo;codes were developed inductively from the data&rdquo; is almost always wrong
          as written. A version that is closer to what most analysts actually do: &ldquo;an initial round of open coding
          generated 80&ndash;120 codes inductively; these were refined against the literature on X and consolidated into
          a working codebook before the full corpus was coded.&rdquo; That is abductive, and it is defensible.
        </EditorialAside>
      </section>

      <section id="codes-categories-themes">
        <h2>Codes, categories, themes</h2>

        <p>
          These three terms get used interchangeably in undergraduate methods textbooks, which is unfortunate because
          they are not interchangeable. A clean working set of definitions:
        </p>

        <ul>
          <li>
            <strong>A code</strong> is a label applied to a data extract. It is descriptive (&ldquo;mother as primary
            carer&rdquo;), in vivo (a phrase taken directly from a participant: &ldquo;I had to be someone else&rdquo;),
            or analytical (&ldquo;the interrupted self&rdquo;). A study typically generates dozens to low hundreds of
            codes.
          </li>
          <li>
            <strong>A category</strong> is a cluster of related codes that share a topic or descriptive domain.
            &ldquo;Family relationships&rdquo; is a category. Categories are organisational, not yet interpretive.
          </li>
          <li>
            <strong>A theme</strong> is an analytic claim about a pattern that runs through codes (and sometimes
            categories). A theme is an argument the data is making. &ldquo;Family relationships are reframed after a
            caregiving role ends&rdquo; is a theme.
          </li>
        </ul>

        <p>
          A study can have 80 codes, organised into 8 categories, that support 3 themes, and that is a normal,
          well-shaped analysis. A study with 80 codes and 80 themes has skipped a step. A study with 3 codes and 12
          themes is doing something else entirely. Chapter 2 goes into the codes-versus-themes distinction in depth for
          thematic analysis specifically; the same intuition transfers to grounded theory and IPA.
        </p>
      </section>

      <section id="saturation">
        <h2>Saturation, honestly</h2>

        <p>
          Theoretical saturation &mdash; the point at which new data stops producing new codes &mdash; is the
          conventional stopping rule in grounded theory and has migrated into thematic analysis methods sections. The
          problem is that it is, as written, unfalsifiable: the analyst declares saturation reached, and the reader has
          no way to check.
        </p>

        <p>
          Two pieces of recent work are worth knowing. Bowen (2008) walked through the operational ambiguity in the term
          and argued for a transparent reporting standard &mdash; how many interviews, what specifically stopped
          generating new codes, what was the threshold. Hennink, Kaiser and Marconi (2017) showed empirically that for
          in-depth interview studies, code saturation typically occurred by interview 9, but
          <em>meaning saturation</em> (further development of existing codes) required 16&ndash;24 interviews.
        </p>

        <p>
          The defensible practice in 2026: state your stopping rule in advance, report what you observed, and stop using
          &ldquo;saturation&rdquo; as if it were a single threshold. Code saturation, meaning saturation, and
          theoretical saturation are different things; the methods section should say which one you reached.
        </p>
      </section>

      <section id="before-you-start">
        <h2>Before you start coding</h2>

        <p>Three small commitments you should make before opening the first transcript:</p>

        <p>
          <strong>1. Decide which methodology you are doing</strong> &mdash; reflexive TA, codebook TA, grounded theory,
          IPA, framework analysis, narrative analysis &mdash; before any coding. The choice shapes the coding logic
          (inductive / deductive / abductive), whether intercoder agreement is required, how the codebook is structured,
          and what the final report looks like. Picking after the fact is the most common methodological mistake in
          qualitative theses.
        </p>

        <p>
          <strong>2. Write a one-paragraph statement of positionality.</strong> Who is doing the coding, what
          relationship they have to the participants, what they expect to find, and what theoretical priors are in play.
          The point is not confessional; the point is that those priors will shape the codes and naming them early
          disciplines the analyst and helps the reader.
        </p>

        <p>
          <strong>3. Pick a stopping rule</strong> &mdash; in advance. &ldquo;We will code until two consecutive
          interviews produce no new codes against the working codebook&rdquo; is a defensible stopping rule.
          &ldquo;Until saturation&rdquo; without further detail isn&rsquo;t.
        </p>

        <p>
          The five remaining chapters of this guide work through specific methodologies (thematic analysis, grounded
          theory, IPA), one common analytical question (intercoder reliability), and the ethics layer that runs through
          all of them. Start with the chapter that matches the methodology you&rsquo;ve picked, not the one at the top.
        </p>
      </section>

      <section id="further">
        <h2>Further reading</h2>

        <ul>
          <li>
            Saldaña, J. (2021). <em>The Coding Manual for Qualitative Researchers</em> (4th ed.). SAGE.
          </li>
          <li>
            Boyatzis, R. E. (1998).{' '}
            <em>Transforming Qualitative Information: Thematic Analysis and Code Development</em>. SAGE.
          </li>
          <li>
            Timmermans, S., &amp; Tavory, I. (2012). Theory construction in qualitative research: From grounded theory
            to abductive analysis. <em>Sociological Theory</em>, 30(3), 167&ndash;186.
          </li>
          <li>
            Bowen, G. A. (2008). Naturalistic inquiry and the saturation concept: a research note.{' '}
            <em>Qualitative Research</em>, 8(1), 137&ndash;152.
          </li>
          <li>
            Hennink, M. M., Kaiser, B. N., &amp; Marconi, V. C. (2017). Code saturation versus meaning saturation: How
            many interviews are enough? <em>Qualitative Health Research</em>, 27(4), 591&ndash;608.
          </li>
          <li>
            Ritchie, J., &amp; Spencer, L. (1994). Qualitative data analysis for applied policy research. In{' '}
            <em>Analyzing Qualitative Data</em> (pp. 173&ndash;194). Routledge.
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
