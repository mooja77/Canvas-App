import { useEffect } from 'react';
import { usePageMeta } from '../hooks/usePageMeta';
import { trackEvent } from '../utils/analytics';
import PageShell from '../components/marketing/PageShell';
import Eyebrow from '../components/marketing/Eyebrow';
import DisplayHeading from '../components/marketing/DisplayHeading';
import HairlineRule from '../components/marketing/HairlineRule';

/**
 * /changelog — release feed per docs/refresh/06-pages/08-changelog.md.
 *
 * Reverse-chron feed of shipped features. Entries are static seeds for now;
 * Phase 3 follow-on adds MDX-driven entries and an RSS feed at /changelog/feed.xml
 * (generated at build time from git history per the §9.6 content pipeline).
 *
 * Pattern is Vercel-tight + Raycast-categorical, restrained tone. One entry
 * per shipped feature or every two weeks, whichever's more frequent.
 */

interface ChangelogEntry {
  date: string;
  title: string;
  body: string;
  highlights?: string[];
  fixes?: string[];
  author?: string;
  readMin?: number;
}

const ENTRIES: ChangelogEntry[] = [
  {
    date: '2026-05-15',
    title: 'Methodology field guide — six chapters live',
    body: 'Full set of methodology chapters at /methodology, written in target voice with real citations and visible draft-state disclaimers ahead of external peer review. ~11,000 words across the six chapters, lazy-loaded on chapter pages so the main bundle stays unchanged.',
    highlights: [
      '1.0 Foundations — inductive vs deductive vs abductive, codes/categories/themes, saturation honestly',
      '2.0 Thematic analysis — Braun & Clarke as practised, reflexive vs codebook TA',
      '3.0 Grounded theory — Charmaz constructivist GT, the Glaser–Strauss–Charmaz lineage',
      '4.0 IPA — the double hermeneutic in practical terms, four-step procedure',
      "5.0 Intercoder reliability — Cohen's κ, Krippendorff's α, a pragmatic position",
      '6.0 Ethics in practice — anonymisation properly, retention, the AI-assistance question',
    ],
    author: 'The team',
    readMin: 3,
  },
  {
    date: '2026-05-14',
    title: 'Marketing site refresh — Tier 2 brand activated',
    body: 'The marketing surface (landing, pricing, methodology index, customers, /for-teams, /for-institutions, /trust/ai, /cite, /colophon, /accessibility-statement, /press) is now on the Ink + Ochre palette with Fraunces display headings. Visible via the override URL today; default-on flip during Phase 5 launch.',
    highlights: [
      'Hero rebuilt with type-as-hero Fraunces display, no gradient blob mesh',
      'Pricing now four tiers — Free / Pro / Team / Institutions — with sourced competitor comparison',
      '/cite ships with copy-to-clipboard BibTeX, APA, Chicago, RIS',
      'Footer "Built by JMS Dev Lab →" attribution + three-state theme toggle',
    ],
    fixes: [
      'OG image now self-hosted at /og-image.png (was a broken reference for months)',
      'Inter + Fraunces self-hosted, no more Google Fonts request',
    ],
    author: 'The team',
    readMin: 4,
  },
  {
    date: '2026-05-13',
    title: 'Onboarding, command palette, and the AI code suggester',
    body: 'A batch of surface work: the new two-screen onboarding flow with methodology templates and an activation checklist, an activity bar that surfaces Cmd-K coverage across the canvas, and an inline AI code suggester that triggers when you highlight a span. The activity bar and AI suggester are flag-gated for new users until the rollout completes.',
    highlights: [
      'Two-screen onboarding replaces the long setup wizard; methodology templates pre-fill the codebook',
      'Activation checklist tracks first-transcript, first-code, first-AI-use, first-export events',
      'Cmd-K command palette now covers every toolbar action with telemetry on search queries',
      'Inline AI code suggester: highlight text → suggested codes appear in-line; accept, reject, or refine without leaving the transcript',
    ],
    author: 'The team',
    readMin: 4,
  },
  {
    date: '2026-05-13',
    title: "Krippendorff's α, Fleiss' κ, and the reliability batch",
    body: "Statistics for the multi-coder workflow plus a wave of reliability fixes. The intercoder reliability panel now computes Krippendorff's α and Fleiss' κ alongside Cohen's κ, with per-code breakdowns and a confusion-matrix export. Behind the scenes: LLM retries with exponential backoff, Stripe webhook reconciliation, a service-worker update toast when a new build is available, and weekly Postgres backups to R2.",
    highlights: [
      "Krippendorff's α for 3+ coders; Fleiss' κ for nominal multi-rater agreement",
      'Per-code agreement breakdown + confusion-matrix export (Team plan)',
      'AI prompt upgrades across thematic-analysis, code-naming, and code-suggestion flows',
    ],
    fixes: [
      'LLM provider calls now retry with exponential backoff on transient errors',
      'Stripe webhook reconciliation job catches dropped subscription updates',
      'Service-worker update toast prompts a reload when a new build is deployed',
      'Weekly prod Postgres backup to Cloudflare R2',
    ],
    author: 'The team',
    readMin: 3,
  },
  {
    date: '2026-04-25',
    title: '14-day Pro trial + countdown banner',
    body: 'New email and Google signups start on a 14-day Pro trial — full feature set, no card required, automatic downgrade to Free if the trial expires unconverted. A countdown banner shifts tone across the trial: neutral on days 1–6, ochre on day 7, amber on the last 48 hours, red after expiry.',
    highlights: [
      '14-day Pro trial for new email + Google signups',
      'Day-7 / last-day / expired countdown banner with distinct visual tones',
      'Invoice.payment_succeeded webhook handler closes a long-standing reconciliation gap',
    ],
    author: 'The team',
    readMin: 2,
  },
  {
    date: '2026-04-24',
    title: 'Security audit — high, medium, and low findings resolved',
    body: 'A pass through the internal security audit closing eight findings. Integration OAuth tokens (Otter, Rev, Descript) now live encrypted at rest. Prod source maps no longer ship to the public bundle. Two IDOR routes on nested resources are patched. Sessions invalidate across the cluster on credential change. Operations on trashed canvases are blocked at the route layer instead of relying on UI gating.',
    highlights: [
      'Encrypt integration OAuth tokens at rest',
      'Strip prod sourcemaps; bundle no longer leaks structured logging',
      'IDOR fixes on nested resources + session invalidation propagation',
      'Pagination clamp, request-ID propagation, deep-readiness endpoint',
      'Structured logger with query-performance telemetry',
    ],
    fixes: [
      'Block share-clone of soft-deleted canvases',
      'Bound computed query result size to prevent runaway responses',
      'SameSite=None cookies in prod so cross-site XHR auth works',
    ],
    author: 'The team',
    readMin: 4,
  },
  {
    date: '2026-04-23',
    title: 'JWT → httpOnly cookies migration',
    body: 'Authentication tokens move from localStorage into httpOnly cookies, closing the XSS-exfiltration attack surface that comes with any localStorage-resident credential. Session invalidation propagates on password change, email link, and explicit logout. Plan-aware onboarding lands at the same time: PlanWelcome cards, feature tooltips gated by plan, an AI-feature explainer banner, and a guided team-setup flow for Team-plan signups.',
    highlights: [
      'JWT migration to httpOnly cookies (phase 1 of credential-hardening plan)',
      'Plan-aware onboarding: PlanWelcome card + FeatureTooltip + AI explainer banner',
      'Guided team-setup flow for Team-plan signups',
    ],
    author: 'The team',
    readMin: 3,
  },
  {
    date: '2026-04-10',
    title: 'Sibling-app cross-linking + activation telemetry',
    body: 'The marketing footer now cross-links sibling JMS Dev Lab products. Marketing landing pages prerender into static HTML so crawlers, AI agents, and first-paint visitors see real content immediately rather than the React loading state. Server-side activation telemetry begins firing for sign_up and first_canvas_created events.',
    highlights: [
      'Sibling-app cross-links in marketing footer',
      'Marketing prerender for crawler + first-paint visibility',
      'Activation telemetry: sign_up + first_canvas_created events',
      'Customer-service chat widget embedded (responsive; hidden on /canvas)',
    ],
    author: 'The team',
    readMin: 2,
  },
];

export default function ChangelogPage() {
  usePageMeta(
    'Changelog — QualCanvas',
    "What we've shipped, when, with bylines. RSS available. New entry per feature or every two weeks.",
  );

  useEffect(() => {
    trackEvent('marketing_page_viewed', { page: '/changelog' });
  }, []);

  return (
    <PageShell>
      <article className="max-w-3xl mx-auto px-4 sm:px-6 pt-16 pb-24">
        <HairlineRule className="mb-6" />
        <Eyebrow className="mb-3">Changelog</Eyebrow>
        <DisplayHeading size="md" className="mb-7">
          What we've shipped.
        </DisplayHeading>
        <div className="flex items-baseline gap-4 text-sm text-gray-600 dark:text-gray-400">
          <a
            href="/changelog/feed.xml"
            onClick={() => trackEvent('changelog_subscribed' as never)}
            className="underline decoration-ochre-500 underline-offset-2 hover:text-gray-900 dark:hover:text-white"
          >
            Subscribe via RSS
          </a>
          <span>·</span>
          <a
            href="/subscribe"
            className="underline decoration-ochre-500 underline-offset-2 hover:text-gray-900 dark:hover:text-white"
          >
            By email
          </a>
        </div>

        {/* Entries */}
        <div className="mt-16 divide-y divide-gray-200 dark:divide-gray-800">
          {ENTRIES.map((entry, idx) => (
            <Entry key={idx} entry={entry} />
          ))}
        </div>

        {/* Backfill note */}
        <div className="mt-16 pt-10 border-t border-gray-200 dark:border-gray-800 text-sm text-gray-500 dark:text-gray-400 leading-relaxed">
          <p>
            Entries from April 2026 onward are listed above. Pre-April history is still being backfilled — the full
            commit log lives on{' '}
            <a
              className="underline decoration-ochre-500 underline-offset-2 hover:text-gray-900 dark:hover:text-white"
              href="https://github.com/mooja77"
              target="_blank"
              rel="noopener noreferrer"
            >
              GitHub
            </a>{' '}
            until then.
          </p>
        </div>
      </article>
    </PageShell>
  );
}

function Entry({ entry }: { entry: ChangelogEntry }) {
  return (
    <div className="py-10 first:pt-0">
      <div className="text-xs font-mono uppercase tracking-wider text-ochre-700 dark:text-ochre-400 mb-3">
        {entry.date}
      </div>
      <h2
        className="font-display text-2xl sm:text-3xl text-gray-900 dark:text-white mb-4 leading-tight"
        style={{ fontFeatureSettings: '"ss01"', fontVariationSettings: "'opsz' 96, 'wght' 580" }}
      >
        {entry.title}
      </h2>
      <p className="text-base text-gray-700 dark:text-gray-300 leading-relaxed mb-6">{entry.body}</p>

      {entry.highlights && entry.highlights.length > 0 && (
        <div className="mb-4">
          <div className="text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-2">
            Highlights
          </div>
          <ul className="space-y-1.5 text-sm text-gray-700 dark:text-gray-300">
            {entry.highlights.map((h) => (
              <li key={h} className="flex items-start gap-2">
                <span aria-hidden="true" className="text-ochre-500 mt-0.5">
                  ·
                </span>
                <span>{h}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {entry.fixes && entry.fixes.length > 0 && (
        <div className="mb-4">
          <div className="text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-2">
            Fixes
          </div>
          <ul className="space-y-1.5 text-sm text-gray-700 dark:text-gray-300">
            {entry.fixes.map((f) => (
              <li key={f} className="flex items-start gap-2">
                <span aria-hidden="true" className="text-gray-400 mt-0.5">
                  ·
                </span>
                <span>{f}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {(entry.author || entry.readMin) && (
        <div className="text-xs text-gray-500 dark:text-gray-400 mt-4">
          {entry.author && <>— {entry.author}</>}
          {entry.author && entry.readMin && <> · </>}
          {entry.readMin && <>{entry.readMin} min read</>}
        </div>
      )}
    </div>
  );
}
