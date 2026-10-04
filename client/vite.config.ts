import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [react(), tailwindcss(), VitePWA({
    registerType: 'prompt', injectRegister: false,
    includeAssets: ['icon.svg', 'icon-192.png', 'icon-512.png', 'apple-touch-icon.png'],
    manifest: {
      name: 'Connection — 함께 만나는 지도', short_name: 'Connection',
      description: '모임을 만들고 친구들과 위치를 공유하세요.',
      lang: 'ko', start_url: '/', scope: '/', display: 'standalone',
      theme_color: '#2563eb', background_color: '#eff6ff',
      icons: [
        { src: '/icon-192.png', sizes: '192x192', type: 'image/png' },
        { src: '/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any maskable' },
      ],
    },
    workbox: {
      navigateFallback: '/index.html', navigateFallbackDenylist: [/^\/api(?:\/|$)/, /^\/socket\.io(?:\/|$)/],
      globPatterns: ['**/*.{js,css,html,png,svg,woff2}'],
      // Only the application shell is cached. Live positions and map tiles are never cached.
      runtimeCaching: [],
    },
  })],
  server: {
    host: '127.0.0.1',
    proxy: {
      '/api': 'http://127.0.0.1:3001',
      '/socket.io': { target: 'ws://127.0.0.1:3001', ws: true },
    },
  },
});
