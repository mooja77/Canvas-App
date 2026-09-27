/**
 * A coarse, human-readable description of the browser that made a request,
 * such as "Chrome on Windows". It is stored at sign-up and shown on the
 * email-confirmation page, so the owner of an address can tell whether the
 * account was created by them. The raw user-agent string is never stored:
 * it is more identifying than this page needs.
 *
 * Returns null when nothing recognisable is present.
 */
export function deviceSummary(userAgent: string | undefined | null): string | null {
  if (!userAgent || typeof userAgent !== 'string') return null;
  const ua = userAgent.slice(0, 512);

  // Order matters: Edge and Opera also say "Chrome", Chrome also says "Safari",
  // and iOS browsers other than Safari carry their own token (CriOS, FxiOS).
  let browser: string | null = null;
  if (/Edg(e|A|iOS)?\//.test(ua)) browser = 'Edge';
  else if (/OPR\/|Opera/.test(ua)) browser = 'Opera';
  else if (/SamsungBrowser\//.test(ua)) browser = 'Samsung Internet';
  else if (/Firefox\/|FxiOS\//.test(ua)) browser = 'Firefox';
  else if (/Chrome\/|CriOS\/|Chromium\//.test(ua)) browser = 'Chrome';
  else if (/Safari\//.test(ua) && /Version\//.test(ua)) browser = 'Safari';

  let os: string | null = null;
  if (/iPhone|iPod/.test(ua)) os = 'iPhone';
  else if (/iPad/.test(ua)) os = 'iPad';
  else if (/Android/.test(ua)) os = 'Android';
  else if (/CrOS/.test(ua)) os = 'ChromeOS';
  else if (/Windows/.test(ua)) os = 'Windows';
  else if (/Mac OS X|Macintosh/.test(ua)) os = 'macOS';
  else if (/Linux/.test(ua)) os = 'Linux';

  if (browser && os) return `${browser} on ${os}`;
  return browser ?? os;
}
