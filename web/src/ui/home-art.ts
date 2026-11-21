/*
 * Drawings of the home screen (inline SVG strings).
 * - logoSvg(): the Dispatch mark, a D of four stacked plant bars in their original colours.
 * - sheetSilhouette(): the demand silhouette of the sheet of the day with the sky of each slot
 *   and the cell that sets the price in the accent colour.
 * - miniSilhouette(): the small demand outline of a previous sheet or a dossier.
 */
import type { Grid, WeatherKind } from '../model/grid';
import { PIECE_COLORS, esc } from './palette';

/** Accent of the home screen (the only one) and its tints. */
export const HOME_ACCENT = '#c45c7c';
const GRID_STROKE = '#eadfe6';
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

/** Demand silhouette, cell by cell, one sky icon per slot above, slot labels below. */
export function sheetSilhouette(grid: Grid, weather: readonly WeatherKind[], labelFor: (k: WeatherKind) => string): string {
  const cell = 40, top = 30, rows = Math.max(...grid.demand), n = grid.demand.length;
  const w = n * cell, hBars = rows * cell, h = top + hBars + 18;
  const hi = priceCell(grid);
  let s = `<svg class="sil" viewBox="0 0 ${w} ${h}" role="img" aria-label="${esc(grid.demand.join(' '))}">`;
  weather.forEach((k, i) => {
    s += `<g transform="translate(${i * cell + cell / 2 - 9} 6)" fill="none" stroke="${SKY_STROKE}" stroke-width="1.7" stroke-linecap="round"><title>${esc(labelFor(k))}</title>${SKY_PATHS[k]}</g>`;
  });
  grid.demand.forEach((d, c) => {
    for (let r = 0; r < d; r++) {
      const on = hi !== null && hi[0] === c && hi[1] === r;
      s += `<rect x="${c * cell + 1.5}" y="${top + (rows - 1 - r) * cell + 1.5}" width="${cell - 3}" height="${cell - 3}" rx="5" `
        + (on ? `fill="${HOME_ACCENT}" fill-opacity=".8"` : `fill="#fff" stroke="${GRID_STROKE}"`) + '/>';
    }
  });
  grid.columns.forEach((t, i) => {
    s += `<text x="${(i + 0.5) * cell}" y="${top + hBars + 14}" text-anchor="middle" font-family="Manrope, sans-serif" font-size="12" font-weight="700" fill="#8f8593">${esc(t)}</text>`;
  });
  return `${s}</svg>`;
}

/** Small stepped outline of a demand curve. */
export function miniSilhouette(demand: readonly number[], w: number, h: number, fill: string): string {
  const cw = w / demand.length, ch = h / Math.max(8, ...demand);
  let d = `M0 ${h}`;
  demand.forEach((v, i) => { d += ` L${i * cw} ${h - v * ch} L${(i + 1) * cw} ${h - v * ch}`; });
  return `<svg class="mini-sil" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" aria-hidden="true"><path d="${d} L${w} ${h} Z" fill="${fill}"/></svg>`;
}
