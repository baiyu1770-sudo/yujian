/* The complete workshop flow. Geometry remains shared with engine.js. */
(function (root, factory) {
  const node = typeof module === 'object' && module.exports;
  const api = factory(node ? require('./engine.js') : root.JadeEngine, node ? require('./stage-assets.js') : root.JadeStages);
  if (node) module.exports = api; else root.JadeWorkshop = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function makeWorkshop(E, A) {
  'use strict';
  const PHASES = ['磨去石皮', '切片取板', '描绘外形', '粗切成胚', '描画细节', '雕琢纹样', '细磨修整', '抛光成器'];
  const OUTLINE = E.OUTLINE.concat([E.OUTLINE[0]]);
  const SKETCHES = E.OPENINGS.map(o => ({ name: o.name, points: o.path })).concat(E.DETAILS);
  const OUTLINE_POINTS = E.resample(OUTLINE, 6);
  const SKETCH_POINTS = SKETCHES.map(d => E.resample(d.points, 3));
  const clone = value => {
    if (value instanceof Uint8Array) return value.slice();
    if (value instanceof Set) return new Set(value);
    if (Array.isArray(value)) return value.map(clone);
    if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, clone(v)]));
    return value;
  };
  const fraction = (set, points) => set.size / points.length;
  function mark(set, points, path, radius) {
    if (!path.length) return;
    points.forEach((p, i) => {
      if (path.length === 1 ? E.distance(p, path[0]) <= radius : E.pathDistance(p, path) <= radius) set.add(i);
    });
  }
  function scan(bounds, spacing = 30) {
    const result = [];
    let forward = true;
    for (let y = bounds.top; y <= bounds.bottom; y += spacing) {
      result.push({ x: forward ? bounds.left : bounds.right, y }, { x: forward ? bounds.right : bounds.left, y });
      forward = !forward;
    }
    return result;
  }
  function createWorkshop(levelIndex = 0) {
    const cutter = E.createGame(levelIndex);
    const plateBase = E.ARTWORK.plateDimensions || { length: 120, width: 90 };
    const state = {
      phase: 0, levelIndex, status: 'playing', raw: new Set(), outline: new Set(),
      sketches: SKETCHES.map(() => new Set()), sketchIndex: 0,
      grind: new Set(), shine: new Set(), sliced: false,
      dimensions: { ...plateBase, thickness: 12 },
      reason: '', failedPath: [], assist: 0, version: 0
    };
    const history = [];
    let pending = null, revision = 0;
    const snapshot = () => ({ state: clone(state), cutter: clone(cutter.state) });
    function restore(saved) {
      Object.assign(state, clone(saved.state)); Object.assign(cutter.state, clone(saved.cutter));
      state.version = ++revision;
    }
    function begin() { if (!pending && state.status === 'playing') pending = { saved: snapshot(), changed: false, assisted: false }; }
    function changed() { if (pending) pending.changed = true; state.version = ++revision; }
    function commit() {
      if (pending?.changed) {
        history.push(pending.saved);
        if (history.length > 80) history.shift();
        if (pending.assisted) state.assist++;
      }
      pending = null;
    }
    function undo() {
      if (pending) { restore(pending.saved); pending = null; }
      const saved = history.pop();
      if (!saved) return false;
      restore(saved); return true;
    }
    function cancel() { if (pending) restore(pending.saved); pending = null; }
    function boardRect() {
      const dx = (state.dimensions.width - plateBase.width) * 3.65 / 2;
      const dy = (state.dimensions.length - plateBase.length) * 3.65 / 2;
      const b = E.ARTWORK.blank;
      return { left: b.left - dx, right: b.right + dx, top: b.top - dy, bottom: b.bottom + dy };
    }
    function setDimensions(values) {
      if (state.phase !== 1 || state.status !== 'playing' || pending) return false;
      const dims = { ...state.dimensions, ...values };
      if (!Number.isFinite(dims.length) || !Number.isFinite(dims.width) || !Number.isFinite(dims.thickness)) return false;
      dims.length = Math.max(plateBase.length, Math.min(plateBase.length + 18, dims.length));
      dims.width = Math.max(plateBase.width, Math.min(plateBase.width + 14, dims.width));
      dims.thickness = Math.max(8, Math.min(20, dims.thickness));
      if (JSON.stringify(dims) === JSON.stringify(state.dimensions)) return false;
      begin(); state.dimensions = dims; changed(); commit(); return true;
    }
    function confirmPlate() {
      if (state.phase !== 1 || !state.sliced || state.status !== 'playing') return { kind: 'invalid', reason: '先沿横线切下一片玉料。' };
      begin();
      const b = boardRect();
      cutter.state.mask = E.BLANK.map((_, i) => {
        const p = E.position(i); return p.x >= b.left && p.x <= b.right && p.y >= b.top && p.y <= b.bottom ? 1 : 0;
      });
      state.phase = 2; changed(); commit(); return { kind: 'advance' };
    }
    function progress() {
      if (state.status === 'complete') return 1;
      if (state.phase === 0) return fraction(state.raw, A.raw.points);
      if (state.phase === 1) return state.sliced ? 1 : 0;
      if (state.phase === 2) return fraction(state.outline, OUTLINE_POINTS);
      if (state.phase === 3) return cutter.progress();
      if (state.phase === 4) return state.sketches.reduce((s, set, i) => s + fraction(set, SKETCH_POINTS[i]), 0) / SKETCHES.length;
      if (state.phase === 5) return (cutter.state.stage === 1 ? cutter.state.substage : E.OPENINGS.length + cutter.state.details.length) / Math.max(1, SKETCHES.length);
      return fraction(state.phase === 6 ? state.grind : state.shine, cutter.polishPoints);
    }
    function paint(path) {
      if (state.status !== 'playing' || ![0, 2, 4, 6, 7].includes(state.phase)) return { kind: 'ignored' };
      begin(); let set, points, radius;
      if (state.phase === 0) { set = state.raw; points = A.raw.points; radius = 37; }
      if (state.phase === 2) { set = state.outline; points = OUTLINE_POINTS; radius = 10; }
      if (state.phase === 4) { set = state.sketches[state.sketchIndex]; points = SKETCH_POINTS[state.sketchIndex]; radius = 5; }
      if (state.phase >= 6) { set = state.phase === 6 ? state.grind : state.shine; points = cutter.polishPoints; radius = 34; }
      const before = set.size;
      mark(set, points, path, radius);
      if (set.size !== before) changed();
      return { kind: set.size !== before ? 'paint' : 'ignored', progress: progress() };
    }
    function end(options = {}) {
      if (!pending) return { kind: 'ignored' };
      if (!pending.changed) { pending = null; return { kind: 'invalid', reason: [2, 4].includes(state.phase) ? '沿虚线描画，可以分几笔慢慢完成。' : '擦过玉料表面才会推进进度。' }; }
      pending.assisted = !!options.assisted;
      let result = { kind: 'paint' };
      if (state.phase === 0 && progress() >= .97) { state.phase = 1; result.kind = 'advance'; }
      else if (state.phase === 2 && progress() >= .94) { state.phase = 3; result.kind = 'advance'; }
      else if (state.phase === 4 && fraction(state.sketches[state.sketchIndex], SKETCH_POINTS[state.sketchIndex]) >= .94) {
        if (state.sketchIndex < SKETCHES.length - 1) state.sketchIndex++;
        else state.phase = 5;
        result.kind = 'advance';
      } else if (state.phase === 6 && progress() >= .96) { state.phase = 7; result.kind = 'advance'; }
      else if (state.phase === 7 && progress() >= .96) { state.status = 'complete'; result.kind = 'complete'; }
      changed(); commit(); return result;
    }
    function stroke(path, options = {}) {
      if (state.status !== 'playing') return { kind: 'ignored' };
      if ([0, 2, 4, 6, 7].includes(state.phase)) { begin(); paint(path); return end(options); }
      if (state.phase === 1) {
        if (state.sliced) return { kind: 'invalid', reason: '玉板已切出。调整尺寸后，点击“取出玉板”。' };
        const a = path[0], b = path[path.length - 1];
        if (!a || !b || Math.abs(a.x - b.x) < 285 || Math.abs(a.y - 350) > 20 || Math.abs(b.y - 350) > 20)
          return { kind: 'invalid', reason: '沿横向切片线，从一侧划到另一侧。' };
        begin(); state.sliced = true; pending.assisted = !!options.assisted; changed(); commit(); return { kind: 'sliced' };
      }
      begin(); const before = cutter.state.version;
      const result = cutter.stroke(path);
      if (result.kind === 'invalid' || result.kind === 'ignored') { pending = null; return result; }
      if (result.kind === 'failed') {
        state.status = 'failed'; state.reason = result.reason; state.failedPath = path.slice();
      } else if (state.phase === 3 && cutter.state.stage > 0) state.phase = 4;
      else if (state.phase === 5 && cutter.state.stage === 3) state.phase = 6;
      if (cutter.state.version !== before || result.kind === 'failed') changed();
      pending.assisted = !!options.assisted; commit(); return result;
    }
    function guide() {
      if (state.phase === 0) return scan({ left: 55, right: 485, top: 65, bottom: 490 });
      if (state.phase === 1) return [{ x: 80, y: 350 }, { x: 460, y: 350 }];
      if (state.phase === 2) return OUTLINE;
      if (state.phase === 4) return SKETCHES[state.sketchIndex].points;
      if (state.phase >= 6) { const b = E.ARTWORK.bounds; return scan({ left: b.left - 8, right: b.right + 8, top: b.top - 8, bottom: b.bottom + 8 }); }
      return cutter.guide();
    }
    function preview(path) {
      return [3, 5].includes(state.phase) ? cutter.preview(path) : { safe: true };
    }
    return { state, cutter, level: cutter.level, begin, paint, end, cancel, stroke, undo, setDimensions, confirmPlate,
      boardRect, guide, preview, progress, plateBase, historySize: () => history.length,
      outlinePoints: OUTLINE_POINTS, sketchPoints: SKETCH_POINTS, brushPoints: cutter.polishPoints };
  }
  return { withArtwork: makeWorkshop, PHASES, OUTLINE, SKETCHES, createWorkshop };
});
