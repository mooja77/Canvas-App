import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import RouteErrorFallback from './RouteErrorFallback';

function setOnLine(value: boolean) {
  Object.defineProperty(navigator, 'onLine', { configurable: true, value });
}

const reload = vi.fn();

beforeEach(() => {
  reload.mockClear();
  Object.defineProperty(window, 'location', {
    configurable: true,
    value: { ...window.location, reload },
  });
});

afterEach(() => setOnLine(true));

describe('RouteErrorFallback', () => {
  it('explains a stale bundle when online, and offers a reload', async () => {
    setOnLine(true);
    render(<RouteErrorFallback />);

    expect(screen.getByRole('alert')).toBeInTheDocument();
    expect(screen.getByText(/didn't load/i)).toBeInTheDocument();
    expect(screen.getByText(/probably updated while this tab was open/i)).toBeInTheDocument();
    // The raw module error must never reach a researcher.
    expect(screen.queryByText(/dynamically imported module/i)).not.toBeInTheDocument();

    screen.getByRole('button', { name: /reload/i }).click();
    expect(reload).toHaveBeenCalledTimes(1);
  });

  it('explains the offline case instead, and says visited pages still work', () => {
    setOnLine(false);
    render(<RouteErrorFallback />);

    expect(screen.getByText(/isn't available offline/i)).toBeInTheDocument();
    expect(screen.getByText(/already visited still work/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /try again/i })).toBeInTheDocument();
  });

  it('switches copy when connectivity changes while it is on screen', () => {
    setOnLine(true);
    render(<RouteErrorFallback />);
    expect(screen.getByText(/didn't load/i)).toBeInTheDocument();

    act(() => {
      setOnLine(false);
      window.dispatchEvent(new Event('offline'));
    });
    expect(screen.getByText(/isn't available offline/i)).toBeInTheDocument();

    act(() => {
      setOnLine(true);
      window.dispatchEvent(new Event('online'));
    });
    expect(screen.getByText(/didn't load/i)).toBeInTheDocument();
  });
});
