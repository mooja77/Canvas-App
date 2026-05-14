import { useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
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

/**
 * /for-teams — segment landing page for research-group leads (Dr. Chen).
 *
 * Spec: docs/refresh/06-pages/05-for-teams.md.
 * Sells the Team plan ($29/seat/mo): shared codebooks, intercoder κ,
 * audit trail. Logo wall starts empty/sparse — populated as permissions
 * land per docs/refresh/10 R12.
 */
export default function ForTeamsPage() {
  const navigate = useNavigate();
  usePageMeta(
    'For research groups — QualCanvas',
    'Code together with shared codebooks, live intercoder reliability, and IRB-ready audit trails. $29/seat/mo. .edu discount.',
  );

  useEffect(() => {
    trackEvent('marketing_page_viewed', { page: '/for-teams' });
  }, []);

  const handleTeamTrial = () => {
    trackEvent('cta_clicked', {
      cta_label: 'Start your team trial',
      location: 'for-teams_hero',
      target_route: '/pricing',
    });
    trackEvent('signup_started', { source_page: '/for-teams', plan: 'team' });
    navigate('/pricing');
  };

  return (
    <PageShell>
      {/* Hero */}
      <section className="max-w-6xl mx-auto px-4 sm:px-6 pt-16 sm:pt-24 pb-12">
        <div className="max-w-4xl">
          <HairlineRule className="mb-6" />
          <Eyebrow className="mb-5">For research groups</Eyebrow>
          <DisplayHeading size="lg" className="mb-7">
            Code together. Disagree productively. Ship the paper.
          </DisplayHeading>
          <p className="text-lg sm:text-xl text-gray-600 dark:text-gray-300 max-w-2xl leading-relaxed mb-8">
            Shared codebooks, intercoder reliability calculated live, audit trails for the IRB — for research groups,
            methods courses, and labs.
          </p>
          <button
            onClick={handleTeamTrial}
            className="inline-flex items-center justify-center bg-ochre-500 hover:bg-ochre-600 active:bg-ochre-700 text-ink-950 font-semibold px-8 py-3.5 rounded-lg shadow-sm transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ochre-400 focus-visible:ring-offset-2"
          >
            Start your team trial
          </button>
        </div>
      </section>

      {/* Logo wall — empty until permissions land per docs/refresh/10 R12 */}
      <section className="max-w-6xl mx-auto px-4 sm:px-6 py-12">
        <LogoWall
          eyebrow="Used by research groups at"
          items={[
            { name: 'Add your lab' },
            { name: 'Anonymized PI lab' },
            { name: 'Anonymized methods course' },
            { name: 'Anonymized health-research group' },
          ]}
        />
      </section>

      {/* Three concerns */}
      <section className="max-w-6xl mx-auto px-4 sm:px-6 py-12 sm:py-20">
        <div className="mb-12 max-w-3xl">
          <HairlineRule className="mb-4" />
          <Eyebrow className="mb-3">What teams ask first</Eyebrow>
          <DisplayHeading as="h2" size="md">
            Three things, all in one project.
          </DisplayHeading>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <ConcernCard
            heading="Shared codebook"
            body="When one coder splits a code, every coder sees it next session. No more codebook drift discovered the week before submission."
            ctaText="See intercoder reliability →"
            ctaHref="/methodology/intercoder-reliability"
          />
          <ConcernCard
            heading="Live intercoder κ"
            body="Cohen's κ and Krippendorff's α calculated per code, per pair of coders, per transcript — continuously, not in batch."
            ctaText="See the math →"
            ctaHref="/methodology/intercoder-reliability"
          />
          <ConcernCard
            heading="IRB-ready audit trail"
            body="Every code applied, every memo edited, every coder action logged with timestamp. Export for the methods section or the audit request."
            ctaText="See trust posture →"
            ctaHref="/trust"
          />
        </div>
      </section>

      {/* Pull quote — placeholder until real outreach yes lands */}
      <section className="max-w-3xl mx-auto px-4 sm:px-6 py-12">
        <PullQuote attribution={<span>Postdoc, public-health lab · representative quote</span>}>
          We finally had a shared codebook our PIs trusted. That's not a small thing.
        </PullQuote>
      </section>

      {/* Feature grid */}
      <section className="max-w-6xl mx-auto px-4 sm:px-6 py-12 sm:py-20">
        <div className="mb-10 max-w-3xl">
          <HairlineRule className="mb-4" />
          <Eyebrow className="mb-3">What's in the Team plan</Eyebrow>
          <DisplayHeading as="h2" size="md">
            Everything in Pro, plus the team layer.
          </DisplayHeading>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {[
            {
              title: 'Team management',
              body: 'Add and remove coders by email. Project-level roles (PI, coder, analyst).',
            },
            {
              title: 'Per-seat billing',
              body: '$29 / seat / month, prorated. Pause seats during fieldwork; unpause when coding starts.',
            },
            {
              title: 'κ + α calculator',
              body: 'Live intercoder reliability. CSV export shaped for methods-section reporting.',
            },
            {
              title: 'Shared codebook',
              body: 'One codebook per project, updated for everyone in real time. Branchable for sensitivity work.',
            },
            {
              title: 'Comment threads',
              body: 'Discuss a code or a span without leaving the canvas. Resolves preserved in the audit log.',
            },
            { title: 'Audit log', body: 'Every action with timestamp + coder. Export for IRB or methods reporting.' },
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
          <Eyebrow className="mb-3">Team questions</Eyebrow>
        </div>
        <FAQ
          items={[
            {
              question: 'How does per-seat billing work?',
              answer:
                'Each coder you invite to a project counts as one seat. $29/seat/mo, $22/seat/mo on annual. You can pause and unpause seats month-by-month during slow fieldwork periods.',
            },
            {
              question: 'Can students on a methods course use Team?',
              answer:
                'Yes. The .edu discount applies — 40% off per seat. We routinely run Team plans for methods courses with 10–25 students; the per-seat structure is well-suited because students rotate in and out.',
            },
            {
              question: 'How is intercoder κ calculated?',
              answer: (
                <>
                  Continuously, per code, per pair of coders, per transcript. The math is Cohen's κ for nominal codes;
                  Krippendorff's α is available for ordinal coding. The full method walk-through is at{' '}
                  <Link
                    className="underline decoration-ochre-500 underline-offset-2 hover:text-gray-900 dark:hover:text-white"
                    to="/methodology/intercoder-reliability"
                  >
                    /methodology/intercoder-reliability
                  </Link>
                  .
                </>
              ),
            },
            {
              question: 'Can we export the audit log?',
              answer:
                'Yes. CSV download, dated. The shape matches what most IRBs and reviewers ask for — per-coder, per-action, per-timestamp.',
            },
            {
              question: 'What if we need SSO?',
              answer: (
                <>
                  SSO + SCIM lives on the Institutions plan — see{' '}
                  <Link
                    className="underline decoration-ochre-500 underline-offset-2 hover:text-gray-900 dark:hover:text-white"
                    to="/for-institutions"
                  >
                    /for-institutions
                  </Link>
                  .
                </>
              ),
            },
          ]}
        />
      </section>

      <CTAStripe
        headline="Bring your lab."
        sub="14-day team trial. Cancel any time. Per-seat billing pauses when you're not coding."
        primary={
          <button
            onClick={handleTeamTrial}
            className="inline-flex items-center justify-center bg-ochre-400 hover:bg-ochre-300 active:bg-ochre-500 text-ink-950 font-semibold px-8 py-3.5 rounded-lg transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ochre-300 focus-visible:ring-offset-2 focus-visible:ring-offset-ink-900"
          >
            Start your team trial
          </button>
        }
        secondary={
          <Link
            to="/pricing"
            className="inline-flex items-center justify-center text-gray-300 hover:text-white underline-offset-4 hover:underline decoration-ochre-400 font-medium px-4 py-3"
          >
            See full pricing →
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
}: {
  heading: string;
  body: string;
  ctaText: string;
  ctaHref: string;
}) {
  return (
    <div className="rounded-2xl p-8 bg-white dark:bg-gray-800/60 ring-1 ring-gray-200 dark:ring-gray-700">
      <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-3">{heading}</h3>
      <p className="text-base text-gray-600 dark:text-gray-300 leading-relaxed mb-4">{body}</p>
      <Link
        to={ctaHref}
        className="text-sm font-medium text-ochre-700 dark:text-ochre-400 hover:underline decoration-ochre-500 underline-offset-4"
      >
        {ctaText}
      </Link>
    </div>
  );
}
