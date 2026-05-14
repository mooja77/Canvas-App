import { useEffect } from 'react';
import { usePageMeta } from '../hooks/usePageMeta';
import { trackEvent } from '../utils/analytics';
import PageShell from '../components/marketing/PageShell';
import Eyebrow from '../components/marketing/Eyebrow';
import DisplayHeading from '../components/marketing/DisplayHeading';
import HairlineRule from '../components/marketing/HairlineRule';
import StudioCredit from '../components/marketing/StudioCredit';

/**
 * /colophon — single-page documentation of the craft (stack, fonts, palette,
 * accessibility statement, JMS Dev Lab credit) per docs/refresh/06-pages/12.
 *
 * The dignified surface for the studio credit. Maya gets to read about the
 * type system and citation guidance; Tom (the studio prospect) gets to land
 * here from the footer link and see craft signals without sales pressure.
 */
export default function ColophonPage() {
  usePageMeta('Colophon — QualCanvas', 'The fonts, colors, stack, and studio behind QualCanvas.');

  useEffect(() => {
    trackEvent('marketing_page_viewed', { page: '/colophon' });
  }, []);

  return (
    <PageShell>
      <article className="max-w-3xl mx-auto px-4 sm:px-6 pt-16 pb-24">
        <HairlineRule className="mb-6" />
        <Eyebrow className="mb-3">Colophon</Eyebrow>
        <DisplayHeading as="h1" size="md" className="mb-10">
          About this site.
        </DisplayHeading>

        <div className="prose prose-lg dark:prose-invert max-w-none space-y-6 text-gray-700 dark:text-gray-300 leading-relaxed">
          <p>
            This site is set in <strong className="font-medium text-gray-900 dark:text-white">Fraunces</strong>{' '}
            (Undercase Type) and <strong className="font-medium text-gray-900 dark:text-white">Inter</strong> (Rasmus
            Andersson). Both are self-hosted via <code className="text-sm font-mono">@fontsource-variable</code>, served
            from the same edge as the rest of the site. No third-party font CDN; no extra request.
          </p>

          <p>
            The two colors are <strong className="font-medium text-gray-900 dark:text-white">Ink</strong> — the deepest
            blue we could find without making it black — and{' '}
            <strong className="font-medium text-gray-900 dark:text-white">Ochre</strong>, a single warm gold that
            appears only at decisions: a heading rule, a focus ring, a primary action. If you see ochre on the page,
            something wants your attention.
          </p>

          <p>
            Built with React, Vite, and Tailwind. Deployed on Cloudflare Pages. Designed and built by{' '}
            <a
              href="https://www.jmsdevlab.com/apps.html#qualcanvas"
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => trackEvent('studio_credit_clicked', { location: 'colophon' })}
              className="text-gray-900 dark:text-white underline decoration-ochre-500 underline-offset-4"
            >
              JMS Dev Lab
            </a>{' '}
            in Ireland — a studio that builds custom software for businesses too unique for off-the-shelf tools.
          </p>

          <h2
            className="font-display text-2xl mt-12 mb-4 text-gray-900 dark:text-white"
            style={{ fontVariationSettings: "'opsz' 48, 'wght' 580" }}
          >
            Accessibility
          </h2>
          <p>
            We target WCAG 2.2 AA across all marketing pages. The interactive coding demo (when it ships in the next
            release) is fully keyboard-navigable. Motion respects{' '}
            <code className="text-sm font-mono">prefers-reduced-motion</code>. A formal accessibility statement lives at{' '}
            <a
              className="underline decoration-ochre-500 underline-offset-2 hover:text-gray-900 dark:hover:text-white"
              href="/accessibility-statement"
            >
              /accessibility-statement
            </a>
            .
          </p>

          <h2
            className="font-display text-2xl mt-12 mb-4 text-gray-900 dark:text-white"
            style={{ fontVariationSettings: "'opsz' 48, 'wght' 580" }}
          >
            Performance budget
          </h2>
          <p>
            Under 80 KB JS and under 30 KB CSS per marketing route. LCP under 1.2 seconds on 4G. We test on a
            four-year-old Pixel and an iPhone SE.
          </p>

          <h2
            className="font-display text-2xl mt-12 mb-4 text-gray-900 dark:text-white"
            style={{ fontVariationSettings: "'opsz' 48, 'wght' 580" }}
          >
            Privacy
          </h2>
          <p>
            We use Plausible (no cookies, GDPR-clean) for marketing-page analytics. No transcript content from
            QualCanvas ever reaches the marketing site. The product itself has its own data posture documented on{' '}
            <a
              className="underline decoration-ochre-500 underline-offset-2 hover:text-gray-900 dark:hover:text-white"
              href="/trust"
            >
              /trust
            </a>{' '}
            and an AI-specific policy on{' '}
            <a
              className="underline decoration-ochre-500 underline-offset-2 hover:text-gray-900 dark:hover:text-white"
              href="/trust/ai"
            >
              /trust/ai
            </a>
            .
          </p>

          <h2
            className="font-display text-2xl mt-12 mb-4 text-gray-900 dark:text-white"
            style={{ fontVariationSettings: "'opsz' 48, 'wght' 580" }}
          >
            Credit
          </h2>
          <p>
            The team behind QualCanvas works in public when we can. Code is on{' '}
            <a
              className="underline decoration-ochre-500 underline-offset-2 hover:text-gray-900 dark:hover:text-white"
              href="https://github.com/mooja77"
            >
              GitHub
            </a>
            ; long-form notes ship on{' '}
            <a
              className="underline decoration-ochre-500 underline-offset-2 hover:text-gray-900 dark:hover:text-white"
              href="/methodology"
            >
              /methodology
            </a>{' '}
            and{' '}
            <a
              className="underline decoration-ochre-500 underline-offset-2 hover:text-gray-900 dark:hover:text-white"
              href="/changelog"
            >
              /changelog
            </a>
            . If you'd like to cite the site itself, the citation entry is on{' '}
            <a
              className="underline decoration-ochre-500 underline-offset-2 hover:text-gray-900 dark:hover:text-white"
              href="/cite"
            >
              /cite
            </a>
            .
          </p>
        </div>

        <div className="mt-16 pt-8 border-t border-gray-200 dark:border-gray-800">
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Last reviewed: {new Date().toISOString().slice(0, 10)}.
          </p>
          <div className="mt-3">
            <StudioCredit location="colophon" />
          </div>
        </div>
      </article>
    </PageShell>
  );
}
