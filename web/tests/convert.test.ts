/*
 * Prototype -> §14 converter: tutorial intros and technique tags belong to the prototype's own
 * grids, never to a generated grid that happens to share an id.
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { convertGrid } from '../scripts/convert-grids';

type Proto = Parameters<typeof convertGrid>[0];
const proto = JSON.parse(readFileSync(resolve(__dirname, '../../docs/archive/demo/grids-pose.json'), 'utf8')) as Proto[];
const find = (id: number) => structuredClone(proto.find((g) => g.id === id && g.mode === 'pose')!);

/** A generated grid: a prototype body re-labelled with a clashing id, in the rated section, no intro. */
function generated(id: number, from = 9): Proto {
  const g = find(from);
  return { ...g, id, section: 'Grilles', title: `Pose ${id}`, intro: undefined } as Proto;
}

describe('convertGrid', () => {
  it('keeps the tutorial intro and teaches of the prototype tutorial 1', () => {
    const g = convertGrid(find(1));
    expect(g.section).toBe('tutorial');
    expect(g.intro).toMatch(/^Pose toutes les centrales/);
    expect(g.teaches).toEqual(['swap']);
  });

  it('keeps the rewritten intro of the prototype rated grid 8', () => {
    expect(convertGrid(find(8)).intro).toMatch(/^Sans inventaire/);
  });

  it.each([1, 3, 7, 8])('gives no intro and no teaches to a generated grid with id %i', (id) => {
    const g = convertGrid(generated(id));
    expect(g.section).toBe('rated');
    expect(g.intro).toBeUndefined();
    expect(g.teaches).toBeUndefined();
  });

  it('keeps the intro a generated grid brings itself, with the typographic apostrophe', () => {
    const g = convertGrid({ ...generated(1), intro: "Aujourd'hui" } as Proto);
    expect(g.intro).toBe('Aujourd’hui');
  });
});
