import { defineConfig } from 'vitest/config';
import preact from '@preact/preset-vite';
import pkg from './package.json' with { type: 'json' };

export default defineConfig({
  base: '/trenirovki/',
  plugins: [preact()],
  define: { __APP_VERSION__: JSON.stringify(pkg.version) },
  test: { environment: 'node', include: ['tests/**/*.test.ts'] },
});
