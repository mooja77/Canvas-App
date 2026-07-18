import { useEffect, useState } from 'react';
import { usePageMeta } from '../hooks/usePageMeta';
import { trackEvent } from '../utils/analytics';
import PageShell from '../components/marketing/PageShell';
import Eyebrow from '../components/marketing/Eyebrow';
import DisplayHeading from '../components/marketing/DisplayHeading';
import HairlineRule from '../components/marketing/HairlineRule';
import { publicEmailApi } from '../services/api';

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
  const [email, setEmail] = useState('');
  const [consent, setConsent] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState('');

  usePageMeta(
    'Subscribe to the methodology field guide — QualCanvas',
    'One chapter a month. Six chapters covering thematic analysis, grounded theory, IPA, intercoder reliability, ethics. Free, citeable.',
  );

  useEffect(() => {
    trackEvent('marketing_page_viewed', { page: '/subscribe' });
  }, []);

  const handleSubscribe = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!consent || !email.trim()) return;
    setSubmitting(true);
    setMessage('');
    trackEvent('cta_clicked', {
      cta_label: 'Subscribe to field guide',
      location: 'subscribe_page',
      target_route: 'newsletter_subscribe',
    });
    try {
      const response = await publicEmailApi.subscribeNewsletter(email.trim());
      setMessage(response.data.message || 'Check your inbox to confirm your subscription.');
      setEmail('');
      setConsent(false);
    } catch {
      setMessage('We could not start the subscription. Please try again.');
    } finally {
      setSubmitting(false);
    }
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
          reliability, and ethics in practice. Chapters are clearly labelled working drafts until external review is
          complete. Free, citeable, plain English.
        </p>

        <section className="rounded-2xl p-6 sm:p-8 bg-white dark:bg-gray-800/60 ring-1 ring-gray-200 dark:ring-gray-700">
          <h2 className="text-base font-semibold text-gray-900 dark:text-white mb-2">By email</h2>
          <p className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed mb-4">
            Enter your email, then use the confirmation link we send. Every issue includes a one-click unsubscribe link.
          </p>
          <form onSubmit={handleSubscribe} className="space-y-4">
            <label className="block text-sm font-medium text-gray-800 dark:text-gray-200">
              Email address
              <input
                type="email"
                required
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                autoComplete="email"
                className="mt-1 block w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-gray-900 focus:border-ochre-500 focus:outline-none focus:ring-2 focus:ring-ochre-300 dark:border-gray-600 dark:bg-gray-900 dark:text-white"
              />
            </label>
            <label className="flex items-start gap-3 text-sm text-gray-600 dark:text-gray-300">
              <input
                type="checkbox"
                required
                checked={consent}
                onChange={(event) => setConsent(event.target.checked)}
                className="mt-0.5 h-4 w-4 rounded border-gray-300 text-ochre-600 focus:ring-ochre-500"
              />
              I consent to receive the QualCanvas methodology field guide by email.
            </label>
            <button
              type="submit"
              disabled={submitting || !consent}
              className="inline-flex items-center justify-center rounded-lg bg-ochre-500 px-6 py-2.5 font-semibold text-ink-950 transition-colors hover:bg-ochre-600 disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ochre-400 focus-visible:ring-offset-2"
            >
              {submitting ? 'Sending confirmation…' : 'Subscribe'}
            </button>
            {message && (
              <p role="status" className="text-sm text-gray-700 dark:text-gray-200">
                {message}
              </p>
            )}
          </form>
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
          What you'll get: a concise field-guide update from the QualCanvas team. The full TOC, read-times and review
          status are on{' '}
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
