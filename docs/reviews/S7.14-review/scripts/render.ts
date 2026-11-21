// Renders board SVGs (screen style A) outside the app, for states the Chrome check cannot reach by taps.
// - Every published grid, solved (every clue verified, ticks drawn) and initial, at cells 30..60.
// - G7 STEP: pending pump and laid pair with the STEP mode reopened (arrows stacked over the tags).
// - Usage (from web/): npx tsx ../docs/reviews/S7.14-review/scripts/render.ts > out.json
import grids from '../../../../web/src/data/grids.json';
import type { Grid } from '../../../../web/src/model/grid';
import { evaluate, solutionState, type PlayState } from '../../../../web/src/engine';
import { renderBoard } from '../../../../web/src/ui/board';
import { initialState } from '../../../../web/src/ui/game';

const all = ((grids as unknown as { grids?: Grid[] }).grids ?? (grids as unknown as Grid[]));
const out: { name: string; svg: string }[] = [];
const draw = (name: string, g: Grid, state: PlayState, cell: number, extra: Record<string, unknown> = {}) =>
  out.push({ name, svg: renderBoard({ grid: g, state, ev: evaluate(g, state), style: 'A', cell, interactive: true, ...extra }).svg });

for (const g of all) {
  for (const cell of [30, 34, 38, 42, 46, 50, 54, 60]) {
    draw(`G${g.id} solved cell ${cell}`, g, solutionState(g), cell);
    draw(`G${g.id} initial cell ${cell}`, g, initialState(g), cell);
  }
}
// G7: the solution's STEP pair laid, then STEP mode reopened (arrow over a pump/turbine tag).
const g7 = all.find((g) => g.id === 7)!;
for (const cell of [30, 38, 46, 54, 60]) {
  const sol = solutionState(g7);
  draw(`G7 solved + STEP mode cell ${cell}`, g7, sol, cell, { stepMode: true });
  const pair = sol.step[0];
  if (pair) draw(`G7 solved + STEP mode, pending pump on the turbine slot cell ${cell}`, g7, sol, cell, { stepMode: true, stepPending: pair.turbine });
}
process.stdout.write(JSON.stringify(out));
