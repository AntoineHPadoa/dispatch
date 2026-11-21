// Shared board helpers for the S8.1 scripts: tap a cell, pick a plant, lay a bar, play a grid's solution.
async function tapXY(p, x, y) {
  if (p.touch) await p.touchscreen.tap(x, y); else await p.mouse.click(x, y);
  await p.waitForTimeout(120);
}

/** Screen point of a board cell; scrolls the board so the column is visible. */
async function cellPoint(p, row, col) {
  return p.evaluate(({ row, col }) => {
    const svg = document.querySelector('.board-svg');
    const scroll = document.querySelector('.board-scroll');
    const cell = +svg.dataset.cell, rows = +svg.dataset.rows, lead = +svg.dataset.lead, top = +svg.dataset.top;
    const W = +svg.getAttribute('width'), H = +svg.getAttribute('height');
    let r = svg.getBoundingClientRect();
    const sx = W / r.width, sy = H / r.height;
    const ux = lead + (col + 0.5) * cell;
    const sr = scroll.getBoundingClientRect();
    let x = r.left + (ux + 2) / sx;
    if (x < sr.left + 4 || x > sr.right - 4) { scroll.scrollLeft += x - (sr.left + sr.right) / 2; r = svg.getBoundingClientRect(); x = r.left + (ux + 2) / sx; }
    const uy = (rows - 1 - row + 0.5) * cell;
    let y = r.top + (uy + top) / sy;
    if (y < 0 || y > innerHeight) { window.scrollBy(0, y - innerHeight / 2); r = svg.getBoundingClientRect(); y = r.top + (uy + top) / sy; x = r.left + (ux + 2) / sx; }
    return { x, y };
  }, { row, col });
}

async function select(p, key) {
  const l = p.locator(`[data-piece="${key}"]:visible`).first();
  if (!(await l.count())) return false;
  await l.scrollIntoViewIfNeeded();
  await l.click();
  await p.waitForTimeout(120);
  return true;
}

let WX = null; // weather offset per column of the grid being played (R + F)
async function lay(p, bar) {
  const off = (c) => (WX ? WX[c] ?? 0 : 0);
  const a = await cellPoint(p, bar.row + off(bar.col), bar.col);
  const h = (bar.height ?? 1) - 1;
  if (bar.len === 1 && !h) { await tapXY(p, a.x, a.y); return; }
  if (p.touch) {
    await tapXY(p, a.x, a.y);
    const b = await cellPoint(p, bar.row + h + off(bar.col + bar.len - 1), bar.col + bar.len - 1);
    await tapXY(p, b.x, b.y);
  } else {
    const b = await cellPoint(p, bar.row + h + off(bar.col + bar.len - 1), bar.col + bar.len - 1);
    await p.mouse.move(a.x, a.y); await p.mouse.down();
    await p.mouse.move((a.x + b.x) / 2, b.y, { steps: 4 }); await p.mouse.move(b.x, b.y, { steps: 4 });
    await p.mouse.up(); await p.waitForTimeout(120);
  }
}

async function tapAct(p, sel) {
  const l = p.locator(sel).first();
  if (!(await l.count())) return false;
  await l.evaluate((e) => e.scrollIntoView({ block: 'center', inline: 'center' }));
  const r = await l.boundingBox();
  await tapXY(p, r.x + r.width / 2, r.y + r.height / 2);
  return true;
}
async function playSolution(p, g) {
  WX = g.columns.map((_, c) => (g.weather?.R?.[c] ?? 0) + (g.weather?.F?.[c] ?? 0));
  const sol = g.solution;
  const published = new Set(g.clues.filter((c) => c.type === 'flow' && c.dir === 'export' && c.value > 0).map((c) => `${c.country}:${c.col}`));
  for (const [cc, arr] of Object.entries(sol.exports ?? {})) {
    for (let c = 0; c < arr.length; c++) {
      if (!arr[c] || (g.inventory.level === 'exact' && published.has(`${cc}:${c}`))) continue;
      await tapAct(p, `.board-svg [data-act="export"][data-country="${cc}"][data-col="${c}"]`);
    }
  }
  for (const pair of sol.step ?? []) {
    await select(p, 'STEP');
    await tapAct(p, `.board-svg [data-act="step-arrow"][data-col="${pair.pump}"]`);
    await tapAct(p, `.board-svg [data-act="step-arrow"][data-col="${pair.turbine}"]`);
  }
  for (const bar of sol.placements) {
    await select(p, bar.piece === 'I' ? `I:${bar.country}` : bar.piece);
    await lay(p, bar);
  }
}
export const playSolutionOn = playSolution;
export { cellPoint, select, lay, tapXY };
