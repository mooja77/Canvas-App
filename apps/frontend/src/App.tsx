import { Suspense, useEffect, type ReactNode } from 'react';
import { BrowserRouter, Routes, Route, Navigate, Outlet, useLocation } from 'react-router-dom';
import { ErrorBoundary } from './components/ErrorBoundary';
import ConnectAiWizardHost from './components/ai/ConnectAiWizardHost';
import UpgradePrompt from './components/UpgradePrompt';
import OfflineBanner from './components/OfflineBanner';
import { PageSkeleton } from './components/LoadingSkeleton';
import RouteErrorFallback from './components/RouteErrorFallback';
import { useAuthStore } from './stores/authStore';
import { lazyRoute } from './utils/lazyRoute';
import { currentShell, shellForRoute, shellMismatchTarget } from './utils/appShell';

const ForgotPasswordPage = lazyRoute(() => import('./pages/ForgotPasswordPage'));
const ResetPasswordPage = lazyRoute(() => import('./pages/ResetPasswordPage'));
const VerifyEmailPage = lazyRoute(() => import('./pages/VerifyEmailPage'));
const NotFoundPage = lazyRoute(() => import('./pages/NotFoundPage'));
const LandingPage = lazyRoute(() => import('./pages/LandingPage'));
const LoginPage = lazyRoute(() => import('./pages/LoginPage'));
const PricingPage = lazyRoute(() => import('./pages/PricingPage'));
const TermsPage = lazyRoute(() => import('./pages/TermsPage'));
const PrivacyPage = lazyRoute(() => import('./pages/PrivacyPage'));
const TrustPage = lazyRoute(() => import('./pages/TrustPage'));
const CookiePolicyPage = lazyRoute(() => import('./pages/CookiePolicyPage'));
const GuidePage = lazyRoute(() => import('./pages/GuidePage'));
const CitePage = lazyRoute(() => import('./pages/CitePage'));
const ColophonPage = lazyRoute(() => import('./pages/ColophonPage'));
const AccessibilityStatementPage = lazyRoute(() => import('./pages/AccessibilityStatementPage'));
const PressPage = lazyRoute(() => import('./pages/PressPage'));
const TrustAIPage = lazyRoute(() => import('./pages/TrustAIPage'));
const ForTeamsPage = lazyRoute(() => import('./pages/ForTeamsPage'));
const ForInstitutionsPage = lazyRoute(() => import('./pages/ForInstitutionsPage'));
const MethodologyIndexPage = lazyRoute(() => import('./pages/MethodologyIndexPage'));
const CustomersIndexPage = lazyRoute(() => import('./pages/CustomersIndexPage'));
const ChangelogPage = lazyRoute(() => import('./pages/ChangelogPage'));
const VsIndexPage = lazyRoute(() => import('./pages/VsIndexPage'));
const VsCompetitorRedirect = lazyRoute(() => import('./pages/VsCompetitorRedirect'));
const SubscribePage = lazyRoute(() => import('./pages/SubscribePage'));
const PilotPage = lazyRoute(() => import('./pages/PilotPage'));
const MethodologyChapterPage = lazyRoute(() => import('./pages/MethodologyChapterPage'));
const TrainingPage = lazyRoute(() =>
  import('./pages/TrainingPage').then((module) => ({ default: module.TrainingPage })),
);
const CanvasPage = lazyRoute(() => import('./pages/CanvasPage'));
const AccountPage = lazyRoute(() => import('./pages/AccountPage'));
const RepositoryPage = lazyRoute(() => import('./pages/RepositoryPage'));
const TeamPage = lazyRoute(() => import('./pages/TeamPage'));
const AdminPage = lazyRoute(() => import('./pages/AdminPage'));
const SupportPage = lazyRoute(() => import('./pages/SupportPage'));

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const authenticated = useAuthStore((s) => s.authenticated);
  if (!authenticated) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

function CanonicalShellRoutes({ shell }: { shell: 'app' | 'support' }) {
  const { pathname } = useLocation();
  // React Router decodes segments before matching even a case-sensitive
  // route. Reject aliases the Worker did not assign to this shell before
  // mounting any private page.
  return shellForRoute(pathname) === shell ? <Outlet /> : <NotFoundPage />;
}

/**
 * A route must not mount in a document with a different set of scripts.
 * Even if automatic navigation is throttled, keep the route unmounted.
 */
function ShellGuard({ children }: { children: ReactNode }) {
  const { pathname, search, hash } = useLocation();
  const mismatch = shellForRoute(pathname) !== currentShell();
  // Setting URL components explicitly keeps even a path beginning with // on
  // this origin.
  const destination = new URL(window.location.origin);
  destination.pathname = pathname;
  destination.search = search;
  destination.hash = hash;
  const href = destination.href;

  useEffect(() => {
    if (!mismatch) return;
    const controller = new AbortController();
    void shellMismatchTarget(pathname, search, hash, undefined, undefined, undefined, controller.signal).then(
      (target) => {
        if (!target || controller.signal.aborted) return;
        // BrowserRouter normally set this URL already. Replacing it with the
        // same fragment URL is not guaranteed to leave the current document.
        if (window.location.href === href) window.location.reload();
        else window.location.replace(href);
      },
    );
    return () => controller.abort();
  }, [mismatch, pathname, search, hash, href]);

  if (!mismatch) return children;
  return (
    <main className="mx-auto max-w-md p-6">
      <p role="status">Opening this page safely. If it doesn't open, reload it.</p>
      <button type="button" onClick={() => window.location.reload()} className="text-brand-700 underline">
        Reload this page
      </button>
    </main>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <BrowserRouter>
        <ShellGuard>
          <OfflineBanner />
          <UpgradePrompt />
          <ConnectAiWizardHost />
          {/* Route failures are caught here rather than by the outer boundary so
            the app chrome survives them. The outer one replaced the whole tree
            - including OfflineBanner - which meant a chunk that failed while
            offline destroyed the one element explaining why. */}
          <ErrorBoundary fallback={<RouteErrorFallback />}>
            <Suspense fallback={<PageSkeleton />}>
              <Routes>
                <Route path="/" element={<LandingPage />} />
                <Route path="/login" element={<LoginPage />} />
                {/* Never a route, but four static pages linked to it and the 404 is what a
                  "Try free" click got. public/_redirects catches it at the edge; this
                  catches in-app navigation and any host that is not Cloudflare. */}
                <Route path="/register" element={<Navigate to="/login?mode=register" replace />} />
                <Route path="/pricing" element={<PricingPage />} />
                <Route path="/cite" element={<CitePage />} />
                <Route path="/colophon" element={<ColophonPage />} />
                <Route path="/accessibility-statement" element={<AccessibilityStatementPage />} />
                <Route path="/press" element={<PressPage />} />
                <Route path="/trust/ai" element={<TrustAIPage />} />
                <Route path="/for-teams" element={<ForTeamsPage />} />
                <Route path="/for-institutions" element={<ForInstitutionsPage />} />
                <Route path="/methodology" element={<MethodologyIndexPage />} />
                <Route
                  path="/methodology/:slug"
                  element={
                    <Suspense fallback={<PageSkeleton />}>
                      <MethodologyChapterPage />
                    </Suspense>
                  }
                />
                <Route path="/customers" element={<CustomersIndexPage />} />
                <Route path="/changelog" element={<ChangelogPage />} />
                <Route path="/vs" element={<VsIndexPage />} />
                {/* Per-competitor pages aren't published yet — redirect to the /vs index so these URLs don't 404. */}
                <Route path="/vs/:competitor" element={<VsCompetitorRedirect />} />
                <Route path="/subscribe" element={<SubscribePage />} />
                <Route path="/pilot" element={<PilotPage />} />
                <Route element={<CanonicalShellRoutes shell="support" />}>
                  <Route
                    caseSensitive
                    path="/account"
                    element={
                      <ProtectedRoute>
                        <Suspense fallback={<PageSkeleton />}>
                          <AccountPage />
                        </Suspense>
                      </ProtectedRoute>
                    }
                  />
                  <Route caseSensitive path="/support" element={<SupportPage />} />
                </Route>
                <Route element={<CanonicalShellRoutes shell="app" />}>
                  <Route
                    caseSensitive
                    path="/canvas/:canvasId?"
                    element={
                      <ProtectedRoute>
                        <Suspense fallback={<PageSkeleton />}>
                          <CanvasPage />
                        </Suspense>
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    caseSensitive
                    path="/repository"
                    element={
                      <ProtectedRoute>
                        <Suspense fallback={<PageSkeleton />}>
                          <RepositoryPage />
                        </Suspense>
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    caseSensitive
                    path="/team"
                    element={
                      <ProtectedRoute>
                        <Suspense fallback={<PageSkeleton />}>
                          <TeamPage />
                        </Suspense>
                      </ProtectedRoute>
                    }
                  />
                  <Route caseSensitive path="/forgot-password" element={<ForgotPasswordPage />} />
                  <Route caseSensitive path="/reset-password" element={<ResetPasswordPage />} />
                  <Route caseSensitive path="/verify-email" element={<VerifyEmailPage />} />
                  <Route
                    caseSensitive
                    path="/admin"
                    element={
                      <Suspense fallback={<PageSkeleton />}>
                        <AdminPage />
                      </Suspense>
                    }
                  />
                </Route>
                <Route path="/terms" element={<TermsPage />} />
                <Route path="/privacy" element={<PrivacyPage />} />
                <Route path="/trust" element={<TrustPage />} />
                <Route path="/cookies" element={<CookiePolicyPage />} />
                <Route path="/guide" element={<GuidePage />} />
                <Route
                  path="/training"
                  element={
                    <Suspense fallback={<PageSkeleton />}>
                      <TrainingPage />
                    </Suspense>
                  }
                />
                <Route path="*" element={<NotFoundPage />} />
              </Routes>
            </Suspense>
          </ErrorBoundary>
        </ShellGuard>
      </BrowserRouter>
    </ErrorBoundary>
  );
}
