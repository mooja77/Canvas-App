// Cloudflare Pages advanced-mode router.
//
// A top-level 404.html makes unknown paths return a truthful HTTP 404, but it
// also disables Pages' implicit SPA fallback. Serve static/prerendered assets
// first, then fall back to index.html only for real client-rendered routes.
// This keeps deep links working without turning every typo and missing file
// into a 200 response containing the homepage.

const SPA_ROUTE_PATTERNS = Object.freeze([
  /^\/account\/?$/,
  /^\/admin\/?$/,
  /^\/canvas(?:\/[^/]+)?\/?$/,
  /^\/forgot-password\/?$/,
  /^\/repository\/?$/,
  /^\/reset-password\/?$/,
  /^\/team\/?$/,
  /^\/verify-email\/?$/,
  /^\/vs\/[^/]+\/?$/,
]);

function isSpaRoute(pathname) {
  return SPA_ROUTE_PATTERNS.some((pattern) => pattern.test(pathname));
}

export default {
  async fetch(request, env) {
    const assetResponse = await env.ASSETS.fetch(request);
    if (assetResponse.status !== 404 || !['GET', 'HEAD'].includes(request.method)) {
      return assetResponse;
    }

    const url = new URL(request.url);
    if (!isSpaRoute(url.pathname)) return assetResponse;

    url.pathname = '/';
    const indexRequest = new Request(url, request);
    return env.ASSETS.fetch(indexRequest);
  },
};
