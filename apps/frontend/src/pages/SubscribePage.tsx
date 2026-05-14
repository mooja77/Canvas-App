import { useEffect, useState } from 'react';
import { usePageMeta } from '../hooks/usePageMeta';
import { trackEvent } from '../utils/analytics';
import PageShell from '../components/marketing/PageShell';
import Eyebrow from '../components/marketing/Eyebrow';
import DisplayHeading from '../components/marketing/DisplayHeading';
import HairlineRule from '../components/marketing/HairlineRule';

/**
 * /subscribe — methodology field-guide newsletter landing.
 *
 * This is a placeholder surface until a Buttondown/ConvertKit account is wired
 * (docs/refresh/12 open decision #14). For now we direct researchers to an
 * email-to-subscribe mailto so the signal isn't lost — they hit reply, we add
 * them by hand. When the proper back end is wired this page can become a real
 * form posting to the provider.
 */
export default function SubscribePage() {
  const [copied, setCopied] = useState(false);

  usePageMeta(
    'Subscribe to the methodology field guide — QualCanvas',
    'One chapter a month. Six chapters covering thematic analysis, grounded theory, IPA, intercoder reliability, ethics. Free, citeable.',
  );

  useEffect(() => {
    trackEvent('marketing_page_viewed', { page: '/subscribe' });
  }, []);

  const handleSubscribeClick = () => {
    trackEvent('cta_clicked', {
      cta_label: 'Subscribe by email',
      location: 'subscribe_page',
      target_route: 'mailto_subscribe',
    });
  };

  const handleRssCopy = async () => {
    try {
      await navigator.clipboard.writeText('https://qualcanvas.com/methodology/feed.xml');
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      // Clipboard API may fail on insecure contexts; the URL is visible above so users can copy manually.
    }
  };

  return (
    <PageShell>
      <article className="max-w-2xl mx-auto px-4 sm:px-6 pt-16 pb-24">
        <HairlineRule className="mb-6" />
        <Eyebrow className="mb-3">Methodology field guide</Eyebrow>
        <DisplayHeading size="md" className="mb-7">
          One chapter a month.
        </DisplayHeading>
        <p className="text-lg text-gray-600 dark:text-gray-300 leading-relaxed mb-10">
          Six chapters in the field guide so far — covering thematic analysis, grounded theory, IPA, intercoder
          reliability, and ethics in practice. Each comes out after peer review by a credentialed methodologist. Free,
          citeable, plain English.
        </p>

        {/* Mailto subscribe — proper back end TODO */}
        <section className="rounded-2xl p-6 sm:p-8 bg-white dark:bg-gray-800/60 ring-1 ring-gray-200 dark:ring-gray-700">
          <h2 className="text-base font-semibold text-gray-900 dark:text-white mb-2">By email</h2>
          <p className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed mb-4">
            Send a one-line email and we'll add you to the field-guide list. One issue a month, no other emails ever,
            unsubscribe with a single reply.
          </p>
          <a
            href="mailto:methodology@qualcanvas.com?subject=Subscribe%20me%20to%20the%20field%20guide&body=Hi%20—%20please%20add%20me%20to%20the%20monthly%20methodology%20field%20guide.%20Thanks."
            onClick={handleSubscribeClick}
            className="
              inline-flex items-center justify-center
              bg-ochre-500 hover:bg-ochre-600 text-ink-950 font-semibold
              px-6 py-2.5 rounded-lg
              transition-colors duration-150
              focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ochre-400 focus-visible:ring-offset-2
            "
          >
            Subscribe by email
          </a>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-3">
            We're switching to a proper newsletter back end in the next release. Until then, this is the simplest way —
            and we read every reply.
          </p>
        </section>

        {/* RSS */}
        <section className="mt-6 rounded-2xl p-6 sm:p-8 bg-white dark:bg-gray-800/60 ring-1 ring-gray-200 dark:ring-gray-700">
          <h2 className="text-base font-semibold text-gray-900 dark:text-white mb-2">Via RSS</h2>
          <p className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed mb-4">
            Prefer not to share an email? The field guide is also published as an Atom/RSS feed.
          </p>
          <div className="flex items-center gap-3">
            <code className="flex-1 px-3 py-2 rounded-lg bg-gray-100 dark:bg-gray-900 text-sm font-mono text-gray-800 dark:text-gray-200 break-all">
              https://qualcanvas.com/methodology/feed.xml
            </code>
            <button
              onClick={handleRssCopy}
              className="
                inline-flex items-center justify-center
                text-sm font-medium text-ochre-700 dark:text-ochre-400
                hover:underline decoration-ochre-500 underline-offset-4
                px-3 py-2 rounded
                focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ochre-400 focus-visible:ring-offset-2
              "
            >
              {copied ? 'Copied.' : 'Copy'}
            </button>
          </div>
        </section>

        <p className="text-sm text-gray-500 dark:text-gray-400 mt-10">
          What you'll get: roughly 2,000 words per issue, written by the team, reviewed by a credentialed methodologist
          before publish. The full TOC and read-times are on{' '}
          <a
            className="underline decoration-ochre-500 underline-offset-2 hover:text-gray-900 dark:hover:text-white"
            href="/methodology"
          >
            /methodology
          </a>
          .
        </p>
      </article>
    </PageShell>
  );
}
