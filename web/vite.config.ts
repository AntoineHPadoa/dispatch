// Vite and Vitest config: static build served from GitHub Pages under /dispatch/.
// The lab (lab.html) only runs on the dev server, which proxies /api to the local lab server;
// the build takes index.html alone, so the lab never reaches the published site.
import { defineConfig } from 'vitest/config';

export default defineConfig({
  base: '/dispatch/',
  server: {
    proxy: { '/dispatch/api': { target: 'http://127.0.0.1:8765', rewrite: (p) => p.replace(/^\/dispatch/, '') } },
  },
  test: {
    include: ['tests/**/*.test.ts'],
  },
});
