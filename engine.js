/* Geometry and rules are shared by the browser game and its verification suite. */
(function (root, factory) {
  const api = factory(typeof module === 'object' && module.exports ? require('./jade-model.js') : root.JadeArtwork);
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.JadeEngine = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function makeEngine(A) {
  'use strict';
  const SIZE = 600, RES = A.resolution, STEP = SIZE / RES;
  const color = A.color || ['#eee0bb', '#ceb58d', '#97714e'];
  const LEVELS = [
    { name: '初见玉形', subtitle: '循线入门，四角见形', budgets: [6, 5, 5], tolerance: 0.013, precision: 12, hints: true, color, mineral: '原图玉器', goal: 0.96 },
    { name: '双孔生韵', subtitle: '大孔小孔，各留其形', budgets: [5, 4, 4], tolerance: 0.009, precision: 10, hints: true, color, mineral: '原图玉器', goal: 0.97 },
    { name: '琢出神采', subtitle: '循原图纹路，细处见工', budgets: [4, 3, 3], tolerance: 0.006, precision: 8, hints: true, color, mineral: '原图玉器', goal: 0.98 },
    { name: '惜玉如金', subtitle: '惜每一刀，取舍有度', budgets: [4, 3, 3], tolerance: 0.004, precision: 7, hints: true, color, mineral: '原图玉器', goal: 0.985 },
    { name: '玉中藏龙', subtitle: '隐去刀线，凭心成器', budgets: [4, 3, 3], tolerance: 0.002, precision: 6, hints: false, color, mineral: '原图玉器', goal: 0.99 }
  ];
  LEVELS.forEach(level => { level.budgets[1] = Math.max(level.budgets[1], A.openings.length); level.budgets[2] = Math.max(level.budgets[2], A.details.length); level.mineral = A.material || level.mineral; });
  const GUIDES = A.guides;
  const HOLE = A.openings[0] ? { ...A.openings[0].center, r: A.openings[0].r } : null;
  const SIDE_HOLE = A.openings[1] ? { ...A.openings[1].center, r: A.openings[1].r } : null;
  const NOTCH = A.openings[2]?.path || [];
  const NOTCH_GUIDE = NOTCH;
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const distance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
  const cross = (a, b, p) => (b.x - a.x) * (p.y - a.y) - (b.y - a.y) * (p.x - a.x);
  const area = points => Math.abs(points.reduce((sum, p, i) => { const q = points[(i + 1) % points.length]; return sum + p.x * q.y - q.x * p.y; }, 0)) / 2;
  function inside(p, points) {
    let result = false;
    for (let i = 0, j = points.length - 1; i < points.length; j = i++) {
      const a = points[i], b = points[j];
      if ((a.y > p.y) !== (b.y > p.y) && p.x < (b.x - a.x) * (p.y - a.y) / (b.y - a.y) + a.x) result = !result;
    }
    return result;
  }
  const OUTLINE = A.outline;
  const circle = (x, y, r, count = 72) => Array.from({ length: count + 1 }, (_, i) => ({ x: x + Math.cos(i / count * Math.PI * 2) * r, y: y + Math.sin(i / count * Math.PI * 2) * r }));
  const DETAILS = A.details;
  function segmentDistance(p, a, b) {
    const dx = b.x - a.x, dy = b.y - a.y;
    const t = clamp(((p.x - a.x) * dx + (p.y - a.y) * dy) / (dx * dx + dy * dy || 1), 0, 1);
    return distance(p, { x: a.x + t * dx, y: a.y + t * dy });
  }
  function pathDistance(p, points) {
    let min = Infinity;
    for (let i = 1; i < points.length; i++) min = Math.min(min, segmentDistance(p, points[i - 1], points[i]));
    return min;
  }
  function resample(points, spacing = 5) {
    if (points.length < 2) return points.slice();
    const result = [points[0]];
    for (let i = 1; i < points.length; i++) {
      const a = points[i - 1], b = points[i], n = Math.max(1, Math.ceil(distance(a, b) / spacing));
      for (let k = 1; k <= n; k++) result.push({ x: a.x + (b.x - a.x) * k / n, y: a.y + (b.y - a.y) * k / n });
    }
    return result;
  }
  const position = i => ({ x: (i % RES + 0.5) * STEP, y: (Math.floor(i / RES) + 0.5) * STEP });
  const pixel = p => Math.floor(p.y / STEP) * RES + Math.floor(p.x / STEP);
  function maskFrom(fn) {
    const mask = new Uint8Array(RES * RES);
    for (let i = 0; i < mask.length; i++) mask[i] = fn(position(i)) ? 1 : 0;
    return mask;
  }
  const count = mask => mask.reduce((a, b) => a + (b ? 1 : 0), 0);
  function decodeMask(runs) {
    const mask = new Uint8Array(RES * RES);
    for (let i = 0; i < runs.length; i += 2) mask.fill(1, runs[i], runs[i] + runs[i + 1]);
    return mask;
  }
  const OPENINGS = A.openings.map(opening => ({ ...opening, mask: decodeMask(opening.runs) }));
  const BLANK = maskFrom(p => p.x >= A.blank.left && p.x <= A.blank.right && p.y >= A.blank.top && p.y <= A.blank.bottom);
  const OUTER = decodeMask(A.outerRuns), FINAL = decodeMask(A.finalRuns);
  const empty = () => new Uint8Array(RES * RES);
  const CORE = OPENINGS[0]?.mask || empty(), SIDE_CORE = OPENINGS[1]?.mask || empty(), GAP = OPENINGS[2]?.mask || empty();
  const COARSE = maskFrom(p => BLANK[pixel(p)] && GUIDES.every(([a, b]) => cross(a, b, p) * cross(a, b, { x: 270, y: 275 }) >= 0));
  const WASTE = BLANK.map((v, i) => v && !COARSE[i] ? 1 : 0);
  const WASTE_COUNT = count(WASTE), OUTER_COUNT = count(OUTER);
  function createGame(levelIndex = 0) {
    if (!Number.isInteger(levelIndex) || !LEVELS[levelIndex]) throw new Error('Unknown level');
    const level = LEVELS[levelIndex];
    const state = { levelIndex, stage: 0, substage: 0, mask: BLANK.slice(), cuts: [0, 0, 0], details: [], polish: new Set(), totalCuts: 0, assist: 0, status: 'playing', failedPath: [], reason: '', version: 0 };
    const emit = result => ({ ...result, stage: state.stage, substage: state.substage, status: state.status });
    function remaining() { return state.stage >= 3 ? Infinity : level.budgets[state.stage] - state.cuts[state.stage]; }
    function progress() {
      if (state.stage === 0) { let left = 0; for (let i = 0; i < WASTE.length; i++) if (WASTE[i] && state.mask[i]) left++; return 1 - left / WASTE_COUNT; }
      if (state.stage === 1) {
        const target = OPENINGS[state.substage].mask, total = count(target);
        let left = 0; for (let i = 0; i < target.length; i++) if (target[i] && state.mask[i]) left++;
        return 1 - left / total;
      }
      if (state.stage === 2) return state.details.length / DETAILS.length;
      return Math.min(1, state.polish.size / polishPoints.length);
    }
    function fail(reason, path) {
      state.status = 'failed'; state.reason = reason; state.failedPath = path.slice();
      return emit({ kind: 'failed', reason });
    }
    function damage(removed, protectedMask) {
      let n = 0; for (const i of removed) if (protectedMask[i]) n++;
      return n;
    }
    function checkBudget(path) {
      if (state.stage < 3 && remaining() <= 0) return fail('刀数已用尽，余料还未去净。再想一想每一刀的位置。', path);
      return null;
    }
    function remove(removed, path) {
      for (const i of removed) state.mask[i] = 0;
      state.cuts[state.stage]++; state.totalCuts++; state.version++;
      let advanced = false;
      if (state.stage === 0 && progress() >= level.goal) {
        state.mask = OUTER.slice(); state.stage = OPENINGS.length ? 1 : DETAILS.length ? 2 : 3; advanced = true;
      } else if (state.stage === 1 && progress() >= 0.83) {
        const target = OPENINGS[state.substage].mask;
        for (let i = 0; i < target.length; i++) if (target[i]) state.mask[i] = 0;
        if (state.substage < OPENINGS.length - 1) state.substage++;
        else { state.mask = FINAL.slice(); state.stage = DETAILS.length ? 2 : 3; state.substage = 0; }
        advanced = true;
      }
      if (!advanced) { const exhausted = checkBudget(path); if (exhausted) return { ...exhausted, removed }; }
      return emit({ kind: advanced ? 'advance' : 'cut', removed, progress: progress() });
    }
    function linePlan(path) {
      const a = path[0], b = path[path.length - 1];
      if (distance(a, b) < 45) return { kind: 'invalid', reason: '刀线太短。请划过玉料边角，再松手落刀。' };
      let positive = 0, negative = 0;
      for (let i = 0; i < OUTER.length; i++) if (OUTER[i] && state.mask[i]) { if (cross(a, b, position(i)) >= 0) positive++; else negative++; }
      const sign = positive >= negative ? 1 : -1, removed = [];
      for (let i = 0; i < state.mask.length; i++) if (state.mask[i] && cross(a, b, position(i)) * sign < 0) removed.push(i);
      return { kind: 'plan', removed, damage: damage(removed, OUTER), limit: Math.max(10, OUTER_COUNT * level.tolerance) };
    }
    function regionPlan(path) {
      const opening = OPENINGS[state.substage], target = opening.mask;
      const minArea = Math.max(8, count(target) * STEP * STEP * 0.12);
      if (path.length < 3 || area(path) < minArea) return { kind: 'invalid', reason: opening.closed ? '请沿孔洞画出一个闭合圈。' : '请绕过嘴部余料，从左侧边缘划入，再回到边缘。' };
      if (opening.closed && distance(path[0], path[path.length - 1]) > Math.max(6, opening.r * .65)) return { kind: 'invalid', reason: '还差一点闭合。把刀线画回起点，玉芯才会脱落。' };
      const nearMaterial = p => { const i = pixel(p); return p.x >= 0 && p.x < SIZE && p.y >= 0 && p.y < SIZE && !!state.mask[i]; };
      if (!opening.closed && (nearMaterial(path[0]) || nearMaterial(path[path.length - 1]))) return { kind: 'invalid', reason: '缺口需要贯通边缘。请从玉料左侧外部开始，回到外部收刀。' };
      const removed = [];
      for (let i = 0; i < state.mask.length; i++) if (state.mask[i] && inside(position(i), path)) removed.push(i);
      const protectedMask = OUTER.map((v, i) => v && !target[i] ? 1 : 0);
      return { kind: 'plan', removed, damage: damage(removed, protectedMask), limit: Math.max(3, count(target) * (0.035 + level.tolerance * 8)) };
    }
    function detailPlan(path) {
      if (path.length < 2 || resample(path).length < 4) return { kind: 'invalid', reason: '沿墨绿色纹样描一笔，留下眼纹、吻线或卷纹。' };
      const sampled = resample(path), candidates = DETAILS.map((detail, index) => {
        if (state.details.includes(index)) return null;
        const trace = resample(detail.points, 3), coverage = trace.filter(p => pathDistance(p, path) <= level.precision * 0.72).length / trace.length;
        const error = sampled.reduce((s, p) => s + pathDistance(p, detail.points), 0) / sampled.length;
        return { index, coverage, error };
      }).filter(Boolean).sort((a, b) => a.error - b.error);
      const best = candidates[0];
      if (!best) return { kind: 'invalid', reason: '纹样已经完成。' };
      if (best.error > level.precision) return { kind: 'danger', reason: '这一笔偏离纹样，划伤了玉面。', detail: best };
      if (best.coverage < 0.62) return { kind: 'invalid', reason: '这条纹样还没有描完整。请一笔描过整条墨绿色引线。' };
      return { kind: 'detail', index: best.index, damage: 0 };
    }
    function plan(path) {
      if (!path.length) return { kind: 'invalid', reason: '先在玉料上画出一条刀线。' };
      return state.stage === 0 ? linePlan(path) : state.stage === 1 ? regionPlan(path) : state.stage === 2 ? detailPlan(path) : { kind: 'polish' };
    }
    function preview(path) {
      const result = plan(path);
      return { ...result, safe: result.kind !== 'danger' && !(result.damage > result.limit) };
    }
    function stroke(path, options = {}) {
      if (state.status !== 'playing' || state.stage === 3) return emit({ kind: 'ignored' });
      const result = plan(path);
      if (result.kind === 'invalid') return emit(result);
      if (result.kind === 'danger' || result.damage > result.limit) return fail(result.reason || '这一刀切入了需要保留的主体。玉料开裂，请重新开料。', path);
      if (options.assisted) state.assist++;
      if (state.stage === 2) {
        state.details.push(result.index); state.cuts[2]++; state.totalCuts++; state.version++;
        if (state.details.length === DETAILS.length) { state.stage = 3; return emit({ kind: 'advance', removed: [] }); }
        const exhausted = checkBudget(path); if (exhausted) return exhausted;
        return emit({ kind: 'detail', index: result.index, removed: [] });
      }
      if (result.removed.length < (state.stage === 1 ? 2 : 14)) return emit({ kind: 'invalid', reason: '这一刀没有切到余料，不消耗刀数。试着把刀线向内移一点。' });
      return remove(result.removed, path);
    }
    const polishPoints = [];
    for (let y = A.bounds.top + 7; y < A.bounds.bottom; y += 16) for (let x = A.bounds.left + 7; x < A.bounds.right; x += 16) if (FINAL[pixel({ x, y })]) polishPoints.push({ x, y });
    function polish(path, options = {}) {
      if (state.status !== 'playing' || state.stage !== 3 || path.length < 1) return emit({ kind: 'ignored' });
      if (options.assisted) state.assist++;
      for (let i = 0; i < polishPoints.length; i++) if (path.length === 1 ? distance(polishPoints[i], path[0]) < 38 : pathDistance(polishPoints[i], path) < 38) state.polish.add(i);
      if (progress() >= 0.92) { state.status = 'complete'; return emit({ kind: 'complete', progress: 1 }); }
      return emit({ kind: 'polish', progress: progress() });
    }
    function guide() {
      if (state.stage === 0) {
        let best = null, amount = 0;
        for (const line of GUIDES) { const result = linePlan(line); if (result.removed?.length > amount && result.damage <= result.limit) { amount = result.removed.length; best = line; } }
        return best || GUIDES[0];
      }
      if (state.stage === 1) return OPENINGS[state.substage].path;
      if (state.stage === 2) return DETAILS.find((_, i) => !state.details.includes(i)).points;
      return polishPoints;
    }
    return { state, level, stroke, preview, polish, guide, progress, remaining, polishPoints };
  }
  return { withArtwork: makeEngine, ARTWORK: A, SIZE, RES, STEP, LEVELS, GUIDES, HOLE, SIDE_HOLE, NOTCH, NOTCH_GUIDE, OUTLINE, DETAILS, OPENINGS, BLANK, OUTER, CORE, SIDE_CORE, GAP, FINAL, COARSE, WASTE, createGame, inside, area, distance, pathDistance, resample, position, count, circle };
});
