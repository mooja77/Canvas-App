import { lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { ErrorBoundary } from './components/ErrorBoundary';
import UpgradePrompt from './components/UpgradePrompt';
import OfflineBanner from './components/OfflineBanner';
import { PageSkeleton } from './components/LoadingSkeleton';
import { useAuthStore } from './stores/authStore';

const ForgotPasswordPage = lazy(() => import('./pages/ForgotPasswordPage'));
const ResetPasswordPage = lazy(() => import('./pages/ResetPasswordPage'));
const VerifyEmailPage = lazy(() => import('./pages/VerifyEmailPage'));
const NotFoundPage = lazy(() => import('./pages/NotFoundPage'));
const LandingPage = lazy(() => import('./pages/LandingPage'));
const LoginPage = lazy(() => import('./pages/LoginPage'));
const PricingPage = lazy(() => import('./pages/PricingPage'));
const TermsPage = lazy(() => import('./pages/TermsPage'));
const PrivacyPage = lazy(() => import('./pages/PrivacyPage'));
const TrustPage = lazy(() => import('./pages/TrustPage'));
const CookiePolicyPage = lazy(() => import('./pages/CookiePolicyPage'));
const GuidePage = lazy(() => import('./pages/GuidePage'));
const CitePage = lazy(() => import('./pages/CitePage'));
const ColophonPage = lazy(() => import('./pages/ColophonPage'));
const AccessibilityStatementPage = lazy(() => import('./pages/AccessibilityStatementPage'));
const PressPage = lazy(() => import('./pages/PressPage'));
const TrustAIPage = lazy(() => import('./pages/TrustAIPage'));
const ForTeamsPage = lazy(() => import('./pages/ForTeamsPage'));
const ForInstitutionsPage = lazy(() => import('./pages/ForInstitutionsPage'));
const MethodologyIndexPage = lazy(() => import('./pages/MethodologyIndexPage'));
const CustomersIndexPage = lazy(() => import('./pages/CustomersIndexPage'));
const ChangelogPage = lazy(() => import('./pages/ChangelogPage'));
const VsIndexPage = lazy(() => import('./pages/VsIndexPage'));
const VsCompetitorRedirect = lazy(() => import('./pages/VsCompetitorRedirect'));
const SubscribePage = lazy(() => import('./pages/SubscribePage'));
const MethodologyChapterPage = lazy(() => import('./pages/MethodologyChapterPage'));
const TrainingPage = lazy(() => import('./pages/TrainingPage').then((module) => ({ default: module.TrainingPage })));
const CanvasPage = lazy(() => import('./pages/CanvasPage'));
const AccountPage = lazy(() => import('./pages/AccountPage'));
const RepositoryPage = lazy(() => import('./pages/RepositoryPage'));
const TeamPage = lazy(() => import('./pages/TeamPage'));
const AdminPage = lazy(() => import('./pages/AdminPage'));

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
      </BrowserRouter>
    </ErrorBoundary>
  );
}
