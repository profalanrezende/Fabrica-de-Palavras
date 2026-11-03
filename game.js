/* Fábrica de Palavras — A.R.S. HTML APPS e GAMES
   Jogo de alfabetização e letramento. Esteiras e caixas: "box flow system" de masahito (ma5a.com). */
(function () {
'use strict';

/* ================= utilidades ================= */
const $ = (s, r) => (r || document).querySelector(s);
const $$ = (s, r) => Array.from((r || document).querySelectorAll(s));
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const rnd = (a, b) => a + Math.random() * (b - a);
const pick = a => a[Math.floor(Math.random() * a.length)];
const shuffle = a => { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
const esc = t => String(t).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const easeOut = p => 1 - Math.pow(1 - p, 3);
const easeIO = p => p < .5 ? 2 * p * p : 1 - Math.pow(-2 * p + 2, 2) / 2;
const bounce = p => { const n = 7.5625, d = 2.75; if (p < 1 / d) return n * p * p; if (p < 2 / d) return n * (p -= 1.5 / d) * p + .75; if (p < 2.5 / d) return n * (p -= 2.25 / d) * p + .9375; return n * (p -= 2.625 / d) * p + .984375; };

const stage = $('#stage');
const CH = 50;               // altura dos caixotes
const GAP = 8;
const FONT = '700 28px Fredoka';
const LINE_COLORS = ['#42c6d2', '#f5a623', '#7ed957', '#d96ad9'];
const LEVELS = [
  { lines: 1, speed: 80,  empty: 0,  dist: 5, desc: '1 esteira · palavras de 2 sílabas' },
  { lines: 2, speed: 90,  empty: 0,  dist: 4, desc: '2 esteiras · palavras de 3 sílabas' },
  { lines: 2, speed: 100, empty: 13, dist: 4, desc: '2 esteiras · dígrafos e nasais · caixotes vazios' },
  { lines: 3, speed: 108, empty: 10, dist: 3, desc: '3 esteiras · encontros consonantais · caixotes vazios' },
  { lines: 4, speed: 116, empty: 8,  dist: 2, desc: 'Todas as esteiras · palavras longas · caixotes vazios' }
];

/* ================= armazenamento ================= */
const KEY = 'fabricaPalavrasARS.v1';
let DB = loadDB();
function loadDB() {
  try { const d = JSON.parse(localStorage.getItem(KEY)); if (d && d.players) { d.settings = d.settings || { sound: true }; return d; } } catch (e) {}
  return { players: {}, settings: { sound: true }, last: '' };
}
function saveDB() { try { localStorage.setItem(KEY, JSON.stringify(DB)); } catch (e) {} }
const pkey = n => n.trim().toLowerCase();
function newPlayer(name) { return { name, stars: Array(50).fill(0), best: Array(50).fill(0), sent: { best: 0, runs: 0 }, prof: {}, teacher: false, created: Date.now() }; }
const S = { W: 1280, H: 720, s: 1, ox: 0, oy: 0, port: false, screen: 'title', pk: '', hint: false };
const me = () => DB.players[S.pk];
const totalStars = p => p.stars.reduce((a, b) => a + b, 0);
const totalScore = p => p.best.reduce((a, b) => a + b, 0);
const doneCount = p => p.stars.filter(x => x > 0).length;
function unlockedIdx(p) { if (p.teacher) return 49; let i = 0; while (i < 50 && p.stars[i] > 0) i++; return Math.min(i, 49); }
const campaignDone = p => p.teacher || p.stars.every(x => x > 0);

/* ================= som e voz ================= */
const Snd = {
  ctx: null,
  init() { if (this.ctx) { if (this.ctx.state === 'suspended') this.ctx.resume(); return; } try { const A = window.AudioContext || window.webkitAudioContext; this.ctx = new A(); } catch (e) {} },
  on() { return DB.settings.sound !== false; },
  tone(f, d, type, v, t0) {
    if (!this.on() || !this.ctx) return;
    const c = this.ctx, o = c.createOscillator(), g = c.createGain(), t = c.currentTime + (t0 || 0);
    o.type = type || 'square'; o.frequency.value = f;
    g.gain.setValueAtTime(v || .07, t); g.gain.exponentialRampToValueAtTime(.0001, t + d);
    o.connect(g); g.connect(c.destination); o.start(t); o.stop(t + d + .03);
  },
  pick() { this.tone(520, .07, 'square', .05); },
  drop() { this.tone(190, .1, 'triangle', .12); },
  land() { this.tone(300, .07, 'square', .05); },
  ok() { [523, 659, 784, 1047].forEach((f, i) => this.tone(f, .14, 'square', .07, i * .09)); },
  bad() { this.tone(160, .25, 'sawtooth', .07); this.tone(120, .3, 'sawtooth', .07, .12); },
  poof() { this.tone(700, .08, 'triangle', .06); this.tone(420, .08, 'triangle', .05, .06); },
  win() { [523, 659, 784, 659, 784, 1047, 1319].forEach((f, i) => this.tone(f, .16, 'square', .07, i * .1)); }
};
function speak(text) {
  if (!Snd.on() || !('speechSynthesis' in window)) return;
  try {
    speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.lang = 'pt-BR'; u.rate = .85;
    const v = speechSynthesis.getVoices().find(x => /pt[-_]BR/i.test(x.lang));
    if (v) u.voice = v;
    speechSynthesis.speak(u);
  } catch (e) {}
}

/* ================= tela / escala ================= */
function fit() {
  const vw = window.innerWidth, vh = window.innerHeight; let W, H;
  if (vw >= vh) { H = 720; W = clamp(Math.round(720 * vw / vh), 1000, 1700); }
  else { W = 600; H = clamp(Math.round(600 * vh / vw), 960, 1300); }
  const s = Math.min(vw / W, vh / H);
  Object.assign(S, { W, H, s, ox: (vw - W * s) / 2, oy: (vh - H * s) / 2, port: vh > vw });
  stage.style.width = W + 'px'; stage.style.height = H + 'px';
  stage.style.transform = `translate(${S.ox}px,${S.oy}px) scale(${s})`;
  stage.classList.toggle('portrait', S.port);
  if (S.screen === 'title') buildTitleBelt();
  if (G) layoutGame();
}
function show(id) {
  S.screen = id;
  $$('.screen').forEach(e => e.classList.toggle('on', e.id === 'scr-' + id));
  if (id === 'title') { $('#in-name').value = DB.last || ''; $('#name-err').textContent = ''; buildTitleBelt(); }
  if (id === 'map') buildMap();
  if (id === 'prof') buildProfMap();
  if (id === 'ofi') renderOfi();
}
let toastT = 0;
function toast(msg, ms) { const t = $('#toast'); t.textContent = msg; t.classList.add('on'); clearTimeout(toastT); toastT = setTimeout(() => t.classList.remove('on'), ms || 2600); }
const mctx = document.createElement('canvas').getContext('2d');
function tw(text, font) { mctx.font = font || FONT; return mctx.measureText(text).width; }
const crateW = text => Math.max(70, Math.ceil(tw(text.toUpperCase(), FONT)) + text.length + 40);

/* ================= esteira (sprites originais) ================= */
function makeBelt(len, speed) {
  const n = Math.max(1, Math.round((len - 72) / 20));
  const el = document.createElement('div');
  el.className = 'conveyor-belt animate';
  el.style.setProperty('--dur', (16 / speed).toFixed(3) + 's');
  el.innerHTML = '<div class="belt-wrapper"><div class="belt-edge pix"></div>' + '<div class="belt-module pix"></div>'.repeat(n) + '<div class="belt-edge pix flip"></div></div>';
  return { el, len: 72 + 20 * n };
}

/* ================= caixotes ================= */
let UID = 0, WUID = 0;
function mkItem(kind, text, parent, color) {
  const it = { id: ++UID, kind, text: text || '', state: 'tray', x: 0, y: 0, sc: 1, bx: 0, line: null, own: null, tween: null, dead: false };
  const el = document.createElement('div');
  el.className = 'crate ' + (kind === 'empty' ? 'empty' : 'txt'); el.dataset.id = it.id;
  if (kind === 'empty') { it.w = 50; el.innerHTML = '<i class="face" data-ex="sleepy"></i>'; }
  else {
    it.w = crateW(text);
    it.color = color || (kind === 'word' ? '#ffffff' : kind === 'letter' ? '#ffb3c7' : pick(['#ffffff', '#42c6d2', '#ffd23f']));
    el.style.background = it.color;
    el.innerHTML = '<i class="face" data-ex="neutral"></i><b></b>'; el.lastChild.textContent = text;
  }
  el.style.width = it.w + 'px';
  parent.appendChild(el);
  it.el = el; it.face = el.querySelector('.face');
  place(it);
  return it;
}
const place = it => { it.el.style.transform = `translate(${it.x.toFixed(1)}px,${it.y.toFixed(1)}px) scale(${it.sc.toFixed(3)})`; };
const face = (it, ex) => { if (it.face) it.face.dataset.ex = ex; };
function moveTo(it, x, y, ms, ease, done, sc) {
  it.tween = { x0: it.x, y0: it.y, s0: it.sc, x1: x, y1: y, s1: sc == null ? it.sc : sc, t: 0, ms: Math.max(1, ms), ease: ease || easeOut, done };
}
function stepTween(it, dt) {
  const tw_ = it.tween; tw_.t += dt * 1000;
  const p = clamp(tw_.t / tw_.ms, 0, 1), e = tw_.ease(p);
  it.x = tw_.x0 + (tw_.x1 - tw_.x0) * e; it.y = tw_.y0 + (tw_.y1 - tw_.y0) * e; it.sc = tw_.s0 + (tw_.s1 - tw_.s0) * e;
  place(it);
  if (p >= 1) { it.x = tw_.x1; it.y = tw_.y1; it.sc = tw_.s1; place(it); const d = tw_.done; it.tween = null; if (d) d(); }
}

/* ================= tela inicial (animação interativa) ================= */
const TI = { items: [], y: 0, spd: 70, drag: null, pending: null, words: 0, nextEnemy: 3, enemyT: 4, seq: 0 };
const TITLE_WORDS = ['FÁBRICA', 'DE', 'PALAVRAS'];
function buildTitleBelt() {
  const box = $('#t-belt'); box.innerHTML = '';
  const cr = $('.credit'), gap = Math.max(34, (cr ? cr.offsetHeight : 20) + 22);
  box.style.bottom = gap + 'px';
  const b = makeBelt(S.W + 120, 70); b.el.style.left = '-40px'; b.el.style.top = '0'; box.appendChild(b.el);
  const layer = $('#t-items'); layer.innerHTML = ''; TI.items = []; TI.drag = null; TI.pending = null; TI.enemyT = rnd(3, 6);
  TI.y = S.H - gap - 40 - CH + 6;
  let x = -60;
  while (x < S.W) { const d = titleNext(); const it = titleMake(d, x); x += it.w + d.gap; }
}
function titleNext() {
  if (TI.words >= TI.nextEnemy) { TI.words = 0; TI.nextEnemy = 3 + Math.floor(Math.random() * 5); return { kind: 'empty', text: '', gap: rnd(50, 100) }; }
  const text = TITLE_WORDS[TI.seq++ % TITLE_WORDS.length]; TI.words++;
  return { kind: 'syl', text, gap: rnd(50, 110) };
}
function titleMake(d, x) {
  const it = mkItem(d.kind, d.text, $('#t-items'));
  it.x = x; it.y = TI.y; it.sc = 1; it.state = 'belt'; place(it); face(it, d.kind === 'empty' ? 'sleepy' : 'joy'); TI.items.push(it); return it;
}
function titleFree(it, want) {
  const occ = TI.items.filter(o => o !== it && (o.state === 'belt' || o.state === 'fall')).map(o => { const tx = o.tween ? o.tween.x1 : o.x; return [tx - 36, tx + o.w + 36]; });
  const ok = x => occ.every(([a, b]) => x + it.w <= a || x >= b);
  want = clamp(want, 6, S.W - it.w - 6);
  if (ok(want)) return want;
  let best = want, bd = 1e9;
  const c = []; occ.forEach(([a, b]) => { c.push(a - it.w, b); });
  c.forEach(x => { if (x >= 0 && x + it.w <= S.W && ok(x) && Math.abs(x - want) < bd) { bd = Math.abs(x - want); best = x; } });
  return best;
}
function titleLand(it, x, fromY) {
  it.state = 'fall'; face(it, 'surprise'); it.el.classList.remove('drag');
  const dist = Math.abs(TI.y - it.y);
  moveTo(it, x, TI.y, 260 + dist * .7, bounce, () => { it.state = 'belt'; face(it, it.kind === 'empty' ? 'sleepy' : 'joy'); Snd.land(); });
}
function titlePoof(it) {
  Snd.poof(); it.state = 'dead'; it.tween = null; it.el.classList.add('fade'); setTimeout(() => it.el.remove(), 280);
  TI.items = TI.items.filter(o => o !== it);
}
function titleDown(e) {
  const t = e.target.closest ? e.target.closest('.crate') : null; if (!t || !t.parentNode || t.parentNode.id !== 't-items') return;
  const it = TI.items.find(i => String(i.id) === t.dataset.id); if (!it || it.state === 'dead') return;
  Snd.init(); e.preventDefault();
  const p = stagePt(e); it.tween = null; it.state = 'drag'; it.sc = 1;
  it.el.classList.add('drag'); face(it, 'surprise'); Snd.pick();
  TI.drag = { it, ox: p.x - it.x, oy: p.y - it.y, sx: p.x, sy: p.y, t0: performance.now(), moved: false, pid: e.pointerId, y0: it.y };
  try { stage.setPointerCapture(e.pointerId); } catch (er) {}
}
stage.addEventListener('pointerdown', e => { if (S.screen === 'title' && !TI.drag) titleDown(e); });
stage.addEventListener('pointermove', e => {
  const d = TI.drag; if (!d || e.pointerId !== d.pid) return;
  const p = stagePt(e), it = d.it;
  it.x = clamp(p.x - d.ox, -it.w * .4, S.W - it.w * .6); it.y = clamp(p.y - d.oy, 0, S.H - CH); place(it);
  if (Math.hypot(p.x - d.sx, p.y - d.sy) > 10) d.moved = true;
});
const titleUp = e => {
  const d = TI.drag; if (!d || (e && e.pointerId !== d.pid)) return; TI.drag = null;
  const it = d.it; it.el.classList.remove('drag');
  if (!d.moved && performance.now() - d.t0 < 450) {
    if (it.kind === 'empty') return titlePoof(it);
    it.state = 'belt'; it.y = d.y0; place(it); face(it, 'joy'); if (it.text) speak(it.text.toLowerCase()); return;
  }
  titleLand(it, titleFree(it, it.x));
};
stage.addEventListener('pointerup', titleUp);
stage.addEventListener('pointercancel', titleUp);
function updateTitle(dt) {
  for (const it of TI.items) { if (it.tween) stepTween(it, dt); else if (it.state === 'belt') { it.x += TI.spd * dt; place(it); } }
  TI.items = TI.items.filter(it => { if (it.state !== 'drag' && it.x > S.W + 40) { it.el.remove(); return false; } return true; });
  // novo item entra pela esquerda (nome do app em loop)
  if (!TI.pending) TI.pending = titleNext();
  const belt = TI.items.filter(o => o.state === 'belt');
  const left = belt.reduce((m, o) => Math.min(m, o.x), 1e9), w = TI.pending.kind === 'empty' ? 50 : crateW(TI.pending.text);
  if (left - TI.pending.gap - w >= -w - 20) { titleMake(TI.pending, left > 1e8 ? -w - 20 : left - TI.pending.gap - w); TI.pending = null; }
  // caixotes inimigos caem de vez em quando
  TI.enemyT -= dt;
  if (TI.enemyT <= 0) {
    TI.enemyT = rnd(6, 11);
    if (TI.items.filter(o => o.kind === 'empty').length < 3) {
      const it = mkItem('empty', '', $('#t-items')); TI.items.push(it);
      const x = titleFree(it, rnd(S.W * .08, S.W * .75)); it.x = x; it.y = -70; place(it);
      titleLand(it, x);
    }
  }
}

/* ================= mapa ================= */
function buildMap() {
  const p = me(); if (!p) { show('title'); return; }
  $('#map-who').textContent = 'Operário: ' + p.name + (p.teacher ? ' (professor)' : '');
  $('#map-stars').textContent = '★ ' + totalStars(p);
  const un = unlockedIdx(p), box = $('#levels'); box.innerHTML = '';
  for (let l = 1; l <= 5; l++) {
    const row = document.createElement('div'); row.className = 'lvl' + ((l - 1) * 10 > un ? ' locked' : '');
    row.innerHTML = `<div class="lvl-h"><b>NÍVEL ${l}</b><span>${esc(LEVELS[l - 1].desc)}</span></div><div class="lvl-grid"></div>`;
    const grid = $('.lvl-grid', row);
    for (let f = 1; f <= 10; f++) {
      const idx = (l - 1) * 10 + f - 1, st = p.stars[idx];
      const b = document.createElement('button');
      b.className = 'ph' + (st > 0 ? ' done' : idx > un ? ' lock' : '');
      b.innerHTML = idx > un ? '🔒' : `${f}<span class="st">${st > 0 ? '★'.repeat(st) + '☆'.repeat(3 - st) : ''}</span>`;
      if (idx <= un) b.onclick = () => { Snd.init(); startPhase(l, f); };
      grid.appendChild(b);
    }
    box.appendChild(row);
  }
  const fb = $('#frases-box'), ok = campaignDone(p);
  fb.innerHTML = `<button class="btn ${ok ? 'ok' : ''}" ${ok ? '' : 'disabled'}>${ok ? '⏱ CONTRA O TEMPO DAS FRASES' : '🔒 FRASES: conclua as 50 fases'}</button>`;
  if (ok) $('button', fb).onclick = () => { Snd.init(); startFrases(); };
  if (profActive().length) { const b = document.createElement('button'); b.className = 'btn ok'; b.innerHTML = '🎓 COM O PROF'; b.onclick = () => { Snd.init(); show('prof'); }; fb.appendChild(b); }
}

/* ================= ranking ================= */
let rkTab = 1;
function buildRank() {
  const list = $('#rk-list'), ps = Object.entries(DB.players).map(([k, p]) => ({ k, p }));
  let rows;
  if (rkTab === 1) rows = ps.filter(o => doneCount(o.p) > 0).sort((a, b) => totalStars(b.p) - totalStars(a.p) || totalScore(b.p) - totalScore(a.p))
    .map(o => ({ k: o.k, nm: o.p.name, vl: `★ ${totalStars(o.p)} · ${doneCount(o.p)}/50 · ${totalScore(o.p)} pts` }));
  else rows = ps.filter(o => o.p.sent.runs > 0).sort((a, b) => b.p.sent.best - a.p.sent.best)
    .map(o => ({ k: o.k, nm: o.p.name, vl: `${o.p.sent.best} pts` }));
  list.innerHTML = rows.length ? rows.slice(0, 50).map((r, i) => `<div class="rk-row${r.k === S.pk ? ' me' : ''}"><span class="pos">${i + 1}º</span><span class="nm">${esc(r.nm)}</span><span class="vl">${esc(r.vl)}</span></div>`).join('')
    : '<div class="rk-empty">Ainda não há resultados.<br>Seja o primeiro da fábrica!</div>';
  $('#rk-t1').classList.toggle('on', rkTab === 1); $('#rk-t2').classList.toggle('on', rkTab === 2);
}

/* ================= overlays / configurações ================= */
function openOv(id) {
  $('#' + id).classList.add('on');
  if (G && S.screen === 'game' && !G.over) G.paused = true;
}
function closeOv(id) {
  $('#' + id).classList.remove('on');
  if (G && !$$('.ov.on').length) G.paused = false;
}
const fsOK = () => !!(document.documentElement.requestFullscreen || document.documentElement.webkitRequestFullscreen);
const isFs = () => !!(document.fullscreenElement || document.webkitFullscreenElement);
function updateCfg() {
  const f = $('#cfg-fs');
  f.innerHTML = fsOK() ? 'TELA CHEIA: <b>' + (isFs() ? 'SIM' : 'NÃO') + '</b>' : 'TELA CHEIA: <b>INDISPONÍVEL</b>';
  f.disabled = !fsOK();
  $('#cfg-snd').innerHTML = 'SOM: <b>' + (Snd.on() ? 'SIM' : 'NÃO') + '</b>';
}
function toggleFs() {
  try {
    if (isFs()) (document.exitFullscreen || document.webkitExitFullscreen).call(document);
    else { const el = document.documentElement; (el.requestFullscreen || el.webkitRequestFullscreen).call(el); }
  } catch (e) {}
  setTimeout(updateCfg, 350);
}
function confirmBox(title, text, yesFn) {
  $('#cf-title').textContent = title; $('#cf-text').textContent = text;
  $('#cf-yes').onclick = () => { closeOv('ov-confirm'); yesFn(); };
  openOv('ov-confirm');
}
function saveAndExit() {
  saveDB(); G = null; $$('.ov').forEach(o => o.classList.remove('on'));
  $('#g-world').innerHTML = ''; show('title');
}

/* ================= jogo ================= */
let G = null;
const parseWord = s => { const syl = s.split('-'), text = s.replace(/-/g, ''); return { syl, text, emoji: (typeof EMOJIS !== 'undefined' && EMOJIS[text]) || '', uid: ++WUID }; };
const levelPool = lv => { const set = new Set(); NIVEIS[lv - 1].forEach(ph => ph.forEach(w => w.split('-').forEach(s => set.add(s)))); return Array.from(set); };

function newGame(o) {
  const w = $('#g-world'); w.innerHTML = '';
  const g = Object.assign({ items: [], byId: {}, lines: [], timers: [], done: 0, errors: 0, score: 0, paused: false, over: false, spawnT: 7, drag: null, trayOrder: [], combo: 0, sentences: 0, empties: 0 }, o);
  g.elChips = document.createElement('div'); g.elTray = document.createElement('div'); g.elLines = document.createElement('div'); g.elItems = document.createElement('div');
  g.elTray.className = 'tray'; g.elTray.innerHTML = '<span class="tl">ESTOQUE</span>'; g.elItems.id = 'g-items';
  [g.elChips, g.elTray, g.elLines, g.elItems].forEach(e => w.appendChild(e));
  for (let i = 0; i < g.L; i++) {
    const line = { i, color: LINE_COLORS[i], word: null, items: [], asm: [], busy: false, idle: false, m: g.mode === 'frases' ? 'frases' : 'phase', speed: g.speed, errs: 0, cellW: 70, asmS: 1 };
    const chip = document.createElement('div'); chip.className = 'chip'; chip.style.setProperty('--lc', line.color);
    chip.innerHTML = `<div class="num">${i + 1}</div><span class="emo"></span><div class="wd"></div><div class="pg hidden"><b data-p="-1">‹</b><span></span><b data-p="1">›</b></div>`;
    chip.querySelector(".pg").addEventListener("pointerdown", ev => { ev.stopPropagation(); const d = ev.target.dataset.p; if (!d || !line.spec || !line.spec.sections) return; line.secIdx = clamp(line.secIdx + (+d), 0, line.spec.sections.length - 1); renderTokens(line); });
    chip.addEventListener('pointerdown', () => { Snd.init(); if (line.word) speak(g.mode === 'frases' ? line.word.text : line.word.text); });
    g.elChips.appendChild(chip); line.elChip = chip;
    const flag = document.createElement('div'); flag.className = 'flag'; flag.style.setProperty('--lc', line.color); flag.textContent = i + 1; g.elLines.appendChild(flag); line.elFlag = flag;
    const asm = document.createElement('div'); asm.className = 'asm'; asm.style.setProperty('--lc', line.color); g.elLines.appendChild(asm); line.elAsm = asm;
    g.lines.push(line);
  }
  return g;
}
const hud = () => {
  if (!G) return;
  $('#g-err').textContent = '✖ ' + G.errors; $('#g-score').textContent = G.score + ' pts';
  $('#g-prog').textContent = G.mode === 'frases' ? '✔ ' + G.sentences : G.done + '/' + G.total;
  if (G.mode === 'frases' || G.limit) { const t = Math.max(0, Math.ceil(G.time)); $('#g-time').textContent = String(Math.floor(t / 60)).padStart(2, '0') + ':' + String(t % 60).padStart(2, '0'); }
};
const after = (ms, fn) => G.timers.push({ t: ms / 1000, fn });

function startPhase(level, phase) {
  $$('.ov').forEach(o => o.classList.remove('on'));
  const cfg = LEVELS[level - 1];
  G = newGame({ mode: 'phase', level, phase, cfg, L: cfg.lines, speed: cfg.speed, emptyEvery: cfg.empty, total: 10, spawnT: 8 });
  G.queue = NIVEIS[level - 1][phase - 1].map(parseWord); G.pool = levelPool(level);
  $('#g-title').textContent = `NÍVEL ${level} · FASE ${phase}`; $('#g-time').classList.add('hidden');
  show('game'); hud(); layoutGame();
  G.lines.forEach(l => nextWord(l));
  if (!S.hint) { S.hint = true; toast(cfg.lines === 1 ? 'Arraste (ou toque) as sílabas para a esteira, na ordem certa!' : 'Arraste as sílabas para a esteira da palavra certa!', 3600); }
}
function startFrases() {
  $$('.ov').forEach(o => o.classList.remove('on'));
  G = newGame({ mode: 'frases', L: 2, speed: 100, emptyEvery: 10, total: 0, time: 1800, spawnT: 10 });
  G.queue = shuffle(FRASES); G.pool = [];
  G.texts = FRASES.map(f => ({ tokens: f.slice(0, -1).split(' ').map((t, i, a) => i === a.length - 1 ? t + '.' : t), vis: false }));
  $('#g-title').textContent = 'CONTRA O TEMPO · FRASES'; $('#g-time').classList.remove('hidden');
  show('game'); hud(); layoutGame();
  G.lines.forEach(l => nextWord(l));
  toast('Monte as frases com palavras e letras soltas. Você tem 30 minutos!', 3800);
}

/* ---- layout ---- */
function layoutGame() {
  if (!G) return;
  const W = S.W, H = S.H, port = S.port, L = G.L, top = 64;
  const cols = port ? Math.min(L, 2) : L;
  const chipW = Math.min(620, (W - 32 - (cols - 1) * 14) / cols);
  let chipH = port ? 84 : 88;
  if (G.texts) G.texts.forEach(t => { chipH = Math.max(chipH, chipSpec(t.tokens, chipW, t.vis, port ? 170 : 150).h); });
  const chipsH = port ? Math.ceil(L / cols) * (chipH + 10) + 6 : chipH + 16;
  const chipsW = chipW * cols + (cols - 1) * 14, chipX0 = (W - chipsW) / 2;
  const rowsTop = top + chipsH + 8, trayMin = port ? 230 : 150;
  const avail = H - rowsTop - trayMin - 12;
  const rowH = Math.min(port ? (L <= 1 ? 340 : L <= 2 ? 280 : L <= 3 ? 240 : 220) : 150, Math.floor(avail / L));
  const rowsEnd = rowsTop + rowH * L;
  G.rect = { trayY: rowsEnd + 8, trayH: H - rowsEnd - 18 };
  G.lines.forEach((line, i) => {
    const c = i % cols, r = Math.floor(i / cols);
    Object.assign(line.elChip.style, { left: (chipX0 + c * (chipW + 14)) + 'px', top: (top + 8 + r * (chipH + 10)) + 'px', width: chipW + 'px', height: chipH + 'px' });
    line.chipW = chipW; line.chipH = chipH;
    const rowY = rowsTop + i * rowH, crateTop = port ? rowY + 6 : rowY + Math.max(2, (rowH - 84) / 2);
    let beltX = 40, beltLen, asm;
    if (!port) {
      const asmW = Math.min(500, Math.round(W * .4));
      beltLen = W - beltX - 24 - asmW - 26;
      asm = { x: W - 24 - asmW, w: asmW, port: false, cy: crateTop + CH / 2, minY: rowY + 2, maxY: rowY + rowH - 2, maxH: rowH - 4 };
    } else {
      beltLen = W - beltX - 24;
      const ay = crateTop + CH - 6 + 40 + 6;
      asm = { x: 24, y: ay, w: W - 48, port: true, maxH: Math.max(CH + 18, rowY + rowH - ay - 2) };
    }
    if (line.elBelt) line.elBelt.remove();
    const b = makeBelt(beltLen, line.speed); b.el.style.left = beltX + 'px'; b.el.style.top = (crateTop + CH - 6) + 'px';
    G.elLines.insertBefore(b.el, line.elFlag);
    line.elBelt = b.el; line.belt = { x: beltX, y: crateTop + CH - 6, len: b.len };
    line.elBelt.classList.toggle('animate', !line.busy && !line.idle);
    Object.assign(line.elFlag.style, { left: '6px', top: (line.belt.y + 4) + 'px' });
    line.asmRect = asm;
    setupAsm(line);
    line.items.forEach(it => { it.x = line.belt.x + it.bx; it.y = line.belt.y - CH + 6; it.tween = null; place(it); });
  });
  Object.assign(G.elTray.style, { left: '12px', top: G.rect.trayY + 'px', width: (W - 24) + 'px', height: G.rect.trayH + 'px' });
  G.lines.forEach(l => { fitChip(l); repackAsm(l, false); });
  layoutTray(true);
}
/* texto do painel: quebra em linhas e, se preciso, em seções */
function chipSpec(tokens, chipW, vis, maxH) {
  const base = chipW - 46 - 10 - (vis ? 64 : 0) - 28, up = tokens.map(t => t.toUpperCase());
  const pack = (fs, avail, cap) => {
    const f = `700 ${fs}px Fredoka`, sp = tw(' ', f) + 2, secs = []; let cur = [], lines = 1, x = 0;
    up.forEach((w, i) => {
      const ww = tw(w, f) + w.length * 2;
      if (x > 0 && x + sp + ww > avail) { if (lines + 1 > cap) { secs.push(cur); cur = []; lines = 1; x = ww; } else { lines++; x = ww; } } else x += (x > 0 ? sp : 0) + ww;
      cur.push(i);
    });
    secs.push(cur); return { secs, lines: secs.length === 1 ? lines : cap };
  };
  for (const fs of [40, 36, 32, 28, 26, 24, 22]) {
    const r = pack(fs, base, 99), h = Math.ceil(r.lines * fs * 1.12) + 30;
    if (h <= maxH) return { fs, h: Math.max(88, h), sections: null };
  }
  const fs = 24, cap = Math.max(1, Math.floor((maxH - 30) / (fs * 1.12))), r = pack(fs, base - 84, cap);
  return { fs, h: maxH, sections: r.secs.length > 1 ? r.secs : null };
}
function renderTokens(line) {
  const w = line.word, sp = line.spec, wd = $('.wd', line.elChip), pg = $('.pg', line.elChip); if (!w || !sp) return;
  const idxs = sp.sections ? sp.sections[clamp(line.secIdx || 0, 0, sp.sections.length - 1)] : w.tokens.map((_, i) => i);
  const ci = line.ci || 0, last = w.tokens.length - 1;
  wd.innerHTML = idxs.map(i => `<i data-t="${i}" class="${i < ci ? 'ok' : ''}">${esc(w.tokens[i].toUpperCase())}</i>`).join(' ') + (idxs.includes(last) ? esc(w.punct == null ? '.' : w.punct) : '');
  pg.classList.toggle('hidden', !sp.sections);
  if (sp.sections) $('span', pg).textContent = ((line.secIdx || 0) + 1) + '/' + sp.sections.length;
}
function fitChip(line) {
  const wd = $('.wd', line.elChip); if (!line.word) return;
  const avail = line.chipW - 46 - 10 - (line.word.emoji || line.word.img ? 64 : 0) - 28;
  if (line.m === 'frases') {
    line.spec = chipSpec(line.word.tokens.map((t, i) => i === line.word.tokens.length - 1 ? t + (line.word.punct == null ? '.' : line.word.punct) : t), line.chipW, !!(line.word.emoji || line.word.img), S.port ? 170 : 150);
    wd.style.fontSize = line.spec.fs + 'px'; wd.style.whiteSpace = 'normal'; wd.style.lineHeight = '1.12';
    renderTokens(line);
  } else {
    const m = tw(line.word.text.toUpperCase(), '700 40px Fredoka') + line.word.text.length * 2;
    wd.style.fontSize = clamp(Math.floor(40 * avail / m), 16, 46) + 'px'; wd.style.whiteSpace = 'nowrap';
    $('.pg', line.elChip).classList.add('hidden');
  }
}
const ROWGAP = 10, rowStep = s => CH * s + ROWGAP;
function flowPos(widths, s, availW) {
  const pos = []; let x = 0, row = 0;
  widths.forEach(w => { const ww = w * s; if (x > 0 && x + ww > availW + .5) { row++; x = 0; } pos.push({ x, row }); x += ww + GAP * s; });
  return { pos, rows: widths.length ? row + 1 : 1 };
}
function expectedWidths(line) {
  const w = line.word;
  if (line.m === 'phase') { line.cellW = Math.max(...w.syl.map(crateW)); return w.syl.map(() => line.cellW); }
  const out = []; w.tokens.forEach((t, i) => { if (w.asLetters && w.asLetters[i]) t.split('').forEach(c => out.push(crateW(c))); else out.push(crateW(t)); });
  return out;
}
function asmWidths(line) {
  if (line.m === 'phase') return Array(Math.max(line.word.syl.length, line.asm.length)).fill(line.cellW);
  return line.asm.map(i => i.w);
}
function boxAsm(line, rows) {
  const r = line.asmRect, s = line.asmS; if (line.m !== 'phase' && line.rowsCap) rows = Math.min(rows, line.rowsCap);
  const h = rows * rowStep(s) + 8;
  const y = r.port ? r.y : clamp(r.cy - h / 2, r.minY, Math.max(r.minY, r.maxY - h));
  line.asmY = y; line.asmH = h;
  Object.assign(line.elAsm.style, { left: r.x + 'px', top: y + 'px', width: r.w + 'px', height: h + 'px' });
}
function syncBox(line) {
  if (!line.word) return boxAsm(line, 1);
  const merged = line.asm.some(i => i.merged && line.m === 'phase');
  const rows = merged ? line.slotRows : flowPos(asmWidths(line), line.asmS, line.asmRect.w - 24).rows;
  line.rowOff = line.m === 'phase' ? 0 : Math.max(0, rows - (line.rowsCap || 99));
  const mo = $('.more', line.elAsm); if (mo) { mo.style.display = line.rowOff ? '' : 'none'; mo.textContent = '▲ ' + line.rowOff + ' linha(s) acima'; }
  boxAsm(line, Math.max(1, rows));
}
function setupAsm(line) {
  const el = line.elAsm, r = line.asmRect; el.innerHTML = ''; el.classList.remove('joined');
  if (!line.word) { line.asmS = 1; line.slotRows = 1; return boxAsm(line, 1); }
  const ws = expectedWidths(line), availW = r.w - 24; let s = 1, f = flowPos(ws, 1, availW);
  const maxW = Math.max(...ws);
  const minS = line.m === 'phase' ? .45 : .6;
  for (s = Math.min(1, availW / maxW); s > minS; s -= .05) { f = flowPos(ws, s, availW); if (f.rows * rowStep(s) + 8 <= r.maxH) break; }
  s = Math.max(minS, s); f = flowPos(ws, s, availW);
  line.asmS = s; line.slotRows = f.rows; line.rowsCap = Math.max(1, Math.floor((r.maxH - 8) / rowStep(s))); line.rowOff = 0;
  if (line.m === 'phase') {
    f.pos.forEach(p => {
      const c = document.createElement('div'); c.className = 'cell';
      Object.assign(c.style, { left: (7 + p.x - 2) + 'px', top: (4 + p.row * rowStep(s) - 2) + 'px', width: (line.cellW * s + 4) + 'px', height: (CH * s + 4) + 'px' });
      el.appendChild(c);
    });
  } else { const h = document.createElement('div'); h.className = 'hint'; h.textContent = 'A FRASE SE FORMA AQUI'; el.appendChild(h); const mo = document.createElement('div'); mo.className = 'more'; mo.style.display = 'none'; el.appendChild(mo); }
  boxAsm(line, f.rows);
}
function asmTarget(line, k, it) {
  const r = line.asmRect, s = line.asmS, availW = r.w - 24;
  if (it.merged && line.m === 'phase') {
    const sc = Math.min(1, availW / it.w);
    return { x: r.x + 12 + (availW - it.w * sc) / 2, y: line.asmY + (line.asmH - CH * sc) / 2, sc };
  }
  const f = flowPos(asmWidths(line), s, availW), p = f.pos[k] || { x: 0, row: 0 };
  const dx = line.m === 'phase' ? ((line.cellW - it.w) * s) / 2 : 0;
  return { x: r.x + 12 + p.x + dx, y: line.asmY + 9 + (p.row - (line.rowOff || 0)) * rowStep(s), sc: s };
}
function repackAsm(line, animate) {
  if (!line.word) return;
  syncBox(line);
  const fl = line.m === 'phase' ? null : flowPos(asmWidths(line), line.asmS, line.asmRect.w - 24);
  line.asm.forEach((it, k) => {
    if (fl) it.el.classList.toggle('hid', fl.pos[k].row < line.rowOff);
    const t = asmTarget(line, k, it);
    if (it.state === 'fly' && it.tween) { it.tween.x1 = t.x; it.tween.y1 = t.y; it.tween.s1 = t.sc; return; }
    if (it.state === 'merge') return;
    if (!animate) { it.tween = null; it.x = t.x; it.y = t.y; it.sc = t.sc; place(it); }
    else if (Math.abs(it.x - t.x) + Math.abs(it.y - t.y) + Math.abs(it.sc - t.sc) > .5) moveTo(it, t.x, t.y, 220, easeOut, null, t.sc);
  });
}
/* junta caixotes numa só peça (letras -> palavra, sílabas -> palavra) */
function mergeGroups(line, groups, pulse, done) {
  if (!groups.length) { if (done) done(); return; }
  line.merging = true; let pending = groups.length;
  groups.forEach(g => {
    const first = g.items[0];
    g.items.forEach(it => { it.state = 'merge'; face(it, 'joy'); moveTo(it, first.x, first.y, 240, easeIO, null, first.sc); });
    after(270, () => {
      const m = mkItem('word', g.text, G.elItems, '#ffffff');
      m.own = first.own; m.state = 'asm'; m.line = line; m.merged = true; m.parts = g.items.map(i => i.text);
      m.x = first.x; m.y = first.y; m.sc = first.sc; place(m); face(m, 'joy'); if (pulse) m.el.classList.add('pulse');
      G.items.push(m); G.byId[m.id] = m; Snd.land();
      const idx = line.asm.indexOf(first); line.asm.splice(Math.max(0, idx), 0, m);
      g.items.forEach(it => { line.asm = line.asm.filter(o => o !== it); it.dead = true; it.tween = null; it.el.remove(); G.items = G.items.filter(o => o !== it); delete G.byId[it.id]; });
      if (--pending === 0) { line.merging = false; if (g.items.length && line.m === 'phase') line.elAsm.classList.add('joined'); repackAsm(line, true); if (done) done(); }
    });
  });
}
function letterGroups(line, real) {
  const groups = [], tokens = line.word.tokens; let ci = 0, buf = [], text = '';
  for (const it of real) {
    const tk = tokens[ci]; if (tk == null) break;
    if (it.kind === 'word') { ci++; continue; }
    buf.push(it); text += it.text;
    if (text.length === tk.length) { if (buf.length >= 1) groups.push({ items: buf, text }); buf = []; text = ''; ci++; }
  }
  return groups;
}

function layoutTray(snap) {
  if (!G) return;
  const ids = G.trayOrder.filter(id => { const it = G.byId[id]; return it && !it.dead && it.state === 'tray'; });
  const items = ids.map(id => G.byId[id]);
  const area = { x: 12, y: G.rect.trayY, w: S.W - 24, h: G.rect.trayH }, pad = 18, labelH = 20;
  const maxW = area.w - pad * 2, maxH = area.h - labelH - pad - 4;
  let best = null;
  for (let sc = S.port ? 1.3 : 1.15; sc >= .45; sc -= .05) {
    const rows = []; let row = [], x = 0;
    for (const it of items) {
      const w = it.w * sc;
      if (row.length && x + w > maxW) { rows.push(row); row = []; x = 0; }
      row.push(it); x += w + GAP * sc;
    }
    if (row.length) rows.push(row);
    const need = rows.length * (CH + 10) * sc;
    best = { sc, rows };
    if (need <= maxH) break;
  }
  if (!best) return;
  const { sc, rows } = best, rh = (CH + 10) * sc, totalH = rows.length * rh;
  let y = area.y + labelH + 4 + Math.max(0, (maxH - totalH) / 2);
  rows.forEach(row => {
    const rw = row.reduce((a, it) => a + it.w * sc + GAP * sc, -GAP * sc);
    let x = area.x + pad + (maxW - rw) / 2;
    row.forEach(it => {
      it.home = { x, y, sc };
      if (!(G.drag && G.drag.it === it)) {
        if (snap || it.justMade) { it.tween = null; it.x = x; it.y = y; it.sc = sc; place(it); it.justMade = false; }
        else if (Math.abs(it.x - x) + Math.abs(it.y - y) + Math.abs(it.sc - sc) > .5) moveTo(it, x, y, 240, easeOut, null, sc);
      }
      x += it.w * sc + GAP * sc;
    });
    y += rh;
  });
}
/* ---- palavras e tray ---- */
function addItem(kind, text, own) {
  const it = mkItem(kind, text, G.elItems); it.own = own; it.state = 'tray'; it.justMade = true;
  G.items.push(it); G.byId[it.id] = it;
  const pos = Math.floor(Math.random() * (G.trayOrder.length + 1)); G.trayOrder.splice(pos, 0, it.id);
  return it;
}
function pickDistractors(word, n) {
  const first = new Set(word.syl.map(s => s[0])), last = new Set(word.syl.map(s => s[s.length - 1]));
  const cand = G.pool.filter(s => !word.syl.includes(s)).map(s => ({ s, v: (first.has(s[0]) ? 3 : 0) + (last.has(s[s.length - 1]) ? 2 : 0) + Math.random() * 3 }));
  cand.sort((a, b) => b.v - a.v);
  const out = []; for (const c of cand) { if (out.length >= n) break; if (!out.includes(c.s)) out.push(c.s); }
  return out;
}
const LETTERS = 'abcdefghilmnopqrstuvz'.split('');
function nextWord(line) {
  line.errs = 0;
  if (!G.queue.length) { line.word = null; line.idle = true; line.elBelt.classList.remove('animate'); updateChip(line); setupAsm(line); checkPhaseEnd(); return; }
  const w = G.queue.shift();
  if (G.mode === 'prof') profWord(line, w);
  else if (G.mode === 'phase') {
    line.m = 'phase'; line.word = w;
    w.syl.forEach(s => addItem('syl', s, w.uid));
    pickDistractors(w, G.cfg.dist).forEach(s => addItem('syl', s, w.uid));
  } else {
    line.m = 'frases';
    const text = w.slice(0, -1), tokens = text.split(' ');
    line.word = { text: w, tokens, uid: ++WUID, emoji: '' };
    // palavras inteiras ou letras soltas
    let asLetters = tokens.map(t => t.length <= 5 && Math.random() < .5);
    if (!asLetters.some(Boolean)) { let j = 0; tokens.forEach((t, i) => { if (t.length < tokens[j].length) j = i; }); if (tokens[j].length <= 5) asLetters[j] = true; }
    if (tokens.length > 1 && asLetters.every(Boolean)) asLetters[tokens.reduce((m, t, i) => t.length > tokens[m].length ? i : m, 0)] = false;
    line.word.asLetters = asLetters;
    tokens.forEach((t, i) => { if (asLetters[i]) t.split('').forEach(c => addItem('letter', c, line.word.uid)); else addItem('word', t, line.word.uid); });
    const others = shuffle(FRASES.filter(f => f !== w)).slice(0, 4).join(' ').replace(/\./g, '').split(' ').filter(t => !tokens.includes(t) && t.length > 1);
    Array.from(new Set(others)).slice(0, 2).forEach(t => addItem('word', t, line.word.uid));
    shuffle(LETTERS).slice(0, 3).forEach(c => addItem('letter', c, line.word.uid));
  }
  line.idle = false; line.elBelt.classList.add('animate');
  updateChip(line); setupAsm(line); fitChip(line); layoutTray(false);
}
function updateChip(line) {
  const chip = line.elChip, wd = $('.wd', chip), emo = $('.emo', chip);
  chip.classList.toggle('idle', !line.word);
  if (!line.word) { emo.textContent = ''; emo.style.display = 'none'; wd.textContent = '✔'; wd.style.fontSize = '36px'; return; }
  if (line.word.img) { emo.innerHTML = '<img alt="" src="' + line.word.img + '">'; emo.style.display = ''; }
  else { emo.textContent = line.word.emoji || ''; emo.style.display = line.word.emoji ? '' : 'none'; }
  if (line.m === 'frases') { line.ci = 0; line.secIdx = 0; }
  else wd.textContent = line.word.text.toUpperCase();
}
function checkPhaseEnd() {
  if (G.mode === 'frases' || G.over) return;
  if (G.done >= G.total) after(500, G.mode === 'prof' ? () => finishProf(true) : finishPhase);
}

/* ---- arrastar e soltar ---- */
const stagePt = e => ({ x: (e.clientX - S.ox) / S.s, y: (e.clientY - S.oy) / S.s });
stage.addEventListener('pointerdown', e => {
  if (!G || G.paused || G.over || S.screen !== 'game' || G.drag) return;
  const t = e.target.closest ? e.target.closest('.crate') : null; if (!t) return;
  const it = G.byId[t.dataset.id]; if (!it || it.dead) return;
  const okState = it.state === 'tray' || it.state === 'belt' || (it.kind === 'empty' && it.state === 'asm');
  if (!okState) return;
  Snd.init(); e.preventDefault();
  const p = stagePt(e), ox = clamp((p.x - it.x) / it.sc, 0, it.w), oy = clamp((p.y - it.y) / it.sc, 0, CH);
  const from = it.state, fromLine = it.line;
  if (from === 'belt') fromLine.items = fromLine.items.filter(o => o !== it);
  if (from === 'asm') { fromLine.asm = fromLine.asm.filter(o => o !== it); repackAsm(fromLine, true); }
  it.tween = null; it.state = 'drag'; it.sc = 1; it.x = p.x - ox; it.y = p.y - oy; place(it);
  it.el.classList.add('drag'); face(it, 'surprise'); Snd.pick();
  G.drag = { it, ox, oy, sx: p.x, sy: p.y, t0: performance.now(), moved: false, from, fromLine, pid: e.pointerId };
  try { stage.setPointerCapture(e.pointerId); } catch (er) {}
});
stage.addEventListener('pointermove', e => {
  const d = G && G.drag; if (!d || e.pointerId !== d.pid) return;
  const p = stagePt(e), it = d.it;
  it.x = p.x - d.ox; it.y = p.y - d.oy; place(it);
  if (Math.hypot(p.x - d.sx, p.y - d.sy) > 10) d.moved = true;
  const ln = lineAt(it);
  G.lines.forEach(l => l.elBelt.classList.toggle('hot', l === ln));
});
const endDrag = e => {
  const d = G && G.drag; if (!d || (e && e.pointerId !== d.pid)) return;
  G.drag = null; const it = d.it;
  it.el.classList.remove('drag'); G.lines.forEach(l => l.elBelt.classList.remove('hot'));
  const tap = !d.moved && performance.now() - d.t0 < 450;
  if (tap) return onTap(it, d);
  const ln = lineAt(it);
  if (ln && !ln.idle && dropOnBelt(it, ln, it.x + it.w / 2)) return;
  if (it.kind === 'empty') return dispose(it, true);
  toTray(it);
};
stage.addEventListener('pointerup', endDrag);
stage.addEventListener('pointercancel', endDrag);
function lineAt(it) {
  const cx = it.x + it.w / 2, cy = it.y + CH / 2;
  return G.lines.find(l => cx > l.belt.x - 30 && cx < l.belt.x + l.belt.len + 30 && cy > l.belt.y - CH - 34 && cy < l.belt.y + 70);
}
function onTap(it, d) {
  if (it.kind === 'empty') return dispose(it, true);
  if (d.from === 'tray' && G.L === 1 && G.mode !== 'frases' && !G.lines[0].idle) {
    if (dropOnBelt(it, G.lines[0], G.lines[0].belt.x + 14 + it.w / 2, true)) return;
  }
  toTray(it);
  if (d.from === 'tray' && G.L > 1) toast('Arraste a sílaba até a esteira.', 1800);
}
function toTray(it) {
  it.state = 'tray'; it.line = null; face(it, 'neutral');
  it.sc = 1; G.trayOrder = G.trayOrder.filter(id => id !== it.id); G.trayOrder.splice(Math.floor(Math.random() * (G.trayOrder.length + 1)), 0, it.id);
  layoutTray(false);
  if (it.home && !it.tween) moveTo(it, it.home.x, it.home.y, 240, easeOut, null, it.home.sc);
}
function nearestFree(line, it, want) {
  const lo = 14, hi = line.belt.len - 14 - it.w - 6; if (hi < lo) return null;
  const occ = line.items.filter(o => o !== it).map(o => [o.bx - 6, o.bx + o.w + 6]);
  const ok = x => x >= lo && x <= hi && occ.every(([a, b]) => x + it.w <= a || x >= b);
  want = clamp(want, lo, hi);
  if (ok(want)) return want;
  let best = null, bd = 1e9; const c = [lo, hi]; occ.forEach(([a, b]) => { c.push(a - it.w, b); });
  c.forEach(x => { if (ok(x)) { const dd = Math.abs(x - want); if (dd < bd) { bd = dd; best = x; } } });
  return best;
}
function dropOnBelt(it, line, cx, strict) {
  const bx = nearestFree(line, it, cx - line.belt.x - it.w / 2); if (bx == null) return false;
  if (strict && bx > 18) { toast('Espere a esteira andar um pouco.', 1400); return false; }
  it.state = 'belt'; it.line = line; it.bx = bx; it.sc = 1; face(it, 'joy'); line.items.push(it);
  moveTo(it, line.belt.x + bx, line.belt.y - CH + 6, 110, easeOut);
  Snd.drop(); layoutTray(false);
  return true;
}
function dispose(it, anim) {
  if (it.dead) return; it.dead = true; it.tween = null;
  if (it.line) { it.line.items = it.line.items.filter(o => o !== it); it.line.asm = it.line.asm.filter(o => o !== it); }
  G.items = G.items.filter(o => o !== it); delete G.byId[it.id]; G.trayOrder = G.trayOrder.filter(id => id !== it.id);
  if (anim) { Snd.poof(); it.el.classList.add('fade'); setTimeout(() => it.el.remove(), 280); } else it.el.remove();
  if (G.lines) G.lines.forEach(l => repackAsm(l, true));
  layoutTray(false);
}

/* ---- chegada, conferência, acerto e erro ---- */
function arrive(it, line) {
  line.items = line.items.filter(o => o !== it); it.line = line; it.state = 'fly'; line.asm.push(it);
  const k = line.asm.length - 1, t = asmTarget(line, k, it);
  face(it, 'surprise'); Snd.land();
  moveTo(it, t.x, t.y, 380, bounce, () => { it.state = 'asm'; face(it, it.kind === 'empty' ? 'sleepy' : 'joy'); afterLanding(line); }, t.sc);
  if (it.kind === 'empty' && !G.hintJunk) { G.hintJunk = true; toast('Caixote vazio na montagem! Toque nele para retirar.', 3200); }
}
function simulate(tokens, real) {
  let ci = 0, buf = '';
  for (const it of real) {
    if (ci >= tokens.length) return { s: 'bad' };
    const tk = tokens[ci];
    if (it.kind === 'word') { if (buf) return { s: 'bad' }; if (it.text !== tk) return { s: 'bad' }; ci++; }
    else { buf += it.text; if (!tk.startsWith(buf)) return { s: 'bad' }; if (buf.length === tk.length) { ci++; buf = ''; } }
  }
  return { s: ci === tokens.length ? 'ok' : 'partial', ci };
}
function afterLanding(line) {
  if (line.busy || line.merging || !line.word || G.over) return;
  if (line.asm.some(i => i.state !== 'asm')) return;
  const real = line.asm.filter(i => i.kind !== 'empty'), junk = line.asm.length - real.length;
  if (line.m === 'phase') {
    const n = line.word.syl.length;
    if (real.length < n) return;
    const formed = real.map(i => i.text).join('');
    if (!junk && formed === line.word.text) return succeed(line);
    return fail(line, junk ? 'TIRE O CAIXOTE VAZIO!' : formed.toUpperCase());
  }
  const sim = simulate(line.word.tokens, real);
  markTokens(line, sim.ci || 0);
  if (sim.s === 'bad') return fail(line, real.map(i => i.text).join('').toUpperCase());
  const grp = letterGroups(line, real);
  if (grp.length) return mergeGroups(line, grp, false, () => afterLanding(line));
  if (sim.s === 'ok') { if (junk) return fail(line, 'TIRE O CAIXOTE VAZIO!'); return succeed(line); }
}
function markTokens(line, ci) {
  line.ci = ci;
  if (line.spec && line.spec.sections) { const k = line.spec.sections.findIndex(sec => sec.includes(Math.min(ci, line.word.tokens.length - 1))); if (k >= 0) line.secIdx = k; }
  renderTokens(line);
}
function showMark(line, cls, text) {
  const m = document.createElement('div'); m.className = 'mark ' + cls; m.textContent = text;
  const r = line.asmRect; Object.assign(m.style, { left: r.x + 'px', top: (line.asmY - 6) + 'px', width: r.w + 'px', height: (line.asmH + 12) + 'px' });
  G.elLines.appendChild(m); return m;
}
function succeed(line) {
  line.busy = true; line.elBelt.classList.remove('animate');
  const m = showMark(line, 'good', '✔');
  if (line.m === 'phase' && line.asm.length > 1) mergeGroups(line, [{ items: line.asm.slice(), text: line.word.text }], true);
  else line.asm.forEach(i => { i.el.classList.add('pulse'); face(i, 'joy'); });
  Snd.ok(); speak(G.mode === 'frases' ? line.word.text : line.word.text);
  let pts;
  if (line.m === 'phase') pts = Math.max(40, 100 - 15 * line.errs) * G.level;
  else { pts = 50 + 15 * line.word.tokens.length + Math.min(G.combo, 10) * 10; G.combo++; G.sentences++; }
  G.done++;
  G.score += pts; hud();
  const f = document.createElement('div'); f.className = 'float'; f.textContent = '+' + pts; f.style.left = (line.asmRect.x + line.asmRect.w / 2 - 30) + 'px'; f.style.top = (line.asmY - 24) + 'px'; G.elLines.appendChild(f); setTimeout(() => f.remove(), 1200);
  const uid = line.word.uid;
  after(1100, () => {
    m.remove();
    line.asm.slice().forEach(i => { i.el.classList.add('fade'); });
    setTimeout(() => {}, 0);
    G.items.filter(i => i.own === uid).forEach(i => { if (i.state === 'drag') return; dispose(i, false); });
    line.asm = []; line.items = line.items.filter(i => !i.dead); line.busy = false;
    nextWord(line);
  });
}
function fail(line, formed) {
  line.busy = true; line.elBelt.classList.remove('animate');
  G.errors++; line.errs++; if (line.m === 'frases') { G.combo = 0; G.score = Math.max(0, G.score - 20); }
  hud(); Snd.bad();
  const m = showMark(line, 'bad', '✖ ' + formed);
  line.asm.forEach(i => i.el.classList.add('shake'));
  after(1100, () => {
    m.remove();
    const back = line.asm.concat(line.items.filter(i => i.state === 'belt' && i.kind !== 'empty'));
    line.items = line.items.filter(i => i.kind === 'empty'); line.asm = [];
    back.forEach(i => { i.el.classList.remove('shake', 'pulse'); if (i.kind === 'empty') dispose(i, true); else if (i.parts) { const own = i.own, parts = i.parts; dispose(i, false); parts.forEach(c => addItem('letter', c, own)); } else { i.line = null; toTray(i); } });
    if (line.m === 'frases') markTokens(line, 0);
    line.busy = false;
    if (G.mode === 'prof' && G.maxErr && G.errors > G.maxErr) return finishProf(false); line.elBelt.classList.toggle('animate', !line.idle);
    layoutTray(false);
  });
}

/* ---- caixotes vazios ---- */
function spawnEmpty() {
  const cands = G.lines.filter(l => l.word && !l.busy);
  if (!cands.length || G.items.filter(i => i.kind === 'empty').length >= G.L + 1) return;
  const line = pick(cands), tmp = { w: 50 };
  for (let k = 0; k < 8; k++) {
    const want = rnd(.12, .7) * line.belt.len, bx = nearestFree(line, tmp, want);
    if (bx == null || Math.abs(bx - want) > 30) continue;
    const it = mkItem('empty', '', G.elItems); G.items.push(it); G.byId[it.id] = it;
    it.state = 'fall'; it.line = line; it.bx = bx; face(it, 'surprise');
    it.x = line.belt.x + bx; it.y = -70; place(it);
    moveTo(it, it.x, line.belt.y - CH + 6, 650, bounce, () => { it.state = 'belt'; face(it, 'joy'); line.items.push(it); Snd.land(); });
    if (!G.hintEmpty) { G.hintEmpty = true; toast('Caixote vazio na esteira! Toque nele ou arraste para fora.', 3600); }
    return;
  }
}

/* ---- fim de fase / tempo ---- */
function stars(n) { return `<span>${'★'.repeat(n)}</span><span class="off">${'★'.repeat(3 - n)}</span>`; }
function finishPhase() {
  if (G.over) return; G.over = true;
  const p = me(), idx = (G.level - 1) * 10 + G.phase - 1, st = G.errors <= 1 ? 3 : G.errors <= 4 ? 2 : 1;
  const wasAll = campaignDone(p) && !p.teacher, firstDone = p.stars[idx] === 0;
  p.stars[idx] = Math.max(p.stars[idx], st); p.best[idx] = Math.max(p.best[idx], G.score); saveDB();
  const nowAll = p.stars.every(x => x > 0);
  Snd.win();
  $('#rs-title').textContent = nowAll && !wasAll && firstDone ? 'CAMPANHA CONCLUÍDA!' : 'FASE CONCLUÍDA!';
  $('#rs-stars').innerHTML = stars(st);
  $('#rs-body').innerHTML = `Palavras montadas: <em>10</em><br>Erros: <em>${G.errors}</em><br>Pontos: <em>${G.score}</em>` +
    (nowAll && !wasAll && firstDone ? '<br><br>🎉 Você liberou o modo <em>Contra o Tempo das Frases</em>!' : '');
  const btns = $('#rs-btns'); btns.innerHTML = '';
  const add = (txt, cls, fn) => { const b = document.createElement('button'); b.className = 'btn wide ' + cls; b.textContent = txt; b.onclick = () => { closeOv('ov-result'); fn(); }; btns.appendChild(b); };
  const nl = G.level, nf = G.phase, nextIdx = idx + 1;
  if (nextIdx < 50) { const L2 = Math.floor(nextIdx / 10) + 1, F2 = nextIdx % 10 + 1; add('PRÓXIMA FASE', 'ok', () => startPhase(L2, F2)); }
  add('JOGAR DE NOVO', '', () => startPhase(nl, nf));
  if (nowAll && !wasAll && firstDone || campaignDone(p) && !p.teacher) add('⏱ CONTRA O TEMPO DAS FRASES', 'ok', () => startFrases());
  add('MAPA DE FASES', 'alt', () => { G = null; show('map'); });
  $('#ov-result').classList.add('on');
}
function finishFrases() {
  if (G.over) return; G.over = true;
  const p = me(), rec = G.score > p.sent.best;
  p.sent.runs++; if (rec) p.sent.best = G.score; saveDB(); Snd.win();
  $('#rs-title').textContent = 'TEMPO ESGOTADO!';
  $('#rs-stars').innerHTML = '⏱';
  $('#rs-body').innerHTML = `Frases montadas: <em>${G.sentences}</em><br>Erros: <em>${G.errors}</em><br>Pontos: <em>${G.score}</em>` + (rec ? '<br>🏆 <em>Novo recorde!</em>' : `<br>Seu recorde: <em>${p.sent.best}</em>`);
  const btns = $('#rs-btns'); btns.innerHTML = '';
  const add = (txt, cls, fn) => { const b = document.createElement('button'); b.className = 'btn wide ' + cls; b.textContent = txt; b.onclick = () => { closeOv('ov-result'); fn(); }; btns.appendChild(b); };
  add('JOGAR DE NOVO', 'ok', () => startFrases());
  add('RANKING', '', () => { G = null; show('map'); rkTab = 2; buildRank(); openOv('ov-rank'); });
  add('MAPA DE FASES', 'alt', () => { G = null; show('map'); });
  $('#ov-result').classList.add('on');
}

/* ================= COM O PROF: conteúdo do professor ================= */
const PKEY = 'fabricaPalavrasARS.prof.v1';
const PASS = 'prof123';
const DIFF = ['', 'Muito fácil', 'Fácil', 'Médio', 'Difícil', 'Desafio'];
const SPEEDS = [['1', 'Muito lenta'], ['2', 'Lenta'], ['3', 'Normal'], ['4', 'Rápida'], ['5', 'Muito rápida']];
const EMPS = [['0', 'Sem caixotes vazios'], ['1', 'Poucos caixotes vazios'], ['2', 'Caixotes vazios médios'], ['3', 'Muitos caixotes vazios']];
const TYPES = [['syl', 'Sílabas → palavra'], ['sent', 'Palavras/letras → frase'], ['text', 'Texto em sequência (frases em ordem)']];
const FMTS = [['misto', 'Misto (palavras e letras soltas)'], ['palavras', 'Só palavras inteiras'], ['letras', 'Só letras soltas']];
const uid8 = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
function normPhase(p) {
  p = p || {};
  return { id: p.id || uid8(), name: p.name || '', type: ['syl', 'sent', 'text'].includes(p.type) ? p.type : 'syl', fmt: p.fmt || 'misto', shuffle: p.shuffle !== false, dist: p.dist == null ? 3 : clamp(+p.dist || 0, 0, 8), extra: p.extra || '', time: Math.max(0, +p.time || 0), maxErr: Math.max(0, +p.maxErr || 0),
    chal: (c => ({ on: !!c.on, init: !!c.init, lines: clamp(+c.lines || 1, 1, 4), speed: clamp(+c.speed || 3, 1, 5), empties: clamp(+c.empties || 0, 0, 3), diff: clamp(+c.diff || 1, 1, 5) }))(p.chal || {}),
    items: (Array.isArray(p.items) ? p.items : []).map(i => ({ t: String(i.t || ''), e: String(i.e || ''), img: String(i.img || '') })) };
}
function normLevel(l) {
  l = l || {};
  return { id: l.id || uid8(), name: l.name || 'Novo nível', diff: clamp(+l.diff || 1, 1, 5), lines: clamp(+l.lines || 1, 1, 4), speed: clamp(+l.speed || 3, 1, 5), empties: clamp(+l.empties || 0, 0, 3), free: !!l.free, rules: l.rules || '', active: !!l.active, phases: (Array.isArray(l.phases) ? l.phases : []).map(normPhase) };
}
function loadProf() { try { const d = JSON.parse(localStorage.getItem(PKEY)); if (d && Array.isArray(d.levels)) return { levels: d.levels.map(normLevel) }; } catch (e) {} return { levels: [] }; }
let PROF = loadProf();
let saveT = 0;
function saveProf(now) { clearTimeout(saveT); const go = () => { try { localStorage.setItem(PKEY, JSON.stringify(PROF)); } catch (e) { toast('Sem espaço para salvar. Use imagens menores.', 3500); } }; if (now) go(); else saveT = setTimeout(go, 350); }
const phasePlayable = ph => ph.items.some(i => i.t.trim());
const profActive = () => PROF.levels.filter(l => l.active && l.phases.some(phasePlayable));

/* ---- separação silábica (ajuda ao professor; sempre conferir a prévia) ---- */
const VOW = 'aeiouáéíóúâêôãõàü', STRONG = 'aeoáéóâêô';
function syllabify(w) {
  w = w.toLowerCase().replace(/[^a-záéíóúâêôãõàçü-]/g, '');
  if (w.includes('-')) return w;
  const ch = w.split(''), seq = [];
  for (let i = 0; i < ch.length; i++) {
    const c = ch[i], n = ch[i + 1];
    if (['ch', 'lh', 'nh'].includes(c + (n || ''))) { seq.push({ c: c + n }); i++; continue; }
    if ((c === 'q' || c === 'g') && n === 'u' && 'eiéíêî'.includes(ch[i + 2] || '#')) { seq.push({ c: c + 'u' }); i++; continue; }
    if (VOW.includes(c)) {
      const prev = seq[seq.length - 1];
      if (prev && prev.n) { const a = prev.c.slice(-1); if (!((STRONG.includes(a) && STRONG.includes(c)) || 'íú'.includes(c))) { prev.c += c; continue; } }
      seq.push({ c, n: true });
    } else seq.push({ c });
  }
  const Ni = []; seq.forEach((t, k) => t.n && Ni.push(k));
  if (Ni.length < 2) return w;
  const syl = []; let start = 0;
  for (let j = 0; j < Ni.length; j++) {
    const k = Ni[j];
    if (j === Ni.length - 1) { syl.push(seq.slice(start).map(t => t.c).join('')); break; }
    const nk = Ni[j + 1], cs = seq.slice(k + 1, nk), n = cs.length; let cut;
    if (n <= 1) cut = k + 1;
    else { const a = cs[n - 2].c, b = cs[n - 1].c; cut = ('bcdfgptv'.includes(a) && a.length === 1 && (b === 'l' || b === 'r')) ? nk - 2 : nk - 1; }
    syl.push(seq.slice(start, cut).map(t => t.c).join('')); start = cut;
  }
  return syl.join('-');
}
const parseSyl = t => { const clean = t.toLowerCase().replace(/[^a-záéíóúâêôãõàçü-]/g, ''); const h = clean.includes('-') ? clean : syllabify(clean); const syl = h.split('-').filter(Boolean); return { syl, text: syl.join(''), uid: ++WUID }; };
function parseSent(t) {
  const raw = t.trim().replace(/\s+/g, ' '), m = raw.match(/[.!?…]+$/), punct = m ? m[0] : '';
  const body = (m ? raw.slice(0, -m[0].length) : raw).toLowerCase().replace(/[,;:"“”()¿¡]/g, '').trim();
  return { text: body + punct, tokens: body.split(' ').filter(Boolean), punct, uid: ++WUID };
}
function buildPool(lv, type) {
  const set = new Set();
  lv.phases.forEach(p => { if ((p.type === 'syl') === (type === 'syl')) p.items.forEach(it => { if (!it.t.trim()) return; if (type === 'syl') parseSyl(it.t).syl.forEach(s => set.add(s)); else parseSent(it.t).tokens.forEach(t => set.add(t)); }); });
  return Array.from(set);
}

/* ---- motor: palavra/frase do professor ---- */
function profWord(line, w) {
  const ph = G.ph, dist = ph.dist == null ? 3 : ph.dist;
  const extra = (ph.extra || '').split(/[,;\s]+/).map(x => x.trim().toLowerCase()).filter(Boolean);
  if (w.m === 'phase') {
    line.m = 'phase'; line.word = w;
    w.syl.forEach(s => addItem('syl', s, w.uid));
    const ex = extra.filter(x => !w.syl.includes(x));
    ex.forEach(s => addItem('syl', s, w.uid));
    pickDistractors(w, dist).filter(s => !ex.includes(s)).forEach(s => addItem('syl', s, w.uid));
  } else {
    line.m = 'frases';
    const tokens = w.tokens, fmt = ph.fmt || 'misto';
    let as = tokens.map(t => fmt === 'letras' ? true : fmt === 'palavras' ? false : (t.length <= 5 && Math.random() < .5));
    if (fmt === 'misto') {
      if (!as.some(Boolean)) { let j = 0; tokens.forEach((t, i) => { if (t.length < tokens[j].length) j = i; }); if (tokens[j].length <= 5) as[j] = true; }
      if (tokens.length > 1 && as.every(Boolean)) as[tokens.reduce((m, t, i) => t.length > tokens[m].length ? i : m, 0)] = false;
    }
    line.word = { text: w.text, tokens, uid: w.uid, emoji: w.emoji, img: w.img, punct: w.punct, m: 'frases' };
    line.word.asLetters = as;
    tokens.forEach((t, i) => { if (as[i]) t.split('').forEach(c => addItem('letter', c, w.uid)); else addItem('word', t, w.uid); });
    extra.forEach(x => addItem(x.length === 1 ? 'letter' : 'word', x, w.uid));
    const nw = fmt === 'letras' ? 0 : Math.ceil(dist / 2), nl = fmt === 'letras' ? dist : Math.floor(dist / 2);
    shuffle(G.pool.filter(t => !tokens.includes(t) && !extra.includes(t))).slice(0, nw).forEach(t => addItem('word', t, w.uid));
    shuffle(LETTERS).slice(0, nl).forEach(c => addItem('letter', c, w.uid));
  }
}
function startProf(lv, pi, test) {
  $$('.ov').forEach(o => o.classList.remove('on'));
  const ph = lv.phases[pi], items = ph.items.filter(i => i.t.trim());
  if (!items.length) { toast('Esta fase ainda não tem itens.'); return; }
  const type = ph.type === 'syl' ? 'syl' : 'sent';
  const q = items.map(it => Object.assign(type === 'syl' ? parseSyl(it.t) : parseSent(it.t), { m: type === 'syl' ? 'phase' : 'frases', emoji: it.e || '', img: it.img || '' }));
  const cf = ph.chal && ph.chal.on ? ph.chal : lv;
  G = newGame({ mode: 'prof', level: cf.diff, lv, ph, pi, test: !!test, L: cf.lines, speed: [55, 75, 95, 115, 140][cf.speed - 1], emptyEvery: [0, 14, 10, 7][cf.empties], total: q.length, limit: ph.time || 0, time: ph.time || 0, maxErr: ph.maxErr || 0, spawnT: 8 });
  G.queue = ph.type === 'text' || ph.shuffle === false ? q : shuffle(q); G.pool = buildPool(lv, type);
  if (type === 'sent') G.texts = q.map(w => ({ tokens: w.tokens.map((t, i, a) => i === a.length - 1 ? t + w.punct : t), vis: !!(w.emoji || w.img) }));
  $('#g-title').textContent = (test ? 'TESTE · ' : '') + (cf !== lv ? '⚔ ' : '') + (lv.name + ' · ' + (ph.name || 'Fase ' + (pi + 1))).slice(0, 34);
  $('#g-time').classList.toggle('hidden', !G.limit);
  show('game'); hud(); layoutGame();
  G.lines.forEach(l => nextWord(l));
  toast(lv.rules ? lv.rules.slice(0, 140) : 'Monte na esteira o que aparece no painel!', 3800);
}
function resultBtns(list) {
  const btns = $('#rs-btns'); btns.innerHTML = '';
  list.forEach(([txt, cls, fn]) => { const b = document.createElement('button'); b.className = 'btn wide ' + cls; b.textContent = txt; b.onclick = () => { closeOv('ov-result'); fn(); }; btns.appendChild(b); });
  $('#ov-result').classList.add('on');
}
function finishProf(win) {
  if (G.over) return; G.over = true;
  const g = G, lv = g.lv, ph = g.ph, pi = g.pi, st = win ? (g.errors <= 1 ? 3 : g.errors <= 4 ? 2 : 1) : 0, p = me();
  if (win && !g.test && p) { p.prof = p.prof || {}; p.prof[ph.id] = Math.max(p.prof[ph.id] || 0, st); saveDB(); }
  win ? Snd.win() : Snd.bad();
  $('#rs-title').textContent = win ? 'FASE CONCLUÍDA!' : (g.limit && g.time <= 0 ? 'TEMPO ESGOTADO!' : 'MUITOS ERROS!');
  $('#rs-stars').innerHTML = win ? stars(st) : '✖';
  $('#rs-body').innerHTML = `Montados: <em>${g.done}/${g.total}</em><br>Erros: <em>${g.errors}</em><br>Pontos: <em>${g.score}</em>` + (g.test ? '<br><br><small>(teste: nada é salvo)</small>' : '');
  const L = [], nxt = lv.phases[pi + 1];
  if (win && !g.test && nxt && phasePlayable(nxt)) L.push(['PRÓXIMA FASE', 'ok', () => startProf(lv, pi + 1, false)]);
  L.push([win ? 'JOGAR DE NOVO' : 'TENTAR DE NOVO', win ? '' : 'ok', () => startProf(lv, pi, g.test)]);
  L.push([g.test ? 'VOLTAR À OFICINA' : 'MAPA DO PROF', 'alt', () => { G = null; leaveTo(g); }]);
  resultBtns(L);
}
function leaveTo(g) { if (g && g.mode === 'prof') { if (g.test) show('ofi'); else show('prof'); } else show('map'); }
function leaveGame() { const g = G; G = null; leaveTo(g); }

/* ---- mapa do aluno ---- */
function buildProfMap() {
  const p = me(); if (!p) { show('title'); return; }
  p.prof = p.prof || {};
  const body = $('#prof-body'); body.innerHTML = ''; let tot = 0;
  profActive().forEach(lv => {
    const grid = E('div', { class: 'lvl-grid' });
    lv.phases.forEach((ph, i) => {
      if (!phasePlayable(ph)) return;
      const st = p.prof[ph.id] || 0, prev = lv.phases[i - 1], open = p.teacher || lv.free || i === 0 || !prev || (p.prof[prev.id] || 0) > 0 || !phasePlayable(prev);
      tot += st;
      const b = E('button', { class: 'ph' + (ph.name ? ' tx' : '') + (st ? ' done' : !open ? ' lock' : ''), title: (ph.name || '') + (ph.chal.on ? ' — Desafio: ' + DIFF[ph.chal.diff] : '') });
      b.innerHTML = !open ? '🔒' : (ph.chal.on ? '<span class="sw">⚔</span>' : '') + `${esc(ph.name ? ph.name.slice(0, 12) : i + 1)}<span class="st">${st ? '★'.repeat(st) + '☆'.repeat(3 - st) : ''}</span>`;
      if (open) b.onclick = () => { Snd.init(); startProf(lv, i, false); };
      grid.appendChild(b);
    });
    body.appendChild(E('div', { class: 'lvl prof' },
      E('div', { class: 'lvl-h' }, E('b', {}, lv.name), E('span', { class: 'dif' }, '★'.repeat(lv.diff) + '☆'.repeat(5 - lv.diff)), E('span', {}, DIFF[lv.diff] + ' · ' + lv.lines + (lv.lines > 1 ? ' esteiras' : ' esteira'))),
      lv.rules ? E('div', { class: 'rules' }, lv.rules) : null, grid));
  });
  $('#prof-stars').textContent = '★ ' + tot;
  if (!profActive().length) body.appendChild(E('div', { class: 'rk-empty' }, 'Nenhum nível do professor disponível.'));
}

/* ---- oficina ---- */
function E(tag, props, ...kids) {
  const e = document.createElement(tag); let val;
  for (const k in (props || {})) {
    const v = props[k];
    if (k === 'class') e.className = v; else if (k === 'html') e.innerHTML = v; else if (k === 'value') val = v;
    else if (k.startsWith('on')) e.addEventListener(k.slice(2), v); else e.setAttribute(k, v);
  }
  kids.flat().forEach(c => { if (c != null && c !== false) e.append(c.nodeType ? c : document.createTextNode(c)); });
  if (val !== undefined) e.value = val;
  return e;
}
const OF = { view: 'home', lv: null, ph: null };
const F = (label, node, hint) => E('label', { class: 'fld' }, E('span', {}, label), node, hint ? E('small', { class: 'help' }, hint) : null);
const txt = (o, k, ph, onc) => { const i = E('input', { type: 'text', value: o[k] || '', placeholder: ph || '', oninput: () => { o[k] = i.value; saveProf(); if (onc) onc(); } }); return i; };
const sel = (o, k, opts, after) => E('select', { value: String(o[k]), onchange: ev => { o[k] = typeof o[k] === 'number' ? Number(ev.target.value) : ev.target.value; saveProf(); if (after) after(); } }, opts.map(([v, l]) => E('option', { value: v }, l)));
const num = (o, k, min, max) => { const i = E('input', { type: 'number', min, max, value: o[k], oninput: () => { o[k] = clamp(parseInt(i.value, 10) || 0, min, max); saveProf(); } }); return i; };
const chk = (o, k, label) => { const c = E('input', { type: 'checkbox', style: 'width:26px;height:26px' }); c.checked = !!o[k]; c.onchange = () => { o[k] = c.checked; saveProf(); }; return E('label', { class: 'row', style: 'gap:10px;font-size:20px;margin-bottom:12px;flex-wrap:nowrap' }, c, label); };
const btn = (label, cls, fn) => E('button', { class: 'sbtn ' + (cls || ''), type: 'button', onclick: fn }, label);

function renderOfi() {
  const body = $('#ofi-body'), title = $('#ofi-title'); body.innerHTML = '';
  const wrap = E('div', { class: 'ofi-wrap' }); body.appendChild(wrap);
  if (OF.view === 'phase' && (!OF.lv || !OF.ph)) OF.view = 'home';
  if (OF.view === 'level' && !OF.lv) OF.view = 'home';
  if (OF.view === 'home') { title.textContent = 'OFICINA DO PROFESSOR'; ofiHome(wrap); }
  else if (OF.view === 'level') { title.textContent = 'EDITAR NÍVEL'; ofiLevel(wrap); }
  else { title.textContent = 'EDITAR FASE'; ofiPhase(wrap); }
  body.scrollTop = 0;
}
function ofiHome(w) {
  w.appendChild(E('p', { class: 'help' }, 'Crie níveis e fases para a sua turma. Só os níveis marcados como ATIVOS (com ao menos uma fase) aparecem para os alunos no modo “Com o Prof”. Tudo fica salvo neste aparelho; para levar a outro, use Exportar e Importar.'));
  const imp = E('input', { type: 'file', accept: '.json,application/json', style: 'display:none', onchange: ev => importProf(ev.target.files[0]) });
  w.appendChild(E('div', { class: 'row', style: 'margin-bottom:16px' },
    btn('+ NOVO NÍVEL', 'y', () => { const l = normLevel({ name: 'Nível ' + (PROF.levels.length + 1) }); PROF.levels.push(l); saveProf(true); OF.lv = l; OF.view = 'level'; renderOfi(); }),
    btn('⬇ EXPORTAR', '', exportProf), btn('⬆ IMPORTAR', '', () => imp.click()), imp));
  if (!PROF.levels.length) w.appendChild(E('div', { class: 'card' }, 'Você ainda não criou nenhum nível. Toque em “+ NOVO NÍVEL”.'));
  PROF.levels.forEach((lv, i) => {
    const ok = lv.phases.some(phasePlayable);
    w.appendChild(E('div', { class: 'card' + (lv.active ? '' : ' off') },
      E('div', { class: 'row', style: 'margin-bottom:10px' }, E('b', { style: 'font-size:28px', class: 'grow' }, lv.name),
        E('span', { class: 'pill' + (lv.active ? ' on' : '') }, lv.active ? 'ATIVO NA TURMA' : 'RASCUNHO'), E('span', { class: 'pill' }, DIFF[lv.diff]), E('span', { class: 'pill' }, lv.lines + ' esteira(s)'), E('span', { class: 'pill' }, lv.phases.length + ' fase(s)')),
      E('div', { class: 'row' },
        btn('✎ EDITAR', 'y', () => { OF.lv = lv; OF.view = 'level'; renderOfi(); }),
        btn(lv.active ? 'DESATIVAR' : 'ATIVAR PARA A TURMA', lv.active ? '' : 'g', () => { if (!lv.active && !ok) { toast('Crie ao menos uma fase com itens antes de ativar.', 3000); return; } lv.active = !lv.active; saveProf(true); renderOfi(); }),
        btn('DUPLICAR', '', () => { const c = normLevel(JSON.parse(JSON.stringify(lv))); c.id = uid8(); c.name += ' (cópia)'; c.active = false; c.phases.forEach(p => p.id = uid8()); PROF.levels.splice(i + 1, 0, c); saveProf(true); renderOfi(); }),
        btn('EXCLUIR', 'r', () => confirmBox('Excluir nível?', '“' + lv.name + '” e todas as suas fases serão apagados.', () => { PROF.levels.splice(i, 1); saveProf(true); renderOfi(); })))));
  });
}
function dragPhase(ev, lv, from, card, list) {
  if (ev.button > 0) return;
  ev.preventDefault();
  const body = $('#ofi-body'), cards = Array.from(list.children), handle = ev.currentTarget;
  try { handle.setPointerCapture(ev.pointerId); } catch (e) {}
  const startY = ev.clientY, startScroll = body.scrollTop; let y = ev.clientY, target = from, speed = 0;
  const line = E('div', { class: 'drop-line' });
  card.classList.add('dragging');
  const upd = () => {
    const dy = (y - startY) / S.s + (body.scrollTop - startScroll);
    card.style.transform = `translateY(${dy}px)`;
    let t = 0; cards.forEach(c => { if (c === card) return; const r = c.getBoundingClientRect(); if (y > r.top + r.height / 2) t++; });
    target = clamp(t, 0, cards.length - 1);
    const ref = cards.filter(c => c !== card)[target]; line.remove();
    if (ref) list.insertBefore(line, ref); else list.appendChild(line);
  };
  const tick = setInterval(() => { if (speed) { body.scrollTop += speed; upd(); } }, 16);
  const mv = e => {
    y = e.clientY; const r = body.getBoundingClientRect(), z = 70 * S.s;
    speed = y < r.top + z ? -10 : y > r.bottom - z ? 10 : 0; upd();
  };
  const end = () => {
    clearInterval(tick); handle.removeEventListener('pointermove', mv); handle.removeEventListener('pointerup', end); handle.removeEventListener('pointercancel', end);
    if (target !== from) { const [m] = lv.phases.splice(from, 1); lv.phases.splice(target, 0, m); saveProf(true); }
    renderOfi();
  };
  handle.addEventListener('pointermove', mv); handle.addEventListener('pointerup', end); handle.addEventListener('pointercancel', end);
  upd();
}
function ofiLevel(w) {
  const lv = OF.lv;
  w.appendChild(E('div', { class: 'card' },
    F('Nome do nível', txt(lv, 'name', 'ex.: Animais da fazenda')),
    E('div', { class: 'row' },
      E('div', { class: 'grow' }, F('Dificuldade', sel(lv, 'diff', [[1, 'Muito fácil'], [2, 'Fácil'], [3, 'Médio'], [4, 'Difícil'], [5, 'Desafio']]), 'Multiplica os pontos.')),
      E('div', { class: 'grow' }, F('Esteiras (palavras ao mesmo tempo)', sel(lv, 'lines', [[1, '1 esteira'], [2, '2 esteiras'], [3, '3 esteiras'], [4, '4 esteiras']])))),
    E('div', { class: 'row' },
      E('div', { class: 'grow' }, F('Velocidade da esteira', sel(lv, 'speed', SPEEDS.map(([v, l]) => [+v, l])))),
      E('div', { class: 'grow' }, F('Caixotes vazios (inimigos)', sel(lv, 'empties', EMPS.map(([v, l]) => [+v, l]), null), 'Caem na esteira; o aluno precisa retirá-los.'))),
    F('Regras / instruções para os alunos', E('textarea', { placeholder: 'ex.: Monte o nome de cada animal. Cuidado com os caixotes vazios!', oninput: ev => { lv.rules = ev.target.value; saveProf(); }, value: lv.rules })),
    chk(lv, 'free', 'Todas as fases liberadas (sem precisar concluir a anterior)'),
    chk(lv, 'active', 'Ativo: aparece para a turma no modo “Com o Prof”')));
  w.appendChild(E('h3', {}, 'FASES'));
  const plist = E('div', { class: 'plist' }); w.appendChild(plist);
  lv.phases.forEach((ph, i) => {
    const n = ph.items.filter(x => x.t.trim()).length;
    const handle = E('div', { class: 'drag-h', title: 'Segure e arraste para reordenar' }, '⠿');
    const card = E('div', { class: 'card pcard' },
      E('div', { class: 'row', style: 'margin-bottom:8px;flex-wrap:nowrap' }, handle, E('b', { style: 'font-size:24px', class: 'grow' }, (i + 1) + '. ' + (ph.name || 'Fase ' + (i + 1))), ph.chal.on ? E('span', { class: 'pill on' }, '⚔ Desafio · ' + DIFF[ph.chal.diff]) : null, E('span', { class: 'pill' }, TYPES.find(t => t[0] === ph.type)[1]), E('span', { class: 'pill' }, n + ' item(ns)')),
      E('div', { class: 'row' },
        btn('✎ EDITAR', 'y', () => { OF.ph = ph; OF.view = 'phase'; renderOfi(); }),
        btn('▶ TESTAR', 'g', () => { if (!n) { toast('Adicione itens a esta fase.'); return; } Snd.init(); saveProf(true); OF.ph = ph; startProf(lv, i, true); }),
        btn('DUPLICAR', '', () => { const c = normPhase(JSON.parse(JSON.stringify(ph))); c.id = uid8(); c.name = (c.name || 'Fase ' + (i + 1)) + ' (cópia)'; lv.phases.splice(i + 1, 0, c); saveProf(true); renderOfi(); }),
        btn('EXCLUIR', 'r', () => confirmBox('Excluir fase?', 'Esta fase será apagada.', () => { lv.phases.splice(i, 1); saveProf(true); renderOfi(); }))));
    handle.addEventListener('pointerdown', ev => dragPhase(ev, lv, i, card, plist));
    plist.appendChild(card);
  });
  if (lv.phases.length > 1) w.appendChild(E('p', { class: 'help' }, 'Dica: segure o ícone ⠿ de uma fase e arraste para reorganizar.'));
  w.appendChild(E('div', { class: 'row' }, btn('+ NOVA FASE', 'y', () => { const p = normPhase({}); p.name = ''; lv.phases.push(p); saveProf(true); OF.ph = p; OF.view = 'phase'; renderOfi(); })));
}
function cleanPhase(ph) { ph.items = ph.items.filter(i => i.t.trim() || i.img); }
function ofiPhase(w) {
  const lv = OF.lv, ph = OF.ph;
  const hints = { syl: 'Escreva cada palavra separando as sílabas com hífen (ex.: ga-to). Sem hífen, o jogo separa sozinho; use ✂ para conferir.', sent: 'Escreva uma frase por linha. Os alunos montam a frase com palavras e/ou letras soltas.', text: 'Escreva as frases do texto NA ORDEM. Os alunos montam uma frase por vez, em sequência.' };
  const opts = E('div', { class: 'card' });
  const hintEl = E('p', { class: 'help' }, hints[ph.type]);
  const fmtBox = E('div'), shufBox = E('div');
  const refreshType = () => { hintEl.textContent = hints[ph.type]; fmtBox.style.display = ph.type === 'syl' ? 'none' : ''; shufBox.style.display = ph.type === 'text' ? 'none' : ''; renderItems(); };
  fmtBox.appendChild(F('Como montar a frase', sel(ph, 'fmt', FMTS)));
  shufBox.appendChild(chk(ph, 'shuffle', 'Embaralhar a ordem dos itens'));
  opts.append(
    F('Nome da fase (opcional)', txt(ph, 'name', 'ex.: Frutas')),
    F('Tipo de fase', sel(ph, 'type', TYPES, refreshType)), hintEl, fmtBox, shufBox,
    E('div', { class: 'row' },
      E('div', { class: 'grow' }, F('Peças erradas (distratores)', num(ph, 'dist', 0, 8), 'Quantas peças extras aparecem no estoque.')),
      E('div', { class: 'grow' }, F('Tempo limite (segundos, 0 = sem)', num(ph, 'time', 0, 3600))),
      E('div', { class: 'grow' }, F('Máx. de erros (0 = sem limite)', num(ph, 'maxErr', 0, 99)))),
    F('Peças extras personalizadas (opcional)', txt(ph, 'extra', 'ex.: ba, ca, xo  (separe por vírgula ou espaço)'), 'Entram sempre no estoque como “pegadinhas”.'));
  w.appendChild(opts);
  const ch = ph.chal, chBox = E('div', { style: ch.on ? '' : 'display:none' });
  chBox.append(
    E('p', { class: 'help' }, 'Estas configurações valem só para esta fase e substituem as do nível.'),
    E('div', { class: 'row' },
      E('div', { class: 'grow' }, F('Dificuldade do desafio', sel(ch, 'diff', [[1, 'Muito fácil'], [2, 'Fácil'], [3, 'Médio'], [4, 'Difícil'], [5, 'Desafio']]), 'Multiplica os pontos.')),
      E('div', { class: 'grow' }, F('Esteiras', sel(ch, 'lines', [[1, '1 esteira'], [2, '2 esteiras'], [3, '3 esteiras'], [4, '4 esteiras']])))),
    E('div', { class: 'row' },
      E('div', { class: 'grow' }, F('Velocidade da esteira', sel(ch, 'speed', SPEEDS.map(([v, l]) => [+v, l])))),
      E('div', { class: 'grow' }, F('Caixotes vazios (inimigos)', sel(ch, 'empties', EMPS.map(([v, l]) => [+v, l]))))));
  const chOn = E('input', { type: 'checkbox' }); chOn.checked = ch.on;
  chOn.onchange = () => { ch.on = chOn.checked; if (ch.on && !ch.init) { ch.init = true; Object.assign(ch, { lines: lv.lines, speed: lv.speed, empties: lv.empties, diff: lv.diff }); saveProf(true); renderOfi(); return; } chBox.style.display = ch.on ? '' : 'none'; saveProf(true); };
  w.appendChild(E('div', { class: 'card' }, E('b', { style: 'font-size:24px' }, '⚔ DESAFIO'),
    E('p', { class: 'help' }, 'Opcional: dê a esta fase esteiras, inimigos e dificuldade próprios, diferentes do nível.'),
    E('label', { class: 'row', style: 'gap:10px;font-size:20px;margin-bottom:12px;flex-wrap:nowrap' }, chOn, 'Ativar desafio nesta fase'), chBox));
  w.appendChild(E('h3', {}, 'ITENS DA FASE'));
  const list = E('div'); w.appendChild(list);
  function renderItems() {
    list.innerHTML = '';
    ph.items.forEach((it, i) => {
      const pv = E('div', { class: 'pv' });
      const drawPv = () => { pv.innerHTML = ''; if (!it.t.trim()) return; (ph.type === 'syl' ? parseSyl(it.t).syl : parseSent(it.t).tokens).forEach(s => pv.appendChild(E('i', {}, s))); };
      const t = E('input', { type: 'text', class: 't', value: it.t, placeholder: ph.type === 'syl' ? 'ex.: ga-to' : 'ex.: O gato bebe leite.', oninput: () => { it.t = t.value; drawPv(); saveProf(); } });
      const e = E('input', { type: 'text', class: 'w-emo', value: it.e, maxlength: 4, placeholder: '😀', oninput: () => { it.e = e.value; saveProf(); } });
      const file = E('input', { type: 'file', accept: 'image/*', style: 'display:none', onchange: ev => { const f = ev.target.files[0]; if (f) readImg(f, d => { it.img = d; saveProf(true); renderItems(); }); } });
      const row = E('div', { class: 'irow' }, t, e, it.img ? E('img', { class: 'thumb', src: it.img, alt: '' }) : null, btn(it.img ? '✖ img' : '📷', '', () => { if (it.img) { it.img = ''; saveProf(true); renderItems(); } else file.click(); }), file,
        ph.type === 'syl' ? btn('✂', '', () => { t.value = it.t = syllabify(it.t); drawPv(); saveProf(); }) : null,
        btn('✕', 'r', () => { ph.items.splice(i, 1); saveProf(true); renderItems(); }), pv);
      drawPv(); list.appendChild(row);
    });
    if (!ph.items.length) list.appendChild(E('p', { class: 'help' }, 'Nenhum item ainda. Toque em “+ ADICIONAR ITEM” ou cole uma lista abaixo.'));
  }
  const bulk = E('textarea', { placeholder: 'Cole aqui uma lista (um item por linha). Emoji opcional após “ | ”. Ex.:\nga-to | 🐱\ncachorro | 🐶' });
  w.appendChild(E('div', { class: 'row', style: 'margin:6px 0 14px' }, btn('+ ADICIONAR ITEM', 'y', () => { ph.items.push({ t: '', e: '', img: '' }); saveProf(true); renderItems(); const ins = list.querySelectorAll('input.t'); if (ins.length) ins[ins.length - 1].focus(); })));
  w.appendChild(E('div', { class: 'card' }, E('b', {}, 'Adicionar vários de uma vez'), bulk, E('div', { class: 'row', style: 'margin-top:10px' }, btn('ADICIONAR DA LISTA', 'g', () => {
    const lines = bulk.value.split('\n').map(s => s.trim()).filter(Boolean); if (!lines.length) return;
    lines.forEach(ln => { const [a, b] = ln.split('|'); let tx = (a || '').trim(); if (ph.type === 'syl' && !tx.includes('-')) tx = syllabify(tx); ph.items.push({ t: tx, e: (b || '').trim(), img: '' }); });
    bulk.value = ''; saveProf(true); renderItems(); toast(lines.length + ' item(ns) adicionado(s).');
  }))));
  w.appendChild(E('div', { class: 'row' }, btn('▶ TESTAR ESTA FASE', 'g', () => { cleanPhase(ph); if (!ph.items.some(i => i.t.trim())) { toast('Adicione itens antes de testar.'); return; } Snd.init(); saveProf(true); startProf(lv, lv.phases.indexOf(ph), true); }), btn('✔ PRONTO', 'y', () => ofiBack())));
  refreshType();
}
function ofiBack() {
  if (OF.view === 'phase') { if (OF.ph) cleanPhase(OF.ph); saveProf(true); OF.view = 'level'; OF.ph = null; renderOfi(); }
  else if (OF.view === 'level') { saveProf(true); OF.view = 'home'; OF.lv = null; renderOfi(); }
  else { saveProf(true); show('title'); }
}
function readImg(file, cb) {
  const fr = new FileReader();
  fr.onload = () => { const im = new Image(); im.onload = () => { const m = 220, s = Math.min(1, m / Math.max(im.width, im.height)), c = document.createElement('canvas'); c.width = Math.max(1, Math.round(im.width * s)); c.height = Math.max(1, Math.round(im.height * s)); c.getContext('2d').drawImage(im, 0, 0, c.width, c.height); cb(c.toDataURL('image/jpeg', .82)); }; im.onerror = () => toast('Não foi possível ler a imagem.'); im.src = fr.result; };
  fr.readAsDataURL(file);
}
function exportProf() {
  const blob = new Blob([JSON.stringify(PROF)], { type: 'application/json' }), a = document.createElement('a');
  a.href = URL.createObjectURL(blob); a.download = 'fabrica-com-o-prof.json'; document.body.appendChild(a); a.click();
  setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 600);
}
function importProf(file) {
  if (!file) return;
  const fr = new FileReader();
  fr.onload = () => {
    try {
      const d = JSON.parse(fr.result); if (!d || !Array.isArray(d.levels)) throw 0;
      d.levels.map(normLevel).forEach(l => { const i = PROF.levels.findIndex(x => x.id === l.id); if (i >= 0) PROF.levels[i] = l; else PROF.levels.push(l); });
      saveProf(true); renderOfi(); toast('Níveis importados!');
    } catch (e) { toast('Arquivo inválido.'); }
  };
  fr.readAsText(file);
}
function askPass() { $('#pass-in').value = ''; $('#pass-err').textContent = ''; openOv('ov-pass'); setTimeout(() => $('#pass-in').focus(), 80); }
function tryPass() { if ($('#pass-in').value === PASS) { closeOv('ov-pass'); OF.view = 'home'; OF.lv = null; OF.ph = null; show('ofi'); } else { $('#pass-err').textContent = 'Senha incorreta.'; } }
$('#btn-prof').onclick = askPass;
$('#pass-ok').onclick = tryPass;
$('#pass-in').addEventListener('keydown', e => { if (e.key === 'Enter') tryPass(); });
$('#pass-no').onclick = () => closeOv('ov-pass');
$('#ofi-back').onclick = ofiBack;
$('#prof-back').onclick = () => show('map');


/* ================= laço principal ================= */
let lastT = 0;
function loop(t) {
  const dt = Math.min(.05, (t - lastT) / 1000 || 0); lastT = t;
  if (S.screen === 'title') updateTitle(dt);
  else if (S.screen === 'game' && G) updateGame(dt);
  requestAnimationFrame(loop);
}
function updateGame(dt) {
  for (const it of G.items) if (it.tween) stepTween(it, dt);
  if (G.paused || G.over) return;
  if (G.timers.length) { G.timers.forEach(x => x.t -= dt); const due = G.timers.filter(x => x.t <= 0); G.timers = G.timers.filter(x => x.t > 0); due.forEach(x => x.fn()); if (!G) return; }
  if (G.mode === 'frases') { G.time -= dt; hud(); if (G.time <= 0) return finishFrases(); }
  else if (G.limit) { G.time -= dt; hud(); if (G.time <= 0) return finishProf(false); }
  for (const line of G.lines) {
    if (line.busy || !line.word) continue;
    for (const it of line.items.slice()) {
      if (it.state !== 'belt' || it.tween) continue;
      it.bx += line.speed * dt; it.x = line.belt.x + it.bx; place(it);
      if (it.bx + it.w >= line.belt.len - 14) arrive(it, line);
    }
  }
  if (G.emptyEvery > 0) { G.spawnT -= dt; if (G.spawnT <= 0) { spawnEmpty(); G.spawnT = G.emptyEvery * rnd(.7, 1.3); } }
}

/* ================= ligações da interface ================= */
function enter() {
  Snd.init();
  const name = $('#in-name').value.replace(/\s+/g, ' ').trim();
  if (!name) { $('#name-err').textContent = 'Digite o seu nome para entrar!'; $('#in-name').focus(); return; }
  const k = pkey(name);
  if (!DB.players[k]) DB.players[k] = newPlayer(name);
  DB.players[k].teacher = k === 'professor'; S.pk = k; DB.last = DB.players[k].name; saveDB();
  show('map');
}
$('#btn-enter').onclick = enter;
$('#in-name').addEventListener('keydown', e => { if (e.key === 'Enter') enter(); });
$('#btn-rank').onclick = () => { rkTab = 1; buildRank(); openOv('ov-rank'); };
$('#rk-close').onclick = () => closeOv('ov-rank');
$('#rk-t1').onclick = () => { rkTab = 1; buildRank(); };
$('#rk-t2').onclick = () => { rkTab = 2; buildRank(); };
$('#map-back').onclick = () => show('title');
$('#g-back').onclick = () => { if (G && G.mode === 'frases' && !G.over && G.sentences > 0) confirmBox('Sair do jogo?', 'Seus pontos desta rodada não serão salvos.', leaveGame); else leaveGame(); };
$('#top-cfg').onclick = () => { Snd.init(); updateCfg(); openOv('ov-config'); };
$('#cfg-close').onclick = () => closeOv('ov-config');
$('#cfg-fs').onclick = toggleFs;
$('#cfg-snd').onclick = () => { DB.settings.sound = !Snd.on(); if (!Snd.on() && 'speechSynthesis' in window) speechSynthesis.cancel(); saveDB(); updateCfg(); };
$('#cfg-save').onclick = saveAndExit;
$('#cfg-wipe').onclick = () => { closeOv('ov-config'); confirmBox('Apagar dados?', 'Isso apaga todos os jogadores, o progresso e o ranking deste aparelho.', () => { try { localStorage.removeItem(KEY); } catch (e) {} DB = { players: {}, settings: { sound: true }, last: '' }; S.pk = ''; saveAndExit(); toast('Dados apagados.'); }); };
$('#cf-no').onclick = () => closeOv('ov-confirm');
document.addEventListener('fullscreenchange', updateCfg);
window.addEventListener('resize', fit);
window.addEventListener('orientationchange', () => setTimeout(fit, 120));
document.addEventListener('contextmenu', e => e.preventDefault());
document.addEventListener('visibilitychange', () => { if (document.hidden && G && !G.over) G.paused = true; else if (G && !$$('.ov.on').length) G.paused = false; });

/* ================= início ================= */
function boot() {
  fit(); show('title'); requestAnimationFrame(loop);
  if ('serviceWorker' in navigator && /^https?:/.test(location.protocol)) navigator.serviceWorker.register('sw.js').catch(() => {});
}
const ready = (document.fonts && document.fonts.load) ? Promise.all([document.fonts.load('700 28px Fredoka'), document.fonts.load('16px PS2P')]).catch(() => {}) : Promise.resolve();
ready.then(boot);

// exposição mínima para testes automatizados
window.__fabrica = { get G() { return G; }, S, PROF: () => PROF, startProf, askPass, DB: () => DB, startPhase, startFrases, enter, show };
})();
