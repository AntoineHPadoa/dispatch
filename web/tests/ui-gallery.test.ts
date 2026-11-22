/*
 * Gallery grids (scripts/ui-gallery/grids.json): fictitious §14 grids used only by the UI gallery build.
 * - Each passes validateGrid(); none can be mistaken for a published grid (own ids, "Galerie" titles,
 *   no bulletin, so never a daily sheet).
 */
import { describe, expect, it } from 'vitest';
import galleryJson from '../scripts/ui-gallery/grids.json';
import gridsJson from '../src/data/grids.json';
import { validateGrid, type Grid } from '../src/model/grid';

const gallery = galleryJson as unknown as Grid[];
const published = gridsJson as unknown as Grid[];

describe('ui gallery grids', () => {
  it('pass validateGrid()', () => {
    for (const g of gallery) expect(validateGrid(g).errors, `grid ${g.id}`).toEqual([]);
  });

  it('are told apart from the published grids', () => {
    const ids = new Set(published.map((g) => g.id));
    for (const g of gallery) {
      expect(ids.has(g.id), `id ${g.id}`).toBe(false);
      expect(g.title.startsWith('Galerie · ')).toBe(true);
      expect(g.bulletin).toBeUndefined();
      expect(g.section).toBe('rated');
    }
  });
});
