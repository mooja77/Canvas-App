const CLOUDFLARE_PAGES_HOST = 'qualcanvas.pages.dev';

export function getAllowedOrigins(): string[] {
  const origins: string[] = [];

  if (process.env.ALLOWED_ORIGINS) {
    origins.push(...process.env.ALLOWED_ORIGINS.split(',').map((origin) => origin.trim()));
  }

  if (process.env.CORS_ORIGIN) {
    origins.push(process.env.CORS_ORIGIN.trim());
  }

  if (process.env.FRONTEND_URL) {
    origins.push(process.env.FRONTEND_URL.trim());
  }

  return [...new Set(origins.filter(Boolean))];
}

export function isAllowedOrigin(origin: string | undefined): boolean {
  if (!origin) {
    return false;
  }

  if (getAllowedOrigins().includes(origin)) {
    return true;
  }

  try {
    const url = new URL(origin);
    return (
      url.protocol === 'https:' &&
      (url.hostname === CLOUDFLARE_PAGES_HOST || url.hostname.endsWith(`.${CLOUDFLARE_PAGES_HOST}`))
    );
  } catch {
    return false;
  }
}

export function corsOrigin(origin: string | undefined, callback: (err: Error | null, allow?: boolean) => void): void {
  if (!origin) {
    callback(null, true);
    return;
  }

  if (process.env.NODE_ENV !== 'production') {
    callback(null, ['http://localhost:5174', 'http://localhost:3007'].includes(origin));
    return;
  }

  callback(null, isAllowedOrigin(origin));
}
