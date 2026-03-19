import { Link } from 'react-router-dom';

export default function TermsPage() {
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="max-w-3xl mx-auto px-4 py-16">
        <Link to="/" className="text-sm text-brand-600 dark:text-brand-400 hover:underline mb-8 inline-block">
          &larr; Back to home
        </Link>
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-8">Terms of Service</h1>
        <div className="prose dark:prose-invert max-w-none space-y-6 text-sm text-gray-700 dark:text-gray-300">
          <p><strong>Last updated:</strong> March 2026</p>

          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mt-6">1. Acceptance of Terms</h2>
          <p>By accessing or using Canvas App ("the Service"), you agree to be bound by these Terms of Service. If you do not agree, do not use the Service.</p>

          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mt-6">2. Description of Service</h2>
          <p>Canvas App is a qualitative research coding platform that allows you to upload transcripts, apply codes, and perform analysis. The Service is provided on a subscription basis with Free, Pro, and Team tiers.</p>

          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mt-6">3. Your Data</h2>
          <p>You retain all rights to the data you upload. We do not claim ownership of your research data, transcripts, or analysis. You are responsible for ensuring you have the necessary consent and ethical approval to process any personal data you upload.</p>

          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mt-6">4. Acceptable Use</h2>
          <p>You agree not to use the Service for any unlawful purpose or in violation of research ethics standards. You may not attempt to reverse-engineer, disrupt, or abuse the Service.</p>

          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mt-6">5. Billing & Refunds</h2>
          <p>Paid plans are billed monthly or annually through Stripe. You may cancel at any time and retain access until the end of the billing period. We offer a 30-day money-back guarantee for new subscribers.</p>

          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mt-6">6. Account Termination</h2>
          <p>You may delete your account at any time. We may suspend accounts that violate these terms. Upon deletion, your data will be permanently removed.</p>

          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mt-6">7. Limitation of Liability</h2>
          <p>The Service is provided "as is." We are not liable for any loss of data, research delays, or damages arising from use of the Service, to the maximum extent permitted by law.</p>

          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mt-6">8. Changes to Terms</h2>
          <p>We may update these terms from time to time. Continued use of the Service after changes constitutes acceptance of the new terms.</p>
        </div>
      </div>
    </div>
  );
}
