import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

// Mock react-router-dom
const mockNavigate = vi.fn();
const mockSearchParams = new URLSearchParams();
const authStoreMocks = vi.hoisted(() => ({ setAuth: vi.fn(), setEmailAuth: vi.fn() }));
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
  useAuthStore: (selector: (s: Record<string, unknown>) => unknown) => selector(authStoreMocks),
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
    mockSearchParams.delete('mode');
  });

  it('renders email and password fields marked as required', () => {
    render(<LoginPage />);
    // Labels include a visible "*" marker for sighted users; match by prefix.
    const emailInput = screen.getByLabelText(/^Email/);
    const passwordInput = screen.getByLabelText(/^Password/);
    expect(emailInput).toBeInTheDocument();
    expect(passwordInput).toBeInTheDocument();
    // HTML5 required attribute drives the screen-reader announcement and the
    // browser's native empty-field tooltip on submit.
    expect(emailInput).toBeRequired();
    expect(passwordInput).toBeRequired();
  });

  it('Sign In button is enabled even when fields empty (browser validation handles empty submit)', () => {
    // We deliberately removed the disabled-button-without-hint anti-pattern;
    // clicking with empty fields now triggers the browser's required-field
    // UX instead of silently doing nothing.
    render(<LoginPage />);
    const submitBtn = screen.getByRole('button', { name: 'Sign In' });
    expect(submitBtn).not.toBeDisabled();
  });

  it('Sign In button still enabled when fields filled', () => {
    render(<LoginPage />);
    fireEvent.change(screen.getByLabelText(/^Email/), { target: { value: 'test@example.com' } });
    fireEvent.change(screen.getByLabelText(/^Password/), { target: { value: 'password123' } });

    const submitBtn = screen.getByRole('button', { name: 'Sign In' });
    expect(submitBtn).not.toBeDisabled();
  });

  it('shows Sign Up tab', () => {
    render(<LoginPage />);
    const signUpTab = screen.getByRole('tab', { name: 'Sign Up' });
    expect(signUpTab).toBeInTheDocument();
  });

  it('supports the standard arrow, Home, and End keys across authentication tabs', () => {
    render(<LoginPage />);
    const signInTab = screen.getByRole('tab', { name: 'Sign In' });
    const signUpTab = screen.getByRole('tab', { name: 'Sign Up' });

    signInTab.focus();
    fireEvent.keyDown(signInTab, { key: 'ArrowRight' });
    expect(signUpTab).toHaveAttribute('aria-selected', 'true');
    expect(signUpTab).toHaveFocus();

    fireEvent.keyDown(signUpTab, { key: 'Home' });
    expect(signInTab).toHaveAttribute('aria-selected', 'true');
    expect(signInTab).toHaveFocus();

    fireEvent.keyDown(signInTab, { key: 'End' });
    expect(signUpTab).toHaveAttribute('aria-selected', 'true');

    fireEvent.keyDown(signUpTab, { key: 'ArrowLeft' });
    expect(signInTab).toHaveAttribute('aria-selected', 'true');
  });

  it('keeps the password visibility control keyboard reachable with a usable target', () => {
    render(<LoginPage />);
    const toggle = screen.getByRole('button', { name: 'Show password' });
    expect(toggle).toHaveProperty('tabIndex', 0);
    expect(toggle).toHaveClass('h-10', 'w-10');
  });

  it('Sign Up tab shows name field marked as required', () => {
    render(<LoginPage />);
    // Click Sign Up tab
    fireEvent.click(screen.getByRole('tab', { name: 'Sign Up' }));
    const nameInput = screen.getByLabelText(/^Your Name/);
    expect(nameInput).toBeInTheDocument();
    expect(nameInput).toBeRequired();
  });

  it('access code section expandable', () => {
    render(<LoginPage />);
    // Access code input should not be visible initially
    expect(screen.queryByPlaceholderText('Enter your access code')).not.toBeInTheDocument();

    // Click to expand
    fireEvent.click(screen.getByText('Sign In with Code'));
    expect(screen.getByPlaceholderText('Enter your access code')).toBeInTheDocument();
  });

  it('does not retain the reusable access code after a successful exchange', async () => {
    (authApi.login as ReturnType<typeof vi.fn>).mockResolvedValue({
      data: {
        data: { jwt: undefined, name: 'Workshop User', role: 'user', dashboardAccessId: 'access-1' },
      },
    });

    render(<LoginPage />);
    fireEvent.click(screen.getByText('Sign In with Code'));
    const input = screen.getByLabelText(/^Access code/);
    fireEvent.change(input, { target: { value: 'SECRET-CODE' } });
    fireEvent.submit(input.closest('form')!);

    await waitFor(() => expect(authStoreMocks.setAuth).toHaveBeenCalledTimes(1));
    expect(authStoreMocks.setAuth).toHaveBeenCalledWith({
      jwt: undefined,
      name: 'Workshop User',
      role: 'user',
      dashboardAccessId: 'access-1',
    });
    expect(authStoreMocks.setAuth.mock.calls[0][0]).not.toHaveProperty('dashboardCode');
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
    fireEvent.change(screen.getByLabelText(/^Password/), { target: { value: 'Str0ng!Pass' } });

    // Should show a strength label
    expect(screen.getByText(/Weak|Fair|Good|Strong/)).toBeInTheDocument();
  });

  it('shows error toast on failed login', async () => {
    (authApi.emailLogin as ReturnType<typeof vi.fn>).mockRejectedValue({
      response: { data: { error: "That email and password don't match. Try again, or reset your password." } },
    });

    render(<LoginPage />);
    fireEvent.change(screen.getByLabelText(/^Email/), { target: { value: 'bad@example.com' } });
    fireEvent.change(screen.getByLabelText(/^Password/), { target: { value: 'wrongpass' } });
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
    fireEvent.change(screen.getByLabelText(/^Email/), { target: { value: 'a@b.com' } });
    fireEvent.change(screen.getByLabelText(/^Password/), { target: { value: 'password123' } });
    fireEvent.submit(screen.getByRole('button', { name: 'Sign In' }));

    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith('/canvas');
    });
  });
});
