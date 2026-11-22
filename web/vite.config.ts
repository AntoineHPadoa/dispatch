// Vite and Vitest config: static build served from GitHub Pages under /dispatch/.
// The lab (lab.html) only runs on the dev server, which proxies /api to the local lab server;
// the build takes index.html alone, so the lab never reaches the published site.
// Gallery build (scripts/ui-gallery.mjs): DISPATCH_GRIDS=<grids file> swaps src/data/grids.json for that
// file, freezes "today" (scripts/ui-gallery/bulletin.ts) so no bulletin is hidden, and builds to
// dist-gallery/. Without the variable the config, and so the published build, is unchanged.
import { resolve } from 'node:path';
import { defineConfig, type Plugin } from 'vitest/config';

const galleryGrids = process.env.DISPATCH_GRIDS ? resolve(process.env.DISPATCH_GRIDS) : null;

/** Gallery build: resolves the published grids and the bulletin day to the gallery copies. */
function galleryPlugin(grids: string): Plugin {
  const realGrids = resolve(__dirname, 'src/data/grids.json');
  const realBulletin = resolve(__dirname, 'src/model/bulletin.ts');
  const shim = resolve(__dirname, 'scripts/ui-gallery/bulletin.ts');
  return {
    name: 'dispatch-gallery',
    enforce: 'pre',
    async resolveId(source, importer, options) {
      if (!importer || importer === shim) return null;
      const hit = await this.resolve(source, importer, { ...options, skipSelf: true });
      if (hit?.id === realGrids) return grids;
      if (hit?.id === realBulletin) return shim;
      return null;
    },
  };
}

export default defineConfig({
  base: '/dispatch/',
  ...(galleryGrids ? { plugins: [galleryPlugin(galleryGrids)], build: { outDir: 'dist-gallery', emptyOutDir: true } } : {}),
  server: {
    proxy: { '/dispatch/api': { target: 'http://127.0.0.1:8765', rewrite: (p) => p.replace(/^\/dispatch/, '') } },
  },
  test: {
    include: ['tests/**/*.test.ts'],
  },
});
