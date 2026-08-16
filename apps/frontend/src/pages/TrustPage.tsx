import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { usePageMeta } from '../hooks/usePageMeta';
import { trackEvent } from '../utils/analytics';

/**
 * Sprint E — public Trust page. Mirrors the spec's 8 sections so
 * institutional buyers (universities, healthcare-adjacent orgs, EU
 * customers) have a single URL to point procurement at.
 *
 * Anything below marked "TBD" needs the company's legal review or formal
 * audit before going live for serious institutional sales. The scaffolding
 * is shippable as-is for self-service buyers.
 */
export default function TrustPage() {
  usePageMeta(
    'Trust & Security — QualCanvas',
    'How QualCanvas handles your research data: hosting, encryption, sub-processors, audit logging, and compliance roadmap.',
  );

  useEffect(() => {
    trackEvent('trust_page_viewed');
  }, []);

  return (
    <div className="min-h-screen bg-white dark:bg-gray-900 text-gray-800 dark:text-gray-200">
      <header className="border-b border-gray-200 dark:border-gray-800 bg-white/95 dark:bg-gray-900/95 backdrop-blur">
        <div className="max-w-4xl mx-auto px-6 py-4 flex items-center justify-between">
          <Link to="/" className="text-sm font-medium text-brand-600 hover:underline">
            ← QualCanvas
          </Link>
          <nav className="text-xs text-gray-500 space-x-4">
            <Link to="/privacy" className="underline underline-offset-2 hover:text-gray-700 dark:hover:text-gray-300">
              Privacy
            </Link>
            <Link to="/cookies" className="underline underline-offset-2 hover:text-gray-700 dark:hover:text-gray-300">
              Cookies
            </Link>
            <Link to="/terms" className="underline underline-offset-2 hover:text-gray-700 dark:hover:text-gray-300">
              Terms
            </Link>
          </nav>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-6 py-10 prose prose-sm dark:prose-invert [&_a]:underline [&_a]:underline-offset-2">
        <h1 className="text-3xl font-semibold mt-0">Trust &amp; Security</h1>
        <p className="text-gray-500 dark:text-gray-400">
          QualCanvas is built for qualitative researchers handling interview transcripts, fieldnotes, and other
          potentially-sensitive primary data. This page documents how we handle that data — what we host where, who we
          share it with, what we log, and what we&apos;re building toward.
        </p>

        <h2>At a glance</h2>
        <table className="w-full text-sm">
          <tbody>
            <tr>
              <td className="font-medium w-48">Live service check</td>
              <td>
                <a href="https://api.qualcanvas.com/health">API health endpoint</a>
              </td>
            </tr>
            <tr>
              <td className="font-medium">Incident history</td>
              <td>A dedicated public incident-history page is not currently available</td>
            </tr>
            <tr>
              <td className="font-medium">Security contact</td>
              <td>
                <a href="mailto:security@qualcanvas.com" className="text-brand-600 hover:underline">
                  security@qualcanvas.com
                </a>
              </td>
            </tr>
            <tr>
              <td className="font-medium">Compliance roadmap</td>
              <td>SOC 2 certification is not currently available</td>
            </tr>
          </tbody>
        </table>

        <h2>Hosting &amp; data residency</h2>
        <ul>
          <li>
            <strong>Application + database:</strong> Railway, US East region. All transcripts, codings, memos, and user
            accounts live here.
          </li>
          <li>
            <strong>CDN + edge:</strong> Cloudflare serves the frontend, proxies the custom API domain and provides R2
            object storage for uploaded media.
          </li>
          <li>
            <strong>File uploads:</strong> Cloudflare R2 (S3-compatible), same Cloudflare account.
          </li>
          <li>
            <strong>EU region:</strong> an EU-resident application database is not currently available. Institutions
            with residency requirements should confirm suitability before uploading research data.
          </li>
        </ul>

        <h2>Encryption</h2>
        <ul>
          <li>
            <strong>In transit:</strong> TLS 1.3 everywhere, HSTS enabled, HTTPS-only.
          </li>
          <li>
            <strong>At rest:</strong> Postgres + R2 disks encrypted at the volume layer (provider-managed).
          </li>
          <li>
            <strong>Sensitive credentials:</strong> User-supplied AI API keys are AES-256-GCM encrypted with a
            per-deployment master key (see <code>utils/encryption.ts</code>).
          </li>
          <li>
            <strong>Backups:</strong> Weekly <code>pg_dump</code> to a private R2 bucket scoped to a least-privilege
            token. A restore procedure is documented in <code>docs/runbooks/RESTORE_DRILL.md</code>; restore exercises
            are not yet reported publicly as a recurring service commitment.
          </li>
        </ul>

        <h2>Authentication</h2>
        <ul>
          <li>Email + password (bcrypt, 12 rounds) with email verification</li>
          <li>Google OAuth 2.0 (no data sharing — identity only)</li>
          <li>Legacy access-code sign-in for grandfathered users</li>
          <li>Session JWTs stored in httpOnly+SameSite cookies, rotated on password change</li>
          <li>
            <strong>Not currently available:</strong> MFA and institutional SAML/OIDC SSO
          </li>
        </ul>

        <h2 id="sub-processors">Sub-processors</h2>
        <p>
          We share data with these providers only as needed to deliver the service. New sub-processors are added here
          with at least 30 days&apos; notice for institutional customers (see DPA).
        </p>
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr className="border-b border-gray-200 dark:border-gray-700">
              <th className="text-left py-2">Vendor</th>
              <th className="text-left py-2">Purpose</th>
              <th className="text-left py-2">Location</th>
              <th className="text-left py-2">DPA / posture</th>
            </tr>
          </thead>
          <tbody>
            {SUB_PROCESSORS.map((sp) => (
              <tr key={sp.vendor} className="border-b border-gray-100 dark:border-gray-800">
                <td className="py-2 font-medium">{sp.vendor}</td>
                <td className="py-2">{sp.purpose}</td>
                <td className="py-2 text-gray-500">{sp.location}</td>
                <td className="py-2 text-gray-500">{sp.dpa}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <h2>Audit logging</h2>
        <p>
          Every authenticated request to a canvas resource is recorded in our internal <code>AuditLog</code> table with
          the action (read / write / update / delete / export), timestamp, hashed IP, and response status. Audit events
          remain available with the project while needed for security, support and research traceability.
        </p>
        <p>
          As the owner of a canvas, you can pull the full audit trail at any time via{' '}
          <code>GET /api/v1/canvas/&lt;id&gt;/audit</code> (or via the Quality panel &rarr; &quot;View audit trail&quot;
          in the canvas UI).
        </p>

        <h2>Data subject rights (GDPR)</h2>
        <p>
          EU / UK customers can request access, rectification, erasure, portability, or restriction of their data via{' '}
          <a href="mailto:privacy@qualcanvas.com" className="text-brand-600 hover:underline">
            privacy@qualcanvas.com
          </a>
          . We respond within 30 days per GDPR Art. 12. International transfers covered by Standard Contractual Clauses;
          see our <Link to="/privacy">Privacy Policy</Link>.
        </p>

        <h2 id="dpa">Data processing agreement</h2>
        <p>
          Our standard DPA covers GDPR Art. 28, SCCs (Module 2, 2021/914) + UK Addendum, sub-processor change
          notification (30 days), and breach notification (72 hours). The current draft is available at{' '}
          <a
            href="/legal/dpa.md"
            target="_blank"
            rel="noreferrer"
            className="text-brand-600 hover:underline"
            onClick={() => trackEvent('dpa_downloaded')}
          >
            /legal/dpa.md
          </a>{' '}
          for review; institutional buyers should email{' '}
          <a href="mailto:legal@qualcanvas.com" className="text-brand-600 hover:underline">
            legal@qualcanvas.com
          </a>{' '}
          to counter-sign the executed copy.
        </p>

        <h2>Vulnerability disclosure</h2>
        <p>
          Report security issues to{' '}
          <a href="mailto:security@qualcanvas.com" className="text-brand-600 hover:underline">
            security@qualcanvas.com
          </a>
          . We target a 48-hour acknowledgement and 30-day fix for high-severity issues. We do not currently run a paid
          bug bounty.
        </p>

        <p className="mt-12 text-xs text-gray-600 dark:text-gray-400">
          Last updated: 2026-07-18. This page is informational and does not constitute a contract. For binding
          commitments, see the DPA + Subscription Agreement.
        </p>
      </main>
    </div>
  );
}

const SUB_PROCESSORS = [
  { vendor: 'Railway', purpose: 'Application + Postgres hosting', location: 'US East', dpa: 'Provider terms / DPA' },
  { vendor: 'Cloudflare', purpose: 'CDN, edge, DNS, R2 storage', location: 'Global edge', dpa: 'Provider terms / DPA' },
  { vendor: 'Stripe', purpose: 'Payment processing', location: 'US', dpa: 'Provider privacy and data terms' },
  { vendor: 'Resend', purpose: 'Transactional email', location: 'US', dpa: 'Provider terms / DPA' },
  { vendor: 'Google', purpose: 'OAuth identity', location: 'Global', dpa: 'OAuth only — no data sharing' },
  {
    vendor: 'OpenAI / Anthropic / Google AI',
    purpose: 'Large language model inference',
    location: 'US',
    dpa: 'Requests are proxied by QualCanvas; provider terms apply',
  },
  { vendor: 'Sentry', purpose: 'Error tracking', location: 'Configured project region', dpa: 'Provider terms / DPA' },
  { vendor: 'GitHub Actions', purpose: 'CI + backups', location: 'US', dpa: 'Signed via parent (Microsoft)' },
];
