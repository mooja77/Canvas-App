import { Link } from 'react-router-dom';

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="max-w-3xl mx-auto px-4 py-16">
        <Link to="/" className="text-sm text-brand-600 dark:text-brand-400 hover:underline mb-8 inline-block">
          &larr; Back to home
        </Link>
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-8">Privacy Policy</h1>
        <div className="prose dark:prose-invert max-w-none space-y-6 text-sm text-gray-700 dark:text-gray-300">
          <p><strong>Last updated:</strong> March 2026</p>

          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mt-6">1. Information We Collect</h2>
          <p>We collect information you provide directly: your name, email address, and research data you upload (transcripts, codes, memos). We also collect usage data such as feature usage statistics and error logs.</p>

          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mt-6">2. How We Use Your Information</h2>
          <p>We use your information to provide and improve the Service, process payments, and communicate with you about your account. We do not use your research data for any purpose other than providing the Service to you.</p>

          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mt-6">3. Data Storage & Security</h2>
          <p>Your data is stored in encrypted databases. All data in transit is encrypted using TLS. We implement industry-standard security measures to protect your information.</p>

          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mt-6">4. Data Sharing</h2>
          <p>We do not sell or share your personal data or research data with third parties, except as required by law or with service providers (e.g., Stripe for payment processing) who are bound by confidentiality obligations.</p>

          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mt-6">5. Research Data</h2>
          <p>We recognize the sensitive nature of qualitative research data. Your transcripts, codes, and analysis are never accessed by our staff except for technical support purposes with your explicit consent.</p>

          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mt-6">6. Data Retention</h2>
          <p>We retain your data as long as your account is active. When you delete your account, all associated data is permanently deleted within 30 days.</p>

          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mt-6">7. Your Rights</h2>
          <p>You have the right to access, export, correct, or delete your data at any time through your account settings. You may also contact us to exercise these rights.</p>

          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mt-6">8. Cookies</h2>
          <p>We use essential cookies for authentication. We do not use tracking or advertising cookies.</p>

          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mt-6">9. Contact</h2>
          <p>For privacy questions, contact us at privacy@canvasapp.com.</p>
        </div>
      </div>
    </div>
  );
}
