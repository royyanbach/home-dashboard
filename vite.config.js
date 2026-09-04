import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const clipsHost = env.VITE_CLIPS_HOST ?? '';
  const clipsApiUrl = env.VITE_CLIPS_API_URL ?? '';

  return {
    define: {
      __CLIPS_API_URL__: JSON.stringify(clipsApiUrl),
      __CLIPS_HOST__: JSON.stringify(clipsHost),
    },
    plugins: [
      react(),
      tailwindcss(),
      VitePWA({
        strategies: 'injectManifest',
        srcDir: 'src',
        filename: 'sw.js',
        registerType: 'autoUpdate',
        injectManifest: {
          globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
        },
        includeAssets: ['favicon.png', 'apple-touch-icon.png'],
        manifest: {
          name: 'Home Dashboard',
          short_name: 'Home',
          description: 'Personal mobile web dashboard for home automations',
          theme_color: '#1F1F22',
          background_color: '#111112',
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
      }),
    ],
  };
});
