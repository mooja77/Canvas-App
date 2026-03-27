import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';

// Mock react-router-dom
const mockNavigate = vi.fn();
const mockSearchParams = new URLSearchParams();
const mockSetSearchParams = vi.fn();
vi.mock('react-router-dom', () => ({
  useNavigate: () => mockNavigate,
  useSearchParams: () => [mockSearchParams, mockSetSearchParams],
  Link: ({ to, children, ...props }: { to: string; children: React.ReactNode; [key: string]: unknown }) => (
    <a href={to} {...props}>{children}</a>
  ),
}));

// Mock i18next
vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => {
      const translations: Record<string, string> = {
        'account.title': 'Account',
        'account.profile': 'Profile',
        'account.planSection': 'Plan',
        'account.usageSection': 'Usage',
        'account.changePassword': 'Change Password',
        'account.dangerZone': 'Danger Zone',
        'account.saveChanges': 'Save Changes',
        'account.name': 'Name',
        'common.loading': 'Loading...',
      };
      return translations[key] || key;
    },
  }),
}));

// Mock authStore
vi.mock('../stores/authStore', () => ({
  useAuthStore: () => ({
    authenticated: true,
    logout: vi.fn(),
    authType: 'email',
  }),
}));

// Mock APIs
const mockGetMe = vi.fn();
const mockGetSettings = vi.fn();
vi.mock('../services/api', () => ({
  authApi: {
    getMe: (...args: unknown[]) => mockGetMe(...args),
    updateProfile: vi.fn(),
    changePassword: vi.fn(),
    deleteAccount: vi.fn(),
  },
  billingApi: {
    createPortal: vi.fn(),
  },
  aiSettingsApi: {
    getSettings: (...args: unknown[]) => mockGetSettings(...args),
    updateSettings: vi.fn(),
    deleteSettings: vi.fn(),
  },
  reportApi: {
    getSchedules: vi.fn().mockResolvedValue({ data: { data: [] } }),
    listSchedules: vi.fn().mockResolvedValue({ data: { data: [] } }),
    createSchedule: vi.fn(),
    deleteSchedule: vi.fn(),
    generateNow: vi.fn(),
  },
}));

// Mock react-hot-toast
vi.mock('react-hot-toast', () => ({
  default: { success: vi.fn(), error: vi.fn() },
}));

import AccountPage from './AccountPage';

const mockProfile = {
  user: {
    id: 'user-1',
    email: 'alice@university.edu',
    name: 'Alice Researcher',
    role: 'user',
    plan: 'pro',
    emailVerified: true,
    createdAt: '2025-06-01T00:00:00Z',
  },
  subscription: {
    status: 'active',
    currentPeriodEnd: '2026-07-01T00:00:00Z',
    cancelAtPeriodEnd: false,
  },
  usage: {
    canvasCount: 3,
    totalTranscripts: 12,
    totalCodes: 25,
    totalShares: 2,
  },
  authType: 'email',
};

describe('AccountPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSearchParams.delete('session_id');
    mockGetMe.mockResolvedValue({ data: { data: mockProfile } });
    mockGetSettings.mockResolvedValue({ data: { data: null } });
  });

  it('renders user profile section', async () => {
    render(<AccountPage />);

    await waitFor(() => {
      expect(screen.getByText('Profile')).toBeInTheDocument();
    });

    // Should show Name label
    expect(screen.getByText('Name')).toBeInTheDocument();
  });

  it('shows current plan', async () => {
    render(<AccountPage />);

    await waitFor(() => {
      expect(screen.getByText('Pro')).toBeInTheDocument();
    });

    expect(screen.getByText('Plan')).toBeInTheDocument();
  });

  it('shows usage stats', async () => {
    render(<AccountPage />);

    await waitFor(() => {
      expect(screen.getByText('Usage')).toBeInTheDocument();
    });

    expect(screen.getByText('Canvases')).toBeInTheDocument();
    expect(screen.getByText('Transcripts')).toBeInTheDocument();
    expect(screen.getByText('Codes')).toBeInTheDocument();
  });

  it('Change Password section present', async () => {
    render(<AccountPage />);

    await waitFor(() => {
      expect(screen.getByPlaceholderText('Current password')).toBeInTheDocument();
    });

    expect(screen.getAllByText('Change Password').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByPlaceholderText('New password (min 8 characters)')).toBeInTheDocument();
  });

  it('Delete account section present', async () => {
    render(<AccountPage />);

    await waitFor(() => {
      expect(screen.getByText('Danger Zone')).toBeInTheDocument();
    });

    expect(screen.getByRole('button', { name: 'Delete Account' })).toBeInTheDocument();
  });

  it('AI Settings section present for email auth users', async () => {
    render(<AccountPage />);

    await waitFor(() => {
      expect(screen.getByText('AI Settings')).toBeInTheDocument();
    });

    expect(screen.getByText('Provider')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Save AI Settings' })).toBeInTheDocument();
  });

  it('shows Manage subscription link for paid users', async () => {
    render(<AccountPage />);

    await waitFor(() => {
      expect(screen.getByText('Manage subscription')).toBeInTheDocument();
    });
  });

  it('shows subscription status for paid users', async () => {
    render(<AccountPage />);

    await waitFor(() => {
      expect(screen.getByText('active')).toBeInTheDocument();
    });

    expect(screen.getByText('Next billing date')).toBeInTheDocument();
  });
});
