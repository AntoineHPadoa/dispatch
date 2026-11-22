/*
 * Drawings of the home screen (inline SVG strings).
 * - logoSvg(): the Dispatch mark, a D of four stacked plant bars in their original colours.
 * - siteHead(): header shared by the home, dossier and game pages (logo, name, optional right slot).
 * - sheetSilhouette(): the demand silhouette of the sheet of the day with the sky of each slot
 *   and the cell that sets the price; once finished, the solution in plant colours (STEP included,
 *   a coal ramp as one outline).
 * - miniSilhouette(): the small demand outline of a previous sheet or a dossier.
 * - cellSilhouette(): the demand drawn as small cells (dossier cards).
 * Colours come from app.css (`.sil-cell`, `.mini-sil`).
 */
import type { Grid, WeatherKind } from '../model/grid';
import { cellsOf, isRamp, kindOf, profileOf } from '../model/shapes';
import { roundedPath, skyline } from './board';
import { UI } from '../i18n/fr';
import { PIECE_COLORS, colorKey, esc } from './palette';

/** Header shared by the home, dossier and game pages: logo and name, a link to the home; `right` is an optional slot. */
export function siteHead(right = ''): string {
  return `<header class="site-head"><a class="brand" href="#/" aria-label="${esc(UI.bulletin.logoLabel)}">${logoSvg(36)}<span class="wm">${esc(UI.appName)}</span></a>${right}</header>`;
}

const SKY_STROKE = '#9a929c';

/** Four rounded bars, top to bottom: TAC, gas, gas, nuclear. */
export function logoSvg(size: number): string {
  const bars: Array<[number, 'T' | 'G' | 'N']> = [[34, 'T'], [50, 'G'], [50, 'G'], [34, 'N']];
  const rects = bars.map(([w, p], i) =>
    `<rect x="4" y="${3 + i * 14.5}" width="${w}" height="12.5" rx="6.25" fill="${PIECE_COLORS[p].a}"/>`).join('');
  return `<svg class="logo" width="${size}" height="${size}" viewBox="0 0 60 60" aria-hidden="true">${rects}</svg>`;
}

const SKY_PATHS: Record<WeatherKind, string> = {
  sun: '<circle cx="10" cy="10" r="3.5"/><path d="M10 2.5v2M10 15.5v2M2.5 10h2M15.5 10h2M4.7 4.7l1.4 1.4M13.9 13.9l1.4 1.4M4.7 15.3l1.4-1.4M13.9 6.1l1.4-1.4"/>',
  moon: '<path d="M15 12.5A6 6 0 0 1 7.5 5a6 6 0 1 0 7.5 7.5z"/>',
  cloud: '<path d="M5 14a4 4 0 0 1 .5-8 5 5 0 0 1 9.5 1.5A3.3 3.3 0 0 1 15 14z"/>',
  wind: '<path d="M3 8h9a2.5 2.5 0 1 0-2.5-2.5M3 12h12a2.5 2.5 0 1 1-2.5 2.5"/>',
};

/** Row (from the bottom) of the top cell of the first price clue's column, or null. */
function priceCell(grid: Grid): [number, number] | null {
  const clue = grid.clues.find((c) => c.type === 'price');
  if (!clue || clue.type !== 'price') return null;
  const h = grid.demand[clue.col] ?? 0;
  return h > 0 ? [clue.col, h - 1] : null;
}

/**
 * Silhouette of the sheet of the day, one sky icon per slot above, slot labels below.
 * Open sheet: the demand cell by cell, the price cell in pink. Finished sheet: the solution, every laid
 * rectangle in its plant colour; exported cells keep a dashed outline, as on the board.
 */
export function sheetSilhouette(grid: Grid, weather: readonly WeatherKind[], labelFor: (k: WeatherKind) => string, label: string, done = false): string {
  const solved = done && grid.solution ? grid.solution : null;
  const cell = 40, top = 30, n = grid.demand.length;
  const heights = grid.demand.map((d, c) => d + Object.values(solved?.exports ?? {}).reduce((a, e) => a + (e[c] ?? 0), 0)
    + (solved?.step ?? []).reduce((a, q) => a + (q.pump === c ? 1 : 0) - (q.turbine === c ? 1 : 0), 0));
  const rows = Math.max(1, ...heights, ...(solved?.placements ?? []).flatMap((p) => cellsOf(grid, p).map(([r]) => r + 1)));
  const w = n * cell, hBars = rows * cell, h = top + hBars + 18;
  const hi = solved ? null : priceCell(grid);
  let s = `<svg class="sil" viewBox="0 0 ${w} ${h}" role="img" aria-label="${esc(label)}">`;
  weather.forEach((k, i) => {
    s += `<g transform="translate(${i * cell + cell / 2 - 9} 6)" fill="none" stroke="${SKY_STROKE}" stroke-width="1.7" stroke-linecap="round"><title>${esc(labelFor(k))}</title>${SKY_PATHS[k]}</g>`;
  });
  heights.forEach((d, c) => {
    for (let r = 0; r < d; r++) {
      const on = hi !== null && hi[0] === c && hi[1] === r;
      s += `<rect x="${c * cell + 1.5}" y="${top + (rows - 1 - r) * cell + 1.5}" width="${cell - 3}" height="${cell - 3}" rx="5" `
        + `class="sil-cell${on ? ' price' : ''}"/>`;
    }
  });
  for (const p of solved?.placements ?? []) {
    const hh = p.height ?? 1;
    const col = PIECE_COLORS[colorKey(p.piece)];
    if (isRamp(kindOf(grid, p))) {
      // A coal ramp: one outline following its profile (plateau above the base row).
      const d = roundedPath(skyline(p.col * cell, top + (rows - p.row) * cell, profileOf(grid, p).map(([b, h]) => b + h), cell, 3), 8);
      s += `<path class="sil-piece" d="${d}" fill="${col.a}" stroke="${col.ink}" stroke-width="1.5"/>`;
      continue;
    }
    s += `<rect class="sil-piece" x="${p.col * cell + 1.5}" y="${top + (rows - p.row - hh) * cell + 1.5}" width="${p.len * cell - 3}" height="${hh * cell - 3}" rx="8" fill="${col.a}" stroke="${col.ink}" stroke-width="1.5"/>`;
  }
  // Exports and pumping raise the silhouette above the demand, stacked as on the board: pumped cells on top
  // (blue dashed outline), exported cells under them (violet dashed outline).
  const dashed = (c: number, r: number, cls: string, ink: string) =>
    `<rect class="${cls}" x="${c * cell + 4}" y="${top + (rows - 1 - r) * cell + 4}" width="${cell - 8}" height="${cell - 8}" rx="5" fill="none" stroke="${ink}" stroke-width="1.6" stroke-dasharray="4 3"/>`;
  heights.forEach((h, c) => {
    const out = Object.values(solved?.exports ?? {}).reduce((a, e) => a + (e[c] ?? 0), 0);
    const pumped = (solved?.step ?? []).filter((q) => q.pump === c).length;
    for (let r = h - pumped - out; r < h - pumped; r++) s += dashed(c, r, 'sil-export', PIECE_COLORS.I.ink);
    for (let r = h - pumped; r < h; r++) s += dashed(c, r, 'sil-pump', PIECE_COLORS.B.ink);
  });
  grid.columns.forEach((t, i) => {
    s += `<text x="${(i + 0.5) * cell}" y="${top + hBars + 14}" text-anchor="middle" font-family="Manrope, sans-serif" font-size="12" font-weight="700" fill="#8f8593">${esc(t)}</text>`;
  });
  return `${s}</svg>`;
}

/** Small stepped outline of a demand curve. */
export function miniSilhouette(demand: readonly number[], w: number, h: number, done: boolean): string {
  const cw = w / demand.length, ch = h / Math.max(8, ...demand);
  let d = `M0 ${h}`;
  demand.forEach((v, i) => { d += ` L${i * cw} ${h - v * ch} L${(i + 1) * cw} ${h - v * ch}`; });
  return `<svg class="mini-sil" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" aria-hidden="true"><path d="${d} L${w} ${h} Z" class="${done ? 'done' : ''}"/></svg>`;
}

/** Demand curve drawn as small cells (dossier cards); colours come from app.css (`.sil-cell`). */
export function cellSilhouette(demand: readonly number[], cell: number): string {
  const rows = Math.max(1, ...demand);
  const w = demand.length * cell, h = rows * cell;
  let s = `<svg class="cell-sil" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" aria-hidden="true">`;
  demand.forEach((d, c) => {
    for (let r = 0; r < d; r++) s += `<rect x="${c * cell + 1}" y="${(rows - 1 - r) * cell + 1}" width="${cell - 2}" height="${cell - 2}" rx="${cell / 5}" class="sil-cell"/>`;
  });
  return `${s}</svg>`;
}
