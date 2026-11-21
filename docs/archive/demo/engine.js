/*
 * Spot-Elec demo engine (pure logic, no DOM).
 * - Computes column heights, placement validity, v2 score (slot prices), cell cost (tie-break), CO2, objective constraints, stars, errors.
 * - Pose mode (grid.mode === 'pose'): no score; a grid is solved when the silhouette is paved, the inventory is laid
 *   and every clue and constraint holds (evaluatePose, poseInventory, clueStatus, clueText).
 * - Browser: global `SpotEngine`. Node: `module.exports`.
 *
 * State shape: { exports: {neighborId: number[]}, step: [{pump, turbine}], bars: [{piece, row, col, len}] }
 * Example (Node): const E = require('./engine'); E.evaluate(grid, E.solutionState(grid));
 */
(function (root, factory) {
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.SpotEngine = api;
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var PIECE_NAMES = { N: 'nucléaire', C: 'charbon', G: 'gaz', T: 'TAC', B: 'barrage', I: 'import' };

  var nbCache = typeof WeakMap === 'function' ? new WeakMap() : null;
  var swapCache = typeof WeakMap === 'function' ? new WeakMap() : null;

  /*
   * Normalized neighbor list. A legacy single `neighbor` reads as one neighbor "X" (CO2 0, import piece "I");
   * a `neighbors` list uses import pieces "I:<id>". `budget` is null when unlimited.
   */
  function neighbors(grid) {
    if (nbCache && nbCache.has(grid)) return nbCache.get(grid);
    var list = [];
    if (grid.neighbors) {
      list = grid.neighbors.map(function (nb) { return normNeighbor(nb, nb.id, true); });
    } else if (grid.neighbor) {
      list = [normNeighbor(grid.neighbor, 'X', false)];
    }
    if (nbCache) nbCache.set(grid, list);
    return list;
  }

  function normNeighbor(nb, id, multi) {
    return {
      id: id, name: nb.name || id, price: nb.price, cap: nb.cap,
      canImport: !!nb.import, canExport: !!nb.export,
      co2: nb.co2 || 0,
      budget: nb.export_budget === undefined ? 2 : nb.export_budget,
      pieceId: multi ? 'I:' + id : 'I',
      multi: multi
    };
  }

  function isImport(id) { return id === 'I' || id.indexOf('I:') === 0; }

  function neighborOf(grid, pieceId) {
    var list = neighbors(grid);
    for (var i = 0; i < list.length; i++) if (list[i].pieceId === pieceId) return list[i];
    return null;
  }

  function neighborById(grid, id) {
    var list = neighbors(grid);
    for (var i = 0; i < list.length; i++) if (list[i].id === id) return list[i];
    return null;
  }

  function isPose(grid) { return grid.mode === 'pose'; }

  function constraints(grid) {
    if (isPose(grid)) return grid.constraints || {};
    return (grid.objective && grid.objective.constraints) || {};
  }

  function pieceDef(grid, id) {
    if (isImport(id)) {
      var nb = neighborOf(grid, id);
      return nb && nb.canImport ? { len: [1], price: null, co2: nb.co2, neighbor: nb } : null;
    }
    return (grid.pieces && grid.pieces[id]) || null;
  }

  function pieceLabel(grid, id) {
    if (!isImport(id)) return id;
    var nb = neighborOf(grid, id);
    return nb && nb.multi ? 'I·' + nb.id : 'I';
  }

  function piecePrice(grid, id, col) {
    if (isImport(id)) return neighborOf(grid, id).price[col];
    return grid.pieces[id].price;
  }

  function newState(grid) {
    var exp = {};
    neighbors(grid).forEach(function (nb) { exp[nb.id] = grid.columns.map(function () { return 0; }); });
    var state = { exports: exp, step: [], bars: [] };
    allClues(grid).forEach(function (cl) {
      if (cl.type === 'given') state.bars.push({ piece: cl.piece, row: cl.row, col: cl.col, len: cl.len, locked: true });
    });
    return state;
  }

  function cloneState(state) {
    var exp = {};
    Object.keys(state.exports).forEach(function (k) { exp[k] = state.exports[k].slice(); });
    return {
      exports: exp,
      step: state.step.map(function (s) { return { pump: s.pump, turbine: s.turbine }; }),
      bars: state.bars.map(function (b) { return copyBar(b); })
    };
  }

  function copyBar(b) {
    var o = { piece: b.piece, row: b.row, col: b.col, len: b.len };
    if (b.locked) o.locked = true;
    return o;
  }

  // Reference solution as a state; exports are keyed by neighbor id (a legacy array maps to the single neighbor).
  function solutionState(grid) {
    var sol = grid.solution;
    var state = newState(grid);
    var list = neighbors(grid);
    if (Array.isArray(sol.exports)) {
      if (list.length) state.exports[list[0].id] = sol.exports.slice();
    } else {
      Object.keys(sol.exports || {}).forEach(function (k) { state.exports[k] = sol.exports[k].slice(); });
    }
    state.step = (sol.step || []).map(function (s) { return { pump: s.pump, turbine: s.turbine }; });
    state.bars = sol.placements.map(function (b) {
      var o = copyBar(b);
      if (isGiven(grid, o)) o.locked = true;
      return o;
    });
    return state;
  }

  function totalExport(state, col) {
    var t = 0;
    Object.keys(state.exports).forEach(function (k) { t += state.exports[k][col] || 0; });
    return t;
  }

  // Height to pave per column; negative heights are curtailed (effective height 0).
  function heights(grid, state) {
    var n = grid.columns.length;
    var h = [], curtail = [], eff = [];
    for (var c = 0; c < n; c++) {
      var v = grid.residual[c] + totalExport(state, c);
      for (var i = 0; i < state.step.length; i++) {
        if (state.step[i].pump === c) v += 1;
        if (state.step[i].turbine === c) v -= 1;
      }
      h.push(v);
      curtail.push(v < 0 ? -v : 0);
      eff.push(v < 0 ? 0 : v);
    }
    return { h: h, curtail: curtail, eff: eff };
  }

  function lenText(lens) {
    var min = lens[0], max = lens[lens.length - 1];
    if (lens.length === 1) return min === 1 ? '1 créneau' : 'exactement ' + min + ' créneaux';
    var contiguous = lens.every(function (l, i) { return i === 0 || l === lens[i - 1] + 1; });
    return contiguous ? min + ' à ' + max + ' créneaux' : lens.join(', ') + ' créneaux';
  }

  function usedCells(state, id, skip) {
    var total = 0;
    state.bars.forEach(function (b, i) { if (i !== skip && b.piece === id) total += b.len; });
    return total;
  }

  // Imports from one neighbor (by id) in one column.
  function importsInColumn(grid, state, col, nbId, skip) {
    var nb = neighborById(grid, nbId);
    var count = 0;
    if (!nb) return 0;
    state.bars.forEach(function (b, i) {
      if (i !== skip && b.piece === nb.pieceId && col >= b.col && col < b.col + b.len) count++;
    });
    return count;
  }

  function overlaps(state, bar, skip) {
    for (var i = 0; i < state.bars.length; i++) {
      if (i === skip) continue;
      var o = state.bars[i];
      if (o.row === bar.row && bar.col < o.col + o.len && o.col < bar.col + bar.len) return true;
    }
    return false;
  }

  function fail(code, message) { return { ok: false, code: code, message: message }; }

  function pieceName(grid, id) {
    if (!isImport(id)) return PIECE_NAMES[id] || id;
    var nb = neighborOf(grid, id);
    return nb && nb.multi ? 'import ' + nb.name : 'import';
  }

  /*
   * Check one bar against the grid and state. `skip` ignores that bar index (when re-checking
   * a bar already in the state). `structural` skips the aggregate checks (cap, line).
   */
  function checkBar(grid, state, bar, opts) {
    opts = opts || {};
    var skip = opts.skip === undefined ? -1 : opts.skip;
    var def = pieceDef(grid, bar.piece);
    if (!def) return fail('unknown', 'Pièce inconnue : ' + bar.piece + '.');
    var name = isImport(bar.piece) ? 'import' : bar.piece;
    if (def.len.indexOf(bar.len) < 0) {
      return fail('length', 'La barre ' + name + ' doit faire ' + lenText(def.len) + '.');
    }
    var n = grid.columns.length;
    if (bar.col < 0 || bar.row < 0 || bar.col + bar.len > n) {
      return fail('bounds', 'La barre dépasse de la grille.');
    }
    var hh = heights(grid, state);
    for (var k = bar.col; k < bar.col + bar.len; k++) {
      if (bar.row >= hh.eff[k]) {
        return fail('silhouette', 'Hors de la silhouette à ' + grid.columns[k] + '.');
      }
    }
    if (overlaps(state, bar, skip)) return fail('occupied', 'Case déjà occupée.');
    if (!opts.structural) {
      if (def.cap !== undefined && usedCells(state, bar.piece, skip) + bar.len > def.cap) {
        return fail('cap', 'Plus assez de cases de ' + pieceName(grid, bar.piece) + ' (' + def.cap + ' au total).');
      }
      if (def.neighbor) {
        for (var j = bar.col; j < bar.col + bar.len; j++) {
          var ex = (state.exports[def.neighbor.id] || [])[j] || 0;
          if (ex + importsInColumn(grid, state, j, def.neighbor.id, skip) + 1 > def.neighbor.cap) {
            return fail('line', 'Ligne saturée à ' + grid.columns[j] + '.');
          }
        }
      }
    }
    return { ok: true };
  }

  function tryAddBar(grid, state, bar) {
    var res = checkBar(grid, state, bar);
    if (res.ok) state.bars.push({ piece: bar.piece, row: bar.row, col: bar.col, len: bar.len });
    return res;
  }

  function barIndexAt(state, row, col) {
    for (var i = 0; i < state.bars.length; i++) {
      var b = state.bars[i];
      if (b.row === row && col >= b.col && col < b.col + b.len) return i;
    }
    return -1;
  }

  // Pre-placed (`given`) bars are locked and cannot be erased.
  function removeBarAt(state, row, col) {
    var i = barIndexAt(state, row, col);
    if (i < 0 || state.bars[i].locked) return false;
    state.bars.splice(i, 1);
    return true;
  }

  // Line capacity for exports to one neighbor (0 when it does not buy).
  function maxExport(grid, nbId) {
    var nb = neighborById(grid, nbId);
    return nb && nb.canExport ? nb.cap : 0;
  }

  // Blocks exported to one neighbor over the whole day.
  function exportsUsed(state, nbId) {
    return (state.exports[nbId] || []).reduce(function (a, b) { return a + b; }, 0);
  }

  // Set one export, clamped to [0, line capacity]. The daily budget is checked by evaluate().
  // Bars are never removed.
  function setExport(grid, state, nbId, col, value) {
    var v = Math.max(0, Math.min(maxExport(grid, nbId), value));
    if (!state.exports[nbId]) state.exports[nbId] = grid.columns.map(function () { return 0; });
    state.exports[nbId][col] = v;
    return v;
  }

  function tryAddStep(grid, state, pump, turbine) {
    if (!grid.step) return fail('step', 'Cette grille n’a pas de STEP.');
    if (state.step.length >= grid.step) return fail('step', 'Toutes les paires STEP sont déjà posées.');
    if (pump >= turbine) return fail('step', 'STEP inversée : le pompage doit précéder le turbinage.');
    state.step.push({ pump: pump, turbine: turbine });
    return { ok: true };
  }

  function removeStep(state, index) {
    if (index >= 0 && index < state.step.length) state.step.splice(index, 1);
  }

  // Blocks traded with neighbors: imported cells plus exported blocks.
  function swapCount(grid, state) {
    var t = 0;
    state.bars.forEach(function (b) { if (isImport(b.piece)) t += b.len; });
    Object.keys(state.exports).forEach(function (k) { t += exportsUsed(state, k); });
    return t;
  }

  function referenceSwaps(grid) {
    if (swapCache && swapCache.has(grid)) return swapCache.get(grid);
    var v = swapCount(grid, solutionState(grid));
    if (swapCache) swapCache.set(grid, v);
    return v;
  }

  function evaluate(grid, state) {
    var n = grid.columns.length;
    var hh = heights(grid, state);
    var errors = [];
    var invalid = {};
    var label = function (c) { return grid.columns[c]; };
    var nbs = neighbors(grid);
    var cons = constraints(grid);
    var c;

    // Exports: line capacity per column and daily budget per neighbor
    nbs.forEach(function (nb) {
      var top = nb.canExport ? nb.cap : 0;
      var vals = state.exports[nb.id] || [];
      for (var k = 0; k < n; k++) {
        var e = vals[k] || 0;
        if (e < 0 || e > top) errors.push('Export impossible à ' + label(k) + (nb.multi ? ' vers ' + nb.name : '') + '.');
      }
      if (nb.budget !== null && exportsUsed(state, nb.id) > nb.budget) {
        errors.push('Budget d’export dépassé' + (nb.multi ? ' vers ' + nb.name : '') + ' : ' + exportsUsed(state, nb.id) + ' / ' + nb.budget + '.');
      }
    });

    // STEP
    if (state.step.length > (grid.step || 0)) errors.push('Trop de paires STEP.');
    state.step.forEach(function (s) {
      if (s.pump < 0 || s.turbine >= n || s.pump >= s.turbine) {
        errors.push('STEP inversée : le pompage doit précéder le turbinage.');
      }
    });

    // Curtailment
    for (c = 0; c < n; c++) {
      if (hh.curtail[c] > 0 && grid.curtail_penalty === undefined) {
        errors.push('Écrêtement interdit à ' + label(c) + '.');
      }
    }

    // Bars
    var covered = {};
    state.bars.forEach(function (b, i) {
      var res = checkBar(grid, state, b, { skip: i, structural: true });
      if (!res.ok) {
        invalid[i] = res.message;
        errors.push(res.message);
        return;
      }
      for (var k = b.col; k < b.col + b.len; k++) covered[b.row + ',' + k] = true;
    });

    // Caps per piece
    Object.keys(grid.pieces).forEach(function (id) {
      var cap = grid.pieces[id].cap;
      if (cap !== undefined && usedCells(state, id, -1) > cap) {
        errors.push('Trop de cases de ' + PIECE_NAMES[id] + ' : ' + usedCells(state, id, -1) + ' / ' + cap + '.');
      }
    });

    // Line saturation per neighbor
    nbs.forEach(function (nb) {
      for (var k = 0; k < n; k++) {
        if (((state.exports[nb.id] || [])[k] || 0) + importsInColumn(grid, state, k, nb.id, -1) > nb.cap) {
          errors.push('Ligne saturée à ' + label(k) + (nb.multi ? ' (' + nb.name + ')' : '') + '.');
        }
      }
    });

    // Uncovered cells
    var missing = 0, totalCells = 0;
    var missingByCol = [];
    for (c = 0; c < n; c++) {
      var m = 0;
      for (var r = 0; r < hh.eff[c]; r++) {
        totalCells++;
        if (!covered[r + ',' + c]) m++;
      }
      missingByCol.push(m);
      missing += m;
    }

    // Slot price = price of the most expensive cell of the column (0 when nothing to pave); CO2 incl. imports
    var co2 = 0, imports = 0, cost = 0;
    var colPrice = [], maxPrice = [];
    for (c = 0; c < n; c++) maxPrice.push(null);
    state.bars.forEach(function (b) {
      var def = pieceDef(grid, b.piece);
      if (!def) return;
      for (var k = b.col; k < b.col + b.len && k < n; k++) {
        var p = piecePrice(grid, b.piece, k);
        co2 += def.co2;
        if (isImport(b.piece)) imports++;
        cost += p;
        if (maxPrice[k] === null || p > maxPrice[k]) maxPrice[k] = p;
      }
    });
    var slotsTotal = 0, penalty = 0, revenue = 0;
    for (c = 0; c < n; c++) {
      var cp = hh.eff[c] > 0 && maxPrice[c] !== null ? maxPrice[c] : 0;
      colPrice.push(cp);
      slotsTotal += cp;
      penalty += hh.curtail[c] * (grid.curtail_penalty || 0);
      nbs.forEach(function (nb) { revenue += ((state.exports[nb.id] || [])[c] || 0) * nb.price[c]; });
    }
    var score = slotsTotal - revenue + penalty;
    var swaps = swapCount(grid, state);

    // Objective constraints
    var maxCol = colPrice.reduce(function (a, b) { return Math.max(a, b); }, 0);
    if (cons.co2_cap != null && co2 > cons.co2_cap) {
      errors.push('Plafond CO₂ dépassé : ' + co2 + ' / ' + cons.co2_cap + '.');
    }
    if (cons.price_cap !== undefined && maxCol > cons.price_cap) {
      errors.push('Prix plafond dépassé : un créneau est à ' + maxCol + ' (plafond ' + cons.price_cap + ').');
    }
    if (cons.no_import && imports > 0) errors.push('Aucun import autorisé aujourd’hui.');
    if (cons.smooth !== undefined) {
      for (c = 0; c < n - 1; c++) {
        if (Math.abs(colPrice[c] - colPrice[c + 1]) > cons.smooth) {
          errors.push('Prix trop irrégulier entre ' + label(c) + ' et ' + label(c + 1) + ' : écart max ' + cons.smooth + '.');
        }
      }
    }

    var pose = isPose(grid);
    var isTarget = !pose && grid.objective && grid.objective.optimize === 'target';
    var goal = null, optCost, optTrades;
    if (!pose) {
      goal = isTarget ? grid.objective.target : grid.optimum.score;
      optCost = grid.optimum.cost;
      optTrades = grid.optimum.trades;
      if (optTrades === undefined) optTrades = referenceSwaps(grid);
    }
    var complete = errors.length === 0 && missing === 0;
    var stars = 0;
    var gap = null; // what a 2-star program still lacks: 'cost', 'trades' or null
    if (complete && !pose) {
      stars = 1;
      if (score === goal) {
        stars = 2;
        if (optCost !== undefined && cost !== optCost) gap = 'cost';
        else if (swaps !== optTrades) gap = 'trades';
        if ((optCost === undefined || cost === optCost) && swaps === optTrades) stars = 3;
      }
    }

    var used = {};
    Object.keys(grid.pieces).forEach(function (id) { used[id] = usedCells(state, id, -1); });

    var result = {
      h: hh.h, eff: hh.eff, curtail: hh.curtail,
      invalid: invalid, errors: errors,
      missing: missing, missingByCol: missingByCol, totalCells: totalCells,
      colPrice: colPrice, slotsTotal: slotsTotal, revenue: revenue, penalty: penalty,
      score: score, cost: cost, co2: co2, swaps: swaps, goal: goal,
      optCost: optCost, optTrades: optTrades, gap: gap,
      used: used,
      complete: complete, stars: stars
    };
    if (pose) result.pose = evaluatePose(grid, state, result);
    return result;
  }


  // ---- pose mode ----------------------------------------------------------

  var CLUE_TYPES = ['price', 'bar', 'column', 'given', 'flow'];
  var ANY_COUNTRY = 'I';
  // [price setter, plant, cell noun] in French (same words as the solver's clue texts)
  var PIECE_WORDS = {
    N: ['le nucléaire', 'réacteur', 'nucléaire'], B: ['le barrage', 'barrage', 'barrage'],
    C: ['le charbon', 'centrale à charbon', 'charbon'], G: ['le gaz', 'centrale à gaz', 'gaz'],
    T: ['la TAC', 'TAC', 'TAC']
  };

  function plural(n, word) { return n + ' ' + word + (n > 1 ? 's' : ''); }

  // All clues of a grid: `clues` plus each published `price_clues` value as a price clue.
  function allClues(grid) {
    var out = (grid.clues || []).slice();
    (grid.price_clues || []).forEach(function (v, c) {
      if (v !== null && v !== undefined) out.push({ type: 'price', col: c, value: v });
    });
    return out;
  }

  function isGiven(grid, bar) {
    return allClues(grid).some(function (cl) {
      return cl.type === 'given' && cl.piece === bar.piece && cl.row === bar.row && cl.col === bar.col && cl.len === bar.len;
    });
  }

  function pieceWords(grid, id) {
    if (isImport(id)) {
      var nb = neighborOf(grid, id);
      var n = nb ? nb.name : 'voisin';
      return ["l'import de " + n, 'import de ' + n, 'import de ' + n];
    }
    return PIECE_WORDS[id] || [id, id, id];
  }

  function endHour(grid, col, len) { return Math.floor((col + len) * 24 / grid.columns.length); }

  // French text of a clue, as a market document (the `text` field wins when present).
  function clueText(grid, clue) {
    if (clue.text) return clue.text;
    var cols = grid.columns, c = clue.col, k;
    if (clue.type === 'price') {
      var ids = Object.keys(grid.pieces).concat(neighbors(grid).filter(function (nb) { return nb.canImport; })
        .map(function (nb) { return nb.pieceId; }));
      var seen = {};
      ids.forEach(function (id) {
        if (piecePrice(grid, id, c) === clue.value) seen[pieceWords(grid, id)[0]] = true;
      });
      var setters = Object.keys(seen).sort();
      return 'À ' + cols[c] + ', le prix est de ' + clue.value + " : c'est " + (setters.length ? setters.join(' ou ') : 'personne') + ' qui le fixe.';
    }
    if (clue.type === 'bar') {
      return 'Un(e) ' + pieceWords(grid, clue.piece)[1] + ' tourne de ' + cols[c] + ' à ' + endHour(grid, c, clue.len) + 'h.';
    }
    if (clue.type === 'given') {
      return 'Déjà engagé(e) : ' + pieceWords(grid, clue.piece)[1] + ' de ' + cols[c] + ' à ' + endHour(grid, c, clue.len) + 'h, ligne ' + (clue.row + 1) + '.';
    }
    if (clue.type === 'column') {
      var parts = Object.keys(clue.counts).map(function (id) {
        k = clue.counts[id];
        return k ? plural(k, 'case') + ' de ' + pieceWords(grid, id)[2] : 'aucune case de ' + pieceWords(grid, id)[2];
      });
      return 'Relevé de ' + cols[c] + ' : ' + parts.join(', ') + '.';
    }
    var nb = neighborById(grid, clue.country);
    var name = nb ? nb.name : clue.country;
    k = clue.value;
    if (clue.dir === 'export') {
      return k ? 'À ' + cols[c] + ', ' + k + ' bloc' + (k > 1 ? 's' : '') + ' exporté' + (k > 1 ? 's' : '') + ' vers ' + name + '.'
        : 'À ' + cols[c] + ', aucun export vers ' + name + '.';
    }
    return k ? 'À ' + cols[c] + ', ' + plural(k, 'case') + ' importée' + (k > 1 ? 's' : '') + ' de ' + name + '.'
      : 'À ' + cols[c] + ', aucun import de ' + name + '.';
  }

  // Cells of a piece in one column.
  function cellsInColumn(state, id, col) {
    var n = 0;
    state.bars.forEach(function (b) { if (b.piece === id && col >= b.col && col < b.col + b.len) n++; });
    return n;
  }

  // Is one clue respected? `ev` is the evaluation (slot prices, uncovered cells).
  function clueStatus(grid, state, ev, clue) {
    var c = clue.col;
    if (clue.type === 'price') return ev.missingByCol[c] === 0 && ev.colPrice[c] === clue.value;
    if (clue.type === 'bar') {
      return state.bars.some(function (b) { return b.piece === clue.piece && b.col === c && b.len === clue.len; });
    }
    if (clue.type === 'given') {
      return state.bars.some(function (b) { return b.piece === clue.piece && b.row === clue.row && b.col === c && b.len === clue.len; });
    }
    if (clue.type === 'column') {
      return Object.keys(clue.counts).every(function (id) { return cellsInColumn(state, id, c) === clue.counts[id]; });
    }
    var nb = neighborById(grid, clue.country);
    if (!nb) return false;
    if (clue.dir === 'export') return ((state.exports[nb.id] || [])[c] || 0) === clue.value;
    return importsInColumn(grid, state, c, nb.id, -1) === clue.value;
  }

  function barLens(state, id) {
    return state.bars.filter(function (b) { return b.piece === id; }).map(function (b) { return b.len; });
  }

  function sum(a) { return a.reduce(function (x, y) { return x + y; }, 0); }

  function item(id, name, kind, status, text, unmet) {
    return { id: id, name: name, kind: kind, status: status, text: text, unmet: unmet || null };
  }

  // Inventory of a pose grid: one item per piece and per exchange, with what is left to lay.
  // status: 'free' (available, no count), 'todo', 'done' or 'over'.
  function poseInventory(grid, state) {
    var inv = grid.inventory || {}, specs = inv.pieces || {}, items = [];
    var ids = Object.keys(grid.pieces);
    neighbors(grid).forEach(function (nb) { if (nb.canImport) ids.push(nb.pieceId); });

    ids.forEach(function (id) {
      var spec = specs[id];
      var lens = barLens(state, id), cells = sum(lens), nm = pieceName(grid, id);
      var label = pieceLabel(grid, id);
      if (isImport(id)) return; // imports are handled with the exchanges
      if (spec === undefined) {
        if (cells > 0) items.push(item(id, label, 'piece', 'over', 'Pas dans l’inventaire', 'Il y a ' + nm + ' posé alors que l’inventaire n’en contient pas.'));
        return;
      }
      if (spec.bars) {
        var left = spec.bars.slice(), extra = [];
        lens.forEach(function (l) {
          var i = left.indexOf(l);
          if (i >= 0) left.splice(i, 1); else extra.push(l);
        });
        left.sort(function (a, b) { return b - a; });
        if (extra.length) items.push(item(id, label, 'piece', 'over', 'En trop : ' + extra.join(', '), 'Barres de ' + nm + ' en trop : ' + extra.join(', ') + '.'));
        else if (left.length) items.push(item(id, label, 'piece', 'todo', 'Reste : ' + left.join(', '), 'Il reste à poser des barres de ' + nm + ' : ' + left.join(', ') + '.'));
        else items.push(item(id, label, 'piece', 'done', 'Tout posé'));
        items[items.length - 1].left = left;
      } else if (spec.count !== undefined || spec.cells !== undefined) {
        var remBars = spec.count !== undefined ? spec.count - lens.length : 0;
        var remCells = spec.cells !== undefined ? spec.cells - cells : 0;
        var bits = [];
        if (spec.count !== undefined) bits.push(plural(Math.abs(remBars), 'barre'));
        if (spec.cells !== undefined) bits.push(plural(Math.abs(remCells), 'case'));
        if (remBars < 0 || remCells < 0) {
          items.push(item(id, label, 'piece', 'over', 'En trop : ' + bits.join(', '), 'Trop de ' + nm + ' posé : ' + bits.join(', ') + ' en trop.'));
        } else if (remBars > 0 || remCells > 0) {
          items.push(item(id, label, 'piece', 'todo', 'Reste : ' + bits.join(', '), 'Il reste à poser du ' + nm + ' : ' + bits.join(', ') + '.'));
        } else items.push(item(id, label, 'piece', 'done', 'Tout posé'));
      } else {
        items.push(item(id, label, 'piece', 'free', 'Disponible'));
      }
    });

    var exportsPlan = inv.exports || {}, importsPlan = inv.imports || {};
    neighbors(grid).forEach(function (nb) {
      var where = nb.multi ? ' vers ' + nb.name : '';
      if (nb.canExport || exportsPlan[nb.id]) {
        var want = exportsPlan[nb.id] || 0, got = exportsUsed(state, nb.id);
        items.push(exchangeItem('exp:' + nb.id, 'Exports' + where, got, want, 'bloc', 'à exporter' + where, 'd’export' + where));
      }
    });
    if (importsPlan[ANY_COUNTRY] !== undefined) {
      var gotAll = 0;
      neighbors(grid).forEach(function (nb) { if (nb.canImport) gotAll += sum(barLens(state, nb.pieceId)); });
      items.push(exchangeItem('imp:*', 'Imports (tous pays)', gotAll, importsPlan[ANY_COUNTRY], 'case', 'à importer', 'd’import'));
    } else {
      neighbors(grid).forEach(function (nb) {
        if (!nb.canImport) return;
        var where = nb.multi ? ' de ' + nb.name : '';
        items.push(exchangeItem('imp:' + nb.id, 'Imports' + where, sum(barLens(state, nb.pieceId)), importsPlan[nb.id] || 0, 'case', 'à importer' + where, 'd’import' + where));
      });
    }
    var stepWant = inv.step || 0;
    if (stepWant || grid.step) {
      items.push(exchangeItem('step', 'STEP', state.step.length, stepWant, 'paire', 'de STEP à poser', 'de STEP'));
    }
    return items;
  }

  function exchangeItem(id, name, got, want, unit, todoWhat, overWhat) {
    var unitP = function (n) { return n + ' ' + unit + (n > 1 ? 's' : ''); };
    var it;
    if (got > want) it = item(id, name, 'exchange', 'over', 'en trop : ' + (got - want), 'Trop ' + overWhat + ' : ' + unitP(got) + ' pour ' + want + '.');
    else if (got < want) it = item(id, name, 'exchange', 'todo', 'reste : ' + (want - got), 'Il reste ' + unitP(want - got) + ' ' + todoWhat + '.');
    else it = item(id, name, 'exchange', 'done', want ? 'tout posé' : 'aucun');
    it.left = want - got;
    return it;
  }

  // Pose verdict: solved or not, with the list of unmet constraints in plain French.
  function evaluatePose(grid, state, ev) {
    var unmet = [], seen = {};
    function add(m) { if (!seen[m]) { seen[m] = true; unmet.push(m); } }
    ev.errors.forEach(add);
    if (ev.missing > 0) add('Il reste ' + plural(ev.missing, 'case') + ' à paver.');
    var inventory = poseInventory(grid, state);
    inventory.forEach(function (it) { if (it.unmet) add(it.unmet); });
    var clues = allClues(grid).map(function (cl) {
      var ok = clueStatus(grid, state, ev, cl);
      var text = clueText(grid, cl);
      if (!ok) add('Indice non respecté : ' + text);
      return { clue: cl, text: text, ok: ok };
    });
    return { success: unmet.length === 0, unmet: unmet, inventory: inventory, clues: clues };
  }

  function isSolved(grid, state) {
    return evaluate(grid, state).pose.success;
  }

  return {
    PIECE_NAMES: PIECE_NAMES,
    isPose: isPose,
    allClues: allClues,
    clueText: clueText,
    clueStatus: clueStatus,
    poseInventory: poseInventory,
    evaluatePose: evaluatePose,
    isSolved: isSolved,
    neighbors: neighbors,
    neighborById: neighborById,
    constraints: constraints,
    isImport: isImport,
    pieceDef: pieceDef,
    pieceLabel: pieceLabel,
    pieceName: pieceName,
    piecePrice: piecePrice,
    newState: newState,
    cloneState: cloneState,
    solutionState: solutionState,
    heights: heights,
    totalExport: totalExport,
    lenText: lenText,
    checkBar: checkBar,
    tryAddBar: tryAddBar,
    barIndexAt: barIndexAt,
    removeBarAt: removeBarAt,
    maxExport: maxExport,
    exportsUsed: exportsUsed,
    setExport: setExport,
    tryAddStep: tryAddStep,
    removeStep: removeStep,
    importsInColumn: importsInColumn,
    swapCount: swapCount,
    referenceSwaps: referenceSwaps,
    evaluate: evaluate
  };
});
