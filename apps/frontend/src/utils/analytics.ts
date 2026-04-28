type Gtag = (command: 'event', eventName: string, params?: Record<string, unknown>) => void;

declare global {
  interface Window {
    gtag?: Gtag;
  }
}

export function trackEvent(eventName: string, params?: Record<string, unknown>) {
  window.gtag?.('event', eventName, params);
}
