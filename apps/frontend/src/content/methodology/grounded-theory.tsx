import PullQuote from '../../components/marketing/PullQuote';
import EditorialAside from '../../components/marketing/EditorialAside';
import { ChapterSection } from '../../components/marketing/ChapterShell';

export const chapterMeta = {
  number: '3.0',
  title: 'Grounded theory',
  subtitle:
    "Charmaz's constructivist grounded theory — from open coding to a theory that's defensible, including the Glaser–Strauss–Charmaz lineage you need to know to pick the right tradition.",
  readMin: 10,
  updated: 'May 2026',
};

export const sections: ChapterSection[] = [
  { id: 'the-promise', label: 'The promise (1967)' },
  { id: 'three-traditions', label: 'Three traditions, one name' },
  { id: 'coding-phases', label: 'Coding: initial → focused → theoretical' },
  { id: 'memos', label: 'Memo-writing as analysis' },
  { id: 'sampling', label: 'Theoretical sampling and constant comparison' },
  { id: 'saturation', label: 'Theoretical saturation' },
  { id: 'when-it-fits', label: 'When grounded theory fits' },
  { id: 'further', label: 'Further reading' },
];

export default function GroundedTheoryChapter() {
  return (
    <>
      <section id="the-promise">
        <h2>The promise (1967)</h2>

        <p>
          Glaser and Strauss&rsquo;s <em>The Discovery of Grounded Theory</em> (1967) made a strong claim: theories
          about social life can be developed systematically from qualitative data, without first deriving hypotheses
          from an existing framework. The argument was situated against mid-century American sociology&rsquo;s tendency
          to test grand theory with quantitative survey work; grounded theory was a rebuttal that put close reading of
          qualitative data at the centre of theory construction.
        </p>

        <p>
          The promise has aged unevenly. The methodological apparatus &mdash; iterative coding, constant comparison,
          memo-writing, theoretical sampling, saturation &mdash; is widely adopted, often outside the full
          grounded-theory paradigm. The epistemological claim &mdash; that theory <em>emerges</em> from data if the
          method is followed properly &mdash; has been substantially revised by every major contemporary proponent,
          including Charmaz, who argues we co-construct rather than discover.
        </p>
      </section>

      <section id="three-traditions">
        <h2>Three traditions, one name</h2>

        <p>
          &ldquo;Grounded theory&rdquo; refers to three substantially different methods, and a methods section that
          doesn&rsquo;t name which one is undefendable.
        </p>

        <h3>Classical (Glaserian) grounded theory</h3>
        <p>
          The original 1967 method as Glaser developed it through the 1970s and 80s. Strict separation between data
          collection and prior theory; the literature review is deferred until after analysis; codes
          &ldquo;emerge&rdquo; from data under a positivist epistemology that treats the analyst as a neutral observer.
          Glaser&rsquo;s 1992 book <em>Basics of Grounded Theory Analysis</em> is in part a direct rejection of the
          direction Strauss took the method.
        </p>

        <h3>Strauss-Corbin grounded theory</h3>
        <p>
          Strauss and Corbin&rsquo;s 1990 textbook introduced a more procedural version with explicit coding paradigms
          (open / axial / selective) and the conditional/consequences matrix. The textbook made grounded theory
          teachable but Glaser argued it forced data into pre-given analytical categories &mdash; the famous
          &ldquo;emergence versus forcing&rdquo; argument. Strauss-Corbin GT remains common in health and nursing
          research; Corbin&rsquo;s 2008 revision softens some of the earlier positions.
        </p>

        <h3>Constructivist (Charmaz) grounded theory</h3>
        <p>
          Charmaz (2006, 2014) rebuilt grounded theory on constructivist foundations: the analyst is not a neutral
          observer; data are co-constructed with participants; the resulting theory is interpreted, not discovered. The
          coding procedure is similar to Strauss-Corbin&rsquo;s in shape (initial → focused → theoretical) but the
          epistemological claims are weaker and the writing is more reflexive. Constructivist GT is the dominant
          tradition in qualitative methods courses in 2026.
        </p>

        <PullQuote attribution="Charmaz, 2014">
          &ldquo;We are not passive receptacles into which data are poured. We are part of what we study&rdquo; &mdash;
          and the theories we develop carry the imprint of our perspective, our questions, and our analytical choices.
        </PullQuote>

        <EditorialAside>
          Pick the tradition before you cite. A methods section that lists Glaser, Strauss-Corbin, and Charmaz in one
          paragraph &mdash; without saying which one is being used &mdash; is the qualitative equivalent of citing
          Frequentist, Bayesian, and likelihood-free inference without picking. Reviewers notice.
        </EditorialAside>
      </section>

      <section id="coding-phases">
        <h2>Coding: initial → focused → theoretical</h2>

        <p>
          Charmaz&rsquo;s coding sequence runs through three phases. The phases are not linear &mdash; you return to
          initial coding when new data complicates focused codes &mdash; but the dominant activity changes.
        </p>

        <h3>Initial coding</h3>
        <p>
          Line-by-line or incident-by-incident coding of early transcripts. Codes are short, active, and as close to the
          data as possible. Charmaz recommends gerund-form codes (&ldquo;reframing identity,&rdquo; &ldquo;negotiating
          care&rdquo;) because they keep the focus on action and process rather than static categories. The output is
          messy: dozens of codes per transcript, many overlapping.
        </p>

        <h3>Focused coding</h3>
        <p>
          The most-applied and most analytically promising of the initial codes are elevated to focused codes, which are
          then applied across the remaining data. Focused codes are fewer (typically 15&ndash;40) and synthesise across
          initial codes. This is where the codebook begins to stabilise.
        </p>

        <h3>Theoretical coding</h3>
        <p>
          The relationships between focused codes are themselves coded. What is the conditional structure (when X
          appears, Y follows; X requires Y as a prerequisite; X and Y are alternative responses to the same condition)?
          Theoretical coding is the move from a codebook to a theory. Glaser&rsquo;s
          <em> Theoretical Sensitivity</em> (1978) catalogues coding families that can prompt this move; Charmaz treats
          them as a non-exhaustive resource rather than a fixed taxonomy.
        </p>
      </section>

      <section id="memos">
        <h2>Memo-writing as analysis</h2>

        <p>
          Memo-writing is the analytical engine of grounded theory. Every code, every emerging category, every
          theoretical hunch gets a memo. Memos are dated, freeform, and accumulate into the analytic record from which
          the eventual theory is written.
        </p>

        <p>Three types of memo are worth distinguishing in practice:</p>

        <ul>
          <li>
            <strong>Code memos</strong> &mdash; what a code is for, what it includes, what it excludes, where the
            boundaries are still ambiguous. Code memos make the codebook defensible.
          </li>
          <li>
            <strong>Operational memos</strong> &mdash; methodological decisions: why an interview was transcribed
            differently, why a code was retired, what was changed in the interview guide after the first three
            participants.
          </li>
          <li>
            <strong>Theoretical memos</strong> &mdash; speculation about relationships between codes, connections to
            existing literature, candidate explanations for puzzling patterns. Theoretical memos are the rough drafts of
            the eventual theory.
          </li>
        </ul>

        <p>
          A grounded theory study with thin memo-writing is, in practice, just qualitative coding labelled as grounded
          theory. The memos are not optional documentation; they are the analysis.
        </p>
      </section>

      <section id="sampling">
        <h2>Theoretical sampling and constant comparison</h2>

        <p>Two procedures distinguish grounded theory from most other qualitative methods.</p>

        <p>
          <strong>Theoretical sampling.</strong> Participant recruitment is iterative and analytically driven. The first
          round samples for variation on the phenomenon of interest. Each subsequent round is chosen to test, extend, or
          refine the emerging categories. If your initial codes suggest that experience of X varies by role, the next
          round of interviews targets participants in roles you haven&rsquo;t yet sampled, even if convenience would
          point elsewhere. Theoretical sampling continues until saturation (see below).
        </p>

        <p>
          <strong>Constant comparison.</strong> Every new datum is compared with the existing data, with the existing
          codes, and with the emerging categories. When a passage doesn&rsquo;t fit an existing code, either the code is
          wrong or the passage is the start of a new code; either way, the comparison forces a decision and a memo.
          Constant comparison is what stops grounded-theory coding from becoming autopilot &mdash; it converts the act
          of coding into an analytical question every time.
        </p>
      </section>

      <section id="saturation">
        <h2>Theoretical saturation</h2>

        <p>
          Saturation in grounded theory has a specific meaning that has not always survived the term&rsquo;s migration
          into other methods. It is the point at which theoretical sampling stops producing new properties or dimensions
          of the existing categories. It is a claim about the categories, not about the interviews.
        </p>

        <p>
          Charmaz (2014) warns that &ldquo;saturation&rdquo; gets invoked as a stopping rule by analysts who
          haven&rsquo;t done the theoretical sampling that makes the concept meaningful. A study that conveniently
          sampled 20 interviews and declared saturation has not, technically, reached theoretical saturation &mdash; it
          has run out of interviews. Be specific in the methods section: state the theoretical question, the sampling
          decisions, and what specifically stopped producing new properties.
        </p>
      </section>

      <section id="when-it-fits">
        <h2>When grounded theory fits</h2>

        <p>Grounded theory is the right method when:</p>

        <ul>
          <li>
            The research question is process-oriented (&ldquo;how does X unfold over time?&rdquo; or &ldquo;what social
            processes constitute Y?&rdquo;) rather than experience-oriented.
          </li>
          <li>Theory development is the goal, not theory application or description.</li>
          <li>
            Iterative data collection is feasible &mdash; you can recruit participants in subsequent rounds, adapt the
            interview guide between rounds, and stop when categories saturate. Grounded theory in a study where 30
            transcripts are delivered up-front and recruitment is closed is grounded theory in name only.
          </li>
          <li>
            The timeline allows for memo-writing alongside coding. Compressed-timeline studies that skip memos should
            pick a different method and be honest about the choice.
          </li>
        </ul>

        <p>
          When grounded theory does not fit and a more appropriate method exists, picking the right one is the
          methodological move. Reflexive thematic analysis (chapter 2) is often the right choice for what gets described
          as &ldquo;light-touch grounded theory.&rdquo; IPA (chapter 4) is the right choice for questions about meaning
          and experience rather than social process.
        </p>
      </section>

      <section id="further">
        <h2>Further reading</h2>

        <ul>
          <li>
            Charmaz, K. (2014). <em>Constructing Grounded Theory</em> (2nd ed.). SAGE. The contemporary reference;
            chapters 4&ndash;6 cover the coding sequence in detail.
          </li>
          <li>
            Glaser, B. G., &amp; Strauss, A. L. (1967).{' '}
            <em>The Discovery of Grounded Theory: Strategies for Qualitative Research</em>. Aldine.
          </li>
          <li>
            Strauss, A., &amp; Corbin, J. (1990; 3rd ed. with Corbin 2008). <em>Basics of Qualitative Research</em>.
            SAGE.
          </li>
          <li>
            Bryant, A. (2017). <em>Grounded Theory and Grounded Theorizing: Pragmatism in Research Practice</em>. Oxford
            University Press.
          </li>
          <li>
            Birks, M., &amp; Mills, J. (2015). <em>Grounded Theory: A Practical Guide</em> (2nd ed.). SAGE.
          </li>
          <li>
            Timmermans, S., &amp; Tavory, I. (2012). Theory construction in qualitative research: From grounded theory
            to abductive analysis. <em>Sociological Theory</em>, 30(3), 167&ndash;186.
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
