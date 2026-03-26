import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import OfflineBanner from './OfflineBanner';

describe('OfflineBanner', () => {
  let originalOnLine: boolean;

  beforeEach(() => {
    vi.clearAllMocks();
    originalOnLine = navigator.onLine;
  });

  function mockOnlineStatus(online: boolean) {
    Object.defineProperty(navigator, 'onLine', {
      value: online,
      writable: true,
      configurable: true,
    });
  }

  it('does not render when online', () => {
    mockOnlineStatus(true);
    render(<OfflineBanner />);
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('renders banner when offline', () => {
    mockOnlineStatus(false);
    render(<OfflineBanner />);
    expect(screen.getByRole('alert')).toBeInTheDocument();
    expect(screen.getByText("You're offline. Changes won't be saved.")).toBeInTheDocument();
  });

  it('shows banner when going offline after initial render', () => {
    mockOnlineStatus(true);
    render(<OfflineBanner />);
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();

    act(() => {
      window.dispatchEvent(new Event('offline'));
    });

    expect(screen.getByRole('alert')).toBeInTheDocument();
  });

  it('hides banner when coming back online', () => {
    mockOnlineStatus(false);
    render(<OfflineBanner />);
    expect(screen.getByRole('alert')).toBeInTheDocument();

    act(() => {
      window.dispatchEvent(new Event('online'));
    });

    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('has correct ARIA role="alert" attribute', () => {
    mockOnlineStatus(false);
    render(<OfflineBanner />);
    const banner = screen.getByRole('alert');
    expect(banner).toBeInTheDocument();
    expect(banner.tagName).toBe('DIV');
  });

  // Restore
  afterEach(() => {
    Object.defineProperty(navigator, 'onLine', {
      value: originalOnLine,
      writable: true,
      configurable: true,
    });
  });
});
