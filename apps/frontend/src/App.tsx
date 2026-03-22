import { lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { ErrorBoundary } from './components/ErrorBoundary';
import UpgradePrompt from './components/UpgradePrompt';
import OfflineBanner from './components/OfflineBanner';
import { PageSkeleton } from './components/LoadingSkeleton';
import ForgotPasswordPage from './pages/ForgotPasswordPage';
import ResetPasswordPage from './pages/ResetPasswordPage';
import NotFoundPage from './pages/NotFoundPage';
import LandingPage from './pages/LandingPage';
import LoginPage from './pages/LoginPage';
import PricingPage from './pages/PricingPage';
import TermsPage from './pages/TermsPage';
import PrivacyPage from './pages/PrivacyPage';
import { useAuthStore } from './stores/authStore';

const CanvasPage = lazy(() => import('./pages/CanvasPage'));
const AccountPage = lazy(() => import('./pages/AccountPage'));
const RepositoryPage = lazy(() => import('./pages/RepositoryPage'));

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const authenticated = useAuthStore(s => s.authenticated);
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
        <Route path="/forgot-password" element={<ForgotPasswordPage />} />
        <Route path="/reset-password" element={<ResetPasswordPage />} />
        <Route path="/terms" element={<TermsPage />} />
        <Route path="/privacy" element={<PrivacyPage />} />
        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </BrowserRouter>
    </ErrorBoundary>
  );
}
