/*
 * Node tests for the Spot-Elec engine.
 * - Pose mode: the reference solution of each of the 11 pose grids is solved; failure cases (inventory incomplete or
 *   exceeded, each clue type violated, export flow differing from the total, given bar removed, CO2 cap) are refused.
 * - Target mode: the 2 target-score grids reach their target.
 * - Placement rules: invalid bars, caps, saturated line, STEP, export clamp.
 * Run: node demo/test_engine.js
 */
'use strict';
var assert = require('assert');
var E = require('./engine');
var GRIDS = require('./grids.js');

var passed = 0;
function test(name, fn) {
  try { fn(); passed++; console.log('ok   ' + name); }
  catch (err) { console.error('FAIL ' + name + '\n     ' + err.message); process.exitCode = 1; }
}
function grid(id) { return GRIDS.filter(function (g) { return g.id === id; })[0]; }
function copy(o) { return JSON.parse(JSON.stringify(o)); }
function poseGrids() { return GRIDS.filter(function (g) { return g.mode === 'pose'; }); }
function hasError(ev, re) { return ev.errors.some(function (m) { return re.test(m); }); }
function hasUnmet(ev, re) { return ev.pose.unmet.some(function (m) { return re.test(m); }); }
function evalSol(g) { return E.evaluate(g, E.solutionState(g)); }
// Copy of a pose grid with one clue replaced by its patched version (the stored text is dropped).
function patchClue(g, i, patch) {
  var h = copy(g);
  Object.assign(h.clues[i], patch);
  delete h.clues[i].text;
  return h;
}
function clueIndex(g, type) {
  for (var i = 0; i < g.clues.length; i++) if (g.clues[i].type === type) return i;
  throw new Error('no ' + type + ' clue in grid ' + g.id);
}
// Replace the first bar of a piece in the solution state.
function replaceBar(state, piece, len, replacements) {
  var i = state.bars.findIndex(function (b) { return b.piece === piece && b.len === len; });
  assert.ok(i >= 0, 'bar ' + piece + len + ' not found');
  var b = state.bars[i];
  state.bars.splice(i, 1);
  replacements.forEach(function (r) { state.bars.push({ piece: r.piece || piece, row: b.row, col: b.col + (r.dc || 0), len: r.len }); });
  return state;
}

// ---- data ------------------------------------------------------------------

test('grids.js matches grids-pose.json', function () {
  assert.deepStrictEqual(GRIDS, require('./grids-pose.json'));
  assert.strictEqual(GRIDS.length, 13);
  assert.strictEqual(poseGrids().length, 11);
});

test('sections: 7 tutorial, 4 grids rated Facile to Expert, 2 target', function () {
  var count = {};
  GRIDS.forEach(function (g) { count[g.section] = (count[g.section] || 0) + 1; });
  assert.deepStrictEqual(count, { 'Tutoriel': 7, 'Grilles': 4, 'Score cible': 2 });
  var notes = GRIDS.filter(function (g) { return g.section === 'Grilles'; })
    .map(function (g) { return g.difficulty.rating_label; });
  assert.deepStrictEqual(notes, ['Facile', 'Moyen', 'Difficile', 'Expert']);
});

// ---- pose mode: success ------------------------------------------------------

poseGrids().forEach(function (g) {
  test('pose grid ' + g.id + ' reference solution is solved', function () {
    var ev = evalSol(g);
    assert.deepStrictEqual(ev.errors, []);
    assert.deepStrictEqual(ev.pose.unmet, []);
    assert.strictEqual(ev.missing, 0);
    assert.strictEqual(ev.pose.success, true);
    assert.ok(ev.pose.clues.every(function (c) { return c.ok; }));
    assert.ok(ev.pose.inventory.every(function (it) { return it.status === 'done' || it.status === 'free'; }));
    assert.strictEqual(ev.stars, 0); // no stars in pose mode
  });
});

test('clue texts built by the engine match the solver texts of all grids', function () {
  poseGrids().forEach(function (g) {
    (g.clues || []).forEach(function (cl) {
      var bare = copy(cl);
      delete bare.text;
      assert.strictEqual(E.clueText(g, bare), cl.text);
    });
  });
});

test('empty pose grid is not solved and lists what is missing', function () {
  var g = grid(1);
  var ev = E.evaluate(g, E.newState(g));
  assert.strictEqual(ev.pose.success, false);
  assert.ok(hasUnmet(ev, /Il reste \d+ cases? à paver/));
  assert.ok(hasUnmet(ev, /Il reste à poser des barres de nucléaire : 6, 6/));
  assert.ok(hasUnmet(ev, /Il reste à poser du TAC|Il reste à poser du gaz|Il reste à poser/));
});

test('price clues given as price_clues are read', function () {
  var g = copy(grid(2));
  var price = g.clues[clueIndex(g, 'price')];
  g.clues = [];
  g.price_clues = [];
  for (var c = 0; c < g.columns.length; c++) g.price_clues.push(c === price.col ? price.value : null);
  assert.strictEqual(E.allClues(g).length, 1);
  assert.strictEqual(evalSol(g).pose.success, true);
  g.price_clues[price.col] = price.value + 1;
  assert.strictEqual(evalSol(g).pose.success, false);
});

// ---- pose mode: failures -----------------------------------------------------

test('inventory incomplete: a laid bar is missing', function () {
  var g = grid(1);
  var s = E.solutionState(g);
  s.bars.splice(s.bars.findIndex(function (b) { return b.piece === 'G'; }), 1);
  var ev = E.evaluate(g, s);
  assert.strictEqual(ev.pose.success, false);
  assert.ok(hasUnmet(ev, /Il reste à poser du gaz|Il reste à poser des barres de gaz/));
  assert.ok(hasUnmet(ev, /Il reste 2 cases à paver/));
});

test('inventory exceeded: exact bars differ (6 laid as 3 + 3)', function () {
  var g = grid(1);
  var s = replaceBar(E.solutionState(g), 'N', 6, [{ len: 3 }, { len: 3, dc: 3 }]);
  var ev = E.evaluate(g, s);
  assert.strictEqual(ev.missing, 0);
  assert.strictEqual(ev.pose.success, false);
  assert.ok(hasUnmet(ev, /Barres de nucléaire en trop : 3, 3/));
  assert.strictEqual(ev.pose.inventory.filter(function (it) { return it.id === 'N'; })[0].status, 'over');
});

test('inventory exceeded: one cell too many of a piece with a cell count', function () {
  var g = grid(1); // T: 2 cells; G bar of 2 replaced by two T cells
  var s = replaceBar(E.solutionState(g), 'G', 2, [{ piece: 'T', len: 1 }, { piece: 'T', len: 1, dc: 1 }]);
  var ev = E.evaluate(g, s);
  assert.strictEqual(ev.missing, 0);
  assert.strictEqual(ev.pose.success, false);
  assert.ok(hasUnmet(ev, /Trop de TAC posé : 2 cases en trop/));
  assert.ok(hasUnmet(ev, /Il reste à poser des barres de gaz : 2/));
});

test('a piece absent from the inventory is refused', function () {
  var g = grid(1);
  var s = replaceBar(E.solutionState(g), 'G', 2, [{ piece: 'B', len: 1 }, { piece: 'B', len: 1, dc: 1 }]);
  var ev = E.evaluate(g, s); // grid 1 has no B piece: the bars are unknown
  assert.strictEqual(ev.pose.success, false);
});

test('inventory level none: counts are free, the rest still holds', function () {
  var g = grid(8);
  assert.strictEqual(g.inventory.level, 'none');
  var items = evalSol(g).pose.inventory.filter(function (it) { return it.kind === 'piece'; });
  assert.ok(items.every(function (it) { return it.status === 'free'; }));
});

test('exports different from the inventory total are refused', function () {
  var g = grid(3); // exports X: 2
  var s = E.solutionState(g);
  var col = s.exports.X.indexOf(1);
  s.exports.X[col] = 0; // total 1: the silhouette shrinks and a bar leaves it
  var ev = E.evaluate(g, s);
  assert.strictEqual(ev.pose.success, false);
  assert.ok(hasUnmet(ev, /Il reste 1 bloc à exporter/));
  var more = copy(g);
  more.inventory.exports.X = 3;
  var ev2 = evalSol(more);
  assert.strictEqual(ev2.pose.success, false);
  assert.ok(hasUnmet(ev2, /Il reste 1 bloc à exporter/));
  var fewer = copy(g);
  fewer.inventory.exports.X = 1;
  assert.ok(hasUnmet(evalSol(fewer), /Trop d’export/));
});

test('imports and STEP must equal the inventory totals', function () {
  var g = grid(3); // imports X: 1
  var more = copy(g);
  more.inventory.imports.X = 2;
  assert.ok(hasUnmet(evalSol(more), /Il reste 1 case à importer/));
  var s7 = grid(7); // STEP 1
  var more7 = copy(s7);
  more7.inventory.step = 2;
  assert.ok(hasUnmet(evalSol(more7), /Il reste 1 paire de STEP à poser/));
  var s = E.solutionState(s7);
  s.step = [];
  assert.strictEqual(E.evaluate(s7, s).pose.success, false);
});

test('any-country import total (key "I") is counted across countries', function () {
  var g = copy(grid(3));
  g.inventory.imports = { I: 1 };
  assert.strictEqual(evalSol(g).pose.success, true);
  g.inventory.imports = { I: 2 };
  assert.ok(hasUnmet(evalSol(g), /Il reste 1 case à importer/));
});

test('price clue violated', function () {
  var g = grid(2), i = clueIndex(g, 'price');
  var bad = patchClue(g, i, { value: g.clues[i].value + 1 });
  var ev = evalSol(bad);
  assert.strictEqual(ev.pose.success, false);
  assert.ok(hasUnmet(ev, /Indice non respecté : À .*, le prix est de/));
});

test('bar clue violated', function () {
  var g = grid(7), i = clueIndex(g, 'bar');
  var bad = patchClue(g, i, { col: g.clues[i].col - 1 });
  var ev = evalSol(bad);
  assert.strictEqual(ev.pose.success, false);
  assert.ok(hasUnmet(ev, /Indice non respecté : Un\(e\) réacteur tourne de/));
});

test('column clue violated', function () {
  var g = grid(7), i = clueIndex(g, 'column');
  var bad = patchClue(g, i, { counts: { N: g.clues[i].counts.N + 1 } });
  var ev = evalSol(bad);
  assert.strictEqual(ev.pose.success, false);
  assert.ok(hasUnmet(ev, /Indice non respecté : Relevé de/));
});

test('flow clue violated (export and import)', function () {
  var g = grid(7), i = clueIndex(g, 'flow');
  var bad = patchClue(g, i, { value: 0 });
  assert.ok(hasUnmet(evalSol(bad), /Indice non respecté : À .*, aucun export vers Voisin/));
  var g5 = grid(5), j = clueIndex(g5, 'flow');
  assert.strictEqual(g5.clues[j].dir, 'import');
  var bad5 = patchClue(g5, j, { value: 1 });
  var ev5 = evalSol(bad5);
  assert.strictEqual(ev5.pose.success, false);
  assert.ok(hasUnmet(ev5, /Indice non respecté : À .*, 1 case importée de Voisin/));
});

// A given bar is a clue: pre-placed, locked, and required.
function withGiven(g) {
  var h = copy(g);
  var b = E.solutionState(g).bars.filter(function (x) { return x.piece === 'N'; })[0];
  h.clues = (h.clues || []).concat([{ type: 'given', piece: b.piece, row: b.row, col: b.col, len: b.len }]);
  return h;
}

test('given bar is pre-placed, locked and part of the solution', function () {
  var g = withGiven(grid(1));
  var s = E.newState(g);
  assert.strictEqual(s.bars.length, 1);
  assert.strictEqual(s.bars[0].locked, true);
  assert.strictEqual(E.removeBarAt(s, s.bars[0].row, s.bars[0].col), false);
  assert.strictEqual(s.bars.length, 1);
  assert.strictEqual(E.cloneState(s).bars[0].locked, true);
  var ev = evalSol(g);
  assert.strictEqual(ev.pose.success, true);
  assert.ok(E.solutionState(g).bars.some(function (b) { return b.locked; }));
  assert.ok(/^Déjà engagé\(e\) : réacteur de 0h à \d+h, ligne 1\.$/.test(E.clueText(g, g.clues[g.clues.length - 1])));
});

test('given bar removed: the grid is not solved', function () {
  var g = withGiven(grid(1));
  var s = E.solutionState(g);
  var i = s.bars.findIndex(function (b) { return b.locked; });
  s.bars.splice(i, 1); // bypasses the lock, as a corrupted state would
  var ev = E.evaluate(g, s);
  assert.strictEqual(ev.pose.success, false);
  assert.ok(hasUnmet(ev, /Indice non respecté : Déjà engagé/));
});

test('CO2 cap is enforced in pose mode', function () {
  var g = copy(grid(1));
  var co2 = evalSol(g).co2;
  assert.ok(co2 > 0);
  g.constraints = { co2_cap: co2 };
  assert.strictEqual(evalSol(g).pose.success, true);
  g.constraints = { co2_cap: co2 - 1 };
  var ev = evalSol(g);
  assert.strictEqual(ev.pose.success, false);
  assert.ok(hasUnmet(ev, /Plafond CO₂ dépassé/));
});

test('curtailment is refused in pose mode', function () {
  var g = copy(grid(3));
  g.residual[0] = -1;
  var ev = E.evaluate(g, E.newState(g));
  assert.ok(hasError(ev, /Écrêtement interdit/));
});

test('no score or star in the pose result', function () {
  var g = grid(1);
  var ev = evalSol(g);
  assert.strictEqual(ev.stars, 0);
  assert.strictEqual(ev.goal, null);
});

// ---- target mode -------------------------------------------------------------

GRIDS.filter(function (g) { return g.mode === 'target'; }).forEach(function (g) {
  test('target grid ' + g.id + ' reaches its target', function () {
    var ev = evalSol(g);
    assert.deepStrictEqual(ev.errors, []);
    assert.strictEqual(ev.complete, true);
    assert.strictEqual(ev.score, g.objective.target);
    assert.strictEqual(ev.score, g.optimum.score);
    if (g.optimum.cost !== undefined) assert.strictEqual(ev.cost, g.optimum.cost);
    assert.ok(ev.stars >= 2);
    assert.strictEqual(ev.pose, undefined);
  });
});

test('target missed gives one star', function () {
  var g = copy(grid(12));
  g.objective.target += 1;
  var ev = evalSol(g);
  assert.strictEqual(ev.complete, true);
  assert.strictEqual(ev.stars, 1);
});

// ---- placement rules ---------------------------------------------------------

test('bar too short or too long is rejected', function () {
  var g = grid(2);
  var res = E.checkBar(g, E.newState(g), { piece: 'N', row: 0, col: 0, len: 2 });
  assert.strictEqual(res.code, 'length');
  assert.ok(/3 à 6 créneaux/.test(res.message));
  assert.strictEqual(E.checkBar(g, E.newState(g), { piece: 'N', row: 0, col: 0, len: 7 }).code, 'length');
});

test('bar outside the silhouette or the grid is rejected', function () {
  var g = grid(1);
  assert.strictEqual(E.checkBar(g, E.newState(g), { piece: 'G', row: 5, col: 0, len: 2 }).code, 'silhouette');
  assert.strictEqual(E.checkBar(g, E.newState(g), { piece: 'N', row: 0, col: g.columns.length - 2, len: 3 }).code, 'bounds');
});

test('overlapping bar is rejected', function () {
  var g = grid(1);
  var s = E.newState(g);
  assert.ok(E.tryAddBar(g, s, { piece: 'N', row: 0, col: 0, len: 3 }).ok);
  assert.strictEqual(E.tryAddBar(g, s, { piece: 'N', row: 0, col: 2, len: 3 }).code, 'occupied');
});

test('piece cap exceeded is rejected', function () {
  var g = grid(12);
  var cap = g.pieces.B.cap;
  var s = E.newState(g), placed = 0;
  for (var c = 0; c < g.columns.length && placed < cap; c++) {
    for (var r = 0; r < g.residual[c] && placed < cap; r++) {
      assert.ok(E.tryAddBar(g, s, { piece: 'B', row: r, col: c, len: 1 }).ok);
      placed++;
    }
  }
  var left = null;
  for (c = 0; c < g.columns.length && !left; c++) {
    for (r = 0; r < g.residual[c]; r++) if (E.barIndexAt(s, r, c) < 0) { left = { row: r, col: c }; break; }
  }
  assert.strictEqual(E.tryAddBar(g, s, { piece: 'B', row: left.row, col: left.col, len: 1 }).code, 'cap');
});

test('saturated line is rejected', function () {
  var g = grid(3); // line capacity 1
  var s = E.newState(g);
  var col = E.solutionState(g).exports.X.indexOf(1);
  E.setExport(g, s, 'X', col, 1);
  var res = E.tryAddBar(g, s, { piece: 'I', row: 0, col: col, len: 1 });
  assert.strictEqual(res.code, 'line');
  assert.ok(/Ligne saturée à/.test(res.message));
});

test('export is clamped to the line capacity', function () {
  var g = grid(3);
  var s = E.newState(g);
  assert.strictEqual(E.setExport(g, s, 'X', 0, 5), 1);
  assert.strictEqual(E.setExport(g, s, 'X', 0, -3), 0);
  assert.strictEqual(E.maxExport(grid(1), 'X'), 0);
});

test('inverted STEP is rejected and STEP count is limited', function () {
  var g = grid(7);
  var res = E.tryAddStep(g, E.newState(g), 7, 5);
  assert.strictEqual(res.ok, false);
  assert.ok(/STEP inversée/.test(res.message));
  var s = E.newState(g);
  assert.ok(E.tryAddStep(g, s, 0, 1).ok);
  assert.strictEqual(E.tryAddStep(g, s, 2, 3).ok, false);
  assert.strictEqual(E.tryAddStep(grid(1), E.newState(grid(1)), 0, 1).ok, false);
});

test('STEP moves the silhouette', function () {
  var g = grid(7);
  var s = E.newState(g);
  E.tryAddStep(g, s, 5, 7);
  var h = E.heights(g, s).h;
  assert.strictEqual(h[5], g.residual[5] + 1);
  assert.strictEqual(h[7], g.residual[7] - 1);
});

test('bars leaving the silhouette become invalid and block the solution', function () {
  var g = grid(3);
  var s = E.solutionState(g);
  var col = s.exports.X.indexOf(1);
  s.exports.X[col] = 0;
  var ev = E.evaluate(g, s);
  assert.strictEqual(ev.complete, false);
  assert.ok(Object.keys(ev.invalid).length > 0);
});

test('removeBarAt removes the bar covering a cell', function () {
  var g = grid(1);
  var s = E.newState(g);
  E.tryAddBar(g, s, { piece: 'N', row: 0, col: 0, len: 4 });
  assert.strictEqual(E.removeBarAt(s, 0, 3), true);
  assert.strictEqual(s.bars.length, 0);
  assert.strictEqual(E.removeBarAt(s, 0, 3), false);
});

console.log('\n' + passed + ' tests passed' + (process.exitCode ? ' (with failures)' : ''));
