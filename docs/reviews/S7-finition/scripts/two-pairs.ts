// Renders G7 as a 2-pair STEP grid (inventory.step = 2) to an HTML page: tags at cell 50 and 34, arrows for the 2nd pair.
// Usage (from web/): npx tsx ../docs/reviews/S7-finition/scripts/two-pairs.ts <out.html>
import fs from 'fs';
import gridsJson from '../../../../web/src/data/grids.json';
import type { Grid } from '../../../../web/src/model/grid';
import { renderBoard } from '../../../../web/src/ui/board';
import { initialState } from '../../../../web/src/ui/game';

const g7 = structuredClone((gridsJson as unknown as Grid[]).find((g) => g.id === 7)!);
const multi = { ...g7, inventory: { ...g7.inventory, step: 2 } } as Grid;
const cases: [string, { pump: number; turbine: number }[], number, boolean][] = [
  ['2 paires distinctes, cell 50', [{ pump: 1, turbine: 3 }, { pump: 3, turbine: 5 }], 50, false],
  ['2 paires, même pompage, cell 50', [{ pump: 1, turbine: 3 }, { pump: 1, turbine: 5 }], 50, false],
  ['2 paires distinctes, cell 34 (compact)', [{ pump: 1, turbine: 3 }, { pump: 3, turbine: 5 }], 34, false],
  ['2 paires, même pompage, cell 34 (compact)', [{ pump: 1, turbine: 3 }, { pump: 1, turbine: 5 }], 34, false],
  ['mode STEP, 1 paire posée : flèches de la 2e', [{ pump: 1, turbine: 3 }], 50, true],
];
let body = '';
for (const [title, step, cell, stepMode] of cases) {
  const svg = renderBoard({ grid: multi, state: { ...initialState(multi), step }, ev: null, style: 'A', cell, stepMode, interactive: stepMode }).svg;
  body += `<section><h3>${title}</h3>${svg}</section>`;
}
fs.writeFileSync(process.argv[2]!, `<!doctype html><meta charset="utf-8"><body style="font:13px system-ui;background:#fbf8fa;padding:12px">${body}</body>`);
