// Cloudflare Pages advanced-mode router.
//
// A top-level 404.html makes unknown paths return a truthful HTTP 404, but it
// also disables Pages' implicit SPA fallback. Serve static/prerendered assets
// first, then fall back to index.html only for real client-rendered routes.
// This keeps deep links working without turning every typo and missing file
// into a 200 response containing the homepage.

//
// Three shells. Research routes (canvas, repository, team, admin, token pages)
// get app-shell.html: no advertising/marketing loader and no support chat
// widget. /account and /support get support-shell.html, the only shell that
// loads the support widget. Everything else that is a client route gets the
// marketing index.html. The pattern lists are mirrored in src/utils/appShell.ts;
// a unit test keeps them identical.
const RESEARCH_ROUTE_PATTERNS = Object.freeze([
  /^\/admin\/?$/,
  /^\/canvas(?:\/[^/]+)?\/?$/,
  /^\/forgot-password\/?$/,
  /^\/repository\/?$/,
  /^\/reset-password\/?$/,
  /^\/team\/?$/,
  /^\/verify-email\/?$/,
]);

const SUPPORT_ROUTE_PATTERNS = Object.freeze([/^\/account\/?$/, /^\/support\/?$/]);

const MARKETING_SPA_ROUTE_PATTERNS = Object.freeze([/^\/vs\/[^/]+\/?$/]);

function isResearchRoute(pathname) {
  return RESEARCH_ROUTE_PATTERNS.some((pattern) => pattern.test(pathname));
}

function isSupportRoute(pathname) {
  return SUPPORT_ROUTE_PATTERNS.some((pattern) => pattern.test(pathname));
}

// ASSETS.fetch resolves the rewritten asset URL, not the visitor's route.
// Set one complete policy on the final response; fallbacks must not inherit
// the marketing document's global policy. The parity test checks _headers.
function withShellPolicy(response, kind) {
  if (!kind || !response.ok) return response;
  const chat = kind === 'support' ? ' https://jms-admin-portal.mooja77.workers.dev' : '';
  const policy = [
    "default-src 'self'",
    "script-src 'self' 'unsafe-inline' https://static.cloudflareinsights.com" + chat,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob: https://i.ytimg.com https://*.googleusercontent.com",
    "font-src 'self' data:",
    "connect-src 'self' https://api.qualcanvas.com wss://api.qualcanvas.com https://*.sentry.io https://cloudflareinsights.com" +
      chat,
    'frame-src https://www.youtube-nocookie.com' + chat,
    "media-src 'self' blob:",
    "worker-src 'self' blob:",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    'upgrade-insecure-requests',
  ].join('; ');
  const result = new Response(response.body, response);
  result.headers.set('Content-Security-Policy', policy);
  return result;
}

function isSpaRoute(pathname) {
  return (
    isResearchRoute(pathname) ||
    isSupportRoute(pathname) ||
    MARKETING_SPA_ROUTE_PATTERNS.some((pattern) => pattern.test(pathname))
  );
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
    const path = requestUrl.pathname;
    const shell =
      isResearchRoute(path) || path === '/app-shell' || path === '/app-shell.html'
        ? 'research'
        : isSupportRoute(path) || path === '/support-shell' || path === '/support-shell.html'
          ? 'support'
          : null;
    if (assetResponse.status !== 404 || !['GET', 'HEAD'].includes(request.method)) {
      return withShellPolicy(assetResponse, shell);
    }

    const url = new URL(request.url);
    if (!isSpaRoute(url.pathname)) return assetResponse;

    url.pathname = isSupportRoute(url.pathname) ? '/support-shell' : isResearchRoute(url.pathname) ? '/app-shell' : '/';
    const indexRequest = new Request(url, request);
    return withShellPolicy(await env.ASSETS.fetch(indexRequest), shell);
  },
};
