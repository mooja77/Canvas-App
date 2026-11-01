import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import path from 'path';

const frontendPort = Number(process.env.FRONTEND_PORT ?? 5174);
const backendUrl = process.env.BACKEND_URL ?? 'http://localhost:3007';
const frontendHost = process.env.FRONTEND_HOST;

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      // Switched from 'autoUpdate' to 'prompt' (Reliability fix #10) so we
      // can show the user a "Reload to update" toast instead of silently
      // activating new bundles. Silent updates strand users on stale
      // frontends that talk to a freshly-deployed backend, surfacing as
      // mysterious type errors at runtime. main.tsx wires the toast.
      registerType: 'prompt',
      manifest: {
        name: 'QualCanvas - Qualitative Coding',
        short_name: 'QualCanvas',
        theme_color: '#3B82F6',
        background_color: '#ffffff',
        display: 'standalone',
        start_url: '/',
        icons: [{ src: '/favicon.svg', sizes: 'any', type: 'image/svg+xml' }],
      },
      workbox: {
        // Keep install lightweight. Route chunks are cached on first use
        // instead of eagerly downloading the entire application (~7 MB).
        globPatterns: ['**/*.{html,ico,png,svg,woff,woff2}', 'assets/*.css'],
        runtimeCaching: [
          {
            urlPattern: ({ request }) => request.destination === 'script' || request.destination === 'style',
            handler: 'StaleWhileRevalidate',
            options: {
              cacheName: 'application-assets',
              // A production build emits 93 JS chunks + 2 CSS files, so the
              // previous 40-entry cap evicted route chunks continuously and
              // sent almost every navigation back to the network — which is
              // what made stale-bundle chunk 404s so easy to hit. Sized above
              // the real chunk count so the LRU stops thrashing.
              expiration: { maxEntries: 200, maxAgeSeconds: 7 * 24 * 60 * 60 },
            },
          },
        ],
      },
    }),
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  build: {
    // Don't ship source maps to production — they let anyone reconstruct the
    // original source (including inline comments and business logic) from
    // the minified bundle. Keep them during local dev for debugging.
    sourcemap: false,
    // The canvas route intentionally carries a large interaction surface.
    // Keep the warning threshold aligned with the current audited route/vendor
    // split so real regressions still stand out.
    chunkSizeWarningLimit: 700,
    rollupOptions: {
      output: {
        // Function form, not the object form: with the object form Rollup put
        // react/jsx-runtime (also a dependency of @xyflow/react) into
        // flow-vendor, so every marketing page downloaded the canvas library
        // just to get jsx(). The groups are otherwise the same as before.
        manualChunks(id: string) {
          if (!id.includes('node_modules')) return undefined;
          if (
            /node_modules[\/](react|react-dom|react-router|react-router-dom|scheduler|cookie|set-cookie-parser)[\/]/.test(
              id,
            )
          )
            return 'react-vendor';
          if (/node_modules[\/]@xyflow[\/]/.test(id)) return 'flow-vendor';
          if (/node_modules[\/]recharts[\/]/.test(id)) return 'chart-vendor';
          if (/node_modules[\/]dagre[\/]/.test(id)) return 'layout-vendor';
          if (/node_modules[\/]@visx[\/](wordcloud|text)[\/]/.test(id)) return 'visx-vendor';
          return undefined;
        },
      },
    },
  },
  server: {
    ...(frontendHost ? { host: frontendHost } : {}),
    port: frontendPort,
    proxy: {
      '/api': {
        target: backendUrl,
        changeOrigin: true,
      },
    },
  },
});
