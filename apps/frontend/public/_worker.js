// Cloudflare Pages advanced-mode router.
//
// A top-level 404.html makes unknown paths return a truthful HTTP 404, but it
// also disables Pages' implicit SPA fallback. Serve static/prerendered assets
// first, then fall back to index.html only for real client-rendered routes.
// This keeps deep links working without turning every typo and missing file
// into a 200 response containing the homepage.

//
// Two shells: routes that can show research or account data get app-shell.html,
// which contains no advertising or marketing loader. Every other client route
// gets the marketing index.html. APP_ROUTE_PATTERNS is mirrored in
// src/utils/appShell.ts; a unit test keeps the two lists identical.
const APP_ROUTE_PATTERNS = Object.freeze([
  /^\/account\/?$/,
  /^\/admin\/?$/,
  /^\/canvas(?:\/[^/]+)?\/?$/,
  /^\/forgot-password\/?$/,
  /^\/repository\/?$/,
  /^\/reset-password\/?$/,
  /^\/team\/?$/,
  /^\/verify-email\/?$/,
]);

const MARKETING_SPA_ROUTE_PATTERNS = Object.freeze([/^\/vs\/[^/]+\/?$/]);

function isAppRoute(pathname) {
  return APP_ROUTE_PATTERNS.some((pattern) => pattern.test(pathname));
}

function isSpaRoute(pathname) {
  return isAppRoute(pathname) || MARKETING_SPA_ROUTE_PATTERNS.some((pattern) => pattern.test(pathname));
}

// 2026-10-31: 301 the production Pages alias to the custom domain.
// qualcanvas.pages.dev served a full 200 copy of qualcanvas.com, and AI search
// cites pages.dev copies instead of the real site (AI-recommendation audit,
// 30 Oct 2026). Only this exact host is redirected: <branch>/<hash> preview
// hosts keep serving normally. _routes.json now sends every page path through
// this worker (assets excluded) so the redirect covers the whole site.
const REDIRECT_HOSTS = new Set(['qualcanvas.pages.dev']);
const CANONICAL_ORIGIN = 'https://qualcanvas.com';

// Pages serves /foo.html as a 308 to /foo and /dir/index.html as a 308 to
// /dir/. Apply that here so an old URL takes one 301, not a 301 then a 308.
function canonicalPath(pathname) {
  if (pathname.endsWith('/index.html')) return pathname.slice(0, -'index.html'.length);
  if (pathname.endsWith('.html')) return pathname.slice(0, -'.html'.length);
  return pathname;
}

export default {
  async fetch(request, env) {
    const requestUrl = new URL(request.url);
    if (REDIRECT_HOSTS.has(requestUrl.hostname)) {
      return Response.redirect(CANONICAL_ORIGIN + canonicalPath(requestUrl.pathname) + requestUrl.search, 301);
    }

    const assetResponse = await env.ASSETS.fetch(request);
    if (assetResponse.status !== 404 || !['GET', 'HEAD'].includes(request.method)) {
      return assetResponse;
    }

    const url = new URL(request.url);
    if (!isSpaRoute(url.pathname)) return assetResponse;

    url.pathname = isAppRoute(url.pathname) ? '/app-shell' : '/';
    const indexRequest = new Request(url, request);
    return env.ASSETS.fetch(indexRequest);
  },
};
