import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import path from 'path';

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
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff,woff2}'],
        runtimeCaching: [
          {
            urlPattern: /^https?:\/\/localhost:\d+\/api\//,
            handler: 'NetworkFirst',
            options: {
              cacheName: 'api-cache',
              expiration: { maxEntries: 50, maxAgeSeconds: 300 },
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
    port: 5174,
    proxy: {
      '/api': {
        target: 'http://localhost:3007',
        changeOrigin: true,
      },
    },
  },
});
