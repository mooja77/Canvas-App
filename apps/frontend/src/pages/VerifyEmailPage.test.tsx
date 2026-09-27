import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import VerifyEmailPage from './VerifyEmailPage';

const mockSearchParams = new URLSearchParams();
vi.mock('react-router-dom', () => ({
  useSearchParams: () => [mockSearchParams],
  Link: ({ to, children, ...props }: { to: string; children: React.ReactNode; [key: string]: unknown }) => (
    <a href={to} {...props}>
      {children}
    </a>
  ),
}));

const mockDetails = vi.fn();
const mockConfirm = vi.fn();
vi.mock('../services/api', () => ({
  authApi: {
    verifyEmailDetails: (...args: unknown[]) => mockDetails(...args),
    confirmEmailVerification: (...args: unknown[]) => mockConfirm(...args),
  },
}));

const mockSetEmailVerified = vi.fn();
const mockSetEmailAuth = vi.fn();
vi.mock('../stores/authStore', () => ({
  useAuthStore: (selector: (s: Record<string, unknown>) => unknown) =>
    selector({ setEmailVerified: mockSetEmailVerified, setEmailAuth: mockSetEmailAuth }),
}));

const details = (overrides: Record<string, unknown> = {}) => ({
  data: {
    data: {
      email: 'user@example.com',
      signedUpAt: '2026-09-27T09:15:00.000Z',
      signupDevice: 'Firefox on Linux',
      signedInHere: false,
      hasPassword: true,
      ...overrides,
    },
  },
});

describe('VerifyEmailPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSearchParams.delete('token');
    mockSearchParams.delete('email');
    mockSearchParams.set('token', 'link-token');
    mockSearchParams.set('email', 'user@example.com');
  });

  it('opening the link only reads the details: it never sends a decision', async () => {
    mockDetails.mockResolvedValue(details());
    render(<VerifyEmailPage />);

    expect(await screen.findByText('Did you create this QualCanvas account?')).toBeInTheDocument();
    expect(mockDetails).toHaveBeenCalledWith('user@example.com', 'link-token');
    expect(screen.getByText('Firefox on Linux')).toBeInTheDocument();
    expect(screen.getByText('user@example.com')).toBeInTheDocument();
    expect(mockConfirm).not.toHaveBeenCalled();
    expect(mockSetEmailVerified).not.toHaveBeenCalled();
  });

  it('Yes, signed in here: verifies in one step', async () => {
    mockDetails.mockResolvedValue(details({ signedInHere: true }));
    mockConfirm.mockResolvedValue({ data: { data: { outcome: 'verified', signedIn: true } } });
    render(<VerifyEmailPage />);
    fireEvent.click(await screen.findByRole('button', { name: 'Yes, I created it' }));

    expect(await screen.findByText('Email verified')).toBeInTheDocument();
    expect(mockConfirm).toHaveBeenCalledWith('user@example.com', 'link-token', 'yes', undefined);
    expect(mockSetEmailVerified).toHaveBeenCalledWith(true);
  });

  it('Yes, not signed in here: asks for the password before sending anything', async () => {
    mockDetails.mockResolvedValue(details());
    mockConfirm.mockResolvedValue({
      data: {
        data: {
          outcome: 'verified',
          signedIn: true,
          user: { id: 'u1', email: 'user@example.com', name: 'U', role: 'researcher', plan: 'free' },
        },
      },
    });
    render(<VerifyEmailPage />);
    fireEvent.click(await screen.findByRole('button', { name: 'Yes, I created it' }));

    expect(await screen.findByText('Enter your password')).toBeInTheDocument();
    expect(mockConfirm).not.toHaveBeenCalled();

    fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'typed-password' } });
    fireEvent.click(screen.getByRole('button', { name: 'Verify my email' }));
    await waitFor(() => expect(screen.getByText('Email verified')).toBeInTheDocument());
    expect(mockConfirm).toHaveBeenCalledWith('user@example.com', 'link-token', 'yes', 'typed-password');
    expect(mockSetEmailAuth).toHaveBeenCalledWith(expect.objectContaining({ userId: 'u1', emailVerified: true }));
  });

  it('a wrong password keeps the person on the password step with the reason', async () => {
    mockDetails.mockResolvedValue(details());
    mockConfirm.mockRejectedValue({
      response: { data: { code: 'PASSWORD_INCORRECT', error: 'That password is not correct.' } },
    });
    render(<VerifyEmailPage />);
    fireEvent.click(await screen.findByRole('button', { name: 'Yes, I created it' }));
    fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'wrong' } });
    fireEvent.click(screen.getByRole('button', { name: 'Verify my email' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('That password is not correct.');
    expect(screen.getByText('Enter your password')).toBeInTheDocument();
  });

  it('"I don\'t know this password" explains, then secures and emails a reset link', async () => {
    mockDetails.mockResolvedValue(details());
    mockConfirm.mockResolvedValue({ data: { data: { outcome: 'reset_sent' } } });
    render(<VerifyEmailPage />);
    fireEvent.click(await screen.findByRole('button', { name: 'Yes, I created it' }));
    fireEvent.click(screen.getByRole('button', { name: /don.t know this password/ }));

    expect(screen.getByText(/sign out every device/)).toBeInTheDocument();
    expect(mockConfirm).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Secure the account and email me a reset link' }));
    expect(await screen.findByText('Check your inbox')).toBeInTheDocument();
    expect(mockConfirm).toHaveBeenCalledWith('user@example.com', 'link-token', 'reset', undefined);
  });

  it('No: explains what will happen, and acts only on the second click', async () => {
    mockDetails.mockResolvedValue(details());
    mockConfirm.mockResolvedValue({ data: { data: { outcome: 'secured' } } });
    render(<VerifyEmailPage />);
    fireEvent.click(await screen.findByRole('button', { name: /No, this wasn/ }));

    expect(screen.getByText('Lock this account?')).toBeInTheDocument();
    expect(screen.getByText(/remove the password they chose/)).toBeInTheDocument();
    expect(mockConfirm).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Lock the account' }));
    expect(await screen.findByText('Account locked')).toBeInTheDocument();
    expect(mockConfirm).toHaveBeenCalledWith('user@example.com', 'link-token', 'no', undefined);
    expect(mockSetEmailVerified).not.toHaveBeenCalled();
  });

  it('an unusable link shows the server message and offers no choices', async () => {
    mockDetails.mockRejectedValue({ response: { data: { error: 'This link has already been used or has expired.' } } });
    render(<VerifyEmailPage />);
    expect(await screen.findByText('This link has already been used or has expired.')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Yes, I created it' })).not.toBeInTheDocument();
    expect(mockConfirm).not.toHaveBeenCalled();
  });

  it('missing token/email: error without calling the server', async () => {
    mockSearchParams.delete('token');
    mockSearchParams.delete('email');
    render(<VerifyEmailPage />);
    expect(
      await screen.findByText('Invalid verification link. Please check your email and try again.'),
    ).toBeInTheDocument();
    expect(mockDetails).not.toHaveBeenCalled();
    expect(mockConfirm).not.toHaveBeenCalled();
  });
});
