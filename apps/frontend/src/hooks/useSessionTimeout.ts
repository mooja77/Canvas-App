import { useEffect, useRef, useState, useCallback } from 'react';
import { useAuthStore } from '../stores/authStore';

const INACTIVITY_WARNING_MS = 30 * 60 * 1000; // 30 minutes
const INACTIVITY_LOGOUT_MS = 35 * 60 * 1000;  // 35 minutes

/**
 * Tracks user activity and auto-logs out after extended inactivity.
 * Shows a warning modal at 30 minutes, auto-logout at 35 minutes.
 */
export function useSessionTimeout() {
  const [showWarning, setShowWarning] = useState(false);
  const warningTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const logoutTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const resetTimers = useCallback(() => {
    // Clear existing timers
    if (warningTimerRef.current) clearTimeout(warningTimerRef.current);
    if (logoutTimerRef.current) clearTimeout(logoutTimerRef.current);

    // Hide warning if showing
    setShowWarning(false);

    // Set new timers
    warningTimerRef.current = setTimeout(() => {
      setShowWarning(true);
    }, INACTIVITY_WARNING_MS);

    logoutTimerRef.current = setTimeout(() => {
      useAuthStore.getState().logout();
    }, INACTIVITY_LOGOUT_MS);
  }, []);

  useEffect(() => {
    const events = ['mousemove', 'keydown', 'click', 'scroll', 'touchstart'];

    const handleActivity = () => {
      resetTimers();
    };

    // Start timers initially
    resetTimers();

    // Listen for activity
    events.forEach(event => {
      window.addEventListener(event, handleActivity, { passive: true });
    });

    return () => {
      events.forEach(event => {
        window.removeEventListener(event, handleActivity);
      });
      if (warningTimerRef.current) clearTimeout(warningTimerRef.current);
      if (logoutTimerRef.current) clearTimeout(logoutTimerRef.current);
    };
  }, [resetTimers]);

  const dismissWarning = useCallback(() => {
    setShowWarning(false);
    resetTimers();
  }, [resetTimers]);

  return { showWarning, dismissWarning };
}
