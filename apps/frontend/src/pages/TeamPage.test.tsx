import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';

// Use vi.hoisted so these are available in the hoisted vi.mock factories
const { mockTeamApi, mockToast, getMockPlan, setMockPlan } = vi.hoisted(() => {
  const mockTeamApi = {
    list: vi.fn(),
    get: vi.fn(),
    create: vi.fn(),
    invite: vi.fn(),
    removeMember: vi.fn(),
    deleteTeam: vi.fn(),
  };
  const mockToast = { success: vi.fn(), error: vi.fn() };
  let mockPlan = 'team';
  return {
    mockTeamApi,
    mockToast,
    getMockPlan: () => mockPlan,
    setMockPlan: (p: string) => { mockPlan = p; },
  };
});

// Mock react-router-dom
vi.mock('react-router-dom', () => ({
  Link: ({ to, children, ...props }: { to: string; children: React.ReactNode;[key: string]: unknown }) => (
    <a href={to} {...props}>{children}</a>
  ),
}));

// Mock react-hot-toast
vi.mock('react-hot-toast', () => ({ default: mockToast }));

// Mock teamApi
vi.mock('../services/api', () => ({
  teamApi: mockTeamApi,
}));

// Mock authStore — default to 'team' plan so create form is accessible
vi.mock('../stores/authStore', () => ({
  useAuthStore: (selector?: (s: Record<string, unknown>) => unknown) => {
    const state = { plan: getMockPlan() };
    if (typeof selector === 'function') return selector(state);
    return state;
  },
}));

// Import after mocks
import TeamPage from './TeamPage';

const sampleTeam = {
  id: 'team-1',
  name: 'Research Team Alpha',
  ownerId: 'owner-1',
  createdAt: '2026-01-15T10:00:00Z',
  owner: { id: 'owner-1', name: 'Alice Owner', email: 'alice@example.com' },
  myRole: 'owner',
  memberCount: 2,
  members: [
    {
      id: 'member-1',
      userId: 'owner-1',
      role: 'owner',
      joinedAt: '2026-01-15T10:00:00Z',
      user: { id: 'owner-1', name: 'Alice Owner', email: 'alice@example.com' },
    },
    {
      id: 'member-2',
      userId: 'user-2',
      role: 'member',
      joinedAt: '2026-01-20T10:00:00Z',
      user: { id: 'user-2', name: 'Bob Member', email: 'bob@example.com' },
    },
  ],
};

describe('TeamPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setMockPlan('team');
  });

  it('shows loading state', () => {
    // list never resolves, so page stays in loading state
    mockTeamApi.list.mockReturnValue(new Promise(() => {}));

    render(<TeamPage />);

    expect(screen.getByText('Loading...')).toBeInTheDocument();
  });

  it('shows "No Team Yet" with create form for users without a team on team plan', async () => {
    mockTeamApi.list.mockResolvedValue({ data: { data: [] } });

    render(<TeamPage />);

    await waitFor(() => {
      expect(screen.getByText('No Team Yet')).toBeInTheDocument();
    });

    expect(screen.getByPlaceholderText('Team name')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Create a Team/i })).toBeInTheDocument();
  });

  it('shows team name and member list when team exists', async () => {
    mockTeamApi.list.mockResolvedValue({ data: { data: [{ ...sampleTeam }] } });
    mockTeamApi.get.mockResolvedValue({ data: { data: sampleTeam } });

    render(<TeamPage />);

    await waitFor(() => {
      expect(screen.getByText('Research Team Alpha')).toBeInTheDocument();
    });

    // Members should be listed
    expect(screen.getByText('Alice Owner')).toBeInTheDocument();
    expect(screen.getByText('Bob Member')).toBeInTheDocument();
    expect(screen.getByText('alice@example.com')).toBeInTheDocument();
    expect(screen.getByText('bob@example.com')).toBeInTheDocument();
    expect(screen.getByText('Members (2)')).toBeInTheDocument();
  });

  it('shows invite form for owners/admins', async () => {
    mockTeamApi.list.mockResolvedValue({ data: { data: [{ ...sampleTeam, myRole: 'owner' }] } });
    mockTeamApi.get.mockResolvedValue({ data: { data: sampleTeam } });

    render(<TeamPage />);

    await waitFor(() => {
      expect(screen.getByText('Invite Member')).toBeInTheDocument();
    });

    expect(screen.getByPlaceholderText('Email address')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Invite/i })).toBeInTheDocument();
  });

  it('handles invite submission', async () => {
    mockTeamApi.list.mockResolvedValue({ data: { data: [{ ...sampleTeam, myRole: 'owner' }] } });
    mockTeamApi.get.mockResolvedValue({ data: { data: sampleTeam } });
    mockTeamApi.invite.mockResolvedValue({ data: { success: true } });

    render(<TeamPage />);

    await waitFor(() => {
      expect(screen.getByPlaceholderText('Email address')).toBeInTheDocument();
    });

    const emailInput = screen.getByPlaceholderText('Email address');
    fireEvent.change(emailInput, { target: { value: 'newmember@example.com' } });

    const inviteBtn = screen.getByRole('button', { name: /^Invite$/i });
    fireEvent.click(inviteBtn);

    await waitFor(() => {
      expect(mockTeamApi.invite).toHaveBeenCalledWith('team-1', 'newmember@example.com');
    });

    await waitFor(() => {
      expect(mockToast.success).toHaveBeenCalledWith('Invitation sent to newmember@example.com');
    });
  });
});
