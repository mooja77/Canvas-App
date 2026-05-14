import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { usePageMeta } from '../hooks/usePageMeta';
import { trackEvent } from '../utils/analytics';
import PageShell from '../components/marketing/PageShell';
import Eyebrow from '../components/marketing/Eyebrow';
import DisplayHeading from '../components/marketing/DisplayHeading';
import HairlineRule from '../components/marketing/HairlineRule';

/**
 * /methodology — index / table of contents per docs/refresh/06-pages/03.
 *
 * Six chapters. Chapter pages are MDX-driven and land in a follow-on commit
 * as drafts are written + peer-reviewed (docs/refresh/08 §8.5 outlines, §8.9
 * voice sample). Until then, each TOC entry is "draft in progress" with no
 * link — honest signal that the work is real and underway, not a fake "coming
 * soon" tease.
 */

interface Chapter {
  number: string;
  title: string;
  summary: string;
  slug: string;
  readMin: number;
  status: 'draft' | 'review' | 'published';
}

const CHAPTERS: Chapter[] = [
  {
    number: '1.0',
    title: 'Foundations',
    summary: 'What qualitative coding actually is. Inductive vs. deductive. Why coding is interpretive work.',
    slug: 'foundations',
    readMin: 7,
    status: 'draft',
  },
  {
    number: '2.0',
    title: 'Thematic analysis',
    summary: "Braun & Clarke's six phases. Building a codebook. Intercoder agreement (and when it matters).",
    slug: 'thematic-analysis',
    readMin: 12,
    status: 'draft',
  },
  {
    number: '3.0',
    title: 'Grounded theory (Charmaz)',
    summary: 'Open coding to theoretical coding. Memo-writing as theoretical development. Theoretical saturation.',
    slug: 'grounded-theory',
    readMin: 10,
    status: 'draft',
  },
  {
    number: '4.0',
    title: 'Interpretative Phenomenological Analysis',
    summary: "Smith's hermeneutic approach. The double hermeneutic. Reading and re-reading.",
    slug: 'ipa',
    readMin: 8,
    status: 'draft',
  },
  {
    number: '5.0',
    title: 'Intercoder reliability',
    summary: "Cohen's κ. Krippendorff's α. When each fits. The recurring debate, and a pragmatic position.",
    slug: 'intercoder-reliability',
    readMin: 6,
    status: 'draft',
  },
  {
    number: '6.0',
    title: 'Ethics in practice',
    summary: 'Consent as ongoing. Anonymization. Retention windows. When AI assistance becomes an ethics question.',
    slug: 'ethics-in-practice',
    readMin: 8,
    status: 'draft',
  },
];

export default function MethodologyIndexPage() {
  usePageMeta(
    'Doing qualitative research with QualCanvas — A short field guide',
    'Six chapters covering thematic analysis, grounded theory, IPA, intercoder reliability, and ethics in practice. Free, citeable, updated monthly.',
  );

  useEffect(() => {
    trackEvent('marketing_page_viewed', { page: '/methodology' });
  }, []);

  return (
    <PageShell>
      <article className="max-w-4xl mx-auto px-4 sm:px-6 pt-16 pb-24">
        <HairlineRule className="mb-6" />
        <Eyebrow className="mb-3">A short field guide</Eyebrow>
        <DisplayHeading size="lg" className="mb-7">
          Doing qualitative research with QualCanvas.
        </DisplayHeading>
        <p className="text-lg text-gray-600 dark:text-gray-300 leading-relaxed max-w-2xl">
          Six chapters · roughly 45 minutes · updated monthly. Written by the team and reviewed by credentialed
          methodologists before publish.
        </p>

        {/* Chapter list */}
        <ol className="mt-16 space-y-10">
          {CHAPTERS.map((ch) => (
            <li key={ch.slug} className="flex gap-6 sm:gap-8">
              <span
                className="font-display text-2xl sm:text-3xl text-ochre-600 dark:text-ochre-400 leading-none flex-shrink-0 mt-1"
                style={{ fontFeatureSettings: '"ss01"', fontVariationSettings: "'opsz' 72, 'wght' 540" }}
              >
                {ch.number}
              </span>
              <div className="flex-1">
                <div className="flex items-baseline justify-between gap-4 mb-2">
                  {ch.status === 'published' ? (
                    <Link
                      to={`/methodology/${ch.slug}`}
                      className="text-xl sm:text-2xl font-semibold text-gray-900 dark:text-white hover:text-ochre-700 dark:hover:text-ochre-400 transition-colors duration-150"
                    >
                      {ch.title}
                    </Link>
                  ) : (
                    <h2 className="text-xl sm:text-2xl font-semibold text-gray-900 dark:text-white">{ch.title}</h2>
                  )}
                  <span className="text-xs text-gray-500 dark:text-gray-400 flex-shrink-0">{ch.readMin} min</span>
                </div>
                <p className="text-sm sm:text-base text-gray-600 dark:text-gray-400 leading-relaxed">{ch.summary}</p>
                {ch.status === 'draft' && (
                  <span className="inline-flex items-center mt-3 text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400">
                    <span aria-hidden="true" className="mr-2 w-1.5 h-1.5 rounded-full bg-gray-400 dark:bg-gray-500" />
                    Draft in progress · under peer review
                  </span>
                )}
                {ch.status === 'review' && (
                  <span className="inline-flex items-center mt-3 text-xs font-medium uppercase tracking-wider text-ochre-700 dark:text-ochre-400">
                    <span aria-hidden="true" className="mr-2 w-1.5 h-1.5 rounded-full bg-ochre-500" />
                    Peer review complete · publishing this month
                  </span>
                )}
              </div>
            </li>
          ))}
        </ol>

        {/* Subscribe CTA */}
        <div className="mt-20 pt-10 border-t border-gray-200 dark:border-gray-800">
          <p className="text-base text-gray-700 dark:text-gray-300">
            New chapter monthly. Subscribe to{' '}
            <a
              href="/subscribe"
              className="underline decoration-ochre-500 underline-offset-2 hover:text-gray-900 dark:hover:text-white"
            >
              the field guide by email
            </a>{' '}
            or{' '}
            <a
              href="/methodology/feed.xml"
              className="underline decoration-ochre-500 underline-offset-2 hover:text-gray-900 dark:hover:text-white"
            >
              via RSS
            </a>
            .
          </p>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-3">
            Want to peer-review a chapter? Email{' '}
            <a
              className="underline decoration-ochre-500 underline-offset-2 hover:text-gray-900 dark:hover:text-white"
              href="mailto:methodology@qualcanvas.com"
            >
              methodology@qualcanvas.com
            </a>
            . Reviewers are credited on the published chapter and paid a small honorarium.
          </p>
        </div>
      </article>
    </PageShell>
  );
}
