/*
 * Game screen: board, tools, order book, clues; laying by drag, two taps or keyboard.
 * - Board changes go through the engine actions and an undo history; progress is saved after
 *   each change.
 * - Remove a plant with the eraser, a right click or a long press; invalid plants stay on the
 *   board, hatched in red, until the player removes them.
 */
import type { Grid, Placement } from '../model/grid';
import {
  barIndexAt, checkPlaceOver, evaluate, newGame, placeOver, remove, removeStep, addStep, setExport, exportsAt,
  importsAt, type Evaluation, type PlayState,
} from '../engine';
import { MSG, TECHNIQUES, UI, columnLabel, durationText, placementLabel } from '../i18n/fr';
import { lockedExports, renderBoard, cellAt, type BoardGeometry } from './board';
import {
  cancel, idle, moveTo, press, previewRect, release, tap, type Cell, type GestureState, type Rect, type Shape,
} from './gesture';
import { canUndo, push, reset, start, undo, type History } from './history';
import { STEP_KEY, bookEntries, publishedStepPairs, renderBook, renderClues, renderCo2, type BookEntry } from './panels';
import { esc, icon } from './palette';
import { dailyGrid, nextGrid, recordState, type ProgressStore } from './progress';

export interface GameContext {
  grids: readonly Grid[];
  store: ProgressStore;
  navigate: (hash: string) => void;
  print: (grid: Grid) => void;
}

type Tone = 'ok' | 'bad' | 'info';

const LONG_PRESS_MS = 550;
const MIN_CELL = 32;
const MAX_CELL = 54;

/** Initial board: engaged plants and the exports fixed by published flows. */
export function initialState(grid: Grid): PlayState {
  return applyLockedExports(grid, newGame(grid));
}

/** Force the exports fixed by flow clues (a saved board may predate them). */
export function applyLockedExports(grid: Grid, state: PlayState): PlayState {
  let s = state;
  for (const [key, value] of lockedExports(grid)) {
    const [country, col] = key.split(':') as [string, string];
    if (exportsAt(s, country, Number(col)) === value) continue;
    const r = setExport(grid, s, country, Number(col), value);
    if (r.ok) s = r.state;
  }
  return s;
}

/** Display title: tutorial titles lose their number, rated grids named after their level get a number. */
export function displayTitle(grid: Grid): string {
  if (grid.section === 'tutorial') return grid.title.replace(/^\d+\.\s*/, '');
  return grid.title === grid.difficulty.label ? UI.gridNumber(grid.id) : grid.title;
}

export const DIFF_CLASS: Record<number, string> = { 1: 'd1', 2: 'd2', 3: 'd3', 4: 'd4' };

/** Next export value when the player taps a neighbor pill: +1, back to 0 past the capacity. */
export function nextExportValue(current: number, imports: number, cap: number): number {
  return current + 1 + imports > cap ? 0 : current + 1;
}

export function mountGame(root: HTMLElement, grid: Grid, ctx: GameContext): () => void {
  const saved = ctx.store.get().grids[String(grid.id)];
  const initial = initialState(grid);
  let history: History<PlayState> = start(saved?.state ? applyLockedExports(grid, saved.state) : initial);
  let ev: Evaluation = evaluate(grid, history.present);
  const entries = bookEntries(grid);
  let selected: BookEntry | null = entries[0] ?? null;
  let erase = false;
  let gesture: GestureState = idle();
  let cursor: Cell | null = null;
  /** The keyboard cursor shows only after a key press, not after a pointer gesture. */
  let keyboard = false;
  let stepPending: number | null = null;
  let message: { text: string; tone: Tone } | null = null;
  let cell = MAX_CELL;
  let geo: BoardGeometry | null = null;
  let longPress: number | undefined;
  let longPressFired = false;
  /** Pill or tag pressed by a pointer: activated when the same one is released (mouse and touch). */
  let pressedAct: string | null = null;
  const elapsedBase = saved?.elapsedMs ?? 0;
  const sessionStart = Date.now();
  let frozenElapsed: number | null = saved?.status === 'done' && ev.solved ? elapsedBase : null;
  const elapsed = () => frozenElapsed ?? elapsedBase + (Date.now() - sessionStart);

  const tutorials = ctx.grids.filter((g) => g.section === 'tutorial').sort((a, b) => a.id - b.id);
  const daily = dailyGrid(ctx.grids, new Date());
  const eyebrow = grid.section === 'tutorial'
    ? UI.tutorialOf(tutorials.findIndex((g) => g.id === grid.id) + 1, tutorials.length)
    : `${daily?.id === grid.id ? UI.daily : UI.ratedEyebrow}${grid.inventory.level === 'none' ? ` · ${UI.noInventory}` : ''}`;

  const techniques = (grid.teaches ?? []).map((t) => TECHNIQUES[t]?.name).filter(Boolean) as string[];
  const intro = grid.intro
    ? `<div class="intro"><span class="eyebrow">${esc(techniques.length ? UI.techniqueOfDay : UI.instructions)}</span>`
      + (techniques.length ? `<b>${esc(techniques.join(' · '))}</b>` : '')
      + `<span>${esc(grid.intro)}</span></div>`
    : '';

  root.innerHTML = `<div class="m game">
    <header class="top">
      <div class="title"><a class="backlink" href="#/">${icon('back')}${esc(UI.back)}</a>
        <div class="eyebrow">${esc(eyebrow)}</div><h1>${esc(displayTitle(grid))}</h1></div>
      <span class="diff ${DIFF_CLASS[grid.difficulty.rating] ?? 'd1'}">${esc(grid.difficulty.label)}</span>
    </header>
    ${intro}
    <div class="play">
      <div class="board-wrap" tabindex="0" role="group" aria-label="${esc(UI.gridAria(displayTitle(grid)))}" aria-describedby="board-help-${grid.id}">
        <div class="board-scroll"></div>
      </div>
      <input type="range" class="board-slider" min="0" max="0" value="0" aria-label="${esc(UI.scrollBoard)}" hidden>
      <p id="board-help-${grid.id}" class="sr-only">${esc(UI.boardHelp)}</p>
      <div class="tools" role="toolbar" aria-label="${esc(UI.toolsLabel)}">
        <button type="button" class="tool" data-tool="erase" aria-pressed="false">${icon('erase')}${esc(UI.tools.erase)}</button>
        <button type="button" class="tool" data-tool="undo">${icon('undo')}${esc(UI.tools.undo)}</button>
        <button type="button" class="tool" data-tool="reset">${icon('reset')}${esc(UI.tools.reset)}</button>
        <button type="button" class="tool print-tool" data-tool="print">${icon('print')}${esc(UI.tools.print)}</button>
      </div>
      <div class="msg-slot" aria-live="polite"></div>
    </div>
    <div class="side"></div>
  </div>`;

  const wrap = root.querySelector<HTMLElement>('.board-wrap')!;
  const scroll = root.querySelector<HTMLElement>('.board-scroll')!;
  const slider = root.querySelector<HTMLInputElement>('.board-slider')!;
  const side = root.querySelector<HTMLElement>('.side')!;
  const msgSlot = root.querySelector<HTMLElement>('.msg-slot')!;
  const tools = root.querySelector<HTMLElement>('.tools')!;

  const shapeOf = (e: BookEntry): Shape => ({ lens: e.lens, heights: e.heights });

  const barOf = (e: BookEntry, r: Rect): Placement => {
    const bar: Placement = { piece: e.piece as Placement['piece'], row: r.row, col: r.col, len: r.len };
    if (r.height !== 1) bar.height = r.height;
    if (e.country) bar.country = e.country;
    return bar;
  };
  const labelOf = (b: Placement) => placementLabel(grid, b.piece, b.country, b.row, b.col, b.len, b.height ?? 1);

  // ---- rendering
  function preview() {
    if (!selected || erase || selected.piece === STEP_KEY) return null;
    const r = previewRect(gesture, shapeOf(selected));
    if (!r) return null;
    const bar = barOf(selected, r);
    const check = checkPlaceOver(grid, history.present, bar);
    return { bar, check, rect: r };
  }

  function drawBoard() {
    const pv = preview();
    const out = renderBoard({
      grid, state: history.present, ev, style: 'A', cell,
      preview: pv ? { rect: pv.rect, piece: pv.bar.piece, valid: pv.check.ok, replacing: pv.check.ok ? pv.check.replaced : [] } : null,
      anchor: gesture.anchor, cursor: keyboard && document.activeElement === wrap ? cursor : null, stepPending, interactive: true,
    });
    geo = out.geo;
    scroll.innerHTML = out.svg;
    wrap.classList.toggle('placing', !!selected && !erase);
    wrap.classList.toggle('erasing', erase);
    syncSlider();
    drawMessage(pv);
  }

  /** Wide boards (touch-action none while placing) scroll with a slider under the grid. */
  function syncSlider() {
    const max = Math.max(0, scroll.scrollWidth - scroll.clientWidth);
    slider.hidden = max <= 0;
    slider.max = String(max);
    slider.value = String(Math.round(scroll.scrollLeft));
  }

  function drawMessage(pv: ReturnType<typeof preview> = preview()) {
    if (ev.solved) {
      const next = nextGrid(ctx.grids, grid.id);
      msgSlot.innerHTML = `<div class="banner" role="status"><b>${esc(UI.doneTitle)}</b>`
        + `<span>${esc(UI.doneText(grid.clues.length, durationText(elapsed())))}</span></div>`
        + `<div class="tools done-tools">${next ? `<a class="tool on" href="#/grille/${next.id}">${esc(UI.next)}${icon('next')}</a>` : `<a class="tool on" href="#/">${esc(UI.home)}</a>`}`
        + `<button type="button" class="tool" data-tool="print">${icon('print')}${esc(UI.tools.print)}</button></div>`;
      return;
    }
    let m = message;
    if (pv && (gesture.drag || gesture.anchor)) {
      const label = labelOf(pv.bar);
      const over = pv.check.replaced.map((i) => history.present.bars[i]!).filter(Boolean);
      if (!pv.check.ok) m = { text: UI.poseBad(label, pv.check.error.message), tone: 'bad' };
      else m = { text: over.length ? UI.poseOver(label, UI.replaces(grid, over)) : UI.poseOk(label), tone: 'ok' };
    } else if (gesture.anchor && selected) {
      m = { text: UI.hintSecondTap(labelOf(barOf(selected, { ...gesture.anchor, len: 1, height: 1 }))), tone: 'info' };
    } else if (!m) {
      if (ev.invalidBars.length) m = { text: `${UI.invalidBars(ev.invalidBars.length)} ${ev.errors[0]?.message ?? ''}`, tone: 'bad' };
      else if (ev.errors.length) m = { text: ev.errors[0]!.message, tone: 'bad' };
      else m = { text: erase ? UI.hintErase : selected?.piece === STEP_KEY ? UI.hintStep : UI.hintChoose, tone: 'info' };
    }
    msgSlot.innerHTML = `<div class="msg ${m.tone}">${esc(m.text)}</div>`;
  }

  function drawSide() {
    const bookTitle = grid.inventory.level === 'exact' ? UI.book : UI.available;
    const bookHint = grid.inventory.level === 'exact' ? UI.bookHint : UI.availableHint;
    side.innerHTML = `<section class="card" aria-label="${esc(bookTitle)}"><h2 class="ct">${esc(bookTitle)} <small>${esc(bookHint)}</small></h2>`
      + `${renderBook(grid, history.present, erase ? null : selected?.key ?? null)}</section>`
      + renderClues(grid, ev.clues) + renderCo2(grid, history.present);
  }

  function drawTools() {
    const er = tools.querySelector<HTMLButtonElement>('[data-tool="erase"]')!;
    er.classList.toggle('on', erase);
    er.setAttribute('aria-pressed', String(erase));
    tools.querySelector<HTMLButtonElement>('[data-tool="undo"]')!.disabled = !canUndo(history);
  }

  function drawAll() {
    drawBoard();
    drawSide();
    drawTools();
  }

  // ---- state changes
  function commit(next: PlayState, text: string | null, tone: Tone = 'ok') {
    const wasSolved = ev.solved;
    history = push(history, next);
    afterChange(wasSolved);
    message = text ? { text, tone } : null;
    drawAll();
  }

  function afterChange(wasSolved: boolean) {
    ev = evaluate(grid, history.present);
    if (ev.solved && !wasSolved) frozenElapsed = elapsedBase + (Date.now() - sessionStart);
    if (!ev.solved) frozenElapsed = null;
    save();
  }

  function save() {
    ctx.store.set(recordState(ctx.store.get(), grid.id, history.present, elapsed(), ev.solved));
  }

  function say(text: string, tone: Tone) {
    message = { text, tone };
    drawMessage();
  }

  function layAt(r: Rect) {
    if (!selected) return;
    const bar = barOf(selected, r);
    const res = placeOver(grid, history.present, bar);
    if (res.ok) commit(res.state, res.replaced.length ? UI.poseOver(labelOf(bar), UI.replaces(grid, res.replaced)) : UI.poseOk(labelOf(bar)));
    else { message = { text: UI.poseBad(labelOf(bar), res.error.message), tone: 'bad' }; drawBoard(); }
  }

  function removeAt(c: Cell) {
    const i = barIndexAt(history.present, c.row, c.col);
    if (i < 0 && isStepCell(c) && removePairAt(c.col)) return;
    const bar = i >= 0 ? history.present.bars[i] : undefined;
    const res = remove(history.present, c.row, c.col);
    if (res.ok && bar) commit(res.state, UI.removed(labelOf(bar)), 'info');
    else if (!res.ok) say(res.error.message, 'bad');
  }

  function select(key: string) {
    selected = entries.find((e) => e.key === key) ?? selected;
    if (selected?.piece !== STEP_KEY) stepPending = null;
    erase = false;
    gesture = cancel(gesture);
    message = null;
    drawAll();
  }

  function cycleExport(country: string, col: number) {
    const nb = grid.neighbors.find((x) => x.id === country);
    if (!nb) return;
    const cur = exportsAt(history.present, country, col);
    const imp = importsAt(history.present, country, col);
    let value = nextExportValue(cur, imp, nb.cap);
    let res = setExport(grid, history.present, country, col, value);
    if (!res.ok && value > 0 && cur > 0) { value = 0; res = setExport(grid, history.present, country, col, 0); }
    if (!res.ok) say(res.error.message, 'bad');
    else if (exportsAt(res.state, country, col) !== cur) commit(res.state, null);
  }

  /** STEP chosen: the first tap pumps, a tap on a later slot turbines. */
  function stepTap(col: number) {
    const s0 = history.present;
    const at = (c: number) => columnLabel(grid, c);
    if (stepPending === null) {
      if (col === grid.columns.length - 1) { say(UI.stepLastSlot, 'bad'); return; }
      const want = publishedStepPairs(grid);
      if (grid.inventory.level === 'exact' && want !== null && s0.step.length >= want) { say(MSG.stepCount(want), 'bad'); return; }
      stepPending = col;
      message = { text: UI.stepPending(at(col)), tone: 'info' };
      drawBoard();
      return;
    }
    if (col <= stepPending) { say(UI.stepTooEarly(at(stepPending)), 'bad'); return; }
    const pump = stepPending;
    const res = addStep(grid, s0, pump, col);
    if (!res.ok) { say(res.error.message, 'bad'); return; }
    stepPending = null;
    commit(res.state, UI.stepAdded(at(pump), at(col)));
  }

  /** Remove the STEP pair pumping or turbining in a column. */
  function removePairAt(col: number): boolean {
    const k = history.present.step.findIndex((p) => p.pump === col || p.turbine === col);
    if (k < 0) return false;
    const res = removeStep(history.present, k);
    if (res.ok) commit(res.state, UI.stepRemoved, 'info');
    return res.ok;
  }

  /** Is this empty cell a pumped cell or a turbined ghost (eraser target)? */
  function isStepCell(c: Cell): boolean {
    const s0 = history.present;
    const pumps = s0.step.filter((p) => p.pump === c.col).length;
    const turbs = s0.step.filter((p) => p.turbine === c.col).length;
    const top = ev.silhouette[c.col] ?? 0;
    return (pumps > 0 && c.row >= top - pumps && c.row < top) || (turbs > 0 && c.row >= top && c.row < top + turbs);
  }

  // ---- pointer input
  function cellFromEvent(ev: PointerEvent | MouseEvent): Cell | null {
    const svg = scroll.querySelector('svg');
    if (!svg || !geo) return null;
    const rect = svg.getBoundingClientRect();
    const sx = geo.width / rect.width;
    const sy = geo.height / rect.height;
    const x = (ev.clientX - rect.left) * sx - 2;
    const y = (ev.clientY - rect.top) * sy - geo.topPad;
    if (y >= geo.rows * geo.cell) return null;
    return cellAt(geo, x, y);
  }

  const clearLongPress = () => { if (longPress !== undefined) { window.clearTimeout(longPress); longPress = undefined; } };

  function onPointerDown(e: PointerEvent) {
    keyboard = false;
    const act = (e.target as Element).closest('[data-act]');
    pressedAct = act ? actKey(act) : null;
    if (act) return;
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    const c = cellFromEvent(e);
    if (!c) return;
    cursor = c;
    if (erase) { removeAt(c); return; }
    if (selected?.piece === STEP_KEY) { stepTap(c.col); return; }
    const occupied = barIndexAt(history.present, c.row, c.col) >= 0;
    longPressFired = false;
    if (occupied && e.pointerType !== 'mouse') {
      longPress = window.setTimeout(() => {
        longPressFired = true;
        gesture = cancel(gesture);
        removeAt(c);
      }, LONG_PRESS_MS);
    }
    if (!selected) return;
    scroll.setPointerCapture(e.pointerId);
    gesture = press(gesture, c);
    drawBoard();
  }

  function onPointerMove(e: PointerEvent) {
    const c = cellFromEvent(e);
    if (!c || !selected || erase) return;
    const before = gesture;
    gesture = moveTo(gesture, c);
    if (gesture.drag && before.drag && (before.drag.current.row !== c.row || before.drag.current.col !== c.col)) clearLongPress();
    if (gesture !== before && (gesture.drag || gesture.anchor)) drawBoard();
  }

  function onPointerUp(e: PointerEvent) {
    clearLongPress();
    if (pressedAct !== null) {
      const act = (e.target as Element).closest('[data-act]');
      if (act && actKey(act) === pressedAct) activate(act);
      pressedAct = null;
      return;
    }
    if (!gesture.drag || !selected) return;
    if (longPressFired) { gesture = cancel(gesture); drawBoard(); return; }
    const c = cellFromEvent(e) ?? gesture.drag.current;
    const r = release(gesture, c, shapeOf(selected));
    gesture = r.state;
    if (r.commit) layAt(r.commit);
    else drawBoard();
  }

  function onPointerCancel() {
    clearLongPress();
    gesture = { ...gesture, drag: null };
    drawBoard();
  }

  function onContextMenu(e: MouseEvent) {
    e.preventDefault();
    if (longPressFired) return;
    const c = cellFromEvent(e);
    if (c) { gesture = cancel(gesture); removeAt(c); }
  }

  /** Identity of a pill or tag across re-renders. */
  const actKey = (el: Element) => ['data-act', 'data-col', 'data-country'].map((a) => el.getAttribute(a) ?? '').join('|');

  function activate(el: Element) {
    const col = Number(el.getAttribute('data-col'));
    if (el.getAttribute('data-act') === 'export') cycleExport(el.getAttribute('data-country') ?? '', col);
    else if (el.getAttribute('data-act') === 'step-tag') removePairAt(col);
    const again = scroll.querySelector<SVGElement>(`[data-act="${el.getAttribute('data-act')}"][data-col="${col}"]${el.getAttribute('data-country') ? `[data-country="${el.getAttribute('data-country')}"]` : ''}`);
    if (again && document.activeElement !== again && el === document.activeElement) again.focus();
  }

  // ---- keyboard
  function onKeyDown(e: KeyboardEvent) {
    keyboard = true;
    const act = (e.target as Element).closest?.('[data-act]');
    if (act && (e.key === 'Enter' || e.key === ' ')) {
      e.preventDefault();
      const key = `[data-act="${act.getAttribute('data-act')}"][data-col="${act.getAttribute('data-col')}"]`;
      activate(act);
      scroll.querySelector<SVGElement>(key)?.focus();
      return;
    }
    if (e.target !== wrap) return;
    const n = grid.columns.length;
    const c = cursor ?? { row: 0, col: 0 };
    const moves: Record<string, [number, number]> = { ArrowLeft: [0, -1], ArrowRight: [0, 1], ArrowUp: [1, 0], ArrowDown: [-1, 0] };
    const mv = moves[e.key];
    if (mv) {
      e.preventDefault();
      const top = Math.max(1, ...ev.silhouette) - 1;
      cursor = { row: Math.min(top, Math.max(0, c.row + mv[0])), col: Math.min(n - 1, Math.max(0, c.col + mv[1])) };
      gesture = moveTo(gesture, cursor);
      drawBoard();
      scrollCursorIntoView();
      return;
    }
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      cursor = c;
      if (erase) { removeAt(c); return; }
      if (selected?.piece === STEP_KEY) { stepTap(c.col); return; }
      if (!selected) return;
      const r = tap(gesture, c, shapeOf(selected));
      gesture = r.state;
      if (r.commit) layAt(r.commit);
      else drawBoard();
      return;
    }
    if (e.key === 'Delete' || e.key === 'Backspace') { e.preventDefault(); removeAt(c); return; }
    if (e.key === 'Escape') {
      gesture = cancel(gesture);
      stepPending = null;
      message = null;
      drawBoard();
    }
  }

  function scrollCursorIntoView() {
    if (!cursor || !geo) return;
    const x = cursor.col * geo.cell;
    if (x < scroll.scrollLeft) scroll.scrollLeft = x;
    else if (x + geo.cell > scroll.scrollLeft + scroll.clientWidth) scroll.scrollLeft = x + geo.cell - scroll.clientWidth + 8;
  }

  // ---- tools and side panel
  function onToolClick(e: MouseEvent) {
    const btn = (e.target as Element).closest<HTMLElement>('[data-tool]');
    if (!btn) return;
    const tool = btn.getAttribute('data-tool');
    if (tool === 'erase') {
      erase = !erase;
      stepPending = null;
      gesture = cancel(gesture);
      message = null;
      drawAll();
    } else if (tool === 'undo') {
      if (!canUndo(history)) { say(UI.nothingToUndo, 'info'); return; }
      const wasSolved = ev.solved;
      history = undo(history);
      afterChange(wasSolved);
      message = { text: UI.undone, tone: 'info' };
      drawAll();
    } else if (tool === 'reset') {
      const wasSolved = ev.solved;
      history = reset(history, initial);
      gesture = idle();
      stepPending = null;
      afterChange(wasSolved);
      message = { text: UI.resetDone, tone: 'info' };
      drawAll();
    } else if (tool === 'print') {
      ctx.print(grid);
    }
  }

  function onSideClick(e: MouseEvent) {
    const row = (e.target as Element).closest<HTMLElement>('[data-piece]');
    if (row) select(row.getAttribute('data-piece') ?? '');
  }

  function onWrapFocus() { keyboard = wrap.matches(':focus-visible'); if (!cursor) cursor = { row: 0, col: 0 }; drawBoard(); }
  function onWrapBlur() { drawBoard(); }

  // ---- size
  function fit() {
    // Desktop: the board column is as wide as the board, so measure what the side column leaves.
    const game = root.querySelector<HTMLElement>('.game')!;
    const oneColumn = window.matchMedia('(max-width: 860px)').matches;
    const avail = (oneColumn ? wrap.clientWidth : game.clientWidth - 340 - 30 - 48) - 6;
    const n = grid.columns.length;
    const next = Math.max(MIN_CELL, Math.min(MAX_CELL, Math.floor(avail / n)));
    if (next !== cell || !geo) { cell = next; drawBoard(); } else syncSlider();
  }
  const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(fit) : null;
  ro?.observe(root.querySelector<HTMLElement>('.game')!);

  slider.addEventListener('input', () => { scroll.scrollLeft = Number(slider.value); });
  scroll.addEventListener('scroll', () => { slider.value = String(Math.round(scroll.scrollLeft)); });
  scroll.addEventListener('pointerdown', onPointerDown);
  scroll.addEventListener('pointermove', onPointerMove);
  scroll.addEventListener('pointerup', onPointerUp);
  scroll.addEventListener('pointercancel', onPointerCancel);
  scroll.addEventListener('contextmenu', onContextMenu);
  wrap.addEventListener('keydown', onKeyDown);
  wrap.addEventListener('focus', onWrapFocus);
  wrap.addEventListener('blur', onWrapBlur);
  root.addEventListener('click', onToolClick);
  side.addEventListener('click', onSideClick);
  const onLeave = () => save();
  window.addEventListener('pagehide', onLeave);

  drawAll();
  fit();

  return () => {
    if (history.past.length || saved) save();
    ro?.disconnect();
    clearLongPress();
    window.removeEventListener('pagehide', onLeave);
  };
}
