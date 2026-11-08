(function () {
  'use strict';
  const BaseE = window.JadeEngine, BaseW = window.JadeWorkshop, A = window.JadeStages;
  /* 石料按设计稿放大：板框尺寸由器形决定、不能改，而设计稿要求四条切线都落在石体内部，
     所以反过来把石体放大到板框外面（等比、以板框中心为心），磨点同步换算。 */
  (function fitStone() {
    const raw = A.raw, K = 1.33, cx = 270, cy = 275;
    if (!raw || raw.__fit) return;
    const sx = v => cx + (v - cx) * K, sy = v => cy + (v - cy) * K;
    raw.draw = { x: sx(raw.draw.x), y: sy(raw.draw.y), width: raw.draw.width * K, height: raw.draw.height * K };
    if (raw.material) raw.material = { left: sx(raw.material.left), top: sy(raw.material.top), right: sx(raw.material.right), bottom: sy(raw.material.bottom) };
    raw.points = raw.points.map(p => ({ x: sx(p.x), y: sy(p.y) })).filter(p => p.x > 0 && p.y > 0 && p.x < 600 && p.y < 600);
    raw.__fit = K;
  })();
  let E = BaseE, W = BaseW;
  const catalogue = [{ id: 'dragon', name: '玉猪龙', material: '米白褐斑玉质', model: window.JadeArtwork, procedural: false }, ...(window.JadeCatalogue || [])];
  let active = catalogue[0];
  const $ = id => document.getElementById(id);
  const canvas = $('jade-canvas'), ctx = canvas.getContext('2d');
  const STORE = 'yujian-workshop-eight-stages-v3';
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const numerals = ['壹', '贰', '叁', '肆', '伍'];
  const words = ['一', '二', '三', '四', '五', '六', '七', '八'];
  const specs = [
    { label: '磨皮 / REVEAL', title: '先见玉质，再想玉形', text: '按住来回拖动，磨掉整块原石的石皮。擦过的地方会露出米白褐斑的玉质，不用开窗或打光。', message: '来回磨去石皮，让玉质慢慢露出来', progress: '石皮磨除', gesture: '按住擦拭 / 松手完成这一笔', tool: '磨皮石', icon: 'spark', assist: '示范磨皮', art: 'raw' },
    { label: '切板 / SLICE', title: '四边各一刀，板才落得下来', text: '沿虚线把这块不规整的料切成长方形：上、右、下、左四条边各切一刀，顺序随意。四刀切完，玉板就分离出来，再调长宽厚。', message: '沿虚线四条边各切一刀', progress: '四边切割', gesture: '从红点按住 / 划到另一端', tool: '切片锯', icon: 'cut', assist: '示范这一刀', art: 'slab' },
    { label: '描形 / OUTLINE', title: '先描外形，不急着下刀', text: '沿淡色虚线描出器物的大轮廓。可以分几笔完成；这一道只落墨，不开孔、不雕眼纹。', message: '沿虚线描轮廓，可以分几笔慢慢完成', progress: '外轮廓描绘', gesture: '沿线描绘 / 可以分笔', tool: '描形笔', icon: 'line', assist: '示范描形', art: 'draft' },
    { label: '粗切 / ROUGH CUT', title: '先去余料，留下毛胚', text: '用直线切去四角余料，保住已经描好的轮廓。四角去尽后自动衔接边缘修整，形成没有纹样的粗胚。', message: '松手才落刀，注意保留轮廓内的玉料', progress: '四角余料去除', gesture: '划线看预览 / 松手落刀', tool: '切玉刀', icon: 'cut', assist: '示范一刀', art: 'rough' },
    { label: '画细节 / DRAW DETAILS', title: '孔位与纹样，先画清楚', text: '依次描出大孔、小孔、嘴部、眼纹、吻线和卷纹。细处会自动放大；现在只描墨线，玉料还没有被切开。', message: '先画细节，画完才开始雕琢', progress: '细节草线完成', gesture: '沿线描绘 / 可以分笔', tool: '细描笔', icon: 'line', assist: '示范这一笔', art: 'rough' },
    { label: '雕琢 / CARVE', title: '循着墨线，慢慢琢出神采', text: '先透开中央大孔、侧面小孔和嘴部，再沿墨线琢眼纹、吻线与卷纹。每一刀都保留周围的主体。', message: '沿已经画好的墨线下刀', progress: '开孔与琢纹', gesture: '沿线下刀 / 松手完成', tool: '雕琢刀', icon: 'ring', assist: '示范一刀', art: 'half' },
    { label: '细磨 / REFINE', title: '磨平刀痕，修整粗糙面', text: '按住来回擦过整块器物，修整粗糙的玉面与刀痕。半雕的毛糙感会在擦过的位置逐渐褪去。', message: '细磨整个玉面，边缘也要照顾到', progress: '细磨覆盖', gesture: '来回细磨 / 擦过整个玉面', tool: '细磨石', icon: 'spark', assist: '示范细磨', art: 'half' },
    { label: '抛光 / POLISH', title: '拂去浮尘，见温润玉色', text: '最后来回拂拭玉面，让光泽一点点显现。完成后呈现你提供的原图成品，并收入本机图鉴。', message: '来回抛光，直到整块玉面温润明亮', progress: '抛光覆盖', gesture: '按住拂拭 / 唤醒玉光', tool: '抛光布', icon: 'spark', assist: '示范抛光', art: 'final' }
  ];
  const images = {};
  let ready = false, loadError = '', game, hints = true, referencePhase = false, workshopVisited = false;
  let dragging = false, captured = null, path = [], hover = null, preview = null, strokePhase = 0;
  let raf = 0, busy = false, demoFrame = 0, demoTimer = 0, demoTickAt = 0, session = 0, toastTimer, flashTimer, resultTimer;
  let surface = null, surfaceKey = '', startedAt = Date.now(), finishedAt = 0, lastPreview = 0;
  let chips = [], audioContext, audioMaster, audioCompressor, noiseBuffer, emitAcc = 0, palette = null;
  const TOUCH = matchMedia('(pointer: coarse)').matches || navigator.maxTouchPoints > 0;
  let guideCache = { key: '', pts: [] };
  let save = { records: {}, sound: true, soundChoice: false, lastLevel: 0 };
  let practiceMode = false, firstCompletion = false, runFlaws = 0;
  try {
    const data = JSON.parse(localStorage.getItem(STORE));
    if (data && typeof data.records === 'object' && data.records) save = { ...save, ...data };
  } catch (_) { /* File and private contexts may deny storage; the game remains playable. */ }
  /* v5.9: 旧存档没有 soundChoice，sound:false 只是旧版本的默认值，不是玩家主动关闭。
     迁移为默认开；玩家真正点过开关后才会写入 soundChoice。 */
  if (!save.soundChoice) save.sound = true;
  const starsText = n => '★'.repeat(Math.max(0, Math.min(3, Number(n) || 0)));
  const recordKey = (id = active.id, index = game?.state.levelIndex || 0) => id === 'dragon' ? String(index) : id + ':' + index;
  function persist() {
    try { localStorage.setItem(STORE, JSON.stringify(save)); } catch (_) { /* Optional local persistence. */ }
    $('collection-count').textContent = String(catalogue.filter(item => E.LEVELS.some((_, i) => save.records[recordKey(item.id, i)])).length).padStart(2, '0');
  }
  function toast(text) {
    clearTimeout(toastTimer); $('toast').textContent = text; $('toast').classList.add('show');
    toastTimer = setTimeout(() => $('toast').classList.remove('show'), 3200);
  }
  /* ————————————— 音频 —————————————
     v5.10 重写。手机（尤其扫码进的微信内置浏览器）听不到声音的几个成因，逐个兜住：
     ① 微信 X5 / WKWebView 的音频会话要等 WeixinJSBridgeReady 或一次 bridge 调用之后才激活。
        在那之前 AudioContext 建得出来、state 也会变 running，但输出被系统吞掉——
        这是「电脑上有声、扫码后无声」的主因；
     ② AudioContext 必须在用户手势里创建；suspended / interrupted 期间 currentTime 不前进，
        这时 playSound 只是把节点排进一条永远不走的时钟，等于静默丢弃，不能丢；
     ③ iOS 来电、切后台后 state 会变成非标准的 'interrupted'，只判 'suspended' 会漏；
     ④ bfcache 回退、切回前台后 ctx 会再次 suspended，没人 resume 就一直哑着。 */
  const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  const inWeChat = /MicroMessenger/i.test(navigator.userAgent);
  const AUDIO_HINT_KEY = 'yujian-audio-hint-v1';
  let audioQueue = [], audioResumePending = 0, soundOffHinted = false, iosHintShown = false;
  try { iosHintShown = localStorage.getItem(AUDIO_HINT_KEY) === '1'; } catch (_) { /* 隐私模式不记忆 */ }

  function ensureAudio() {
    if (audioContext) return audioContext;
    const Ctor = window.AudioContext || window.webkitAudioContext;
    if (!Ctor) return null;
    try { audioContext = new Ctor({ latencyHint: 'interactive' }); }
    catch (_) { try { audioContext = new Ctor(); } catch (_) { return null; } }
    try {
      /* 状态自己变回 running（例如系统解除了音频中断）时，把排队的声音补上 */
      audioContext.addEventListener?.('statechange', () => { if (audioContext.state === 'running') flushAudio(); });
    } catch (_) { /* 老浏览器没有 statechange */ }
    return audioContext;
  }
  /* iOS 只认「在手势里真的播过一帧」。1 采样静音 buffer + 一个增益为 0 的振荡器，
     两者都几乎不出声，但足以让音频会话从 ambient 切到可播放。 */
  function primeAudio() {
    const c = audioContext; if (!c || c.__primed) return;
    try {
      const buffer = c.createBuffer(1, 1, 22050);
      const src = c.createBufferSource(); src.buffer = buffer;
      src.connect(c.destination); src.start(0);
      const osc = c.createOscillator(), gain = c.createGain();
      gain.gain.value = .0001; osc.connect(gain).connect(c.destination);
      osc.start(); osc.stop(c.currentTime + .02);
      c.__primed = true;
    } catch (_) { /* Audio is optional. */ }
  }
  function resumeAudio() {
    const c = ensureAudio(); if (!c) return;
    if (c.state === 'running') { flushAudio(); return; }
    /* 一次手势会同时来 pointerdown / touchstart / click，这里去重，别反复 resume */
    if (audioResumePending) return;
    audioResumePending = 1;
    const done = () => { audioResumePending = 0; if (c.state === 'running') flushAudio(); };
    try {
      const p = c.resume();
      if (p && typeof p.then === 'function') p.then(done, done); else done();
    } catch (_) { audioResumePending = 0; }
  }
  /* resume 之前请求过的音色先入队；恢复后按顺序补播（只补最近三声，避免一次全炸出来）。 */
  function flushAudio() {
    if (!audioQueue.length || !audioContext || audioContext.state !== 'running') return;
    const queue = audioQueue.splice(0, audioQueue.length);
    queue.slice(-3).forEach(type => { try { playSound(type); } catch (_) { /* 补播失败不影响流程 */ } });
  }
  /* 微信内置浏览器：等 bridge 就绪、或主动调一次 bridge，音频会话才会被真正打开。
     注意这里只在 ctx 已经因为用户手势建出来之后才去 prime/resume，
     绝不在页面加载时提前建 ctx —— 老 iOS 上那样建出来的 ctx 会永久 suspended。 */
  let wechatKicked = false;
  function wechatKick() {
    if (!inWeChat || wechatKicked) return;
    const follow = () => { wechatKicked = true; if (audioContext) { primeAudio(); resumeAudio(); } };
    try {
      if (typeof window.WeixinJSBridge === 'undefined') {
        document.addEventListener('WeixinJSBridgeReady', follow, { once: true });
      } else {
        window.WeixinJSBridge.invoke('getNetworkType', {}, follow);
      }
    } catch (_) { /* 非微信环境会直接抛，忽略 */ }
  }
  /* iOS 的侧边静音开关会把 WebAudio 一起静音，代码无法检测；running 说明解锁成功，
     这时给一次提示就够，不要每次弹。 */
  function maybeIOSHint() {
    if (!isIOS || iosHintShown || !audioContext || audioContext.state !== 'running') return;
    iosHintShown = true;
    try { localStorage.setItem(AUDIO_HINT_KEY, '1'); } catch (_) { /* 隐私模式不记忆 */ }
    setTimeout(() => toast('iPhone 若听不见音效：把侧边静音开关拨到「响铃」，并调高音量。'), 900);
  }
  /* 任意位置、任意元素的第一次触摸都算手势；用 capture 抢在业务逻辑之前，防止被 stopPropagation 吃掉。 */
  function unlockAudio() {
    if (!save.sound) return;
    if (!ensureAudio()) return;
    /* Safari 16.4+ 的 audioSession：设成 playback 后 WebAudio 不再被侧边静音开关掐掉。
       这是 iPhone「开关拨到静音就没声」唯一能用代码解决的一半。 */
    try { if (navigator.audioSession) navigator.audioSession.type = 'playback'; } catch (_) { /* 不支持的浏览器忽略 */ }
    primeAudio(); resumeAudio(); wechatKick(); maybeIOSHint();
  }
  function audioChain() {
    if (!audioContext) return null;
    if (!audioMaster) {
      audioCompressor = audioContext.createDynamicsCompressor();
      audioCompressor.threshold.value = -20; audioCompressor.knee.value = 16;
      audioCompressor.ratio.value = 4; audioCompressor.attack.value = .004; audioCompressor.release.value = .25;
      audioMaster = audioContext.createGain(); audioMaster.gain.value = .9;
      audioMaster.connect(audioCompressor).connect(audioContext.destination);
    }
    return audioMaster;
  }
  function playTone(freqs, wave, level, dur, step) {
    const master = audioChain(); if (!master) return;
    const now = audioContext.currentTime, gap = step ?? (freqs.length > 2 ? .1 : .08);
    freqs.forEach((frequency, i) => {
      const osc = audioContext.createOscillator(), gain = audioContext.createGain();
      osc.type = wave; osc.frequency.value = frequency;
      const t = now + i * gap;
      gain.gain.setValueAtTime(0, t);
      gain.gain.linearRampToValueAtTime(level, t + .012);
      gain.gain.exponentialRampToValueAtTime(.0001, t + dur);
      osc.connect(gain).connect(master);
      osc.start(t); osc.stop(t + dur + .02);
    });
  }
  /* 平坦白噪（不带衰减包络）：摩擦类音色要的是一段「面」，
     原来的 noiseBuffer 自带 pow(1-t,2) 衰减，只适合点状的一声「嚓」。 */
  let grainBuf = null;
  function grainBuffer() {
    const c = audioContext;
    if (grainBuf && grainBuf.sampleRate === c.sampleRate) return grainBuf;
    const len = Math.max(1, Math.floor(c.sampleRate * .3));
    grainBuf = c.createBuffer(1, len, c.sampleRate);
    const data = grainBuf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * .9;
    return grainBuf;
  }
  /* 磨皮 / 细磨：绵密的沙沙。带通中心频率跟着拖动速度在 700–1800Hz 之间滑，
     颗粒用短噪声 + 随机播放速率，叠出砂纸的「细而不齐」；峰值压在 .07 以内，久听不累。 */
  function sandSwish(k = 1) {
    const c = audioContext, master = audioChain(); if (!c || !master) return;
    const now = c.currentTime;
    const speed = Math.min(1, rubSpeed / 26);
    const center = Math.max(700, Math.min(1800, 700 + speed * 1100 + rnd(110, -110)));
    const dur = .07 + Math.random() * .05;
    const src = c.createBufferSource(); src.buffer = grainBuffer();
    src.playbackRate.value = rnd(1.16, .84);
    const bp = c.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = center; bp.Q.value = 1.5;
    const lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = Math.min(6200, center * 2.8);
    const gain = c.createGain();
    const peak = Math.min(.07, (.02 + speed * .04) * k);
    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(peak, now + .009);
    gain.gain.exponentialRampToValueAtTime(.0001, now + dur);
    src.connect(bp).connect(lp).connect(gain).connect(master);
    src.start(now); src.stop(now + dur + .02);
  }
  /* 切板 / 粗切拖动时的锯路摩擦：比磨皮更高、更薄，只在真的在锯的时候出一点声。 */
  function sawHiss(k = 1) {
    const c = audioContext, master = audioChain(); if (!c || !master) return;
    const now = c.currentTime, dur = .06 + Math.random() * .04;
    const src = c.createBufferSource(); src.buffer = grainBuffer();
    src.playbackRate.value = rnd(1.3, 1.0);
    const bp = c.createBiquadFilter(); bp.type = 'bandpass'; bp.Q.value = .9;
    bp.frequency.setValueAtTime(2600, now);
    bp.frequency.exponentialRampToValueAtTime(1700, now + dur);
    const gain = c.createGain(), peak = Math.min(.07, .04 * k);
    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(peak, now + .008);
    gain.gain.exponentialRampToValueAtTime(.0001, now + dur);
    src.connect(bp).connect(gain).connect(master);
    src.start(now); src.stop(now + dur + .02);
  }
  /* 描形 / 画细节：笔尖擦过宣纸，比磨皮闷、比抛光干。 */
  function paperSwipe(k = 1) {
    const c = audioContext, master = audioChain(); if (!c || !master) return;
    const now = c.currentTime, dur = .05 + Math.random() * .035;
    const src = c.createBufferSource(); src.buffer = grainBuffer();
    src.playbackRate.value = rnd(1.1, .82);
    const lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 900 + rnd(220, -220); lp.Q.value = .7;
    const gain = c.createGain(), peak = Math.min(.045, .026 * k);
    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(peak, now + .01);
    gain.gain.exponentialRampToValueAtTime(.0001, now + dur);
    src.connect(lp).connect(gain).connect(master);
    src.start(now); src.stop(now + dur + .02);
  }
  /* 抛光：柔和的摩擦 + 一层很轻的泛音（两个和谐 sine），拂拭感靠高频颗粒在上面飘。 */
  function polishGlide(k = 1) {
    const c = audioContext, master = audioChain(); if (!c || !master) return;
    const now = c.currentTime, dur = .13 + Math.random() * .06;
    const src = c.createBufferSource(); src.buffer = grainBuffer();
    src.playbackRate.value = rnd(.98, .74);
    const lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 2100; lp.Q.value = .5;
    const gain = c.createGain(), peak = Math.min(.06, .034 * k);
    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(peak, now + .02);
    gain.gain.exponentialRampToValueAtTime(.0001, now + dur);
    src.connect(lp).connect(gain).connect(master);
    src.start(now); src.stop(now + dur + .02);
    /* 泛音：1320 / 1980 是 660 的四、六倍，听上去是「亮」不是「响」 */
    [1320, 1980].forEach((f, i) => {
      const osc = c.createOscillator(), g = c.createGain();
      osc.type = 'sine'; osc.frequency.value = f + rnd(6, -6);
      g.gain.setValueAtTime(0, now);
      g.gain.linearRampToValueAtTime(.008 - i * .003, now + .04);
      g.gain.exponentialRampToValueAtTime(.0001, now + dur * .9);
      osc.connect(g).connect(master); osc.start(now); osc.stop(now + dur + .02);
    });
  }
  /* 落刀的一声「嚓」：高频颗粒 + 极短的低频「咔」。只在真的落刀那一瞬响，不连成片。 */
  function cutStrike(level = 1) {
    noiseBurst(.085, 2600, .12 * level);
    playTone([1180, 820], 'triangle', .045 * level, .085, .012);
    playTone([132], 'sine', .07 * level, .16, .02);
  }
  /* 成器：四音上行 + 长尾泛音。峰值 .12，靠压缩器收住，不刺耳。 */
  function completeChime() {
    const c = audioContext, master = audioChain(); if (!c || !master) return;
    const now = c.currentTime + .02;
    [523.25, 659.25, 783.99, 1046.5].forEach((f, i) => {
      const t = now + i * .11, osc = c.createOscillator(), gain = c.createGain();
      osc.type = 'sine'; osc.frequency.value = f;
      gain.gain.setValueAtTime(0, t);
      gain.gain.linearRampToValueAtTime(.12, t + .018);
      gain.gain.exponentialRampToValueAtTime(.0001, t + .95);
      osc.connect(gain).connect(master); osc.start(t); osc.stop(t + 1.02);
    });
    [1567.98, 2093].forEach((f, i) => {
      const t = now + .2 + i * .05, osc = c.createOscillator(), gain = c.createGain();
      osc.type = 'sine'; osc.frequency.value = f;
      gain.gain.setValueAtTime(0, t);
      gain.gain.linearRampToValueAtTime(.032, t + .12);
      gain.gain.exponentialRampToValueAtTime(.0001, t + 1.55);
      osc.connect(gain).connect(master); osc.start(t); osc.stop(t + 1.6);
    });
  }
  function noiseBurst(dur, freq, level) {
    const master = audioChain(); if (!master) return;
    const now = audioContext.currentTime;
    if (!noiseBuffer) {
      const len = Math.max(1, Math.floor(audioContext.sampleRate * .2));
      noiseBuffer = audioContext.createBuffer(1, len, audioContext.sampleRate);
      const data = noiseBuffer.getChannelData(0);
      for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 2);
    }
    const src = audioContext.createBufferSource(); src.buffer = noiseBuffer;
    const filter = audioContext.createBiquadFilter(); filter.type = 'bandpass'; filter.frequency.value = freq; filter.Q.value = .8;
    const gain = audioContext.createGain();
    gain.gain.setValueAtTime(level, now); gain.gain.exponentialRampToValueAtTime(.0001, now + dur);
    src.connect(filter).connect(gain).connect(master);
    src.start(now); src.stop(now + dur + .02);
  }
  function playSound(type) {
    if (!audioContext || !audioChain()) return;
    if (type === 'paint') { sandSwish(.55); return; }
    if (type === 'cut' || type === 'detail') { cutStrike(1); return; }
    if (type === 'failed') { playTone([143, 107], 'triangle', .2, .5); return; }
    if (type === 'complete') { completeChime(); return; }
    if (type === 'advance' || type === 'sliced') { playTone([659.25, 987.77], 'sine', .11, .32, .06); return; }
    playTone([880], 'sine', .14, .4);
  }
  function sound(type) {
    if (!save.sound) {
      /* 声音关着时不能只是 return——玩家会以为坏了。每次进页面只提醒一次。 */
      if (!soundOffHinted && game && game.state.status === 'playing') {
        soundOffHinted = true; toast('音效是关着的 · 点右上角的喇叭可以打开');
      }
      return;
    }
    const c = ensureAudio(); if (!c) return;
    if (c.state !== 'running') {
      /* 还没 running：先入队再 resume。currentTime 这时不前进，直接调度等于把声音丢掉。 */
      audioQueue.push(type); if (audioQueue.length > 6) audioQueue.shift();
      resumeAudio(); return;
    }
    playSound(type);
  }
  function haptic(pattern) {
    if (!TOUCH) return;
    if (navigator.vibrate) { try { if (navigator.vibrate(pattern)) return; } catch (_) { /* Optional. */ } }
    /* iPhone Safari 没有 Vibration API：用一圈很轻的画面脉冲代替，至少让手上有反馈。 */
    const wrap = document.querySelector('.canvas-wrap'); if (!wrap) return;
    wrap.classList.remove('haptic-pulse'); void wrap.offsetWidth; wrap.classList.add('haptic-pulse');
    setTimeout(() => wrap.classList.remove('haptic-pulse'), 220);
  }
  function toggleSound() {
    save.sound = !save.sound; save.soundChoice = true; persist(); updateUI();
    /* 开关就在用户手势里，是补解锁最稳的时机：之前因为 sound:false 没建过 ctx，这里补上。 */
    if (save.sound) { unlockAudio(); sound('cut'); toast('音效已开。手机震动需要系统支持。'); }
    else { audioQueue.length = 0; toast('音效已关。'); }
  }
  /* ————————————— 碎屑粒子 —————————————
     磨皮与切片是两种完全不同的去除：磨是「把石皮搓成粉」，粉细、轻、贴着手往下簌簌落；
     切是「把玉料锯开」，屑粗、重、沿锯口朝两侧迸开再砸下去。两套参数不共用。 */
  const CHIP_CAP = 620, TAU = Math.PI * 2;
  const rnd = (max = 1, min = 0) => min + Math.random() * (max - min);
  const pick = list => list[(Math.random() * list.length) | 0];
  function tint(hex, k, lift = 0) {
    const n = parseInt(hex.slice(1), 16);
    const v = [n >> 16 & 255, n >> 8 & 255, n & 255].map(x => Math.max(0, Math.min(255, Math.round(x * k + lift))));
    return '#' + v.map(x => x.toString(16).padStart(2, '0')).join('');
  }
  function buildPalette() {
    const base = (game && game.level && game.level.color) || ['#eee0bb', '#ceb58d', '#97714e'];
    palette = {
      // 石皮：暖赭土色，磨下来是暗的、脏的
      powder: ['#d3b78d', '#c2a478', '#ad8e60', '#96794c'],
      grit: ['#9a7343', '#76532c', '#b08a55', '#5f4222'],
      // 玉屑：偏亮、偏白，切下来是净的
      mist: [tint(base[0], 1.02, 8), tint(base[0], 1.0, 2), '#efe8d4'],
      flake: ['#f8f2e0', tint(base[0], 1.0, 0), '#ddd0b0', '#c8b992'],
      shard: ['#a8906a', '#7d6647', tint(base[2], .92, 8)],
      // 碎片的暗边：浅色玉面上的碎片要靠一点投影才立得住
      flakeEdge: 'rgba(122,98,64,.34)',
      shardEdge: 'rgba(84,64,40,.46)'
    };
  }
  function push(p) {
    if (reduced || chips.length >= CHIP_CAP) return;
    p.start = performance.now(); chips.push(p);
  }
  // 石面判定：只有真的磨在石头上才掉屑。用原石的 alpha 轮廓做 3px 一格的遮罩。
  let rawMask = null;
  function buildRawMask() {
    rawMask = null;
    if (!rawImage) return;
    try {
      const data = rawImage.getContext('2d').getImageData(0, 0, 600, 600).data;
      const grid = new Uint8Array(200 * 200);
      for (let gy = 0; gy < 200; gy++) for (let gx = 0; gx < 200; gx++) {
        grid[gy * 200 + gx] = data[((gy * 3 + 1) * 600 + gx * 3 + 1) * 4 + 3] > 40 ? 1 : 0;
      }
      rawMask = grid;
    } catch (_) { rawMask = null; /* file:// 下 canvas 可能被污染，退化为不做判定 */ }
  }
  function onStone(p) {
    if (!rawMask) return true;
    const gx = Math.floor(p.x / 3), gy = Math.floor(p.y / 3);
    return gx >= 0 && gy >= 0 && gx < 200 && gy < 200 && rawMask[gy * 200 + gx] === 1;
  }
  // —— 磨皮：石皮被搓成粉，粉细、轻、成片往下飘；砂粒更重，落得快
  function emitGrind(at) {
    if (!onStone(at)) return;
    for (let i = 0, n = Math.random() < .5 ? 4 : 3; i < n; i++) {
      const a = rnd(TAU), r = rnd(24, 3);
      push({ kind: 'powder', x: at.x + Math.cos(a) * r, y: at.y + Math.sin(a) * r * .82,
        vx: Math.cos(a) * rnd(54, 8), vy: Math.sin(a) * rnd(28, 2) + 14, g: 190,
        size: rnd(5.2, 2.2), color: pick(palette.powder), life: rnd(980, 660), alpha: rnd(.62, .28) });
    }
    for (let i = 0, n = Math.random() < .55 ? 3 : 2; i < n; i++) {
      const a = rnd(TAU), r = rnd(22, 3);
      push({ kind: 'grain', x: at.x + Math.cos(a) * r, y: at.y + Math.sin(a) * r,
        vx: Math.cos(a) * rnd(84, 16), vy: Math.sin(a) * rnd(38, 4) + 24, g: 540,
        size: rnd(6, 2.6), color: pick(palette.grit), life: rnd(880, 620),
        rot: rnd(TAU), spin: rnd(11, -11), alpha: rnd(1, .82) });
    }
    if (Math.random() < .25) {
      const a = rnd(TAU);
      push({ kind: 'flaw', x: at.x + Math.cos(a) * rnd(18, 3), y: at.y + Math.sin(a) * rnd(18, 3),
        vx: Math.cos(a) * rnd(90, 20), vy: rnd(-26, -86), g: 760,
        size: rnd(8.4, 4.6), color: pick(palette.grit), life: rnd(940, 700),
        rot: rnd(TAU), spin: rnd(9, -9), alpha: 1 });
    }
    // 扬尘：一团很淡的土色雾气，慢慢往上飘散，是"磨"和"切"手感的分水岭
    if (Math.random() < .12) {
      push({ kind: 'haze', x: at.x + rnd(16, -16), y: at.y + rnd(12, -12),
        vx: rnd(16, -16), vy: rnd(0, -18), g: -3,
        size: rnd(32, 15), color: pick(palette.powder), life: rnd(1300, 900), alpha: rnd(.13, .06) });
    }
  }
  // —— 切片：玉浆沿锯口喷出，碎片朝两侧迸开，砸得比石粉狠得多
  function emitSlice(at) {
    for (let i = 0, n = 3; i < n; i++) {
      const side = Math.random() < .5 ? -1 : 1;
      push({ kind: 'mist', x: at.x + rnd(10, -10), y: at.y + rnd(4, -4),
        vx: rnd(32, -32), vy: side * rnd(118, 42), g: 420,
        size: rnd(5.6, 2.2), color: pick(palette.mist), life: rnd(560, 360), alpha: rnd(.9, .55) });
    }
    for (let i = 0, n = Math.random() < .5 ? 3 : 2; i < n; i++) {
      const drop = Math.random() < .8;
      push({ kind: 'flake', edge: palette.flakeEdge, x: at.x + rnd(13, -13), y: at.y + rnd(3, -3),
        vx: rnd(56, -56), vy: drop ? rnd(178, 60) : -rnd(110, 36), g: 1250,
        size: rnd(6.6, 2.8), color: pick(palette.flake), life: rnd(700, 440),
        rot: rnd(TAU), spin: rnd(24, -24), alpha: rnd(1, .82) });
    }
    if (Math.random() < .16) {
      const drop = Math.random() < .82;
      push({ kind: 'shard', edge: palette.shardEdge, x: at.x + rnd(9, -9), y: at.y + rnd(3, -3),
        vx: rnd(70, -70), vy: drop ? rnd(206, 76) : -rnd(136, 46), g: 1700,
        size: rnd(11.5, 7.4), color: pick(palette.shard), life: rnd(760, 520),
        rot: rnd(TAU), spin: rnd(18, -18), alpha: 1 });
    }
  }
  // 按手移动的路程发料：划过多少距离就落多少屑，快划出得多，慢划出得少
  function emitMotion(phase, from, to) {
    if (reduced || !palette) return;
    emitAcc += E.distance(from, to);
    const step = phase === 0 ? 3 : 3.6;
    let guard = 0;
    while (emitAcc >= step && guard++ < 24) {
      emitAcc -= step;
      const k = Math.random();
      const at = { x: from.x + (to.x - from.x) * k, y: from.y + (to.y - from.y) * k };
      if (phase === 0) emitGrind(at); else if (phase === 1) emitSlice(at);
    }
    emitAcc = Math.min(emitAcc, step);
  }
  /* ————————————— 拖动摩擦音 —————————————
     和粒子分开算：粒子在 prefers-reduced-motion 下完全不发，但声音要照旧（声音不是动效）。
     双层节流——先按位移攒够路程（细磨更密、切板更疏），再按时间卡最小间隔，
     手指划得再快也最多 40ms 一声，避免每帧 createBufferSource 把手机 CPU 顶满、爆音。 */
  let rubAcc = 0, rubClock = 0, rubSpeed = 0;
  function strokeAudio(phase, from, to) {
    if (!save.sound) return;
    const d = E.distance(from, to);
    if (d <= 0) return;
    rubSpeed = rubSpeed * .8 + d * .2;
    rubAcc = Math.min(rubAcc + d, 60);
    const step = phase === 1 ? 34 : phase === 7 ? 16 : 11;
    if (rubAcc < step) return;
    const now = performance.now();
    if (now - rubClock < 40) return;
    rubAcc = 0; rubClock = now;
    if (rubSpeed < .55) return;
    const c = ensureAudio(); if (!c) return;
    if (c.state !== 'running') { resumeAudio(); return; }
    if (phase === 0) sandSwish(1);
    else if (phase === 1) sawHiss(.6);
    else if (phase === 2 || phase === 4) paperSwipe(.9);
    else if (phase === 6) sandSwish(.72);
    else if (phase === 7) polishGlide(1);
  }
  function drawParticles(time) {
    const alive = [];
    for (let i = 0; i < chips.length; i++) {
      const p = chips[i], age = time - (p.start || 0), u = Math.max(0, age / (p.life || 700));
      if (u >= 1) continue;
      alive.push(p);
      const dt = age / 1000, x = p.x + p.vx * dt, y = p.y + p.vy * dt + .5 * p.g * dt * dt;
      const alpha = Math.max(0, (p.alpha ?? 1) * (1 - u));
      ctx.save(); ctx.fillStyle = p.color;
      if (p.kind === 'haze') {
        const s = p.size * (1 + u * 1.5);
        ctx.globalAlpha = alpha * .5; ctx.beginPath(); ctx.arc(x, y, s, 0, TAU); ctx.fill();
        ctx.globalAlpha = alpha * .34; ctx.beginPath(); ctx.arc(x, y, s * .56, 0, TAU); ctx.fill();
      } else if (p.kind === 'powder' || p.kind === 'mist') {
        const s = p.size * (1 + u * 1.15);
        ctx.globalAlpha = alpha * .34; ctx.beginPath(); ctx.arc(x, y, s * 1.7, 0, TAU); ctx.fill();
        ctx.globalAlpha = alpha * .92; ctx.beginPath(); ctx.arc(x, y, s, 0, TAU); ctx.fill();
      } else {
        // 沿飞行方向拉伸，飞得越快拉得越长，看起来才是在"掉"而不是"贴"
        const vy = p.vy + p.g * dt, speed = Math.hypot(p.vx, vy);
        ctx.globalAlpha = alpha;
        ctx.translate(x, y); ctx.rotate(Math.atan2(vy, p.vx) * .7 + (p.rot + p.spin * dt) * .3);
        const w = p.size * (1 + Math.min(1.15, speed / 240)), h = p.size * (1 - u * .22);
        if (p.edge) { ctx.fillStyle = p.edge; ctx.fillRect(-w / 2 - .9, -h / 2 - .9, w + 1.8, h + 1.8); ctx.fillStyle = p.color; }
        ctx.fillRect(-w / 2, -h / 2, w, h);
      }
      ctx.restore();
    }
    chips = alive;
  }
  function layer() { const c = document.createElement('canvas'); c.width = c.height = 600; return c; }
  function line(c, points, close = false) {
    if (!points.length) return;
    c.beginPath(); c.moveTo(points[0].x, points[0].y);
    points.slice(1).forEach(p => c.lineTo(p.x, p.y)); if (close) c.closePath();
  }
  function drawImage(c, key, rect) {
    const image = images[key]; if (!image) return;
    if (key === 'final') { const d = E.ARTWORK.draw; c.drawImage(image, d.x, d.y, d.width, d.height); return; }
    const a = A[key], b = a.box;
    c.drawImage(image, b[0], b[1], b[2] - b[0], b[3] - b[1], rect.left, rect.top, rect.right - rect.left, rect.bottom - rect.top);
  }
  const masks = new WeakMap();
  function maskCanvas(mask) {
    if (masks.has(mask)) return masks.get(mask);
    const small = document.createElement('canvas'); small.width = small.height = E.RES;
    const c = small.getContext('2d'), data = c.createImageData(E.RES, E.RES);
    for (let i = 0; i < mask.length; i++) { const j = i * 4; data.data[j] = data.data[j + 1] = data.data[j + 2] = 255; data.data[j + 3] = mask[i] ? 255 : 0; }
    c.putImageData(data, 0, 0); const out = layer(); out.getContext('2d').drawImage(small, 0, 0, 600, 600);
    // Only immutable masks are cached. The cutter edits its live mask in place.
    if ([E.FINAL, E.OUTER, E.BLANK].includes(mask)) masks.set(mask, out);
    return out;
  }
  function coverage(set, points, radius) {
    const out = layer(), c = out.getContext('2d'); c.fillStyle = '#fff';
    for (const i of set) { const p = points[i]; c.beginPath(); c.arc(p.x, p.y, radius, 0, Math.PI * 2); c.fill(); }
    return out;
  }
  function clip(c, mask) { c.globalCompositeOperation = 'destination-in'; c.drawImage(maskCanvas(mask), 0, 0); c.globalCompositeOperation = 'source-over'; }
  function normalized(key) {
    const out = layer(); drawImage(out.getContext('2d'), key, E.ARTWORK.bounds); return out;
  }
  let roughImage, halfImage, finalImage, matteImage, rawImage, jadeImage, materialTexture;
  function makeMaterialTexture() {
    const out = layer(), c = out.getContext('2d'), colors = active.model.color || game.level.color;
    const g = c.createLinearGradient(50, 70, 540, 540); g.addColorStop(0, colors[0]); g.addColorStop(.48, colors[1]); g.addColorStop(1, colors[2]); c.fillStyle = g; c.fillRect(0, 0, 600, 600);
    if (active.texturePatch) {
      const p = active.texturePatch;
      c.save(); c.globalAlpha = .30; c.filter = 'blur(1.5px)'; c.drawImage(images.final, p[0], p[1], p[2], p[3], 0, 0, 600, 600); c.restore();
    }
    let seed = 137 + active.id.length * 97;
    const rand = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
    for (let i = 0; i < 1900; i++) {
      const x = rand() * 600, y = rand() * 600, size = rand() * 1.5 + .2;
      c.fillStyle = i % 3 ? '#ffffff18' : colors[2] + '35'; c.fillRect(x, y, size, size);
    }
    return out;
  }
  function materialSurface(mask) {
    const out = layer(), c = out.getContext('2d'); c.drawImage(materialTexture, 0, 0); clip(c, mask);
    c.save(); c.globalCompositeOperation = 'source-atop'; c.lineWidth = 7; c.lineJoin = 'round'; c.strokeStyle = '#503f302f'; line(c, E.OUTLINE, true); c.stroke();
    c.translate(-2, -2); c.strokeStyle = '#fff3c34d'; c.lineWidth = 2.5; line(c, E.OUTLINE, true); c.stroke(); c.restore(); return out;
  }
  function prepareImages() {
    finalImage = normalized('final');
    materialTexture = active.procedural ? makeMaterialTexture() : null;
    roughImage = active.procedural ? materialSurface(E.OUTER) : normalized('rough');
    halfImage = active.procedural ? materialSurface(E.FINAL) : normalized('half');
    matteImage = layer(); const m = matteImage.getContext('2d');
    m.filter = 'saturate(.72) brightness(.98)'; m.drawImage(finalImage, 0, 0); m.filter = 'none';
    m.globalCompositeOperation = 'source-atop'; m.fillStyle = '#d9c9ab55'; m.fillRect(0, 0, 600, 600);
    rawImage = layer(); const r = rawImage.getContext('2d'), d = A.raw.draw;
    r.drawImage(images.raw, d.x, d.y, d.width, d.height);
    jadeImage = layer(); const j = jadeImage.getContext('2d');
    j.drawImage(rawImage, 0, 0); j.globalCompositeOperation = 'source-in'; j.fillStyle = '#e2cba1'; j.fillRect(0, 0, 600, 600); j.globalCompositeOperation = 'source-over';
    const b = A.raw.box, sx = d.width / A.raw.size[0], sy = d.height / A.raw.size[1];
    if (active.procedural) { j.drawImage(materialTexture, 0, 0); j.save(); j.globalCompositeOperation = 'soft-light'; j.globalAlpha = .65; j.drawImage(rawImage, 0, 0); j.restore(); }
    else drawImage(j, 'jade', { left: d.x + b[0] * sx, top: d.y + b[1] * sy, right: d.x + b[2] * sx, bottom: d.y + b[3] * sy });
    j.globalCompositeOperation = 'destination-in'; j.drawImage(rawImage, 0, 0);
    buildRawMask();
  }
  function boardImage(mask = null) {
    const out = layer(), c = out.getContext('2d');
    if (active.procedural) {
      const b = game.boardRect(); c.save(); c.beginPath(); c.roundRect(b.left, b.top, b.right - b.left, b.bottom - b.top, 6); c.clip(); c.drawImage(materialTexture, 0, 0);
      c.strokeStyle = '#faf6d86b'; c.lineWidth = 7; c.strokeRect(b.left, b.top, b.right - b.left, b.bottom - b.top); c.restore();
    } else drawImage(c, 'slab', game.boardRect());
    if (mask) clip(c, mask); return out;
  }
  function roughSurface(mask) {
    if (active.procedural) return materialSurface(mask);
    const out = boardImage(mask), c = out.getContext('2d'); c.drawImage(roughImage, 0, 0); clip(c, mask); return out;
  }
  function overlayCoverage(base, other, set, points, radius) {
    const patch = layer(), p = patch.getContext('2d'); p.drawImage(other, 0, 0); p.globalCompositeOperation = 'destination-in'; p.drawImage(coverage(set, points, radius), 0, 0);
    base.getContext('2d').drawImage(patch, 0, 0); return base;
  }
  function carvedSurface() {
    const cs = game.cutter.state, out = roughSurface(cs.mask), c = out.getContext('2d');
    if (active.procedural) {
      function reveal(points, width) {
        const p = layer(), pc = p.getContext('2d'); pc.lineCap = pc.lineJoin = 'round'; pc.lineWidth = width; pc.strokeStyle = '#fff';
        line(pc, points); pc.stroke(); pc.globalCompositeOperation = 'source-in'; pc.drawImage(finalImage, 0, 0); c.drawImage(p, 0, 0);
      }
      E.OPENINGS.forEach((opening, i) => { if (cs.stage > 1 || i < cs.substage) reveal(opening.path, 11); });
      cs.details.forEach(i => reveal(E.DETAILS[i].points, 16));
      clip(c, cs.mask); return out;
    }
    // Reveal only the regions already carved; the half-carved artwork never gives away unfinished details.
    if (cs.substage > 0 || cs.stage > 1) {
      c.save(); c.beginPath(); c.arc(E.HOLE.x, E.HOLE.y, E.HOLE.r + 13, 0, Math.PI * 2); c.clip(); c.drawImage(halfImage, 0, 0); c.restore();
    }
    if (cs.substage > 1 || cs.stage > 1) {
      c.save(); c.beginPath(); c.arc(E.SIDE_HOLE.x, E.SIDE_HOLE.y, E.SIDE_HOLE.r + 5, 0, Math.PI * 2); c.clip(); c.drawImage(finalImage, 0, 0); c.restore();
    }
    if (cs.stage > 1) {
      c.save(); line(c, E.NOTCH_GUIDE); c.lineWidth = 18; c.strokeStyle = '#fff';
      const p = layer(), pc = p.getContext('2d'); pc.strokeStyle = '#fff'; pc.lineWidth = 20; line(pc, E.NOTCH_GUIDE); pc.stroke(); pc.globalCompositeOperation = 'source-in'; pc.drawImage(halfImage, 0, 0); c.drawImage(p, 0, 0); c.restore();
    }
    for (const index of cs.details) {
      const p = layer(), pc = p.getContext('2d'); pc.lineCap = pc.lineJoin = 'round'; pc.strokeStyle = '#fff'; pc.lineWidth = index === 0 ? 26 : 18;
      line(pc, E.DETAILS[index].points); pc.stroke(); pc.globalCompositeOperation = 'source-in'; pc.drawImage(halfImage, 0, 0); c.drawImage(p, 0, 0);
    }
    clip(c, cs.mask); return out;
  }
  function makeSurface() {
    const s = game.state, cs = game.cutter.state;
    if (!ready) return layer();
    if (s.status === 'complete') return finalImage;
    if (s.phase === 0) {
      const out = layer(); out.getContext('2d').drawImage(rawImage, 0, 0);
      return overlayCoverage(out, jadeImage, s.raw, A.raw.points, 36);
    }
    if (s.phase === 1 && !s.sliced) return jadeImage;
    if (s.phase <= 3) return boardImage(s.phase === 3 ? cs.mask : null);
    if (s.phase === 4) return roughSurface(E.OUTER);
    if (s.phase === 5) return carvedSurface();
    if (s.phase === 6) {
      const out = active.procedural ? carvedSurface() : roughSurface(E.FINAL), c = out.getContext('2d'); if (!active.procedural) c.drawImage(halfImage, 0, 0); clip(c, E.FINAL);
      return overlayCoverage(out, matteImage, s.grind, game.brushPoints, 34);
    }
    const out = layer(); out.getContext('2d').drawImage(matteImage, 0, 0);
    return overlayCoverage(out, finalImage, s.shine, game.brushPoints, 34);
  }
  function view() {
    const s = game.state, cs = game.cutter.state;
    if (active.procedural && [4, 5].includes(s.phase)) {
      const points = s.phase === 4 ? W.SKETCHES[s.sketchIndex].points : game.guide();
      const xs = points.map(p => p.x), ys = points.map(p => p.y);
      const left = Math.min(...xs), right = Math.max(...xs), top = Math.min(...ys), bottom = Math.max(...ys);
      return { x: (left + right) / 2, y: (top + bottom) / 2, zoom: Math.max(1.05, Math.min(4.4, 300 / Math.max(65, right - left, bottom - top))) };
    }
    if (s.phase === 4) {
      const i = s.sketchIndex;
      const focus = i < 3 ? E.OPENINGS[i].center : i === 3 ? { x: 215, y: 200 } : i === 4 ? { x: 180, y: 274 } : { x: 232, y: 190 };
      return { x: focus.x, y: focus.y, zoom: [2.15, 4.4, 3.1, 2.0, 2.4, 1.65][i] };
    }
    if (s.phase === 5) {
      if (cs.stage === 1) return { ...E.OPENINGS[cs.substage].center, zoom: [2.15, 4.4, 3.1][cs.substage] };
      return { x: 230, y: 203, zoom: 1.8 };
    }
    return { x: 270, y: 275, zoom: 1.02 };
  }
  function currentSpec() {
    const s = game.state, cs = game.cutter.state, spec = { ...specs[s.phase] };
    if (s.phase === 1 && s.sliced) { spec.title = '玉板已切出，定下比例'; spec.message = '调整长宽厚度，再点击“取出玉板”'; spec.gesture = '拖动滑杆定尺寸 / 再取出玉板'; }
    else if (s.phase === 1 && s.cuts.length) spec.message = `已切 ${s.cuts.length} / 4 刀 · 继续下一条虚线`;
    if (s.phase === 4) {
      spec.title = ['描中央大孔', '描侧面小孔', '描嘴部缺口', '描眼纹', '描吻线', '描卷纹'][s.sketchIndex];
      spec.message = `细节草线 ${s.sketchIndex + 1} / 6 · 只落墨，暂不切开`;
    }
    if (s.phase === 5) {
      if (cs.stage === 1) {
        spec.title = ['一笔透开中央大孔', '小孔也要，闭合收刀', '循嘴部，开出狭长缺口'][cs.substage];
        spec.text = cs.substage < 2 ? '沿已经画好的孔位墨线画一个闭合圈，回到起点再松手。孔内玉芯会脱落，周围的主体要留下。' : '从左侧玉料外起笔，沿墨线绕过嘴部余料，再回到外部收刀。保留上下唇缘。';
        spec.gesture = cs.substage < 2 ? '一笔画圈 / 闭合收刀' : '从外侧划入 / 回到外侧收刀';
      } else { spec.title = '沿纹琢刻，半雕渐成'; spec.text = '分别沿墨线琢出眼纹、吻线和卷纹，每条一笔完成，顺序由你决定。已经完成的纹样会褪去墨线，露出雕琢效果。'; }
    }
    if (active.procedural) {
      if (s.phase === 0) spec.text = `按住来回拖动，磨掉整块原石的石皮。擦过的地方会露出${active.material}，不需要开窗或打光。`;
      if (s.phase === 7) spec.text = '最后来回拂拭，让光泽逐渐显现。完成后呈现去背景、去编号后的器物图像，并收入本机图鉴。';
      if (s.phase === 4) {
        spec.title = '描' + W.SKETCHES[s.sketchIndex].name;
        spec.message = `细节草线 ${s.sketchIndex + 1} / ${W.SKETCHES.length} · 只落墨，暂不下刀`;
        spec.text = E.OPENINGS.length ? '先把鱼饰穿孔的位置描清楚。这件鱼饰不另加鱼鳞或花纹；天然黑色斑点保留为材质。' : '这一件正面不设穿孔。沿照片中可辨认的纹路描画，可以分几笔完成；画完再沿墨线雕琢。';
      }
      if (s.phase === 5) {
        spec.title = cs.stage === 1 ? '透开' + E.OPENINGS[cs.substage].name : '琢出' + (E.DETAILS.find((_, i) => !cs.details.includes(i))?.name || '纹样');
        spec.text = cs.stage === 1 ? '沿已经描好的孔位画一个闭合圈，回到起点再松手。只取出孔内玉芯，保留周围主体。' : '沿已经画好的墨线，一笔描过这条纹路，松手后完成雕琢。自然裂纹和矿物斑点不作为雕刻线。';
      }
    }
    return spec;
  }
  function updateUI() {
    const s = game.state, cs = game.cutter.state, spec = currentSpec(), cutting = [3, 5].includes(s.phase);
    canvas.dataset.phase = String(s.phase); canvas.dataset.status = s.status;
    $('bench-phase').textContent = s.status === 'complete' ? '成器 / COMPLETED' : spec.label;
    $('material-button').textContent = active.name + ' · 选器物 ⌄';
    $('target-name').textContent = active.name; $('target-material').textContent = active.material;
    $('bench-axis').textContent = s.phase === 0 ? '一 方 原 石' : s.phase <= 2 ? active.id === 'fish' ? '一 片 素 料' : '一 片 素 玉' : '器 形 渐 现';
    $('level-meta').textContent = `难度${words[s.levelIndex]} / 共五档`; $('level-name').textContent = game.level.name;
    document.querySelector('.level-stamp').textContent = numerals[s.levelIndex];
    for (const node of document.querySelectorAll('.step')) {
      const i = Number(node.dataset.step), done = i < s.phase || s.status === 'complete';
      node.classList.toggle('current', i === s.phase); node.classList.toggle('done', done);
      node.querySelector('.step-index').textContent = done ? '✓' : String(i + 1).padStart(2, '0');
      node.querySelector('.step-state').textContent = done ? '已完成' : i === s.phase ? '进行中' : '';
      if (i === s.phase) node.setAttribute('aria-current', 'step'); else node.removeAttribute('aria-current');
    }
    const budget = cutting ? game.level.budgets[cs.stage] : 0, remaining = cutting ? game.cutter.remaining() : Infinity;
    $('budget-label').textContent = cutting ? '本步剩余刀数' : s.status === 'complete' ? '八道工序完成' : '本步不计刀数';
    $('cuts-left').textContent = s.status === 'complete' ? '成' : cutting ? String(Math.max(0, remaining)).padStart(2, '0') : '∞';
    $('budget-unit').hidden = !cutting; $('cuts-max').textContent = String(budget).padStart(2, '0');
    $('budget-pips').replaceChildren();
    for (let i = 0; i < budget; i++) { const el = document.createElement('span'); if (i >= remaining) el.className = 'used'; $('budget-pips').append(el); }
    const p = Math.round(game.progress() * 100); $('progress-label').textContent = spec.progress; $('progress-value').textContent = p + '%'; $('progress-bar').style.width = p + '%';
    $('overall-progress').textContent = s.status === 'complete' ? '八道工序 · 全部完成' : `工序 ${s.phase + 1} / 8` + (s.phase === 4 ? ` · 草线 ${s.sketchIndex + 1} / ${W.SKETCHES.length}` : '');
    $('instruction-index').textContent = `第${words[s.phase]}道 · ${W.PHASES[s.phase]}`;
    $('instruction-title').textContent = s.status === 'complete' ? '玉已成器，收入图鉴' : spec.title;
    $('instruction-text').textContent = s.status === 'complete' ? '从磨皮到抛光，你已经走完八道工序。可以在图鉴欣赏，也可以再试一种难度。' : spec.text;
    const boardText = loadError || (!ready ? '正在准备原石与阶段素材…' : s.status === 'failed' ? '这一刀留了痕 · 可以补救' : s.status === 'complete' ? '温润成器 · 已收入本机图鉴' : spec.message);
    $('board-message-text').textContent = boardText;
    $('mg-step').textContent = String(s.phase + 1).padStart(2, '0');
    $('mg-name').textContent = W.PHASES[s.phase];
    $('mg-pct').textContent = p + '%';
    $('mg-action').textContent = boardText;
    $('mg-gesture').textContent = spec.gesture;
    $('mg-title').textContent = s.status === 'complete' ? '玉已成器，收入图鉴' : spec.title;
    $('mg-text').textContent = s.status === 'complete' ? '从磨皮到抛光，你已经走完八道工序。可以在图鉴欣赏，也可以再试一种难度。' : spec.text;
    const rail = $('mg-rail');
    if (rail.children.length) [...rail.children].forEach((seg, i) => { seg.className = s.status === 'complete' || i < s.phase ? 'done' : i === s.phase ? 'current' : ''; });
    $('gesture-tip').textContent = spec.gesture;
    $('assist-button').innerHTML = `${s.phase === 1 && s.sliced ? '去确认玉板尺寸' : spec.assist} <svg class="icon"><use href="#i-arrow"/></svg>`;
    $('assist-button').disabled = !ready || busy || dragging || s.status !== 'playing';
    $('undo-button').disabled = busy || dragging || game.historySize() === 0;
    $('hint-button').setAttribute('aria-pressed', String(hints));
    const mgHint = $('mg-hint'); if (mgHint) mgHint.setAttribute('aria-pressed', String(hints));
    $('tool-icon').firstElementChild.setAttribute('href', '#i-' + spec.icon); $('tool-name').textContent = spec.tool;
    $('tool-hint').textContent = cutting ? '松手落刀 · 可以撤回' : '不设时限，慢慢完成';
    canvas.classList.toggle('polishing', [0, 6, 7].includes(s.phase));
    const zoom = view().zoom; $('view-tag').hidden = zoom <= 1.2; $('view-tag').textContent = '局部放大 ×' + zoom.toFixed(1);
    $('plate-controls').hidden = s.phase !== 1 || !s.sliced;
    for (const [key, id] of [['length', 'plate-length'], ['width', 'plate-width'], ['thickness', 'plate-thickness']]) {
      if (key !== 'thickness') { $(id).min = game.plateBase[key]; $(id).max = game.plateBase[key] + (key === 'length' ? 18 : 14); }
      $(id).value = s.dimensions[key]; $(key + '-output').textContent = s.dimensions[key]; $(id).disabled = busy || dragging;
    }
    $('plate-size').textContent = `${s.dimensions.length} × ${s.dimensions.width} × ${s.dimensions.thickness}`;
    $('confirm-plate').disabled = !s.sliced || busy || s.status !== 'playing'; $('confirm-plate').textContent = s.sliced ? '取出玉板，开始描形 →' : `先切完四条边（${s.cuts.length}/4）`;
    $('target-final').classList.toggle('selected', !referencePhase); $('target-phase').classList.toggle('selected', referencePhase);
    $('target-final').setAttribute('aria-pressed', String(!referencePhase)); $('target-phase').setAttribute('aria-pressed', String(referencePhase));
    $('target-canvas').hidden = referencePhase && !active.procedural; $('phase-art').hidden = !referencePhase || active.procedural;
    const src = spec.art === 'final' ? E.ARTWORK.image : A[spec.art].image;
    if ($('phase-art').getAttribute('src') !== src) $('phase-art').src = src;
    $('phase-art').alt = W.PHASES[s.phase] + '效果参考';
    $('target-caption').textContent = referencePhase ? W.PHASES[s.phase] + (active.procedural ? ' · 当前制作状态' : ' · 工序效果参考') : '成品参考 · 操作区从原石开始';
    if (!referencePhase) drawArtifact($('target-canvas'));
    $('sound-button').setAttribute('aria-pressed', String(!!save.sound)); $('sound-button').querySelector('span').textContent = `玉石音效 · ${save.sound ? '开' : '关'}`;
    const mgSound = $('mg-sound');
    if (mgSound) {
      mgSound.setAttribute('aria-pressed', String(!!save.sound));
      mgSound.setAttribute('aria-label', save.sound ? '玉石音效已开，点按关闭' : '玉石音效已关，点按开启');
      mgSound.title = save.sound ? '玉石音效 · 开' : '玉石音效 · 关';
    }
    if (s.phase !== tipPhase) { tipPhase = s.phase; cueAnchor = null; hideStepTip(false); setTimeout(() => showStepTip(false), 140); }
    placeCue();
    schedule();
  }
  function startLevel(index, practice = false) {
    practiceMode = !!practice;
    runFlaws = 0;
    session++; clearTimeout(flashTimer); clearTimeout(resultTimer); cancelAnimationFrame(demoFrame);
    if (captured !== null && canvas.hasPointerCapture(captured)) canvas.releasePointerCapture(captured);
    captured = null; busy = dragging = false; path = []; hover = preview = null; chips = [];
    for (const dialog of document.querySelectorAll('dialog[open]')) dialog.close();
    game = W.createWorkshop(index); hints = game.level.hints; surfaceKey = ''; startedAt = Date.now(); finishedAt = 0; cueAnchor = null;
    firstCompletion = !save.records[recordKey(active.id, index)];
    buildPalette(); emitAcc = 0;
    if (ready) { images.final = images[active.id + '-final']; prepareImages(); }
    $('stage-flash').classList.remove('show'); $('stage-flash').querySelector('span').textContent = ''; $('live-cut').textContent = '慢慢来，操作可以撤回'; $('live-cut').classList.remove('danger');
    save.lastLevel = index; persist(); drawArtifact($('target-canvas')); updateUI();
  }
  function chooseArtifact(id, level = game?.state.levelIndex || 0) {
    active = catalogue.find(item => item.id === id) || catalogue[0];
    E = active.id === 'dragon' ? BaseE : BaseE.withArtwork(active.model); W = BaseW.withArtwork(E, A);
    save.lastArtifact = active.id; startLevel(level);
  }
  function drawArtifact(target, item = active) {
    const c = target.getContext('2d'); c.clearRect(0, 0, target.width, target.height); if (!ready) return;
    const b = item.model.bounds, d = item.model.draw, scale = Math.min(target.width / (b.right - b.left + 45), target.height / (b.bottom - b.top + 25));
    c.save(); c.translate(target.width / 2, target.height / 2); c.scale(scale, scale); c.translate(-(b.left + b.right) / 2, -(b.top + b.bottom) / 2);
    c.shadowColor = '#69552c2a'; c.shadowBlur = 12; c.shadowOffsetY = 7; c.drawImage(images[item.id + '-final'], d.x, d.y, d.width, d.height); c.restore();
  }
  function ink(points, set, width = 1.7) {
    ctx.save(); ctx.lineCap = ctx.lineJoin = 'round'; ctx.lineWidth = width; ctx.strokeStyle = '#785236';
    for (let i = 1; i < points.length; i++) if (set.has(i - 1) && set.has(i)) { line(ctx, [points[i - 1], points[i]]); ctx.stroke(); }
    ctx.restore();
  }
  /* 切片框线：已切＝红实线，未切＝红虚线，下垫米白细线保证在石皮与玉面上都看得清 */
  function plateEdge(e, cut, active) {
    const u = 1 / Math.max(1, view().zoom / 1.4);
    const draw = (width, dash, color) => {
      ctx.setLineDash(dash.map(d => d * u)); ctx.lineWidth = width * u; ctx.strokeStyle = color;
      line(ctx, [e.a, e.b]); ctx.stroke();
    };
    ctx.save(); ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    draw(cut ? 4.6 : 5.2, [], '#fdf6e8c9');
    draw(cut ? 2.6 : 2.2, cut ? [] : [7, 5], cut ? '#a8322a' : '#e04b3f');
    if (active) draw(0.9, [], '#f7b3a6');
    ctx.restore();
  }
  function guideLine(points, active = false) {
    ctx.save(); ctx.lineCap = ctx.lineJoin = 'round'; ctx.setLineDash(active ? [4, 5] : [3, 6]);
    ctx.strokeStyle = active ? '#497063d9' : '#71654471'; ctx.lineWidth = (active ? 1.5 : 1) / Math.max(1, view().zoom / 1.4);
    line(ctx, points); ctx.stroke();
    if (active && hints) {
      const p = points[0]; ctx.setLineDash([]); ctx.beginPath(); ctx.arc(p.x, p.y, 3.7 / Math.max(1, view().zoom / 1.4), 0, Math.PI * 2); ctx.fillStyle = '#f4e4ae'; ctx.fill(); ctx.stroke();
    }
    ctx.restore();
  }
  function drawGuides() {
    const s = game.state, cs = game.cutter.state;
    if (s.status === 'complete') return;
    if (s.phase === 1 && !s.sliced) {
      const next = game.nextEdge();
      for (const e of game.plateEdges()) plateEdge(e, e.cut, hints && !e.cut && e.i === next.i);
      return;
    }
    if (s.phase === 2) { if (hints) guideLine(W.OUTLINE, true); ink(game.outlinePoints, s.outline); }
    if (s.phase === 3) {
      ctx.save(); ctx.strokeStyle = '#785236b0'; ctx.lineWidth = 1.5; line(ctx, W.OUTLINE); ctx.stroke(); ctx.restore();
      if (hints) for (const g of E.GUIDES) if ((game.preview(g).removed?.length || 0) > 20) guideLine(g, true);
    }
    if (s.phase === 4) {
      s.sketches.forEach((set, i) => ink(game.sketchPoints[i], set, 1.25));
      if (hints) guideLine(W.SKETCHES[s.sketchIndex].points, true);
    }
    if (s.phase === 5) {
      W.SKETCHES.forEach((d, i) => {
        const n = E.OPENINGS.length;
        if ((i < n && (cs.stage > 1 || i < cs.substage)) || (i >= n && cs.details.includes(i - n))) return;
        ctx.save(); ctx.strokeStyle = '#785236b0'; ctx.lineWidth = 1.1; line(ctx, d.points); ctx.stroke(); ctx.restore();
      });
      if (hints) guideLine(game.guide(), true);
    }
  }
  function schedule() { if (!raf) raf = requestAnimationFrame(render); }
  function render(time) {
    raf = 0; if (!game) return;
    ctx.setTransform(canvas.width / 600, 0, 0, canvas.height / 600, 0, 0); ctx.clearRect(0, 0, 600, 600);
    ctx.save(); ctx.strokeStyle = '#a6b79524'; ctx.lineWidth = .7;
    for (let i = 75; i <= 525; i += 50) { ctx.beginPath(); ctx.moveTo(i, 45); ctx.lineTo(i, 540); ctx.moveTo(45, i); ctx.lineTo(540, i); ctx.stroke(); }
    ctx.restore(); const camera = view(); ctx.translate(300, 300); ctx.scale(camera.zoom, camera.zoom); ctx.translate(-camera.x, -camera.y);
    const key = `${session}:${game.state.version}:${game.state.phase}:${game.cutter.state.version}:${ready}`;
    if (key !== surfaceKey) { surface = makeSurface(); surfaceKey = key; }
    ctx.save(); ctx.shadowColor = '#6550362a'; ctx.shadowBlur = 14 / camera.zoom; ctx.shadowOffsetY = 7 / camera.zoom;
    if ((game.state.phase >= 1 && game.state.phase <= 3 && (game.state.sliced || game.state.phase > 1)) || (active.procedural && game.state.phase >= 4 && game.state.phase <= 6)) {
      ctx.save(); ctx.globalAlpha = .48; ctx.filter = 'brightness(.62)';
      const depth = game.state.dimensions.thickness * .48; ctx.translate(depth, depth * .65); ctx.drawImage(surface, 0, 0); ctx.restore();
    }
    ctx.drawImage(surface, 0, 0); ctx.restore();
    drawGuides();
    if (dragging && preview?.removed) {
      const mask = new Uint8Array(E.RES * E.RES); preview.removed.forEach(i => mask[i] = 1);
      ctx.save(); ctx.globalAlpha = .25; const m = layer(), mc = m.getContext('2d'); mc.drawImage(maskCanvas(mask), 0, 0); mc.globalCompositeOperation = 'source-in'; mc.fillStyle = preview.safe ? '#fff0b4' : '#be674e'; mc.fillRect(0, 0, 600, 600); ctx.drawImage(m, 0, 0); ctx.restore();
    }
    if (dragging && path.length && ![0, 6, 7].includes(strokePhase)) {
      const p = strokePhase === 3 || strokePhase === 1 ? [path[0], path[path.length - 1]] : path;
      ctx.save(); ctx.strokeStyle = preview?.safe === false ? '#ac5642' : '#e6c575'; ctx.lineCap = ctx.lineJoin = 'round'; ctx.lineWidth = 2 / Math.max(1, camera.zoom / 1.5); line(ctx, p); ctx.stroke(); ctx.restore();
    }
    drawParticles(time);
    if (hover && game.state.status === 'playing') {
      ctx.save(); const brushing = [0, 6, 7].includes(game.state.phase);
      ctx.strokeStyle = brushing ? '#fcf3d9cf' : '#f5e4accc'; ctx.lineWidth = 1 / camera.zoom;
      ctx.beginPath(); ctx.arc(hover.x, hover.y, brushing ? 32 : 5 / camera.zoom, 0, Math.PI * 2); ctx.stroke(); ctx.restore();
    }
    if (game.state.status === 'failed') {
      const p = game.state.failedPath[Math.floor(game.state.failedPath.length / 2)] || { x: 270, y: 270 };
      ctx.save(); ctx.strokeStyle = '#f7eedc'; ctx.lineWidth = 3; line(ctx, [{ x: p.x - 40, y: p.y - 110 }, { x: p.x + 5, y: p.y - 50 }, { x: p.x - 20, y: p.y - 20 }, p, { x: p.x - 8, y: p.y + 40 }, { x: p.x + 35, y: p.y + 100 }]); ctx.stroke(); ctx.restore();
    }
    if (referencePhase && active.procedural) { const t = $('target-canvas'), tc = t.getContext('2d'); tc.clearRect(0, 0, t.width, t.height); tc.drawImage(canvas, 0, 0, t.width, t.height); }
    if (chips.length || dragging) schedule();
  }
  function feedback(result, oldPhase) {
    if (result.kind === 'ignored') { updateUI(); return; }
    if (result.kind === 'invalid') { toast(result.reason); updateUI(); return; }
    surfaceKey = '';
    if (!reduced) {
      if (result.removed?.length) for (let n = 0; n < 32; n++) {
        const p = E.position(result.removed[(Math.random() * result.removed.length) | 0]);
        push({ kind: 'crumb', x: p.x, y: p.y, vx: rnd(86, -86), vy: rnd(24, -74), g: 330,
          size: rnd(4.6, 1.7), color: game.level.color[n % 3], life: rnd(740, 470),
          rot: rnd(TAU), spin: rnd(13, -13), alpha: .92 });
      }
      // 切下那一瞬：沿整条锯口补一发，屑成串从切口落下
      if (oldPhase === 1 && result.kind === 'sliced') {
        const g = game.guide();
        for (let n = 0; n < 22; n++) { const k = Math.random(); emitSlice({ x: g[0].x + (g[1].x - g[0].x) * k, y: g[0].y + (g[1].y - g[0].y) * k }); }
      }
      // 磨完最后一把：残留的粉顺着原石边缘再飘一层
      if (oldPhase === 0 && result.kind === 'advance' && A.raw?.points) {
        for (let n = 0; n < 14; n++) emitGrind(A.raw.points[(Math.random() * A.raw.points.length) | 0]);
      }
    }
    $('live-cut').classList.remove('danger');
    $('live-cut').textContent = result.kind === 'failed' ? '这一刀留了痕 · 可以补救' : result.kind === 'complete' ? '温润成器 · 已收入图鉴' : result.kind === 'cut' ? (result.cuts ? `${result.name}已切 · ${result.cuts} / 4 刀` : '这一刀已落下 · 可以撤回') : result.kind === 'paint' ? '这一笔已留下 · 可以撤回' : '这一笔已完成 · 可以撤回';
    if (result.kind === 'failed' || result.kind === 'complete') {
      if (result.kind === 'failed') runFlaws++;
      sound(result.kind); haptic(result.kind === 'failed' ? [40, 60, 40] : [30, 60, 30, 60, 45]); finishedAt = Date.now();
      if (result.kind === 'complete') saveCompletion();
      const token = session; clearTimeout(resultTimer);
      resultTimer = setTimeout(() => { if (session === token && game.state.status === (result.kind === 'failed' ? 'failed' : 'complete')) showResult(); }, reduced ? 0 : 420);
    } else if (result.kind === 'advance' || result.kind === 'sliced') {
      sound('advance'); haptic(35); const name = game.state.phase !== oldPhase ? W.PHASES[oldPhase] + '完成' : result.kind === 'sliced' ? '玉板已切出' : '这一笔完成';
      $('stage-flash').querySelector('span').textContent = name; $('stage-flash').classList.add('show');
      clearTimeout(flashTimer); flashTimer = setTimeout(() => { $('stage-flash').classList.remove('show'); $('stage-flash').querySelector('span').textContent = ''; }, reduced ? 10 : 650);
    } else if (['cut', 'detail'].includes(result.kind)) { sound('cut'); haptic(30); }
    else if (result.kind === 'paint') { sound('paint'); haptic(24); }
    updateUI();
    if (result.kind === 'sliced') setTimeout(() => {
      const pc = $('plate-controls');
      if (!pc || pc.hidden) return;
      pc.scrollIntoView({ block: 'center', behavior: 'smooth' });
      pc.classList.add('attention');
      setTimeout(() => pc.classList.remove('attention'), 2400);
    }, 280);
    if (result.kind === 'advance' || result.kind === 'sliced') requestAnimationFrame(() => {
      if (matchMedia('(max-width: 950px)').matches) scrollUnderBar(canvas.closest('.workbench'));
      else canvas.scrollIntoView({ block: 'center', behavior: 'instant' });
    });
  }
  function point(event) {
    const r = canvas.getBoundingClientRect(), v = view();
    return { x: ((event.clientX - r.left) * 600 / r.width - 300) / v.zoom + v.x, y: ((event.clientY - r.top) * 600 / r.height - 300) / v.zoom + v.y };
  }
  /* 磁吸：描形/画细节时，手指进入 18px（桌面 9px）内就吸附到最近的引导点。
     这样手机上不用 2px 级精度，正常速度描过去就能推进；同时光标会贴着线走。 */
  function guidePoints() {
    const key = `${game.state.phase}:${game.state.sketchIndex || 0}`;
    if (guideCache.key !== key) guideCache = { key, pts: game.guide() || [] };
    return guideCache.pts;
  }
  function snapPoint(p) {
    if (!game || ![2, 4].includes(game.state.phase)) return p;
    const r = canvas.getBoundingClientRect();
    if (!r.width) return p;
    const snapCss = TOUCH ? 18 : 9;
    const world = snapCss * 600 / (r.width * Math.max(.2, view().zoom));
    let best = p, bd = world;
    for (const g of guidePoints()) {
      const d = E.distance(g, p);
      if (d < bd) { bd = d; best = g; }
    }
    return best;
  }
  function clearStroke() {
    const pointer = captured; captured = null; dragging = false;
    if (pointer !== null && canvas.hasPointerCapture(pointer)) canvas.releasePointerCapture(pointer);
    path = []; preview = null; updateUI();
  }
  function cancelStroke() { game.cancel(); clearStroke(); surfaceKey = ''; $('live-cut').textContent = '这一笔已取消'; schedule(); }
  function updatePreview() {
    if (![3, 5].includes(strokePhase) || path.length < 2) return;
    preview = game.preview(path); $('live-cut').classList.toggle('danger', !preview.safe);
    $('live-cut').textContent = !preview.safe ? '小心，这一刀会伤玉 · 松手前可按 Esc 取消' : '松手落刀 · 切后也可以撤回';
  }
  canvas.addEventListener('pointerdown', event => {
    if (!ready || busy || dragging || game.state.status !== 'playing' || event.button !== 0) return;
    event.preventDefault(); canvas.focus({ preventScroll: true }); hideStepTip(); dragging = true; captured = event.pointerId; canvas.setPointerCapture(captured);
    strokePhase = game.state.phase; path = [snapPoint(point(event))]; hover = path[0]; preview = null;
    game.begin(); if ([0, 2, 4, 6, 7].includes(strokePhase)) game.paint(path); updateUI();
  });
  canvas.addEventListener('pointermove', event => {
    const p = snapPoint(point(event)); hover = p;
    if (dragging && event.pointerId === captured && E.distance(path[path.length - 1], p) > 1) {
      const previous = path[path.length - 1]; path.push(p);
      emitMotion(strokePhase, previous, p);
      strokeAudio(strokePhase, previous, p);
      if ([0, 2, 4, 6, 7].includes(strokePhase)) { game.paint([previous, p]); updateUI(); }
      else if (performance.now() - lastPreview > 60) { lastPreview = performance.now(); updatePreview(); }
    }
    schedule();
  });
  canvas.addEventListener('pointerup', event => {
    if (!dragging || event.pointerId !== captured) return;
    const p = snapPoint(point(event)), last = path[path.length - 1]; path.push(p);
    const brush = [0, 2, 4, 6, 7].includes(strokePhase), phase = strokePhase;
    let result;
    if (brush) { game.paint([last, p]); result = game.end(); }
    else result = game.stroke(path);
    clearStroke(); feedback(result, phase);
  });
  canvas.addEventListener('pointercancel', () => { if (dragging && !busy) cancelStroke(); });
  canvas.addEventListener('lostpointercapture', () => { if (dragging && !busy) cancelStroke(); });
  canvas.addEventListener('pointerleave', () => { if (!dragging) { hover = null; schedule(); } });
  function demonstrate() {
    if (busy || dragging || !ready || game.state.status !== 'playing') return;
    hideStepTip();
    const phase = game.state.phase, token = session, guide = E.resample(game.guide(), 5);
    const brush = [0, 2, 4, 6, 7].includes(phase);
    busy = dragging = true; strokePhase = phase; path = [guide[0]]; game.begin();
    canvas.scrollIntoView({ block: 'center', behavior: 'instant' }); updateUI();
    const start = performance.now(), duration = reduced ? 1 : brush && phase !== 2 && phase !== 4 ? 1800 : Math.min(1700, Math.max(650, guide.length * 9));
    let painted = 0, emitted = 0;
    /* 看门狗：只在「真的没有帧再推进」时兜底复位。
       录制、后台标签、掉帧会让 rAF 变慢，但帧还在走，这时不能打断示范——
       否则示范被反复中止，这一刀永远落不下来。 */
    clearInterval(demoTimer);
    demoTickAt = performance.now();
    demoTimer = setInterval(() => {
      if (token !== session || !busy) { clearInterval(demoTimer); return; }
      if (performance.now() - demoTickAt < 3200) return;
      clearInterval(demoTimer);
      busy = dragging = false; path = []; preview = null; demoFrame = 0;
      try { game.cancel?.(); } catch (_) { /* 状态由 updateUI 重新同步 */ }
      updateUI();
    }, 800);
    function tick(time) {
      if (token !== session) return;
      demoTickAt = performance.now();
      const t = Math.min(1, (time - start) / duration), n = Math.max(1, Math.ceil(guide.length * t));
      path = guide.slice(0, n); hover = path[path.length - 1];
      if (n > emitted) { if (emitted > 0) { emitMotion(phase, guide[emitted - 1], guide[n - 1]); strokeAudio(phase, guide[emitted - 1], guide[n - 1]); } emitted = n; }
      if (brush && n > painted) { game.paint(guide.slice(Math.max(0, painted - 1), n)); painted = n; updateUI(); }
      else if (time - lastPreview > 80) { lastPreview = time; updatePreview(); }
      schedule();
      if (t < 1) demoFrame = requestAnimationFrame(tick);
      else {
        clearInterval(demoTimer);
        const result = brush ? game.end({ assisted: true }) : game.stroke(guide, { assisted: true });
        busy = dragging = false; path = []; preview = null; demoFrame = 0; feedback(result, phase);
      }
    }
    demoFrame = requestAnimationFrame(tick);
  }
  function undo() {
    if (busy) return;
    if (dragging) cancelStroke();
    if (!game.undo()) { toast('还没有可以撤回的操作。'); return; }
    session++; clearTimeout(resultTimer); clearTimeout(flashTimer); $('stage-flash').classList.remove('show');
    for (const dialog of document.querySelectorAll('dialog[open]')) dialog.close();
    surfaceKey = ''; chips = []; emitAcc = 0; hover = null; $('live-cut').textContent = '已回到上一次操作之前'; $('live-cut').classList.remove('danger'); updateUI();
    canvas.scrollIntoView({ block: 'center', behavior: 'instant' }); toast('已撤回上一步，可以继续。');
  }
  function stars() {
    if (practiceMode) return 0;
    if (firstCompletion) return 3;
    const extra = game.cutter.state.totalCuts > 4 + E.OPENINGS.length + E.DETAILS.length;
    if (game.state.assist > 8) return 1;
    if (game.state.assist > 0 || extra) return 2;
    return 3;
  }
  function saveCompletion() {
    if (practiceMode) return;
    const key = recordKey(), old = save.records[key], elapsed = Math.max(1, Math.round((finishedAt - startedAt) / 1000));
    save.records[key] = { stars: Math.max(Number(old?.stars) || 0, stars()), cuts: Math.min(Number(old?.cuts) || Infinity, game.cutter.state.totalCuts + 1), seconds: Math.min(Number(old?.seconds) || Infinity, elapsed), thickness: game.state.dimensions.thickness };
    persist();
  }
  /* ————————————— 成器庆祝 —————————————
     成功弹窗的收尾：花瓣与光点从成品轮廓向外绽放、星级逐颗落下、朱印盖章。
     1.6s 内走完并静止；prefers-reduced-motion 时只给最终帧。失败分支不调用这里。 */
  function mountCelebration() {
    if (document.querySelector('link[data-result-celebration]')) return;
    const link = document.createElement('link');
    link.rel = 'stylesheet'; link.href = 'result-celebration.css';
    link.setAttribute('data-result-celebration', '');
    document.head.appendChild(link);
  }
  function celebrateSuccess(art) {
    /* 把成品画布包进一个定位容器，庆祝层挂在它上面，不改变 .result-art 自身的样式与尺寸 */
    const stage = document.createElement('div');
    stage.className = 'result-stage';
    art.replaceWith(stage); stage.appendChild(art);
    const seal = document.createElement('span');
    seal.className = 'result-seal'; seal.setAttribute('aria-hidden', 'true'); seal.textContent = '成器';
    stage.appendChild(seal);
    /* 星级逐颗落下：把 '★★☆' 拆成逐字 span，间隔 120ms */
    const stars = $('result-stars'), text = stars.textContent || '';
    if (!reduced && /^[★☆]+$/.test(text)) {
      stars.textContent = '';
      for (const [i, ch] of [...text].entries()) {
        const span = document.createElement('span');
        span.className = 'rc-star' + (ch === '☆' ? ' empty' : '');
        span.textContent = ch; span.style.animationDelay = (i * 120) + 'ms';
        stars.appendChild(span);
      }
    }
    if (reduced) return;
    const burst = document.createElement('div');
    burst.className = 'result-celebration';
    const cv = document.createElement('canvas'), W = 340, H = 316, dpr = Math.min(2, window.devicePixelRatio || 1);
    cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr);
    cv.setAttribute('aria-hidden', 'true');
    burst.appendChild(cv); stage.appendChild(burst);
    playBurst(cv.getContext('2d'), W, H, dpr, burst);
  }
  /* 绽放：每片花瓣按编号错开一点起手，向外推到最大半径时淡出；
     光点从底部缓缓浮起，收在一层很淡的金色外扩环里。 */
  function playBurst(c, W, H, dpr, holder) {
    c.setTransform(dpr, 0, 0, dpr, 0, 0);
    const colors = ['#DFD9BA', '#CBCFA6', '#A9843F', '#9D2B25', '#e6d9a5'];
    const cx = W / 2, cy = H * .46, petals = [], motes = [], rings = [];
    for (let i = 0; i < 30; i++) {
      petals.push({
        a: i / 30 * TAU + rnd(.2, -.2), r0: rnd(58, 40), r1: rnd(128, 92),
        delay: (i % 6) * .035 + rnd(.08, 0), size: rnd(9.5, 5), spin: rnd(2.2, -2.2),
        color: colors[i % colors.length], alpha: rnd(.92, .5)
      });
    }
    for (let i = 0; i < 46; i++) {
      motes.push({ x: rnd(W * .92, W * .08), y: rnd(H * .95, H * .45), r: rnd(2.1, .7),
        vy: rnd(30, 10), drift: rnd(14, -14), delay: rnd(.55, 0), color: colors[(i * 3) % colors.length] });
    }
    for (const d of [0, .1]) rings.push({ delay: d });
    bloomShimmer();
    const t0 = performance.now();
    function frame(now) {
      const t = (now - t0) / 1000;
      c.clearRect(0, 0, W, H);
      /* 外扩环：两道很淡的金线，把「开」的边界说出来 */
      for (const ring of rings) {
        const u = (t - ring.delay) / .8;
        if (u <= 0 || u >= 1) continue;
        c.beginPath(); c.arc(cx, cy, 40 + u * 96, 0, TAU);
        c.strokeStyle = `rgba(169,132,63,${(.3 * (1 - u)).toFixed(3)})`;
        c.lineWidth = 1.4 * (1 - u) + .3; c.stroke();
      }
      for (const p of petals) {
        const u = (t - p.delay) / .95;
        if (u <= 0 || u >= 1) continue;
        const e = 1 - Math.pow(1 - u, 2.4), r = p.r0 + (p.r1 - p.r0) * e;
        const alpha = p.alpha * (u < .16 ? u / .16 : 1 - (u - .16) / .84);
        const x = cx + Math.cos(p.a) * r, y = cy + Math.sin(p.a) * r * .92;
        const size = p.size * (u < .3 ? .55 + u * 1.5 : 1);
        c.save(); c.globalAlpha = Math.max(0, alpha);
        c.translate(x, y); c.rotate(p.a + p.spin * u);
        c.beginPath();
        c.ellipse(0, 0, size * 1.45, size * .62, 0, 0, TAU);
        c.fillStyle = p.color; c.fill();
        c.restore();
      }
      for (const m of motes) {
        const u = (t - m.delay) / 1.05;
        if (u <= 0 || u >= 1) continue;
        const alpha = Math.sin(Math.PI * u) * .82;
        c.beginPath();
        c.arc(m.x + m.drift * u, m.y - m.vy * u, m.r * (1 - u * .35), 0, TAU);
        c.fillStyle = m.color; c.globalAlpha = alpha; c.fill();
      }
      c.globalAlpha = 1;
      if (t < 1.62) requestAnimationFrame(frame);
      else { c.clearRect(0, 0, W, H); holder.remove(); }
    }
    requestAnimationFrame(frame);
  }
  /* 动画起点的一声极轻泛音：让「花开」和声音落在同一拍上。
     这里只做「有就用」，绝不在手势之外新建 AudioContext（iOS 上那样建出来的会永久 suspended）。 */
  function bloomShimmer() {
    if (!save.sound || !audioContext || audioContext.state !== 'running') return;
    playTone([1318.51, 1760], 'sine', .038, 1.1, .09);
  }
  function showResult() {
    const dialog = $('result-dialog'), failed = game.state.status === 'failed'; dialog.classList.toggle('failed', failed);
    if (failed) {
      $('result-content').innerHTML = '<div class="eyebrow">A MARK, NOT A FAILURE</div><h2>这一刀留下了痕。</h2><p class="result-description" id="failure-reason"></p><p class="result-description">可以退回到落刀前补一刀；也可以换一块料重来。补过的痕迹会留在这一件上。</p><button class="primary-button" id="undo-result">补救 · 回到落刀前</button><button class="text-button" id="retry-result">换一块料，重新开始</button><button class="text-button" id="review-result">看看刚才的刀痕</button>';
      $('failure-reason').textContent = (game.state.reason || '').replace(/玉料开裂，请重新开料。?/, '玉料上留下了一道裂痕。');
      $('undo-result').addEventListener('click', () => { undo(); toast('已补救：回到落刀前，石痕留在这一件上。'); }); $('retry-result').addEventListener('click', () => startLevel(game.state.levelIndex)); $('review-result').addEventListener('click', () => dialog.close());
    } else {
      const practice = practiceMode;
      const notes = [];
      if (practice) notes.push('练习模式 · 本次不计入图鉴，可以随时重来。');
      else if (firstCompletion) notes.push('首次完成 · 不扣提示星，已收入图鉴。');
      if (runFlaws) notes.push(`石痕 ×${runFlaws} · 这一件留着你补过的痕迹。`);
      const note = notes.join(' ');
      const actions = practice
        ? '<button class="primary-button" id="collect-result">再练一次</button><button class="text-button" id="next-result">换一档难度</button><button class="text-button" id="review-result">回到工坊，看看这一件</button>'
        : '<button class="primary-button" id="collect-result">已收入图鉴 · 去看看</button><button class="text-button" id="next-result">再试一方玉 · 下一档难度</button><button class="text-button" id="review-result">回到工坊，欣赏成品</button>';
      $('result-content').innerHTML = '<div class="eyebrow">FROM YOUR HANDS, A JADE IS BORN</div><h2>慢慢琢，终于成器。</h2><canvas class="result-art" id="result-art" width="480" height="430"></canvas><div class="result-stars" id="result-stars"></div><p class="result-description" id="success-description"></p><p class="result-note" id="result-note" hidden></p><div class="result-stats"><div><strong id="result-cuts"></strong><span>切片与雕琢</span></div><div><strong id="result-time"></strong><span>手作用时</span></div><div><strong id="result-assisted"></strong><span>提示次数</span></div></div>' + actions;
      drawArtifact($('result-art'));
      if (runFlaws) {
        const rc = $('result-art').getContext('2d');
        rc.save(); rc.strokeStyle = 'rgba(104,74,48,.42)'; rc.lineWidth = 1.1;
        for (let i = 0; i < Math.min(3, runFlaws); i++) {
          const x = 228 + i * 18, y = 186 + i * 15;
          rc.beginPath(); rc.moveTo(x - 14, y - 8); rc.lineTo(x + 14, y + 9); rc.stroke();
        }
        rc.restore();
      }
      if (practice) {
        $('result-stars').textContent = '练习完成 · 不计星';
        $('result-stars').classList.add('practice');
      } else {
        $('result-stars').textContent = starsText(stars()) + '☆'.repeat(3 - stars());
        $('result-stars').classList.remove('practice');
      }
      if (note) { $('result-note').hidden = false; $('result-note').textContent = note; }
      $('success-description').textContent = `${active.name} · ${active.material}。从磨皮到抛光，八道工序已完成，厚度比例 ${game.state.dimensions.thickness}。`;
      $('result-cuts').textContent = game.cutter.state.totalCuts + 1 + ' 刀'; $('result-time').textContent = Math.max(1, Math.round((finishedAt - startedAt) / 1000)) + ' 秒'; $('result-assisted').textContent = game.state.assist + ' 次';
      /* 收尾动画放在数据填完之后：先有静态成品与星级，再让它们「开」出来 */
      celebrateSuccess($('result-art'));
      $('collect-result').addEventListener('click', () => {
        if (practice) { startLevel(game.state.levelIndex, true); return; }
        dialog.close(); openCollection();
      });
      $('next-result').addEventListener('click', () => startLevel((game.state.levelIndex + 1) % E.LEVELS.length, practiceMode));
      $('review-result').addEventListener('click', () => dialog.close());
    }
    dialog.showModal();
  }
  function openLevels() {
    $('level-list').replaceChildren();
    E.LEVELS.forEach((level, index) => {
      const button = document.createElement('button'); button.className = 'level-choice' + (index === game.state.levelIndex ? ' selected' : '');
      button.innerHTML = `<span class="choice-num">${numerals[index]}</span><span><strong>${level.name}</strong><small>粗切 ${level.budgets[0]} 刀 · 开孔 ${level.budgets[1]} 刀 · 琢纹 ${level.budgets[2]} 刀</small></span><span class="choice-stars"></span>`;
      const record = save.records[recordKey(active.id, index)]; button.querySelector('.choice-stars').textContent = record ? starsText(record.stars) : '未琢';
      button.addEventListener('click', () => startLevel(index, $('practice-toggle').checked)); $('level-list').append(button);
    }); $('practice-toggle').checked = practiceMode; $('level-dialog').showModal();
  }
  function openCollection() {
    $('collection-grid').replaceChildren();
    catalogue.forEach(artifact => {
      const records = E.LEVELS.map((_, i) => save.records[recordKey(artifact.id, i)]).filter(Boolean);
      const record = records.sort((a, b) => (Number(b.stars) || 0) - (Number(a.stars) || 0))[0], item = document.createElement('article'); item.className = 'collection-item' + (record ? '' : ' empty');
      item.innerHTML = '<canvas width="320" height="280" aria-label="玉猪龙成品"></canvas><h3></h3><div class="stars"></div><p></p>';
      item.querySelector('h3').textContent = artifact.name; item.querySelector('.stars').textContent = record ? starsText(record.stars) : '· · ·';
      item.querySelector('p').textContent = record ? `${artifact.material} · 已完成 ${records.length} 档难度` : artifact.material + ' · 等待你亲手完成';
      $('collection-grid').append(item); drawArtifact(item.querySelector('canvas'), artifact);
    }); $('collection-dialog').showModal();
  }
  /* ————————————— 移动端引导条 —————————————
     层级只有一个主提示：我在哪（进度轨）→ 做什么（spec.message）→ 怎么做（spec.gesture）。
     桌面端这层 display:none，三栏布局不受影响。 */
  let mgOpen = false;
  function buildRail() {
    const rail = $('mg-rail'); if (!rail || rail.children.length) return;
    for (let i = 0; i < 8; i++) rail.append(document.createElement('i'));
  }
  function setMgOpen(open) {
    mgOpen = !!open;
    $('mg-main').setAttribute('aria-expanded', String(mgOpen));
    $('mg-detail').hidden = !mgOpen;
  }
  /* ————————————— 每步起手引导 —————————————
     ① 画布上的起点脉冲 + 方向箭头，回答「从哪个位置按下、往哪个方向滑」；
     ② 每步第一次进入时弹三行说明卡，回答「从哪起、怎么走、怎样算完成」。 */
  const TIP_KEY = 'yujian-steptips-v1';
  let tipsSeen = [], tipTimer = 0, tipPhase = -1, coachPending = false, cueAnchor = null;
  try { const raw = JSON.parse(localStorage.getItem(TIP_KEY) || '[]'); if (Array.isArray(raw)) tipsSeen = raw.filter(n => Number.isInteger(n)); } catch (_) { /* 隐私模式下不记忆 */ }
  const tipText = [
    ['在玉料任意位置按住', '横向来回拖动，像擦桌子一样', '石皮褪到 97%，自动进入切板'],
    ['从红点按住', '沿虚线划到另一端再松手，一刀只切一条边', '上、右、下、左共 4 刀，切完才能取板'],
    ['从红点起笔', '沿虚线描一整圈，中途松手也没关系', '描到 94%，自动进入粗切'],
    ['从红点起笔', '朝亮起的方向直线划过，一刀切掉这块余料', '四角都去净，自动进入画细节'],
    ['从红点起笔', '一笔描一段墨线，细处会自动放大', '六个部位都描完，才轮到下刀'],
    ['沿已经画好的墨线', '从一端划到另一端，开孔要画闭合圈', '松手才落刀，画错的可以撤回'],
    ['从红点按住', '打圈擦过整面，边角和刀痕也要带到', '覆盖满，自动进入抛光'],
    ['从红点按住', '整面来回拂拭，不要停在一点', '覆盖满即成器，自动收入图鉴']
  ];
  function markTipSeen(i) {
    if (tipsSeen.includes(i)) return;
    tipsSeen.push(i);
    try { localStorage.setItem(TIP_KEY, JSON.stringify(tipsSeen)); } catch (_) { /* 隐私模式下不记忆 */ }
  }
  function fillTip() {
    const i = game.state.phase, t = tipText[i] || tipText[0];
    $('tip-kicker').textContent = `第${words[i]}步 · ${W.PHASES[i]}`;
    $('tip-start').textContent = t[0];
    $('tip-move').textContent = t[1];
    $('tip-done').textContent = i === 4 ? t[2].replace('六个部位', `${W.SKETCHES.length} 个部位`) : t[2];
  }
  function hideStepTip(mark = true) {
    if ($('step-tip').hidden) return;
    $('step-tip').hidden = true; $('tip-help').setAttribute('aria-expanded', 'false');
    clearTimeout(tipTimer);
    if (mark && game) markTipSeen(game.state.phase);
    placeCue();
  }
  function showStepTip(force) {
    if (!ready || !game || game.state.status !== 'playing') return;
    if (document.body.dataset.view !== 'workshop') return;
    if (coachPending || !$('coach').hidden) return;
    if (!force && matchMedia('(max-width:700px)').matches) return;
    if (!force && tipsSeen.includes(game.state.phase)) return;
    fillTip();
    $('step-tip').hidden = false; $('tip-help').setAttribute('aria-expanded', 'true');
    placeCue();
    clearTimeout(tipTimer); tipTimer = setTimeout(() => hideStepTip(), 16000);
  }
  /* 起点脉冲：位置与方向都由当前工序的引导线推出来，八道工序共用一套 */
  function placeCue() {
    const el = $('start-cue'); if (!el) return;
    const s = game && game.state;
    if (!ready || !hints || !s || s.status !== 'playing' || dragging || busy || !$('step-tip').hidden) { el.hidden = true; return; }
    if (game.progress() > .015) { el.hidden = true; return; }
    const g = game.guide(); if (!g || g.length < 2) { el.hidden = true; return; }
    let p0 = g[0], far = null, farD = 0;
    /* 粗切是一条斜线：视觉上应从靠左上的那一端起手，而不是固定取 guide[0]。
       否则右侧的“从这里起手”会落在料框右缘，和左上角的器形/文字对不上。 */
    if (s.phase === 3 && g.length === 2) {
      const a = g[0], b = g[1];
      p0 = (a.x + a.y <= b.x + b.y) ? a : b;
      far = (p0 === a) ? b : a;
      farD = Math.hypot(far.x - p0.x, far.y - p0.y);
    }
    /* 取「沿引导线走一段」的方向，而不是取最远的点，避免箭头斜飘 */
    if (!far) {
      for (let i = 1; i < Math.min(9, g.length); i++) {
        const d = Math.hypot(g[i].x - p0.x, g[i].y - p0.y);
        if (d >= 24) { far = g[i]; farD = d; break; }
      }
    }
    if (!far) { const last = g[Math.min(8, g.length - 1)]; far = last; farD = Math.hypot(last.x - p0.x, last.y - p0.y); }
    if (!far || farD < 6) { el.hidden = true; return; }
    /* 磨皮这一步整块料都能擦，把起手点吸附到玉料本体上，别浮在空画布上 */
    let anchor = p0;
    const surface = s.phase === 0 ? A.raw?.points : s.phase >= 6 ? game.brushPoints : null;
    if (surface?.length) {
      if (!cueAnchor) {
        let best = null, score = Infinity;
        for (const p of surface) { const v = p.x + p.y; if (v < score) { score = v; best = p; } }
        cueAnchor = best || p0;
      }
      anchor = cueAnchor;
    }
    const v = view(), sx = (anchor.x - v.x) * v.zoom + 300, sy = (anchor.y - v.y) * v.zoom + 300;
    if (sx < 24 || sx > 576 || sy < 24 || sy > 576) { el.hidden = true; return; }
    el.hidden = false;
    /* 起手点要落在画布上，而不是画布外套的框上：
       矮屏/手机时 #canvas-wrap 比正方形画布宽（两侧留白），
       用百分比定位会把起手点整体推到左边，和虚线起点对不上。 */
    const wrap = $('canvas-wrap'), cv = $('jade-canvas');
    const wr = wrap.getBoundingClientRect(), cr = cv.getBoundingClientRect();
    const px = cr.left - wr.left + (sx / 600) * cr.width;
    const py = cr.top - wr.top + (sy / 600) * cr.height;
    el.style.left = px.toFixed(1) + 'px'; el.style.top = py.toFixed(1) + 'px';
    el.style.setProperty('--cue-angle', (Math.atan2(far.y - p0.y, far.x - p0.x) * 180 / Math.PI).toFixed(1) + 'deg');
  }
  /* ————————————— 首次进入的三步气泡 —————————————
     只在移动端出现，只在工坊页出现；看过一次就不再打扰。 */
  const COACH_KEY = 'yujian-coach-v1';
  let coachSeen = false;
  try { coachSeen = localStorage.getItem(COACH_KEY) === '1'; } catch (_) { /* 隐私模式下不记忆 */ }
  const coachSteps = [
    { target: '#canvas-wrap', scroll: '.workbench', title: '这里就是玉料', text: '按住拖动，磨过、擦过的地方才会起变化。松手就算完成这一笔，不满意随时撤回。' },
    { target: '#mobile-guide', title: '看这一条就够了', text: '第几步、这一步要做什么、完成到多少，都写在这里。点这一条可以展开本步的详细解说。' },
    { target: '#undo-button', title: '做错不用重来', text: '撤回上一步，不影响星级。补过的石痕会留在这一件上，不会报废。' }
  ];
  let coachIndex = 0;
  function barOffset() {
    const bar = $('mobile-guide');
    return bar && bar.offsetParent ? bar.getBoundingClientRect().height + 10 : 0;
  }
  function scrollUnderBar(el) {
    const offset = barOffset();
    if (!offset) { el.scrollIntoView({ block: 'center', behavior: 'instant' }); return; }
    window.scrollTo({ top: Math.max(0, window.scrollY + el.getBoundingClientRect().top - offset), behavior: 'instant' });
  }
  function placeCoach() {
    const el = document.querySelector(coachSteps[coachIndex].target); if (!el) return;
    const r = el.getBoundingClientRect(), hole = $('coach-hole'), bubble = $('coach-bubble'), pad = 6;
    hole.style.top = (r.top - pad) + 'px'; hole.style.left = (r.left - pad) + 'px';
    hole.style.width = (r.width + pad * 2) + 'px'; hole.style.height = (r.height + pad * 2) + 'px';
    const bw = bubble.offsetWidth, bh = bubble.offsetHeight, gap = 14;
    const left = Math.min(Math.max(12, r.left + r.width / 2 - bw / 2), innerWidth - bw - 12);
    const minTop = barOffset();
    let top = r.bottom + gap;
    if (top + bh > innerHeight - 12) {
      const above = r.top - gap - bh;
      top = above >= minTop ? above : Math.max(minTop, innerHeight - bh - 12);
    }
    bubble.style.left = left + 'px'; bubble.style.top = Math.max(minTop, top) + 'px';
  }
  function showCoach(i) {
    coachIndex = i;
    const step = coachSteps[i], el = document.querySelector(step.target);
    if (!el) return finishCoach();
    if (step.target === '#mobile-guide') window.scrollTo({ top: 0, behavior: 'instant' });
    else scrollUnderBar(step.scroll ? document.querySelector(step.scroll) : el);
    $('coach').hidden = false;
    $('coach-kicker').textContent = `${i + 1} / ${coachSteps.length}`;
    $('coach-title').textContent = step.title; $('coach-text').textContent = step.text;
    $('coach-bubble').style.visibility = 'hidden';
    requestAnimationFrame(() => { placeCoach(); $('coach-bubble').style.visibility = 'visible'; $('coach-bubble').querySelector('[data-coach="next"]').focus({ preventScroll: true }); });
  }
  function finishCoach() {
    $('coach').hidden = true; coachSeen = true; coachPending = false;
    if (document.body.dataset.view === 'workshop') scrollUnderBar(canvas.closest('.workbench'));
    if (!matchMedia('(max-width:700px)').matches) setTimeout(() => showStepTip(true), 260);
    try { localStorage.setItem(COACH_KEY, '1'); } catch (_) { /* 隐私模式下不记忆 */ }
  }
  function maybeCoach() {
    if (coachSeen || !ready) return;
    if (!matchMedia('(max-width: 950px)').matches) return;
    coachPending = true;
    setTimeout(() => { if (!coachSeen && document.body.dataset.view === 'workshop') showCoach(0); else coachPending = false; }, 520);
  }
  function openArtifacts() {
    $('artifact-list').replaceChildren();
    catalogue.forEach(item => {
      const button = document.createElement('button'); button.className = 'artifact-choice' + (item.id === active.id ? ' selected' : '');
      button.setAttribute('aria-label', '选择' + item.name); button.innerHTML = '<img alt=""><span><strong></strong><small></small></span><i></i>';
      button.querySelector('img').src = item.model.image; button.querySelector('strong').textContent = item.name; button.querySelector('small').textContent = item.material;
      button.querySelector('i').textContent = item.id === active.id ? '当前' : '开始';
      button.addEventListener('click', () => { chooseArtifact(item.id); showWorkshop(); }); $('artifact-list').append(button);
    }); $('material-dialog').showModal();
  }
  function showHome(focus = true) {
    if (dragging && !busy) cancelStroke();
    $('home-screen').hidden = false; $('workshop-screen').hidden = true;
    document.body.dataset.view = 'home';
    $('home-button').setAttribute('aria-current', 'page'); $('choose-artifact-button').removeAttribute('aria-current');
    window.scrollTo({ top: 0, behavior: 'instant' });
    if (focus) $('home-button').focus({ preventScroll: true });
  }
  function showWorkshop() {
    workshopVisited = true;
    $('home-screen').hidden = true; $('workshop-screen').hidden = false;
    document.body.dataset.view = 'workshop';
    $('home-button').removeAttribute('aria-current'); $('choose-artifact-button').setAttribute('aria-current', 'page');
    if (matchMedia('(max-width: 950px)').matches) requestAnimationFrame(() => scrollUnderBar(canvas.closest('.workbench')));
    else window.scrollTo({ top: 0, behavior: 'instant' });
    canvas.focus({ preventScroll: true }); schedule();
    tipPhase = game.state.phase; setTimeout(() => showStepTip(false), 320);
    maybeCoach();
  }
  function fillHomeArtifacts() {
    const notes = ['观卷曲与留白', '观甲壳与对称', '观双目与羽纹', '观横纹与弧面', '观鱼形与穿孔'];
    $('home-artifact-list').replaceChildren();
    catalogue.forEach((item, index) => {
      const button = document.createElement('button'); button.className = 'home-artifact-choice';
      button.setAttribute('aria-label', '制作' + item.name); button.disabled = !ready;
      button.innerHTML = '<span class="artifact-number"></span><span class="artifact-visual"><img alt="" loading="lazy"></span><span class="artifact-name"></span><span class="artifact-observation"></span><span class="artifact-entry">开始玉作 <svg class="icon"><use href="#i-arrow"/></svg></span>';
      button.querySelector('.artifact-number').textContent = String(index + 1).padStart(2, '0');
      button.querySelector('img').src = item.model.image;
      button.querySelector('.artifact-name').textContent = item.name;
      button.querySelector('.artifact-observation').textContent = notes[index] || item.material;
      button.addEventListener('click', () => { chooseArtifact(item.id); showWorkshop(); });
      $('home-artifact-list').append(button);
    });
  }
  $('home-brand').addEventListener('click', e => { e.preventDefault(); showHome(false); });
  $('home-button').addEventListener('click', () => showHome(false)); $('back-home').addEventListener('click', () => showHome());
  $('start-journey').addEventListener('click', () => { $('forms-title').focus({ preventScroll: true }); $('forms').scrollIntoView({ block: 'start', behavior: reduced ? 'instant' : 'smooth' }); });
  for (const id of ['culture-button', 'culture-more']) $(id).addEventListener('click', () => $('culture-dialog').showModal());
  W.PHASES.forEach((name, i) => {
    const descriptions = ['不规整原石，磨去石皮', '四边各切一刀，取出素板', '只有外形，没有纹样', '去掉余料，留下毛胚', '孔位纹样，先落墨线', '沿线下刀，半雕渐成', '细磨刀痕，修整玉面', '拂去浮尘，温润成器'];
    const li = document.createElement('li'); li.className = 'step'; li.dataset.step = i;
    li.innerHTML = `<span class="step-index">${String(i + 1).padStart(2, '0')}</span><div><h2>${name}</h2><p>${descriptions[i]}</p></div><span class="step-state"></span>`; $('step-list').append(li);
  });
  $('hint-button').addEventListener('click', () => { hints = !hints; updateUI(); });
  const mgHintButton = $('mg-hint'); if (mgHintButton) mgHintButton.addEventListener('click', () => $('hint-button').click());
  $('target-help').addEventListener('click', () => {
    if (!ready) { toast('正在准备玉料与图样…'); return; }
    drawArtifact($('target-dialog-canvas'));
    $('target-dialog-name').textContent = active.name; $('target-dialog-material').textContent = active.material;
    $('target-dialog').showModal();
  });
  $('target-dialog-material').addEventListener('click', () => { $('target-dialog').close(); $('material-button').click(); });
  $('assist-button').addEventListener('click', () => {
    if (game.state.phase === 1 && game.state.sliced) {
      const pc = $('plate-controls');
      if (pc && !pc.hidden) {
        pc.scrollIntoView({ block: 'center', behavior: 'smooth' });
        pc.classList.add('attention');
        setTimeout(() => pc.classList.remove('attention'), 2000);
        $('plate-length').focus({ preventScroll: true });
      }
      return;
    }
    demonstrate();
  }); $('undo-button').addEventListener('click', undo);
  $('restart-button').addEventListener('click', () => startLevel(game.state.levelIndex));
  $('confirm-plate').addEventListener('click', () => feedback(game.confirmPlate(), 1));
  for (const key of ['length', 'width', 'thickness']) {
    $('plate-' + key).addEventListener('input', () => { $(key + '-output').textContent = $('plate-' + key).value; });
    $('plate-' + key).addEventListener('change', () => { game.setDimensions({ [key]: Number($('plate-' + key).value) }); surfaceKey = ''; updateUI(); });
  }
  $('target-final').addEventListener('click', () => { referencePhase = false; updateUI(); }); $('target-phase').addEventListener('click', () => { referencePhase = true; updateUI(); });
  $('level-button').addEventListener('click', openLevels); $('collection-button').addEventListener('click', openCollection);
  $('help-button').addEventListener('click', () => $('help-dialog').showModal()); $('about-button').addEventListener('click', () => $('about-dialog').showModal()); $('material-button').addEventListener('click', openArtifacts);
  $('choose-artifact-button').addEventListener('click', () => { if (workshopVisited && document.body.dataset.view === 'home') showWorkshop(); else openArtifacts(); });
  $('sound-button').addEventListener('click', toggleSound);
  const mgSoundButton = $('mg-sound'); if (mgSoundButton) mgSoundButton.addEventListener('click', toggleSound);
  /* 任意位置的第一下触摸都要能解锁：capture 阶段监听，元素上 stopPropagation 也拦不住；
     不设 once —— 第一次可能因为页面还没接住手势而失败，后面每一次都再试一次，成功后开销可忽略。 */
  ['pointerdown', 'touchstart', 'mousedown', 'click', 'keydown'].forEach(ev =>
    window.addEventListener(ev, unlockAudio, { capture: true, passive: true }));
  document.querySelectorAll('[data-close]').forEach(b => b.addEventListener('click', () => b.closest('dialog').close()));
  document.querySelectorAll('dialog').forEach(d => d.addEventListener('click', e => { const r = d.getBoundingClientRect(); if (e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom) d.close(); }));
  window.addEventListener('keydown', e => {
    const input = ['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement?.tagName);
    if (e.key === 'Escape' && dragging && !busy) { cancelStroke(); e.preventDefault(); }
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z' && !input && !e.shiftKey) { e.preventDefault(); undo(); }
    if (e.key.toLowerCase() === 'r' && !input && !e.ctrlKey && !e.metaKey && !document.querySelector('dialog[open]')) { startLevel(game.state.levelIndex); e.preventDefault(); }
  });
  document.addEventListener('visibilitychange', () => {
    if (document.hidden && dragging && !busy) cancelStroke();
    /* 切前台把被系统挂起的音频重新拉起来，不然回来以后整局都是哑的。 */
    if (!document.hidden) resumeAudio();
  });
  window.addEventListener('pageshow', () => resumeAudio());
  buildRail();
  mountCelebration();
  let mgKeep = 0;
  $('mg-main').addEventListener('pointerdown', () => { mgKeep = window.scrollY; });
  $('tip-ok').addEventListener('click', () => hideStepTip());
  $('tip-close').addEventListener('click', () => hideStepTip());
  $('tip-demo').addEventListener('click', () => { hideStepTip(); demonstrate(); });
  $('tip-help').addEventListener('click', () => { if ($('step-tip').hidden) showStepTip(true); else hideStepTip(); });
  $('mg-main').addEventListener('click', () => {
    if (!mgKeep) mgKeep = window.scrollY;
    setMgOpen(!mgOpen);
    requestAnimationFrame(() => { if (Math.abs(window.scrollY - mgKeep) > 2) window.scrollTo({ top: mgKeep, behavior: 'instant' }); });
  });
  document.querySelectorAll('[data-coach]').forEach(b => b.addEventListener('click', () => { if (b.dataset.coach === 'next') { if (coachIndex + 1 < coachSteps.length) showCoach(coachIndex + 1); else finishCoach(); } else finishCoach(); }));
  window.addEventListener('resize', () => { if (!$('coach').hidden) placeCoach(); placeCue(); });
  chooseArtifact(save.lastArtifact, Number.isInteger(save.lastLevel) && E.LEVELS[save.lastLevel] ? save.lastLevel : 0);
  fillHomeArtifacts();
  const all = Object.entries(A).map(([key, info]) => [key, info.image]).concat(catalogue.map(item => [item.id + '-final', item.model.image]));
  Promise.all(all.map(([key, src]) => new Promise((resolve, reject) => {
    const image = new Image(); image.onload = () => { images[key] = image; resolve(); }; image.onerror = () => reject(new Error(src)); image.src = src;
  }))).then(() => { images.final = images[active.id + '-final']; prepareImages(); ready = true; surfaceKey = ''; startedAt = Date.now(); drawArtifact($('target-canvas')); updateUI(); fillHomeArtifacts(); })
    .catch(() => { loadError = location.protocol === 'file:' ? '素材载入失败，请完整解压游戏文件后再打开' : '素材载入失败，请检查网络后刷新页面重试'; updateUI(); toast(loadError); });
})();

