/*
 * Print sheets (style B): one grid per A4 page, in colour, without the answer.
 * - Full rectangle at the maximum height, a thick line for the demand; slot clues in one band under
 *   the hours, as on screen (programme range as a thin bar under the rectangle), and listed in short
 *   text under the board; weather, engaged plants and published flows inside; order book or
 *   available plants; day clues; boxes for exchanges.
 * - No clue status and no pumping or turbining drawn: the paper only shows the puzzle.
 * - Exchanges imposed by an exact inventory are listed with the day clues (market publications).
 */
import type { Grid } from '../model/grid';
import { TECHNIQUES, UI, slotClueShort } from '../i18n/fr';
import { bandPlan, boardGeometry, renderBoard } from './board';
import { bulletinTag, displayTitle, initialState } from './game';
import { clueItem, co2RuleText, inventoryExchanges, isDayClue, renderBook } from './panels';
import { esc } from './palette';

/** Cell size that keeps the grid inside the printable width and height of an A4 page. */
export function printCell(grid: Grid): number {
  // Printable width is about 680 CSS px; keep the board within about 620 px of height.
  const n = grid.columns.length;
  const rows = boardGeometry(grid, 'B', 1).rows;
  // Under the rectangle: hours, the slot-clue band (its height depends on the cell, so two passes), the rows of boxes.
  const fit = (band: number) => {
    const below = 3 + grid.neighbors.length + (grid.step ? 1 : 0) + band / 48;
    return Math.max(26, Math.min(64, Math.floor(660 / n), Math.floor(620 / (rows + below))));
  };
  // Second pass: the band height depends on the cell size, so re-estimate it with the first result.
  return fit(bandPlan(grid, fit(bandPlan(grid, 48, 'B').height), 'B').height);
}

export function renderSheet(grid: Grid, tutorialIndex: number | null): string {
  // Paper shows the imposed plants only: engaged bars and no exports drawn on the grid.
  const state = { ...initialState(grid), step: [] };
  const board = renderBoard({ grid, state, ev: null, style: 'B', cell: printCell(grid) }).svg;
  const techniques = (grid.teaches ?? []).map((t) => TECHNIQUES[t]).filter(Boolean);
  const lead = grid.intro
    ? `<p class="lead">${techniques.length ? `<b>${esc(techniques.map((t) => t!.name).join(' · '))}.</b> ` : ''}${esc(grid.intro)}</p>` : '';
  const meta = tutorialIndex !== null ? `${UI.tutorialShort(tutorialIndex)} · ${grid.difficulty.label}`
    : `${bulletinTag(grid) ?? UI.ratedEyebrow} · ${grid.difficulty.label}`;
  const day = grid.clues.filter(isDayClue).map((c) => clueItem(grid, c, null, true));
  const exchanges = inventoryExchanges(grid);
  if (exchanges) day.unshift(clueItem(grid, exchanges, null, true));
  const co2 = co2RuleText(grid);
  if (co2) day.push(`<li class="clue"><span><span class="kind">${esc(UI.co2Kind)}</span><span class="txt">${esc(co2)}</span></span></li>`);
  const bookTitle = grid.inventory.level === 'exact' ? UI.book : UI.available;
  const dayTitle = grid.clues.some((c) => c.type === 'length' || c.type === 'exchanges') || exchanges || co2 ? UI.dayClues : UI.engagedTitle;
  const foot = grid.step && grid.neighbors.length ? UI.printFootBoth
    : grid.step ? UI.printFootStep : grid.neighbors.length ? UI.printFootExports : UI.printFoot;
  return `<article class="a4">
    <div class="meta"><h1>${esc(displayTitle(grid))}</h1><span>${esc(meta)}</span></div>
    ${lead}
    <div class="sheet-grid">${board}</div>
    ${slotLegend(grid)}
    <div class="cols2"><div><div class="sec">${esc(bookTitle)}</div>${renderBook(grid, state, null, true)}</div>
      ${day.length ? `<div><div class="sec">${esc(dayTitle)}</div><ul class="clues">${day.join('')}</ul></div>` : '<div></div>'}</div>
    <div class="foot"><span>${esc(foot)}</span><span>${esc(UI.printId(grid.bulletin?.number ?? grid.id))}</span></div>
  </article>`;
}

/** The clues drawn on the grid, in short text by slot, so the sheet reads without the screen. */
export function slotLegend(grid: Grid): string {
  const slot = grid.clues.filter((c) => !isDayClue(c));
  if (!slot.length) return '';
  const col = (c: (typeof slot)[number]) => ('col' in c ? c.col : 0);
  const items = [...slot].sort((a, b) => col(a) - col(b)).map((c) => `<li>${esc(slotClueShort(grid, c))}</li>`);
  return `<div class="legend"><div class="sec">${esc(UI.printLegend)}</div><ul>${items.join('')}</ul></div>`;
}

/** Sheets for several grids, tutorials numbered in order. */
export function renderSheets(grids: readonly Grid[], all: readonly Grid[]): string {
  const tutorials = all.filter((g) => g.section === 'tutorial').sort((a, b) => a.id - b.id);
  return grids.map((g) => {
    const k = tutorials.findIndex((t) => t.id === g.id);
    return renderSheet(g, k >= 0 ? k + 1 : null);
  }).join('');
}
