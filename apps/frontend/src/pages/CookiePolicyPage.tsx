import { Link } from 'react-router-dom';
import { usePageMeta } from '../hooks/usePageMeta';

/**
 * Sprint E — Cookie Policy page. Required by EU ePrivacy + already
 * referenced from the cookie-consent banner footer link. Plain prose,
 * enumerates the specific cookies we set rather than vague categories.
 */
export default function CookiePolicyPage() {
  usePageMeta('Cookie Policy — QualCanvas', 'The cookies QualCanvas sets, why we set them, and how to opt out.');

  return (
    <div className="min-h-screen bg-white dark:bg-gray-900 text-gray-800 dark:text-gray-200">
      <header className="border-b border-gray-200 dark:border-gray-800 bg-white/95 dark:bg-gray-900/95 backdrop-blur">
        <div className="max-w-4xl mx-auto px-6 py-4 flex items-center justify-between">
          <Link to="/" className="text-sm font-medium text-brand-600 hover:underline">
            ← QualCanvas
          </Link>
          <nav className="text-xs text-gray-500 space-x-4">
            <Link to="/trust" className="underline underline-offset-2 hover:text-gray-700 dark:hover:text-gray-300">
              Trust
            </Link>
            <Link to="/privacy" className="underline underline-offset-2 hover:text-gray-700 dark:hover:text-gray-300">
              Privacy
            </Link>
            <Link to="/terms" className="underline underline-offset-2 hover:text-gray-700 dark:hover:text-gray-300">
              Terms
            </Link>
          </nav>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-6 py-10 prose prose-sm dark:prose-invert">
        <h1 className="text-3xl font-semibold mt-0">Cookie Policy</h1>
        <p className="text-gray-500 dark:text-gray-400">
          QualCanvas uses a small number of cookies plus browser local-storage. This page lists each one.
        </p>

        <h2>Strictly necessary</h2>
        <p>These can&apos;t be disabled without breaking core functionality.</p>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-200 dark:border-gray-700">
              <th className="text-left py-1">Name</th>
              <th className="text-left py-1">Purpose</th>
              <th className="text-left py-1">Lifetime</th>
            </tr>
          </thead>
          <tbody>
            <tr className="border-b border-gray-100 dark:border-gray-800">
              <td className="py-1 font-mono text-xs">jwt</td>
              <td className="py-1">Authenticated session. HttpOnly, SameSite=Lax.</td>
              <td className="py-1">24 hours</td>
            </tr>
            <tr className="border-b border-gray-100 dark:border-gray-800">
              <td className="py-1 font-mono text-xs">jms_cookie_consent</td>
              <td className="py-1">Local-storage record of your optional analytics choice.</td>
              <td className="py-1">Until you change it or clear site data</td>
            </tr>
            <tr className="border-b border-gray-100 dark:border-gray-800">
              <td className="py-1 font-mono text-xs">qualcanvas-* / canvas-*</td>
              <td className="py-1">
                LocalStorage for canvas UI state, feature flags, onboarding progress, offline cache.
              </td>
              <td className="py-1">Persists until cleared</td>
            </tr>
            <tr className="border-b border-gray-100 dark:border-gray-800">
              <td className="py-1 font-mono text-xs">jms_chat</td>
              <td className="py-1">Keeps your support-chat conversation available while this browser tab is open.</td>
              <td className="py-1">Browser session</td>
            </tr>
            <tr className="border-b border-gray-100 dark:border-gray-800">
              <td className="py-1 font-mono text-xs">jms_chat_dismissed</td>
              <td className="py-1">Remembers that you closed the support-chat button.</td>
              <td className="py-1">24 hours</td>
            </tr>
          </tbody>
        </table>

        <h2>Optional analytics &amp; conversion measurement</h2>
        <p>
          Google Analytics, Google Ads conversion measurement and Meta conversion measurement remain disabled until you
          accept the banner. Cookieless Plausible analytics loads on public marketing pages and does not use an
          advertising identifier.
        </p>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-200 dark:border-gray-700">
              <th className="text-left py-1">Name</th>
              <th className="text-left py-1">Purpose</th>
              <th className="text-left py-1">Lifetime</th>
            </tr>
          </thead>
          <tbody>
            <tr className="border-b border-gray-100 dark:border-gray-800">
              <td className="py-1 font-mono text-xs">_ga / _ga_*</td>
              <td className="py-1">Google Analytics 4 — aggregate page views, retention.</td>
              <td className="py-1">2 years</td>
            </tr>
            <tr className="border-b border-gray-100 dark:border-gray-800">
              <td className="py-1 font-mono text-xs">_gcl_*</td>
              <td className="py-1">Google Ads — consented conversion attribution.</td>
              <td className="py-1">Up to 90 days</td>
            </tr>
            <tr className="border-b border-gray-100 dark:border-gray-800">
              <td className="py-1 font-mono text-xs">_fbp / _fbc</td>
              <td className="py-1">Meta — consented conversion attribution.</td>
              <td className="py-1">Up to 90 days</td>
            </tr>
          </tbody>
        </table>

        <h2>Operational observability</h2>
        <p>
          Sentry may use a short-lived <code>sentry-trace</code> value to connect frontend and backend errors. We use
          this for service reliability, not advertising, and QualCanvas does not enable Sentry Session Replay because
          research content can be sensitive.
        </p>

        <h2>Boundaries</h2>
        <ul>
          <li>No optional analytics or advertising measurement is loaded before you accept.</li>
          <li>No third-party social-button cookies on logged-out pages.</li>
          <li>No fingerprinting beyond what Cloudflare / Sentry use for security &amp; error attribution.</li>
        </ul>

        <h2>Managing cookies</h2>
        <button
          type="button"
          className="not-prose mb-4 rounded-lg border border-brand-300 px-4 py-2 text-sm font-semibold text-brand-700 hover:bg-brand-50 dark:border-brand-700 dark:text-brand-300 dark:hover:bg-brand-950/30"
          onClick={() => window.dispatchEvent(new Event('qualcanvas:open-cookie-preferences'))}
        >
          Cookie settings
        </button>
        <ul>
          <li>
            <strong>In-app:</strong> open the consent banner via the footer &quot;Cookie settings&quot; link to turn
            optional measurement on or off. Withdrawing consent stops the measurement container and clears known
            first-party analytics cookies.
          </li>
          <li>
            <strong>In your browser:</strong> standard browser settings let you delete or block any of these. Deleting
            the <code>jwt</code> cookie will log you out.
          </li>
          <li>
            <strong>Opt-out across sites:</strong> consider a tool like uBlock Origin or your browser&apos;s built-in
            tracking-protection toggle.
          </li>
        </ul>

        <p className="mt-12 text-xs text-gray-600 dark:text-gray-400">Last updated: 2026-08-27.</p>
      </main>
    </div>
  );
}
