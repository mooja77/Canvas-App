import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, fireEvent, act } from '@testing-library/react';
import { StrictMode } from 'react';

// Use vi.hoisted so these are available in the hoisted vi.mock factories
const { mockTeamApi, mockToast, getMockPlan, setMockPlan, getMockUserId, setMockUserId } = vi.hoisted(() => {
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
  let mockUserId = 'owner-1';
  return {
    mockTeamApi,
    mockToast,
    getMockPlan: () => mockPlan,
    getMockUserId: () => mockUserId,
    setMockUserId: (id: string) => {
      mockUserId = id;
    },
    setMockPlan: (p: string) => {
      mockPlan = p;
    },
  };
});

// Mock react-router-dom
vi.mock('react-router-dom', () => ({
  Link: ({ to, children, ...props }: { to: string; children: React.ReactNode; [key: string]: unknown }) => (
    <a href={to} {...props}>
      {children}
    </a>
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
    const state = { plan: getMockPlan(), userId: getMockUserId() };
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
  afterEach(() => vi.restoreAllMocks());
  beforeEach(() => {
    vi.resetAllMocks();
    setMockPlan('team');
    setMockUserId('owner-1');
  });

  it('shows loading state', () => {
    // list never resolves, so page stays in loading state
    mockTeamApi.list.mockReturnValue(new Promise(() => {}));

    render(<TeamPage />);

    expect(screen.getByText('Loading...')).toBeInTheDocument();
  });

  it.each(['create', 'add', 'remove', 'delete'] as const)(
    'does not claim success for an unacknowledged %s response',
    async (action) => {
      vi.spyOn(window, 'confirm').mockReturnValue(true);
      const initial = action === 'create' ? [] : [sampleTeam];
      mockTeamApi.list
        .mockResolvedValueOnce({ data: { data: initial } })
        .mockResolvedValue({ data: { data: [sampleTeam] } });
      mockTeamApi.get.mockResolvedValue({ data: { data: sampleTeam } });
      const response = { data: { success: false } };
      mockTeamApi.create.mockResolvedValue(response);
      mockTeamApi.invite.mockResolvedValue(response);
      mockTeamApi.removeMember.mockResolvedValue(response);
      mockTeamApi.deleteTeam.mockResolvedValue(response);
      render(<TeamPage />);
      if (action === 'create') {
        fireEvent.change(await screen.findByRole('textbox', { name: 'Team name' }), {
          target: { value: sampleTeam.name },
        });
        fireEvent.click(screen.getByRole('button', { name: 'Create Team' }));
      } else if (action === 'add') {
        fireEvent.change(await screen.findByRole('textbox', { name: "Colleague's email address" }), {
          target: { value: 'newmember@example.test' },
        });
        fireEvent.click(screen.getByRole('button', { name: 'Add member' }));
      } else if (action === 'remove') {
        fireEvent.click(await screen.findByRole('button', { name: 'Remove Bob Member from team' }));
      } else {
        fireEvent.click(await screen.findByRole('button', { name: 'Delete Team' }));
        fireEvent.click(screen.getByRole('button', { name: 'Delete Forever' }));
      }
      expect(await screen.findByRole('alert')).toHaveTextContent('We could not confirm');
      expect(mockToast.success).not.toHaveBeenCalled();
      fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
      expect(await screen.findByText(sampleTeam.name)).toBeVisible();
      const changedApi = {
        create: mockTeamApi.create,
        add: mockTeamApi.invite,
        remove: mockTeamApi.removeMember,
        delete: mockTeamApi.deleteTeam,
      }[action];
      expect(changedApi).toHaveBeenCalledTimes(1);
    },
  );

  it('does not publish an older read after the StrictMode replacement read', async () => {
    let finish!: (value: unknown) => void;
    mockTeamApi.list
      .mockReturnValueOnce(
        new Promise((resolve) => {
          finish = resolve;
        }),
      )
      .mockResolvedValueOnce({ data: { data: [sampleTeam] } });
    mockTeamApi.get.mockResolvedValue({ data: { data: sampleTeam } });
    render(
      <StrictMode>
        <TeamPage />
      </StrictMode>,
    );
    expect(await screen.findByText('Research Team Alpha')).toBeVisible();
    await act(async () => finish({ data: { data: [] } }));
    expect(screen.getByText('Research Team Alpha')).toBeVisible();
    expect(screen.queryByText(/Set up your team in 3 steps/)).not.toBeInTheDocument();
  });

  it('recovers through reads only when an addition has an uncertain network outcome', async () => {
    mockTeamApi.list.mockResolvedValue({ data: { data: [sampleTeam] } });
    mockTeamApi.get.mockResolvedValue({ data: { data: sampleTeam } });
    mockTeamApi.invite.mockRejectedValue(new Error('connection dropped before acknowledgement'));
    render(<TeamPage />);
    fireEvent.change(await screen.findByRole('textbox', { name: "Colleague's email address" }), {
      target: { value: 'newmember@example.test' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Add member' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('We could not confirm the addition');
    expect(mockToast.success).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
    expect(await screen.findByText('Research Team Alpha')).toBeVisible();
    expect(mockTeamApi.invite).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('textbox', { name: "Colleague's email address" })).toHaveValue('newmember@example.test');
  });

  it.each(['remove', 'delete'] as const)('does not repeat acknowledged %s when the refresh fails', async (action) => {
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    mockTeamApi.list.mockResolvedValue({ data: { data: [sampleTeam] } });
    mockTeamApi.get
      .mockResolvedValueOnce({ data: { data: sampleTeam } })
      .mockRejectedValueOnce(new Error('refresh unavailable'))
      .mockResolvedValue({ data: { data: sampleTeam } });
    mockTeamApi.removeMember.mockResolvedValue({ data: { success: true } });
    mockTeamApi.deleteTeam.mockResolvedValue({ data: { success: true } });
    render(<TeamPage />);
    if (action === 'remove')
      fireEvent.click(await screen.findByRole('button', { name: 'Remove Bob Member from team' }));
    else {
      fireEvent.click(await screen.findByRole('button', { name: 'Delete Team' }));
      fireEvent.click(screen.getByRole('button', { name: 'Delete Forever' }));
    }
    expect(await screen.findByRole('alert')).toHaveTextContent('Retry below only reloads');
    expect(mockToast.error).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
    expect(await screen.findByText('Research Team Alpha')).toBeVisible();
    expect(action === 'remove' ? mockTeamApi.removeMember : mockTeamApi.deleteTeam).toHaveBeenCalledTimes(1);
  });

  it('uses the signed-in member, not the owner, when the summary omits myRole', async () => {
    setMockUserId('user-2');
    mockTeamApi.list.mockResolvedValue({ data: { data: [{ ...sampleTeam, myRole: undefined }] } });
    mockTeamApi.get.mockResolvedValue({ data: { data: { ...sampleTeam, myRole: undefined } } });
    render(<TeamPage />);
    expect(await screen.findByText('Research Team Alpha')).toBeVisible();
    expect(screen.queryByRole('button', { name: 'Add member' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Delete Team' })).not.toBeInTheDocument();
    expect(screen.queryByTitle('Remove member')).not.toBeInTheDocument();
  });

  it.each([null, {}, { ...sampleTeam, id: 'wrong-team' }])(
    'retries GETs only after acknowledged member addition with invalid refresh %j',
    async (data) => {
      mockTeamApi.list.mockResolvedValue({ data: { data: [sampleTeam] } });
      mockTeamApi.get
        .mockResolvedValueOnce({ data: { data: sampleTeam } })
        .mockResolvedValueOnce({ data: { data } })
        .mockResolvedValue({ data: { data: sampleTeam } });
      mockTeamApi.invite.mockResolvedValue({ data: { success: true } });
      render(<TeamPage />);
      fireEvent.change(await screen.findByRole('textbox', { name: "Colleague's email address" }), {
        target: { value: 'newmember@example.test' },
      });
      fireEvent.click(screen.getByRole('button', { name: 'Add member' }));
      expect(await screen.findByRole('alert')).toHaveTextContent("We couldn't read your saved team details");
      expect(mockToast.success).toHaveBeenCalledWith('Member added: newmember@example.test');
      expect(mockToast.error).not.toHaveBeenCalled();
      fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
      expect(await screen.findByText('Research Team Alpha')).toBeVisible();
      expect(mockTeamApi.invite).toHaveBeenCalledTimes(1);
    },
  );

  it('loads the remaining team after deleting the first, instead of inventing an empty account', async () => {
    const remaining = { ...sampleTeam, id: 'team-2', name: 'Remaining Research Team' };
    mockTeamApi.list
      .mockResolvedValueOnce({ data: { data: [sampleTeam, remaining] } })
      .mockResolvedValue({ data: { data: [remaining] } });
    mockTeamApi.get
      .mockResolvedValueOnce({ data: { data: sampleTeam } })
      .mockResolvedValue({ data: { data: remaining } });
    mockTeamApi.deleteTeam.mockResolvedValue({ data: { success: true } });
    render(<TeamPage />);
    fireEvent.click(await screen.findByRole('button', { name: 'Delete Team' }));
    fireEvent.click(screen.getByRole('button', { name: 'Delete Forever' }));
    expect(await screen.findByText('Remaining Research Team')).toBeVisible();
    expect(screen.queryByText(/Set up your team in 3 steps/)).not.toBeInTheDocument();
    expect(mockTeamApi.deleteTeam).toHaveBeenCalledTimes(1);
    expect(mockTeamApi.get).toHaveBeenLastCalledWith('team-2');
  });

  it('locks all member mutations while a removal is pending', async () => {
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true);
    let finish!: (value: unknown) => void;
    mockTeamApi.removeMember.mockReturnValue(
      new Promise((resolve) => {
        finish = resolve;
      }),
    );
    mockTeamApi.list.mockResolvedValue({ data: { data: [sampleTeam] } });
    mockTeamApi.get.mockResolvedValue({ data: { data: sampleTeam } });
    render(<TeamPage />);
    const remove = await screen.findByRole('button', { name: 'Remove Bob Member from team' });
    fireEvent.click(remove);
    fireEvent.click(remove);
    expect(remove).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Delete Team' })).toBeDisabled();
    expect(screen.getByRole('textbox', { name: "Colleague's email address" })).toBeDisabled();
    expect(mockTeamApi.removeMember).toHaveBeenCalledTimes(1);
    finish({ data: { success: true } });
    await waitFor(() => expect(mockTeamApi.list).toHaveBeenCalledTimes(2));
    confirmSpy.mockRestore();
  });

  it('shows guided 3-step setup with create form for users without a team on team plan', async () => {
    mockTeamApi.list.mockResolvedValue({ data: { data: [] } });

    render(<TeamPage />);

    await waitFor(() => {
      expect(screen.getByText(/Set up your team in 3 steps/i)).toBeInTheDocument();
    });

    expect(screen.getByPlaceholderText(/e.g\./i)).toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: 'Team name' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Create Team/i })).toBeInTheDocument();
  });

  it('does not claim the account has no team when the list fails, and retries', async () => {
    mockTeamApi.list
      .mockRejectedValueOnce(new Error('network unavailable'))
      .mockResolvedValueOnce({ data: { data: [sampleTeam] } });
    mockTeamApi.get.mockResolvedValue({ data: { data: sampleTeam } });

    render(<TeamPage />);

    expect(await screen.findByRole('alert')).toHaveTextContent("We couldn't load your team");
    expect(screen.queryByText(/Set up your team in 3 steps/i)).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
    expect(await screen.findByText('Research Team Alpha')).toBeInTheDocument();
    expect(mockTeamApi.list).toHaveBeenCalledTimes(2);
  });

  it('does not show a false empty team when team details fail to load', async () => {
    mockTeamApi.list.mockResolvedValue({ data: { data: [sampleTeam] } });
    mockTeamApi.get.mockRejectedValue(new Error('details unavailable'));

    render(<TeamPage />);

    expect(await screen.findByRole('alert')).toHaveTextContent("We couldn't read your saved team details");
    expect(screen.queryByText(/Set up your team in 3 steps/i)).not.toBeInTheDocument();
  });

  it.each([null, {}, [null]])('recovers from a malformed team list %j without claiming no team', async (data) => {
    mockTeamApi.list.mockResolvedValueOnce({ data: { data } }).mockResolvedValueOnce({ data: { data: [sampleTeam] } });
    mockTeamApi.get.mockResolvedValue({ data: { data: sampleTeam } });
    render(<TeamPage />);

    expect(await screen.findByRole('alert')).toHaveTextContent("We couldn't load your team");
    expect(screen.queryByText(/Set up your team in 3 steps/i)).not.toBeInTheDocument();
    expect(mockTeamApi.create).not.toHaveBeenCalled();
    expect(mockTeamApi.invite).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
    expect(await screen.findByText('Research Team Alpha')).toBeVisible();
  });

  it.each([
    null,
    {},
    { ...sampleTeam, members: {} },
    { ...sampleTeam, members: [{ ...sampleTeam.members[0], user: null }] },
  ])('recovers from malformed team details %j with a read-only retry', async (data) => {
    mockTeamApi.list.mockResolvedValue({ data: { data: [sampleTeam] } });
    mockTeamApi.get.mockResolvedValueOnce({ data: { data } }).mockResolvedValueOnce({ data: { data: sampleTeam } });
    render(<TeamPage />);

    expect(await screen.findByRole('alert')).toHaveTextContent("We couldn't read your saved team details");
    expect(screen.queryByText(/Set up your team in 3 steps/i)).not.toBeInTheDocument();
    expect(mockTeamApi.invite).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
    expect(await screen.findByText('Bob Member')).toBeVisible();
    expect(mockTeamApi.get).toHaveBeenCalledTimes(2);
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
    expect(screen.getByRole('complementary', { name: 'Team setup help' })).toHaveTextContent(
      'We reply within two working days. No call needed.',
    );
    expect(screen.getByRole('link', { name: 'support@qualcanvas.com' })).toHaveAttribute(
      'href',
      'mailto:support@qualcanvas.com',
    );
    expect(screen.getByRole('link', { name: 'Read the step-by-step guide' })).toHaveAttribute('href', '/guide');
  });

  it('loads full details after creation instead of rendering the raw create response', async () => {
    mockTeamApi.list.mockResolvedValueOnce({ data: { data: [] } }).mockResolvedValue({ data: { data: [sampleTeam] } });
    mockTeamApi.create.mockResolvedValue({
      data: { success: true, data: { ...sampleTeam, members: [{ userId: 'owner-1', role: 'owner' }] } },
    });
    mockTeamApi.get.mockResolvedValue({ data: { data: sampleTeam } });
    render(<TeamPage />);
    fireEvent.change(await screen.findByRole('textbox', { name: 'Team name' }), { target: { value: sampleTeam.name } });
    fireEvent.click(screen.getByRole('button', { name: 'Create Team' }));

    expect(await screen.findByText('Alice Owner')).toBeVisible();
    expect(mockTeamApi.create).toHaveBeenCalledWith(sampleTeam.name);
    expect(mockTeamApi.get).toHaveBeenCalledWith('team-1');
    expect(mockTeamApi.invite).not.toHaveBeenCalled();
  });

  it('retries only reads if the refresh fails after a successful creation', async () => {
    mockTeamApi.list
      .mockResolvedValueOnce({ data: { data: [] } })
      .mockRejectedValueOnce(new Error('refresh offline'))
      .mockResolvedValueOnce({ data: { data: [sampleTeam] } });
    mockTeamApi.create.mockResolvedValue({ data: { success: true, data: { id: sampleTeam.id } } });
    mockTeamApi.get.mockResolvedValue({ data: { data: sampleTeam } });
    render(<TeamPage />);
    fireEvent.change(await screen.findByRole('textbox', { name: 'Team name' }), { target: { value: sampleTeam.name } });
    fireEvent.click(screen.getByRole('button', { name: 'Create Team' }));
    expect(await screen.findByRole('alert')).toHaveTextContent("We couldn't read your saved team details");
    expect(mockToast.success).toHaveBeenCalledWith('Team created');
    expect(mockToast.error).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
    expect(await screen.findByText('Alice Owner')).toBeVisible();
    expect(mockTeamApi.create).toHaveBeenCalledTimes(1);
    expect(mockTeamApi.invite).not.toHaveBeenCalled();
  });

  it('shows invite form for owners/admins', async () => {
    mockTeamApi.list.mockResolvedValue({ data: { data: [{ ...sampleTeam, myRole: 'owner' }] } });
    mockTeamApi.get.mockResolvedValue({ data: { data: sampleTeam } });

    render(<TeamPage />);

    await waitFor(() => {
      expect(screen.getByText('Add Member')).toBeInTheDocument();
    });

    expect(screen.getByPlaceholderText('Email address')).toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: "Colleague's email address" })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Add member/i })).toBeInTheDocument();
  });

  it('teaches the next action if a team has no listed members', async () => {
    mockTeamApi.list.mockResolvedValue({ data: { data: [{ ...sampleTeam, members: [] }] } });
    mockTeamApi.get.mockResolvedValue({ data: { data: { ...sampleTeam, members: [] } } });

    render(<TeamPage />);

    expect(await screen.findByText(/Team members will appear here/)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Invite your first member below/ })).toHaveAttribute(
      'href',
      '#invite-member-email',
    );
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

    const inviteBtn = screen.getByRole('button', { name: /^Add member$/i });
    fireEvent.click(inviteBtn);

    await waitFor(() => {
      expect(mockTeamApi.invite).toHaveBeenCalledWith('team-1', 'newmember@example.com');
    });

    await waitFor(() => {
      expect(mockToast.success).toHaveBeenCalledWith('Member added: newmember@example.com');
    });
  });
});
