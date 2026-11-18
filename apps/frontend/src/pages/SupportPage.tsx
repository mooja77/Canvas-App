import { Link } from 'react-router-dom';
import { usePageMeta } from '../hooks/usePageMeta';

/**
 * Help screen. Served by the support shell (support-shell.html), the only
 * shell that loads the JMS support chat widget, so the chat button appears here
 * and on /account but never beside research data.
 */
export default function SupportPage() {
  usePageMeta('Help — QualCanvas', 'Get help with QualCanvas: chat with support or email us.');

  return (
    <main className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="max-w-2xl mx-auto px-4 py-12">
        <div className="flex items-center justify-between mb-8">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Help</h1>
          <Link to="/canvas" className="text-sm text-brand-600 dark:text-brand-400 hover:underline">
            Back to canvas
          </Link>
        </div>
        <p className="mb-4 text-gray-700 dark:text-gray-300">
          Use the chat button at the bottom right of this page to ask a question, or email{' '}
          <a className="underline" href="mailto:support@qualcanvas.com?subject=QualCanvas%20help">
            support@qualcanvas.com
          </a>
          . We reply within two business days.
        </p>
        <p className="text-sm text-gray-600 dark:text-gray-400">
          The chat is only available on this page and on your account page, so it never sits beside your transcripts.
          Please do not paste participant data or transcript text into the chat or an email.
        </p>
        <p className="mt-6 text-sm">
          <Link to="/guide" className="text-brand-600 dark:text-brand-400 hover:underline">
            Read the user guide
          </Link>
        </p>
      </div>
    </main>
  );
}
