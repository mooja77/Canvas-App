import type { Response } from 'express';

// JWT httpOnly cookie. Reverse-proxied through Vercel (/api/* → Railway) so the
// frontend sees same-origin responses — SameSite=Lax is sufficient and keeps
// CSRF risk minimal for state-changing requests.
const AUTH_COOKIE_NAME = 'jwt';
// 30-day absolute max; session timeout is enforced server-side via JWT exp.
const AUTH_COOKIE_MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000;

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
