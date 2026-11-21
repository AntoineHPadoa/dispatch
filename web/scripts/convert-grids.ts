/*
 * Convert the prototype "pose" grids (docs/archive/demo/grids-pose.json) to the §14 format (src/data/grids.json).
 * - Keeps the 11 pose grids (7 tutorial, 4 rated), drops the target-score grids.
 * - Price clues: the prototype publishes a value (N 0, B 1, C 1, G 2, T 5, import = neighbor price);
 *   §14 names the plant that sets the price. The plant is read from the reference solution; every
 *   ambiguous value and every clued column holding an import is reported.
 * - Level "none": exchange totals move from the inventory to an `exchanges` clue.
 * - Prints a conversion report on stdout; exits non-zero when a grid fails validation.
 *
 * Usage: npm run convert   (or: npx tsx scripts/convert-grids.ts [input] [output])
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  ANY_COUNTRY, IMPORT_PIECE, PIECE_IDS, assertGrid,
  type Clue, type Grid, type Inventory, type InventoryPieceSpec, type Neighbor, type PieceDef, type PieceId,
  type Placement,
} from '../src/model/grid';

const here = dirname(fileURLToPath(import.meta.url));
const input = resolve(process.argv[2] ?? resolve(here, '../../docs/archive/demo/grids-pose.json'));
const output = resolve(process.argv[3] ?? resolve(here, '../src/data/grids.json'));

/** Merit-order ranks of §3. */
const RANK: Record<PieceId, number> = { N: 1, B: 2, C: 3, G: 4, T: 5 };
/** The single prototype neighbor ("X", "Voisin") becomes Germany, as the tutorial texts say. */
const NEIGHBOR = { id: 'DE', name: 'Allemagne', co2: 3 };
const PROTO_NEIGHBOR = 'X';
const PROTO_ANY_COUNTRY = 'I';

/** Technique ids introduced by each tutorial grid (§11), keyed by prototype id. */
const TEACHES: Record<number, string[]> = {
  1: ['swap'],
  2: ['price_cap'],
  3: ['just_enough'],
  4: ['ribbon'],
  5: ['flow', 'column_sum'],
  6: ['top_price'],
  7: ['silhouette', 'record', 'program'],
};
/** Intros rewritten: price clues name a plant (not a value), and grid 8 shows its dam stock. */
const INTRO_OVERRIDE: Record<number, string> = {
  1: 'Pose toutes les centrales de l’inventaire, ni plus ni moins, en remplissant exactement la silhouette. '
    + 'Quand tu sais combien de cases de chaque centrale vont dans une colonne, l’ordre ne compte pas.',
  2: 'Nouveau : un prix publié par la bourse. Sous un prix publié, aucune case ne coûte plus cher que celles de cette centrale.',
  3: 'Nouveau : la ligne vers l’Allemagne. Touche une pastille sous un créneau pour exporter un bloc ; '
    + 'pose « Import » comme une centrale d’une case. '
    + 'S’il reste exactement autant de cases possibles que de cases à poser pour une centrale, toutes ces cases sont à elle.',
  5: 'Nouveau : un flux publié, qui fixe l’échange d’un créneau avec l’Allemagne. '
    + 'Une colonne a autant de cases que sa hauteur : connaissant les autres, on déduit celle qui reste.',
  8: 'Sans inventaire : tu connais les centrales disponibles, pas leurs quantités. '
    + 'Seul le stock d’eau du barrage est connu : 2 cases au plus. '
    + 'Les indices du marché suffisent à déduire la seule pose.',
  6: 'Un prix publié exige au moins une case de cette centrale dans la colonne : '
    + 's’il n’y a qu’une place possible, c’est elle.',
  7: 'Nouveau : une STEP (pompage ▲ puis turbinage ▼), un relevé de production RTE et le programme publié d’une centrale. '
    + 'Le pompage ▲ ajoute une case à couvrir, le turbinage ▼ en retire une.',
};

/** Player text uses the typographic apostrophe only. */
const typo = (s: string) => s.replace(/'/g, '’');

// ---- prototype shapes (only what the converter reads) ----------------------

interface ProtoPiece { len: number[]; price: number; co2: number; cap?: number }
interface ProtoNeighbor { name: string; price: number[]; cap: number; export_budget?: number; import?: boolean; export?: boolean }
interface ProtoBar { piece: string; row: number; col: number; len: number }
interface ProtoGrid {
  id: number;
  title: string;
  mode: string;
  section: string;
  intro?: string;
  columns: string[];
  residual: number[];
  pieces: Record<string, ProtoPiece>;
  neighbor?: ProtoNeighbor;
  step?: number;
  inventory: {
    level: string;
    pieces: Record<string, { bars?: number[]; cells?: number; count?: number }>;
    exports?: Record<string, number>;
    imports?: Record<string, number>;
    step?: number;
  };
  constraints?: { co2_cap?: number | null };
  clues: Array<Record<string, unknown> & { type: string }>;
  difficulty: { rating: 1 | 2 | 3 | 4; rating_label: string; techniques: Record<string, number> };
  solution: { exports: number[]; step: Array<{ pump: number; turbine: number }>; placements: ProtoBar[] };
}

const report: string[] = [];
const note = (g: ProtoGrid, m: string) => report.push(`- grid ${g.id} (${g.title}): ${m}`);

const country = (c: string) => (c === PROTO_NEIGHBOR ? NEIGHBOR.id : c === PROTO_ANY_COUNTRY ? ANY_COUNTRY : c);

function renameCountries(totals: Record<string, number> | undefined): Record<string, number> {
  const out: Record<string, number> = {};
  for (const [k, v] of Object.entries(totals ?? {})) out[country(k)] = v;
  return out;
}

/** Bars of the reference solution covering one column. */
function barsAt(g: ProtoGrid, col: number): ProtoBar[] {
  return g.solution.placements.filter((b) => col >= b.col && col < b.col + b.len);
}

/** False when the inventory forces zero imports (no neighbor price can then set a price). */
function importsAllowed(g: ProtoGrid): boolean {
  const imports = g.inventory.imports;
  return imports === undefined || Object.values(imports).some((v) => v > 0);
}

/** Price clue: value -> the plant that sets the price in the reference solution. */
function convertPrice(g: ProtoGrid, clue: { col: number; value: number }, available: PieceId[]): Clue {
  const { col, value } = clue;
  const label = g.columns[col];
  const candidates: string[] = available.filter((id) => g.pieces[id]?.price === value);
  if (g.neighbor?.import && g.neighbor.price[col] === value && importsAllowed(g)) candidates.push('import');
  const cells = barsAt(g, col);
  if (cells.some((b) => b.piece === 'I')) {
    note(g, `price clue at ${label} sits on a column with an import in the reference solution (§3 forbids it)`);
  }
  const plants = cells.filter((b) => b.piece !== 'I').map((b) => b.piece as PieceId);
  if (plants.length === 0) throw new Error(`grid ${g.id}: price clue at ${label} on a column without plant`);
  const setter = plants.reduce((a, b) => (RANK[b] > RANK[a] ? b : a));
  if (g.pieces[setter]?.price !== value) {
    throw new Error(`grid ${g.id}: price clue at ${label} (${value}) does not match the solution (${setter})`);
  }
  if (candidates.length > 1) {
    note(g, `price clue at ${label} = ${value} is ambiguous (${candidates.join(' or ')}): ${setter} taken from the `
      + 'solution; the converted clue is stronger than the original');
  }
  return { type: 'price', col, piece: setter };
}

function convertGrid(g: ProtoGrid): Grid {
  const n = g.columns.length;
  const level = g.inventory.level;
  if (level !== 'exact' && level !== 'none') throw new Error(`grid ${g.id}: unsupported level ${level}`);
  const nb = g.neighbor;
  if (nb && (!nb.import || !nb.export)) throw new Error(`grid ${g.id}: one-way neighbors are not supported`);
  const hasStep = (g.step ?? 0) > 0;
  if ((g.inventory.step ?? 0) > 0 && !hasStep) {
    throw new Error(`grid ${g.id}: inventory.step is ${g.inventory.step} but the grid has no step`);
  }

  // Pieces: only those of the inventory are available (the prototype refuses the others).
  const available = PIECE_IDS.filter((id) => g.inventory.pieces[id] !== undefined);
  const dropped = Object.keys(g.pieces).filter((id) => !available.includes(id as PieceId));
  if (dropped.length) note(g, `pieces not in the inventory dropped: ${dropped.join(', ')}`);
  const pieces: Partial<Record<PieceId, PieceDef>> = {};
  for (const id of available) {
    const p = g.pieces[id];
    if (!p) throw new Error(`grid ${g.id}: inventory piece ${id} has no definition`);
    pieces[id] = { len: p.len, height: [1], rank: RANK[id], co2: p.co2 };
  }

  // Inventory, and the exchanges clue at level none.
  const invPieces: Partial<Record<PieceId, InventoryPieceSpec>> = {};
  for (const id of available) {
    const spec = g.inventory.pieces[id] ?? {};
    const cap = g.pieces[id]?.cap;
    if (spec.count !== undefined) throw new Error(`grid ${g.id}: level "bars" is not supported`);
    if (level === 'exact') {
      invPieces[id] = spec.bars ? { bars: spec.bars } : { cells: spec.cells ?? 0 };
      const cells = spec.bars ? spec.bars.reduce((a, b) => a + b, 0) : spec.cells ?? 0;
      if (cap !== undefined && cells > cap) throw new Error(`grid ${g.id}: inventory of ${id} exceeds its cap`);
    } else {
      invPieces[id] = cap !== undefined ? { max_cells: cap } : {};
      if (cap !== undefined) note(g, `${id} cap ${cap} kept as inventory max_cells (stock known to the player)`);
    }
  }
  const inventory: Inventory = { level, pieces: invPieces };
  const clues: Clue[] = [];
  const totals = {
    exports: nb ? renameCountries(g.inventory.exports) : {},
    imports: nb ? renameCountries(g.inventory.imports) : {},
  };
  if (nb) {
    totals.exports[NEIGHBOR.id] ??= 0;
    if (totals.imports[ANY_COUNTRY] === undefined) totals.imports[NEIGHBOR.id] ??= 0;
  }
  const stepPairs = g.inventory.step ?? 0;
  if (hasStep && stepPairs !== g.step) throw new Error(`grid ${g.id}: STEP pairs differ from the inventory`);
  if (level === 'exact') {
    if (nb) { inventory.exports = totals.exports; inventory.imports = totals.imports; }
    if (hasStep) inventory.step = stepPairs;
  } else if (nb || hasStep) {
    clues.push({
      type: 'exchanges',
      ...(nb ? { exports: totals.exports, imports: totals.imports } : {}),
      ...(hasStep ? { step: stepPairs } : {}),
    });
  }
  if (nb?.export_budget !== undefined) {
    const total = Object.values(totals.exports).reduce((a, b) => a + b, 0);
    if (total > nb.export_budget) throw new Error(`grid ${g.id}: export total over the daily budget`);
  }

  // Clues, in the prototype order (the exchanges clue goes last).
  for (const cl of g.clues) {
    switch (cl.type) {
      case 'price':
        clues.push(convertPrice(g, cl as unknown as { col: number; value: number }, available));
        break;
      case 'bar':
        clues.push({ type: 'bar', piece: cl.piece as PieceId, col: cl.col as number, len: cl.len as number });
        break;
      case 'column': {
        const counts: Record<string, number> = {};
        for (const [k, v] of Object.entries(cl.counts as Record<string, number>)) {
          counts[k === 'I' ? `I:${NEIGHBOR.id}` : k] = v;
        }
        clues.push({ type: 'column', col: cl.col as number, counts });
        break;
      }
      case 'flow':
        clues.push({
          type: 'flow', col: cl.col as number, country: country(cl.country as string),
          dir: cl.dir as 'export' | 'import', value: cl.value as number,
        });
        break;
      case 'given':
        clues.push({
          type: 'engaged', piece: cl.piece as PieceId, row: cl.row as number, col: cl.col as number,
          len: cl.len as number,
        });
        break;
      default:
        throw new Error(`grid ${g.id}: unknown clue type ${cl.type}`);
    }
  }
  if (clues.length && clues[0]?.type === 'exchanges') clues.push(clues.shift() as Clue);

  const neighbors: Neighbor[] = nb ? [{ id: NEIGHBOR.id, name: NEIGHBOR.name, cap: nb.cap, co2: NEIGHBOR.co2 }] : [];
  const placements: Placement[] = g.solution.placements.map((b) =>
    b.piece === 'I'
      ? { piece: IMPORT_PIECE, country: NEIGHBOR.id, row: b.row, col: b.col, len: b.len }
      : { piece: b.piece as PieceId, row: b.row, col: b.col, len: b.len });

  const tutorial = g.section === 'Tutoriel';
  const intro = INTRO_OVERRIDE[g.id] ?? (g.intro ? typo(g.intro) : undefined);
  if (INTRO_OVERRIDE[g.id]) note(g, 'intro rewritten (tutorial wording, price clue names a plant, grid 8 states its dam stock, grid 7 explains STEP)');
  const grid: Grid = {
    id: g.id,
    title: typo(g.title),
    section: tutorial ? 'tutorial' : 'rated',
    ...(intro ? { intro } : {}),
    ...(tutorial && TEACHES[g.id] ? { teaches: TEACHES[g.id] } : {}),
    columns: g.columns,
    demand: g.residual.slice(),
    pieces,
    weather: { R: new Array<number>(n).fill(0), F: new Array<number>(n).fill(0) },
    neighbors,
    step: hasStep,
    co2_cap: g.constraints?.co2_cap ?? null,
    inventory,
    clues,
    solution: {
      exports: nb ? { [NEIGHBOR.id]: g.solution.exports.slice() } : {},
      step: g.solution.step.map((s) => ({ pump: s.pump, turbine: s.turbine })),
      placements,
    },
    difficulty: {
      rating: g.difficulty.rating,
      label: g.difficulty.rating_label,
      techniques: Object.keys(g.difficulty.techniques),
    },
  };
  return assertGrid(grid);
}

const proto = JSON.parse(readFileSync(input, 'utf8')) as ProtoGrid[];
const kept = proto.filter((g) => g.mode === 'pose');
const skipped = proto.filter((g) => g.mode !== 'pose').map((g) => `${g.id} (${g.title})`);
const grids = kept.map(convertGrid);
writeFileSync(output, `${JSON.stringify(grids, null, 2)}\n`);

console.log(`Converted ${grids.length} grids -> ${output}`);
console.log(`Skipped (not pose mode): ${skipped.join(', ') || 'none'}`);
console.log('Report:');
console.log(report.length ? report.join('\n') : '- nothing to report');
