import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useMobile } from './useMobile';

describe('useMobile', () => {
  const originalInnerWidth = window.innerWidth;

  beforeEach(() => {
    // Ensure ontouchstart is not present (desktop)
    delete (window as unknown as Record<string, unknown>).ontouchstart;
  });

  afterEach(() => {
    Object.defineProperty(window, 'innerWidth', {
      writable: true,
      configurable: true,
      value: originalInnerWidth,
    });
  });

  it('returns isMobile=false for wide viewport (>768px)', () => {
    Object.defineProperty(window, 'innerWidth', {
      writable: true,
      configurable: true,
      value: 1024,
    });

    const { result } = renderHook(() => useMobile());
    expect(result.current).toBe(false);
  });

  it('returns isMobile=true for narrow viewport (<768px)', () => {
    Object.defineProperty(window, 'innerWidth', {
      writable: true,
      configurable: true,
      value: 500,
    });

    const { result } = renderHook(() => useMobile());
    expect(result.current).toBe(true);
  });

  it('updates on window resize', () => {
    Object.defineProperty(window, 'innerWidth', {
      writable: true,
      configurable: true,
      value: 1024,
    });

    const { result } = renderHook(() => useMobile());
    expect(result.current).toBe(false);

    // Simulate resize to mobile
    act(() => {
      Object.defineProperty(window, 'innerWidth', {
        writable: true,
        configurable: true,
        value: 500,
      });
      window.dispatchEvent(new Event('resize'));
    });

    expect(result.current).toBe(true);
  });

  it('returns correct value for custom breakpoint', () => {
    Object.defineProperty(window, 'innerWidth', {
      writable: true,
      configurable: true,
      value: 1000,
    });

    const { result } = renderHook(() => useMobile(1200));
    expect(result.current).toBe(true);
  });

  it('cleans up resize listener on unmount', () => {
    Object.defineProperty(window, 'innerWidth', {
      writable: true,
      configurable: true,
      value: 1024,
    });

    const removeSpy = vi.spyOn(window, 'removeEventListener');
    const { unmount } = renderHook(() => useMobile());

    unmount();

    expect(removeSpy).toHaveBeenCalledWith('resize', expect.any(Function));
    removeSpy.mockRestore();
  });
});
