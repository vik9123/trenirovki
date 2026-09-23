import { defineConfig } from 'vitest/config';
import preact from '@preact/preset-vite';
import { VitePWA } from 'vite-plugin-pwa';
import pkg from './package.json' with { type: 'json' };

export default defineConfig({
  base: '/trenirovki/',
  plugins: [
    preact(),
    VitePWA({
      registerType: 'autoUpdate',
      injectRegister: 'auto',
      includeAssets: ['favicon.png', 'apple-touch-icon.png'],
      manifest: {
        name: 'Журнал тренировок',
        short_name: 'Тренировки',
        description: 'Дневник тренировок: сплит верх/низ, тяжёлый и лёгкий день',
        lang: 'ru',
        start_url: '/trenirovki/',
        scope: '/trenirovki/',
        display: 'standalone',
        orientation: 'portrait',
        background_color: '#0e1012',
        theme_color: '#0e1012',
        icons: [
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,png,svg}'],
        navigateFallback: '/trenirovki/index.html',
      },
    }),
  ],
  define: { __APP_VERSION__: JSON.stringify(pkg.version) },
  test: { environment: 'node', include: ['tests/**/*.test.ts'] },
});
