import type { Response } from 'express';

// JWT httpOnly cookie. Frontend (qualcanvas.com / Cloudflare Pages) and backend
// (canvas-app-production.up.railway.app / Railway) are on different eTLD+1s,
// so the cookie has to be SameSite=None + Secure for the browser to send it on
// cross-site XHR. CSRF is handled separately by the origin-check middleware.
// In development both ends are same-origin (localhost), so Lax is fine there.
const AUTH_COOKIE_NAME = 'jwt';
// 30-day absolute max; session timeout is enforced server-side via JWT exp.
const AUTH_COOKIE_MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000;

export function setAuthCookie(res: Response, token: string) {
  const isProd = process.env.NODE_ENV === 'production';
  res.cookie(AUTH_COOKIE_NAME, token, {
    httpOnly: true,
    secure: isProd,
    sameSite: isProd ? 'none' : 'lax',
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
    sameSite: isProd ? 'none' : 'lax',
    path: '/',
  });
}

export { AUTH_COOKIE_NAME };
