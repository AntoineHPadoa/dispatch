// Runs validateGrid (branch and main versions) on a JSON list of grids; prints one JSON line per grid.
import { readFileSync } from 'node:fs';
import { validateGrid as vBranch } from '../../../web/src/model/grid';
// main's grid.ts, extracted with: git show main:web/src/model/grid.ts > web/src/model/grid_main.tmp.ts
import { validateGrid as vMain } from '../../../web/src/model/grid_main.tmp';
const grids = JSON.parse(readFileSync(process.argv[2], 'utf8')) as unknown[];
for (const g of grids) console.log(JSON.stringify({ branch: vBranch(g).errors, main: vMain(g).errors }));
