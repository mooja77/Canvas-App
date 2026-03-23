import { useState, useEffect } from 'react';

/**
 * Detects whether the user is on a mobile/tablet device.
 * Checks viewport width and touch capability, and updates on resize.
 */
export function useMobile(breakpoint = 768): boolean {
  const [isMobile, setIsMobile] = useState(
    () => window.innerWidth < breakpoint || 'ontouchstart' in window
  );

  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth < breakpoint || 'ontouchstart' in window);
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [breakpoint]);

  return isMobile;
}
