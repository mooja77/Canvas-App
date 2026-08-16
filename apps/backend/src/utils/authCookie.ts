import type { Response } from 'express';

// JWT httpOnly cookie. Production uses qualcanvas.com + api.qualcanvas.com,
// which are cross-origin but same-site, so SameSite=Lax works and materially
// reduces CSRF exposure compared with None.
const AUTH_COOKIE_NAME = 'jwt';
// Match the JWT's 24-hour absolute expiry so the browser does not retain a
// cookie that the server can no longer accept.
const AUTH_COOKIE_MAX_AGE_MS = 24 * 60 * 60 * 1000;

export function setAuthCookie(res: Response, token: string) {
  const isProd = process.env.NODE_ENV === 'production';
  res.cookie(AUTH_COOKIE_NAME, token, {
    httpOnly: true,
    secure: isProd,
    sameSite: 'lax',
    path: '/',
    maxAge: AUTH_COOKIE_MAX_AGE_MS,
  });
}

export function clearAuthCookie(res: Response) {
  // Match the attributes used to set the cookie so the browser actually clears it.
  const isProd = process.env.NODE_ENV === 'production';
  res.clearCookie(AUTH_COOKIE_NAME, {
    httpOnly: true,
    secure: isProd,
    sameSite: 'lax',
    path: '/',
  });
}

export { AUTH_COOKIE_NAME };
