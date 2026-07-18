import { useEffect, useState } from 'react';

type ServiceState = 'checking' | 'available' | 'unavailable';

/** A truthful live API health indicator; it does not imply third-party status. */
export default function StatusIndicator() {
  const [state, setState] = useState<ServiceState>('checking');

  useEffect(() => {
    const controller = new AbortController();
    const timer = window.setTimeout(() => controller.abort(), 5000);
    const apiBase = (import.meta.env.VITE_API_URL || '/api').replace(/\/api\/?$/, '');

    fetch(`${apiBase}/health`, { signal: controller.signal, credentials: 'omit' })
      .then((response) => setState(response.ok ? 'available' : 'unavailable'))
      .catch(() => setState('unavailable'))
      .finally(() => window.clearTimeout(timer));

    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, []);

  const label =
    state === 'checking' ? 'Checking service' : state === 'available' ? 'Service available' : 'Service issue';
  const dot = state === 'checking' ? 'bg-gray-400' : state === 'available' ? 'bg-emerald-500' : 'bg-red-500';

  return (
    <span
      className="inline-flex items-center gap-1.5 rounded text-xs font-medium text-gray-600 dark:text-gray-300"
      role="status"
      aria-live="polite"
    >
      <span aria-hidden="true" className={`inline-block h-1.5 w-1.5 rounded-full ${dot}`} />
      {label}
    </span>
  );
}
