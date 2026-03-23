import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import VerifyEmailPage from './VerifyEmailPage';

// Mock react-router-dom
const mockSearchParams = new URLSearchParams();
vi.mock('react-router-dom', () => ({
  useSearchParams: () => [mockSearchParams],
  Link: ({ to, children, ...props }: { to: string; children: React.ReactNode;[key: string]: unknown }) => (
    <a href={to} {...props}>{children}</a>
  ),
}));

// Mock the authApi
const mockVerifyEmail = vi.fn();
vi.mock('../services/api', () => ({
  authApi: {
    verifyEmail: (...args: unknown[]) => mockVerifyEmail(...args),
  },
}));

// Mock the auth store
const mockSetEmailVerified = vi.fn();
vi.mock('../stores/authStore', () => ({
  useAuthStore: (selector: (s: Record<string, unknown>) => unknown) =>
    selector({ setEmailVerified: mockSetEmailVerified }),
}));

describe('VerifyEmailPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Reset search params
    mockSearchParams.delete('token');
    mockSearchParams.delete('email');
  });

  it('renders loading state initially when token and email are present', () => {
    mockSearchParams.set('token', 'abc123');
    mockSearchParams.set('email', 'user@example.com');
    mockVerifyEmail.mockReturnValue(new Promise(() => {})); // never resolves

    render(<VerifyEmailPage />);

    expect(screen.getByText('Verifying your email...')).toBeInTheDocument();
    expect(screen.getByText('Please wait a moment.')).toBeInTheDocument();
  });

  it('shows success message on successful verification', async () => {
    mockSearchParams.set('token', 'valid-token');
    mockSearchParams.set('email', 'user@example.com');
    mockVerifyEmail.mockResolvedValue({ data: { success: true } });

    render(<VerifyEmailPage />);

    await waitFor(() => {
      expect(screen.getByText('Email Verified!')).toBeInTheDocument();
    });

    expect(screen.getByText(/Your email has been verified successfully/)).toBeInTheDocument();
    expect(screen.getByText('Go to Canvas')).toBeInTheDocument();
    expect(mockSetEmailVerified).toHaveBeenCalledWith(true);
    expect(mockVerifyEmail).toHaveBeenCalledWith('user@example.com', 'valid-token');
  });

  it('shows error message on failed verification', async () => {
    mockSearchParams.set('token', 'expired-token');
    mockSearchParams.set('email', 'user@example.com');
    mockVerifyEmail.mockRejectedValue({
      response: { data: { error: 'Token has expired' } },
    });

    render(<VerifyEmailPage />);

    await waitFor(() => {
      expect(screen.getByText('Verification Failed')).toBeInTheDocument();
    });

    expect(screen.getByText('Token has expired')).toBeInTheDocument();
    expect(screen.getByText('Back to Sign In')).toBeInTheDocument();
  });

  it('shows error for missing token/email params', async () => {
    // No token or email set in search params
    render(<VerifyEmailPage />);

    await waitFor(() => {
      expect(screen.getByText('Verification Failed')).toBeInTheDocument();
    });

    expect(
      screen.getByText('Invalid verification link. Please check your email and try again.')
    ).toBeInTheDocument();
    expect(mockVerifyEmail).not.toHaveBeenCalled();
  });

  it('handles network error gracefully', async () => {
    mockSearchParams.set('token', 'some-token');
    mockSearchParams.set('email', 'user@example.com');
    mockVerifyEmail.mockRejectedValue(new Error('Network Error'));

    render(<VerifyEmailPage />);

    await waitFor(() => {
      expect(screen.getByText('Verification Failed')).toBeInTheDocument();
    });

    // Falls back to default message when response.data.error is not available
    expect(
      screen.getByText('Verification failed. The link may have expired.')
    ).toBeInTheDocument();
  });
});
