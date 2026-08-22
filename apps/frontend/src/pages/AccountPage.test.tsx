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
    <a href={to} {...props}>
      {children}
    </a>
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
const mockGetPreferences = vi.fn();
const mockGetIntegrations = vi.fn();
const mockDisconnectIntegration = vi.fn();
vi.mock('../services/api', () => ({
  canvasApi: {
    getIntegrations: (...a: unknown[]) => mockGetIntegrations(...a),
    disconnectIntegration: (...a: unknown[]) => mockDisconnectIntegration(...a),
  },
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
    updateSchedule: vi.fn(),
    deleteSchedule: vi.fn(),
    generateReport: vi.fn(),
  },
  emailApi: {
    getPreferences: (...args: unknown[]) => mockGetPreferences(...args),
    updatePreferences: vi.fn(),
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
    mockGetPreferences.mockResolvedValue({
      data: {
        data: {
          lifecycle: true,
          productUpdates: true,
          trainingTips: true,
          inactivityNudges: true,
          unsubscribedAt: null,
        },
      },
    });
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

    // Form labels now carry visible "*" required markers; match by prefix
    // to stay tolerant of decoration (mirrors LoginPage test pattern).
    await waitFor(() => {
      expect(screen.getByLabelText(/^Current password/)).toBeInTheDocument();
    });

    expect(screen.getAllByText('Change Password').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByLabelText(/^New password/)).toBeInTheDocument();
    expect(screen.getByLabelText(/^Confirm new password/)).toBeInTheDocument();
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

  // ─── Legacy provider credentials ───
  // The erasure panel is the only route a user has to credentials an earlier
  // build stored. It was previously unmounted, so it existed but could not be
  // reached; this asserts it is actually rendered on the account page.
  it('renders the legacy provider credentials section', async () => {
    mockGetIntegrations.mockResolvedValue({ data: { integrations: [] } });
    render(<AccountPage />);

    expect(await screen.findByText('Legacy provider credentials')).toBeInTheDocument();
  });

  it('reaches the credentials API when the account page loads', async () => {
    mockGetIntegrations.mockResolvedValue({ data: { integrations: [] } });
    render(<AccountPage />);

    await waitFor(() => {
      expect(mockGetIntegrations).toHaveBeenCalled();
    });
  });
});

// ─── Usage meter accuracy ───
// The meter used to hardcode the retired pre-2026 Free caps (1 canvas / 2
// transcripts / 5 codes) and, worse, divide ACCOUNT-WIDE totals by PER-CANVAS
// caps — so a fully compliant Free user saw 100% red across the board.
describe('AccountPage usage meter', () => {
  const freeProfile = (usage: Record<string, number>) => ({
    ...mockProfile,
    user: { ...mockProfile.user, plan: 'free' },
    subscription: null,
    usage,
  });

  beforeEach(() => {
    vi.clearAllMocks();
    mockSearchParams.delete('session_id');
    mockGetSettings.mockResolvedValue({ data: { data: null } });
    mockGetPreferences.mockResolvedValue({
      data: {
        data: {
          lifecycle: true,
          productUpdates: true,
          trainingTips: true,
          inactivityNudges: true,
          unsubscribedAt: null,
        },
      },
    });
  });

  it('uses the real Free canvas cap of 2, not the retired cap of 1', async () => {
    mockGetMe.mockResolvedValue({
      data: { data: freeProfile({ canvasCount: 2, totalTranscripts: 0, totalCodes: 0, totalShares: 0 }) },
    });
    render(<AccountPage />);

    expect(await screen.findByTestId('usage-canvases-value')).toHaveTextContent('2/2');
  });

  it('does not divide account-wide transcript and code totals by per-canvas caps', async () => {
    // A compliant Free user: 2 canvases, each holding fewer than 5 transcripts
    // and fewer than 10 codes. Account-wide totals therefore exceed the
    // per-canvas caps without the user breaching anything.
    mockGetMe.mockResolvedValue({
      data: { data: freeProfile({ canvasCount: 2, totalTranscripts: 8, totalCodes: 18, totalShares: 0 }) },
    });
    render(<AccountPage />);

    const transcripts = await screen.findByTestId('usage-transcripts-value');
    expect(transcripts).toHaveTextContent('8');
    expect(transcripts.textContent).not.toContain('/');

    const codes = screen.getByTestId('usage-codes-value');
    expect(codes).toHaveTextContent('18');
    expect(codes.textContent).not.toContain('/');

    // The real per-canvas caps are still surfaced, just not as a meter.
    expect(screen.getByTestId('usage-transcripts-hint')).toHaveTextContent('5 per canvas');
    expect(screen.getByTestId('usage-codes-hint')).toHaveTextContent('10 per canvas');
  });

  it('meters share codes, which really are an account-wide cap', async () => {
    mockGetMe.mockResolvedValue({
      data: { data: freeProfile({ canvasCount: 1, totalTranscripts: 1, totalCodes: 1, totalShares: 0 }) },
    });
    render(<AccountPage />);

    expect(await screen.findByTestId('usage-shares-value')).toHaveTextContent('0/0');
  });

  it('shows uncapped counts for Pro rather than pretending there is no data', async () => {
    mockGetMe.mockResolvedValue({ data: { data: mockProfile } });
    render(<AccountPage />);

    const canvases = await screen.findByTestId('usage-canvases-value');
    expect(canvases).toHaveTextContent('3');
    expect(canvases.textContent).not.toContain('/');
    expect(screen.getByTestId('usage-shares-value')).toHaveTextContent('2/5');
  });

  it('applies the Student caps rather than falling through to no caps at all', async () => {
    mockGetMe.mockResolvedValue({
      data: {
        data: {
          ...mockProfile,
          user: { ...mockProfile.user, plan: 'student' },
          usage: { canvasCount: 4, totalTranscripts: 30, totalCodes: 90, totalShares: 1 },
        },
      },
    });
    render(<AccountPage />);

    expect(await screen.findByTestId('usage-canvases-value')).toHaveTextContent('4/5');
    expect(screen.getByTestId('usage-shares-value')).toHaveTextContent('1/2');
    // Student has no transcript or code cap at all.
    expect(screen.queryByTestId('usage-transcripts-hint')).not.toBeInTheDocument();
  });
});
