import PullQuote from '../../components/marketing/PullQuote';
import EditorialAside from '../../components/marketing/EditorialAside';
import { ChapterSection } from '../../components/marketing/ChapterShell';

export const chapterMeta = {
  number: '5.0',
  title: 'Intercoder reliability',
  subtitle:
    "Cohen's κ, Krippendorff's α, and when each fits — without conceding more than the method actually requires to a positivist framing.",
  readMin: 6,
  updated: 'May 2026',
};

export const sections: ChapterSection[] = [
  { id: 'what-you-measure', label: 'What you’re measuring (and not)' },
  { id: 'cohens-k', label: 'Cohen’s κ' },
  { id: 'krippendorffs-a', label: 'Krippendorff’s α' },
  { id: 'debate', label: 'The recurring debate' },
  { id: 'pragmatic', label: 'A pragmatic position' },
  { id: 'in-practice', label: 'In QualCanvas' },
  { id: 'further', label: 'Further reading' },
];

export default function IntercoderReliabilityChapter() {
  return (
    <>
      <section id="what-you-measure">
        <h2>What you&rsquo;re measuring (and not)</h2>

        <p>
          Intercoder reliability (sometimes intercoder agreement, or inter-rater reliability when the coding is numeric)
          is a statistic that summarises how often two or more coders apply the same code to the same extract. It is not
          a measure of whether the coding is correct. It is not a measure of whether the codes are good codes. It is a
          measure of consistency.
        </p>

        <p>
          The conflation of consistency with correctness is the source of most of the trouble in this area. A codebook
          can produce κ = .85 across two coders and still be a bad codebook, if the categories are theoretically thin or
          the inclusion criteria are written so broadly that almost anything fits. The statistic guards against one
          specific failure mode &mdash; idiosyncratic, drifting, or non-replicable coding &mdash; and is silent on every
          other.
        </p>

        <p>
          With that framing in place, the two statistics worth knowing are Cohen&rsquo;s κ (kappa) and
          Krippendorff&rsquo;s α (alpha).
        </p>
      </section>

      <section id="cohens-k">
        <h2>Cohen&rsquo;s κ</h2>

        <p>
          Cohen (1960) introduced κ as a chance-corrected agreement statistic for two raters and categorical data. The
          intuition is straightforward: if two raters agree on 80% of cases, but 60% agreement would happen by chance
          given the marginal frequencies, then the genuine agreement above chance is what κ captures.
        </p>

        <p>The conventional thresholds (Landis &amp; Koch, 1977) are widely cited and widely overstated:</p>

        <ul>
          <li>
            <strong>κ &lt; .20</strong> &mdash; slight agreement
          </li>
          <li>
            <strong>.21&ndash;.40</strong> &mdash; fair
          </li>
          <li>
            <strong>.41&ndash;.60</strong> &mdash; moderate
          </li>
          <li>
            <strong>.61&ndash;.80</strong> &mdash; substantial
          </li>
          <li>
            <strong>.81&ndash;1.00</strong> &mdash; almost perfect
          </li>
        </ul>

        <p>
          In practice, .70 is the conventional minimum for publishable qualitative coding, and .80 is the bar in
          health-services research. The thresholds are heuristic; Landis and Koch invented them without empirical
          grounding and have been backed away from since (McHugh, 2012).
        </p>

        <p>
          Cohen&rsquo;s κ has two well-known failure modes. The first is the prevalence problem: with a heavily skewed
          code (say, 90% of extracts get the code, 10% don&rsquo;t), even high raw agreement can produce a low κ because
          the chance-correction term is dominated by the marginals. The second is the bias problem: if the two raters
          apply the code at different overall rates (one rater 30% of extracts, the other 60%), κ penalises that bias
          even when their agreement on individual decisions is high. Both are well-documented (Feinstein &amp;
          Cicchetti, 1990).
        </p>

        <EditorialAside>
          A low κ on a heavily-skewed code is sometimes a real signal that the coders disagree on the boundary cases,
          and sometimes a statistical artefact of the skew. Read the disagreements before believing the number; if the
          disagreements cluster on a definable subset of extracts, fix the codebook entry and recode those cases, then
          recompute.
        </EditorialAside>
      </section>

      <section id="krippendorffs-a">
        <h2>Krippendorff&rsquo;s α</h2>

        <p>
          Krippendorff&rsquo;s α (Krippendorff, 2004; Hayes &amp; Krippendorff, 2007) generalises agreement statistics
          in three useful ways: any number of coders, any level of measurement (nominal, ordinal, interval), and
          tolerant of missing data. For nominal categorical coding with two coders, α and κ agree to three decimal
          places in most cases; the choice between them rarely changes the conclusion.
        </p>

        <p>Where α earns its keep:</p>

        <ul>
          <li>
            <strong>Three or more coders.</strong> Cohen&rsquo;s κ is defined for two raters; the multi-rater extensions
            (Fleiss&rsquo;s κ, Light&rsquo;s κ) have known instabilities. α handles arbitrary coder counts in one
            statistic.
          </li>
          <li>
            <strong>Partial coverage.</strong> When coders are randomly assigned to subsets of the dataset (a common
            design when coding is expensive), α handles the unbalanced design correctly; κ does not.
          </li>
          <li>
            <strong>Ordinal codes.</strong> If your code is severity-graded (low / moderate / high), α-ordinal credits
            near-misses appropriately; nominal κ treats low-vs-high as just as wrong as low-vs-moderate.
          </li>
        </ul>

        <p>
          Conventional α thresholds are similar to κ: above .80 for tentative conclusions, above .67 for cautious
          conclusions about agreement, below .67 considered unacceptable for substantive claims (Krippendorff, 2004, p.
          241).
        </p>
      </section>

      <section id="debate">
        <h2>The recurring debate</h2>

        <p>
          Whether qualitative researchers should report agreement statistics at all is a methodological argument that
          goes back to the 1980s and resurfaces every few years. The positivist position: any analytical claim should be
          replicable by another competent analyst; agreement statistics are how you demonstrate that. The interpretivist
          position: qualitative analysis is, by design, the situated interpretation of a knowledgeable analyst;
          demanding replicability concedes the wrong epistemology.
        </p>

        <p>
          The most readable contemporary statement of the interpretivist position is Braun and Clarke (2019), which
          treats κ as conceptually incoherent for reflexive thematic analysis. The most readable consequence-oriented
          critique is McDonald, Schoenebeck and Forte (2019) on CSCW/HCI practice: they show that defaulting to κ across
          all qualitative work produces a fake-rigour aesthetic in journals that reviewers then enforce against work
          where the statistic doesn&rsquo;t belong.
        </p>

        <PullQuote attribution="McDonald, Schoenebeck & Forte, 2019">
          &ldquo;In the absence of meaningful guidelines for when IRR is appropriate, the field has converged on a
          default that treats κ as a universal marker of qualitative rigour, regardless of whether the underlying
          methodology actually generates the kind of claim that IRR can support.&rdquo;
        </PullQuote>
      </section>

      <section id="pragmatic">
        <h2>A pragmatic position</h2>

        <p>A defensible practice, written so you can cite it in a methods section:</p>

        <p>
          <strong>
            Report intercoder agreement when the codebook is intended to be applied beyond a single analyst
          </strong>{' '}
          &mdash; when other researchers will code further data using the same codebook, when coding is part of a
          structured content analysis with discrete categorical outputs, or when the analytic claim is about prevalence
          (&ldquo;X% of participants reported Y&rdquo;) rather than meaning (&ldquo;participants narrated Y as a turning
          point&rdquo;).
        </p>

        <p>
          <strong>
            Do not report intercoder agreement when the analytic instrument is the analyst&rsquo;s interpretive
            engagement.
          </strong>{' '}
          Reflexive thematic analysis, narrative analysis, IPA, and most phenomenological approaches fall here. The
          methods section should state explicitly that intercoder reliability is not the appropriate quality check for
          the approach being used, and what is &mdash; typically reflexive memos, an audit trail, member checking where
          appropriate, transparency about the analyst&rsquo;s positionality.
        </p>

        <p>
          <strong>When you do report κ or α, report it honestly.</strong> Include the per-code breakdown, not just the
          overall statistic. The overall number can hide a category where κ is .40 and the prose is (intentionally or
          not) directing the reader to assume the .85 average applies everywhere. The per-category breakdown is also
          where the actual codebook work shows up.
        </p>
      </section>

      <section id="in-practice">
        <h2>In QualCanvas</h2>

        <p>
          The intercoder reliability panel (Pro/Team) computes Cohen&rsquo;s κ for any two researchers coding the same
          canvas and Krippendorff&rsquo;s α when three or more researchers are present. The export gives you the overall
          statistic, the per-code breakdown, the confusion matrix between any two coders, and a disagreement queue you
          can step through to refine the codebook.
        </p>

        <p>
          The disagreement queue is the useful part. The statistic tells you whether you have a problem; the queue tells
          you what to do about it. Most disagreements cluster on three or four boundary cases per code; an afternoon of
          joint review and a small codebook clarification usually moves κ from .65 to .80.
        </p>
      </section>

      <section id="further">
        <h2>Further reading</h2>

        <ul>
          <li>
            Cohen, J. (1960). A coefficient of agreement for nominal scales.{' '}
            <em>Educational and Psychological Measurement</em>, 20(1), 37&ndash;46.
          </li>
          <li>
            Krippendorff, K. (2004). <em>Content Analysis: An Introduction to Its Methodology</em> (2nd ed.). SAGE.
          </li>
          <li>
            Hayes, A. F., &amp; Krippendorff, K. (2007). Answering the call for a standard reliability measure for
            coding data. <em>Communication Methods and Measures</em>, 1(1), 77&ndash;89.
          </li>
          <li>
            McHugh, M. L. (2012). Interrater reliability: the kappa statistic. <em>Biochemia Medica</em>, 22(3),
            276&ndash;282.
          </li>
          <li>
            Feinstein, A. R., &amp; Cicchetti, D. V. (1990). High agreement but low kappa: I. The problems of two
            paradoxes. <em>Journal of Clinical Epidemiology</em>, 43(6), 543&ndash;549.
          </li>
          <li>
            McDonald, N., Schoenebeck, S., &amp; Forte, A. (2019). Reliability and inter-rater reliability in
            qualitative research: Norms and guidelines for CSCW and HCI practice.{' '}
            <em>Proceedings of the ACM on Human-Computer Interaction</em>, 3(CSCW), 1&ndash;23.
          </li>
          <li>
            Braun, V., &amp; Clarke, V. (2019). Reflecting on reflexive thematic analysis.{' '}
            <em>Qualitative Research in Sport, Exercise and Health</em>, 11(4), 589&ndash;597.
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
