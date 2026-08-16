import { Link } from 'react-router-dom';
import { usePageMeta } from '../hooks/usePageMeta';

/**
 * Sprint E — GDPR Art. 13 rewrite of the Privacy Policy. Adds the
 * sections institutional buyers (and EU regulators) explicitly look for:
 * lawful basis, data subject rights (Arts. 15-21), retention by category,
 * international transfers, sub-processor pointer, DPO contact.
 *
 * Content is informational scaffolding — formal legal review (Iubenda /
 * external counsel) should sign off before treating as authoritative.
 */
export default function PrivacyPage() {
  usePageMeta(
    'Privacy Policy — QualCanvas',
    'How QualCanvas collects, uses, and protects researcher data, including data-subject rights and transfers.',
  );
  return (
    <main className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="max-w-3xl mx-auto px-4 py-12">
        <Link to="/" className="text-sm text-brand-600 dark:text-brand-400 hover:underline mb-6 inline-block">
          &larr; Back to home
        </Link>
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">Privacy Policy</h1>
        <p className="text-xs text-gray-600 dark:text-gray-300 mb-8">
          Last updated: 2026-07-18. See also:{' '}
          <Link to="/trust" className="text-brand-600 hover:underline">
            Trust
          </Link>{' '}
          ·{' '}
          <Link to="/cookies" className="text-brand-600 hover:underline">
            Cookies
          </Link>{' '}
          ·{' '}
          <Link to="/terms" className="text-brand-600 hover:underline">
            Terms
          </Link>
        </p>

        <div className="prose dark:prose-invert max-w-none space-y-5 text-sm text-gray-700 dark:text-gray-300 [&_a]:underline [&_a]:underline-offset-2">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Who we are</h2>
          <p>
            QualCanvas is a qualitative-coding workspace for academic and applied researchers. Contact:{' '}
            <a href="mailto:privacy@qualcanvas.com">privacy@qualcanvas.com</a>. For EU data-subject requests:{' '}
            <a href="mailto:eu-privacy@qualcanvas.com">eu-privacy@qualcanvas.com</a>.
          </p>

          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">What we collect</h2>
          <p>
            <strong>Account data:</strong> name, email, hashed password, sign-in provider (e.g. Google OAuth identity
            only — no scopes that share content).
          </p>
          <p>
            <strong>Research content:</strong> transcripts, codes, codings, memos, cases, analysis runs, and any files
            you upload. This is the data you are entrusting to us; we treat it as the user&apos;s data, not ours.
          </p>
          <p>
            <strong>Usage data:</strong> feature-interaction telemetry (which buttons, which analyses you ran), error
            logs, request IDs, hashed IP, billing events.
          </p>
          <p>
            <strong>Training videos:</strong> the training centre serves preview images directly from QualCanvas and
            does not contact YouTube until you choose Play. After that choice, the privacy-enhanced YouTube player may
            receive your IP address, browser information and viewing activity under Google&apos;s privacy terms.
          </p>
          <p>
            <strong>AI provider keys:</strong> If you BYOK an OpenAI / Anthropic / Google API key, it&apos;s stored
            AES-256-GCM encrypted at rest. The backend decrypts the key only when sending your requested AI call to the
            selected provider; the provider receives the prompt and relevant research excerpts needed for that call.
          </p>

          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Lawful basis (GDPR Art. 6)</h2>
          <ul>
            <li>
              <strong>Contract (Art. 6(1)(b)):</strong> for paid subscriptions, the processing is necessary to perform
              the contract with you.
            </li>
            <li>
              <strong>Legitimate interest (Art. 6(1)(f)):</strong> for free / academic users, our legitimate interest is
              providing the service and improving it (security, fraud prevention, aggregate analytics).
            </li>
            <li>
              <strong>Consent (Art. 6(1)(a)):</strong> for analytics cookies and lifecycle / product-update emails.
              Withdraw at any time via the cookie banner or your account preferences.
            </li>
          </ul>

          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Data subject rights</h2>
          <p>EU / UK customers have the following rights under GDPR / UK GDPR:</p>
          <ul>
            <li>
              <strong>Access (Art. 15):</strong> request a copy of your data. Self-service via{' '}
              <em>Account &rarr; Export</em>.
            </li>
            <li>
              <strong>Rectification (Art. 16):</strong> correct inaccurate data. Most fields are editable in-app.
            </li>
            <li>
              <strong>Erasure (Art. 17):</strong> delete your account from <em>Account &rarr; Delete account</em>. Hard
              deletion removes the live account and related project records. Encrypted backup copies expire under the
              hosting provider&apos;s backup lifecycle.
            </li>
            <li>
              <strong>Portability (Art. 20):</strong> export to CSV, QDPX, JSON via the canvas Export menu.
            </li>
            <li>
              <strong>Objection (Art. 21) / restriction (Art. 18):</strong> email{' '}
              <a href="mailto:eu-privacy@qualcanvas.com">eu-privacy@qualcanvas.com</a>.
            </li>
          </ul>

          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Retention</h2>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200 dark:border-gray-700">
                <th className="text-left py-1">Category</th>
                <th className="text-left py-1">Retention</th>
              </tr>
            </thead>
            <tbody>
              <tr className="border-b border-gray-100 dark:border-gray-800">
                <td className="py-1">Account + research content</td>
                <td className="py-1">
                  Until you delete the account; provider-managed encrypted backups expire separately
                </td>
              </tr>
              <tr className="border-b border-gray-100 dark:border-gray-800">
                <td className="py-1">Audit / access logs</td>
                <td className="py-1">While needed for account security, support and the project audit trail</td>
              </tr>
              <tr className="border-b border-gray-100 dark:border-gray-800">
                <td className="py-1">Billing records</td>
                <td className="py-1">7 years (tax / accounting requirement)</td>
              </tr>
              <tr className="border-b border-gray-100 dark:border-gray-800">
                <td className="py-1">Error / telemetry events</td>
                <td className="py-1">According to the configured Sentry and analytics workspace retention</td>
              </tr>
            </tbody>
          </table>

          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Sub-processors</h2>
          <p>
            Full list with locations and DPA status at <Link to="/trust#sub-processors">qualcanvas.com/trust</Link>. We
            notify institutional customers of new sub-processors at least 30 days before they go live, per our DPA.
          </p>

          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">International transfers</h2>
          <p>
            Most processing occurs in the US (Railway, Cloudflare, Stripe, Resend). For EU customers, we transfer
            personal data under the transfer mechanisms documented by the relevant providers and our applicable
            agreements. An EU-resident application database is not currently available.
          </p>

          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Children</h2>
          <p>
            QualCanvas is intended for researchers aged 18+ and is not directed at children. If you believe a child has
            created an account, contact us and we&apos;ll delete it promptly.
          </p>

          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Complaints</h2>
          <p>
            You may also lodge a complaint with your local data-protection authority (e.g. the ICO in the UK, CNIL in
            France, BfDI in Germany).
          </p>

          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Changes</h2>
          <p>
            Material changes will be announced via in-app notice and email to active users at least 30 days before
            taking effect.
          </p>
        </div>
      </div>
    </main>
  );
}
