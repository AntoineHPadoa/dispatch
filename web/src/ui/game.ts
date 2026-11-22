/*
 * Game screen: board, tools, order book, clues; laying by drag, two taps or keyboard.
 * - Board changes go through the engine actions and an undo history; progress is saved after
 *   each change.
 * - Remove a plant with the eraser, a right click or a long press; invalid plants stay on the
 *   board, hatched in red, until the player removes them.
 * - The message slot is rewritten only when its HTML changes: a redraw never replaces a banner
 *   link under a pointer that is pressing it.
 * - Touch: with a piece one row high the board lets vertical swipes scroll the page; a swipe the
 *   browser takes for scrolling cancels the gesture silently. Eraser and STEP taps act on release.
 */
import { localIsoDate, weekdayIndex } from '../model/bulletin';
import type { Grid, Placement } from '../model/grid';
import { kindOf } from '../model/shapes';
import {
  barIndexAt, checkPlaceOver, evaluate, newGame, placeOver, remove, removeStep, setExport, exportsAt,
  importsAt, type ClueReport, type Evaluation, type PlayState,
} from '../engine';
import { MSG, TUTORIAL_LORE, UI, columnLabel, countryTo, durationText, placementLabel, slotClueShort } from '../i18n/fr';
import { siteHead } from './home-art';
import { boardLead, lockedExports, renderBoard, cellAt, type BoardGeometry } from './board';
import {
  alongShape, cancel, idle, isFlat, moveCursor, moveTo, press, previewRect, release, tap, type Cell, type GestureState, type Rect, type Shape,
} from './gesture';
import { canUndo, push, reset, start, undo, type History } from './history';
import { STEP_KEY, bookEntries, publishedStepPairs, renderBook, renderChips, renderClues, renderCo2, shownClueCount, type BookEntry } from './panels';
import { esc, icon } from './palette';
import { stepArrowAction, stepEraseResult, stepPairIndexAt, stepTapResult, stepUndoPlan } from './step';
import { gridFingerprint, nextGrid, recordState, savedBoard, statusOf, type ProgressStore } from './progress';

export interface GameContext {
  grids: readonly Grid[];
  store: ProgressStore;
  navigate: (hash: string) => void;
  /** Optional observer of play events (the lab counts errors, undos, erasures). */
  onEvent?: (event: GameEvent) => void;
  /** Replaces the "rated grid" eyebrow of a grid without a bulletin tag (the lab shows a neutral label). */
  ratedEyebrow?: string;
}

/** Eyebrow tag of the game screen: tutorial rank, else bulletin tag or the rated label (`ratedEyebrow` overrides it). */
export function gameEyebrow(grid: Grid, grids: readonly Grid[], ratedEyebrow?: string): string {
  const tutorials = grids.filter((g) => g.section === 'tutorial').sort((a, b) => a.id - b.id);
  return grid.section === 'tutorial'
    ? UI.tutorialOf(tutorials.findIndex((g) => g.id === grid.id) + 1, tutorials.length)
    : `${bulletinTag(grid) ?? ratedEyebrow ?? UI.ratedEyebrow}${grid.inventory.level === 'none' ? ` · ${UI.noInventory}` : ''}`;
}

/** What the player did: a refused or clue-breaking pose, an undo, an erasure, a reset, the solve. */
/** 'move': the board changed by a pose, an export or a STEP pair (the lab tells a real game from a stray open). */
export type GameEvent = 'move' | 'error' | 'undo' | 'erase' | 'reset' | 'solved';

export type Tone = 'ok' | 'bad' | 'info';

const LONG_PRESS_MS = 550;
const MIN_CELL = 30;
const MAX_CELL = 60;

/** Initial board: engaged plants and the exports fixed by published flows. */
export function initialState(grid: Grid): PlayState {
  return applyLockedExports(grid, newGame(grid));
}

/** Is the board as a new game leaves it (no plant, no STEP pair, only the published exports)? */
export function isInitialState(grid: Grid, state: PlayState): boolean {
  if (state.bars.length || state.step.length) return false;
  const start = initialState(grid);
  return grid.neighbors.every((nb) => grid.columns.every((_, col) => exportsAt(state, nb.id, col) === exportsAt(start, nb.id, col)));
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

/** Issue tag of a grid that has a bulletin (`n° 214 · sam.`), or null. */
export function bulletinTag(grid: Grid): string | null {
  const b = grid.bulletin;
  return b ? UI.bulletin.sheetTag(b.number, UI.bulletin.weekdayShort[weekdayIndex(b.published)] ?? '') : null;
}

/** Display title: bulletin headline, tutorial titles without their number, else a numbered rated grid. */
export function displayTitle(grid: Grid): string {
  if (grid.bulletin) return grid.bulletin.title;
  if (grid.section === 'tutorial') return grid.title.replace(/^\d+\.\s*/, '');
  return grid.title === grid.difficulty.label ? UI.gridNumber(grid.id) : grid.title;
}

export const DIFF_CLASS: Record<number, string> = { 1: 'd1', 2: 'd2', 3: 'd3', 4: 'd4' };

/**
 * Message under the board when nothing is being laid: the last action's message, else the reason
 * a fully covered board is not solved, else rule errors, else the idle hint (null).
 */
export function boardMessage(ev: Evaluation, last: { text: string; tone: Tone } | null): { text: string; tone: Tone } | null {
  const full = !ev.solved && ev.missing === 0 && ev.unmet.length > 0;
  if (full && (!last || last.tone !== 'bad')) return { text: ev.unmet[0]!, tone: 'bad' };
  if (last) return last;
  if (ev.invalidBars.length) return { text: `${UI.invalidBars(ev.invalidBars.length)} ${ev.errors[0]?.message ?? ''}`, tone: 'bad' };
  if (ev.errors.length) return { text: ev.errors[0]!.message, tone: 'bad' };
  return null;
}

/** Next export value when the player taps a neighbor pill: +1, back to 0 past the capacity. */
export function nextExportValue(current: number, imports: number, cap: number): number {
  return current + 1 + imports > cap ? 0 : current + 1;
}

/**
 * A tap on a neighbor pill: the next export value, or the reason it is refused (line already
 * full with imports, inventory spent). `state` is null when nothing changes.
 */
export function exportTap(grid: Grid, state: PlayState, country: string, col: number): { state: PlayState | null; refused?: string } {
  const nb = grid.neighbors.find((x) => x.id === country);
  if (!nb) return { state: null };
  const cur = exportsAt(state, country, col);
  const imp = importsAt(state, country, col);
  if (cur === 0 && imp + 1 > nb.cap) return { state: null, refused: MSG.line(countryTo(grid, country), columnLabel(grid, col)) };
  let value = nextExportValue(cur, imp, nb.cap);
  let res = setExport(grid, state, country, col, value);
  if (!res.ok && value > 0 && cur > 0) { value = 0; res = setExport(grid, state, country, col, 0); }
  if (!res.ok) return { state: null, refused: res.error.message };
  return { state: exportsAt(res.state, country, col) !== cur ? res.state : null };
}

/** First clue a change turned to contradicted (null when none did). */
export function newlyBroken(before: readonly ClueReport[], after: readonly ClueReport[]): ClueReport | null {
  return after.find((c, i) => c.status === 'broken' && before[i]?.status !== 'broken') ?? null;
}

/** Message after a successful pose: a contradicted clue first, else what was replaced, else "it fits". */
export function poseMessage(grid: Grid, label: string, replaced: readonly { piece: string; country?: string }[],
  broken: ClueReport | null): { text: string; tone: Tone } {
  if (broken) return { text: UI.poseContradicts(label, slotClueShort(grid, broken.clue)), tone: 'bad' };
  return { text: replaced.length ? UI.poseOver(label, UI.replaces(grid, replaced)) : UI.poseOk(label), tone: 'ok' };
}

export function mountGame(root: HTMLElement, grid: Grid, ctx: GameContext): () => void {
  const saved = ctx.store.get().grids[String(grid.id)];
  const initial = initialState(grid);
  const fp = gridFingerprint(grid);
  const board = savedBoard(saved, grid);
  let history: History<PlayState> = start(board ? applyLockedExports(grid, board) : initial);
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
  /** Last HTML written to the message slot. */
  let msgHtml = '';
  /** Pill or tag pressed by a pointer: activated when the same one is released (mouse and touch). */
  let pressedAct: string | null = null;
  /** Touch tap with the eraser or STEP: done on release, forgotten if the page scrolls instead. */
  let pendingTap: Cell | null = null;
  const elapsedBase = saved?.elapsedMs ?? 0;
  const sessionStart = Date.now();
  let frozenElapsed: number | null = saved?.status === 'done' && ev.solved ? elapsedBase : null;
  const elapsed = () => frozenElapsed ?? elapsedBase + (Date.now() - sessionStart);

  const eyebrow = gameEyebrow(grid, ctx.grids, ctx.ratedEyebrow);

  // A tutorial gets a lore line instead of an instructions card.
  const lore = grid.teaches?.length ? TUTORIAL_LORE[grid.id] : undefined;
  const intro = lore ? `<p class="intro lore">${esc(lore)}</p>`
    : grid.intro && !grid.teaches?.length
      ? `<div class="intro"><span class="eyebrow">${esc(UI.instructions)}</span><span>${esc(grid.intro)}</span></div>`
      : '';

  root.innerHTML = `<div class="m game">
    ${siteHead()}
    <header class="ttl">
      <div class="title"><div class="eyebrow">${esc(eyebrow)}</div><h1>${esc(displayTitle(grid))}</h1></div>
      <span class="diff ${DIFF_CLASS[grid.difficulty.rating] ?? 'd1'}">${esc(grid.difficulty.label)}</span>
    </header>
    ${intro}
    <div class="play">
      <div class="card board-card">
        <div class="board-wrap" tabindex="0" role="group" aria-label="${esc(UI.gridAria(displayTitle(grid)))}" aria-describedby="board-help-${grid.id}">
          <div class="board-scroll"></div>
        </div>
        <input type="range" class="board-slider" min="0" max="0" value="0" aria-label="${esc(UI.scrollBoard)}" hidden>
      </div>
      <p id="board-help-${grid.id}" class="sr-only">${esc(UI.boardHelp)}</p>
      <div class="chips" role="toolbar" aria-label="${esc(UI.chipsLabel)}"></div>
      <div class="tools" role="toolbar" aria-label="${esc(UI.toolsLabel)}">
        <button type="button" class="tool erase-tool" data-tool="erase" aria-pressed="false">${icon('erase')}${esc(UI.tools.erase)}</button>
        <button type="button" class="tool" data-tool="undo">${icon('undo')}${esc(UI.tools.undo)}</button>
        <button type="button" class="tool" data-tool="reset">${icon('reset')}${esc(UI.tools.reset)}</button>
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
  const chipsEl = root.querySelector<HTMLElement>('.chips')!;
  // Tool clicks (toolbar and end banner) are caught on this screen's own element, so a grid
  // opened before never reacts to them.
  const gameEl = root.querySelector<HTMLElement>('.game')!;

  const shapeOf = (e: BookEntry): Shape => ({ lens: e.lens, heights: e.heights, kind: e.shape });

  const barOf = (e: BookEntry, r: Rect): Placement => {
    const bar: Placement = { piece: e.piece as Placement['piece'], row: r.row, col: r.col, len: r.len };
    if (r.height !== 1) bar.height = r.height;
    if (e.country) bar.country = e.country;
    return bar;
  };
  const labelOf = (b: Placement) => placementLabel(grid, b.piece, b.country, b.row, b.col, b.len, b.height ?? 1, kindOf(grid, b));

  // ---- rendering
  function preview() {
    if (!selected || erase || selected.piece === STEP_KEY) return null;
    const r = previewRect(gesture, shapeOf(selected));
    if (!r) return null;
    const bar = barOf(selected, r);
    const check = checkPlaceOver(grid, history.present, bar);
    return { bar, check, rect: r };
  }

  /** Arrows show while STEP is chosen and a pair is still to place (all published pairs laid: none). */
  function stepModeOn(): boolean {
    if (selected?.piece !== STEP_KEY || erase || ev.solved) return false;
    const want = publishedStepPairs(grid);
    return want === null || history.present.step.length < want || stepPending !== null;
  }

  function drawBoard() {
    const pv = preview();
    const out = renderBoard({
      grid, state: history.present, ev, style: 'A', cell,
      preview: pv ? { rect: pv.rect, piece: pv.bar.piece, valid: pv.check.ok, replacing: pv.check.ok ? pv.check.replaced : [] } : null,
      anchor: gesture.anchor, cursor: keyboard && document.activeElement === wrap ? cursor : null, stepPending,
      stepMode: stepModeOn(), interactive: true,
    });
    geo = out.geo;
    scroll.innerHTML = out.svg;
    wrap.classList.toggle('placing', !!selected && !erase);
    wrap.classList.toggle('pan', !!selected && !erase && isFlat(shapeOf(selected)));
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
      const next = nextGrid(ctx.grids, grid.id, localIsoDate(), (id) => statusOf(ctx.store.get(), id) === 'done');
      const html = `<div class="banner" role="status"><b>${esc(UI.doneTitle)}</b>`
        + `<span>${esc(UI.doneText(shownClueCount(grid), durationText(elapsed())))}</span></div>`
        + `<div class="tools done-tools">${next ? `<a class="tool on" href="#/grille/${next.id}">${esc(UI.next)}${icon('next')}</a>` : `<a class="tool on" href="#/">${esc(UI.home)}</a>`}</div>`;
      setMsg(html);
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
    } else {
      m = boardMessage(ev, m) ?? {
        text: erase ? UI.hintErase : selected?.piece === STEP_KEY ? (stepPending !== null ? UI.stepPending(columnLabel(grid, stepPending)) : UI.hintStep)
          : UI.hintChoose(grid.inventory.level !== 'exact', grid.neighbors.length > 0, window.matchMedia('(max-width: 860px)').matches),
        tone: 'info',
      };
    }
    setMsg(`<div class="msg ${m.tone}">${esc(m.text)}</div>`);
  }

  function setMsg(html: string) {
    if (html === msgHtml) return;
    msgHtml = html;
    msgSlot.innerHTML = html;
  }

  function drawChips() {
    chipsEl.innerHTML = renderChips(grid, history.present, erase ? null : selected?.key ?? null, erase);
    // Scroll the row itself, horizontally only: scrollIntoView would also move the page.
    const row = chipsEl.querySelector<HTMLElement>('.chips-row');
    const sel = row?.querySelector<HTMLElement>('.sel');
    if (row && sel) {
      const left = sel.offsetLeft - row.offsetLeft;
      if (left < row.scrollLeft || left + sel.offsetWidth > row.scrollLeft + row.clientWidth) row.scrollLeft = Math.max(0, left - 8);
    }
  }

  function drawSide() {
    const bookTitle = grid.inventory.level === 'exact' ? UI.book : UI.available;
    const bookHint = grid.inventory.level === 'exact' ? '' : ` <small>${esc(UI.availableHint)}</small>`;
    side.innerHTML = `<section class="card" aria-label="${esc(bookTitle)}"><h2 class="ct">${esc(bookTitle)}${bookHint}</h2>`
      + `${renderBook(grid, history.present, erase ? null : selected?.key ?? null)}</section>`
      + renderClues(grid, ev.clues, history.present, ev.missing === 0) + renderCo2(grid, history.present);
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
    drawChips();
    drawTools();
  }

  // ---- state changes
  function commit(next: PlayState, text: string | null | ((before: Evaluation) => { text: string; tone: Tone }), tone: Tone = 'ok') {
    const wasSolved = ev.solved;
    const before = ev;
    history = push(history, next);
    afterChange(wasSolved);
    message = typeof text === 'function' ? text(before) : text ? { text, tone } : null;
    drawAll();
  }

  function afterChange(wasSolved: boolean) {
    ev = evaluate(grid, history.present);
    if (ev.solved && !wasSolved) { frozenElapsed = elapsedBase + (Date.now() - sessionStart); ctx.onEvent?.('solved'); }
    if (!ev.solved) frozenElapsed = null;
    save();
  }

  function save() {
    ctx.store.set(recordState(ctx.store.get(), grid.id, history.present, elapsed(), ev.solved, fp));
  }

  function say(text: string, tone: Tone) {
    message = { text, tone };
    drawMessage();
  }

  function layAt(r: Rect) {
    if (!selected) return;
    const bar = barOf(selected, r);
    const res = placeOver(grid, history.present, bar);
    // A pose that contradicts a clue is allowed (the player may try things), but the message says so.
    if (res.ok) {
      ctx.onEvent?.('move');
      commit(res.state, (before) => {
        const m = poseMessage(grid, labelOf(bar), res.replaced, newlyBroken(before.clues, ev.clues));
        if (m.tone === 'bad') ctx.onEvent?.('error');
        return m;
      });
    } else { ctx.onEvent?.('error'); message = { text: UI.poseBad(labelOf(bar), res.error.message), tone: 'bad' }; drawBoard(); }
  }

  function removeAt(c: Cell) {
    const er = stepEraseResult(stepPending, c.col);
    if (er.dropped) { stepPending = null; say(UI.stepPendingDropped, 'info'); drawBoard(); return; }
    const i = barIndexAt(grid, history.present, c.row, c.col);
    if (i < 0 && isStepCell(c) && removePairAt(c.col)) return;
    const bar = i >= 0 ? history.present.bars[i] : undefined;
    const res = remove(grid, history.present, c.row, c.col);
    if (res.ok && bar) { ctx.onEvent?.('erase'); commit(res.state, UI.removed(labelOf(bar)), 'info'); }
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
    const r = exportTap(grid, history.present, country, col);
    if (r.refused) say(r.refused, 'bad');
    else if (r.state) { ctx.onEvent?.('move'); commit(r.state, null); }
  }

  /** STEP chosen: the first tap pumps, a tap on a later slot turbines. */
  function stepTap(col: number) {
    const r = stepTapResult(grid, history.present, stepPending, col);
    stepPending = r.pending;
    if (r.state) { ctx.onEvent?.('move'); commit(r.state, r.message.text); }
    else if (r.message.tone === 'info') { message = r.message; drawBoard(); }
    else say(r.message.text, r.message.tone);
  }

  /** Remove the STEP pair pumping or turbining in a column. */
  function removePairAt(col: number): boolean {
    const k = stepPairIndexAt(history.present, col);
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
    const top = (ev.floor[c.col] ?? 0) + (ev.silhouette[c.col] ?? 0);
    return (pumps > 0 && c.row >= top - pumps && c.row < top) || (turbs > 0 && c.row >= top && c.row < top + turbs);
  }

  /** Keyboard cursor at first focus: the first free cell of the first column, above the weather. */
  const startCursor = (): Cell => ({ row: ev.floor[0] ?? 0, col: 0 });

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
    if (erase || selected?.piece === STEP_KEY) {
      if (e.pointerType === 'mouse') tapAction(c);
      else pendingTap = c;
      return;
    }
    const occupied = barIndexAt(grid, history.present, c.row, c.col) >= 0;
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

  /** Eraser or STEP tap on a cell. */
  function tapAction(c: Cell) {
    if (erase) removeAt(c);
    else stepTap(c.col);
  }

  function onPointerMove(e: PointerEvent) {
    const at = cellFromEvent(e);
    if (!at || !selected || erase) return;
    const c = gesture.drag ? alongShape(gesture.drag.start, at, shapeOf(selected)) : at;
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
    if (pendingTap) { const c = pendingTap; pendingTap = null; tapAction(c); return; }
    if (!gesture.drag || !selected) return;
    if (longPressFired) { gesture = cancel(gesture); drawBoard(); return; }
    const at = cellFromEvent(e);
    const c = at ? alongShape(gesture.drag.start, at, shapeOf(selected)) : gesture.drag.current;
    const r = release(gesture, c, shapeOf(selected));
    gesture = r.state;
    if (r.dropped) message = null;
    if (r.commit) layAt(r.commit);
    else drawBoard();
  }

  /** The browser took the touch (page scroll): forget the press, without any message. */
  function onPointerCancel() {
    clearLongPress();
    pendingTap = null;
    pressedAct = null;
    if (!gesture.drag) return;
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
    else if (el.getAttribute('data-act') === 'step-arrow') {
      if (stepArrowAction(stepPending, col) === 'cancel') { stepPending = null; message = { text: UI.stepPendingDropped, tone: 'info' }; drawBoard(); }
      else stepTap(col);
    }
    else if (el.getAttribute('data-act') === 'locked') say(UI.lockedTap(columnLabel(grid, col)), 'info');
    let again: HTMLElement | SVGElement | null = scroll.querySelector<SVGElement>(`[data-act="${el.getAttribute('data-act')}"][data-col="${col}"]${el.getAttribute('data-country') ? `[data-country="${el.getAttribute('data-country')}"]` : ''}`);
    // The arrows vanish once the pair is laid: keep the keyboard focus on the new ▼ tag, else on the board.
    if (!again && el.getAttribute('data-act') === 'step-arrow') again = scroll.querySelector<SVGElement>(`[data-act="step-tag"][data-col="${col}"]`) ?? wrap;
    if (again && document.activeElement !== again && el === document.activeElement) again.focus();
  }

  // ---- keyboard
  function onKeyDown(e: KeyboardEvent) {
    keyboard = true;
    const act = (e.target as Element).closest?.('[data-act]');
    if (act && (e.key === 'Enter' || e.key === ' ')) {
      e.preventDefault();
      const country = act.getAttribute('data-country');
      const key = `[data-act="${act.getAttribute('data-act')}"][data-col="${act.getAttribute('data-col')}"]${country ? `[data-country="${country}"]` : ''}`;
      activate(act);
      // The board is redrawn: focus the same control again (same neighbor for an export pill).
      scroll.querySelector<SVGElement>(key)?.focus();
      return;
    }
    if (e.target !== wrap) return;
    const c = cursor ?? startCursor();
    const moves: Record<string, [number, number]> = { ArrowLeft: [0, -1], ArrowRight: [0, 1], ArrowUp: [1, 0], ArrowDown: [-1, 0] };
    const mv = moves[e.key];
    if (mv) {
      e.preventDefault();
      const top = Math.max(1, ...ev.silhouette.map((h, k) => (ev.floor[k] ?? 0) + h)) - 1;
      cursor = moveCursor(c, mv[0], mv[1], ev.floor, top);
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
      if (r.dropped) message = null;
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
    const x = geo.lead + cursor.col * geo.cell;
    if (x < scroll.scrollLeft) scroll.scrollLeft = Math.max(0, x - geo.lead);
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
      if (stepUndoPlan(stepPending) === 'drop-pending') {
        stepPending = null;
        message = { text: UI.stepPendingDropped, tone: 'info' };
        drawAll();
        return;
      }
      if (!canUndo(history)) { say(UI.nothingToUndo, 'info'); return; }
      const wasSolved = ev.solved;
      ctx.onEvent?.('undo');
      history = undo(history);
      afterChange(wasSolved);
      message = { text: UI.undone, tone: 'info' };
      drawAll();
    } else if (tool === 'reset') {
      // A board still as it started: nothing to stack, nothing to save.
      if (isInitialState(grid, history.present)) {
        gesture = cancel(gesture);
        stepPending = null;
        say(UI.nothingToReset, 'info');
        return;
      }
      const wasSolved = ev.solved;
      ctx.onEvent?.('reset');
      history = reset(history, initial);
      gesture = idle();
      stepPending = null;
      afterChange(wasSolved);
      message = { text: UI.resetDone, tone: 'info' };
      drawAll();
    }
  }

  function onSideClick(e: MouseEvent) {
    const row = (e.target as Element).closest<HTMLElement>('[data-piece]');
    if (row) select(row.getAttribute('data-piece') ?? '');
  }

  function onWrapFocus() { keyboard = wrap.matches(':focus-visible'); if (!cursor) cursor = startCursor(); drawBoard(); }
  /** Losing focus only hides the keyboard cursor: no redraw when it was not shown. */
  function onWrapBlur() { if (keyboard && cursor) drawBoard(); }

  // ---- size
  function fit() {
    // Desktop: the board column is as wide as the board, so measure what the side column leaves.
    const oneColumn = window.matchMedia('(max-width: 860px)').matches;
    // The board sits in a card (30 px of border and padding on desktop); its left gutter holds the neighbor ids.
    const avail = (oneColumn ? wrap.clientWidth : gameEl.clientWidth - 340 - 30 - 48 - 30) - 6 - boardLead(grid);
    const n = grid.columns.length;
    const next = Math.max(MIN_CELL, Math.min(MAX_CELL, Math.floor(avail / n)));
    if (next !== cell || !geo) { cell = next; drawBoard(); } else syncSlider();
  }
  const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(fit) : null;
  ro?.observe(gameEl);

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
  gameEl.addEventListener('click', onToolClick);
  side.addEventListener('click', onSideClick);
  chipsEl.addEventListener('click', onSideClick);
  /** Leaving saves the clock, but never makes a grid nobody played look started. */
  const onLeave = () => { if (history.past.length || ctx.store.get().grids[String(grid.id)]) save(); };
  window.addEventListener('pagehide', onLeave);

  drawAll();
  fit();

  return () => {
    onLeave();
    ro?.disconnect();
    clearLongPress();
    window.removeEventListener('pagehide', onLeave);
    gameEl.removeEventListener('click', onToolClick);
  };
}
