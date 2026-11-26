/*
 * Pure UI logic: laying gestures (drag, two taps, shape constraints), undo history, saved
 * progress (parsing, status, storage failures), grid of the day and play order, board geometry.
 */
import { describe, expect, it } from 'vitest';
import gridsJson from '../src/data/grids.json';
import { gridById } from './legacy';
import type { Grid } from '../src/model/grid';
import { evaluate, newGame, place, rawSilhouette, solutionState, type PlayState } from '../src/engine';
import {
  alongShape, cancel, idle, isFlat, isSingleCell, moveCursor, moveTo, press, previewRect, rectBetween, release, tap, type Shape,
} from '../src/ui/gesture';
import { canUndo, MAX_PAST, push, reset, start, undo } from '../src/ui/history';
import {
  ProgressStore, STORAGE_KEY, emptyProgress, isPlayState, nextGrid, parseProgress,
  playOrder, recordState, statusOf, gridFingerprint, savedBoard, type KeyValueStore,
} from '../src/ui/progress';
import { allowedExchange, bandPlan, bandStart, hoursGap, boardLead, recordLayout, boardGeometry, cellAt, lockedExports, maxStepPairs, renderBoard, stepTagLabels } from '../src/ui/board';
import {
  applyLockedExports, boardMessage, bulletinTag, displayTitle, exportTap, initialState, isInitialState, newlyBroken, nextExportValue,
  poseMessage,
} from '../src/ui/game';
import { MSG, PIECE_WORDS, TUTORIAL_LORE, durationText, groupSubject } from '../src/i18n/fr';
import { STEP_KEY, bookEntries, clueItem, inventoryExchanges, isDayClue, orderClues, withInventoryExchanges, publishedStepPairs, renderBook, renderChips, renderClues, renderCo2, richClueText, shownClueCount, splitExchanges, exchangeLines, co2Costs } from '../src/ui/panels';
import { esc } from '../src/ui/palette';
import { renderSheet, slotLegend } from '../src/ui/print';
import { OK, PIECE_COLORS } from '../src/ui/palette';
import { stepArrowAction, stepEraseResult, stepPairIndexAt, stepTapResult, stepUndoPlan } from '../src/ui/step';
import { UI } from '../src/i18n/fr';
import { currentBulletin } from '../src/model/bulletin';

const grids = gridsJson as unknown as Grid[];
const byId = gridById;

const BAR: Shape = { lens: [3, 4, 5, 6], heights: [1] };
const CELL: Shape = { lens: [1], heights: [1] };
const TALL: Shape = { lens: [1], heights: [2, 3] };
const RECT: Shape = { lens: [2, 3], heights: [1, 2] };

describe('gestures', () => {
  it('a drag along a row gives the bar between start and end cells', () => {
    let g = press(idle(), { row: 1, col: 4 });
    g = moveTo(g, { row: 1, col: 2 });
    const r = release(g, { row: 1, col: 1 }, BAR);
    expect(r.commit).toEqual({ row: 1, col: 1, len: 4, height: 1 });
    expect(r.state.drag).toBeNull();
    expect(r.state.anchor).toBeNull();
  });

  it('a flat piece stays on the start row when the drag drifts', () => {
    expect(rectBetween({ row: 2, col: 0 }, { row: 4, col: 3 }, BAR)).toEqual({ row: 2, col: 0, len: 4, height: 1 });
  });

  it('a one-slot piece stays in the start column; a tall piece spans rows', () => {
    expect(rectBetween({ row: 0, col: 3 }, { row: 2, col: 5 }, TALL)).toEqual({ row: 0, col: 3, len: 1, height: 3 });
    expect(rectBetween({ row: 3, col: 4 }, { row: 2, col: 2 }, RECT)).toEqual({ row: 2, col: 2, len: 3, height: 2 });
  });

  it('two taps: the first sets the anchor, the second lays the bar', () => {
    const first = release(press(idle(), { row: 0, col: 1 }), { row: 0, col: 1 }, BAR);
    expect(first.commit).toBeNull();
    expect(first.state.anchor).toEqual({ row: 0, col: 1 });
    const second = release(press(first.state, { row: 0, col: 4 }), { row: 0, col: 4 }, BAR);
    expect(second.commit).toEqual({ row: 0, col: 1, len: 4, height: 1 });
    expect(second.state.anchor).toBeNull();
  });

  it('a one-cell-only piece is laid on the first tap', () => {
    expect(isSingleCell(CELL)).toBe(true);
    expect(isSingleCell(TALL)).toBe(false);
    expect(tap(idle(), { row: 2, col: 3 }, CELL).commit).toEqual({ row: 2, col: 3, len: 1, height: 1 });
  });

  it('keyboard taps work like touches; cancel forgets the anchor', () => {
    const a = tap(idle(), { row: 0, col: 0 }, BAR);
    expect(cancel(a.state).anchor).toBeNull();
    expect(tap(a.state, { row: 0, col: 2 }, BAR).commit).toEqual({ row: 0, col: 0, len: 3, height: 1 });
  });

  it('preview: the drag in progress, or the anchor to the hovered cell, never the lone anchor', () => {
    let g = press(idle(), { row: 0, col: 0 });
    expect(previewRect(g, BAR)).toBeNull();
    expect(previewRect(g, CELL)).toEqual({ row: 0, col: 0, len: 1, height: 1 });
    g = moveTo(g, { row: 0, col: 2 });
    expect(previewRect(g, BAR)).toEqual({ row: 0, col: 0, len: 3, height: 1 });
    const anchored = tap(idle(), { row: 1, col: 1 }, BAR).state;
    expect(previewRect(anchored, BAR)).toBeNull();
    expect(previewRect(moveTo(anchored, { row: 1, col: 5 }), BAR)).toEqual({ row: 1, col: 1, len: 5, height: 1 });
  });
});

describe('gestures after another gesture', () => {
  it('a drag, then a tap elsewhere: the anchor alone, no stale preview', () => {
    let g = press(idle(), { row: 0, col: 0 });
    g = moveTo(g, { row: 0, col: 5 });
    const dragged = release(g, { row: 0, col: 5 }, BAR);
    expect(dragged.commit).not.toBeNull();
    const pressed = press(dragged.state, { row: 1, col: 0 });
    expect(previewRect(pressed, BAR)).toBeNull();
    const first = release(pressed, { row: 1, col: 0 }, BAR);
    expect(first.state.anchor).toEqual({ row: 1, col: 0 });
    expect(previewRect(first.state, BAR)).toBeNull();
  });

  it('a drag ending on another row does not leak into the next two-tap preview', () => {
    let g = press(idle(), { row: 0, col: 0 });
    g = moveTo(g, { row: 2, col: 1 });
    const first = tap(release(g, { row: 2, col: 1 }, BAR).state, { row: 1, col: 3 }, BAR);
    expect(previewRect(first.state, BAR)).toBeNull();
    expect(previewRect(cancel(moveTo(idle(), { row: 0, col: 4 })), BAR)).toBeNull();
  });

  it('a second tap on the anchor drops it, with nothing to lay or preview', () => {
    const a = tap(idle(), { row: 1, col: 0 }, BAR);
    const again = press(a.state, { row: 1, col: 0 });
    expect(previewRect(again, BAR)).toBeNull();
    const r = release(again, { row: 1, col: 0 }, BAR);
    expect(r.commit).toBeNull();
    expect(r.dropped).toBe(true);
    expect(r.state.anchor).toBeNull();
    expect(tap(a.state, { row: 1, col: 0 }, BAR).dropped).toBe(true);
    // A one-cell piece is still laid on a single tap.
    expect(tap(idle(), { row: 1, col: 0 }, CELL).commit).toEqual({ row: 1, col: 0, len: 1, height: 1 });
  });
});

describe('pose messages', () => {
  it('a pose that contradicts a clue says so in the bad tone', () => {
    const g2 = byId(2);
    const price = g2.clues.find((c) => c.type === 'price')!;
    if (price.type !== 'price') throw new Error('price clue expected');
    const s0 = newGame(g2);
    const other = (['T', 'G', 'N'] as const).find((p) => p !== price.piece && g2.pieces[p])!;
    const r = place(g2, s0, { piece: other, row: 0, col: price.col, len: 1 });
    const before = evaluate(g2, s0).clues;
    const after = evaluate(g2, r.ok ? r.state : s0).clues;
    const broken = newlyBroken(before, after);
    expect(broken?.clue).toBe(price);
    const m = poseMessage(g2, 'TAC à 16h, ligne 1', [], broken);
    expect(m.tone).toBe('bad');
    expect(m.text).toMatch(/^TAC à 16h, ligne 1 : contredit l’indice « .+ fixe le prix »\.$/);
  });

  it('without a contradiction: replaced plants, else the pose fits', () => {
    const g1 = byId(1);
    expect(poseMessage(g1, 'TAC à 8h, ligne 2', [], null)).toEqual({ text: 'TAC à 8h, ligne 2 : la pose tient.', tone: 'ok' });
    expect(poseMessage(g1, 'TAC à 8h, ligne 2', [{ piece: 'N' }], null).text).toBe('TAC à 8h, ligne 2 : remplace 1 groupe nucléaire.');
    const ok = [{ clue: byId(2).clues[0]!, text: '', status: 'broken' as const }];
    expect(newlyBroken(ok, ok)).toBeNull();
  });

  it('durations never wrap inside', () => {
    expect(durationText(254000)).toBe('4\u00a0min\u00a014\u00a0s');
    expect(durationText(9000)).toBe('9\u00a0s');
  });
});

describe('history', () => {
  it('undo walks back, never past the start', () => {
    let h = start('a');
    expect(canUndo(h)).toBe(false);
    h = push(push(h, 'b'), 'c');
    h = undo(h);
    expect(h.present).toBe('b');
    h = undo(undo(h));
    expect(h.present).toBe('a');
    expect(canUndo(h)).toBe(false);
  });

  it('pushing the same value is a no-op; reset is undoable', () => {
    const h = start('a');
    expect(push(h, 'a')).toBe(h);
    const r = reset(push(h, 'b'), 'a');
    expect(r.present).toBe('a');
    expect(undo(r).present).toBe('b');
  });

  it('keeps at most MAX_PAST steps', () => {
    let h = start(0);
    for (let i = 1; i <= MAX_PAST + 20; i++) h = push(h, i);
    expect(h.past.length).toBe(MAX_PAST);
    expect(h.present).toBe(MAX_PAST + 20);
  });
});

describe('progress', () => {
  const g1 = byId(1);
  const s1 = solutionState(g1);

  it('status: new, then started, then done (and done sticks)', () => {
    let p = emptyProgress();
    expect(statusOf(p, 1)).toBe('new');
    p = recordState(p, 1, newGame(g1), 1000, false);
    expect(statusOf(p, 1)).toBe('started');
    p = recordState(p, 1, s1, 2000, true);
    expect(statusOf(p, 1)).toBe('done');
    p = recordState(p, 1, newGame(g1), 3000, false);
    expect(statusOf(p, 1)).toBe('done');
  });

  it('parsing keeps well-formed entries only', () => {
    expect(parseProgress(null)).toEqual(emptyProgress());
    expect(parseProgress('{not json')).toEqual(emptyProgress());
    const raw = JSON.stringify({ grids: {
      1: { status: 'started', state: s1, elapsedMs: 5 },
      2: { status: 'weird' },
      3: { status: 'done', state: { bars: 'x' }, elapsedMs: -1 },
    } });
    const p = parseProgress(raw);
    expect(Object.keys(p.grids)).toEqual(['1', '3']);
    expect(p.grids['1']?.state).toEqual(JSON.parse(JSON.stringify(s1)));
    expect(p.grids['3']).toEqual({ status: 'done' });
    expect(isPlayState({ bars: [], exports: { DE: [0, 1] }, step: [{ pump: 0, turbine: 2 }] })).toBe(true);
    expect(isPlayState({ bars: [{ piece: 'N', row: 0, col: 0 }], exports: {}, step: [] })).toBe(false);
  });

  it('a store that throws never breaks the game', () => {
    const broken: KeyValueStore = {
      getItem: () => { throw new Error('blocked'); },
      setItem: () => { throw new Error('full'); },
    };
    const store = new ProgressStore(() => broken);
    expect(store.get()).toEqual(emptyProgress());
    const p = recordState(store.get(), 1, s1, 1, true);
    expect(() => store.set(p)).not.toThrow();
    expect(statusOf(store.get(), 1)).toBe('done');
    expect(new ProgressStore(() => { throw new Error('no storage'); }).get()).toEqual(emptyProgress());
  });

  it('round-trips through a working store', () => {
    const data = new Map<string, string>();
    const kv: KeyValueStore = { getItem: (k) => data.get(k) ?? null, setItem: (k, v) => { data.set(k, v); } };
    new ProgressStore(() => kv).set(recordState(emptyProgress(), 7, s1, 42, false));
    expect(data.has(STORAGE_KEY)).toBe(true);
    expect(statusOf(new ProgressStore(() => kv).get(), 7)).toBe('started');
  });

  it('two stores on one storage keep each other\'s grids', () => {
    const data = new Map<string, string>();
    const kv: KeyValueStore = { getItem: (k) => data.get(k) ?? null, setItem: (k, v) => { data.set(k, v); } };
    const a = new ProgressStore(() => kv);
    const b = new ProgressStore(() => kv);
    b.set(recordState(b.get(), 8, s1, 10, true));
    // a never saw grid 8: saving grid 9 must not erase it
    a.set(recordState(a.get(), 9, s1, 5, false));
    const fresh = new ProgressStore(() => kv).get();
    expect(statusOf(fresh, 8)).toBe('done');
    expect(statusOf(fresh, 9)).toBe('started');
    expect(statusOf(a.get(), 8)).toBe('done');
    // refresh picks up what another store wrote since
    b.set(recordState(b.get(), 1, s1, 5, false));
    a.refresh();
    expect(statusOf(a.get(), 1)).toBe('started');
    // data cleared while a page is open: a only rewrites what it changed
    data.clear();
    a.set(recordState(a.get(), 2, s1, 5, false));
    expect(statusOf(new ProgressStore(() => kv).get(), 2)).toBe('started');
    expect(statusOf(new ProgressStore(() => kv).get(), 9)).toBe('new');
  });

  it('play order: tutorials then rated grids; next grid follows it', () => {
    const today = '2026-11-21';
    const order = playOrder(grids, today);
    const sections = order.map((g) => g.section);
    expect(sections.lastIndexOf('tutorial')).toBeLessThan(sections.indexOf('rated'));
    const tutorials = order.filter((g) => g.section === 'tutorial');
    for (let i = 0; i + 1 < tutorials.length; i++) expect(nextGrid(grids, tutorials[i]!.id, today)?.id).toBe(tutorials[i + 1]!.id);
    expect(nextGrid(grids, tutorials.at(-1)!.id, today)?.id).toBe(currentBulletin(grids, today)!.id);
    expect(nextGrid(grids, order.at(-1)!.id, today)).toBeNull();
  });
});

describe('board and game helpers', () => {
  it('geometry covers the highest silhouette and maps points to cells', () => {
    const g = byId(10);
    const geo = boardGeometry(g, 'A', 50);
    const top = Math.max(...g.demand) + g.neighbors.reduce((a, nb) => a + nb.cap, 0);
    expect(geo.rows).toBe(top);
    // The left gutter holds the neighbor id: hit-testing starts after it.
    expect(geo.lead).toBeGreaterThan(0);
    expect(cellAt(geo, geo.lead, (geo.rows - 1) * 50 + 1)).toEqual({ row: 0, col: 0 });
    expect(cellAt(geo, geo.lead + 50 * 3 + 10, (geo.rows - 3) * 50 + 10)).toEqual({ row: 2, col: 3 });
    expect(cellAt(geo, geo.lead - 1, 10)).toBeNull();
    expect(cellAt(geo, geo.lead + 50 * g.columns.length + 1, 10)).toBeNull();
    // Paper is a full rectangle: the screen's maximum height plus one blank row above every column.
    expect(boardGeometry(g, 'B', 40).rows).toBe(top + 1);
  });

  it('export flows are fixed from the start and re-applied on saved boards', () => {
    const g = byId(7);
    const locked = lockedExports(g);
    expect(locked.size).toBeGreaterThan(0);
    const s = initialState(g);
    for (const [key, v] of locked) {
      const [country, col] = key.split(':') as [string, string];
      expect(s.exports[country]?.[Number(col)]).toBe(v);
    }
    expect(applyLockedExports(g, newGame(g))).toEqual(s);
  });

  it('tapping a neighbor pill cycles the export within the line capacity', () => {
    expect(nextExportValue(0, 0, 1)).toBe(1);
    expect(nextExportValue(1, 0, 1)).toBe(0);
    expect(nextExportValue(0, 1, 1)).toBe(0);
    expect(nextExportValue(1, 0, 3)).toBe(2);
  });

  it('STEP pairs: from the inventory or the exchanges clue', () => {
    expect(maxStepPairs(byId(7))).toBe(1);
    expect(maxStepPairs(byId(1))).toBe(0);
  });

  it('every grid renders on screen and on paper; paper never shows the answer', () => {
    for (const g of grids) {
      const s = solutionState(g);
      const screen = renderBoard({ grid: g, state: s, ev: evaluate(g, s), style: 'A', cell: 50, interactive: true }).svg;
      expect(screen).toContain('<svg');
      const sheet = renderSheet(g, null);
      const laid = s.bars.filter((b) => !b.locked).length;
      expect(laid).toBeGreaterThan(0);
      // Paper draws only engaged plants: no unlocked plant fill colour for a laid bar at row 0.
      expect(sheet).not.toContain('class="state');
      expect(sheet).not.toContain('▲ pompe');
    }
  });

  it('invalid plants are hatched, not removed', () => {
    const g = byId(1);
    let s = newGame(g);
    const r = place(g, s, { piece: 'T', row: 3, col: 2, len: 1 });
    expect(r.ok).toBe(true);
    if (r.ok) s = r.state;
    const lowered = { ...g, demand: g.demand.map((d, c) => (c === 2 ? 3 : d)) };
    const ev = evaluate(lowered, s);
    expect(ev.invalidBars).toEqual([0]);
    expect(renderBoard({ grid: lowered, state: s, ev, style: 'A', cell: 50 }).svg).toContain('url(#hX');
  });

  it('book: exact inventory marks laid bars, no inventory shows shapes and the dam stock', () => {
    const g1 = byId(1);
    const s = solutionState(g1);
    expect(renderBook(g1, s, 'N')).toContain('mb used');
    expect(renderBook(g1, newGame(g1), 'N')).not.toContain('mb used');
    const g8 = byId(8);
    // Zero imports published: no import line (R13); a grid with imports keeps it, named after the country.
    expect(bookEntries(g8).map((e) => e.key)).toEqual(['N', 'B']);
    expect(bookEntries(byId(9)).map((e) => e.key)).toContain('I:DE');
    expect(renderBook(byId(9), newGame(byId(9)), null)).toContain('Import d’Allemagne');
    // Screen: no hint under the names, the stock is drawn and counted; free plants count to ∞.
    const screen = renderBook(g8, newGame(g8), null);
    expect(screen).not.toContain('stock : 2 blocs');
    expect(screen).toContain('0 / 2');
    expect(screen).toContain('0 / ∞');
    expect(screen).not.toMatch(/posée|créneaux|ruban/);
    // Paper keeps the hints and shows no usage.
    expect(renderBook(g8, newGame(g8), null, true)).toContain('stock : 2 blocs');
    expect(renderBook(g8, newGame(g8), null, true)).not.toContain('∞');
  });

  it('a coal ramp of contiguous widths is one glyph: smallest ramp solid, added middle columns dashed', () => {
    const g = byId(12);
    g.pieces.C!.len = [3, 4, 5, 6];
    g.inventory.pieces.C = {};
    const html = renderBook(g, newGame(g), null);
    const coal = html.slice(html.indexOf('data-piece="C"'));
    const glyph = coal.slice(coal.indexOf('<span class="mb'), coal.indexOf('</span>', coal.indexOf('mb-w')));
    expect(glyph).toContain('repeat(6,auto)');
    expect(glyph).toContain('3–6');
    // Profile 1, 2, 2, 2, 2, 1 on two rows: 6 cells in the bottom row (3 dashed), 4 in the top row (3 dashed).
    expect(glyph.match(/<i class="d"/g)).toHaveLength(6);
    expect(glyph.match(/<i class="" /g)).toHaveLength(4);
    expect(glyph.match(/<i class="e">/g)).toHaveLength(2);
    // Gaps in the widths: one glyph per width, as before.
    g.pieces.C!.len = [3, 5];
    expect(renderBook(g, newGame(g), null).match(/class="mb/g)!.length).toBeGreaterThan(glyph.match(/class="mb/g)!.length);
  });

  it('a price publication carries the price scale: book plants in merit order, the price setter ringed', () => {
    const g = byId(6);
    const price = g.clues.find((c) => c.type === 'price' && c.piece === 'G')!;
    if (price.type !== 'price') throw new Error('no price clue');
    const html = clueItem(g, price, null);
    const plants = bookEntries(g).map((e) => e.piece).filter((p) => p !== 'STEP' && p !== 'I');
    expect(html.match(/class="cd/g)).toHaveLength(plants.length);
    expect(html.match(/class="cd hi"/g)).toHaveLength(1);
    // The ringed dot is the price setter's colour; the others follow the merit order.
    const dots = [...html.matchAll(/<i class="cd( hi)?" style="background:([^"]+)"/g)];
    expect(dots.map((m) => m[2])).toEqual(plants.map((p) => PIECE_COLORS[p as 'N'].a));
    expect(dots.findIndex((m) => m[1])).toBe(plants.indexOf(price.piece));
    expect(plants).toEqual(['N', 'G']);
    expect(html).toContain('aria-label="Ordre de prix : nucléaire, gaz"');
    expect(html).toContain('aria-label="Ordre de prix : ');
    expect(clueItem(g, price, null, true)).not.toContain('class="cd');
  });

  it('a laid plant is a « groupe » followed by the plant, plural only on nucléaire', () => {
    expect(PIECE_WORDS.N.groups).toBe('groupes nucléaires');
    for (const id of ['B', 'C', 'G', 'T'] as const) expect(PIECE_WORDS[id].groups).toBe(`${PIECE_WORDS[id].group}`.replace('groupe', 'groupes'));
    const g = byId(1);
    expect(groupSubject(g, 'N')).toBe('Le groupe nucléaire');
    expect(groupSubject(g, 'T')).toBe('Le groupe TAC');
    expect(MSG.tooManyBars(PIECE_WORDS.N.groups, [3])).toBe('Groupes nucléaires en trop : 3.');
    expect(MSG.inventoryBar(PIECE_WORDS.T.group, 1)).toBe('Plus de groupe TAC de 1 créneau dans le carnet d’ordres.');
    expect(UI.replaces(g, [{ piece: 'N' }, { piece: 'N' }])).toBe('Remplace 2 groupes nucléaires');
  });

  it('clue texts get plant chips and slot values; day clues are the unslotted ones', () => {
    const g = byId(7);
    const price = g.clues.find((c) => c.type === 'price')!;
    const html = richClueText(g, price);
    expect(html).toContain('class="pc"');
    expect(html).toContain('class="slot"');
    expect(isDayClue(price)).toBe(false);
    expect(isDayClue({ type: 'length', piece: 'N', len: 4 })).toBe(true);
  });

  it('display titles: tutorials lose their number, rated grids get one', () => {
    expect(displayTitle(byId(1))).toBe('Poser le carnet');
    expect(displayTitle(byId(8))).toBe(byId(8).bulletin!.title);
    const noBulletin = { ...byId(8), bulletin: undefined, title: byId(8).difficulty.label } as Grid;
    expect(displayTitle(noBulletin)).toBe(UI.gridNumber(8));
  });

  it('a grid with a bulletin shows its number on the game eyebrow tag, the sheet and the tab title', () => {
    const g = byId(8);
    const tag = bulletinTag(g)!;
    expect(tag).toMatch(new RegExp(`^n° ${g.bulletin!.number} · `));
    expect(bulletinTag(byId(1))).toBeNull();
    const html = renderSheet(g, null);
    expect(html).toContain(tag);
    expect(html).toContain(g.bulletin!.title);
    expect(html).not.toContain('Grille notée');
  });

  it('home labels say Accueil', () => {
    expect(UI.back).toBe('Accueil');
    expect(UI.home).toBe('Accueil');
  });
});

describe('print sheet', () => {
  /** Grid 1 plus weather, an engaged plant and a CO2 cap: mechanics no shipped grid has yet. */
  function rich(): Grid {
    const g = byId(1);
    g.demand = g.demand.map((d, c) => d + 1 + (c === 1 ? 1 : 0));
    g.weather = { R: g.columns.map((_, c) => (c === 1 ? 1 : 0)), F: g.columns.map(() => 1) };
    g.co2_cap = 9;
    g.clues = [...g.clues, { type: 'engaged', piece: 'T', row: 3, col: 2, len: 1 }];
    return g;
  }

  it('shows the imposed plants and weather, the CO2 rule, never a status or the answer', () => {
    const g = rich();
    const sheet = renderSheet(g, 1);
    expect(sheet).toContain('url(#hF');
    expect(sheet).toContain('url(#hR');
    expect(sheet).toContain('<g transform'); // lock on the engaged plant
    expect(sheet).toContain('Plafond CO₂');
    expect(sheet).toContain('points au plus');
    expect(sheet).not.toContain('class="state');
    expect(sheet).toContain('Dispatch · n° 1');
    // Only the engaged plant is drawn: one plant rectangle with the TAC paper colour.
    expect(sheet.match(/fill="#f0b8c4"/g)?.length).toBe(1);
  });

  it('on screen, the CO2 gauge counts points and flags an overflow', () => {
    const g = rich();
    const s = initialState(g);
    const r = place(g, s, { piece: 'T', row: 1, col: 0, len: 1 });
    expect(r.ok).toBe(true);
    const html = renderCo2(g, r.ok ? r.state : s);
    expect(html).toContain('4 points sur 9');
    expect(html).not.toContain('gauge over');
  });

  it('the CO2 limit is a market publication: open, checked when full under the cap, contradicted above it', () => {
    const g = rich();
    const s = initialState(g);
    expect(renderCo2(g, s)).not.toContain('plafond');
    const open = renderClues(g, evaluate(g, s).clues, s);
    expect(open).toContain('Limite CO₂');
    // The publication keeps the limit only; the points per cell are the gauge's legend.
    expect(open).toContain('<span class="txt"><span class="slot">9</span> points de CO₂ au plus.</span>');
    expect(open).not.toContain('Aujourd’hui');
    expect(open).not.toContain('Par case');
    expect(open).toMatch(/Limite CO₂.*?class="state "/s);
    expect(renderClues(g, evaluate(g, s).clues, s, true)).toMatch(/Limite CO₂.*?class="state ok"/s);
    const over = { ...g, co2_cap: 0 };
    const r = place(over, s, { piece: 'T', row: 1, col: 0, len: 1 });
    const st = r.ok ? r.state : s;
    expect(renderClues(over, evaluate(over, st).clues, st)).toMatch(/Limite CO₂.*?class="state bad"/s);
    expect(shownClueCount(g)).toBe(shownClueCount({ ...g, co2_cap: null }) + 1);
  });

  it('the CO2 card: continuous track, points left, legend of the layable emitters, most points first', () => {
    const g = rich();
    g.pieces = { ...g.pieces, C: { len: [3], height: [1], rank: 3, co2: 3 }, G: { len: [2, 3], height: [1], rank: 4, co2: 1 }, T: { ...g.pieces.T!, co2: 2 } };
    g.inventory = { level: 'none', pieces: { N: {}, C: {}, G: {}, T: {} } };
    g.neighbors = [{ id: 'GB', name: 'Royaume-Uni', cap: 1, co2: 1 }, { id: 'DE', name: 'Allemagne', cap: 1, co2: 3 }, { id: 'ES', name: 'Espagne', cap: 1, co2: 0 }];
    const s = initialState(g);
    const html = renderCo2(g, s);
    expect(html).toContain('<div class="track">');
    expect(html).toMatch(/<span class="soft">\d+ restants?<\/span>/);
    // Ties keep the book order: plants, then import lines; a line at 0 point is left out.
    const names = [...html.matchAll(/<\/i>([^<]+) <span class="per">(\d+)<\/span>/g)].map((m) => `${m[1]} ${m[2]}`);
    expect(names).toEqual(['Charbon 3', 'Import d’Allemagne 3', 'TAC 2', 'Gaz 1', 'Import du Royaume-Uni 1']);
    expect(html).not.toMatch(/<b>\d/); // numbers in normal weight
    // No import possible today: no import in the legend, no CO2 under the neighbor rows.
    g.clues = [...g.clues, { type: 'exchanges', imports: { '*': 0 } }];
    expect(co2Costs(g).map((c) => c.name)).toEqual(['Charbon', 'TAC', 'Gaz']);
    const svg = renderBoard({ grid: g, state: s, ev: evaluate(g, s), style: 'A', cell: 50 }).svg;
    expect(svg).not.toContain('CO₂');
    // The cost per cell stays in the CO2 card, never under the neighbor rows.
    const g2 = { ...g, clues: g.clues.slice(0, -1) };
    expect(renderBoard({ grid: g2, state: s, ev: evaluate(g2, s), style: 'A', cell: 70 }).svg).not.toContain('CO₂');
  });

  it('book by width: one glyph per width with its width and its own counter', () => {
    const g = byId(7);
    const row = (html: string, key: string) => html.split(`data-piece="${key}"`)[1]!.split('</button>')[0]!;
    const nuclear = row(renderBook(g, initialState(g), null), 'N');
    // 4 x 4 and 3 x 3: two glyphs, longest first, each with its width and counter; no counter for the whole line.
    expect([...nuclear.matchAll(/<em class="mb-w">(\d+)<\/em>/g)].map((m) => m[1])).toEqual(['4', '3']);
    expect([...nuclear.matchAll(/<span class="gcount">([^<]+)<\/span>/g)].map((m) => m[1])).toEqual(['0 / 4', '0 / 3']);
    expect(nuclear).not.toContain('mb used');
    // Every bar of 3 laid: that width is struck, the other one counts on.
    const threes = g.solution.placements.filter((b) => b.piece === 'N' && b.len === 3);
    const laid = row(renderBook(g, { ...initialState(g), bars: threes }, null), 'N');
    expect([...laid.matchAll(/<span class="gcount">([^<]+)<\/span>/g)].map((m) => m[1])).toEqual(['0 / 4', '3 / 3']);
    expect(laid.match(/class="mb used"/g)).toHaveLength(1);
    // A width the inventory lacks shows as over.
    const odd = row(renderBook(g, { ...initialState(g), bars: [{ piece: 'N', row: 1, col: 0, len: 5 }] }, null), 'N');
    expect(odd).toMatch(/<em class="mb-w">5<\/em><\/span><span class="gcount over">1 \/ 0<\/span>/);
  });

  it('book by width: cells and imports are one square with their counter', () => {
    const g1 = byId(1);
    const tac = renderBook(g1, initialState(g1), null).split('data-piece="T"')[1]!.split('</button>')[0]!;
    expect(tac.match(/<span class="mb/g)).toHaveLength(1);
    expect(tac).toContain('<span class="gcount">0 / 2</span>');
    const g7 = byId(7);
    const imp = renderBook(g7, initialState(g7), null).split('data-piece="I:DE"')[1]!.split('</button>')[0]!;
    expect(imp.match(/<span class="mb/g)).toHaveLength(1);
    expect(imp).toContain('0 / 2');
  });

  it('book: optional heights are dashed rows above the filled first row, with optional widths too', () => {
    const base = byId(1);
    const tall = { ...structuredClone(base), pieces: { ...base.pieces, N: { ...base.pieces.N!, height: [1, 2] } } };
    const cells = (html: string) => [...html.split('data-piece="N"')[1]!.split('</button>')[0]!.matchAll(/<i class="(d?)"/g)].map((m) => m[1]);
    // Exact bar of 6, 1 or 2 GW: one glyph, the top row dashed, the bottom row filled.
    const exact = cells(renderBook(tall, initialState(tall), null));
    expect(exact).toEqual([...Array(6).fill('d'), ...Array(6).fill('')]);
    // No inventory, 3 to 6 wide and 1 or 2 GW: one glyph "3–6", only the first three cells of the first row filled.
    const free = { ...tall, inventory: { level: 'none' as const, pieces: { N: {}, G: {}, T: {} } } };
    const html = renderBook(free, initialState(free), null);
    expect(cells(html)).toEqual([...Array(6).fill('d'), '', '', '', 'd', 'd', 'd']);
    expect(html.split('data-piece="N"')[1]!.split('</button>')[0]).toContain('<em class="mb-w">3–6</em>');
    // Paper keeps one piece per bar and per height, without widths nor counters.
    const paper = renderBook(tall, initialState(tall), null, true);
    expect(paper).not.toContain('mb-w');
    expect(paper.split('Nucléaire')[1]!.split('class="prow"')[0]!.match(/<span class="mb"/g)).toHaveLength(2);
  });
});

describe('STEP in the order book', () => {
  const g7 = byId(7);

  it('is a book entry with its published pairs, or pairs to deduce', () => {
    expect(bookEntries(g7).map((e) => e.key)).toContain(STEP_KEY);
    expect(bookEntries(byId(1)).map((e) => e.key)).not.toContain(STEP_KEY);
    expect(publishedStepPairs(g7)).toBe(1);
    const html = renderBook(g7, initialState(g7), STEP_KEY);
    expect(html).toContain('data-piece="STEP"');
    expect(html).toContain('0 / 1');
    expect(html).not.toContain('step-glyph used');
    // Struck once its pair is laid (R14).
    const laid = renderBook(g7, { ...initialState(g7), step: [{ pump: 3, turbine: 4 }] }, STEP_KEY);
    expect(laid).toContain('step-glyph used');
    expect(laid).toContain('1 / 1');
    const free = { ...structuredClone(g7), inventory: { level: 'none' as const, pieces: { N: {} } } };
    expect(publishedStepPairs(free)).toBeNull();
    expect(renderBook(free, newGame(free), null)).toContain('0 / ∞');
  });

  it('screen: no STEP row; tags removable by a tap, no link line; pending pump drawn', () => {
    const s = { ...initialState(g7), step: [{ pump: 3, turbine: 4 }] };
    const svg = renderBoard({ grid: g7, state: s, ev: evaluate(g7, s), style: 'A', cell: 50, interactive: true }).svg;
    expect(svg).not.toContain('STEP · pompage');
    expect(svg.match(/data-act="step-tag"/g)?.length).toBe(2);
    expect(svg).not.toContain('step-link');
    expect(svg).not.toMatch(/[▲▼]\d/); // one pair: no number
    const arrows = renderBoard({ grid: g7, state: initialState(g7), ev: null, style: 'A', cell: 50, stepMode: true, interactive: true }).svg;
    expect(arrows.match(/data-act="step-arrow"/g)?.length).toBe(7); // ▲ on every slot but the last
    expect(arrows).not.toContain('step-pending');
    const turbine = renderBoard({ grid: g7, state: initialState(g7), ev: null, style: 'A', cell: 50, stepMode: true, interactive: true, stepPending: 2 }).svg;
    expect(turbine.match(/data-act="step-arrow"/g)?.length).toBe(1 + 5); // chosen ▲ + ▼ on the 5 later slots
    expect(renderBoard({ grid: g7, state: initialState(g7), ev: null, style: 'A', cell: 50, interactive: true }).svg).not.toContain('step-arrow');
    expect(boardGeometry(g7, 'A', 50).bottomRows).toBe(1);
  });

  it('STEP numbering: tag icons carry the pair number only when the grid has several pairs', () => {
    const pairs = [{ pump: 1, turbine: 3 }, { pump: 3, turbine: 5 }];
    expect(stepTagLabels(pairs, 1, true)).toEqual(['▲1']);
    expect(stepTagLabels(pairs, 3, true)).toEqual(['▲2', '▼1']);
    expect(stepTagLabels(pairs, 5, true)).toEqual(['▼2']);
    expect(stepTagLabels(pairs, 3, false)).toEqual(['▲', '▼']);
    const multi = { ...g7, inventory: { ...g7.inventory, step: 2 } };
    expect(maxStepPairs(multi)).toBe(2);
    const s = { ...initialState(multi), step: pairs };
    const svg = renderBoard({ grid: multi, state: s, ev: null, style: 'A', cell: 50 }).svg;
    // One pill per pair end (4), each with its drawn triangle and its pair number.
    expect(svg.match(/class="tag step-tag"/g)).toHaveLength(4);
    expect(svg.match(/<polygon /g)).toHaveLength(4);
    for (const l of ['1', '2']) expect(svg).toContain(`>${l}</text>`);
    const arrows = renderBoard({ grid: multi, state: { ...initialState(multi), step: [pairs[0]!] }, ev: null, style: 'A', cell: 50, stepMode: true, interactive: true }).svg;
    expect(arrows.match(/class="step-arrow[^]*?<\/g>/)![0]).toContain('>2</text>'); // next pair to place
  });

  it('STEP numbering: two pairs pumping at the same slot keep both numbers, compact tag widens', () => {
    const multi = { ...g7, inventory: { ...g7.inventory, step: 2 } };
    const s = { ...initialState(multi), step: [{ pump: 1, turbine: 3 }, { pump: 1, turbine: 5 }] };
    for (const cell of [50, 34]) {
      const svg = renderBoard({ grid: multi, state: s, ev: null, style: 'A', cell }).svg;
      // Two pills in the same column, stacked: the first pair laid is the lowest.
      const ys = [...svg.matchAll(/class="tag step-tag"><rect x="[\d.]+" y="([\d.-]+)"/g)].map((m) => Number(m[1]));
      expect(ys).toHaveLength(4); // two pumps in column 1, the turbines of columns 3 and 5
      expect(ys[0]!).toBeGreaterThan(ys[1]!);
    }
    const both = { ...initialState(multi), step: [{ pump: 1, turbine: 3 }, { pump: 3, turbine: 5 }] };
    expect(renderBoard({ grid: multi, state: both, ev: null, style: 'A', cell: 34 }).svg.match(/class="tag step-tag"/g)).toHaveLength(4);
  });

  it('the gap under the hours equals the gap above them (screen)', () => {
    for (const cell of [30, 40, 50, 58, 60]) {
      const gap = hoursGap(cell);
      expect(Math.abs(gap.above - gap.below)).toBeLessThanOrEqual(0.6);
    }
  });

  it('paper keeps its STEP boxes and draws no pair', () => {
    const sheet = renderSheet(g7, 7);
    expect(sheet).toContain('STEP · pompage');
    expect(sheet).not.toContain('step-tag');
    expect(sheet).not.toContain('data-piece="STEP"');
    expect(boardGeometry(g7, 'B', 40).bottomRows).toBe(2);
  });
});

describe('review S6.3 round 1', () => {
  const ok = <T>(r: { ok: true; state: T } | { ok: false }): T => { if (!r.ok) throw new Error('refused'); return r.state; };
  it('a tap on an export pill of a line full of imports is refused with its reason', () => {
    const g = byId(10);
    const s = ok(place(g, newGame(g), { piece: 'I', country: 'DE', row: 0, col: 7, len: 1 }));
    expect(exportTap(g, s, 'DE', 7)).toEqual({ state: null, refused: 'Ligne vers l’Allemagne saturée à 21h.' });
    const free = exportTap(g, s, 'DE', 6);
    expect(free.refused).toBeUndefined();
    expect(free.state?.exports.DE?.[6]).toBe(1);
  });

  it('a full but wrong board says why, and its unmet cell clue is contradicted', () => {
    const g = byId(8);
    g.clues.push({ type: 'column', col: 0, counts: { N: 0 } });
    const ev = evaluate(g, solutionState(g));
    expect(ev.missing).toBe(0);
    expect(ev.solved).toBe(false);
    expect(ev.clues[ev.clues.length - 1]!.status).toBe('broken');
    const m = boardMessage(ev, { text: 'Nucléaire à 0h, ligne 1 : la pose tient.', tone: 'ok' });
    expect(m?.tone).toBe('bad');
    expect(m?.text).toMatch(/^Indice non respecté : Relevé/);
    // A refusal from the last action stays on screen.
    expect(boardMessage(ev, { text: 'refus', tone: 'bad' })).toEqual({ text: 'refus', tone: 'bad' });
    // Cells left to cover: no verdict yet, the idle hint shows.
    expect(boardMessage(evaluate(g, newGame(g)), null)).toBeNull();
  });

  it('only a published export carries a padlock; a published import pill still exports', () => {
    const g5 = byId(5);
    const imp = g5.clues.find((c) => c.type === 'flow' && c.dir === 'import');
    expect(imp).toBeDefined();
    const svg5 = renderBoard({ grid: g5, state: initialState(g5), ev: evaluate(g5, initialState(g5)), style: 'A', cell: 40, interactive: true }).svg;
    expect(svg5).not.toContain('pill act locked');
    const g7 = byId(7);
    const svg7 = renderBoard({ grid: g7, state: initialState(g7), ev: null, style: 'A', cell: 40, interactive: true }).svg;
    expect(svg7).toContain('class="pill act locked" data-act="locked"');
  });

  it('a verified record tag stays within its column on narrow cells', () => {
    const g = byId(10);
    const s = solutionState(g);
    const cell = 35;
    const svg = renderBoard({ grid: g, state: s, ev: evaluate(g, s), style: 'A', cell }).svg;
    const tags = [...svg.matchAll(/<g class="tag"><rect x="([\d.]+)" y="[^"]+" width="([\d.]+)"/g)];
    expect(tags.length).toBeGreaterThan(0);
    const lead = boardGeometry(g, 'A', cell).lead;
    for (const [, x, w] of tags) {
      const col = Math.floor((Number(x) + Number(w) / 2 - lead) / cell);
      expect(Number(x)).toBeGreaterThanOrEqual(lead + col * cell);
      expect(Number(x) + Number(w)).toBeLessThanOrEqual(lead + (col + 1) * cell);
    }
  });

  it('the print sheet lists the slot clues in text and its footer covers exchanges and STEP', () => {
    const g7 = byId(7);
    const legend = slotLegend(g7);
    expect(legend).toContain('<li>3h : le nucléaire fixe le prix</li>');
    expect(legend).toContain('<li>9h : 4 nucléaire</li>');
    expect(legend).toContain('<li>0h : 1 bloc exporté vers l’Allemagne</li>');
    expect(legend).toContain('<li>15h → 24h : un réacteur tourne</li>');
    expect(renderSheet(g7, 7)).toContain(UI.printFootBoth);
    expect(slotLegend(byId(1))).toBe('');
  });
});

describe('review S6.3 round 3', () => {
  it('a vertical move of a one-row piece is no move: no preview, and its release is a tap', () => {
    expect(isFlat(BAR)).toBe(true);
    expect(isFlat(TALL)).toBe(false);
    const start = { row: 1, col: 2 };
    expect(alongShape(start, { row: 3, col: 2 }, BAR)).toEqual(start);
    expect(alongShape(start, { row: 3, col: 5 }, BAR)).toEqual({ row: 1, col: 5 });
    expect(alongShape(start, { row: 3, col: 2 }, TALL)).toEqual({ row: 3, col: 2 });
    let g = press(idle(), start);
    g = moveTo(g, alongShape(start, { row: 4, col: 2 }, BAR));
    expect(previewRect(g, BAR)).toBeNull();
    const r = release(g, alongShape(start, { row: 4, col: 2 }, BAR), BAR);
    expect(r.commit).toBeNull();
    expect(r.state.anchor).toEqual(start);
  });

  it('a new board is initial; a plant, a STEP pair or an export is not', () => {
    for (const g of grids) expect(isInitialState(g, initialState(g))).toBe(true);
    const g1 = byId(1);
    expect(isInitialState(g1, solutionState(g1))).toBe(false);
    const g10 = byId(10);
    const tapped = exportTap(g10, initialState(g10), g10.neighbors[0]!.id, 0).state!;
    expect(isInitialState(g10, tapped)).toBe(false);
    const g7 = byId(7);
    expect(isInitialState(g7, { ...initialState(g7), step: [{ pump: 2, turbine: 4 }] })).toBe(false);
  });

  it('every tutorial has a lore line, free of shape vocabulary', () => {
    const tutorials = grids.filter((g) => g.teaches?.length);
    expect(tutorials.length).toBeGreaterThan(0);
    for (const g of tutorials) {
      expect(TUTORIAL_LORE[g.id], `grid ${g.id}`).toBeTruthy();
      expect(TUTORIAL_LORE[g.id]).not.toMatch(/rampe|épaule|inventaire/i);
    }
  });

  it('the stock refusal has one colon only', () => {
    expect(MSG.stock('B', 'du barrage', 2)).toBe('Plus d’eau dans le barrage (2 blocs au plus).');
    expect(MSG.stock('G', 'de gaz', 1)).toBe('Plus de stock de gaz (1 bloc au plus).');
  });
});

describe('STEP taps (grid 7: 8 slots, one published pair)', () => {
  const g7 = byId(7);
  const s0 = newGame(g7);
  // Slots: 0 = 0h, 1 = 3h, 5 = 15h, 7 = 21h.
  const withPair = () => stepTapResult(g7, stepTapResult(g7, s0, null, 1).state ?? s0, 1, 5).state!;

  it('refuses a pump on the last slot', () => {
    const r = stepTapResult(g7, s0, null, 7);
    expect(r.pending).toBeNull();
    expect(r.state).toBeUndefined();
    expect(r.message).toEqual({ text: UI.stepLastSlot, tone: 'bad' });
  });

  it('the first tap pumps: pending slot, info message', () => {
    const r = stepTapResult(g7, s0, null, 1);
    expect(r.pending).toBe(1);
    expect(r.state).toBeUndefined();
    expect(r.message).toEqual({ text: UI.stepPending('3h'), tone: 'info' });
  });

  it('refuses a turbine on the same slot or earlier, and keeps the pending pump', () => {
    const same = stepTapResult(g7, s0, 1, 1);
    expect(same).toMatchObject({ pending: 1, message: { text: UI.stepTooEarly('3h'), tone: 'bad' } });
    expect(same.state).toBeUndefined();
    const before = stepTapResult(g7, s0, 1, 0);
    expect(before).toMatchObject({ pending: 1, message: { text: UI.stepTooEarly('3h'), tone: 'bad' } });
  });

  it('a turbine on a later slot adds the pair and clears the pending pump', () => {
    const r = stepTapResult(g7, s0, 1, 5);
    expect(r.pending).toBeNull();
    expect(r.state?.step).toEqual([{ pump: 1, turbine: 5 }]);
    expect(r.message).toEqual({ text: UI.stepAdded('3h', '15h'), tone: 'ok' });
  });

  it('with the exact inventory full, refuses a new pump', () => {
    const r = stepTapResult(g7, withPair(), null, 2);
    expect(r.pending).toBeNull();
    expect(r.message).toEqual({ text: MSG.stepCount(1), tone: 'bad' });
  });

  it('finds the pair pumping or turbining in a column, so a tap there removes it', () => {
    const s = withPair();
    expect(stepPairIndexAt(s, 1)).toBe(0);
    expect(stepPairIndexAt(s, 5)).toBe(0);
    expect(stepPairIndexAt(s, 3)).toBe(-1);
    expect(stepPairIndexAt(s0, 1)).toBe(-1);
  });
});

describe('STEP pump without its turbine (pending pump, not in the undo history)', () => {
  it('Undo drops the pending pump before undoing a recorded action', () => {
    expect(stepUndoPlan(1)).toBe('drop-pending');
    expect(stepUndoPlan(0)).toBe('drop-pending');
    expect(stepUndoPlan(null)).toBe('undo');
  });

  it('the chosen ▲ cancels the pump; another arrow goes through the tap logic', () => {
    expect(stepArrowAction(3, 3)).toBe('cancel');
    expect(stepArrowAction(3, 5)).toBe('tap');
    expect(stepArrowAction(null, 3)).toBe('tap');
  });

  it('the eraser on the pending slot drops the pump; elsewhere it keeps it', () => {
    expect(stepEraseResult(3, 3)).toEqual({ pending: null, dropped: true });
    expect(stepEraseResult(3, 4)).toEqual({ pending: 3, dropped: false });
    expect(stepEraseResult(null, 3)).toEqual({ pending: null, dropped: false });
  });
});

describe('renderChips (phone row)', () => {
  const g = byId(7);
  const chipSel = (html: string) => [...html.matchAll(/<button[^>]*class="chip sel"[^>]*data-piece="([^"]+)"/g)].map((m) => m[1]);
  it('marks the chosen plant and shows its counter', () => {
    const html = renderChips(g, newGame(g), 'N', false);
    expect(chipSel(html)).toEqual(['N']);
    expect(html).toContain('0/');
  });
  it('shows the STEP pair counter 0/1 on a grid that publishes one pair', () => {
    const html = renderChips(g, newGame(g), STEP_KEY, false);
    expect(html).toMatch(/data-piece="STEP"[^>]*>.*?<small>0\/1<\/small>/);
  });
  it('highlights no plant while the eraser is on', () => {
    const html = renderChips(g, newGame(g), null, true);
    expect(chipSel(html)).toEqual([]);
    expect(html).toContain('erase-chip sel');
  });
});

describe('clue text: punctuation stays glued to the plant chip', () => {
  it('the chip and the sign after it share one nowrap span', () => {
    const g = byId(10);
    for (const cl of g.clues) {
      const html = richClueText(g, cl);
      expect(html).not.toMatch(/<\/span><\/span>[,.;:]/);
    }
    const any = g.clues.map((cl) => richClueText(g, cl)).join('');
    expect(any).toContain('class="nw"');
  });
});

describe('phone hint', () => {
  it('points to the row under the board below 860 px', () => {
    expect(UI.hintChoose(false, true)).toContain('la rangée de centrales sous la grille');
    expect(UI.hintChoose(false)).toContain('le carnet d’ordres');
  });
});

describe('clue card (every clue in text, time order)', () => {

  it('orders: exchanges, day clues without hour, programmes by start, then the others by hour; ties keep the grid order', () => {
    const clues: Grid['clues'] = [
      { type: 'price', piece: 'N', col: 1 },
      { type: 'bar', piece: 'N', col: 5, len: 2 },
      { type: 'flow', country: 'DE', dir: 'export', col: 0, value: 1 },
      { type: 'engaged', piece: 'N', row: 0, col: 3, len: 2 },
      { type: 'bar', piece: 'G', col: 2, len: 2 },
      { type: 'exchanges', exports: { DE: 1 } },
      { type: 'length', piece: 'N', len: 4 },
      { type: 'price', piece: 'G', col: 1 },
    ] as Grid['clues'];
    const ordered = orderClues(clues.map((clue) => ({ clue }))).map((r) => clues.indexOf(r.clue));
    expect(ordered).toEqual([5, 3, 6, 4, 1, 2, 0, 7]);
  });

  it('lists every clue, with no collapsed list', () => {
    for (const grid of grids) {
      if (!grid.clues.length) continue;
      const ev = evaluate(grid, newGame(grid));
      const html = renderClues(grid, ev.clues, newGame(grid));
      // Every publication line (the exchanges are one publication of several) carries one status dot.
      expect(html.match(/class="pubrow"/g)?.length ?? 0).toBe(shownClueCount(grid));
      expect(html).not.toContain('<details');
    }
  });
});

describe('board card: fixed layout, price row, export rows', () => {
  const draw = (g: Grid, state = initialState(g), cell = 50) => renderBoard({ grid: g, state, ev: evaluate(g, state), style: 'A', cell, interactive: true });
  const viewBox = (svg: string) => svg.match(/viewBox="([^"]+)"/)![1];

  it('exporting or pumping moves nothing: same viewBox and same geometry before and after', () => {
    for (const id of [6, 7, 10, 11]) {
      const g = byId(id);
      const before = draw(g);
      let state = initialState(g);
      const nb = g.neighbors[0]!;
      const r = exportTap(g, state, nb.id, g.columns.length - 2);
      if (r.state) state = r.state;
      const after = draw(g, state);
      expect(viewBox(after.svg)).toBe(viewBox(before.svg));
      expect(after.geo.topPad).toBe(before.geo.topPad);
      expect(after.geo.rows).toBe(before.geo.rows);
    }
  });

  it('nothing is drawn above the demand until an export or a pumping is laid: the room is reserved, empty', () => {
    for (const id of [1, 2, 6, 10, 11]) {
      const svg = draw(byId(id)).svg;
      expect(svg).not.toContain('class="reserve"');
      expect(svg).not.toContain('stroke="#8f78cf" stroke-width="1.6" stroke-dasharray="4 3"'); // no dashed violet cell
    }
    // The card keeps the room: rows reach above the highest demand when the grid can export.
    for (const id of [6, 10, 11]) {
      const g = byId(id);
      expect(boardGeometry(g, 'A', 50).rows).toBeGreaterThan(Math.max(...g.demand));
    }
    const g1 = byId(1);
    expect(boardGeometry(g1, 'A', 50).rows).toBe(Math.max(...g1.demand));
  });

  it('an export draws a dashed violet cell above its column; the card does not move', () => {
    const g = byId(11);
    const before = draw(g);
    const r = exportTap(g, initialState(g), 'DE', 2);
    expect(r.state).not.toBeNull();
    const after = draw(g, r.state!);
    expect(after.svg).toMatch(/stroke="#8f78cf" stroke-width="2\.13" stroke-dasharray="5 3\.75"/); // 1.7 / 4 / 3 of a 40 px cell, at 50 px
    expect(viewBox(after.svg)).toBe(viewBox(before.svg));
  });

  it('a pump chosen but not yet turbined already shows its dashed slate cell; the turbine only once laid', () => {
    const g = byId(7);
    const st = initialState(g);
    const plain = renderBoard({ grid: g, state: st, ev: evaluate(g, st), style: 'A', cell: 50, stepMode: true, interactive: true });
    const pend = renderBoard({ grid: g, state: st, ev: evaluate(g, st), style: 'A', cell: 50, stepMode: true, interactive: true, stepPending: 3 });
    const blue = (svg: string) => (svg.match(/stroke="#5d6f93" stroke-width="2\.13" stroke-dasharray="5 3\.75"/g) ?? []).length;
    expect(blue(pend.svg)).toBe(blue(plain.svg) + 1);
    expect(viewBox(pend.svg)).toBe(viewBox(plain.svg));
  });

  it('a turbined block is a dashed slate cell struck by a slate diagonal; no black demand line under the weather', () => {
    const g = byId(7);
    const st = { ...initialState(g), step: [{ pump: 3, turbine: 5 }] };
    const svg = renderBoard({ grid: g, state: st, ev: evaluate(g, st), style: 'A', cell: 50 }).svg;
    expect(svg).toContain('d="M' ) ;
    expect(svg).toMatch(/stroke="#5d6f93" stroke-width="1\.75"\/>/);
    expect(svg).not.toContain('#6f9bd0" stroke-width="1.6"');
    const w = byId(8);
    expect(renderBoard({ grid: w, state: initialState(w), ev: evaluate(w, initialState(w)), style: 'A', cell: 50 }).svg).not.toMatch(/stroke-dasharray="6 3"/);
  });

  it('price tags sit under the hours, below the grid, not above the columns', () => {
    const g = byId(7);
    const { svg, geo } = draw(g);
    const hoursY = geo.rows * 50;
    const prices = [...svg.matchAll(/<g class="tag"><rect x="[\d.]+" y="([\d.-]+)"/g)].map((m) => Number(m[1]));
    expect(g.clues.filter((c) => c.type === 'price').length).toBeGreaterThan(0);
    // Every price and record pill is below the hour labels, in the band; none is above the columns.
    const below = prices.filter((y) => y > hoursY);
    expect(below.length).toBe(g.clues.filter((c) => c.type === 'price' || c.type === 'column').length);
    expect(prices.every((y) => y > hoursY)).toBe(true);
    expect(geo.bandHeight).toBeGreaterThan(0);
    expect(boardGeometry(byId(2), 'A', 50).bandHeight).toBeGreaterThan(0); // tutorial 2 has price clues
    expect(boardGeometry(byId(1), 'A', 50).bandHeight).toBe(0); // no slot clue: no band
    expect(boardGeometry(byId(11), 'A', 50).bandHeight).toBeGreaterThan(0); // the daily grid has records
  });

  it('neighbouring price tags never overlap, even with a 30 px cell', () => {
    for (const id of [6, 7]) {
      for (const cell of [30, 40, 50]) {
        const { svg } = draw(byId(id), undefined, cell);
        const rects = [...svg.matchAll(/<g class="tag"><rect x="([\d.-]+)" y="[\d.-]+" width="([\d.]+)"/g)].map((m) => [Number(m[1]), Number(m[1]) + Number(m[2])] as const);
        const sorted = [...rects].sort((a, b) => a[0] - b[0]);
        sorted.forEach((r, i) => { if (i) expect(r[0]).toBeGreaterThanOrEqual(sorted[i - 1]![1]); });
        rects.forEach((r) => expect(r[1] - r[0]).toBeLessThanOrEqual(cell - 4 + 10));
      }
    }
    // Tight cell: the short label "€ N" replaces the long one.
    expect(draw(byId(6), undefined, 30).svg).toContain('>€ ');
  });

  it('two price tags on neighbouring slots share one line, from 30 to 60 px cells', () => {
    for (let cell = 30; cell <= 60; cell += 2) {
      const prices = bandPlan(byId(6), cell).items.filter((it) => it.kind === 'price');
      expect(prices.length).toBe(2);
      expect(prices.map((it) => it.lane)).toEqual([0, 0]);
      // Same on a synthetic grid: prices on every slot stay on one line.
      const g = byId(6);
      g.clues = g.columns.map((_, col) => ({ type: 'price' as const, col, piece: 'N' as const }));
      expect(new Set(bandPlan(g, cell).items.map((it) => it.lane))).toEqual(new Set([0]));
    }
    // Tutorial 7 at 50 px: the record on slot 3 and the price on slot 4 share the line too.
    const g7 = byId(7);
    const laneAt = (type: string, col: number) => bandPlan(g7, 50).items.find((it) => {
      const cl = g7.clues[it.index]!;
      return cl.type === type && 'col' in cl && cl.col === col;
    })!.lane;
    expect(laneAt('column', 3)).toBe(laneAt('price', 4));
  });

  it('G7: the 9h record and the 12h price share one line from 30 to 60 px cells', () => {
    const g7 = byId(7);
    const item = (type: string, col: number, cell: number) => bandPlan(g7, cell).items.find((it) => {
      const cl = g7.clues[it.index]!;
      return cl.type === type && 'col' in cl && cl.col === col;
    })!;
    for (let cell = 30; cell <= 60; cell += 2) {
      const col9 = g7.clues.find((c) => c.type === 'column');
      expect(col9).toBeTruthy();
      const rec = item('column', (col9 as { col: number }).col, cell);
      expect(rec.x2 - rec.x1).toBeLessThanOrEqual(cell - 2);
      const prices = bandPlan(g7, cell).items.filter((it) => it.kind === 'price');
      for (const p of prices) if (Math.abs(p.mid - rec.mid) < cell * 4) expect(p.lane).toBe(rec.lane);
    }
  });

  it('paper: the programme bar sits clear of the thick demand contour', () => {
    const g = grids.find((x) => x.clues.some((c) => c.type === 'bar'))!;
    const svg = renderBoard({ grid: g, state: initialState(g), ev: null, style: 'B', cell: 40 }).svg;
    const geo = boardGeometry(g, 'B', 40);
    const m = svg.match(new RegExp(`<rect x="[\\d.]+" y="([\\d.]+)" width="[\\d.]+" height="4" rx="2"`));
    expect(Number(m![1])).toBeGreaterThanOrEqual(geo.rows * 40 + 3.2 / 2 + 1);
  });

  it('no two clues overlap on any published grid, verified or not, from 30 to 60 px', () => {
    const pills = (svg: string, from: number) => [...svg.matchAll(/<rect x="([\d.-]+)" y="([\d.-]+)" width="([\d.]+)" height="18" rx="9"/g)]
      .map((m) => ({ x1: Number(m[1]), y: Number(m[2]), x2: Number(m[1]) + Number(m[3]) }))
      .filter((p) => p.y > from);
    for (const g of grids) {
      for (const cell of [30, 36, 44, 50, 60]) {
        for (const state of [initialState(g), solutionState(g)]) {
          const { svg, geo } = renderBoard({ grid: g, state, ev: evaluate(g, state), style: 'A', cell, interactive: true });
          const band = pills(svg, geo.rows * cell);
          // Screen programmes have no pill, only a line under the grid.
          const count = g.clues.filter((c) => c.type === 'price' || c.type === 'column').length;
          expect(band.length).toBe(count);
          for (const a of band) for (const b of band) {
            if (a === b || Math.abs(a.y - b.y) >= 18) continue;
            expect(a.x2 <= b.x1 || b.x2 <= a.x1, `grid ${g.id}, cell ${cell}`).toBe(true);
          }
          // Inside the board, and above the export rows.
          for (const p of band) {
            expect(p.x1).toBeGreaterThanOrEqual(geo.lead);
            expect(p.x2).toBeLessThanOrEqual(geo.lead + g.columns.length * cell);
            expect(p.y + 18).toBeLessThanOrEqual(geo.rows * cell + bandStart(cell, 'A') + 4 + geo.bandHeight);
          }
        }
      }
    }
  });

  it('screen programmes: one line each, no pill, packed on as few lanes as possible', () => {
    const g = structuredClone(grids.find((x) => x.clues.some((c) => c.type === 'bar'))!);
    const piece = (g.clues.find((c) => c.type === 'bar') as { piece: string }).piece as 'N';
    g.clues = [
      { type: 'bar', piece, col: 0, len: 2 },
      { type: 'bar', piece, col: 3, len: 2 },
      { type: 'bar', piece, col: 1, len: 3 },
      { type: 'bar', piece, col: 2, len: 1 },
    ];
    const plan = bandPlan(g, 40);
    expect(plan.items).toEqual([]);
    // Slots 0-1, 2 and 3-4 share lane 0; 1-3 overlaps them all and takes lane 1.
    expect(plan.lines.map((l) => l.lane)).toEqual([0, 0, 1, 0]);
    const { svg } = renderBoard({ grid: g, state: initialState(g), ev: evaluate(g, initialState(g)), style: 'A', cell: 40 });
    expect(svg.match(/class="programme"/g)?.length).toBe(4);
    expect(svg).not.toMatch(/height="18" rx="9"/);
    // Paper keeps the programme name in the band.
    expect(bandPlan(g, 40, 'B').items.filter((it) => it.kind === 'bar').length).toBe(4);
  });

  it('clue marks: a tick once verified, a red "!" once contradicted, never a red border', () => {
    for (const g of grids) {
      const sol = solutionState(g);
      const { svg } = renderBoard({ grid: g, state: sol, ev: evaluate(g, sol), style: 'A', cell: 44, interactive: true });
      const slot = g.clues.filter((c) => c.type === 'price' || c.type === 'column' || c.type === 'bar' || c.type === 'flow').length;
      expect(svg.match(/class="mark ok"/g)?.length ?? 0, `grid ${g.id}`).toBe(slot);
      expect(svg).not.toContain('class="mark bad"');
    }
    const g = structuredClone(byId(6));
    const price = g.clues.find((c) => c.type === 'price')!;
    const s0 = initialState(g);
    const ev = evaluate(g, s0);
    const broken = { ...ev, clues: ev.clues.map((r) => (r.clue === price ? { ...r, status: 'broken' as const } : r)) };
    const { svg } = renderBoard({ grid: g, state: s0, ev: broken, style: 'A', cell: 44 });
    expect(svg.match(/class="mark bad"/g)?.length).toBe(1);
    expect(svg).not.toMatch(/height="21" rx="10.5"/);
  });

  it('phone records: several plants fold to a marker under 48 px cells that jumps to its publication; one plant stays in clear', () => {
    const g = structuredClone(byId(7));
    const col = g.columns.length - 2;
    g.clues = [...g.clues, { type: 'column', col, counts: { N: 1, G: 2 } }, { type: 'column', col: 1, counts: { N: 1 } }];
    const many = g.clues.length - 2;
    const one = g.clues.length - 1;
    for (const cell of [30, 36, 44, 47]) {
      const plan = bandPlan(g, cell);
      expect(plan.items.find((it) => it.index === many)!.marker).toBe(true);
      expect(plan.items.find((it) => it.index === one)!.marker).toBeFalsy();
      const s0 = initialState(g);
      const { svg } = renderBoard({ grid: g, state: s0, ev: evaluate(g, s0), style: 'A', cell, interactive: true });
      const marker = svg.match(/<g class="tag record-marker act"[^>]*>/g) ?? [];
      expect(marker.length).toBe(1);
      expect(marker[0]).toContain(`data-act="record-jump"`);
      expect(marker[0]).toContain(`data-clue="${many}"`);
      expect(marker[0]).toContain('role="button"');
      expect(marker[0]).toContain('tabindex="0"');
      expect(marker[0]).toContain(`aria-label="${UI.recordJump(g.columns[col]!)}"`);
    }
    // 48 px and more, desktop chips and paper keep the record drawn in full.
    expect(bandPlan(g, 48).items.some((it) => it.marker)).toBe(false);
    expect(bandPlan(g, 30, 'A', true).items.some((it) => it.marker)).toBe(false);
    expect(bandPlan(g, 30, 'B').items.some((it) => it.marker)).toBe(false);
    // The marker's hit area stays in the band, under the hours: a press on the grid never reaches it.
    const { svg, geo } = renderBoard({ grid: g, state: initialState(g), ev: null, style: 'A', cell: 36, interactive: true });
    const hit = svg.match(/<rect class="hit" x="[\d.-]+" y="([\d.-]+)"/)!;
    expect(Number(hit[1])).toBeGreaterThan(geo.rows * 36 + 14);
    // The publication carries the clue index the marker points to.
    const cards = renderClues(g, evaluate(g, initialState(g)).clues, initialState(g));
    expect(cards).toContain(`<li class="clue" data-clue="${many}">`);
  });

  it('desktop records: bare chips centred on the slot, wrapped past their slot, apart from every other clue', () => {
    const rec = recordLayout({ N: 2, G: 1, T: 1 }, 60);
    expect(new Set(rec.chips.map((c) => c.dy))).toEqual(new Set([0]));
    expect(rec.h).toBe(18);
    const four = recordLayout({ N: 2, G: 1, T: 1, B: 12 }, 60);
    expect(four.chips.filter((c) => c.dy > 0).length).toBeGreaterThan(0);
    expect(four.h).toBeGreaterThan(18);
    for (const g of grids) {
      for (const cell of [30, 44, 50, 60]) {
        const plan = bandPlan(g, cell, 'A', true);
        const recs = plan.items.filter((it) => it.kind === 'column');
        expect(recs.length).toBe(g.clues.filter((c) => c.type === 'column').length);
        for (const it of recs) {
          expect(it.rec).toBeTruthy();
          expect(it.x1).toBeGreaterThanOrEqual(boardLead(g));
          expect(it.x2).toBeLessThanOrEqual(boardLead(g) + g.columns.length * cell);
        }
        // Items on one lane never overlap; a lane is as tall as its tallest record.
        for (const a of plan.items) for (const b of plan.items) {
          if (a === b || a.lane !== b.lane) continue;
          expect(a.x2 <= b.x1 || b.x2 <= a.x1, `grid ${g.id}, cell ${cell}`).toBe(true);
        }
        const tops = [...new Set(plan.items.map((it) => it.top))].sort((x, y) => x - y);
        tops.forEach((t, i) => { if (i) expect(t - tops[i - 1]!).toBeGreaterThanOrEqual(26); });
        const sol = solutionState(g);
        const { svg, geo } = renderBoard({ grid: g, state: sol, ev: evaluate(g, sol), style: 'A', cell, recordChips: true });
        expect(svg.match(/class="tag record-chips"/g)?.length ?? 0).toBe(recs.length);
        expect(geo.bandHeight).toBe(plan.height);
      }
    }
    // Without the option (phone, paper) records stay pills.
    const g = grids.find((x) => x.clues.some((c) => c.type === 'column'))!;
    expect(renderBoard({ grid: g, state: initialState(g), ev: null, style: 'A', cell: 44 }).svg).not.toContain('record-chips');
  });

  it('an exported or pumped cell keeps its dashed outline under a piece', () => {
    let seen = 0;
    for (const g of grids) {
      const sol = solutionState(g);
      const expected = Object.values(g.solution?.exports ?? {}).flat().reduce((a: number, v) => a + (v ?? 0), 0) + (g.solution?.step?.length ?? 0);
      const { svg } = renderBoard({ grid: g, state: sol, ev: evaluate(g, sol), style: 'A', cell: 44 });
      expect(svg.match(/class="covered"/g)?.length ?? 0, `grid ${g.id}`).toBe(expected);
      seen += expected;
    }
    expect(seen).toBeGreaterThan(0);
  });

  it('STEP arrows and tags hang on the current top of their column; the card does not move', () => {
    const g = byId(7);
    const st = initialState(g);
    const arrows = (svg: string) => new Map([...svg.matchAll(/data-act="step-arrow" data-col="(\d+)"[^>]*><circle cx="[\d.]+" cy="([\d.-]+)"/g)].map((m) => [Number(m[1]), Number(m[2])]));
    const top = (s: typeof st, c: number) => (g.weather.R[c] ?? 0) + (g.weather.F[c] ?? 0) + Math.max(0, rawSilhouette(g, s)[c]!);
    const plain = renderBoard({ grid: g, state: st, ev: evaluate(g, st), style: 'A', cell: 50, stepMode: true, interactive: true });
    const H = plain.geo.rows;
    const a = arrows(plain.svg);
    expect(a.size).toBe(g.columns.length - 1);
    for (const [c, cy] of a) expect(cy).toBe((H - top(st, c)) * 50 - 15 * 1.25);
    // Pending pump on slot 3: its arrow rises by one cell; the other arrows stay; the viewBox too.
    const pend = renderBoard({ grid: g, state: st, ev: evaluate(g, st), style: 'A', cell: 50, stepMode: true, interactive: true, stepPending: 3 });
    const b = arrows(pend.svg);
    expect(b.get(3)).toBe(a.get(3)! - 50);
    for (const [c, cy] of b) if (c > 3 && a.has(c)) expect(cy).toBe(a.get(c));
    expect(b.get(g.columns.length - 1)).toBe((H - top(st, g.columns.length - 1)) * 50 - 15 * 1.25); // ▼ on the last slot
    expect(pend.svg.match(/viewBox="([^"]+)"/)![1]).toBe(plain.svg.match(/viewBox="([^"]+)"/)![1]);
    // Every arrow stays inside the card, whatever the column height.
    for (const cy of [...a.values(), ...b.values()]) expect(cy - 11 * 1.25).toBeGreaterThanOrEqual(-plain.geo.topPad);
  });

  it('two neighbours: one export row each, distinct positions, viewBox stable after an export', () => {
    const g = byId(10);
    g.neighbors = [...g.neighbors, { id: 'ES', name: 'Espagne', cap: 2, co2: g.neighbors[0]!.co2 }];
    const before = draw(g, initialState(g), 40);
    const ys = (id: string) => before.svg.match(new RegExp(`data-country="${id}" data-col="0"[\\s\\S]*?<rect[^>]* y="([\\d.-]+)"`))?.[1];
    expect(ys('DE')).toBeDefined();
    expect(ys('ES')).toBeDefined();
    expect(ys('DE')).not.toBe(ys('ES'));
    expect(before.svg).toContain('>ES</text>');
    const r = exportTap(g, initialState(g), 'ES', g.columns.length - 2);
    expect(r.state).not.toBeNull();
    const after = draw(g, r.state!, 40);
    expect(viewBox(after.svg)).toBe(viewBox(before.svg));
  });

  it('one row of export cells per neighbor, headed by its id, aligned on the columns', () => {
    for (const id of [7, 10, 11]) {
      const g = byId(id);
      const { svg, geo } = draw(g);
      const cells = svg.match(/data-act="(export|locked)" data-country="DE"/g) ?? [];
      expect(cells.length).toBe(g.neighbors.length * g.columns.length);
      expect(geo.lead).toBe(boardLead(g));
      expect(svg).toContain('>DE</text>');
      expect(svg).toContain('DE · 1 bloc par créneau'.replace('DE', g.neighbors[0]!.name));
    }
    expect(boardLead(byId(1))).toBe(0);
  });

  it('a tap on an export cell exports a block: the cell fills', () => {
    const g = byId(11);
    const r = exportTap(g, initialState(g), 'DE', 3);
    expect(r.state).not.toBeNull();
    const svg = draw(g, r.state!).svg;
    expect(svg).toContain('aria-label="Allemagne');
    expect(svg).toContain('>↑1</text>');
  });
});

describe('order book without exchanges line; exchanges in the clue card', () => {
  it('the order book has no "Échanges" row, on screen or on paper', () => {
    for (const id of [3, 4, 5, 6, 7]) {
      const g = byId(id);
      for (const paper of [false, true]) {
        const html = renderBook(g, initialState(g), null, paper);
        expect(html).not.toContain('Échanges');
        expect(html).not.toContain('xpill');
        expect(html).not.toContain('xrow');
      }
    }
  });

  it('an exact inventory with exports gives an exchanges line in the clue card, first, with its status', () => {
    for (const id of [3, 4, 5, 6, 7]) {
      const g = byId(id);
      const clue = inventoryExchanges(g);
      expect(clue?.type).toBe('exchanges');
      expect(isDayClue(clue!)).toBe(true);
      const start = withInventoryExchanges(g, newGame(g), evaluate(g, newGame(g)).clues);
      const ordered = orderClues(start);
      expect(ordered[0]!.clue.type).toBe('exchanges');
      expect(ordered[0]!.status).toBe('open');
      const solved = withInventoryExchanges(g, solutionState(g), evaluate(g, solutionState(g)).clues);
      expect(solved.find((r) => r.clue.type === 'exchanges')!.status).toBe('ok');
    }
    const g6 = byId(6);
    const html = renderClues(g6, evaluate(g6, newGame(g6)).clues, newGame(g6));
    expect(html).not.toContain('Aujourd’hui');
    expect(html).toContain('↑');
    // The exchanges publication comes first.
    const other = html.indexOf('data-clue="');
    if (other >= 0) expect(html.indexOf('clue-exchanges')).toBeLessThan(other);
  });

  it('the STEP pairs are not in the exchanges line; the STEP plant still counts them; grids without inventory or exports have none', () => {
    expect(inventoryExchanges(byId(7))?.step).toBeUndefined();
    expect(renderBook(byId(7), newGame(byId(7)), null)).toContain('0 / 1');
    expect(inventoryExchanges(byId(1))).toBeNull();
    expect(inventoryExchanges(byId(2))).toBeNull();
    for (const id of [8, 9, 10, 11]) expect(inventoryExchanges(byId(id))).toBeNull();
  });


  it('a tutorial sheet prints its lore line, without any technique name', () => {
    const g = grids.find((x) => x.teaches?.includes('just_enough'))!;
    const sheet = renderSheet(g, g.id);
    expect(sheet).toContain(`<p class="lead">${esc(TUTORIAL_LORE[g.id]!)}</p>`);
    expect(sheet).not.toContain('Carnet juste.');
  });
  it('the paper day list carries the exchanges line, and the card has one name', () => {
    const sheet = renderSheet(byId(6), 6);
    expect(sheet).toContain('blocs exportés');
    expect(sheet).not.toContain('Aujourd’hui');
    expect(sheet).toContain(UI.printDayTitle);
    expect(renderClues(byId(10), evaluate(byId(10), newGame(byId(10))).clues, newGame(byId(10)))).toContain('Publications du marché');
  });
});

describe('exchanges: one line per country, each checked on its own', () => {
  it('splits by country and the all-country import total, without the STEP; grid 10 keeps one line', () => {
    expect(exchangeLines({ type: 'exchanges', exports: { DE: 2 }, imports: { DE: 2 } })).toHaveLength(1);
    expect(exchangeLines({ type: 'exchanges', exports: { DE: 0, GB: 1 }, imports: { '*': 2, GB: 0 }, step: 1 })).toEqual([
      { type: 'exchanges', exports: { DE: 0 } },
      { type: 'exchanges', exports: { GB: 1 }, imports: { GB: 0 } },
      { type: 'exchanges', imports: { '*': 2 } },
    ]);
    expect(exchangeLines({ type: 'exchanges', step: 1 })).toEqual([]);
    const g10 = byId(10);
    const html = renderClues(g10, evaluate(g10, newGame(g10)).clues, newGame(g10));
    expect(html.match(/Échanges du jour/g)).toHaveLength(1);
  });

  it('a STEP published only by the exchanges clue: no pump line in the publications, the plant reads "0 / N"', () => {
    const g = byId(7);
    g.inventory = { level: 'none', pieces: {} };
    g.clues = [...g.clues, { type: 'exchanges', step: 1 }];
    const st = newGame(g);
    expect(publishedStepPairs(g)).toBe(1);
    expect(renderBook(g, st, null)).toMatch(/0 \/ 1/);
    const html = renderClues(g, evaluate(g, st).clues, st);
    expect(html).not.toMatch(/pompage/);
    expect(splitExchanges(g, st, evaluate(g, st).clues).filter((r) => r.clue.type === 'exchanges')).toEqual([]);
  });

  it('several exchanges clues are merged: one per country or per direction all count', () => {
    const g = byId(10);
    g.clues = [...g.clues.filter((c) => c.type !== 'exchanges'),
      { type: 'exchanges', exports: { DE: 1 } }, { type: 'exchanges', imports: { DE: 0 } }];
    expect(allowedExchange(g, 'DE', 'exports')).toBe(1);
    expect(allowedExchange(g, 'DE', 'imports')).toBe(0);
    const st = newGame(g);
    const lines = splitExchanges(g, st, evaluate(g, st).clues).filter((r) => r.clue.type === 'exchanges');
    expect(lines.map((r) => r.text)).toEqual(['Allemagne : ↑ 1 export, ↓ 0 import']);
    expect(renderClues(g, evaluate(g, st).clues, st).match(/Échanges du jour/g)).toHaveLength(1);
  });

  it('a country line is checked as soon as its own count is met', () => {
    const g = byId(10);
    g.neighbors = [...g.neighbors, { id: 'GB', name: 'Royaume-Uni', cap: 1, co2: 0 }];
    g.clues = [...g.clues.filter((c) => c.type !== 'exchanges'), { type: 'exchanges', exports: { DE: 2, GB: 1 }, imports: { '*': 2 } }];
    const s = initialState(g);
    const st = { ...s, exports: { ...s.exports, GB: g.columns.map((_, c) => (c === 0 ? 1 : 0)) } };
    const lines = splitExchanges(g, st, evaluate(g, st).clues).filter((r) => r.clue.type === 'exchanges');
    expect(lines.map((r) => [r.text, r.status])).toEqual([
      ['Allemagne : ↑ 2 exports, ↓ ∞ import', 'open'],
      ['Royaume-Uni : ↑ 1 export, ↓ ∞ import', 'ok'],
      ['2 blocs importés au total', 'open'],
    ]);
    expect(shownClueCount(g)).toBe(g.clues.length + 2);
    expect(renderClues(g, evaluate(g, st).clues, st)).toMatch(/Royaume-Uni : ↑ <span class="slot">1<\/span> export, ↓ ∞ import<\/span><span class="state ok"/);
  });
});

describe('verdict clue count (review S8 A1)', () => {
  it('counts the clues the card lists, the exchanges line of an exact inventory included', () => {
    const withLine = grids.filter((g) => inventoryExchanges(g));
    expect(withLine.length).toBeGreaterThan(0);
    for (const g of grids) {
      const s = solutionState(g);
      const listed = splitExchanges(g, s, withInventoryExchanges(g, s, evaluate(g, s).clues));
      expect(shownClueCount(g) - (g.co2_cap !== null ? 1 : 0)).toBe(listed.length);
      // Solved: every line, exchanges lines included, is checked.
      expect(listed.every((r) => r.status === 'ok')).toBe(true);
    }
    for (const g of withLine) {
      const k = shownClueCount(g);
      expect(UI.doneText(k, '1 min')).not.toBe(UI.doneText(g.clues.length, '1 min'));
    }
  });
});

describe('saved board and grid version (review S8 B M14)', () => {
  it('replays a board only on the grid it was saved on', () => {
    const g = byId(7);
    const s = solutionState(g);
    const saved = parseProgress(JSON.stringify(recordState(emptyProgress(), g.id, s, 5, false, gridFingerprint(g)))).grids[String(g.id)];
    expect(savedBoard(saved, g)).toEqual(s);
    const changed = { ...g, demand: g.demand.map((d, i) => (i === 0 ? d + 1 : d)) };
    expect(gridFingerprint(changed)).not.toBe(gridFingerprint(g));
    expect(savedBoard(saved, changed)).toBeUndefined();
    // an older save without fingerprint is kept
    expect(savedBoard({ status: 'started', state: s }, changed)).toEqual(s);
  });
});

describe('weather cells on the board (absolute rows)', () => {
  /** Grid 1 with a weather step: 1, 1, 2, 3, 1, 1 at the bottom, and the demand raised above it. */
  function stepped(): Grid {
    const g = byId(1);
    const R = g.columns.map((_, c) => [0, 0, 1, 2][c] ?? 0);
    g.weather = { R, F: g.columns.map(() => 1) };
    g.demand = g.demand.map((d, c) => d + 2 + R[c]!);
    return g;
  }

  it('hit-testing gives the grid row, weather rows included', () => {
    const g = stepped();
    const geo = boardGeometry(g, 'A', 50);
    expect(cellAt(geo, geo.lead + 1, (geo.rows - 1) * 50 + 1)).toEqual({ row: 0, col: 0 });
    expect(cellAt(geo, geo.lead + 50 * 3 + 1, (geo.rows - 4) * 50 + 1)).toEqual({ row: 3, col: 3 });
  });

  it('a bar above a weather step is drawn as one straight rectangle', () => {
    const g = stepped();
    const r = place(g, newGame(g), { piece: 'N', row: 3, col: 0, len: 6 });
    expect(r.ok).toBe(true);
    const state = r.ok ? r.state : newGame(g);
    const { svg, geo } = renderBoard({ grid: g, state, ev: evaluate(g, state), style: 'A', cell: 50 });
    const re = new RegExp(`<rect x="([\\d.]+)" y="([\\d.]+)" width="([\\d.]+)" height="([\\d.]+)" rx="\\d+" fill="${PIECE_COLORS.N.a}"`, 'g');
    const rects = [...svg.matchAll(re)];
    const bars = rects;
    // One rectangle, six cells wide, on row 3 of the grid.
    expect(bars).toHaveLength(1);
    expect(Number(bars[0]![3])).toBe(6 * 50 - 3);
    expect(Number(bars[0]![2])).toBe((geo.rows - 4) * 50 + 1.5);
  });

  it('the weather keeps its hatching', () => {
    const g = stepped();
    const { svg } = renderBoard({ grid: g, state: newGame(g), ev: evaluate(g, newGame(g)), style: 'A', cell: 50 });
    const weather = g.columns.reduce((a, _, c) => a + g.weather.R[c]! + g.weather.F[c]!, 0);
    expect(svg.match(/fill="url\(#h[RF]\d+\)"/g)).toHaveLength(weather);
  });

  it('the keyboard cursor never goes below the weather of its column', () => {
    const floor = [1, 1, 2, 3, 1, 1];
    expect(moveCursor({ row: 1, col: 0 }, -1, 0, floor, 5)).toEqual({ row: 1, col: 0 });
    expect(moveCursor({ row: 1, col: 1 }, 0, 1, floor, 5)).toEqual({ row: 2, col: 2 });
    expect(moveCursor({ row: 2, col: 2 }, 0, 1, floor, 5)).toEqual({ row: 3, col: 3 });
    expect(moveCursor({ row: 3, col: 3 }, 0, 1, floor, 5)).toEqual({ row: 3, col: 4 });
    expect(moveCursor({ row: 5, col: 4 }, 1, 0, floor, 5)).toEqual({ row: 5, col: 4 });
    expect(moveCursor({ row: 1, col: 5 }, 0, 1, floor, 5)).toEqual({ row: 1, col: 5 });
  });
});

describe('progress saved before weather bricks (B3)', () => {
  it('a published grid without weather replays its stored board as is, under the same key', () => {
    expect(STORAGE_KEY).toBe('dispatch:progress:v1');
    // Without weather, old and new rows mean the same cell.
    const dry = grids.filter((g) => g.weather.R.every((v) => v === 0) && g.weather.F.every((v) => v === 0));
    expect(dry.length).toBeGreaterThan(0);
    for (const g of dry) {
      const board: PlayState = JSON.parse(JSON.stringify(solutionState(g)));
      // A save as the previous version wrote it, raw JSON under the storage key.
      const raw = JSON.stringify({ grids: { [String(g.id)]: { status: 'started', state: board, elapsedMs: 1000, fp: gridFingerprint(g) } } });
      const kv: KeyValueStore = { getItem: (k) => (k === 'dispatch:progress:v1' ? raw : null), setItem: () => undefined };
      const replay = savedBoard(new ProgressStore(() => kv).get().grids[String(g.id)], g);
      expect(replay, `grid ${g.id}`).toEqual(board);
      expect(evaluate(g, replay!).solved, `grid ${g.id}`).toBe(true);
    }
  });
});

describe('exchanges under the neighbor rows', () => {
  const under = (g: Grid, s: PlayState) => renderBoard({ grid: g, state: s, ev: evaluate(g, s), style: 'A', cell: 60 }).svg;
  const counts = (svg: string) => [...svg.matchAll(/>([↑↓] [\d/∞]+)<\/tspan>/g)].map((m) => m[1]);

  it('counts the day exchanges of each direction against what is laid', () => {
    const g = byId(10);
    expect(counts(under(g, newGame(g)))).toEqual(['↑ 0/2', '↓ 0/2']);
    const s = { ...newGame(g), exports: { DE: [1, 0, 0, 0, 0, 0, 0, 0] } };
    expect(counts(under(g, s))).toEqual(['↑ 1/2', '↓ 0/2']);
  });

  it('greys a direction allowed zero times, counts published flows as laid and greens a met count', () => {
    expect(counts(under(byId(9), newGame(byId(9))))).toEqual(['↑ 0', '↓ 0/6']);
    const g7 = byId(7);
    const svg = under(g7, applyLockedExports(g7, newGame(g7)));
    // Two exports published by flows: already laid; the exact inventory gives 2 imports.
    expect(counts(svg)).toEqual(['↑ 2/2', '↓ 0/2']);
    expect(svg).toMatch(new RegExp(`fill="${OK}">↑ 2/2</tspan>`));
  });

  it('an import record of one country sits on its row, not under the hours', () => {
    const g = byId(10);
    const nb = g.neighbors[0]!;
    const plain = renderBoard({ grid: g, state: newGame(g), ev: evaluate(g, newGame(g)), style: 'A', cell: 60 });
    g.clues = [...g.clues, { type: 'column', col: 2, counts: { [`I:${nb.id}`]: 1 } }];
    const withRecord = renderBoard({ grid: g, state: newGame(g), ev: evaluate(g, newGame(g)), style: 'A', cell: 60 });
    expect(withRecord.svg.match(/class="import-record"/g)).toHaveLength(1);
    expect(withRecord.svg).toContain('Relevé d’import : 1.');
    // No band item for it: the band keeps its height.
    expect(withRecord.geo.height).toBe(plain.geo.height);
  });

  it('an Import plant takes the published total of its country as quota; ∞ without one or with a shared total', () => {
    const g = byId(10);
    const row = (grid: Grid, id: string) => renderBook(grid, newGame(grid), null).split(`data-piece="I:${id}"`)[1]!.split('data-piece=')[0]!;
    expect(row(g, 'DE')).toContain('0 / 2');
    const free = { ...g, clues: g.clues.filter((c) => c.type !== 'exchanges') };
    expect(row(free, 'DE')).toContain('0 / ∞');
    const shared = { ...g, clues: g.clues.map((c) => (c.type === 'exchanges' ? { ...c, imports: { '*': 2 } } : c)) };
    expect(row(shared, 'DE')).toContain('0 / ∞');
  });

  it('the legend is one regular string; the card has the same margin left and right of the grid', () => {
    const g = byId(10);
    const { svg, geo } = renderBoard({ grid: g, state: newGame(g), ev: evaluate(g, newGame(g)), style: 'A', cell: 60 });
    expect(svg).toMatch(/>↑ 0\/2<\/tspan> <tspan[^>]*>↓ 0\/2<\/tspan> · Allemagne · 1 bloc par créneau<\/text>/);
    const [vx, , vw] = svg.match(/viewBox="([^"]+)"/)![1]!.split(' ').map(Number);
    const left = geo.lead - vx!;
    const right = vx! + vw! - (geo.lead + geo.n * geo.cell);
    expect(right).toBe(left);
    expect(geo.lead).toBeGreaterThan(0); // the country codes stay in the left gutter
  });

  it('reads ∞ for an unknown count or a total shared by every neighbor', () => {
    const g = byId(10);
    const free = { ...g, clues: g.clues.filter((c) => c.type !== 'exchanges') };
    expect(counts(under(free, newGame(free)))).toEqual(['↑ 0/∞', '↓ 0/∞']);
    const shared = { ...g, clues: g.clues.map((c) => (c.type === 'exchanges' ? { ...c, imports: { '*': 2 } } : c)) };
    expect(counts(under(shared, newGame(shared)))).toEqual(['↑ 0/2', '↓ 0/∞']);
  });
});
