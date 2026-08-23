import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { VitePWA } from 'vite-plugin-pwa';

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const clipsHost = env.VITE_CLIPS_HOST;
  const clipsApiUrl = env.VITE_CLIPS_API_URL;

  const runtimeCaching = [];

  if (clipsApiUrl) {
    runtimeCaching.push({
      urlPattern: new RegExp(`^${escapeRegExp(clipsApiUrl)}`),
      handler: 'NetworkFirst',
      options: {
        cacheName: 'clips-api',
        expiration: { maxEntries: 32, maxAgeSeconds: 60 * 60 },
        networkTimeoutSeconds: 10,
      },
    });
  }

  if (clipsHost) {
    runtimeCaching.push({
      urlPattern: new RegExp(`^${escapeRegExp(clipsHost)}/.*\\.(?:jpg|jpeg|png|mp4)$`, 'i'),
      handler: 'NetworkFirst',
      options: {
        cacheName: 'clips-media',
        expiration: { maxEntries: 64, maxAgeSeconds: 60 * 60 * 24 },
        networkTimeoutSeconds: 10,
      },
    });
  }

  return {
    plugins: [
      react(),
      tailwindcss(),
      VitePWA({
        registerType: 'autoUpdate',
        includeAssets: ['favicon.png', 'apple-touch-icon.png'],
        manifest: {
          name: 'Home Dashboard',
          short_name: 'Home',
          description: 'Personal mobile web dashboard for home automations',
          theme_color: '#ffffff',
          background_color: '#ffffff',
          display: 'standalone',
          orientation: 'portrait',
          scope: '/',
          start_url: '/',
          icons: [
            {
              src: 'pwa-192x192.png',
              sizes: '192x192',
              type: 'image/png',
            },
            {
              src: 'pwa-512x512.png',
              sizes: '512x512',
              type: 'image/png',
            },
            {
              src: 'pwa-512x512.png',
              sizes: '512x512',
              type: 'image/png',
              purpose: 'maskable',
            },
          ],
        },
        workbox: {
          globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
          runtimeCaching,
        },
      }),
    ],
  };
});
