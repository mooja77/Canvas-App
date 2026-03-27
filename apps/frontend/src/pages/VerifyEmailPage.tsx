import { useState, useEffect } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { authApi } from '../services/api';
import { useAuthStore } from '../stores/authStore';
import { usePageMeta } from '../hooks/usePageMeta';

export default function VerifyEmailPage() {
  usePageMeta('Verify Email — QualCanvas', 'Verify your email address to activate your QualCanvas account.');
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token') || '';
  const email = searchParams.get('email') || '';

  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [errorMessage, setErrorMessage] = useState('');
  const setEmailVerified = useAuthStore(s => s.setEmailVerified);

  useEffect(() => {
    if (!token || !email) {
      setStatus('error');
      setErrorMessage('Invalid verification link. Please check your email and try again.');
      return;
    }

    let cancelled = false;

    authApi.verifyEmail(email, token)
      .then(() => {
        if (!cancelled) {
          setStatus('success');
          setEmailVerified(true);
        }
      })
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .catch((err: any) => {
        if (!cancelled) {
          setStatus('error');
          setErrorMessage(err.response?.data?.error || 'Verification failed. The link may have expired.');
        }
      });

    return () => { cancelled = true; };
  }, [token, email, setEmailVerified]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-brand-50 via-white to-blue-50 dark:from-gray-900 dark:via-gray-900 dark:to-gray-800 px-4">
      <div className="w-full max-w-md">
        <div className="bg-white/95 dark:bg-gray-800/95 rounded-2xl shadow-xl backdrop-blur-sm p-8 ring-1 ring-gray-200/50 dark:ring-gray-700/50">
          {status === 'loading' && (
            <div className="text-center space-y-4">
              <div className="inline-flex items-center justify-center w-12 h-12 bg-brand-100 dark:bg-brand-900/30 rounded-full animate-pulse">
                <svg className="w-6 h-6 text-brand-600 dark:text-brand-400 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
              </div>
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Verifying your email...</h2>
              <p className="text-sm text-gray-500 dark:text-gray-400">Please wait a moment.</p>
            </div>
          )}

          {status === 'success' && (
            <div className="text-center space-y-4">
              <div className="inline-flex items-center justify-center w-12 h-12 bg-green-100 dark:bg-green-900/30 rounded-full">
                <svg className="w-6 h-6 text-green-600 dark:text-green-400" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Email Verified!</h2>
              <p className="text-sm text-gray-600 dark:text-gray-300">
                Your email has been verified successfully. You can now enjoy the full QualCanvas experience.
              </p>
              <Link
                to="/canvas"
                className="inline-block w-full py-3 bg-brand-600 hover:bg-brand-700 text-white font-medium rounded-lg transition-colors text-center"
              >
                Go to Canvas
              </Link>
            </div>
          )}

          {status === 'error' && (
            <div className="text-center space-y-4">
              <div className="inline-flex items-center justify-center w-12 h-12 bg-red-100 dark:bg-red-900/30 rounded-full">
                <svg className="w-6 h-6 text-red-600 dark:text-red-400" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
                </svg>
              </div>
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Verification Failed</h2>
              <p className="text-sm text-gray-600 dark:text-gray-300">{errorMessage}</p>
              <div className="flex flex-col gap-2">
                <Link
                  to="/canvas"
                  className="inline-block w-full py-3 bg-brand-600 hover:bg-brand-700 text-white font-medium rounded-lg transition-colors text-center"
                >
                  Go to Canvas
                </Link>
                <Link
                  to="/login"
                  className="text-sm text-brand-600 dark:text-brand-400 hover:underline font-medium"
                >
                  Back to Sign In
                </Link>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
