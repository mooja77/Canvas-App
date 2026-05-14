import { useEffect } from 'react';
import { usePageMeta } from '../hooks/usePageMeta';
import { trackEvent } from '../utils/analytics';
import PageShell from '../components/marketing/PageShell';
import Eyebrow from '../components/marketing/Eyebrow';
import DisplayHeading from '../components/marketing/DisplayHeading';
import HairlineRule from '../components/marketing/HairlineRule';

/**
 * /vs — index page for the comparison surfaces per docs/refresh/06-pages/15.
 *
 * Three /vs/[competitor] pages ship via MDX during Phase 3 follow-on. They
 * each need paragraph-level legal review (R15) before publish. Until then,
 * this index lists what's coming and offers the quick-verdict summary
 * directly.
 *
 * Voice rule: every claim sourced + dated. The honesty is the marketing.
 */

interface VsTarget {
  slug: string;
  competitor: string;
  quickVerdict: string;
  pricing: string;
  pricingSource: string;
  status: 'draft' | 'review' | 'published';
}

const TARGETS: VsTarget[] = [
  {
    slug: 'nvivo',
    competitor: 'NVivo (Lumivero)',
    quickVerdict:
      'NVivo is the most-cited tool in the field. If your committee already reads NVivo papers, that lineage is real. If you are starting fresh, QualCanvas is the cleaner option: pricing is on the page, the codebook is real-time-shared, no lock-in via QDPX in both directions.',
    pricing: '$12/mo Pro vs ~$1,200/yr NVivo',
    pricingSource: 'usercall.co NVivo pricing guide, 2026',
    status: 'draft',
  },
  {
    slug: 'atlas-ti',
    competitor: 'ATLAS.ti',
    quickVerdict:
      'ATLAS.ti pushes "reduce analysis time 90% with OpenAI." We push "AI assists; you decide." Same software category, different register. We publish prices and a working /trust page; theirs 404. Pick by how confident you feel about a 90% time-saving claim before you ship a methods section.',
    pricing: '$12/mo Pro vs ~$5/mo student or $99/2 years',
    pricingSource: 'atlasti.com/student-licenses + usercall.co, 2026',
    status: 'draft',
  },
  {
    slug: 'dedoose',
    competitor: 'Dedoose',
    quickVerdict:
      "Dedoose's active-month billing is genuinely flexible. If you code in bursts (a month here, a month there) Dedoose can be cheaper. QualCanvas is steadier — pay-as-you-need, .edu discount applied automatically, real-time collab built in instead of as an upgrade.",
    pricing: '$12/mo Pro vs $17.95 active month',
    pricingSource: 'dedoose.com/home/pricing, 2026',
    status: 'draft',
  },
];

export default function VsIndexPage() {
  usePageMeta(
    'Compare QualCanvas — NVivo, ATLAS.ti, Dedoose',
    'Honest, sourced comparisons. How QualCanvas stacks up against NVivo, ATLAS.ti, and Dedoose. Pricing, features, migration path.',
  );

  useEffect(() => {
    trackEvent('marketing_page_viewed', { page: '/vs' });
  }, []);

  return (
    <PageShell>
      <article className="max-w-4xl mx-auto px-4 sm:px-6 pt-16 pb-24">
        <HairlineRule className="mb-6" />
        <Eyebrow className="mb-3">Comparisons</Eyebrow>
        <DisplayHeading size="lg" className="mb-7">
          How we compare.
        </DisplayHeading>
        <p className="text-lg text-gray-600 dark:text-gray-300 leading-relaxed max-w-2xl">
          Three honest, sourced comparisons against the most-used qualitative-analysis tools. Every claim has a date and
          a source link. We review quarterly.
        </p>

        {/* Quick verdicts */}
        <div className="mt-16 space-y-10">
          {TARGETS.map((t) => (
            <section
              key={t.slug}
              className="rounded-2xl p-8 bg-white dark:bg-gray-800/60 ring-1 ring-gray-200 dark:ring-gray-700"
            >
              <div className="flex items-baseline justify-between gap-4 mb-4">
                <h2
                  className="font-display text-2xl sm:text-3xl text-gray-900 dark:text-white"
                  style={{ fontFeatureSettings: '"ss01"', fontVariationSettings: "'opsz' 72, 'wght' 580" }}
                >
                  QualCanvas vs. {t.competitor}
                </h2>
                {t.status === 'draft' && (
                  <span className="text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400 flex-shrink-0">
                    Full page · drafting
                  </span>
                )}
              </div>
              <p className="text-base text-gray-700 dark:text-gray-300 leading-relaxed mb-4">{t.quickVerdict}</p>
              <div className="text-xs text-gray-500 dark:text-gray-400 leading-relaxed">
                <strong className="font-semibold text-gray-900 dark:text-white">Pricing today:</strong> {t.pricing}.{' '}
                <em className="text-gray-500">Source: {t.pricingSource}.</em>
              </div>
            </section>
          ))}
        </div>

        {/* Note on the longer pages */}
        <div className="mt-16 pt-10 border-t border-gray-200 dark:border-gray-800 text-sm text-gray-500 dark:text-gray-400 leading-relaxed">
          <p>
            Each comparison ships as a longer page (~1,200 words) with the full six-section breakdown: quick verdict,
            pricing, where the competitor is better, where QualCanvas is better, migration path, FAQ. We are reviewing
            them with legal counsel before publish — competitive comparisons need to be defensible, not just truthful.
          </p>
          <p className="mt-3">
            Want a specific question answered ahead of the full pages? Email{' '}
            <a
              className="underline decoration-ochre-500 underline-offset-2 hover:text-gray-900 dark:hover:text-white"
              href="mailto:compare@qualcanvas.com"
            >
              compare@qualcanvas.com
            </a>
            .
          </p>
        </div>
      </article>
    </PageShell>
  );
}
