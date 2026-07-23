import { useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { usePageMeta } from '../hooks/usePageMeta';
import { trackEvent } from '../utils/analytics';
import PageShell from '../components/marketing/PageShell';
import Eyebrow from '../components/marketing/Eyebrow';
import DisplayHeading from '../components/marketing/DisplayHeading';
import HairlineRule from '../components/marketing/HairlineRule';
import LogoWall from '../components/marketing/LogoWall';
import FAQ from '../components/marketing/FAQ';
import CTAStripe from '../components/marketing/CTAStripe';

/**
 * /for-teams — segment landing page for research-group leads (Dr. Chen).
 *
 * Spec: docs/refresh/06-pages/05-for-teams.md.
 * Sells the Team plan ($39/seat/mo): shared codebooks, intercoder κ,
 * audit trail. Logo wall starts empty/sparse — populated as permissions
 * land per docs/refresh/10 R12.
 */
export default function ForTeamsPage() {
  const navigate = useNavigate();
  usePageMeta(
    'For research groups — QualCanvas',
    'Manage a research group, collaborate on shared canvases, calculate intercoder reliability, and review project audit trails.',
  );

  useEffect(() => {
    trackEvent('marketing_page_viewed', { page: '/for-teams' });
  }, []);

  const handleTeamTrial = () => {
    trackEvent('cta_clicked', {
      cta_label: 'See Team pricing',
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
            Manage group membership, invite collaborators to a canvas, calculate intercoder agreement, and review a
            project audit trail — for research groups, methods courses, and labs.
          </p>
          <button
            onClick={handleTeamTrial}
            className="inline-flex items-center justify-center bg-ochre-500 hover:bg-ochre-600 active:bg-ochre-700 text-ink-950 font-semibold px-8 py-3.5 rounded-lg shadow-sm transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ochre-400 focus-visible:ring-offset-2"
          >
            See Team pricing
          </button>
        </div>
      </section>

      {/* Audience list — do not imply customer endorsements without permission. */}
      <section className="max-w-6xl mx-auto px-4 sm:px-6 py-12">
        <LogoWall
          eyebrow="Designed for"
          items={[
            { name: 'Principal investigators' },
            { name: 'Research labs' },
            { name: 'Methods courses' },
            { name: 'Health-research groups' },
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
            body="Editors on the same canvas work with the same codes, transcripts and memos. Changes are shared through the collaborative canvas."
            ctaText="See intercoder reliability →"
            ctaHref="/methodology/intercoder-reliability"
          />
          <ConcernCard
            heading="Intercoder agreement"
            body="Run Cohen's κ or Krippendorff's α on attributed coding work when you are ready to compare coders."
            ctaText="See the math →"
            ctaHref="/methodology/intercoder-reliability"
          />
          <ConcernCard
            heading="Project audit trail"
            body="Authenticated project requests are logged with action and timestamp. Canvas owners can review and export the available audit data."
            ctaText="See trust posture →"
            ctaHref="/trust"
          />
        </div>
      </section>

      {/* Factual capability note — no representative or placeholder endorsement. */}
      <section className="max-w-3xl mx-auto px-4 sm:px-6 py-12">
        <div className="rounded-2xl border border-ochre-200 bg-ochre-50/50 p-7 text-sm leading-relaxed text-gray-700 dark:border-ochre-900 dark:bg-ochre-900/10 dark:text-gray-300">
          Team membership and canvas access are managed separately. Add people to your team for seat management, then
          invite the researchers who need access from each canvas&apos;s Share panel.
        </div>
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
              body: 'Add and remove registered QualCanvas users by email, with owner, admin and member team roles.',
            },
            {
              title: 'Per-seat billing',
              body: 'The subscription quantity follows the number of active team members. Removing a member reduces the seat count.',
            },
            {
              title: 'κ + α calculator',
              body: 'Calculate Cohen’s κ or Krippendorff’s α from coding attributed to multiple researchers.',
            },
            {
              title: 'Canvas collaboration',
              body: 'Invite registered users to a canvas as an editor or viewer and work in the same project.',
            },
            {
              title: 'Controlled access',
              body: 'Canvas owners can change a collaborator’s role or remove access; revoked live sessions are disconnected.',
            },
            {
              title: 'Audit log',
              body: 'Review authenticated project requests with action and timestamp from the Quality panel.',
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
          <Eyebrow className="mb-3">Team questions</Eyebrow>
        </div>
        <FAQ
          items={[
            {
              question: 'How does per-seat billing work?',
              answer:
                'The Team subscription quantity follows active team membership. Adding or removing a registered member updates the seat quantity with Stripe proration.',
            },
            {
              question: 'Can students on a methods course use Team?',
              answer:
                'Yes. The .edu discount applies to eligible Team subscriptions. The per-seat structure supports methods courses, but instructors should confirm their participant count and data-governance requirements before purchase.',
            },
            {
              question: 'How is intercoder κ calculated?',
              answer: (
                <>
                  Run it on demand after multiple attributed coders have worked on the same material. Choose
                  Cohen&apos;s κ or Krippendorff&apos;s α based on the agreement method you need. The method
                  walk-through is at{' '}
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
                'Yes. Canvas owners can download the project audit entries currently shown by the Quality panel as CSV.',
            },
            {
              question: 'What if we need SSO?',
              answer:
                'SAML/OIDC SSO and SCIM are not currently available. Treat either requirement as a deployment blocker and review the Institutions page for the current capability statement.',
            },
          ]}
        />
      </section>

      <CTAStripe
        headline="Bring your lab."
        sub="Team access is billed per seat. Review the current limits and pricing before checkout."
        primary={
          <button
            onClick={handleTeamTrial}
            className="inline-flex items-center justify-center bg-ochre-400 hover:bg-ochre-300 active:bg-ochre-500 text-ink-950 font-semibold px-8 py-3.5 rounded-lg transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ochre-300 focus-visible:ring-offset-2 focus-visible:ring-offset-ink-900"
          >
            See Team pricing
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
