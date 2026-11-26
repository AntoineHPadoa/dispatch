/*
 * Tutorial overlay of the game screen (desktop only, from TUTORIAL_MIN_WIDTH px).
 * - Dims the page around the target (a UI anchor, board cells, an exchange line or a clue) and
 *   shows a bubble beside it, kept inside the viewport; it follows resizes and scrolls.
 * - Present steps block the page: « Suivant » (Enter) or « Passer le tutoriel » (Escape).
 * - Guided steps let the page through but gate every move: the game asks guard() before acting and
 *   calls played() once the engine accepted the move; any other move is refused with a message.
 * - The run (step, moves played) is saved under its own key; on load, and when the screen widens
 *   again, the board is reset to the one the run expects. Below the width threshold the overlay
 *   hides and the grid plays normally.
 */
import type { Grid } from '../model/grid';
import type { PlayState } from '../engine';
import { TECHNIQUES, TUTORIAL, TUTORIAL_UI } from '../i18n/fr';
import {
  TUTORIAL_MIN_WIDTH, arrowOffset, currentStep, stepRank, expectedBoard, gate, loadRun, next, holesPath, pad, placeBubble, record, saveRun, shadePath, skip,
  startRun, union, validRun, cellBox, type Attempt, type Box, type GateResult, type KeyValue, type TutorialRun,
} from '../tutorial';
import type { SpotTarget, TutorialScript, TutorialStep } from '../tutorial/types';
import { STEP_KEY } from './panels';
import { esc } from './palette';

export interface TutorialHost {
  /** The game screen element (`.game`). */
  screen: HTMLElement;
  grid: Grid;
  script: TutorialScript;
  /** Board a run starts from (engaged plants, published exports). */
  initial: PlayState;
  board(): PlayState;
  /** Replace the board (resume): the undo history starts again from it. */
  restore(state: PlayState): void;
  /** The run ended (finished or skipped). */
  onEnd?(run: TutorialRun): void;
  storage?: () => KeyValue | null;
}

export interface TutorialController {
  /** Before a move: null when it is refused (the bubble says so), else the result to hand to played(). */
  guard(at: Attempt): GateResult | null;
  /** The engine accepted a guarded move. */
  played(result: GateResult): void;
  /** Reposition after the screen redrew. */
  refresh(): void;
  /** Start the script again from its first step (board reset). */
  replay(): void;
  destroy(): void;
}

const OPEN: GateResult = { ok: true, move: null };

const browserStorage = (): KeyValue | null => {
  try { return typeof window !== 'undefined' ? window.localStorage : null; } catch { return null; }
};

/** Same pieces, exports and STEP pairs (order of bars ignored). */
export function sameBoard(a: PlayState, b: PlayState): boolean {
  const bars = (s: PlayState) => s.bars.map((x) => [x.piece, x.country ?? '', x.row, x.col, x.len, x.height ?? 1].join(':')).sort().join('|');
  const ex = (s: PlayState) => JSON.stringify(Object.keys(s.exports).sort().map((k) => [k, s.exports[k]]));
  const st = (s: PlayState) => s.step.map((p) => `${p.pump}>${p.turbine}`).sort().join('|');
  return bars(a) === bars(b) && ex(a) === ex(b) && st(a) === st(b);
}

/** Bubble text: escaped, `**…**` in bold. */
export const richText = (text: string) => esc(text).replace(/\*\*(.+?)\*\*/g, '<b>$1</b>');

const ANCHOR_SELECTORS: Record<string, string> = {
  board: '.board-card', chips: '.chips', book: '[data-tutorial="book"]', clues: '[data-tutorial="clues"]',
  co2: '[data-tutorial="co2"]', step: `.side [data-piece="${STEP_KEY}"]`, tools: '.play > .tools', replay: '[data-tutorial="replay"]',
};

export function mountTutorial(host: TutorialHost): TutorialController {
  const { screen, grid, script } = host;
  const kv = host.storage ?? browserStorage;
  const wide = window.matchMedia(`(min-width: ${TUTORIAL_MIN_WIDTH}px)`);
  let run: TutorialRun = validRun(script, loadRun(kv, grid.id)) ?? startRun();
  let refusal = '';
  let frame = 0;
  let lastStep = -1;

  const layer = document.createElement('div');
  layer.className = 'tut';
  layer.hidden = true;
  layer.innerHTML = `<div class="tut-block"></div><svg class="tut-shade" aria-hidden="true"><path class="tut-dim" fill-rule="evenodd"/><path class="tut-ring" fill="none"/></svg>`
    + `<div class="tut-bubble" role="dialog" aria-labelledby="tut-title-${grid.id}"><i class="tut-arrow" aria-hidden="true"></i>`
    + `<div class="eyebrow tut-eyebrow"></div><h2 class="tut-title" id="tut-title-${grid.id}"></h2>`
    + `<p class="tut-text" aria-live="polite"></p><p class="tut-refused" role="alert" hidden></p>`
    + `<div class="tut-foot"><span class="tut-hint"></span><button type="button" class="tut-skip"></button><button type="button" class="tut-next"></button></div></div>`;
  document.body.appendChild(layer);
  const svg = layer.querySelector<SVGSVGElement>('.tut-shade')!;
  const dim = layer.querySelector<SVGPathElement>('.tut-dim')!;
  const ring = layer.querySelector<SVGPathElement>('.tut-ring')!;
  const bubble = layer.querySelector<HTMLElement>('.tut-bubble')!;
  const nextBtn = layer.querySelector<HTMLButtonElement>('.tut-next')!;
  const skipBtn = layer.querySelector<HTMLButtonElement>('.tut-skip')!;
  const arrow = layer.querySelector<HTMLElement>('.tut-arrow')!;

  const step = (): TutorialStep | null => currentStep(script, run);
  const visible = () => run.status === 'running' && wide.matches && !!step();

  function setRun(r: TutorialRun) {
    const ended = run.status === 'running' && r.status !== 'running';
    run = r;
    saveRun(kv, grid.id, run);
    if (ended) host.onEnd?.(run);
    render();
  }

  /** Put the board where the run stands (or drop a run whose script no longer replays). */
  function sync() {
    if (run.status !== 'running' || !wide.matches) return;
    const want = expectedBoard(grid, script, run, host.initial);
    if (!want) { setRun(skip(run)); return; }
    if (!sameBoard(want, host.board())) host.restore(want);
  }

  // ---- targets
  function anchorBoxes(anchor: string): Box[] {
    const el = (sel: string) => screen.querySelector<HTMLElement>(sel);
    const rect = (e: Element | null): Box[] => (e ? [e.getBoundingClientRect()] : []);
    if (anchor.startsWith('chip:')) {
      const p = anchor.slice(5);
      const chip = el(`.chips [data-piece="${p}"]`);
      return rect(chip && chip.offsetParent ? chip : el(`.side [data-piece="${p}"]`));
    }
    if (anchor.startsWith('tool:')) return rect(el(`.play > .tools [data-tool="${anchor.slice(5)}"]`));
    if (anchor === 'exchanges') return exchangeBoxes(null, null);
    if (anchor === 'margins') return marginBoxes();
    const own = el(`[data-tutorial="${anchor}"]`);
    return rect(own ?? el(ANCHOR_SELECTORS[anchor] ?? ''));
  }

  function boardSvg(): { el: SVGSVGElement; box: Box; m: { cell: number; lead: number; rows: number; top: number; width: number } } | null {
    const el = screen.querySelector<SVGSVGElement>('.board-svg');
    if (!el) return null;
    const num = (a: string) => Number(el.getAttribute(a) ?? 0);
    return { el, box: el.getBoundingClientRect(), m: { cell: num('data-cell'), lead: num('data-lead'), rows: num('data-rows'), top: num('data-top'), width: num('width') } };
  }

  function exchangeBoxes(country: string | null, cols: readonly [number, number] | null): Box[] {
    const pills = [...screen.querySelectorAll<SVGElement>('.board-svg [data-country][data-col]')]
      .filter((e) => (country === null || e.getAttribute('data-country') === country)
        && (cols === null || (Number(e.getAttribute('data-col')) >= Math.min(...cols) && Number(e.getAttribute('data-col')) <= Math.max(...cols))));
    const u = union(pills.map((p) => p.getBoundingClientRect()));
    if (!u) return [];
    // From the first column, the line's neighbor id in the left gutter is part of it.
    const svgBox = boardSvg()?.box;
    if (svgBox && (cols === null || Math.min(...cols) === 0)) return [{ ...u, left: svgBox.left, width: u.left + u.width - svgBox.left }];
    return [u];
  }

  /** Under the cells: hours, price marks and records, down to the exchange line. */
  function marginBoxes(): Box[] {
    const b = boardSvg();
    if (!b) return [];
    const cells = cellBox(b.box, b.m, [0, grid.columns.length - 1]);
    const bottomOfCells = cells.top + cells.height;
    const pills = exchangeBoxes(null, null)[0];
    const bottom = pills ? pills.top - 2 : b.box.top + b.box.height;
    return [{ left: b.box.left, top: bottomOfCells, width: b.box.width, height: Math.max(0, bottom - bottomOfCells) }];
  }

  function targetBoxes(t: SpotTarget | undefined): Box[] {
    if (!t) return [];
    switch (t.kind) {
      case 'anchor': return anchorBoxes(t.anchor);
      case 'board': { const b = boardSvg(); return b ? [cellBox(b.box, b.m, t.cols, t.rows)] : []; }
      case 'exchange': return exchangeBoxes(t.country, t.cols);
      case 'clue': {
        const li = screen.querySelector(`li.clue[data-clue="${t.index}"]`);
        const marks = [...screen.querySelectorAll(`.board-svg [data-clue="${t.index}"]`)];
        return [li, ...marks].filter((e): e is Element => !!e).map((e) => e.getBoundingClientRect());
      }
    }
  }

  const overlaps = (b: Box, o: Box) => b.left < o.left + o.width && o.left < b.left + b.width && b.top < o.top + o.height && o.top < b.top + b.height;

  /** Holes of the shade: padded target boxes, overlapping ones merged. */
  function holes(t: SpotTarget | undefined): Box[] {
    const out: Box[] = [];
    for (const b of targetBoxes(t).filter((x) => x.width > 0 && x.height > 0).map((x) => pad(x, 6))) {
      const hit = out.findIndex((o) => overlaps(b, o));
      if (hit >= 0) out[hit] = union([out[hit]!, b])!;
      else out.push(b);
    }
    return out;
  }

  // ---- drawing
  function render() {
    const s = step();
    layer.hidden = !visible();
    document.body.classList.toggle('tut-on', !layer.hidden);
    if (layer.hidden || !s) return;
    const guided = s.kind === 'guided';
    layer.classList.toggle('guided', guided);
    const rank = stepRank(script, run);
    layer.querySelector('.tut-eyebrow')!.textContent = rank.kind === 'discovery' ? TUTORIAL_UI.eyebrowDiscovery
      : rank.kind === 'guided' ? TUTORIAL_UI.eyebrowGuided(rank.k, rank.n) : TUTORIAL_UI.eyebrowPresent(rank.k, rank.n);
    const title = guided ? TECHNIQUES[s.technique]?.name ?? '' : s.title ? TUTORIAL[s.title] ?? '' : '';
    const titleEl = layer.querySelector<HTMLElement>('.tut-title')!;
    titleEl.textContent = title;
    titleEl.hidden = !title;
    layer.querySelector('.tut-text')!.innerHTML = richText(TUTORIAL[s.text] ?? s.text);
    const ref = layer.querySelector<HTMLElement>('.tut-refused')!;
    ref.hidden = !refusal;
    ref.textContent = refusal;
    const hint = layer.querySelector<HTMLElement>('.tut-hint')!;
    hint.textContent = guided ? TUTORIAL_UI.hint[s.moves[0]?.action ?? 'place'] : '';
    hint.hidden = !guided;
    nextBtn.hidden = guided;
    nextBtn.textContent = run.step + 1 >= script.steps.length ? TUTORIAL_UI.finish : TUTORIAL_UI.next;
    skipBtn.textContent = script.kind === 'discovery' ? TUTORIAL_UI.close : TUTORIAL_UI.skip;
    if (run.step !== lastStep) {
      lastStep = run.step;
      bringIntoView(s);
      if (!guided) nextBtn.focus({ preventScroll: true });
    }
    layout();
  }

  /** Scroll the page so the target is in view (centred when it is taller than the viewport allows). */
  function bringIntoView(s: TutorialStep) {
    const u = union(targetBoxes(s.target));
    if (!u) return;
    const vh = window.innerHeight;
    if (u.top >= 8 && u.top + u.height <= vh - 8) return;
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    window.scrollBy({ top: u.top + u.height / 2 - vh / 2, behavior: reduce ? 'auto' : 'instant' as ScrollBehavior });
  }

  function layout() {
    const s = step();
    if (layer.hidden || !s) return;
    const view = { width: document.documentElement.clientWidth, height: window.innerHeight };
    const hs = holes(s.target);
    svg.setAttribute('viewBox', `0 0 ${view.width} ${view.height}`);
    svg.setAttribute('width', String(view.width));
    svg.setAttribute('height', String(view.height));
    // A guided bubble (side auto) sits under the order book, which stays unveiled: the board is free
    // and the plants at hand.
    const bookEl = s.kind === 'guided' && (s.side ?? 'auto') === 'auto' ? screen.querySelector('[data-tutorial="book"]') : null;
    const book = bookEl ? pad(bookEl.getBoundingClientRect(), 6) : null;
    const veil = book && !hs.some((h) => overlaps(h, book)) ? [...hs, book] : hs;
    dim.setAttribute('d', shadePath(view, veil));
    ring.setAttribute('d', holesPath(hs));
    const size = { width: bubble.offsetWidth, height: bubble.offsetHeight };
    const anchor = book ?? union(hs);
    const p = book ? placeBubble(book, size, view, 'bottom') : placeBubble(anchor, size, view, s.side ?? 'auto');
    bubble.style.left = `${Math.round(p.left)}px`;
    bubble.style.top = `${Math.round(p.top)}px`;
    bubble.dataset.side = p.side;
    // The arrow points at the target only when the bubble sits beside it (not under the order book).
    const towards = p.side === 'center' || !anchor || book ? null : ({ bottom: 'top', top: 'bottom', right: 'left', left: 'right' } as const)[p.side];
    arrow.hidden = !towards;
    if (towards && anchor) {
      arrow.dataset.edge = towards;
      const off = arrowOffset(towards, p, size, anchor);
      arrow.style.left = towards === 'top' || towards === 'bottom' ? `${Math.round(off)}px` : '';
      arrow.style.top = towards === 'left' || towards === 'right' ? `${Math.round(off)}px` : '';
    }
  }

  const schedule = () => {
    if (frame) return;
    frame = requestAnimationFrame(() => { frame = 0; layout(); });
  };

  // ---- actions
  function advance() {
    refusal = '';
    setRun(next(script, run));
  }

  function quit() {
    refusal = '';
    setRun(skip(run));
  }

  function onKey(e: KeyboardEvent) {
    const s = step();
    if (layer.hidden || !s) return;
    const inBoard = (e.target as Element | null)?.closest?.('.board-wrap');
    if (e.key === 'Escape' && !(s.kind === 'guided' && inBoard)) { e.preventDefault(); e.stopPropagation(); quit(); return; }
    if (s.kind === 'present' && e.key === 'Enter' && e.target !== skipBtn) { e.preventDefault(); e.stopPropagation(); advance(); }
  }

  nextBtn.addEventListener('click', advance);
  skipBtn.addEventListener('click', quit);
  document.addEventListener('keydown', onKey, true);
  window.addEventListener('resize', schedule);
  window.addEventListener('scroll', schedule, { capture: true, passive: true });
  // Late layout changes (web fonts, panels growing) move the targets without any scroll or resize.
  const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(schedule) : null;
  ro?.observe(screen);
  ro?.observe(document.documentElement);
  void document.fonts?.ready.then(schedule);
  const onWidth = () => { if (wide.matches) sync(); refusal = ''; lastStep = -1; render(); };
  wide.addEventListener('change', onWidth);

  sync();
  render();

  return {
    guard(at) {
      if (!visible()) return OPEN;
      const r = gate(grid, script, run, host.board(), at);
      if (r.ok) { if (refusal) { refusal = ''; render(); } return r; }
      refusal = at.action === 'tool' || at.action === 'removeStep' ? TUTORIAL_UI.refusedTool : TUTORIAL_UI.refused;
      render();
      bubble.classList.remove('shake');
      void bubble.offsetWidth;
      bubble.classList.add('shake');
      return null;
    },
    played(result) {
      if (!visible() || !result.ok || result.move === null) return;
      setRun(record(script, run, result));
    },
    refresh: schedule,
    replay() {
      refusal = '';
      lastStep = -1;
      run = startRun();
      saveRun(kv, grid.id, run);
      sync();
      render();
    },
    destroy() {
      if (frame) cancelAnimationFrame(frame);
      ro?.disconnect();
      document.removeEventListener('keydown', onKey, true);
      window.removeEventListener('resize', schedule);
      window.removeEventListener('scroll', schedule, { capture: true });
      wide.removeEventListener('change', onWidth);
      document.body.classList.remove('tut-on');
      layer.remove();
    },
  };
}
