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
    pricing: 'Pro $15/mo or $144/yr; NVivo pricing varies by licence and is not listed on its product page',
    pricingSource: 'lumivero.com/products/nvivo, checked 3 November 2026',
    status: 'published',
  },
  {
    slug: 'atlas-ti',
    competitor: 'ATLAS.ti',
    quickVerdict:
      'ATLAS.ti is an established desktop and web tool with strong multimedia support. QualCanvas keeps AI to suggestions you accept or reject, and publishes every price and its security and AI policies on this site. If your supervisor or team already uses ATLAS.ti, use it; .qdpx lets you move a project between the two.',
    pricing: 'Pro $15/mo or $144/yr; ATLAS.ti student licences last one year, price on its site',
    pricingSource: 'atlasti.com/student-licenses, checked 3 November 2026',
    status: 'published',
  },
  {
    slug: 'dedoose',
    competitor: 'Dedoose',
    quickVerdict:
      "Dedoose's active-month billing is genuinely flexible. If you code in bursts (a month here, a month there) Dedoose can be cheaper. QualCanvas is steadier — pay-as-you-need, academic discount applied automatically for recognised institution emails, real-time collab built in instead of as an upgrade.",
    pricing: 'Pro $15/mo or $144/yr vs Dedoose $17.95 per active month (student $12.95)',
    pricingSource: 'dedoose.com/home/pricing, checked 3 November 2026',
    status: 'published',
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

  // Deep links from /pricing land here as /vs#nvivo etc. The browser's native
  // anchor scroll fires before React renders the sections, so scroll to the
  // target ourselves once the content is on the page.
  useEffect(() => {
    const hash = window.location.hash.slice(1);
    if (!hash) return;
    const el = document.getElementById(hash);
    if (el) requestAnimationFrame(() => el.scrollIntoView({ behavior: 'smooth', block: 'start' }));
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
              id={t.slug}
              className="scroll-mt-24 rounded-2xl p-8 bg-white dark:bg-gray-800/60 ring-1 ring-gray-200 dark:ring-gray-700"
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
            Longer answers:{' '}
            <a className="underline" href="/nvivo-alternatives">
              NVivo alternatives compared
            </a>
            ,{' '}
            <a className="underline" href="/free-qualitative-coding-software">
              free qualitative coding software for students
            </a>{' '}
            and{' '}
            <a className="underline" href="/intercoder-reliability-software">
              intercoder reliability software
            </a>
            . Competitor facts are read from their own pages on the date shown and can change.
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
