import { useState, useEffect } from 'react';
import type { FormEvent, ReactNode } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { authApi } from '../services/api';
import { useAuthStore } from '../stores/authStore';
import { usePageMeta } from '../hooks/usePageMeta';

// Verification token + email arrive in the URL fragment (#token=...&email=...)
// rather than the query string. Fragments aren't sent in Referer headers or
// captured by server access logs / analytics, which keeps the email out of
// shared logs. We still fall back to query params for backwards compatibility
// with any pending pre-rollout emails.
function readAuthParams(searchParams: URLSearchParams): { token: string; email: string } {
  const hash = typeof window !== 'undefined' ? window.location.hash.replace(/^#/, '') : '';
  const fragmentParams = new URLSearchParams(hash);
  return {
    token: fragmentParams.get('token') || searchParams.get('token') || '',
    email: fragmentParams.get('email') || searchParams.get('email') || '',
  };
}

interface LinkDetails {
  email: string;
  signedUpAt: string;
  signupDevice: string | null;
  signedInHere: boolean;
  hasPassword: boolean;
}

type Step =
  | 'loading'
  | 'invalid'
  | 'ask'
  | 'password'
  | 'confirm-no'
  | 'confirm-reset'
  | 'verified'
  | 'secured'
  | 'reset_sent';

function formatWhen(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString(undefined, { dateStyle: 'long', timeStyle: 'short' });
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function apiError(err: any, fallback: string): { message: string; code?: string } {
  return { message: err?.response?.data?.error || fallback, code: err?.response?.data?.code };
}

const primaryBtn =
  'w-full py-3 bg-brand-600 hover:bg-brand-700 disabled:opacity-60 text-white font-medium rounded-lg transition-colors';
const secondaryBtn =
  'w-full py-3 bg-white dark:bg-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600 disabled:opacity-60 text-gray-900 dark:text-white font-medium rounded-lg ring-1 ring-gray-300 dark:ring-gray-600 transition-colors';

function ErrorLine({ message }: { message: string }) {
  if (!message) return null;
  return (
    <p role="alert" className="text-sm text-red-600 dark:text-red-400">
      {message}
    </p>
  );
}

/**
 * The page a verification email links to. Opening it changes nothing: it only
 * reads when and where the account was created. The account is verified,
 * secured or reset only when the person answers, by a POST from this page.
 * See apps/backend/src/routes/emailVerificationRoutes.ts for the design.
 */
export default function VerifyEmailPage() {
  usePageMeta('Confirm your email — QualCanvas', 'Confirm whether you created this QualCanvas account.');
  const [searchParams] = useSearchParams();
  const { token, email } = readAuthParams(searchParams);

  const [step, setStep] = useState<Step>('loading');
  const [details, setDetails] = useState<LinkDetails | null>(null);
  const [errorMessage, setErrorMessage] = useState('');
  const [formError, setFormError] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [signedIn, setSignedIn] = useState(false);
  const setEmailVerified = useAuthStore((s) => s.setEmailVerified);
  const setEmailAuth = useAuthStore((s) => s.setEmailAuth);

  useEffect(() => {
    if (!token || !email) {
      setStep('invalid');
      setErrorMessage('Invalid verification link. Please check your email and try again.');
      return;
    }
    let cancelled = false;
    authApi
      .verifyEmailDetails(email, token)
      .then((res) => {
        if (cancelled) return;
        setDetails(res.data.data as LinkDetails);
        setStep('ask');
      })
      .catch((err) => {
        if (cancelled) return;
        setStep('invalid');
        setErrorMessage(apiError(err, 'This link could not be checked. It may have expired.').message);
      });
    return () => {
      cancelled = true;
    };
  }, [token, email]);

  const goTo = (next: Step) => {
    setFormError('');
    setStep(next);
  };

  const submit = async (decision: 'yes' | 'no' | 'reset', withPassword?: string) => {
    setBusy(true);
    setFormError('');
    try {
      const res = await authApi.confirmEmailVerification(email, token, decision, withPassword);
      const data = res.data.data ?? {};
      if (data.outcome === 'verified') {
        if (data.user) {
          setEmailAuth({
            email: data.user.email,
            userId: data.user.id,
            name: data.user.name,
            role: data.user.role,
            plan: data.user.plan,
            emailVerified: true,
          });
        }
        if (data.signedIn) setEmailVerified(true);
        setSignedIn(Boolean(data.signedIn));
        setStep('verified');
      } else if (data.outcome === 'secured') {
        setStep('secured');
      } else {
        setStep('reset_sent');
      }
    } catch (err) {
      const hasResponse = Boolean((err as { response?: unknown })?.response);
      const { message, code } = apiError(err, 'Something went wrong. Your link still works; please try again.');
      if (code === 'PASSWORD_REQUIRED' || code === 'PASSWORD_INCORRECT') {
        setStep('password');
        setFormError(message);
      } else if (!hasResponse) {
        // Network failure: nothing was consumed, stay on this step.
        setFormError(message);
      } else {
        setStep('invalid');
        setErrorMessage(message);
      }
    } finally {
      setBusy(false);
    }
  };

  const onYes = () => {
    if (!details) return;
    // Signed in here as this account, or an account with no password to ask
    // for: the server decides; the password step is shown only when needed.
    if (details.signedInHere || !details.hasPassword) void submit('yes');
    else goTo('password');
  };

  const onPasswordSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!password) {
      setFormError('Enter the password chosen when this account was created.');
      return;
    }
    void submit('yes', password);
  };

  return (
    <main className="min-h-screen flex items-center justify-center bg-gradient-to-br from-brand-50 via-white to-blue-50 dark:from-gray-900 dark:via-gray-900 dark:to-gray-800 px-4 py-8">
      <div className="w-full max-w-md">
        <div className="bg-white/95 dark:bg-gray-800/95 rounded-2xl shadow-xl backdrop-blur-sm p-8 ring-1 ring-gray-200/50 dark:ring-gray-700/50">
          {step === 'loading' && (
            <div className="text-center space-y-4" role="status">
              <h1 className="text-lg font-semibold text-gray-900 dark:text-white">Checking your link…</h1>
              <p className="text-sm text-gray-500 dark:text-gray-400">Nothing about the account changes yet.</p>
            </div>
          )}

          {step === 'ask' && details && (
            <div className="space-y-5">
              <h1 className="text-xl font-semibold text-gray-900 dark:text-white">
                Did you create this QualCanvas account?
              </h1>
              <dl className="text-sm rounded-lg bg-gray-50 dark:bg-gray-900/40 p-4 space-y-2">
                <Detail label="Email">{details.email}</Detail>
                <Detail label="Created">{formatWhen(details.signedUpAt)}</Detail>
                {details.signupDevice && <Detail label="Created from">{details.signupDevice}</Detail>}
              </dl>
              <p className="text-sm text-gray-600 dark:text-gray-300">
                Someone signed up with your email address. Nothing has changed yet, and nothing will until you choose
                below.
              </p>
              <ErrorLine message={formError} />
              <div className="space-y-2">
                <button type="button" className={primaryBtn} disabled={busy} onClick={onYes}>
                  Yes, I created it
                </button>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  {details.signedInHere
                    ? 'You are signed in to this account in this browser, so we will verify your email straight away.'
                    : details.hasPassword
                      ? 'We will ask for the password you chose when you signed up, then verify your email.'
                      : 'We will verify your email and sign out every device, so you sign in again afterwards.'}
                </p>
              </div>
              <div className="space-y-2">
                <button type="button" className={secondaryBtn} disabled={busy} onClick={() => goTo('confirm-no')}>
                  No, this wasn&rsquo;t me
                </button>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  We will lock the account and remove whoever set it up. Nothing is signed up in your name.
                </p>
              </div>
            </div>
          )}

          {step === 'password' && (
            <form className="space-y-4" onSubmit={onPasswordSubmit} noValidate>
              <h1 className="text-xl font-semibold text-gray-900 dark:text-white">Enter your password</h1>
              <p className="text-sm text-gray-600 dark:text-gray-300">
                To make sure the person who chose the password and the owner of this inbox are the same person, enter
                the password you set when you signed up.
              </p>
              <div>
                <label htmlFor="verify-password" className="block text-sm font-medium text-gray-700 dark:text-gray-200">
                  Password
                </label>
                <input
                  id="verify-password"
                  type="password"
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 px-3 py-2 text-gray-900 dark:text-white"
                />
              </div>
              <ErrorLine message={formError} />
              <button type="submit" className={primaryBtn} disabled={busy}>
                Verify my email
              </button>
              <button type="button" className={secondaryBtn} disabled={busy} onClick={() => goTo('confirm-reset')}>
                I don&rsquo;t know this password
              </button>
              <button
                type="button"
                className="w-full text-sm text-brand-600 dark:text-brand-400 hover:underline"
                onClick={() => goTo('ask')}
              >
                Back
              </button>
            </form>
          )}

          {step === 'confirm-reset' && (
            <div className="space-y-4">
              <h1 className="text-xl font-semibold text-gray-900 dark:text-white">Secure the account and reset</h1>
              <p className="text-sm text-gray-600 dark:text-gray-300">If you continue, we will:</p>
              <ul className="list-disc pl-5 text-sm text-gray-600 dark:text-gray-300 space-y-1">
                <li>sign out every device that is signed in to this account;</li>
                <li>remove the current password, collaborators, share links, team members and any saved AI key;</li>
                <li>email a link to this inbox so you can choose a new password.</li>
              </ul>
              <p className="text-sm text-gray-600 dark:text-gray-300">
                The canvases in the account are kept. If you shared them, you will need to invite people again.
              </p>
              <ErrorLine message={formError} />
              <button type="button" className={primaryBtn} disabled={busy} onClick={() => void submit('reset')}>
                Secure the account and email me a reset link
              </button>
              <button type="button" className={secondaryBtn} disabled={busy} onClick={() => goTo('password')}>
                Back
              </button>
            </div>
          )}

          {step === 'confirm-no' && (
            <div className="space-y-4">
              <h1 className="text-xl font-semibold text-gray-900 dark:text-white">Lock this account?</h1>
              <p className="text-sm text-gray-600 dark:text-gray-300">If you continue, we will:</p>
              <ul className="list-disc pl-5 text-sm text-gray-600 dark:text-gray-300 space-y-1">
                <li>sign out whoever created the account, on every device;</li>
                <li>remove the password they chose, so it no longer works;</li>
                <li>remove anyone they invited, any share links and any AI key they added;</li>
                <li>stop all optional emails to this address.</li>
              </ul>
              <p className="text-sm text-gray-600 dark:text-gray-300">
                You don&rsquo;t need to do anything else. If you ever want to use QualCanvas with this address, sign in
                with Google or use &ldquo;Forgot password&rdquo;.
              </p>
              <ErrorLine message={formError} />
              <button type="button" className={primaryBtn} disabled={busy} onClick={() => void submit('no')}>
                Lock the account
              </button>
              <button type="button" className={secondaryBtn} disabled={busy} onClick={() => goTo('ask')}>
                Back
              </button>
            </div>
          )}

          {step === 'verified' && (
            <div className="text-center space-y-4">
              <h1 className="text-lg font-semibold text-gray-900 dark:text-white">Email verified</h1>
              <p className="text-sm text-gray-600 dark:text-gray-300">
                {signedIn
                  ? 'Thanks for confirming. You can now enjoy the full QualCanvas experience.'
                  : 'Thanks for confirming. For your security every device was signed out; sign in to continue.'}
              </p>
              <Link
                to={signedIn ? '/canvas' : '/login'}
                className="inline-block w-full py-3 bg-brand-600 hover:bg-brand-700 text-white font-medium rounded-lg transition-colors text-center"
              >
                {signedIn ? 'Go to Canvas' : 'Sign in'}
              </Link>
            </div>
          )}

          {step === 'secured' && (
            <div className="text-center space-y-4">
              <h1 className="text-lg font-semibold text-gray-900 dark:text-white">Account locked</h1>
              <p className="text-sm text-gray-600 dark:text-gray-300">
                Thanks for telling us. Whoever set up this account has been signed out and can no longer get in. There
                is nothing else you need to do.
              </p>
              <p className="text-sm text-gray-600 dark:text-gray-300">
                If you would like to use QualCanvas with this address, sign in with Google or use &ldquo;Forgot
                password&rdquo;.
              </p>
              <Link to="/login" className="text-sm text-brand-600 dark:text-brand-400 hover:underline font-medium">
                Go to sign in
              </Link>
            </div>
          )}

          {step === 'reset_sent' && (
            <div className="text-center space-y-4">
              <h1 className="text-lg font-semibold text-gray-900 dark:text-white">Check your inbox</h1>
              <p className="text-sm text-gray-600 dark:text-gray-300">
                The account is secured and every device was signed out. We have emailed a link to choose a new password;
                it works for one hour.
              </p>
              <Link to="/login" className="text-sm text-brand-600 dark:text-brand-400 hover:underline font-medium">
                Back to sign in
              </Link>
            </div>
          )}

          {step === 'invalid' && (
            <div className="text-center space-y-4">
              <h1 className="text-lg font-semibold text-gray-900 dark:text-white">This link can&rsquo;t be used</h1>
              <p role="alert" className="text-sm text-gray-600 dark:text-gray-300">
                {errorMessage}
              </p>
              <div className="flex flex-col gap-2">
                <Link
                  to="/canvas"
                  className="inline-block w-full py-3 bg-brand-600 hover:bg-brand-700 text-white font-medium rounded-lg transition-colors text-center"
                >
                  Go to Canvas
                </Link>
                <Link to="/login" className="text-sm text-brand-600 dark:text-brand-400 hover:underline font-medium">
                  Back to Sign In
                </Link>
              </div>
            </div>
          )}
        </div>
      </div>
    </main>
  );
}

function Detail({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex justify-between gap-4">
      <dt className="text-gray-500 dark:text-gray-400">{label}</dt>
      <dd className="text-gray-900 dark:text-white text-right break-all">{children}</dd>
    </div>
  );
}
