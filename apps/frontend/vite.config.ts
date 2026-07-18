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
              expiration: { maxEntries: 40, maxAgeSeconds: 7 * 24 * 60 * 60 },
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
        manualChunks: {
          'react-vendor': ['react', 'react-dom', 'react-router-dom'],
          'flow-vendor': ['@xyflow/react'],
          'chart-vendor': ['recharts'],
          'layout-vendor': ['dagre'],
          'visx-vendor': ['@visx/wordcloud', '@visx/text'],
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
