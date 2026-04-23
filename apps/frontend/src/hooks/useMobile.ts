import { useState, useEffect } from 'react';

/**
 * Detects whether the user is on a phone/tablet-class device.
 *
 * Uses viewport width OR a pointer heuristic that excludes desktop touchscreens.
 * `matchMedia('(hover: none) and (pointer: coarse)')` matches phones/tablets
 * without a mouse but returns false for laptops with touchscreens (which have
 * `hover: hover` and `pointer: fine`).
 */
function detectMobile(breakpoint: number): boolean {
  if (typeof window === 'undefined') return false;
  if (window.innerWidth < breakpoint) return true;
  if (typeof window.matchMedia === 'function') {
    return window.matchMedia('(hover: none) and (pointer: coarse)').matches;
  }
  return false;
}

export function useMobile(breakpoint = 768): boolean {
  const [isMobile, setIsMobile] = useState(() => detectMobile(breakpoint));

  useEffect(() => {
    const handleResize = () => setIsMobile(detectMobile(breakpoint));
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [breakpoint]);

  return isMobile;
}
