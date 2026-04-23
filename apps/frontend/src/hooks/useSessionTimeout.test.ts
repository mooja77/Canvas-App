import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useSessionTimeout } from './useSessionTimeout';
import { useAuthStore } from '../stores/authStore';

describe('useSessionTimeout', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    // Set up authenticated user so logout has something to clear
    useAuthStore.getState().setEmailAuth({
      jwt: 'test-jwt',
      email: 'user@test.com',
      userId: 'u1',
      name: 'Test User',
      role: 'user',
      plan: 'pro',
    });
  });

  afterEach(() => {
    vi.useRealTimers();
    useAuthStore.setState({
      name: null,
      role: null,
      authenticated: false,
      authType: null,
      dashboardCode: null,
      dashboardAccessId: null,
      email: null,
      userId: null,
      plan: null,
    });
  });

  it('does not show warning before 30 minutes', () => {
    const { result } = renderHook(() => useSessionTimeout());

    // Advance to 29 minutes
    act(() => {
      vi.advanceTimersByTime(29 * 60 * 1000);
    });

    expect(result.current.showWarning).toBe(false);
  });

  it('shows warning after 30 minutes of inactivity', () => {
    const { result } = renderHook(() => useSessionTimeout());

    act(() => {
      vi.advanceTimersByTime(30 * 60 * 1000);
    });

    expect(result.current.showWarning).toBe(true);
  });

  it('resets timer on mouse movement', () => {
    const { result } = renderHook(() => useSessionTimeout());

    // Advance to 20 minutes
    act(() => {
      vi.advanceTimersByTime(20 * 60 * 1000);
    });

    // Activity resets timer (must be >5s from last reset due to throttle)
    act(() => {
      vi.advanceTimersByTime(6000);
      window.dispatchEvent(new MouseEvent('mousemove'));
    });

    // Advance another 20 minutes from activity — should NOT trigger warning
    // because timer was reset
    act(() => {
      vi.advanceTimersByTime(20 * 60 * 1000);
    });

    expect(result.current.showWarning).toBe(false);
  });

  it('resets timer on key press', () => {
    const { result } = renderHook(() => useSessionTimeout());

    act(() => {
      vi.advanceTimersByTime(20 * 60 * 1000);
    });

    act(() => {
      vi.advanceTimersByTime(6000);
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'a' }));
    });

    // 25 minutes after the keydown — within 30 min window
    act(() => {
      vi.advanceTimersByTime(25 * 60 * 1000);
    });

    expect(result.current.showWarning).toBe(false);
  });

  it('resets timer on click', () => {
    const { result } = renderHook(() => useSessionTimeout());

    act(() => {
      vi.advanceTimersByTime(20 * 60 * 1000);
    });

    act(() => {
      vi.advanceTimersByTime(6000);
      window.dispatchEvent(new MouseEvent('click'));
    });

    act(() => {
      vi.advanceTimersByTime(25 * 60 * 1000);
    });

    expect(result.current.showWarning).toBe(false);
  });

  it('auto-logout after 35 minutes', () => {
    renderHook(() => useSessionTimeout());

    expect(useAuthStore.getState().authenticated).toBe(true);

    act(() => {
      vi.advanceTimersByTime(35 * 60 * 1000);
    });

    expect(useAuthStore.getState().authenticated).toBe(false);
  });

  it('calls logout function on timeout', () => {
    const logoutSpy = vi.spyOn(useAuthStore.getState(), 'logout');
    renderHook(() => useSessionTimeout());

    act(() => {
      vi.advanceTimersByTime(35 * 60 * 1000);
    });

    expect(logoutSpy).toHaveBeenCalled();
    logoutSpy.mockRestore();
  });

  it('clears timers on unmount', () => {
    const clearTimeoutSpy = vi.spyOn(global, 'clearTimeout');
    const { unmount } = renderHook(() => useSessionTimeout());

    unmount();

    // Should have called clearTimeout for warning and logout timers
    expect(clearTimeoutSpy).toHaveBeenCalled();
    clearTimeoutSpy.mockRestore();
  });

  it('dismiss warning resets timer', () => {
    const { result } = renderHook(() => useSessionTimeout());

    // Trigger warning
    act(() => {
      vi.advanceTimersByTime(30 * 60 * 1000);
    });
    expect(result.current.showWarning).toBe(true);

    // Dismiss
    act(() => {
      result.current.dismissWarning();
    });
    expect(result.current.showWarning).toBe(false);

    // Should not show warning again for another 30 minutes
    act(() => {
      vi.advanceTimersByTime(29 * 60 * 1000);
    });
    expect(result.current.showWarning).toBe(false);

    // But should after 30 minutes
    act(() => {
      vi.advanceTimersByTime(1 * 60 * 1000);
    });
    expect(result.current.showWarning).toBe(true);
  });

  it('warning does not auto-logout if dismissed in time', () => {
    const { result } = renderHook(() => useSessionTimeout());

    // Show warning at 30 minutes
    act(() => {
      vi.advanceTimersByTime(30 * 60 * 1000);
    });
    expect(result.current.showWarning).toBe(true);

    // Dismiss at 32 minutes
    act(() => {
      vi.advanceTimersByTime(2 * 60 * 1000);
      result.current.dismissWarning();
    });

    // At original 35 minute mark (3 more minutes), should NOT logout
    // because dismiss reset the timer
    act(() => {
      vi.advanceTimersByTime(3 * 60 * 1000);
    });

    expect(useAuthStore.getState().authenticated).toBe(true);
  });
});
