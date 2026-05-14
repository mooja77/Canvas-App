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
