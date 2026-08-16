/* Immune Summative II trainer — app logic
   Progress lives in localStorage and syncs through a private GitHub Gist,
   merged question-by-question on timestamp so two devices genuinely combine. */
(function () {
'use strict';

var BANK = window.BANK || [], META = window.META || {};
var $ = function (s, r) { return (r || document).querySelector(s); };
var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
var byId = {};
BANK.forEach(function (q) { byId[q.id] = q; });

var PAST = BANK.filter(function (q) { return q.src === 'past'; });
var AUTH = BANK.filter(function (q) { return q.src === 'author'; });

/* ═════════════════════════════════════════════════ storage */
var LS_PROG = 'isum2.progress', LS_META = 'isum2.meta',
    LS_TOK = 'isum2.token', LS_GIST = 'isum2.gistid';

function loadJSON(k, d) {
  try { var v = localStorage.getItem(k); return v ? JSON.parse(v) : d; }
  catch (e) { return d; }
}
function saveJSON(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} }

/* progress[qid] = {a:choice, ok:0|1, st:0|1, ts:epochMs, ms:timeSpent, n:attempts} */
var prog = loadJSON(LS_PROG, {});
var pmeta = loadJSON(LS_META, { theme: 'dark' });

var BLANK = { a: null, ok: 0, st: 0, sv: 0, ts: 0, ms: 0, n: 0 };
function isBlank(p) { return !p || (!p.a && !p.st && !p.sv && !p.n); }

var saveTimer = null;
function persist(sync) {
  /* drop records that carry no information — otherwise simply scrolling
     through the bank would fill storage (and the synced gist) with 264 empties */
  Object.keys(prog).forEach(function (k) { if (isBlank(prog[k])) delete prog[k]; });
  saveJSON(LS_PROG, prog);
  saveJSON(LS_META, pmeta);
  if (sync !== false) scheduleSync();
}
/* read-only view — never creates a record */
function get(id) { return prog[id] || BLANK; }
/* writable record — creates on demand */
function rec(id) {
  if (!prog[id]) prog[id] = { a: null, ok: 0, st: 0, sv: 0, ts: 0, ms: 0, n: 0 };
  return prog[id];
}
function touch(id) { prog[id].ts = Date.now(); }

/* ═════════════════════════════════════════════════ helpers */
function esc(s) { return String(s).replace(/[&<>"]/g, function (c) {
  return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]; }); }
function fmt(ms) {
  var s = Math.max(0, Math.floor(ms / 1000));
  var m = Math.floor(s / 60);
  return m + ':' + String(s % 60).padStart(2, '0');
}
function haptic(ms) { if (navigator.vibrate) { try { navigator.vibrate(ms || 8); } catch (e) {} } }

var toastT = null;
function toast(msg) {
  var t = $('#toast'); t.textContent = msg; t.classList.add('on');
  clearTimeout(toastT); toastT = setTimeout(function () { t.classList.remove('on'); }, 2400);
}

function lecLabel(k) { return (META.lecShort && META.lecShort[k]) || k; }
function lecFull(k) { return (META.lecName && META.lecName[k]) || k; }

var FLAG_TXT = {
  completed: '✎ options completed',
  keydiff: '⚠ answer clarified',
  image: '▣ image item',
  crossover: '⇄ from a Sum-I paper',
  author: '✦ author-made'
};

/* ═════════════════════════════════════════════════ routing */
var stack = ['home'];
$('#home').classList.add('on');
function show(id) {
  var cur = stack[stack.length - 1];
  if (cur === id) return;
  if (cur) { var c = $('#' + cur); c.classList.remove('on'); c.classList.add('behind'); }
  stack.push(id);
  var el = $('#' + id);
  el.classList.remove('behind');
  /* force a reflow rather than waiting on rAF — rAF is paused when the app is
     backgrounded, which would otherwise leave a screen half-presented */
  void el.offsetWidth;
  el.classList.add('on');
}
function back() {
  if (stack.length <= 1) return;
  var id = stack.pop();
  $('#' + id).classList.remove('on');
  var prev = stack[stack.length - 1];
  var p = $('#' + prev);
  p.classList.remove('behind');
  p.classList.add('on');
  if (prev === 'home') { renderHome(); }
}
$$('[data-back]').forEach(function (b) { b.addEventListener('click', back); });

function openSheet(id) { $('#' + id).classList.add('on'); }
function closeSheet(id) { $('#' + id).classList.remove('on'); }
$$('.sheet').forEach(function (sh) {
  sh.addEventListener('click', function (e) { if (e.target === sh) sh.classList.remove('on'); });
});

/* ═════════════════════════════════════════════════ theme */
function applyTheme() {
  document.documentElement.setAttribute('data-theme', pmeta.theme || 'dark');
  var m = $('meta[name=theme-color]');
  if (m) m.setAttribute('content', pmeta.theme === 'light' ? '#f4f7fc' : '#0b1220');
}
$('#btn-theme').addEventListener('click', function () {
  pmeta.theme = (pmeta.theme === 'light') ? 'dark' : 'light';
  applyTheme(); persist(false); haptic();
});
applyTheme();

/* ═════════════════════════════════════════════════ sets */
function byYear(y) { return PAST.filter(function (q) { return q.y === y; }); }
function byLec(k, pool) { return (pool || PAST).filter(function (q) { return q.lec === k; }); }
function starred() { return BANK.filter(function (q) { return prog[q.id] && prog[q.id].st; }); }
function wrongs() {
  return BANK.filter(function (q) {
    var p = prog[q.id]; return p && p.a && !p.ok;
  });
}
function shuffled(arr) {
  var a = arr.slice();
  for (var i = a.length - 1; i > 0; i--) {
    var j = Math.floor(Math.random() * (i + 1));
    var t = a[i]; a[i] = a[j]; a[j] = t;
  }
  return a;
}
function statsOf(list) {
  var done = 0, ok = 0;
  list.forEach(function (q) {
    var p = prog[q.id];
    if (p && p.a) { done++; if (p.ok) ok++; }
  });
  return { total: list.length, done: done, ok: ok };
}

/* ═════════════════════════════════════════════════ home */
var MODES = [
  { id: 'year', em: '📅', t: 'By year', d: 'Each paper faithfully, newest first' },
  { id: 'lec', em: '📚', t: 'By lecture', d: '12 BM33 buckets, L10 → L19' },
  { id: 'star', em: '⭐', t: 'Starred review', d: 'Everything you flagged, grouped by lecture' },
  { id: 'wrong', em: '🔁', t: 'Wrong-answer drill', d: 'Auto-collected, re-served until right' },
  { id: 'shuffle', em: '🎲', t: 'Shuffle practice', d: 'Random mix across every paper' },
  { id: 'mock', em: '⏱', t: 'Timed mock exam', d: 'Answers hidden until you submit' },
  { id: 'author', em: '✦', t: 'Author-made drill', d: 'NOT past papers — 5 hard vignettes per lecture', cls: 'author' },
  { id: 'stats', em: '📊', t: 'Stats', d: 'Per-paper and per-lecture breakdown' }
];

function renderHome() {
  var s = statsOf(PAST);
  var sa = statsOf(AUTH);
  var doneAll = s.done + sa.done, okAll = s.ok + sa.ok, totAll = BANK.length;
  var pct = totAll ? Math.round(doneAll / totAll * 100) : 0;
  $('#ring-pct').textContent = pct + '%';
  $('#ring-sub').textContent = doneAll ? okAll + '/' + doneAll + ' right' : 'not started';
  $('#ring-fg').style.strokeDashoffset = String(326.7 * (1 - pct / 100));
  $('#st-done').textContent = doneAll;
  $('#st-corr').textContent = okAll;
  $('#st-star').textContent = starred().length;

  var n = $('#modes');
  if (n.dataset.built) {
    updateModeCounts();
    return;
  }
  n.dataset.built = '1';
  n.innerHTML = MODES.map(function (m, i) {
    return '<button class="mode ' + (m.cls || '') + '" data-mode="' + m.id + '" ' +
      'style="animation-delay:' + (i * 38) + 'ms">' +
      '<span class="em">' + m.em + '</span>' +
      '<span class="tx"><b>' + esc(m.t) + '</b><small>' + esc(m.d) + '</small></span>' +
      '<span class="cnt" data-cnt="' + m.id + '"></span></button>';
  }).join('');
  $$('.mode', n).forEach(function (b) {
    b.addEventListener('click', function () { haptic(); openMode(b.dataset.mode); });
  });
  updateModeCounts();
}
function updateModeCounts() {
  var map = {
    year: PAST.length, lec: PAST.length, star: starred().length,
    wrong: wrongs().length, shuffle: PAST.length, mock: '',
    author: AUTH.length, stats: ''
  };
  Object.keys(map).forEach(function (k) {
    var el = $('[data-cnt="' + k + '"]');
    if (el) el.textContent = map[k] === '' ? '›' : map[k];
  });
}

/* ═════════════════════════════════════════════════ picker */
function openMode(m) {
  if (m === 'stats') { renderStats(); show('stats'); return; }

  if (m === 'star') {
    var st = starred();
    if (!st.length) { toast('Nothing starred yet — tap ☆ on any question'); return; }
    return pickerLectures('⭐ Starred review', st, 'star');
  }
  if (m === 'wrong') {
    var w = wrongs();
    if (!w.length) { toast('No wrong answers yet — nothing to drill'); return; }
    return startSession('Wrong-answer drill', shuffled(w), { drill: true });
  }
  if (m === 'shuffle') {
    return startSession('Shuffle practice', shuffled(PAST), {});
  }
  if (m === 'author') {
    return pickerLectures('✦ Author-made drill', AUTH, 'author');
  }
  if (m === 'mock') return pickerMock();
  if (m === 'year') return pickerYears();
  if (m === 'lec') return pickerLectures('By lecture', PAST, 'lec');
}

function pickerFrame(title, rows) {
  $('#picker-title').textContent = title;
  var box = $('#picker-list');
  box.innerHTML = rows.map(function (r, i) {
    var pc = r.total ? Math.round(r.done / r.total * 100) : 0;
    return '<button class="pick" data-i="' + i + '" style="animation-delay:' + (i * 26) + 'ms">' +
      '<b>' + esc(r.title) + '</b>' +
      '<span class="cnt">' + r.done + '/' + r.total + '</span>' +
      '<span class="meta">' + esc(r.meta || '') + '</span>' +
      '<span class="pbar"><i style="width:' + pc + '%"></i></span>' +
      '</button>';
  }).join('');
  $$('.pick', box).forEach(function (b) {
    b.addEventListener('click', function () {
      haptic(); rows[+b.dataset.i].go();
    });
  });
  show('picker');
}

function pickerYears() {
  var rows = META.yearOrder.map(function (y) {
    var list = byYear(y), s = statsOf(list), m = META.yearMeta[y];
    return {
      title: m[0], meta: m[1], total: s.total, done: s.done,
      go: function () { startSession(m[0], list, {}); }
    };
  });
  pickerFrame('By year — newest first', rows);
}

function pickerLectures(title, pool, kind) {
  var rows = [];
  var all = pool.slice();
  var sAll = statsOf(all);
  rows.push({
    title: 'All ' + all.length + ' items', meta: 'Every lecture, in order',
    total: sAll.total, done: sAll.done,
    go: function () { startSession(title + ' — all', all, {}); }
  });
  META.lecOrder.forEach(function (k) {
    var list = byLec(k, pool);
    if (!list.length) return;
    var s = statsOf(list);
    rows.push({
      title: lecLabel(k) + ' · ' + lecFull(k),
      meta: list.length + ' item' + (list.length === 1 ? '' : 's') +
        (kind === 'lec' ? ' across all cohorts' : ''),
      total: s.total, done: s.done,
      go: function () { startSession(lecLabel(k) + ' · ' + lecFull(k), list, {}); }
    });
  });
  pickerFrame(title, rows);
}

function pickerMock() {
  var opts = [
    { n: 40, label: '40 questions', mins: 60 },
    { n: 60, label: '60 questions', mins: 90 },
    { n: 20, label: '20 questions', mins: 30 }
  ];
  var rows = opts.map(function (o) {
    return {
      title: '⏱ ' + o.label, meta: o.mins + ' minutes · random mix · answers hidden until you submit',
      total: o.n, done: 0,
      go: function () {
        startSession('Mock · ' + o.label, shuffled(PAST).slice(0, o.n),
          { mock: true, limit: o.mins * 60000 });
      }
    };
  });
  META.yearOrder.forEach(function (y) {
    var list = byYear(y).filter(function (q) { return q.k === 'mcq'; });
    if (list.length < 10) return;
    rows.push({
      title: '⏱ ' + META.yearMeta[y][0], meta: list.length + ' MCQ · 90 minutes · sat as a real paper',
      total: list.length, done: 0,
      go: function () { startSession('Mock · ' + y, list, { mock: true, limit: 90 * 60000 }); }
    });
  });
  pickerFrame('Timed mock exam', rows);
}

/* ═════════════════════════════════════════════════ session */
var S = null;   /* current session */

function startSession(title, list, opt) {
  if (!list.length) { toast('Nothing to show here'); return; }
  S = {
    title: title, list: list, i: 0, opt: opt || {},
    revealed: {}, t0: Date.now(), qt0: Date.now(),
    elapsed: 0, submitted: false
  };
  $('#q-section').textContent = title;
  show('quiz');
  renderQ();
  startClock();
}

var clock = null;
function startClock() {
  stopClock();
  clock = setInterval(tick, 250);
}
function stopClock() { if (clock) { clearInterval(clock); clock = null; } }
function tick() {
  if (!S) return;
  var now = Date.now();
  $('#t-q').textContent = fmt(now - S.qt0);
  if (S.opt.mock && S.opt.limit) {
    var left = S.opt.limit - (now - S.t0);
    $('#t-total').textContent = left > 0 ? '⏱ ' + fmt(left) : '⏱ 0:00';
    if (left <= 0 && !S.submitted) submitMock();
  } else {
    $('#t-total').textContent = fmt(now - S.t0);
  }
}

function curQ() { return S.list[S.i]; }

function renderQ() {
  var q = curQ(), p = get(q.id);
  S.qt0 = Date.now();
  $('#q-count').textContent = (S.i + 1) + ' / ' + S.list.length;
  $('#prog-fill').style.width = ((S.i + 1) / S.list.length * 100) + '%';
  $('#btn-star').classList.toggle('on', !!p.st);
  $('#btn-star').textContent = p.st ? '★' : '☆';
  $('#btn-prev').disabled = S.i === 0;
  $('#btn-next').textContent = (S.i === S.list.length - 1)
    ? (S.opt.mock && !S.submitted ? 'Submit' : 'Finish') : 'Next ›';

  var tags = [];
  if (q.src === 'author') tags.push('<span class="tag au">✦ author-made · not a past paper</span>');
  else tags.push('<span class="tag">' + esc(q.y) + ' · ' + esc(q.n) + '</span>');
  tags.push('<span class="tag lec">' + esc(lecLabel(q.lec)) + ' · ' + esc(lecFull(q.lec)) + '</span>');
  if (q.k === 'written') tags.push('<span class="tag">✍ written</span>');
  (q.f || []).forEach(function (f) {
    if (f === 'author') return;
    var cls = (f === 'keydiff') ? 'tag warn' : 'tag';
    tags.push('<span class="' + cls + '">' + esc(FLAG_TXT[f] || f) + '</span>');
  });

  var h = '<div class="qcard">';
  h += '<div class="tags">' + tags.join('') + '</div>';
  h += '<div class="stem">' + q.s + '</div>';

  if (q.k === 'mcq') {
    h += '<div class="opts" id="opts">';
    Object.keys(q.o).forEach(function (k) {
      h += '<button class="opt" data-k="' + k + '"><span class="k">' + k + '</span>' +
        '<span class="v">' + q.o[k] + '</span></button>' +
        '<div class="reason" data-r="' + k + '"><div class="rin">' + (q.r[k] || '') + '</div></div>';
    });
    h += '</div>';
  }

  h += '<div class="reveal" id="reveal">';
  if (q.k === 'written') {
    h += '<div class="answer"><span class="lbl">Model answer</span>' + q.ans + '</div>';
  }
  h += '<div class="concept"><span class="lbl">Concept</span>' + q.c + '</div>';
  if (q.also) h += '<div class="also">↻ also asked in ' + esc(q.also) + '</div>';
  if (q.img) {
    h += '<div class="slidewrap"><div class="cap">Source slide — ' + esc(lecFull(q.lec)) +
      ' · slide ' + q.sl + ' (tap to zoom)</div>' +
      '<img src="' + q.img + '" alt="Source slide" loading="lazy" id="slideimg"></div>';
  }
  h += '</div></div>';

  var stage = $('#stage');
  stage.innerHTML = h;
  stage.scrollTop = 0;

  if (q.k === 'mcq') {
    $$('#opts .opt').forEach(function (b) {
      b.addEventListener('click', function () { choose(b.dataset.k); });
    });
  }
  var img = $('#slideimg');
  if (img) img.addEventListener('click', function () {
    $('#lb-img').src = img.src; $('#lightbox').classList.add('on');
  });

  var showAnswers = !S.opt.mock || S.submitted;
  if (showAnswers) {
    if (q.k === 'mcq') {
      /* after a mock is submitted, reveal every item — including the ones left
         blank — so the paper can be reviewed in full */
      if (p.a || p.sv || S.submitted) lockIn(p.a || null, false);
    } else if (p.a || p.sv || S.revealed[q.id] || S.submitted) {
      doReveal();
    }
  }
  $('#btn-reveal').style.display = (S.opt.mock && !S.submitted) ? 'none' : '';
  $('#btn-reveal').textContent = q.k === 'written' ? 'Show model answer' : 'Show answer';
}

function choose(k) {
  var q = curQ(), p = rec(q.id);
  if (S.opt.mock && !S.submitted) {
    /* mock: record silently, allow changing, no feedback */
    p.a = k; p.n = p.n || 0; p.ok = (k === q.a) ? 1 : 0;
    p.ms = (p.ms || 0); touch(q.id); persist();
    $$('#opts .opt').forEach(function (b) {
      b.style.borderColor = (b.dataset.k === k) ? 'var(--acc)' : '';
    });
    haptic(6);
    return;
  }
  if (p.a) return;                       /* already locked */
  p.a = k;
  p.ok = (k === q.a) ? 1 : 0;
  p.n = (p.n || 0) + 1;
  p.ms = (p.ms || 0) + (Date.now() - S.qt0);
  touch(q.id); persist();
  haptic(p.ok ? 10 : [8, 40, 8]);
  lockIn(k, true);
}

function lockIn(chosen, animate) {
  var q = curQ();
  $$('#opts .opt').forEach(function (b) {
    var k = b.dataset.k;
    b.classList.add('locked');
    b.style.borderColor = '';
    if (k === q.a) b.classList.add('correct');
    else if (k === chosen) b.classList.add('chosen-wrong');
    if (animate && k === chosen) b.classList.add('flash');
    var r = $('.reason[data-r="' + k + '"]');
    if (r) {
      if (animate) setTimeout(function () { r.classList.add('show'); }, 60 + 45 * ' ABCDE'.indexOf(k));
      else r.classList.add('show');
    }
  });
  if (animate) setTimeout(doReveal, 260); else doReveal();
}
function doReveal() {
  var el = $('#reveal');
  if (el) el.classList.add('show');
  S.revealed[curQ().id] = 1;
}

$('#btn-reveal').addEventListener('click', function () {
  var q = curQ(), p = rec(q.id);
  /* sv = revealed without answering. Kept separate from `a` so it stays
     revealed when you navigate back, without counting as an answered item. */
  p.sv = 1; touch(q.id); persist();
  if (q.k === 'mcq' && !p.a) lockIn(null, true);
  else doReveal();
  haptic();
});

$('#btn-prev').addEventListener('click', function () {
  if (S.i > 0) { S.i--; renderQ(); haptic(6); }
});
$('#btn-next').addEventListener('click', function () {
  if (S.i < S.list.length - 1) { S.i++; renderQ(); haptic(6); return; }
  if (S.opt.mock && !S.submitted) { submitMock(); return; }
  finishSession();
});

function submitMock() {
  S.submitted = true;
  stopClock();
  var ok = 0, ans = 0;
  S.list.forEach(function (q) {
    var p = prog[q.id];
    if (p && p.a) { ans++; if (p.ok) ok++; }
  });
  var pct = S.list.length ? Math.round(ok / S.list.length * 100) : 0;
  toast('Submitted — ' + ok + '/' + S.list.length + ' (' + pct + '%) · answers now visible');
  S.i = 0; renderQ(); startClock();
}

function finishSession() {
  var s = statsOf(S.list);
  var pct = s.done ? Math.round(s.ok / s.done * 100) : 0;
  stopClock();
  toast('Done — ' + s.ok + '/' + s.done + ' correct (' + pct + '%)');
  back();
}

/* star */
$('#btn-star').addEventListener('click', function () {
  var q = curQ(), p = rec(q.id);
  p.st = p.st ? 0 : 1;
  touch(q.id); persist();
  var b = this;
  b.classList.toggle('on', !!p.st);
  b.textContent = p.st ? '★' : '☆';
  if (p.st) { b.classList.remove('pulse'); void b.offsetWidth; b.classList.add('pulse'); }
  haptic(12);
  toast(p.st ? 'Starred for review' : 'Star removed');
});

/* grid */
$('#btn-grid').addEventListener('click', function () {
  var g = $('#qgrid');
  g.innerHTML = S.list.map(function (q, i) {
    var p = prog[q.id] || {};
    var cls = 'qg';
    if (p.a) cls += p.ok ? ' ok' : ' no';
    if (p.st) cls += ' st';
    if (i === S.i) cls += ' cur';
    var lbl = (q.src === 'past' && /^Q?\d+$/.test(String(q.n)))
      ? String(q.n).replace('Q', '') : (i + 1);
    return '<button class="' + cls + '" data-i="' + i + '">' + esc(lbl) + '</button>';
  }).join('');
  $$('.qg', g).forEach(function (b) {
    b.addEventListener('click', function () {
      S.i = +b.dataset.i; closeSheet('sheet-grid'); renderQ(); haptic();
    });
  });
  openSheet('sheet-grid');
});

/* lightbox */
$('#lightbox').addEventListener('click', function () { this.classList.remove('on'); });

/* keyboard (Mac) */
document.addEventListener('keydown', function (e) {
  if (e.target.tagName === 'INPUT') return;
  if (!S || !$('#quiz').classList.contains('on')) return;
  var k = e.key.toUpperCase();
  if ('ABCDE'.indexOf(k) > -1 && curQ().k === 'mcq') { choose(k); e.preventDefault(); }
  else if ('12345'.indexOf(k) > -1 && curQ().k === 'mcq') { choose('ABCDE'[+k - 1]); e.preventDefault(); }
  else if (e.key === 'ArrowRight') { $('#btn-next').click(); }
  else if (e.key === 'ArrowLeft') { $('#btn-prev').click(); }
  else if (k === 'S') { $('#btn-star').click(); }
  else if (k === 'R') { $('#btn-reveal').click(); }
  else if (e.key === 'Escape') { back(); }
});

/* ═════════════════════════════════════════════════ stats */
function renderStats() {
  var s = statsOf(PAST), sa = statsOf(AUTH);
  var h = '';
  h += '<div class="bigrow">' +
    '<div><b>' + (s.done + sa.done) + '</b><small>answered of ' + BANK.length + '</small></div>' +
    '<div><b>' + (s.done + sa.done ? Math.round((s.ok + sa.ok) / (s.done + sa.done) * 100) : 0) +
      '%</b><small>accuracy</small></div>' +
    '<div><b>' + starred().length + '</b><small>starred</small></div>' +
    '<div><b>' + wrongs().length + '</b><small>to re-drill</small></div>' +
    '</div>';

  h += '<div class="sblock"><h4>By paper</h4>';
  META.yearOrder.forEach(function (y) {
    var st = statsOf(byYear(y));
    h += srow(META.yearMeta[y][0], st);
  });
  h += srow('✦ Author-made drill', sa);
  h += '</div>';

  h += '<div class="sblock"><h4>By lecture</h4>';
  META.lecOrder.forEach(function (k) {
    var st = statsOf(byLec(k, BANK));
    if (!st.total) return;
    h += srow(lecLabel(k) + ' · ' + lecFull(k), st);
  });
  h += '</div>';
  $('#stats-body').innerHTML = h;
}
function srow(title, st) {
  var pc = st.total ? Math.round(st.done / st.total * 100) : 0;
  var acc = st.done ? Math.round(st.ok / st.done * 100) : 0;
  return '<div class="srow"><b>' + esc(title) + '</b>' +
    '<span class="n">' + st.done + '/' + st.total + (st.done ? ' · ' + acc + '%' : '') + '</span>' +
    '<span class="pbar"><i style="width:' + pc + '%"></i></span></div>';
}

/* ═════════════════════════════════════ GitHub Gist sync */
var GIST_FILE = 'immune-sum2-progress.json';
var syncing = false, syncTimer = null;

function tok() { return localStorage.getItem(LS_TOK) || ''; }
function gistId() { return localStorage.getItem(LS_GIST) || ''; }

function setStatus(msg, cls) {
  var el = $('#sync-status');
  el.textContent = msg;
  el.className = 'sync-status' + (cls ? ' ' + cls : '');
}

function gh(path, opt) {
  opt = opt || {};
  opt.headers = Object.assign({
    'Accept': 'application/vnd.github+json',
    'Authorization': 'Bearer ' + tok(),
    'X-GitHub-Api-Version': '2022-11-28'
  }, opt.headers || {});
  return fetch('https://api.github.com' + path, opt).then(function (r) {
    if (r.ok) return r.json();
    /* surface GitHub's own message — a bare status code is useless to debug */
    return r.json().catch(function () { return {}; }).then(function (j) {
      var msg = j.message || ('HTTP ' + r.status);
      if (r.status === 403 || r.status === 404) {
        msg += ' — the token is missing the "gist" scope, or it is a ' +
               'fine-grained token (those cannot access gists at all).';
      } else if (r.status === 401) {
        msg += ' — token rejected; it may be mistyped, expired or revoked.';
      }
      var e = new Error(msg);
      e.status = r.status;
      throw e;
    });
  });
}

/* Check the token BEFORE doing anything with it, so the failure message is
   specific instead of a mystery 403 halfway through a sync. */
function validateToken(t) {
  if (/^github_pat_/.test(t)) {
    return Promise.resolve({ ok: false, msg:
      'That is a fine-grained token. GitHub\'s Gist API does not support ' +
      'fine-grained tokens at all — you need a CLASSIC token with the "gist" scope.' });
  }
  return fetch('https://api.github.com/user', {
    headers: { 'Authorization': 'Bearer ' + t, 'Accept': 'application/vnd.github+json' }
  }).then(function (r) {
    if (r.status === 401) {
      return { ok: false, msg: 'Token rejected (401). Check you pasted the whole thing, and that it has not expired.' };
    }
    if (!r.ok) return { ok: false, msg: 'GitHub returned ' + r.status + ' when checking the token.' };
    var scopes = r.headers.get('x-oauth-scopes');
    if (scopes === null) {
      return { ok: false, msg:
        'GitHub reports no scopes for this token, which means it is fine-grained. ' +
        'Gists need a CLASSIC token with the "gist" scope.' };
    }
    var list = scopes.split(/,\s*/).filter(Boolean);
    if (list.indexOf('gist') < 0) {
      return { ok: false, msg:
        'This token has no "gist" scope. It has: ' + (list.join(', ') || 'no scopes') +
        '. Regenerate a classic token and tick the "gist" checkbox.' };
    }
    return r.json().then(function (u) { return { ok: true, login: u.login, scopes: list.join(', ') }; });
  }).catch(function (e) {
    return { ok: false, msg: 'Could not reach GitHub: ' + e.message };
  });
}

/* merge remote into local, question by question, newest timestamp wins */
function merge(remote) {
  var changed = 0;
  Object.keys(remote || {}).forEach(function (id) {
    if (!byId[id]) return;
    var r = remote[id], l = prog[id];
    if (!l || (r.ts || 0) > (l.ts || 0)) { prog[id] = r; changed++; }
  });
  if (changed) { saveJSON(LS_PROG, prog); renderHome(); }
  return changed;
}

function findOrCreateGist() {
  var id = gistId();
  if (id) return Promise.resolve(id);
  return gh('/gists?per_page=100').then(function (list) {
    var hit = list.filter(function (g) { return g.files && g.files[GIST_FILE]; })[0];
    if (hit) { localStorage.setItem(LS_GIST, hit.id); return hit.id; }
    var files = {}; files[GIST_FILE] = { content: JSON.stringify({ progress: prog }) };
    return gh('/gists', {
      method: 'POST',
      body: JSON.stringify({ description: 'Immune Sum II trainer progress', public: false, files: files })
    }).then(function (g) { localStorage.setItem(LS_GIST, g.id); return g.id; });
  });
}

function pull(quiet) {
  if (!tok()) { if (!quiet) setStatus('No token — connect first.', 'bad'); return Promise.resolve(); }
  return findOrCreateGist().then(function (id) {
    return gh('/gists/' + id + '?t=' + Date.now());
  }).then(function (g) {
    var f = g.files && g.files[GIST_FILE];
    if (!f) return;
    var body = f.truncated ? fetch(f.raw_url).then(function (r) { return r.text(); })
                           : Promise.resolve(f.content);
    return Promise.resolve(body).then(function (txt) {
      var data = JSON.parse(txt || '{}');
      var n = merge(data.progress || {});
      setStatus('Pulled ' + (new Date()).toLocaleTimeString() +
        (n ? ' — merged ' + n + ' update' + (n === 1 ? '' : 's') : ' — already up to date'), 'good');
      if (!quiet && n) toast('Merged ' + n + ' update' + (n === 1 ? '' : 's') + ' from your other device');
      /* push the merged union back, so anything this device holds that the
         remote lacked also reaches the other devices — this is what makes the
         two sides genuinely converge rather than one overwriting the other */
      scheduleSync();
    });
  }).catch(function (e) {
    setStatus('Pull failed — ' + e.message, 'bad');
    if (!quiet) toast('Sync failed — see the message in Sync setup');
    return false;
  });
}

function push(quiet) {
  if (!tok() || syncing) return Promise.resolve();
  syncing = true;
  return findOrCreateGist().then(function (id) {
    var files = {};
    files[GIST_FILE] = { content: JSON.stringify({ progress: prog, at: Date.now() }) };
    return gh('/gists/' + id, { method: 'PATCH', body: JSON.stringify({ files: files }) });
  }).then(function () {
    setStatus('Synced ' + (new Date()).toLocaleTimeString(), 'good');
  }).catch(function (e) {
    setStatus('Push failed — ' + e.message, 'bad');
  }).then(function () { syncing = false; });
}

function scheduleSync() {
  if (!tok()) return;
  clearTimeout(syncTimer);
  syncTimer = setTimeout(function () { push(true); }, 2500);
}

$('#btn-sync').addEventListener('click', function () {
  $('#tok').value = tok() ? '••••••••••••••••' : '';
  if (tok()) setStatus('Connected. Auto-saves a few seconds after each answer.', 'good');
  openSheet('sheet-sync');
});
$('#btn-connect').addEventListener('click', function () {
  var v = $('#tok').value.trim();
  if (!v || v.indexOf('•') === 0) { setStatus('Paste a token first.', 'bad'); return; }
  setStatus('Checking token…');
  validateToken(v).then(function (res) {
    if (!res.ok) { setStatus('✗ ' + res.msg, 'bad'); return; }
    localStorage.setItem(LS_TOK, v);
    localStorage.removeItem(LS_GIST);
    setStatus('Token OK for @' + res.login + ' — syncing…');
    /* sequential, and stop on the first failure so the real error is not
       masked by a second one */
    return pull(false).then(function (okPull) {
      if (okPull === false) return;
      return push(false);
    });
  });
});
$('#btn-pull').addEventListener('click', function () { setStatus('Pulling…'); pull(false); });
$('#btn-push').addEventListener('click', function () { setStatus('Pushing…'); push(false); });
$('#btn-forget').addEventListener('click', function () {
  localStorage.removeItem(LS_TOK); localStorage.removeItem(LS_GIST);
  setStatus('Token removed from this device. Progress here is untouched.');
  toast('Token forgotten');
});

/* pull on open and when returning to the app */
document.addEventListener('visibilitychange', function () {
  if (!document.hidden && tok()) pull(true);
});

/* ═════════════════════════════════════════════════ about */
$('#btn-about').addEventListener('click', function () {
  var s = statsOf(PAST);
  $('#about-body').innerHTML =
    '<b>Immune Summative II — past-paper trainer</b><br>' +
    PAST.length + ' past-paper items (' +
    PAST.filter(function (q) { return q.k === 'mcq'; }).length + ' MCQ + ' +
    PAST.filter(function (q) { return q.k === 'written'; }).length + ' written) from ' +
    'BM32 · BM31 · BM30 · BM29 · BM28 · AX, plus ' + AUTH.length +
    ' author-made drill items.<br><br>' +
    'Every answer is verified against the <b>BM33 L10–L19</b> lecture decks and ' +
    'standard immunology — not copied from student keys. Where a key looked wrong ' +
    'it is corrected openly (⚠).<br><br>' +
    'Works fully offline once installed. Progress is stored on this device and, ' +
    'if you connect a token, merged across devices through a private GitHub Gist.';
  openSheet('sheet-about');
});
$('#btn-reset').addEventListener('click', function () {
  if (!confirm('Erase all answers, stars and timings on this device?')) return;
  prog = {}; saveJSON(LS_PROG, prog);
  renderHome(); closeSheet('sheet-about'); toast('Progress reset');
});

/* ═════════════════════════════════════════════════ boot */
renderHome();
setTimeout(function () { $('#boot').classList.add('gone'); }, 220);
if (tok()) pull(true);

if ('serviceWorker' in navigator) {
  window.addEventListener('load', function () {
    navigator.serviceWorker.register('sw.js').catch(function () {});
  });
}

/* keep progress safe if the app is backgrounded mid-answer */
window.addEventListener('pagehide', function () { persist(false); if (tok()) push(true); });

})();
