// Vite and Vitest config: static build served from GitHub Pages under /dispatch/.
import { defineConfig } from 'vitest/config';

export default defineConfig({
  base: '/dispatch/',
  test: {
    include: ['tests/**/*.test.ts'],
  },
});
