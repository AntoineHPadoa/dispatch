/*
 * Tutorial scripts (src/tutorial/script.ts) against the published grids.
 * - Every script points at a tutorial grid; the intro ends on another tutorial grid; every other tutorial
 *   grid has a discovery script.
 * - Targets fit their grid: board zones inside the grid, exchange lines of a real neighbor, clue indexes,
 *   anchors of an element the grid shows (STEP, CO2 gauge, plant chip).
 * - The intro's guided moves, played in order by the engine from an empty board, solve the grid.
 */
import { describe, expect, it } from 'vitest';
import gridsJson from '../src/data/grids.json';
import type { Grid, PieceId } from '../src/model/grid';
import { evaluate, newGame, place } from '../src/engine';
import { DISCOVERY, INTRO, TUTORIAL_SCRIPTS } from '../src/tutorial/script';
import type { SpotTarget, TutorialScript } from '../src/tutorial/types';

const grids = gridsJson as unknown as Grid[];
const byId = (id: number) => grids.find((g) => g.id === id);
const scripts: TutorialScript[] = [INTRO, ...DISCOVERY];

function targetError(g: Grid, t: SpotTarget): string | null {
  const n = g.columns.length;
  if (t.kind === 'board') {
    const top = Math.max(...g.demand) + 2;
    if (t.cols[0] < 0 || t.cols[1] >= n || t.cols[0] > t.cols[1]) return 'cols';
    if (t.rows && (t.rows[0] < 0 || t.rows[1] > top || t.rows[0] > t.rows[1])) return 'rows';
  }
  if (t.kind === 'exchange') {
    if (!g.neighbors.some((nb) => nb.id === t.country)) return `country ${t.country}`;
    if (t.cols[0] < 0 || t.cols[1] >= n) return 'exchange cols';
  }
  if (t.kind === 'clue' && !(t.index >= 0 && t.index < g.clues.length)) return `clue ${t.index}`;
  if (t.kind === 'anchor') {
    if (t.anchor === 'step' && !g.step) return 'no STEP';
    if (t.anchor === 'co2' && !g.co2_cap) return 'no CO2 cap';
    if (t.anchor === 'exchanges' && !g.neighbors.length) return 'no neighbor';
    if (t.anchor.startsWith('chip:') && !(t.anchor.slice(5) as PieceId in g.pieces)) return `no ${t.anchor}`;
  }
  return null;
}

describe('tutorial scripts', () => {
  it('point at tutorial grids, one script per grid', () => {
    const ids = scripts.map((s) => s.gridId);
    expect(new Set(ids).size).toBe(ids.length);
    for (const id of ids) expect(byId(id)?.section, `grid ${id}`).toBe('tutorial');
    expect(Object.keys(TUTORIAL_SCRIPTS).map(Number).sort((a, b) => a - b)).toEqual([...ids].sort((a, b) => a - b));
  });

  it('the intro ends on a tutorial grid; every other tutorial grid has a discovery script', () => {
    expect(INTRO.kind).toBe('intro');
    expect(byId(INTRO.next!)?.section).toBe('tutorial');
    const others = grids.filter((g) => g.section === 'tutorial' && g.id !== INTRO.gridId).map((g) => g.id);
    expect(DISCOVERY.map((s) => s.gridId).sort((a, b) => a - b)).toEqual(others.sort((a, b) => a - b));
    for (const s of DISCOVERY) {
      expect(s.kind).toBe('discovery');
      expect(s.steps.length).toBeGreaterThan(0);
      expect(s.steps.length).toBeLessThanOrEqual(2);
      expect(s.steps.every((st) => st.kind === 'present')).toBe(true);
    }
  });

  it('every presentation and discovery bubble has a title; guided bubbles name a technique', () => {
    for (const s of scripts) {
      for (const st of s.steps) {
        if (st.kind === 'present') expect(st.title, `${s.gridId} ${st.text}`).toBe(`${st.text}.title`);
        else expect(st.technique.length).toBeGreaterThan(0);
      }
    }
  });

  it('targets fit their grid', () => {
    for (const s of scripts) {
      const g = byId(s.gridId)!;
      for (const st of s.steps) if (st.target) expect(targetError(g, st.target), `${s.gridId} ${st.text}`).toBeNull();
    }
  });

  it('the guided moves of the intro, in order, solve its grid', () => {
    const g = byId(INTRO.gridId)!;
    let state = newGame(g);
    for (const st of INTRO.steps) {
      if (st.kind !== 'guided') continue;
      for (const m of st.moves) {
        expect(m.action).toBe('place');
        if (m.action !== 'place') continue;
        const r = place(g, state, m.bar);
        expect(r.ok, `${st.text}: ${r.ok ? '' : r.error.message}`).toBe(true);
        state = r.state;
      }
    }
    expect(evaluate(g, state).solved).toBe(true);
  });
});
