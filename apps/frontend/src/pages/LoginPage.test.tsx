import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

// Mock react-router-dom
const mockNavigate = vi.fn();
const mockSearchParams = new URLSearchParams();
vi.mock('react-router-dom', () => ({
  useNavigate: () => mockNavigate,
  useSearchParams: () => [mockSearchParams],
  Link: ({ to, children, ...props }: { to: string; children: React.ReactNode; [key: string]: unknown }) => (
    <a href={to} {...props}>
      {children}
    </a>
  ),
}));

// Mock i18next — return the key path as text for simplicity
vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => {
      const translations: Record<string, string> = {
        'auth.signIn': 'Sign In',
        'auth.signUp': 'Sign Up',
        'auth.email': 'Email',
        'auth.password': 'Password',
        'auth.forgotPassword': 'Forgot password?',
        'auth.signInWithCode': 'Sign In with Code',
        'auth.signingIn': 'Signing in...',
        'auth.creatingAccount': 'Creating account...',
        'auth.createFreeAccount': 'Create Free Account',
        'auth.yourName': 'Your Name',
      };
      return translations[key] || key;
    },
  }),
}));

// Mock authStore
vi.mock('../stores/authStore', () => ({
  useAuthStore: (selector: (s: Record<string, unknown>) => unknown) =>
    selector({ setAuth: vi.fn(), setEmailAuth: vi.fn() }),
}));

// Mock api
vi.mock('../services/api', () => ({
  authApi: {
    emailLogin: vi.fn(),
    emailSignup: vi.fn(),
    login: vi.fn(),
    googleLogin: vi.fn(),
  },
}));

// Mock react-hot-toast
vi.mock('react-hot-toast', () => ({
  default: { success: vi.fn(), error: vi.fn() },
}));

import { authApi } from '../services/api';
import toast from 'react-hot-toast';

import LoginPage from './LoginPage';

describe('LoginPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSearchParams.delete('expired');
  });

  it('renders email and password fields', () => {
    render(<LoginPage />);
    expect(screen.getByLabelText('Email')).toBeInTheDocument();
    expect(screen.getByLabelText('Password')).toBeInTheDocument();
  });

  it('Sign In button disabled when fields empty', () => {
    render(<LoginPage />);
    const submitBtn = screen.getByRole('button', { name: 'Sign In' });
    expect(submitBtn).toBeDisabled();
  });

  it('Sign In button enabled when fields filled', () => {
    render(<LoginPage />);
    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'test@example.com' } });
    fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'password123' } });

    const submitBtn = screen.getByRole('button', { name: 'Sign In' });
    expect(submitBtn).not.toBeDisabled();
  });

  it('shows Sign Up tab', () => {
    render(<LoginPage />);
    const signUpTab = screen.getByRole('tab', { name: 'Sign Up' });
    expect(signUpTab).toBeInTheDocument();
  });

  it('Sign Up tab shows name field', () => {
    render(<LoginPage />);
    // Click Sign Up tab
    fireEvent.click(screen.getByRole('tab', { name: 'Sign Up' }));
    expect(screen.getByLabelText('Your Name')).toBeInTheDocument();
  });

  it('access code section expandable', () => {
    render(<LoginPage />);
    // Access code input should not be visible initially
    expect(screen.queryByPlaceholderText('Enter your access code')).not.toBeInTheDocument();

    // Click to expand
    fireEvent.click(screen.getByText('Sign In with Code'));
    expect(screen.getByPlaceholderText('Enter your access code')).toBeInTheDocument();
  });

  it('Forgot password link present', () => {
    render(<LoginPage />);
    const link = screen.getByText('Forgot password?');
    expect(link).toBeInTheDocument();
    expect(link.closest('a')).toHaveAttribute('href', '/forgot-password');
  });

  it('shows password strength indicator on signup', () => {
    render(<LoginPage />);
    // Switch to Sign Up
    fireEvent.click(screen.getByRole('tab', { name: 'Sign Up' }));
    // Type a password
    fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'Str0ng!Pass' } });

    // Should show a strength label
    expect(screen.getByText(/Weak|Fair|Good|Strong/)).toBeInTheDocument();
  });

  it('shows error toast on failed login', async () => {
    (authApi.emailLogin as ReturnType<typeof vi.fn>).mockRejectedValue({
      response: { data: { error: "That email and password don't match. Try again, or reset your password." } },
    });

    render(<LoginPage />);
    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'bad@example.com' } });
    fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'wrongpass' } });
    fireEvent.submit(screen.getByRole('button', { name: 'Sign In' }));

    await waitFor(() => {
      expect((toast as unknown as { error: ReturnType<typeof vi.fn> }).error).toHaveBeenCalledWith(
        "That email and password don't match. Try again, or reset your password.",
      );
    });
  });

  it('navigates to /canvas on successful login', async () => {
    (authApi.emailLogin as ReturnType<typeof vi.fn>).mockResolvedValue({
      data: {
        data: {
          jwt: 'tok',
          user: { id: 'u1', email: 'a@b.com', name: 'Alice', role: 'user', plan: 'free', emailVerified: true },
        },
      },
    });

    render(<LoginPage />);
    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'a@b.com' } });
    fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'password123' } });
    fireEvent.submit(screen.getByRole('button', { name: 'Sign In' }));

    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith('/canvas');
    });
  });
});
