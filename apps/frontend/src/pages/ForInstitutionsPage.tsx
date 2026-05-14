import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { usePageMeta } from '../hooks/usePageMeta';
import { trackEvent } from '../utils/analytics';
import PageShell from '../components/marketing/PageShell';
import Eyebrow from '../components/marketing/Eyebrow';
import DisplayHeading from '../components/marketing/DisplayHeading';
import HairlineRule from '../components/marketing/HairlineRule';
import PullQuote from '../components/marketing/PullQuote';
import LogoWall from '../components/marketing/LogoWall';
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
    'SSO + SCIM, DPA, BAA, custom retention, EU residency, dedicated research desk. Department-wide qualitative research, procurement-ready.',
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
            SSO and SCIM, custom retention windows, DPA, BAA, dedicated research-desk contact. Procurement-ready,
            IRB-friendly.
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

      {/* Logo wall (placeholder until permissions) */}
      <section className="max-w-6xl mx-auto px-4 sm:px-6 py-12">
        <LogoWall
          eyebrow="Departments using QualCanvas"
          items={[
            { name: 'Add your institution' },
            { name: 'Anonymized university' },
            { name: 'Anonymized faculty' },
            { name: 'Anonymized research institute' },
          ]}
        />
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
            body="EU and US storage options. Storage region is named in the DPA. Weekly backups with monthly restore drills."
            ctaText="Read posture →"
            ctaHref="/trust"
          />
          <ConcernCard
            heading="IRB compliance"
            body="Audit trails, consent tracking, retention windows, anonymization tools. DPA and BAA available on request."
            ctaText="Request DPA →"
            ctaHref="mailto:legal@qualcanvas.com?subject=DPA%20request"
            external
          />
          <ConcernCard
            heading="License administration"
            body="SSO via SAML or OIDC; SCIM auto-provisioning; named-seat or unlimited. Net-30 invoicing on annual."
            ctaText="See plan options →"
            ctaHref="/pricing"
          />
        </div>
      </section>

      {/* Pull quote */}
      <section className="max-w-3xl mx-auto px-4 sm:px-6 py-12">
        <PullQuote attribution={<span>Methods professor · representative quote</span>}>
          QualCanvas was the only tool my IT director didn't immediately reject. We had the DPA signed in a week.
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
              title: 'SSO + SCIM',
              body: 'SAML 2.0 or OIDC for sign-in. SCIM 2.0 for auto-provisioning. Maps department roles to QualCanvas project roles.',
            },
            {
              title: 'Audit logs',
              body: 'Every action with timestamp + user + IP. Configurable retention (default 90 days; custom up to 7 years).',
            },
            {
              title: 'DPA + BAA',
              body: 'Standard Contractual Clauses Module 2 (2021) DPA. HIPAA BAA available for institutions with PHI workflows.',
            },
            {
              title: 'Custom retention',
              body: 'Per-project retention windows from 30 days to 7 years. Auto-purge on schedule, with a 14-day undo grace.',
            },
            {
              title: 'EU residency',
              body: 'Storage in eu-west-1 with EU sub-processors only. Available on the Institutions plan; documented in DPA.',
            },
            {
              title: 'AI use policy',
              body: 'No transcript content used for model training. Per-project AI disable switch for zero-AI studies. See /trust/ai.',
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
                'QualCanvas can be configured to support FERPA-compliant workflows when used per the documented controls — audit logging on, retention windows set, AI disabled if your protocol requires it. The Institutions plan includes a DPA that names FERPA-relevant obligations.',
            },
            {
              question: 'Where is our data stored?',
              answer: (
                <>
                  US East by default (Railway). EU residency (eu-west-1) available on the Institutions plan and named in
                  the DPA. Full posture on{' '}
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
                'Yes. We send a draft DPA before our first call so your legal team can review it in parallel. SCCs Module 2 (2021) for EU-to-US transfers. Most institutions sign within two weeks.',
            },
            {
              question: 'Do you support SSO and SCIM?',
              answer:
                'Yes — on the Institutions plan. SAML 2.0 and OIDC for sign-in. SCIM 2.0 for user provisioning and deprovisioning. Standard identity-provider integrations (Okta, Microsoft Entra, Google Workspace).',
            },
            {
              question: 'Can we configure data retention?',
              answer:
                'Yes. Per-project retention windows from 30 days to 7 years. Auto-purge runs on schedule with a 14-day undo grace. Useful for both IRB-mandated retention and FERPA-mandated deletion.',
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
                  . If your protocol requires zero-AI, the Institutions plan supports a per-project AI disable switch.
                </>
              ),
            },
            {
              question: 'How is the plan priced?',
              answer:
                'Custom, based on seat count and feature mix. Most institutions land between $5,000 and $25,000 per year. Net-30 invoicing on annual. We send a quote within five business days of the first call.',
            },
          ]}
        />
      </section>

      <CTAStripe
        eyebrow="Twenty minutes."
        headline="Book a call with our research desk."
        sub="No sales script. We'll send a draft DPA and a one-page security summary 24 hours before the call."
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
