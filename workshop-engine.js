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
      grind: new Set(), shine: new Set(), sliced: false, cuts: [],
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
    /* 板框的四条边必须落在料上。设计数据里的 blank 比料本身还高（上边高 6、下边低 2），
       所以先夹到物料范围里；夹完还要保证板仍包住器物外形（bounds），否则取出的板放不下器形。
       物料范围优先用原石的 alpha 轮廓（game.js 量好写进 model.material），
       拿不到时退回「可磨点」的外接框。 */
    const pointBox = (() => {
      const pts = A.raw && A.raw.points;
      if (!pts || !pts.length) return null;
      let l = 1e9, t = 1e9, r = -1e9, b = -1e9;
      for (const p of pts) { if (p.x < l) l = p.x; if (p.x > r) r = p.x; if (p.y < t) t = p.y; if (p.y > b) b = p.y; }
      return { left: l, top: t, right: r, bottom: b };
    })();
    function plateBounds() {
      const b = E.ARTWORK.blank, o = E.ARTWORK.bounds;
      const m = (A.raw && A.raw.material) || pointBox;   // 注意：model.material 是材料名，不是坐标框
      if (!m) return { ...b };
      return {
        left: Math.min(Math.max(b.left, m.left), o.left),
        top: Math.min(Math.max(b.top, m.top), o.top),
        right: Math.max(Math.min(b.right, m.right), o.right),
        bottom: Math.max(Math.min(b.bottom, m.bottom), o.bottom)
      };
    }
    function boardRect() {
      const dx = (state.dimensions.width - plateBase.width) * 3.65 / 2;
      const dy = (state.dimensions.length - plateBase.length) * 3.65 / 2;
      const p = plateBounds();
      return { left: p.left - dx, right: p.right + dx, top: p.top - dy, bottom: p.bottom + dy };
    }
    function setDimensions(values) {
      if (state.phase !== 1 || !state.sliced || state.status !== 'playing' || pending) return false;
      const dims = { ...state.dimensions, ...values };
      if (!Number.isFinite(dims.length) || !Number.isFinite(dims.width) || !Number.isFinite(dims.thickness)) return false;
      dims.length = Math.max(plateBase.length, Math.min(plateBase.length + 18, dims.length));
      dims.width = Math.max(plateBase.width, Math.min(plateBase.width + 14, dims.width));
      dims.thickness = Math.max(8, Math.min(20, dims.thickness));
      if (JSON.stringify(dims) === JSON.stringify(state.dimensions)) return false;
      begin(); state.dimensions = dims; changed(); commit(); return true;
    }
    /* 玉板是一个长方形，取下它要四条边各切一刀。四条边的坐标就是 boardRect()，
       顺序随意，但引导线和示范都按「上 → 右 → 下 → 左」推进。 */
    function plateEdges() {
      const b = boardRect();
      return [
        { i: 0, name: '上边', a: { x: b.left, y: b.top }, b: { x: b.right, y: b.top }, cut: state.cuts.includes(0) },
        { i: 1, name: '右边', a: { x: b.right, y: b.top }, b: { x: b.right, y: b.bottom }, cut: state.cuts.includes(1) },
        { i: 2, name: '下边', a: { x: b.right, y: b.bottom }, b: { x: b.left, y: b.bottom }, cut: state.cuts.includes(2) },
        { i: 3, name: '左边', a: { x: b.left, y: b.bottom }, b: { x: b.left, y: b.top }, cut: state.cuts.includes(3) }
      ];
    }
    function nextEdge() {
      return plateEdges().find(e => !e.cut) || plateEdges()[0];
    }
    /* 判定这一笔落在哪条边：贴线（垂直距离）够近，且沿边划过了足够长度。
       允许反向划、允许略有弧度，但一笔只算一条边。 */
    function classifyCut(path) {
      if (!path || path.length < 2) return null;
      let best = null;
      for (const e of plateEdges()) {
        if (e.cut) continue;
        const dx = e.b.x - e.a.x, dy = e.b.y - e.a.y, len2 = dx * dx + dy * dy || 1;
        let minT = Infinity, maxT = -Infinity, maxD = 0;
        for (const p of path) {
          const t = ((p.x - e.a.x) * dx + (p.y - e.a.y) * dy) / len2;
          minT = Math.min(minT, t); maxT = Math.max(maxT, t);
          const px = e.a.x + dx * t, py = e.a.y + dy * t;
          maxD = Math.max(maxD, Math.hypot(p.x - px, p.y - py));
        }
        const span = Math.min(1, maxT) - Math.max(0, minT);
        if (maxD <= 30 && span >= 0.6) {
          const score = span - maxD / 500;
          if (!best || score > best.score) best = { edge: e, score };
        }
      }
      return best ? best.edge : null;
    }
    function confirmPlate() {
      if (state.phase !== 1 || !state.sliced || state.status !== 'playing') return { kind: 'invalid', reason: '四条边都切完，才能取出玉板。' };
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
      if (state.phase === 1) return state.sliced ? 1 : state.cuts.length / 4;
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
        if (state.sliced) return { kind: 'invalid', reason: '玉板已经取好。调整尺寸后，点击“取出玉板”。' };
        const edge = classifyCut(path);
        if (!edge) return { kind: 'invalid', reason: '贴着虚线，从一端划到另一端；四条边各切一刀。' };
        begin(); state.cuts.push(edge.i);
        const done = state.cuts.length >= 4;
        if (done) state.sliced = true;
        pending.assisted = !!options.assisted; changed(); commit();
        return done ? { kind: 'sliced', edge: edge.i, cuts: state.cuts.length }
          : { kind: 'cut', edge: edge.i, cuts: state.cuts.length, name: edge.name };
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
      if (state.phase === 1) { const e = nextEdge(); return [e.a, e.b]; }
      if (state.phase === 2) return OUTLINE;
      if (state.phase === 4) return SKETCHES[state.sketchIndex].points;
      if (state.phase >= 6) { const b = E.ARTWORK.bounds; return scan({ left: b.left - 8, right: b.right + 8, top: b.top - 8, bottom: b.bottom + 8 }); }
      return cutter.guide();
    }
    function preview(path) {
      return [3, 5].includes(state.phase) ? cutter.preview(path) : { safe: true };
    }
    return { state, cutter, level: cutter.level, begin, paint, end, cancel, stroke, undo, setDimensions, confirmPlate,
      boardRect, plateEdges, nextEdge, guide, preview, progress, plateBase, historySize: () => history.length,
      outlinePoints: OUTLINE_POINTS, sketchPoints: SKETCH_POINTS, brushPoints: cutter.polishPoints };
  }
  return { withArtwork: makeWorkshop, PHASES, OUTLINE, SKETCHES, createWorkshop };
});
