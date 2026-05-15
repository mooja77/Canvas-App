import PullQuote from '../../components/marketing/PullQuote';
import EditorialAside from '../../components/marketing/EditorialAside';
import { ChapterSection } from '../../components/marketing/ChapterShell';

export const chapterMeta = {
  number: '6.0',
  title: 'Ethics in practice',
  subtitle:
    'Consent as ongoing, the difference between anonymisation and pseudonymisation, retention windows, and when AI assistance becomes a participant-data question.',
  readMin: 9,
  updated: 'May 2026',
};

export const sections: ChapterSection[] = [
  { id: 'consent', label: 'Consent as ongoing' },
  { id: 'anonymisation', label: 'Anonymisation, properly' },
  { id: 'retention', label: 'Retention windows' },
  { id: 'ai-question', label: 'The AI-assistance question' },
  { id: 'irb', label: 'IRB / ethics-committee patterns' },
  { id: 'in-practice', label: 'In QualCanvas' },
  { id: 'further', label: 'Further reading' },
];

export default function EthicsInPracticeChapter() {
  return (
    <>
      <section id="consent">
        <h2>Consent as ongoing</h2>

        <p>
          The version of consent that most ethics applications describe &mdash; signed once, archived in a folder,
          referenced in the methods section &mdash; is the version of consent that&rsquo;s least defensible. Qualitative
          research participants are consenting to a kind of relationship, not a transaction, and that relationship
          unfolds in ways that the participant cannot fully anticipate at signing.
        </p>

        <p>
          The British Psychological Society&rsquo;s <em>Code of Human Research Ethics</em> (2021) frames consent as a
          process, not an event. The practical reading: a participant who agreed in the recruitment interview to talk
          about &ldquo;experiences in higher education&rdquo; has not, by virtue of that initial agreement, consented to
          a specific anecdote about a colleague being included in a published paper. Re-consent at publication is the
          disciplined response; the alternative is the academic-press version of an HR investigation that the
          participant didn&rsquo;t know they were enabling.
        </p>

        <p>The disciplined practice has four moves:</p>

        <ul>
          <li>
            <strong>Consent at recruitment</strong> covers participation, recording, and retention. Make the retention
            window explicit (see below) and time-bounded.
          </li>
          <li>
            <strong>Renewable consent</strong> at any unanticipated use beyond the original protocol &mdash; a secondary
            analysis, a conference talk, a book chapter, a teaching example.
          </li>
          <li>
            <strong>Right to withdraw</strong> not just from future participation but from the existing dataset, with a
            clear cutoff (typically until anonymisation is complete and the dataset is locked).
          </li>
          <li>
            <strong>An accessible record</strong> of what each participant consented to, version-controlled. If you
            cannot produce, on request, the precise consent text the participant signed and the date of any subsequent
            re-consent, the consent record is not actually a record.
          </li>
        </ul>
      </section>

      <section id="anonymisation">
        <h2>Anonymisation, properly</h2>

        <p>
          The terminological confusion is worth getting right: <em>anonymisation</em> is the irreversible removal of
          identifying information such that re-identification is not reasonably possible by any party.{' '}
          <em>Pseudonymisation</em> is the replacement of direct identifiers with a coded value while the
          re-identification key is held separately. The two are governed differently &mdash; pseudonymised data is still
          personal data under GDPR Article 4(5); fully anonymised data falls outside GDPR&rsquo;s scope. Most
          qualitative datasets that describe themselves as &ldquo;anonymised&rdquo; are, technically, pseudonymised, and
          the methods section should say so.
        </p>

        <p>What anonymisation actually requires for interview data:</p>

        <ul>
          <li>
            <strong>Direct identifiers removed</strong> &mdash; names, addresses, dates of birth, phone numbers, email
            addresses, NHS / SSN numbers.
          </li>
          <li>
            <strong>Indirect identifiers altered or generalised</strong> &mdash; job titles narrowed to sector, employer
            disguised, distinctive geographic detail generalised, distinctive biographical events (the specific clinical
            procedure, the unique role, the named research project) softened or omitted.
          </li>
          <li>
            <strong>Within-corpus deduplication.</strong> If two transcripts contain enough overlapping detail that
            cross-referencing them would re-identify either participant, that&rsquo;s a re-identification risk that
            removing first names doesn&rsquo;t fix.
          </li>
          <li>
            <strong>Test against motivated re-identification.</strong> Ask: could a person who already knew the
            participant identify them from a published quote? If yes, the quote needs further alteration or
            shouldn&rsquo;t be quoted verbatim.
          </li>
        </ul>

        <p>
          The ICO&rsquo;s <em>Anonymisation Code of Practice</em> uses the &ldquo;motivated intruder&rdquo; test as the
          threshold: a reasonably competent person, motivated to re-identify, with access to publicly available
          resources, should not be able to do so. For qualitative interview data, the motivated intruder is often a
          colleague of the participant. Plan accordingly.
        </p>

        <EditorialAside>
          Real anonymisation often degrades the data. A quote with the job title, the employer, and the specific
          decision changed becomes a quote that says less. This is a real cost. The right move is to publish less
          verbatim quotation, not to publish identifiable data with the verb &ldquo;anonymised&rdquo; in front of it.
        </EditorialAside>
      </section>

      <section id="retention">
        <h2>Retention windows</h2>

        <p>
          GDPR Article 5(1)(e) requires personal data to be retained no longer than necessary for the purposes for which
          it was processed. For qualitative research data, the &ldquo;necessary&rdquo; period is usually longer than the
          active analysis (because of journal verification requests, replication, secondary analysis) and bounded by the
          consent terms.
        </p>

        <p>Common defensible patterns:</p>

        <ul>
          <li>
            <strong>Audio recordings:</strong> destroyed within 6&ndash;12 months of transcription, unless the audio
            itself is analytically necessary (e.g. paralinguistic features in conversation analysis).
          </li>
          <li>
            <strong>Pseudonymised transcripts:</strong> retained for the funder/institution&rsquo;s minimum (often 10
            years in UK research), then either fully anonymised and archived, or destroyed.
          </li>
          <li>
            <strong>Re-identification keys (the participant ID &harr; pseudonym mapping):</strong> destroyed at the
            earliest defensible point, typically once analysis is complete and no foreseeable need to contact
            participants remains. Keeping the key longer than the dataset is a common protocol violation.
          </li>
          <li>
            <strong>Consent forms:</strong> retained for the same minimum period as the data they consent to, stored
            separately from the data.
          </li>
        </ul>
      </section>

      <section id="ai-question">
        <h2>The AI-assistance question</h2>

        <p>
          AI-assisted coding raises an ethics question that the 2010s qualitative methods textbooks didn&rsquo;t have to
          answer: when the analyst&rsquo;s working tool is a third-party large language model, what obligations follow
          about the data sent to it?
        </p>

        <p>Three pieces of the question matter:</p>

        <p>
          <strong>1. Data transmission.</strong> Sending a transcript excerpt to a model provider is a transfer of
          (typically pseudonymised) personal data to a processor. Under GDPR, that requires a lawful basis, a Data
          Processing Agreement with the provider, and disclosure to participants either in the original consent form or
          via re-consent. Most ethics applications written before 2023 do not cover this. They need amending before AI
          assistance is used.
        </p>

        <p>
          <strong>2. Training-data use.</strong> If the model provider may use submitted data to train future models,
          that is a disclosure that has to be in the consent form, and is in most cases a disclosure that participants
          would refuse. Use providers and tiers that contractually exclude submitted data from training.
          QualCanvas&rsquo;s AI calls are routed through providers contracted on zero-data-retention terms; see{' '}
          <a href="/trust/ai">trust/ai</a>.
        </p>

        <p>
          <strong>3. The interpretive responsibility.</strong> A code suggested by a model and accepted by an analyst
          is, ethically, the analyst&rsquo;s code. The methods section should not describe AI-suggested codes as if they
          were a separate authorial voice. The audit trail should record which codes were AI-suggested; the analytical
          responsibility remains the researcher&rsquo;s.
        </p>

        <PullQuote attribution="BPS Code of Human Research Ethics, 2021">
          &ldquo;Researchers retain the responsibility to ensure that their conduct meets relevant ethical standards
          regardless of the tools they employ.&rdquo;
        </PullQuote>
      </section>

      <section id="irb">
        <h2>IRB / ethics-committee patterns</h2>

        <p>Three documentation habits make ethics-committee work straightforward at submission and at amendment:</p>

        <p>
          <strong>Version the consent form.</strong> Every change gets a version number and a date. The methods section
          names the version each participant signed. This sounds bureaucratic; it is &mdash; and the day you need to
          demonstrate to a committee what a participant from 14 months ago actually agreed to, you will be glad of it.
        </p>

        <p>
          <strong>Keep an analytical audit trail.</strong> Not the codebook (that is its own artefact); a separate log
          of methodological decisions: when a code was merged, why an interview was excluded, when the AI assistance was
          disabled for a section, why a quote was paraphrased rather than quoted directly. An audit trail is the
          qualitative equivalent of a lab notebook. It is the document a viva panel asks for.
        </p>

        <p>
          <strong>Document the AI usage.</strong> Which provider, which model, which feature (auto-coding, code
          suggestion, summarisation), what was sent, what was retained. The default UK research ethics committee
          position in 2026 is that AI-assisted analysis is permissible with explicit disclosure to participants and a
          written DPA; without those, it is not.
        </p>
      </section>

      <section id="in-practice">
        <h2>In QualCanvas</h2>

        <p>
          QualCanvas records consent state per participant, retention windows per dataset, and a per-action audit log of
          AI usage (provider, model, feature, token count). The DPA template at <a href="/trust/ai">trust/ai</a> is
          available for download and review by institutional legal or research-governance teams.
        </p>

        <p>
          What QualCanvas does not do is replace the ethics committee. None of this is legal advice; the
          jurisdiction-specific obligations under GDPR, HIPAA, NHS Research Ethics, or your institution&rsquo;s IRB are
          obligations on you. The tooling is here to make compliance with those obligations easier to document.
        </p>
      </section>

      <section id="further">
        <h2>Further reading</h2>

        <ul>
          <li>
            British Psychological Society. (2021). <em>Code of Human Research Ethics</em> (3rd ed.). BPS.
          </li>
          <li>
            Information Commissioner&rsquo;s Office. (2012; revised draft 2022).{' '}
            <em>Anonymisation: managing data protection risk code of practice</em>. ICO.
          </li>
          <li>
            European Parliament &amp; Council. (2016). <em>General Data Protection Regulation</em> (Regulation (EU)
            2016/679), Articles 4(5), 5(1)(e), 6, 9, 17.
          </li>
          <li>
            Iphofen, R. (Ed.). (2020). <em>Handbook of Research Ethics and Scientific Integrity</em>. Springer.
          </li>
          <li>
            Saldaña, J. (2021). <em>The Coding Manual for Qualitative Researchers</em> (4th ed.). SAGE. Chapter 2 on
            ethics in coding decisions.
          </li>
          <li>
            Mantelero, A. (2023). The Council of Europe and AI in research:{' '}
            <em>Human Rights Impact Assessment of AI systems</em>. CoE.
          </li>
          <li>
            World Medical Association. (2013, amended 2024). <em>Declaration of Helsinki</em>. WMA.
          </li>
        </ul>

        <p className="text-sm text-gray-500 dark:text-gray-400 mt-10">
          This chapter is in draft and is not legal advice. It has not yet been peer-reviewed by an external
          methodologist or by qualified legal counsel. Reviewer contact:{' '}
          <a href="mailto:methodology@qualcanvas.com" className="underline decoration-ochre-500 underline-offset-2">
            methodology@qualcanvas.com
          </a>
          .
        </p>
      </section>
    </>
  );
}
