import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { usePageMeta } from '../hooks/usePageMeta';
import { trackEvent } from '../utils/analytics';
import PageShell from '../components/marketing/PageShell';
import Eyebrow from '../components/marketing/Eyebrow';
import DisplayHeading from '../components/marketing/DisplayHeading';
import HairlineRule from '../components/marketing/HairlineRule';
import PullQuote from '../components/marketing/PullQuote';
import FAQ from '../components/marketing/FAQ';
import CTAStripe from '../components/marketing/CTAStripe';

const RESEARCH_DESK = 'mailto:research@qualcanvas.com?subject=Institution%20plan%20inquiry';

/**
 * /for-institutions — segment landing for IRB / procurement (Dana + Dr. Chen).
 *
 * Spec: docs/refresh/06-pages/06-for-institutions.md. Follows the Overleaf
 * "for/universities" pattern (hybrid self-serve + sales). Primary CTA is
 * "Book a 20-minute call" — specific time period is more honest than
 * "Talk to sales."
 */
export default function ForInstitutionsPage() {
  usePageMeta(
    'For institutions — QualCanvas',
    'Security documentation, deployment details, audit trails and a dedicated research contact for institutional review.',
  );

  useEffect(() => {
    trackEvent('marketing_page_viewed', { page: '/for-institutions' });
  }, []);

  const handleBookCall = () => {
    trackEvent('cta_clicked', {
      cta_label: 'Book a 20-minute call',
      location: 'for-institutions_hero',
      target_route: 'research_desk',
    });
  };

  return (
    <PageShell>
      {/* Hero */}
      <section className="max-w-6xl mx-auto px-4 sm:px-6 pt-16 sm:pt-24 pb-12">
        <div className="max-w-4xl">
          <HairlineRule className="mb-6" />
          <Eyebrow className="mb-5">For institutions</Eyebrow>
          <DisplayHeading size="lg" className="mb-7">
            Department-wide qualitative research, without forking your IT review.
          </DisplayHeading>
          <p className="text-lg sm:text-xl text-gray-600 dark:text-gray-300 max-w-2xl leading-relaxed mb-8">
            Clear deployment facts, security documentation, audit trails and a dedicated research-desk contact for teams
            evaluating QualCanvas. We identify unavailable controls before procurement begins.
          </p>
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 sm:gap-4">
            <a
              href={RESEARCH_DESK}
              onClick={handleBookCall}
              className="inline-flex items-center justify-center bg-ochre-500 hover:bg-ochre-600 active:bg-ochre-700 text-ink-950 font-semibold px-8 py-3.5 rounded-lg shadow-sm transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ochre-400 focus-visible:ring-offset-2"
            >
              Book a 20-minute call
            </a>
            <Link
              to="/pricing"
              className="inline-flex items-center text-base font-medium text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white underline-offset-4 hover:underline decoration-ochre-500 px-2 py-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ochre-400 focus-visible:ring-offset-2 rounded"
            >
              See institution plan →
            </Link>
          </div>
        </div>
      </section>

      {/* Three concerns — Dana's checklist */}
      <section className="max-w-6xl mx-auto px-4 sm:px-6 py-12 sm:py-20">
        <div className="mb-12 max-w-3xl">
          <HairlineRule className="mb-4" />
          <Eyebrow className="mb-3">What IRBs and procurement ask first</Eyebrow>
          <DisplayHeading as="h2" size="md">
            The three documents your committee will want.
          </DisplayHeading>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <ConcernCard
            heading="Data residency"
            body="The application database currently runs in US East and uploads use Cloudflare R2. EU-resident deployment is not currently available."
            ctaText="Read posture →"
            ctaHref="/trust"
          />
          <ConcernCard
            heading="IRB compliance"
            body="Audit trails, consent records, anonymization tools and retention-date recording support a documented workflow; they do not replace institutional review."
            ctaText="Review security details →"
            ctaHref="/trust"
          />
          <ConcernCard
            heading="License administration"
            body="Current access uses email/password, Google identity, team invitations and project roles. SAML/OIDC and SCIM are not currently available."
            ctaText="Discuss requirements →"
            ctaHref={RESEARCH_DESK}
            external
          />
        </div>
      </section>

      {/* Pull quote */}
      <section className="max-w-3xl mx-auto px-4 sm:px-6 py-12">
        <PullQuote attribution={<span>QualCanvas product principle</span>}>
          Procurement should begin with the controls that exist today, the regions where data actually lives, and the
          gaps your protocol still needs to address.
        </PullQuote>
      </section>

      {/* Admin-feature grid */}
      <section className="max-w-6xl mx-auto px-4 sm:px-6 py-12 sm:py-20">
        <div className="mb-10 max-w-3xl">
          <HairlineRule className="mb-4" />
          <Eyebrow className="mb-3">Institution features</Eyebrow>
          <DisplayHeading as="h2" size="md">
            Procurement reads this list.
          </DisplayHeading>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {[
            {
              title: 'Identity and access',
              body: 'Email/password, Google identity, team invitations and project roles are available today. SAML/OIDC and SCIM are not currently available.',
            },
            {
              title: 'Audit logs',
              body: 'Canvas actions record timestamp, user identity, hashed IP and response status for security and research traceability.',
            },
            {
              title: 'Contract review',
              body: 'Request the current DPA and sub-processor information from legal@qualcanvas.com. A HIPAA BAA is not currently offered; do not upload PHI that requires one.',
            },
            {
              title: 'Custom retention',
              body: 'Projects can record a retention date. Automated purge and a configurable deletion-grace workflow are not currently available.',
            },
            {
              title: 'EU residency',
              body: 'An EU-resident application database is not currently available. Current application and database hosting is US East.',
            },
            {
              title: 'AI use policy',
              body: 'AI runs only after a user action and provider terms apply. A project-enforced AI-disable switch is not currently available. See /trust/ai.',
            },
          ].map((f) => (
            <div
              key={f.title}
              className="rounded-xl p-6 bg-white dark:bg-gray-800/60 ring-1 ring-gray-200 dark:ring-gray-700"
            >
              <h3 className="text-base font-semibold text-gray-900 dark:text-white mb-2">{f.title}</h3>
              <p className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed">{f.body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* FAQ */}
      <section className="max-w-3xl mx-auto px-4 sm:px-6 py-16">
        <div className="mb-10">
          <HairlineRule className="mb-4" />
          <Eyebrow className="mb-3">Procurement questions</Eyebrow>
        </div>
        <FAQ
          items={[
            {
              question: 'Is QualCanvas FERPA-compliant?',
              answer:
                'QualCanvas provides controls that may support an institution’s FERPA workflow, but QualCanvas does not certify a deployment as FERPA-compliant. Your institution must review the current hosting, access and retention controls before use.',
            },
            {
              question: 'Where is our data stored?',
              answer: (
                <>
                  US East for the application and database, with Cloudflare R2 for uploaded files. EU-resident
                  application hosting is not currently available. Full posture on{' '}
                  <Link
                    className="underline decoration-ochre-500 underline-offset-2 hover:text-gray-900 dark:hover:text-white"
                    to="/trust"
                  >
                    /trust
                  </Link>
                  .
                </>
              ),
            },
            {
              question: 'Can we sign a DPA?',
              answer:
                'You can request the current DPA materials before a call. Availability, transfer terms and any requested amendments are confirmed during legal review; no signature timeline is guaranteed.',
            },
            {
              question: 'Do you support SSO and SCIM?',
              answer:
                'Not currently. QualCanvas presently supports email/password, Google identity and project invitations. Institutions requiring SAML/OIDC or SCIM should treat that as a deployment blocker.',
            },
            {
              question: 'Can we configure data retention?',
              answer:
                'A project can record a retention date for workflow visibility. QualCanvas does not currently auto-purge at that date or provide a 14-day deletion grace period.',
            },
            {
              question: 'What about AI training on participant transcripts?',
              answer: (
                <>
                  Transcripts are never used to train any model. Full architectural promise at{' '}
                  <Link
                    className="underline decoration-ochre-500 underline-offset-2 hover:text-gray-900 dark:hover:text-white"
                    to="/trust/ai"
                  >
                    /trust/ai
                  </Link>
                  . If your protocol requires a technical zero-AI enforcement control, QualCanvas does not currently
                  provide one.
                </>
              ),
            },
            {
              question: 'How is the plan priced?',
              answer:
                'Institutional requirements are reviewed individually. Contact the research desk for a written scope and quote; no typical price range or turnaround is promised on this page.',
            },
          ]}
        />
      </section>

      <CTAStripe
        eyebrow="Twenty minutes."
        headline="Book a call with our research desk."
        sub="Bring your residency, identity, retention and AI-control requirements. We’ll compare them with the controls available today."
        primary={
          <a
            href={RESEARCH_DESK}
            onClick={handleBookCall}
            className="inline-flex items-center justify-center bg-ochre-400 hover:bg-ochre-300 active:bg-ochre-500 text-ink-950 font-semibold px-8 py-3.5 rounded-lg transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ochre-300 focus-visible:ring-offset-2 focus-visible:ring-offset-ink-900"
          >
            Book a 20-minute call
          </a>
        }
        secondary={
          <Link
            to="/trust"
            className="inline-flex items-center justify-center text-gray-300 hover:text-white underline-offset-4 hover:underline decoration-ochre-400 font-medium px-4 py-3"
          >
            Read the full trust posture →
          </Link>
        }
      />
    </PageShell>
  );
}

function ConcernCard({
  heading,
  body,
  ctaText,
  ctaHref,
  external = false,
}: {
  heading: string;
  body: string;
  ctaText: string;
  ctaHref: string;
  external?: boolean;
}) {
  const linkClass =
    'text-sm font-medium text-ochre-700 dark:text-ochre-400 hover:underline decoration-ochre-500 underline-offset-4';
  return (
    <div className="rounded-2xl p-8 bg-white dark:bg-gray-800/60 ring-1 ring-gray-200 dark:ring-gray-700">
      <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-3">{heading}</h3>
      <p className="text-base text-gray-600 dark:text-gray-300 leading-relaxed mb-4">{body}</p>
      {external ? (
        <a href={ctaHref} className={linkClass}>
          {ctaText}
        </a>
      ) : (
        <Link to={ctaHref} className={linkClass}>
          {ctaText}
        </Link>
      )}
    </div>
  );
}
