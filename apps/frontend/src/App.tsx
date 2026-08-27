import { Suspense } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { ErrorBoundary } from './components/ErrorBoundary';
import UpgradePrompt from './components/UpgradePrompt';
import OfflineBanner from './components/OfflineBanner';
import { PageSkeleton } from './components/LoadingSkeleton';
import RouteErrorFallback from './components/RouteErrorFallback';
import { useAuthStore } from './stores/authStore';
import { lazyRoute } from './utils/lazyRoute';

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

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const authenticated = useAuthStore((s) => s.authenticated);
  if (!authenticated) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

export default function App() {
  return (
    <ErrorBoundary>
      <BrowserRouter>
        <OfflineBanner />
        <UpgradePrompt />
        {/* Route failures are caught here rather than by the outer boundary so
            the app chrome survives them. The outer one replaced the whole tree
            - including OfflineBanner - which meant a chunk that failed while
            offline destroyed the one element explaining why. */}
        <ErrorBoundary fallback={<RouteErrorFallback />}>
          <Suspense fallback={<PageSkeleton />}>
            <Routes>
              <Route path="/" element={<LandingPage />} />
              <Route path="/login" element={<LoginPage />} />
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
              <Route
                path="/account"
                element={
                  <ProtectedRoute>
                    <Suspense fallback={<PageSkeleton />}>
                      <AccountPage />
                    </Suspense>
                  </ProtectedRoute>
                }
              />
              <Route
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
                path="/team"
                element={
                  <ProtectedRoute>
                    <Suspense fallback={<PageSkeleton />}>
                      <TeamPage />
                    </Suspense>
                  </ProtectedRoute>
                }
              />
              <Route path="/forgot-password" element={<ForgotPasswordPage />} />
              <Route path="/reset-password" element={<ResetPasswordPage />} />
              <Route path="/verify-email" element={<VerifyEmailPage />} />
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
              <Route
                path="/admin"
                element={
                  <Suspense fallback={<PageSkeleton />}>
                    <AdminPage />
                  </Suspense>
                }
              />
              <Route path="*" element={<NotFoundPage />} />
            </Routes>
          </Suspense>
        </ErrorBoundary>
      </BrowserRouter>
    </ErrorBoundary>
  );
}
