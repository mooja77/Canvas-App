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
            <Link to="/trust" className="hover:text-gray-700 dark:hover:text-gray-300">
              Trust
            </Link>
            <Link to="/privacy" className="hover:text-gray-700 dark:hover:text-gray-300">
              Privacy
            </Link>
            <Link to="/terms" className="hover:text-gray-700 dark:hover:text-gray-300">
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
              <td className="py-1">7 days</td>
            </tr>
            <tr className="border-b border-gray-100 dark:border-gray-800">
              <td className="py-1 font-mono text-xs">csrf_token</td>
              <td className="py-1">CSRF protection on state-changing requests.</td>
              <td className="py-1">Session</td>
            </tr>
            <tr className="border-b border-gray-100 dark:border-gray-800">
              <td className="py-1 font-mono text-xs">jms_cookie_consent</td>
              <td className="py-1">Records your consent choice on this banner.</td>
              <td className="py-1">1 year</td>
            </tr>
            <tr className="border-b border-gray-100 dark:border-gray-800">
              <td className="py-1 font-mono text-xs">qualcanvas-*</td>
              <td className="py-1">
                LocalStorage for canvas UI state, feature flags, onboarding progress, offline cache.
              </td>
              <td className="py-1">Persists until cleared</td>
            </tr>
          </tbody>
        </table>

        <h2>Analytics &amp; observability</h2>
        <p>Loaded only after you accept the consent banner. We don&apos;t share these IDs with advertisers.</p>
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
              <td className="py-1 font-mono text-xs">sentry-trace</td>
              <td className="py-1">Sentry error correlation across frontend + backend.</td>
              <td className="py-1">Session</td>
            </tr>
          </tbody>
        </table>

        <h2>Cookies we do NOT set</h2>
        <ul>
          <li>No advertising / cross-site tracking pixels.</li>
          <li>No third-party social-button cookies on logged-out pages.</li>
          <li>No fingerprinting beyond what Cloudflare / Sentry use for security &amp; error attribution.</li>
        </ul>

        <h2>Managing cookies</h2>
        <ul>
          <li>
            <strong>In-app:</strong> open the consent banner via the footer &quot;Cookie Preferences&quot; link to
            toggle analytics on/off.
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

        <p className="mt-12 text-xs text-gray-400 dark:text-gray-500">
          Last updated: {new Date().toISOString().slice(0, 10)}.
        </p>
      </main>
    </div>
  );
}
