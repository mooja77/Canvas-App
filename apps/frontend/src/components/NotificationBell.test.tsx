import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import NotificationBell from './NotificationBell';
import { useAuthStore } from '../stores/authStore';

const api = vi.hoisted(() => ({
  getNotifications: vi.fn(),
  markAsRead: vi.fn(),
  markAllAsRead: vi.fn(),
  deleteNotification: vi.fn(),
}));
vi.mock('../services/api', () => ({ notificationApi: api }));
const empty = { data: { data: [], unreadCount: 0 } };
const notification = {
  id: 'note',
  type: 'comment',
  title: 'Research comment',
  message: 'Review this passage',
  read: false,
  metadata: {},
  createdAt: '2026-10-04T00:00:00Z',
};
beforeEach(() => {
  vi.clearAllMocks();
  api.getNotifications.mockReset().mockResolvedValue(empty);
  useAuthStore.setState({ authenticated: true, authType: 'email', userId: 'local-user', email: 'local@example.test' });
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});
const open = () => fireEvent.click(screen.getByTitle('Notifications'));
describe('NotificationBell GET recovery', () => {
  it('accepts parent layout classes without changing notification reads', async () => {
    render(<NotificationBell className="order-last sm:order-none" />);
    await waitFor(() => expect(api.getNotifications).toHaveBeenCalledTimes(1));
    expect(screen.getByTitle('Notifications').parentElement).toHaveClass('relative', 'order-last', 'sm:order-none');
    expect(api.markAsRead).not.toHaveBeenCalled();
    expect(api.markAllAsRead).not.toHaveBeenCalled();
    expect(api.deleteNotification).not.toHaveBeenCalled();
  });
  it('names a pending read and does not claim empty notifications', () => {
    api.getNotifications.mockReturnValue(new Promise(() => {}));
    render(<NotificationBell />);
    open();
    expect(screen.getByRole('status', { name: 'Loading notifications' })).toBeInTheDocument();
    expect(screen.queryByText('No notifications yet')).not.toBeInTheDocument();
  });
  it('announces failed reads and deduplicates synchronous retry before successful empty', async () => {
    let resolve!: (value: typeof empty) => void;
    api.getNotifications.mockRejectedValueOnce(new Error('503')).mockImplementationOnce(
      () =>
        new Promise((r) => {
          resolve = r;
        }),
    );
    render(<NotificationBell />);
    open();
    expect(await screen.findByRole('alert')).toHaveTextContent('Try again');
    expect(screen.queryByText('No notifications yet')).not.toBeInTheDocument();
    const retry = screen.getByRole('button', { name: 'Try loading notifications again' });
    expect(retry).toHaveClass('min-h-11', 'min-w-11');
    act(() => {
      fireEvent.click(retry);
      fireEvent.click(retry);
    });
    expect(api.getNotifications).toHaveBeenCalledTimes(2);
    expect(screen.getByRole('status', { name: 'Loading notifications' })).toBeInTheDocument();
    await act(async () => resolve(empty));
    expect(await screen.findByText('No notifications yet')).toBeInTheDocument();
  });
  it.each([
    { data: null, unreadCount: 0 },
    { data: [], unreadCount: '4' },
    { data: [null], unreadCount: 1 },
  ])('does not present malformed responses as successful notifications: %j', async (response) => {
    api.getNotifications.mockResolvedValue({ data: response });
    render(<NotificationBell />);
    open();
    expect(await screen.findByRole('alert')).toHaveTextContent('Try again');
    expect(screen.queryByText('No notifications yet')).not.toBeInTheDocument();
  });
  it('retains the email-only visibility contract', () => {
    useAuthStore.setState({ authType: 'legacy' });
    render(<NotificationBell />);
    expect(screen.queryByTitle('Notifications')).not.toBeInTheDocument();
    expect(api.getNotifications).not.toHaveBeenCalled();
  });

  it('hides old items/counts when a 30-second poll fails', async () => {
    vi.useFakeTimers();
    api.getNotifications
      .mockResolvedValueOnce({ data: { data: [notification], unreadCount: 1 } })
      .mockRejectedValueOnce(new Error('503'));
    render(<NotificationBell />);
    open();
    await act(async () => {});
    expect(screen.getByText('Research comment')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Mark all as read' })).toBeInTheDocument();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(30_000);
    });
    expect(api.getNotifications).toHaveBeenCalledTimes(2);
    expect(screen.getByRole('alert')).toBeInTheDocument();
    expect(screen.queryByText('Research comment')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Mark all as read' })).not.toBeInTheDocument();
    expect(screen.queryByText('1')).not.toBeInTheDocument();
  });

  it('ignores late results from a different authenticated user', async () => {
    let resolveOld!: (value: unknown) => void;
    api.getNotifications
      .mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            resolveOld = resolve;
          }),
      )
      .mockResolvedValueOnce(empty);
    render(<NotificationBell />);
    open();
    act(() => useAuthStore.setState({ userId: 'another-local-user', email: 'another@example.test' }));
    await screen.findByText('No notifications yet');
    await act(async () => resolveOld({ data: { data: [notification], unreadCount: 1 } }));
    expect(screen.getByText('No notifications yet')).toBeInTheDocument();
    expect(screen.queryByText('Research comment')).not.toBeInTheDocument();
  });

  it('ignores late failures after logout and clears the polling lifetime', async () => {
    vi.useFakeTimers();
    let rejectOld!: (error: Error) => void;
    api.getNotifications.mockImplementationOnce(
      () =>
        new Promise((_, reject) => {
          rejectOld = reject;
        }),
    );
    const view = render(<NotificationBell />);
    open();
    act(() => useAuthStore.setState({ authenticated: false }));
    await act(async () => rejectOld(new Error('Old read')));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(30_000);
    });
    expect(screen.queryByTitle('Notifications')).not.toBeInTheDocument();
    expect(api.getNotifications).toHaveBeenCalledTimes(1);
    view.unmount();
  });

  it('ignores a late result after the authenticated access scope changes', async () => {
    let resolveOld!: (value: unknown) => void;
    api.getNotifications
      .mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            resolveOld = resolve;
          }),
      )
      .mockResolvedValueOnce(empty);
    render(<NotificationBell />);
    open();
    act(() => useAuthStore.setState({ dashboardAccessId: 'another-local-scope' }));
    await screen.findByText('No notifications yet');
    await act(async () => resolveOld({ data: { data: [notification], unreadCount: 1 } }));
    expect(screen.queryByText('Research comment')).not.toBeInTheDocument();
    expect(api.getNotifications).toHaveBeenCalledTimes(2);
  });

  it('invalidates an outstanding read and stops polling on unmount', async () => {
    vi.useFakeTimers();
    let resolveOld!: (value: unknown) => void;
    api.getNotifications.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolveOld = resolve;
        }),
    );
    const view = render(<NotificationBell />);
    open();
    view.unmount();
    await act(async () => resolveOld({ data: { data: [notification], unreadCount: 1 } }));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(60_000);
    });
    expect(api.getNotifications).toHaveBeenCalledTimes(1);
    expect(screen.queryByTitle('Notifications')).not.toBeInTheDocument();
  });

  it('retains the existing mark-all mutation contract for a successful read', async () => {
    api.getNotifications.mockResolvedValue({ data: { data: [notification], unreadCount: 1 } });
    render(<NotificationBell />);
    open();
    fireEvent.click(await screen.findByRole('button', { name: 'Mark all as read' }));
    await waitFor(() => expect(api.markAllAsRead).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(screen.queryByRole('button', { name: 'Mark all as read' })).not.toBeInTheDocument());
  });

  it('retains the existing single-read mutation contract', async () => {
    api.getNotifications.mockResolvedValue({ data: { data: [notification], unreadCount: 1 } });
    render(<NotificationBell />);
    open();
    fireEvent.click(await screen.findByText('Research comment'));
    await waitFor(() => expect(api.markAsRead).toHaveBeenCalledWith('note'));
  });

  it('retains the existing delete mutation contract', async () => {
    api.getNotifications.mockResolvedValue({ data: { data: [notification], unreadCount: 1 } });
    render(<NotificationBell />);
    open();
    fireEvent.click(await screen.findByTitle('Delete notification'));
    await waitFor(() => expect(api.deleteNotification).toHaveBeenCalledWith('note'));
    expect(await screen.findByText('No notifications yet')).toBeInTheDocument();
  });
});
