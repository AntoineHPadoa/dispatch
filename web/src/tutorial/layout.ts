/*
 * Spotlight geometry (pure, no DOM): screen boxes of board cells, unions, bubble placement.
 * - cellBox: the screen box of a range of board cells, from the board SVG's on-screen box and the
 *   measures it carries (data-cell, data-lead, data-rows, data-top; viewBox starts at x = -2).
 * - placeBubble: where the bubble goes beside its target (preferred side first, then the side with
 *   the most room), always clamped inside the viewport.
 */
import type { BubbleSide, Range } from './types';

export interface Box { left: number; top: number; width: number; height: number }
export interface Size { width: number; height: number }

/** Board measures in SVG user units, as renderBoard writes them on the svg element. */
export interface BoardMeasures { cell: number; lead: number; rows: number; top: number; width: number }

export const union = (boxes: readonly Box[]): Box | null => {
  if (!boxes.length) return null;
  const l = Math.min(...boxes.map((b) => b.left));
  const t = Math.min(...boxes.map((b) => b.top));
  const r = Math.max(...boxes.map((b) => b.left + b.width));
  const btm = Math.max(...boxes.map((b) => b.top + b.height));
  return { left: l, top: t, width: r - l, height: btm - t };
};

export const pad = (b: Box, p: number): Box => ({ left: b.left - p, top: b.top - p, width: b.width + 2 * p, height: b.height + 2 * p });

/** Screen box of the cells cols × rows (rows absolute, 0 at the bottom; no rows = every drawn row). */
export function cellBox(svg: Box, m: BoardMeasures, cols: Range, rows?: Range): Box {
  const s = svg.width / m.width;
  const [c0, c1] = [Math.min(...cols), Math.max(...cols)];
  const [r0, r1] = rows ? [Math.min(...rows), Math.max(...rows)] : [0, m.rows - 1];
  // User units: x = lead + col * cell (viewBox x from -2), y = (rows - row - 1) * cell (viewBox y from -top).
  const x = m.lead + c0 * m.cell + 2;
  const y = (m.rows - r1 - 1) * m.cell + m.top;
  return { left: svg.left + x * s, top: svg.top + y * s, width: (c1 - c0 + 1) * m.cell * s, height: (r1 - r0 + 1) * m.cell * s };
}

const SIDES: readonly Exclude<BubbleSide, 'auto'>[] = ['bottom', 'top', 'right', 'left'];

/**
 * Top-left corner of the bubble. Without a target: centred. A side fits when the bubble holds
 * between the target (plus `gap`) and the viewport edge (minus `margin`).
 */
export function placeBubble(target: Box | null, bubble: Size, view: Size, side: BubbleSide = 'auto', gap = 14, margin = 12): { left: number; top: number; side: Exclude<BubbleSide, 'auto'> | 'center' } {
  const clampX = (x: number) => Math.max(margin, Math.min(x, view.width - bubble.width - margin));
  const clampY = (y: number) => Math.max(margin, Math.min(y, view.height - bubble.height - margin));
  if (!target) return { left: clampX((view.width - bubble.width) / 2), top: clampY((view.height - bubble.height) / 2), side: 'center' };
  const room = {
    bottom: view.height - margin - (target.top + target.height + gap),
    top: target.top - gap - margin,
    right: view.width - margin - (target.left + target.width + gap),
    left: target.left - gap - margin,
  };
  const need = (s: Exclude<BubbleSide, 'auto'>) => (s === 'top' || s === 'bottom' ? bubble.height : bubble.width);
  const order = side === 'auto' ? SIDES : [side, ...SIDES.filter((s) => s !== side)];
  const chosen = order.find((s) => room[s] >= need(s))
    ?? [...SIDES].sort((a, b) => room[b] - need(b) - (room[a] - need(a)))[0]!;
  const cx = target.left + target.width / 2 - bubble.width / 2;
  const cy = target.top + target.height / 2 - bubble.height / 2;
  switch (chosen) {
    case 'bottom': return { left: clampX(cx), top: clampY(target.top + target.height + gap), side: chosen };
    case 'top': return { left: clampX(cx), top: clampY(target.top - gap - bubble.height), side: chosen };
    case 'right': return { left: clampX(target.left + target.width + gap), top: clampY(cy), side: chosen };
    default: return { left: clampX(target.left - gap - bubble.width), top: clampY(cy), side: chosen };
  }
}

/** SVG path of rounded rectangles (the outlines of the holes). */
export function holesPath(holes: readonly Box[], r = 10): string {
  let d = '';
  for (const h of holes) {
    const k = Math.max(0, Math.min(r, h.width / 2, h.height / 2));
    const x = h.left; const y = h.top; const w = h.width; const hh = h.height;
    d += `M${x + k} ${y}H${x + w - k}Q${x + w} ${y} ${x + w} ${y + k}V${y + hh - k}Q${x + w} ${y + hh} ${x + w - k} ${y + hh}`
      + `H${x + k}Q${x} ${y + hh} ${x} ${y + hh - k}V${y + k}Q${x} ${y} ${x + k} ${y}Z`;
  }
  return d.replace(/(\.\d{2})\d+/g, '$1');
}

/** SVG path of the dimmed shade: the viewport minus rounded holes (even-odd fill; holes must not overlap). */
export const shadePath = (view: Size, holes: readonly Box[], r = 10): string => `M0 0H${view.width}V${view.height}H0Z${holesPath(holes, r)}`;
