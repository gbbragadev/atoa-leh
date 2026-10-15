import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [react(), VitePWA({
    registerType: 'prompt',
    injectRegister: false,
    includeAssets: ['icon.svg', 'icons/*.png', 'images/cantinho-v2.png', 'presente/*.json'],
    manifest: {
      name: 'À toa, Leh — seu cantinho, sem pressa', short_name: 'À toa, Leh',
      description: 'Um presente do Guilherme para a Letícia. Brincadeiras sem pressa.',
      theme_color: '#f7f4ec', background_color: '#f7f4ec',
      display: 'standalone', orientation: 'any', start_url: '/', scope: '/', lang: 'pt-BR',
      icons: [
        { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
        { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
        { src: '/icons/maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
      ],
    },
    workbox: { globPatterns: ['**/*.{js,css,html,png,svg,webp,woff2}'], globIgnores: ['images/cantinho.png'], maximumFileSizeToCacheInBytes: 5 * 1024 * 1024 },
  })],
});
