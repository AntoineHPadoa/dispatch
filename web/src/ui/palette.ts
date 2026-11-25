/*
 * Colour tokens and icons shared by the screen (style A, "Dragée") and paper (style B, "Menthe nette").
 * - One pastel per plant: `a` on screen, `b` on paper, `ink` for strokes and accents.
 * - Icons are 20x20 stroke paths, drawn with currentColor.
 */

export type PaletteKey = 'N' | 'B' | 'C' | 'G' | 'T' | 'I' | 'R' | 'F';

/** Slate of the STEP (pumped and turbined blocks, tags, arrows): distinct from the dam's blue. */
export const STEP_INK = '#5d6f93';

export const PIECE_COLORS: Record<PaletteKey, { a: string; b: string; ink: string }> = {
  N: { a: '#f7e2a0', b: '#f2e5a2', ink: '#c9a23f' },
  B: { a: '#bfd7f1', b: '#bcd6ee', ink: '#6f9bd0' },
  C: { a: '#d7cbbf', b: '#d4ccc2', ink: '#9c8b7a' },
  G: { a: '#f8c8a9', b: '#f5cdb0', ink: '#dc915f' },
  T: { a: '#f4b5c4', b: '#f0b8c4', ink: '#d97790' },
  I: { a: '#d6c9f1', b: '#d2c8ee', ink: '#8f78cf' },
  R: { a: '#d3ebcb', b: '#d3ebcb', ink: '#7fb874' },
  F: { a: '#c6e6e2', b: '#c6e6e2', ink: '#62b3aa' },
};

export const INK_A = '#3b3340';
export const SOFT_A = '#8f8593';
export const INK_B = '#1f2a27';
export const SOFT_B = '#6c7d78';
export const BAD = '#d0566c';
export const OK = '#5f9e78';
export const ACCENT = '#a8577f';

/** Palette key of a placement piece ("I" for imports). */
export const colorKey = (piece: string): PaletteKey => (piece in PIECE_COLORS ? piece as PaletteKey : 'I');

export const ICONS = {
  price: '<path d="M3 10.5 10.5 3H17v6.5L9.5 17z"/><circle cx="13.5" cy="6.5" r="1.2"/>',
  prog: '<rect x="3" y="4.5" width="14" height="12" rx="2"/><path d="M3 8.5h14M7 3v3M13 3v3"/>',
  len: '<path d="M2.5 13.5h15M4 13.5v-3M8 13.5v-2M12 13.5v-2M16 13.5v-3"/><path d="M4 6h12M13.5 3.5 16 6l-2.5 2.5M6.5 3.5 4 6l2.5 2.5"/>',
  rel: '<path d="M4 16V9M8 16V5M12 16v-6M16 16V7"/>',
  flow: '<path d="M3 7h12l-3-3M17 13H5l3 3"/>',
  ex: '<circle cx="10" cy="10" r="7"/><path d="M6.5 8.5h7l-2-2M13.5 11.5h-7l2 2"/>',
  lock: '<rect x="4.5" y="9" width="11" height="8" rx="2"/><path d="M7 9V6.5a3 3 0 0 1 6 0V9"/>',
  erase: '<path d="M8 16h9M4.5 12.5l7-7a2 2 0 0 1 2.8 0l1.2 1.2a2 2 0 0 1 0 2.8L9 16H6.5z"/>',
  undo: '<path d="M7 7H13a4 4 0 0 1 0 8H8"/><path d="M9.5 4.5 7 7l2.5 2.5"/>',
  reset: '<path d="M4 10a6 6 0 1 0 2-4.5"/><path d="M4 3.5V6h2.5"/>',
  print: '<path d="M6 7V3.5h8V7M6 14H4v-6h12v6h-2"/><rect x="6" y="11.5" width="8" height="5"/>',
  step: '<path d="M6 16V5M3.5 7.5 6 5l2.5 2.5M14 4v11M11.5 12.5 14 15l2.5-2.5"/>',
  co2: '<path d="M5 14a4 4 0 0 1 .5-8 5 5 0 0 1 9.5 1.5A3.3 3.3 0 0 1 15 14z"/>',
  back: '<path d="M12.5 4.5 7 10l5.5 5.5"/>',
  next: '<path d="M7.5 4.5 13 10l-5.5 5.5"/>',
} as const;

export type IconName = keyof typeof ICONS;

/** Inline SVG icon (sized by CSS). */
export const icon = (name: IconName) => `<svg viewBox="0 0 20 20" aria-hidden="true">${ICONS[name]}</svg>`;

/** Icon of each clue type. */
export const CLUE_ICON: Record<string, IconName> = {
  price: 'price', bar: 'prog', length: 'len', column: 'rel', flow: 'flow', exchanges: 'ex', engaged: 'lock',
};

/** Escape text for HTML and SVG markup. */
export function esc(s: string | number): string {
  return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] as string));
}
