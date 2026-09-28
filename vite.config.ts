import { accountApiPlugin } from './server/vite-plugin';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { fileURLToPath } from 'node:url';
import { defineConfig, loadEnv } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), 'ONE_DAY_');
  for (const name of ['ONE_DAY_ORIGIN', 'ONE_DAY_DATABASE', 'ONE_DAY_ADMIN_PASSWORD']) {
    if (!process.env[name] && env[name]) process.env[name] = env[name];
  }
  return {
    server: {
      port: 53028,
      strictPort: true,
      fs: {
        deny: [
          '.env',
          '.env.*',
          '*.{crt,pem}',
          '**/.git/**',
          '**/data/**',
          '**/*.sqlite*',
          '**/*.db*',
        ],
      },
    },
    plugins: [
      accountApiPlugin(),
      react(),
      tailwindcss(),
      VitePWA({
        registerType: 'prompt',
        includeAssets: ['icon.svg', 'apple-touch-icon.png'],
        manifest: {
          id: '/',
          name: 'One Day · 轻量规划',
          short_name: 'One Day',
          description: '按账号同步的个人待办与多维日历应用',
          lang: 'zh-CN',
          scope: '/',
          start_url: '/',
          display: 'standalone',
          background_color: '#ffffff',
          theme_color: '#1f1f1f',
          icons: [
            {
              src: 'pwa-192x192.png',
              sizes: '192x192',
              type: 'image/png',
              purpose: 'any',
            },
            {
              src: 'pwa-512x512.png',
              sizes: '512x512',
              type: 'image/png',
              purpose: 'any',
            },
            {
              src: 'pwa-maskable-512x512.png',
              sizes: '512x512',
              type: 'image/png',
              purpose: 'maskable',
            },
          ],
        },
        workbox: {
          navigateFallback: '/index.html',
          navigateFallbackDenylist: [/^\/api(?:\/|$)/],
          cleanupOutdatedCaches: true,
        },
      }),
    ],
    resolve: {
      alias: {
        '@': fileURLToPath(new URL('./src', import.meta.url)),
      },
    },
  };
});
