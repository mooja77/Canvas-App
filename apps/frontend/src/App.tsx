import { lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { ErrorBoundary } from './components/ErrorBoundary';
import UpgradePrompt from './components/UpgradePrompt';
import OfflineBanner from './components/OfflineBanner';
import { PageSkeleton } from './components/LoadingSkeleton';
import ForgotPasswordPage from './pages/ForgotPasswordPage';
import ResetPasswordPage from './pages/ResetPasswordPage';
import VerifyEmailPage from './pages/VerifyEmailPage';
import NotFoundPage from './pages/NotFoundPage';
import LandingPage from './pages/LandingPage';
import LoginPage from './pages/LoginPage';
import PricingPage from './pages/PricingPage';
import TermsPage from './pages/TermsPage';
import PrivacyPage from './pages/PrivacyPage';
import TrustPage from './pages/TrustPage';
import CookiePolicyPage from './pages/CookiePolicyPage';
import GuidePage from './pages/GuidePage';
import CitePage from './pages/CitePage';
import ColophonPage from './pages/ColophonPage';
import AccessibilityStatementPage from './pages/AccessibilityStatementPage';
import PressPage from './pages/PressPage';
import TrustAIPage from './pages/TrustAIPage';
import ForTeamsPage from './pages/ForTeamsPage';
import ForInstitutionsPage from './pages/ForInstitutionsPage';
import MethodologyIndexPage from './pages/MethodologyIndexPage';
import CustomersIndexPage from './pages/CustomersIndexPage';
import ChangelogPage from './pages/ChangelogPage';
import VsIndexPage from './pages/VsIndexPage';
import { useAuthStore } from './stores/authStore';

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
          <Route path="/customers" element={<CustomersIndexPage />} />
          <Route path="/changelog" element={<ChangelogPage />} />
          <Route path="/vs" element={<VsIndexPage />} />
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
            path="/admin"
            element={
              <Suspense fallback={<PageSkeleton />}>
                <AdminPage />
              </Suspense>
            }
          />
          <Route path="*" element={<NotFoundPage />} />
        </Routes>
      </BrowserRouter>
    </ErrorBoundary>
  );
}
