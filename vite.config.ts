import { defineConfig } from 'vitest/config';
import preact from '@preact/preset-vite';

export default defineConfig({
  base: '/trenirovki/',
  plugins: [preact()],
  test: { environment: 'node', include: ['tests/**/*.test.ts'] },
});
