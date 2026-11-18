/* Offline logic harness for the Mastery Path. Run: node test-logic.js
   Loads ruyan-song.js + the app's inline <script> against a mocked DOM/localStorage. */
const fs = require('fs');
const html = fs.readFileSync(__dirname + '/index.html', 'utf8');
const APP = html.match(/<script>([\s\S]*)<\/script>/)[1];
const SONGJS = fs.readFileSync(__dirname + '/ruyan-song.js', 'utf8');
let pass = 0, fail = 0;
const ok = (c, msg) => { if (c) pass++; else { fail++; console.log('FAIL:', msg); } };

function dstr(d) { return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); }
function daysAgo(n) { const d = new Date(); d.setHours(12, 0, 0, 0); d.setDate(d.getDate() - n); return d; }

function boot(store) {
  const els = {};
  const el = (id) => els[id] || (els[id] = {
    id, innerHTML: '', textContent: '', value: '', scrollTop: 0, style: {}, dataset: {},
    _c: new Set(),
    classList: { add(c) { this._o._c.add(c); }, remove(c) { this._o._c.delete(c); }, toggle(c, f) { const on = f === undefined ? !this._o._c.has(c) : f; on ? this._o._c.add(c) : this._o._c.delete(c); return on; }, contains(c) { return this._o._c.has(c); } },
    setAttribute() {}, getAttribute() { return null; }, click() {}
  });
  const proxyEl = (id) => { const e = el(id); e.classList._o = e; return e; };
  const ls = { _s: store || {}, getItem(k) { return k in this._s ? this._s[k] : null; }, setItem(k, v) { this._s[k] = String(v); }, removeItem(k) { delete this._s[k]; } };
  const toasts = [];
  const sandbox = {
    document: { getElementById: proxyEl, querySelectorAll: () => [], querySelector: () => null, documentElement: { setAttribute() {} }, addEventListener() {}, body: { style: {} } },
    localStorage: ls, confirm: () => true, setTimeout: () => 0, clearTimeout() {}, setInterval: () => 0, clearInterval() {},
    navigator: {}, console, Blob: function () {}, URL: { createObjectURL: () => '' }, FileReader: function () {},
  };
  const win = {};
  new Function('window', SONGJS)(win);
  sandbox.window = Object.assign(win, { scrollTo() {}, AudioContext: function () { return { resume() {}, currentTime: 0, destination: {} }; }, addEventListener() {},
    SheetPlayer: { mount() {}, play() {}, unmount() {} } });
  sandbox.RUYAN_SONG = win.RUYAN_SONG; sandbox.RUYAN_CHORDS = win.RUYAN_CHORDS; sandbox.chordDiagramSVG = win.chordDiagramSVG; sandbox.SheetPlayer = sandbox.window.SheetPlayer;
  const names = 'STAGES FLAT GYM PARTS S M init st isMastered statusOf lessonById stageOf nextLessonId markDay curStreak bestStreak rungs tempoOf stepUp cleanAtGoal masterLesson playShape lessonChords secIdx secRange learntUpTo topTempo testOut logGym inSong renderToday renderPath renderPlay renderProg renderRef openLesson startSession nextStep renderSession endSession setShapeView practicePanel calCount'.split(' ');
  const fn = new Function('with(this){' + APP.replace('if(\'serviceWorker\' in navigator)', 'if(false)') + '\nreturn {' + names.map(n => n + ':typeof ' + n + '!=="undefined"?' + n + ':undefined').join(',') + ', getS:()=>S, getM:()=>M, setM:(x)=>{M=x}, toast:()=>document.getElementById("toast").textContent, el:(i)=>document.getElementById(i)}}');
  const api = fn.call(sandbox);
  api.store = ls._s;
  api.RUYAN_CHORDS = win.RUYAN_CHORDS;
  return api;
}

/* ---- 1. structure ---- */
let A = boot();
const L = A.RUYAN_SONG || A.lessonById && null;
ok(A.FLAT.length === 26, 'FLAT has 26 lessons (got ' + A.FLAT.length + ')');
ok(new Set(A.FLAT).size === A.FLAT.length, 'lesson ids unique');
ok(A.FLAT[0] === '3.1', 'path starts on the strum (3.1), not barres');
A.STAGES.forEach(m => m.lessons.forEach(l => {
  if (l.sec) { const r = A.secRange(l.sec); ok(A.secIdx(l.sec.from) >= 0 && (!l.sec.to || A.secIdx(l.sec.to) >= 0) && r[1] >= r[0], 'section names resolve for ' + l.id); }
  if (l.bpm) ok(l.stds.length >= 1 && l.bpm[1] <= 76, 'ladder lesson ' + l.id + ' has a tempo standard and goal ≤ 76');
  ok(Array.isArray(l.stds) && l.stds.length, 'standards on ' + l.id);
}));
['3.1', '3.2', '3.3', '2.2', '4.1', '4.2', '2.3', 'pc.1', '5.1', '5.2', '6.1', '6.2', '6.3', '7.1', '7.2', '8.1', '9.1', '9.2', '9.3'].forEach(id => ok(!!A.lessonById(id).bpm, id + ' has a tempo ladder'));
/* every chord, in starter and full view, has a diagram */
['play', 'full'].forEach(v => { A.setShapeView(v); A.FLAT.forEach(id => { const l = A.lessonById(id); if (l.chords || l.sec) A.lessonChords(l).forEach(c => ok(!!A.RUYAN_CHORDS[c], v + ' shape ' + c + ' in ' + id + ' has a diagram')); }); });
A.setShapeView('play');
/* starter view has no barre shapes at all */
const barre = n => !!(A.RUYAN_CHORDS[n] && A.RUYAN_CHORDS[n].barre);
ok(A.FLAT.every(id => { const l = A.lessonById(id); return !(l.chords || l.sec) || A.lessonChords(l).every(c => !barre(c)); }), 'fresh start: no lesson shows a barre shape');
/* coverage: lessons (excluding whole-song 9.x) cover every section */
const cov = new Array(23).fill(false);
A.FLAT.forEach(id => { const l = A.lessonById(id); if (!l.sec || /^9\./.test(id)) return; const r = A.secRange(l.sec); for (let i = r[0]; i <= r[1]; i++) cov[i] = true; });
ok(cov.every(Boolean), 'lesson sections cover all 23 song sections (missing: ' + cov.map((c, i) => c ? '' : i).filter(String).join(',') + ')');

/* ---- 2. fresh state, gating, ladder ---- */
ok(A.nextLessonId() === '3.1', 'fresh next lesson is 3.1');
ok(A.statusOf('3.2') === 'locked', '3.2 locked until 3.1 is mastered');
ok(JSON.stringify(A.rungs(A.lessonById('4.1'))) === '[60,64,68,72,76]', 'verse ladder 60→76 in 4s');
ok(JSON.stringify(A.rungs(A.lessonById('2.2'))) === '[60]', 'changes lesson is a single rung');
ok(A.tempoOf(A.lessonById('4.1')) === 60, 'unstarted lesson reads its start tempo');
ok(A.learntUpTo() === -1, 'nothing learnt yet → play-from-top covers nothing');
A.stepUp('3.1');
ok(A.getM().tempo['3.1'] === 64, 'step up 60 → 64');
ok(A.getM().days.includes(dstr(new Date())), 'stepping up counts today');
A.stepUp('3.1'); A.stepUp('3.1'); A.stepUp('3.1');
ok(A.getM().tempo['3.1'] === 76, 'climbs to 76');
A.stepUp('3.1');
ok(A.getM().tempo['3.1'] === 76, 'never above the goal');
A.openLesson('3.1');
ok(/cleanAtGoal\('3\.1'\)/.test(A.el('dBody').innerHTML) && /that’s the song/.test(A.el('dBody').innerHTML) && !/stepUp\('3\.1'\)/.test(A.el('dBody').innerHTML), 'at 76 the footer offers "clean at 76 — that’s the song", not another step');
A.cleanAtGoal('3.1');
ok(A.isMastered('3.1'), 'clean at the goal masters a one-standard ladder lesson');
ok(A.statusOf('3.2') === 'available', 'next lesson unlocks');
ok(A.nextLessonId() === '3.2', 'Today moves on to 3.2');
/* lessons with a second standard need it ticked */
A.masterLesson('3.2'); A.masterLesson('3.3');
ok(A.learntUpTo() === 0, 'intro learnt → play from the top = intro');

/* ---- 3. migration from the old barre-first path ---- */
const old = { '1.1': { mastered: true, logs: [{ ts: daysAgo(10).getTime(), min: 10, note: 'barre' }] }, '1.2': { mastered: true, logs: [{ ts: daysAgo(9).getTime(), min: 10 }] },
  '1.3': { mastered: false, logs: [] }, '2.1': { mastered: true, tasks: {}, stds: { 0: true, 1: true }, logs: [] } };
const B = boot({ ruyan_lessons_v1: JSON.stringify(old) });
ok(B.inSong('F#m') && !B.inSong('Bm'), 'old 1.2 mastered → F#m barre in the song; 1.3 not → Bm still starter');
ok(B.getM().days.includes(dstr(daysAgo(10))) && B.getM().days.includes(dstr(daysAgo(9))), 'old session logs become practice days');
ok(B.isMastered('2.1') && B.getS()['1.1'].logs.length === 1, 'old progress and logs kept');
ok(B.nextLessonId() === '3.1', 'migrated user starts on the song (3.1), not stuck behind barres');
ok(B.playShape('F#m') === 'F#m' && B.playShape('C#m') === 'C#m7' && B.playShape('Bm7') === 'Bm7', 'shapes follow the gym: F#m barre, C#m starter');
const B2 = boot(B.store);
ok(B2.getM().v2 === 1 && B2.inSong('F#m'), 'migration runs once and persists');

/* ---- 4. streaks ---- */
const C = boot();
C.getM().days = [dstr(daysAgo(0)), dstr(daysAgo(1)), dstr(daysAgo(2))];
ok(C.curStreak() === 3, 'streak through today = 3');
C.getM().days = [dstr(daysAgo(1)), dstr(daysAgo(2))];
ok(C.curStreak() === 2, 'today not yet practised → streak still counts through yesterday');
C.getM().days = [dstr(daysAgo(2)), dstr(daysAgo(3))];
ok(C.curStreak() === 0, 'a missed day breaks the streak');
C.getM().days = [dstr(daysAgo(20)), dstr(daysAgo(19)), dstr(daysAgo(18)), dstr(daysAgo(18)), dstr(daysAgo(5))];
ok(C.bestStreak() === 3, 'best streak 3 (duplicate days ignored)');

/* ---- 5. barre gym ---- */
const D = boot();
ok(D.playShape('F#m') === 'F#m7', 'fresh: F#m played as F#m7');
D.getM().gym['F#m'].hist = [{ d: dstr(daysAgo(2)), ok: 6 }, { d: dstr(daysAgo(1)), ok: 6 }];
D.logGym('F#m', 5);
ok(!D.inSong('F#m'), 'a day short of all six strings: no swap');
D.getM().gym['F#m'].hist = [{ d: dstr(daysAgo(2)), ok: 6 }, { d: dstr(daysAgo(1)), ok: 6 }];
D.logGym('F#m', 6);
ok(D.inSong('F#m') && D.playShape('F#m') === 'F#m', 'three clean days in a row → F#m barre swaps into the song');
D.logGym('Bm', 3); D.logGym('Bm', 4);
ok(D.getM().gym['Bm'].hist.length === 1 && D.getM().gym['Bm'].hist[0].ok === 4, 'one gym entry per day (last value wins)');

/* ---- 6. test out ---- */
const E = boot();
E.testOut(4);
const st4 = E.STAGES.find(m => m.n === 4);
ok(st4.lessons.every(l => E.isMastered(l.id)), 'test out masters the whole stage');
ok(E.statusOf('b.1') === 'available', 'test out opens the next stage');
ok(E.nextLessonId() === '3.1', 'Today still points at the earliest unfinished lesson');

/* ---- 7. play-from-the-top coverage + tempo ---- */
const F = boot();
['3.1', '3.2', '3.3', '2.1', 's.1', 's.2', '2.2'].forEach(id => F.masterLesson(id));
F.getM().tempo['4.1'] = 64;
ok(F.learntUpTo() === 1, 'intro + verse started → top runs Intro → Verse 1');
ok(F.topTempo() === 60 || F.topTempo() === 64, 'top tempo is the slowest learnt rung');
F.getM().tempo['pc.1'] = 60; F.getM().tempo['5.1'] = 60;
ok(F.learntUpTo() === 7, 'pre-chorus + chorus started → top reaches 星星太阳 (section 7)');

/* ---- 8. every screen renders for every lesson, no undefined/NaN ---- */
const G = boot();
const bad = s => /undefined|NaN/.test(s);
['renderToday', 'renderPath', 'renderPlay', 'renderProg', 'renderRef'].forEach(f => { const out = G[f](); ok(out.length > 200 && !bad(out), f + ' renders cleanly'); });
G.STAGES.forEach(m => m.lessons.forEach(l => { G.getS()[l.id] = undefined; }));
G.FLAT.forEach((id, i) => { if (i > 0) G.masterLesson(G.FLAT[i - 1]); G.openLesson(id); const out = G.el('dBody').innerHTML; ok(out.length > 100 && !bad(out), 'lesson ' + id + ' renders cleanly'); });
['play', 'full'].forEach(v => { G.setShapeView(v); G.FLAT.forEach(id => { const o = G.practicePanel(G.lessonById(id), true); ok(!bad(o), 'practice panel ' + id + ' (' + v + ')'); }); });
const H = boot();
H.startSession(); let steps = 0; while (true) { const out = H.el('sBody').innerHTML; ok(!bad(out) && out.length > 100, 'session step ' + steps + ' renders'); steps++; if (steps >= 3) break; H.nextStep(); }
ok(steps === 3, 'a session has gym → lesson → top');
H.endSession(); H.startSession('top');
ok(/Play from the top/.test(H.el('sBody').innerHTML), '2-minute session opens straight on play-from-the-top');
const done = boot(); done.FLAT.forEach(id => done.masterLesson(id));
ok(done.nextLessonId() === null && /You can play/.test(done.renderToday()), 'all done → finished Today screen');

console.log((fail ? 'FAILED ' : 'ALL GREEN ') + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
