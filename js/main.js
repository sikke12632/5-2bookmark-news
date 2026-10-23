// 책갈피 어린이 신문 — 책상 화면 (날마다 규칙이 하나씩 쌓인다)
(() => {
  const $ = (s) => document.querySelector(s);
  const $$ = (s) => [...document.querySelectorAll(s)];
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const pick = (a) => a[Math.floor(Math.random() * a.length)];

  const BARS = [
    ['trust', '📰', '믿음'],
    ['readers', '👀', '독자'],
    ['heart', '✍️', '기자 마음'],
    ['money', '💰', '살림'],
  ];
  const STAMP = { print: '싣는다', fix: '고쳐 오라', cut: '뺀다' };
  const ORD = ['첫째', '둘째', '셋째', '넷째', '다섯째', '여섯째', '일곱째', '여덟째', '아홉째', '열째',
    '열한째', '열두째', '열셋째', '열넷째', '열다섯째', '열여섯째', '열일곱째', '열여덟째', '열아홉째', '스무째',
    '스물한째', '스물두째', '스물셋째', '스물넷째', '스물다섯째', '스물여섯째', '스물일곱째', '스물여덟째', '스물아홉째', '서른째'];
  const dayName = (n) => `${ORD[n - 1] || n + '번째'} 날`;
  const ALL = /[?&]all\b/.test(location.search); // 선생님 미리 보기: 모든 날을 연습으로 열기

  // 신문은 평일에만 나온다. 1일째 = 2026년 10월 26일 월요일
  function dateOf(n) {
    const d = new Date(2026, 9, 26);
    for (let k = 1; k < n;) { d.setDate(d.getDate() + 1); if (d.getDay() % 6) k++; }
    return `${d.getMonth() + 1}월 ${d.getDate()}일 ${'일월화수목금토'[d.getDay()]}요일`;
  }

  // 원고가 어느 날 몇 번째인지 (고쳐 온 원고를 저장하려고)
  const REF = new Map();
  NEWS.days.forEach((d) => d.items.forEach((it, i) => REF.set(it, { n: d.n, i })));
  const dayIndexOf = (n) => NEWS.days.findIndex((d) => d.n === n);

  const fresh = () => ({ trust: 50, readers: 50, heart: 50, money: 50 });
  const freshStats = () => ({ found: 0, total: 0, days: 0, perfect: 0 });
  const S = {
    level: 'easy', mode: 30, seed: 1, plan: [], gi: 0, prevN: 0, di: 0, day: null, queue: [], idx: 0, cur: null, busy: true, practice: false,
    bars: fresh(), start: 0, total: 0, running: false, lastTick: -1,
    log: [], delta: {},
    carry: [],      // 다음 날 책상에 다시 올 원고 {n, i} (고쳐 온 광고 등)
    prevFixed: [],  // 어제 「고쳐 오라」 한 기사 → 오늘 신문에 고쳐서 실림 {title, body, by, ad}
    letters: [],    // 다음 날 아침에 올 독자 편지
    stats: freshStats(),
    lastCrisis: -9, // 위기가 마지막으로 온 날 (사흘에 한 번까지만)
  };

  // ── 저장 (이 컴퓨터 브라우저에만) ──
  const KEY = 'bookmark-news-v1';
  function load() { try { return JSON.parse(localStorage.getItem(KEY)) || null; } catch (e) { return null; } }
  function store(o) { try { localStorage.setItem(KEY, JSON.stringify(o)); } catch (e) {} }
  // 하루 중간 저장: 원고 한 장에 도장을 찍을 때마다 (탭을 닫아도 그 원고부터 이어 한다)
  function saveMid() {
    if (S.practice || !S.day) return;
    const sv = load();
    if (!sv) return;
    sv.mid = {
      gi: S.gi, startCarry: S.dayCarry, bars: S.bars, delta: S.delta, carry: S.carry, letters: S.letters,
      lastCrisis: S.lastCrisis, level: S.level,
      elapsed: Math.min(S.total, (performance.now() - S.start) / 1000),
      done: S.log.map((r) => ({ stamp: r.stamp, circled: [...(r.circled || [])] })),
    };
    store(sv);
  }
  function saveProgress(next) {
    const old = load() || {};
    store({
      mode: S.mode, seed: S.seed, plan: S.plan,
      next, level: S.level, bars: S.bars, carry: S.carry, prevFixed: S.prevFixed, letters: S.letters,
      stats: S.stats, lastCrisis: S.lastCrisis, reached: Math.max(old.reached || 0, S.plan[next - 1] + 1), endings: old.endings || [],
    });
  }

  // ── 무대 크기 맞추기 ──
  function fit() {
    const s = Math.min(innerWidth / 1280, innerHeight / 720);
    document.documentElement.style.setProperty('--s', s);
  }
  addEventListener('resize', fit); fit();

  // ── 글 해석: 낱말마다 콕 찍을 수 있게 나눈다 ──
  // parts: { w: 낱말인가, text, z: 자리(t 제목, b 본문, c 사진 설명), g: 틀린 곳 번호, trap: 함정 까닭 }
  // errs:  { kind, text, fix, why }
  function parseText(src, errs, z, parts) {
    const plain = (s, extra) => s.split(/([가-힣A-Za-z0-9%]+)/).forEach((x, i) => {
      if (x) parts.push({ w: i % 2 === 1, text: x, z, ...extra });
    });
    const re = /\{(?:(\w+):)?([^>}]+)>([^|}]+)\|([^}]+)\}|\[([^|\]]+)\|([^\]]+)\]/g;
    let last = 0, m;
    while ((m = re.exec(src))) {
      if (m.index > last) plain(src.slice(last, m.index));
      if (m[2]) {
        const g = errs.length;
        errs.push({ kind: m[1] || 'sp', text: m[2], fix: m[3], why: m[4] });
        plain(m[2], { g });
      } else plain(m[5], { trap: m[6] });
      last = re.lastIndex;
    }
    plain(src.slice(last));
  }
  function parseItem(it) {
    const parts = [], errs = [];
    parseText(it.title, errs, 't', parts);
    parseText(it.body, errs, 'b', parts);
    if (it.caption) parseText(it.caption, errs, 'c', parts);
    return { parts, errs };
  }
  // 고친 글 (틀린 곳을 고친말로 바꿔서)
  function fixedText(parts, errs, z) {
    let out = '';
    const done = new Set();
    for (const p of parts) {
      if (p.z !== z) continue;
      if (p.g === undefined) out += p.text;
      else if (!done.has(p.g)) { done.add(p.g); out += errs[p.g].fix; }
    }
    return out;
  }
  const kindsUntil = (n) => Object.entries(NEWS.kinds).filter(([, k]) => k.day <= n).map(([id]) => id);
  const daysUntil = (n) => NEWS.days.filter((d) => d.n <= n);

  // 그날까지 쌓인 기록부 (같은 이름은 나중 것으로 바뀐다)
  function ledgerAt(n) {
    const rows = new Map();
    for (const d of daysUntil(n)) for (const [k, v] of d.ledger || []) rows.set(k, { v, isNew: d.n > S.prevN });
    return [...rows].map(([k, r]) => ({ k, ...r }));
  }

  // ── 막대 ──
  function drawBars() {
    $('#bars').innerHTML = BARS.map(([k, ic, nm]) =>
      `<div class="bar" data-k="${k}"><span class="ic">${ic}</span><span>${nm}</span><span class="track"><span class="fill" style="width:${S.bars[k]}%"></span></span></div>`).join('');
  }
  function bump(changes) {
    for (const [k, v] of Object.entries(changes)) {
      if (!v) continue;
      S.bars[k] = Math.max(0, Math.min(100, S.bars[k] + v));
      S.delta[k] = (S.delta[k] || 0) + v;
      const el = document.querySelector(`.bar[data-k="${k}"]`);
      el.querySelector('.fill').style.width = S.bars[k] + '%';
      el.classList.remove('up', 'down'); void el.offsetWidth;
      el.classList.add(v > 0 ? 'up' : 'down');
      setTimeout(() => el.classList.remove('up', 'down'), 1200);
    }
  }

  // ── 시계 (9시 → 12시) ──
  function buildClock() {
    let g = '';
    for (let i = 0; i < 60; i++) {
      const a = (i * 6) * Math.PI / 180, big = i % 5 === 0;
      const r1 = big ? 56 : 60, r2 = 64;
      g += `<line class="mark${big ? '' : ' small'}" x1="${80 + r1 * Math.sin(a)}" y1="${80 - r1 * Math.cos(a)}" x2="${80 + r2 * Math.sin(a)}" y2="${80 - r2 * Math.cos(a)}"/>`;
    }
    for (const n of [12, 3, 6, 9]) {
      const a = n * 30 * Math.PI / 180;
      g += `<text class="num" x="${80 + 45 * Math.sin(a)}" y="${80 - 45 * Math.cos(a)}">${n}</text>`;
    }
    $('#marks').innerHTML = g;
    // 11시~12시 칸을 붉게
    const a0 = 330 * Math.PI / 180;
    $('#deadline').setAttribute('d', `M80 80 L${80 + 66 * Math.sin(a0)} ${80 - 66 * Math.cos(a0)} A66 66 0 0 1 80 14 Z`);
  }
  function setClock(frac) {
    const gm = frac * 180; // 게임 속 분
    const h = 9 + gm / 60;
    $('#hHand').setAttribute('transform', `rotate(${h * 30} 80 80)`);
    $('#mHand').setAttribute('transform', `rotate(${(gm % 60) * 6} 80 80)`);
  }
  function loop() {
    if (!S.running) return;
    const frac = Math.min(1, (performance.now() - S.start) / 1000 / S.total);
    setClock(frac);
    const left = S.total * (1 - frac);
    $('#clock').classList.toggle('hurry', left < Math.min(30, S.total * 0.2));
    if (left < 30) {
      const sec = Math.floor(left);
      if (sec !== S.lastTick) { S.lastTick = sec; SND.play('tick'); }
    }
    if (frac >= 1) { endDay(true); return; }
    requestAnimationFrame(loop);
  }

  // ── 겹쳐 뜨는 화면 ──
  function sheet(html, cls = '') {
    $('#sheet').className = cls;
    $('#sheet').innerHTML = html;
    $('#sheet').scrollTop = 0;
    $('#overlay').classList.remove('hide');
  }
  function closeSheet() { $('#overlay').classList.add('hide'); }

  function resetDesk() {
    S.running = false;
    document.body.classList.remove('evening');
    $('#ledger').classList.add('hide');
    $('#paperSlot').innerHTML = '';
    $('#reporter').className = '';
    say('');
    tip('');
    closeSide();
    $('#slip').classList.remove('show');
    setClock(0);
    $('#clock').classList.remove('hurry');
  }

  // ── 게임 길이: 게임 속 몇 주인지 고르고, 그만큼 날을 뽑는다 ──
  const MODES = [{ L: 5, w: 1 }, { L: 10, w: 2 }, { L: 20, w: 4 }, { L: 30, w: 6 }];
  const modeOf = (L) => MODES.find((m) => m.L === L) || MODES[MODES.length - 1];
  // 실제 걸리는 시간 어림: 원고 한 장 65초, 하루에 아침 회의·신문 보기 1분 30초
  function estimate(L) {
    const avg = NEWS.days.reduce((s, d) => s + d.items.length, 0) / NEWS.days.length;
    const min = Math.round((L * avg * 65 + L * 90) / 60 / 5) * 5;
    const h = Math.floor(min / 60), m = min % 60;
    return '약 ' + (h ? `${h}시간${m ? ` ${m}분` : ''}` : `${m}분`);
  }
  // 씨앗이 같으면 늘 같은 순서가 나오는 난수 (이어 하기 때 같은 판을 다시 만들려고)
  function rng(seed) {
    let a = seed >>> 0;
    return () => {
      a = (a + 0x6D2B79F5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  // 첫날은 늘 1일째, 마지막 날은 늘 30일째(송년 음악회). 그 사이는 구간마다 하루씩 무작위로
  function makePlan(L, seed) {
    const N = NEWS.days.length;
    if (L >= N) return NEWS.days.map((d, i) => i);
    const r = rng(seed), plan = [0], step = (N - 1) / (L - 1);
    for (let g = 1; g < L - 1; g++) {
      const top = N - 1 - (L - 1 - g);
      const lo = Math.min(top, Math.max(plan[g - 1] + 1, Math.round(g * step - step / 2)));
      const hi = Math.max(lo, Math.min(top, Math.round(g * step + step / 2) - 1));
      plan.push(lo + Math.floor(r() * (hi - lo + 1)));
    }
    plan.push(N - 1);
    return plan;
  }
  function shuffled(list, seed) {
    const a = list.slice(), r = rng(seed);
    for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
    return a;
  }
  // 그날 원고: 어제 고쳐 오라 한 원고가 먼저, 나머지는 판마다 순서를 섞는다
  function buildQueue(D, carry, seed) {
    const carried = carry.map((r) => { const d = NEWS.days[dayIndexOf(r.n)]; return d && d.items[r.i] && d.items[r.i].revised; }).filter(Boolean);
    return [...carried, ...shuffled(D.items, seed)];
  }
  // 예전(길이 고르기 전) 저장을 30일 판으로 읽는다
  function migrate(sv) {
    if (sv && !sv.plan) {
      sv.mode = 30; sv.seed = 1; sv.plan = NEWS.days.map((d, i) => i);
      if (sv.mid && sv.mid.gi === undefined) sv.mid.gi = sv.mid.di;
    }
    return sv;
  }

  // ── 첫 화면 ──
  function title() {
    resetDesk();
    S.day = null;
    const sv = migrate(load());
    if (sv && sv.level) S.level = sv.level;
    const going = sv && sv.next < sv.plan.length;
    const midHere = going && sv.mid && sv.mid.gi === sv.next;
    S.bars = going ? { ...(midHere ? sv.mid.bars : sv.bars) } : fresh();
    drawBars();
    if (!going) { setup(sv); return; }
    const M = modeOf(sv.mode);
    const endN = (sv.endings || []).length;
    sheet(`
      <div style="width:780px">
        <div class="masthead"><h1>책갈피 어린이 신문</h1><div class="sub"><span>책갈피 마을 소식을 전해요</span><span>게임 속 ${M.w}주 판 · ${sv.next}호까지 냈어요</span></div></div>
        <p class="intro">하던 판을 이어서 할까요?</p>
        <div class="center"><button class="btn" id="cont">이어 하기 · ${dayName(sv.next + 1)}${midHere ? ` ${sv.mid.done.length + 1}번째 원고부터` : ''}</button>
          <button class="btn gray" id="newRun">새 판 시작</button></div>
        <div class="titleFoot">
          <button class="link" id="past">지난 날 다시 해 보기 (연습)</button>
          <button class="link" id="ends">엔딩 모음 ${endN} / ${NEWS.endings.length}</button>
        </div>
      </div>`);
    $('#cont').onclick = () => {
      Object.assign(S, { mode: sv.mode, seed: sv.seed, plan: sv.plan, level: sv.level || S.level });
      if (midHere) { resumeMid(sv); return; }
      Object.assign(S, { bars: { ...sv.bars }, carry: sv.carry || [], prevFixed: sv.prevFixed || [], letters: sv.letters || [], stats: sv.stats || freshStats(), practice: false, lastCrisis: sv.lastCrisis ?? -9 });
      drawBars();
      startDay(sv.next);
    };
    $('#newRun').onclick = () => setup(sv, true);
    $('#past').onclick = pastDays;
    $('#ends').onclick = endingsPage;
  }

  // 새 판: 게임 길이와 난이도 고르기
  let pickL = 5;
  function setup(sv, overwrite) {
    const finished = sv && sv.next >= sv.plan.length;
    const modes = MODES.map((m) => `<button class="lv mode${m.L === pickL ? ' on' : ''}" data-l="${m.L}"><b>게임 속 ${m.w}주</b><span>신문 ${m.L}호${m.L === 30 ? ' (전체)' : ''}<br>실제 시간 ${estimate(m.L)}</span></button>`).join('');
    const lv = Object.entries(NEWS.levels).map(([k, L]) =>
      `<button class="lv${k === S.level ? ' on' : ''}" data-lv="${k}"><b>${L.name}</b><span>${L.desc}</span></button>`).join('');
    const endN = sv && sv.endings ? sv.endings.length : 0;
    sheet(`
      <div style="width:860px">
        <div class="masthead"><h1>책갈피 어린이 신문</h1><div class="sub"><span>책갈피 마을 소식을 전해요</span><span>${finished ? '지난 판을 끝냈어요! 다른 엔딩도 찾아볼까요?' : '편집장 자리가 비어 있어요'}</span></div></div>
        <p class="intro small">기자들이 가져온 원고를 읽고, <b>틀린 곳을 콕 찍은 다음</b> 도장을 쾅 찍어 주세요. 판마다 나오는 날과 기사 순서가 달라져요.</p>
        <h3 class="pickT">게임 길이</h3>
        <div class="levels modes">${modes}</div>
        <h3 class="pickT">난이도</h3>
        <div class="levels">${lv}</div>
        <div class="center"><button class="btn" id="go">${overwrite ? '새 판 시작 (하던 판은 지워져요)' : '편집장 자리에 앉기'}</button>${overwrite ? ' <button class="btn gray" id="back">돌아가기</button>' : ''}</div>
        <div class="titleFoot">
          ${ALL || (sv && sv.reached > 0) ? '<button class="link" id="past">지난 날 다시 해 보기 (연습)</button>' : '<span></span>'}
          <button class="link" id="ends">엔딩 모음 ${endN} / ${NEWS.endings.length}</button>
        </div>
      </div>`);
    $$('.lv.mode').forEach((b) => b.onclick = () => {
      pickL = +b.dataset.l;
      $$('.lv.mode').forEach((x) => x.classList.toggle('on', x === b));
    });
    $$('.lv[data-lv]').forEach((b) => b.onclick = () => {
      S.level = b.dataset.lv;
      $$('.lv[data-lv]').forEach((x) => x.classList.toggle('on', x === b));
    });
    $('#go').onclick = () => {
      const old = load() || {};
      const seed = Math.floor(Math.random() * 2 ** 31);
      Object.assign(S, {
        mode: pickL, seed, plan: makePlan(pickL, seed),
        bars: fresh(), carry: [], prevFixed: [], letters: [], stats: freshStats(), practice: false, lastCrisis: -9,
      });
      store({ mode: S.mode, seed, plan: S.plan, next: 0, level: S.level, bars: S.bars, carry: [], prevFixed: [], letters: [], stats: S.stats, reached: old.reached || 0, endings: old.endings || [] });
      drawBars();
      startDay(0);
    };
    if ($('#back')) $('#back').onclick = title;
    if ($('#past')) $('#past').onclick = pastDays;
    $('#ends').onclick = endingsPage;
  }

  // 지난 날 고르기 (연습: 저장하지 않는다)
  function pastDays() {
    const sv = load() || {};
    const reach = ALL ? NEWS.days.length : Math.min(NEWS.days.length, sv.reached || 0);
    const grid = NEWS.days.map((d, i) => `<button class="dayBtn" data-i="${i}"${i < reach ? '' : ' disabled'}><b>${d.n}</b><span>${dateOf(d.n).replace(/요일$/, '')}</span></button>`).join('');
    sheet(`<div style="width:760px"><h2 class="pageT">지난 날 다시 해 보기</h2>
      <p class="intro small">한 번 해 본 날을 골라 연습해요. 연습은 기록에 남지 않고, 막대도 가운데에서 시작해요.</p>
      <div class="dayGrid">${grid}</div>
      <div class="center"><button class="btn gray" id="back">돌아가기</button></div></div>`);
    $$('.dayBtn').forEach((b) => b.onclick = () => {
      const seed = Math.floor(Math.random() * 2 ** 31);
      Object.assign(S, { mode: 1, seed, plan: [+b.dataset.i], bars: fresh(), carry: [], prevFixed: [], letters: [], stats: freshStats(), practice: true });
      drawBars();
      startDay(0);
    });
    $('#back').onclick = title;
  }

  function endingsPage() {
    const got = (load() || {}).endings || [];
    const cards = NEWS.endings.map((e) => got.includes(e.id)
      ? `<div class="endCard got"><b>${e.name}</b><span>${e.text}</span></div>`
      : `<div class="endCard"><b>${e.hidden ? '???' : e.name}</b><span>아직 못 봤어요</span></div>`).join('');
    sheet(`<div style="width:760px"><h2 class="pageT">엔딩 모음</h2><div class="endGrid">${cards}</div>
      <div class="center"><button class="btn gray" id="back">돌아가기</button></div></div>`);
    $('#back').onclick = title;
  }

  // 오늘 판의 몇째 날인지, 지난번에 한 날은 몇 일째였는지
  function enterDay(gi) {
    const di = S.plan[gi], D = NEWS.days[di];
    Object.assign(S, { gi, di, day: D, prevN: S.practice ? D.n - 1 : gi ? NEWS.days[S.plan[gi - 1]].n : 0 });
    $('#dayLabel').innerHTML = S.practice ? `${D.n}일째 연습<small>${dateOf(D.n)}</small>` : `${dayName(gi + 1)}<small>${dateOf(D.n)}</small>`;
    drawRules();
    $('#ledger').classList.toggle('hide', D.n < NEWS.ledgerFrom);
    return D;
  }

  // ── 하루 시작: 위기 → 아침 회의 ──
  function startDay(gi) {
    resetDesk();
    const D = enterDay(gi);
    const letters = S.letters;
    S.letters = [];
    Object.assign(S, { queue: buildQueue(D, S.carry, S.seed + gi * 101), idx: 0, log: [], delta: {}, busy: true, dayCarry: S.carry, carry: [] });

    // 막대가 바닥이면 위기 사건부터 (사흘에 한 번까지만)
    const low = BARS.map(([k]) => k).filter((k) => S.bars[k] <= NEWS.crisisAt).sort((a, b) => S.bars[a] - S.bars[b])[0];
    if (low && !S.practice && gi - S.lastCrisis >= 3) { S.lastCrisis = gi; crisis(low, () => morning(D, letters)); }
    else morning(D, letters);
  }

  function crisis(k, then) {
    const C = NEWS.crises[k];
    const [ic, nm] = BARS.find((b) => b[0] === k).slice(1);
    sheet(`
      <div class="morning crisis">
        <h2>위기! ${C.title}</h2>
        <p class="ctext">${ic} ${nm} 막대가 바닥이에요. ${C.text}<br>어떻게 할까요?</p>
        <div class="cbtns"><button class="btn" id="ca">${C.a[0]}</button><button class="btn gray" id="cb">${C.b[0]}</button></div>
      </div>`);
    const go = (eff) => { bump(eff); then(); };
    $('#ca').onclick = () => go(C.a[1]);
    $('#cb').onclick = () => go(C.b[1]);
  }

  function morning(D, letters) {
    // 건너뛴 날에 생긴 규칙도 함께 알려 준다
    const skipped = NEWS.days.filter((d) => d.n > S.prevN && d.n < D.n);
    const skippedRules = skipped.map((d) => d.short ? d.short : d.note && d.note.length ? '새 낱말: ' + d.note.map((c) => c[0]).join(', ') : '').filter(Boolean);
    const newLedger = S.prevN < NEWS.ledgerFrom && D.n >= NEWS.ledgerFrom;
    const ledgerNews = !newLedger && NEWS.days.some((d) => d.n > S.prevN && d.n <= D.n && (d.ledger || []).length);
    const letterHtml = letters.length ? `
      <div class="letters"><b>✉ 독자 편지가 왔어요</b>${letters.map((l) => `<p>"${l.text}"<span>— ${l.from}</span></p>`).join('')}</div>` : '';
    const skipHtml = skippedRules.length ? `
      <div class="skipped"><b>그동안 새로 생긴 규칙도 있어요</b><ul>${skippedRules.map((r) => `<li>${r}</li>`).join('')}</ul><span>자세한 설명은 편집 수첩에 있어요.</span></div>` : '';
    sheet(`
      <div class="morning${letters.length && skippedRules.length ? ' compact' : ''}">
        <h2>아침 회의</h2>
        <div class="date">${S.practice ? `${D.n}일째 연습` : `${dayName(S.gi + 1)} / ${S.plan.length}일`} · ${dateOf(D.n)} · 원고 ${S.queue.length}장</div>
        ${letterHtml}
        ${skipHtml}
        <div class="note"><b>오늘의 새 소식</b>${D.rule}</div>
        ${newLedger ? '<p class="newtool">책상에 <b>마을 기록부</b>가 생겼어요. 콕 눌러 펼쳐 보세요.</p>' : ''}
        ${ledgerNews ? '<p class="newtool"><b>마을 기록부</b>에 새로 적힌 줄이 있어요.</p>' : ''}
        ${D.speed > 1 ? '<p class="newtool"><b>오늘은 시계가 빨라요!</b></p>' : ''}
        ${D.n > 1 ? '<p class="newtool">지난 규칙도 그대로 지켜요.</p>' : ''}
        <button class="btn" id="ok">알겠어요!</button>
      </div>`);
    $('#ok').onclick = () => {
      closeSheet();
      if (letters.length) bump({ trust: -2 * letters.length });
      $('#ruleNote').classList.add('fresh');
      setTimeout(() => $('#ruleNote').classList.remove('fresh'), 2600);
      if (newLedger || ledgerNews) { $('#ledger').classList.add('fresh'); setTimeout(() => $('#ledger').classList.remove('fresh'), 2600); }
      S.total = NEWS.levels[S.level].per * S.queue.length / (D.speed || 1);
      S.start = performance.now(); S.running = true; S.lastTick = -1;
      saveMid();
      requestAnimationFrame(loop);
      nextItem();
    };
  }

  // 하루 중간에서 이어 하기
  function resumeMid(sv) {
    const M = sv.mid;
    resetDesk();
    Object.assign(S, {
      bars: { ...M.bars }, carry: M.carry || [], prevFixed: sv.prevFixed || [], letters: M.letters || [],
      stats: sv.stats || freshStats(), practice: false, lastCrisis: M.lastCrisis ?? -9, level: M.level || S.level,
      dayCarry: M.startCarry || [], delta: { ...M.delta }, busy: true,
    });
    const D = enterDay(M.gi);
    S.queue = buildQueue(D, S.dayCarry, S.seed + M.gi * 101);
    S.log = M.done.slice(0, S.queue.length).map((d, qi) => {
      const it = S.queue[qi];
      const rec = grade({ it, ...parseItem(it), circled: new Map(d.circled) }, d.stamp);
      rec.circled = d.circled;
      return rec;
    });
    S.idx = S.log.length;
    drawBars();
    setClock(M.elapsed / NEWS.levels[S.level].per / S.queue.length * (D.speed || 1));
    sheet(`
      <div class="morning">
        <h2>이어서 해요</h2>
        <div class="date">${dayName(M.gi + 1)} · ${dateOf(D.n)}</div>
        <p class="newtool">원고 ${S.queue.length}장 가운데 ${S.idx}장을 끝냈어요. ${S.idx + 1}번째 원고부터 이어 해요.</p>
        <button class="btn" id="ok">시작!</button>
      </div>`);
    $('#ok').onclick = () => {
      closeSheet();
      S.total = NEWS.levels[S.level].per * S.queue.length / (D.speed || 1);
      S.start = performance.now() - M.elapsed * 1000; S.running = true; S.lastTick = -1;
      requestAnimationFrame(loop);
      nextItem();
    };
  }

  // 규칙 쪽지: 최근 규칙 네 줄까지, 나머지는 수첩에
  function drawRules() {
    const n = S.day.n;
    const all = daysUntil(n).filter((d) => d.short);
    const shown = all.slice(-4);
    const more = all.length - shown.length;
    $('#ruleText').innerHTML = (more ? `<li class="more" value="0">앞의 규칙 ${more}개는 수첩에</li>` : '')
      + shown.map((d) => `<li value="${all.indexOf(d) + 1}"${d.n > S.prevN ? ' class="new"' : ''}>${d.short}</li>`).join('');
  }

  // ── 기자가 원고를 가져온다 ──
  async function nextItem() {
    if (S.idx >= S.queue.length) { endDay(false); return; }
    const it = S.queue[S.idx];
    const R = NEWS.reporters[it.by];
    S.cur = { it, ...parseItem(it), circled: new Map() };
    $('#face').innerHTML = ART.reporter(it.by, R.badge);
    $('#nameTag').textContent = R.name;
    const rep = $('#reporter');
    rep.className = '';
    void rep.offsetWidth;
    rep.className = 'here';
    tip('');
    await sleep(500);
    say(it.ask || pick(R.hello));
    SND.play('paper');
    drawPaper();
    S.busy = false;
    setStamps(true);
    tip(`원고 ${S.idx + 1} / ${S.queue.length} · 틀린 낱말이 있으면 콕 찍어 동그라미를 쳐요.`);
  }

  function drawPaper() {
    const C = S.cur, L = NEWS.levels[S.level], it = C.it;
    const zone = (z) => C.parts.map((p, i) => p.z !== z ? '' : p.w ? `<span class="w" data-i="${i}">${p.text}</span>` : p.text).join('');
    const hint = L.hint ? `<span class="hint">틀린 곳 ${C.errs.length}개</span>` : '';
    const R = NEWS.reporters[it.by];
    const by = it.ad ? `${R.name}이 가져온 광고` : `${R.name}의 원고`;
    let photo = '';
    if (it.photo) {
      const pic = typeof it.photo === 'string' ? ART.photo(it.photo)
        : `<div class="ephoto" style="background:${it.photo.bg || '#e8f0f6'}">${it.photo.e}</div>`;
      photo = `<figure class="photo">${pic}<figcaption>${zone('c')}</figcaption></figure>`;
    }
    $('#paperSlot').innerHTML = `
      <div class="paper live${it.ad ? ' ad' : ''}">
        ${hint}
        <div class="byline">${by}</div>
        <h2 class="ptitle${it.title.length > 16 ? ' long' : ''}">${zone('t')}</h2>
        ${photo}
        <p class="pbody">${zone('b')}</p>
      </div>`;
    $$('.paper .w').forEach((el) => el.onclick = (e) => { e.stopPropagation(); toggleCircle(el); });
    $('.paper').onclick = () => dropPending();
  }

  // ── 콕 찍기와 까닭 고르기 ──
  let pending = null; // 까닭을 아직 안 고른 동그라미
  function ring(el) {
    const rot = (Math.random() * 8 - 4).toFixed(1);
    el.insertAdjacentHTML('beforeend', `<svg class="ring" viewBox="0 0 100 42" preserveAspectRatio="none"><ellipse cx="50" cy="21" rx="47" ry="17" pathLength="120" transform="rotate(${rot} 50 21)"/></svg>`);
  }
  function unring(el) {
    el.querySelector('svg.ring')?.remove();
    el.querySelector('.whytag')?.remove();
  }
  function dropPending() {
    if (!pending) return;
    unring(pending);
    pending = null;
    $('.why')?.remove();
    tipAfterCircle();
  }
  // 낱말의 자리를 원고 종이 기준으로 (사진 설명 안의 낱말도)
  function posIn(el, paper) {
    const a = el.getBoundingClientRect(), b = paper.getBoundingClientRect();
    const s = b.width / paper.offsetWidth;
    return { x: (a.left - b.left) / s, y: (a.top - b.top) / s, h: a.height / s };
  }
  function toggleCircle(el) {
    if (S.busy) return;
    const i = +el.dataset.i, C = S.cur;
    if (pending === el) { dropPending(); return; }
    dropPending();
    if (C.circled.has(i)) {
      C.circled.delete(i);
      unring(el);
      tipAfterCircle();
      return;
    }
    ring(el);
    SND.play('pen');
    const kinds = kindsUntil(S.day.n);
    if (kinds.length === 1) { setWhy(el, kinds[0]); return; }
    pending = el;
    const paper = el.closest('.paper');
    const btns = kinds.map((k) => `<button data-k="${k}">${NEWS.kinds[k].name}</button>`).join('');
    const wide = kinds.length > 4;
    const W = wide ? 360 : 230, H = 44 + Math.ceil(kinds.length / (wide ? 2 : 1)) * 42 + 24;
    const p = posIn(el, paper);
    let top = p.y + p.h + 6;
    if (top + H > paper.offsetHeight - 4) top = Math.max(4, p.y - H - 6);
    const left = Math.max(8, Math.min(p.x - 30, paper.offsetWidth - W - 8));
    paper.insertAdjacentHTML('beforeend',
      `<div class="why${wide ? ' wide' : ''}" style="top:${top}px;left:${left}px;width:${W}px"><b>왜 틀렸나요?</b><div class="whyBtns">${btns}</div><button class="del">지우기</button></div>`);
    const box = $('.why');
    box.onclick = (e) => e.stopPropagation();
    box.querySelectorAll('button[data-k]').forEach((b) => b.onclick = () => { box.remove(); pending = null; setWhy(el, b.dataset.k); });
    box.querySelector('.del').onclick = () => dropPending();
    tip('왜 틀렸는지 골라요.');
  }
  function setWhy(el, kind) {
    S.cur.circled.set(+el.dataset.i, kind);
    if (kindsUntil(S.day.n).length > 1) el.insertAdjacentHTML('beforeend', `<span class="whytag">${NEWS.kinds[kind].name}</span>`);
    tipAfterCircle();
  }
  function tipAfterCircle() {
    if (!S.cur) return;
    tip(S.cur.circled.size ? '다 찾았으면 오른쪽 도장을 골라 찍어요. 동그라미를 지우려면 한 번 더 콕!'
      : `원고 ${S.idx + 1} / ${S.queue.length} · 틀린 낱말이 있으면 콕 찍어 동그라미를 쳐요.`);
  }

  function say(text) {
    const b = $('#bubble');
    b.classList.remove('show'); void b.offsetWidth;
    b.textContent = text;
    if (text) b.classList.add('show');
  }
  function tip(t) { $('#tip').textContent = t; }
  function setStamps(on) { $$('.stamp').forEach((b) => b.disabled = !on); }

  // ── 채점 ──
  function grade(C, k) {
    const { parts, errs, circled } = C;
    const found = [], wrongWhy = [], missed = [];
    errs.forEach((e, g) => {
      const hit = parts.map((p, i) => i).filter((i) => parts[i].g === g && circled.has(i));
      if (!hit.length) missed.push(g);
      else if (circled.get(hit[0]) === e.kind) found.push(g);
      else wrongWhy.push(g);
    });
    const wrong = [...circled.keys()].filter((i) => parts[i].g === undefined);
    const rightStamp = C.it.cut ? 'cut' : errs.length ? 'fix' : 'print';
    return { it: C.it, parts, errs, stamp: k, found, wrongWhy, missed, wrong, rightStamp };
  }

  // ── 도장 ──
  $$('.stamp').forEach((b) => b.onclick = () => stamp(b.dataset.k, b));

  async function stamp(k, btn) {
    if (S.busy || !S.cur) return;
    dropPending();
    const C = S.cur, R = NEWS.reporters[C.it.by];
    // 고쳐 오라는 어디를 고칠지 찍어야 받아 간다
    if (k === 'fix' && C.circled.size === 0) {
      say('편집장님, 어디를 고쳐요? 틀린 곳을 펜으로 콕 찍어 주세요!');
      const p = $('.paper'); p.classList.remove('shake'); void p.offsetWidth; p.classList.add('shake');
      SND.play('bad');
      return;
    }
    S.busy = true; setStamps(false);
    btn.classList.add('press'); setTimeout(() => btn.classList.remove('press'), 180);
    const paper = $('.paper');
    paper.classList.remove('live');
    const rot = (Math.random() * 14 - 7).toFixed(1);
    paper.insertAdjacentHTML('beforeend', `<div class="imprint ${k}" style="--rot:${rot}deg">${STAMP[k]}</div>`);
    SND.play('stamp');

    const rec = grade(C, k);
    rec.circled = [...C.circled];
    S.log.push(rec);
    C.done = true;
    const hasErr = rec.errs.length > 0, isCut = !!C.it.cut;

    const ch = {};
    const add = (key, v) => ch[key] = (ch[key] || 0) + v;
    if (k === 'print') {
      add('readers', isCut ? 6 : 3); add('heart', 3);
      add('trust', isCut ? -8 : hasErr ? -6 : 2);
      if (C.it.pay) add('money', C.it.pay);
      if (hasErr || isCut) S.letters.push(letterFor(rec));
    } else if (k === 'fix') {
      add('heart', -1);
      if (isCut) add('trust', -2);
      else if (hasErr) add('trust', rec.missed.length ? 0 : rec.wrongWhy.length ? 1 : 2);
      else add('heart', -5);
      const ref = REF.get(C.it);
      if (C.it.revised && ref) S.carry.push(ref);
    } else {
      if (isCut) { add('trust', 5); add('heart', -2); }
      else { add('readers', -4); add('heart', -8); }
    }
    if (k !== 'print' && rec.wrong.length) add('heart', -2 * rec.wrong.length);
    bump(ch);
    saveMid();

    // 기자 반응
    const ok = k === rec.rightStamp && (k !== 'fix' || (!rec.missed.length && !rec.wrong.length && !rec.wrongWhy.length));
    if (k === 'print') say(R.print);
    else if (k === 'cut') say(R.cut);
    else say(hasErr && (rec.found.length || rec.wrongWhy.length) ? R.fix : R.oops);
    SND.play(ok ? 'good' : 'bad');
    showSlip(rec);

    await sleep(900);
    paper.classList.add(k === 'print' ? 'goPrint' : k === 'fix' ? 'goBack' : 'goCut');
    await sleep(700);
    $('#paperSlot').innerHTML = '';
    $('#reporter').className = 'bye';
    say('');
    S.cur = null;
    S.idx++;
    tip('다음 기자가 와요…');
    await sleep(900);
    if (S.running) nextItem();
  }

  function letterFor(rec) {
    let text = rec.it.complaint;
    if (!text && rec.it.cut) text = '남의 일을 신문에 함부로 내면 어떡해요? 그 기사를 읽고 속상했어요.';
    if (!text) {
      const e = rec.errs[0];
      // 받침에 따라 조사가 바뀌지 않게 쓴다
      text = e.kind === 'sp' || e.kind === 'space' ? `어제 신문에 잘못 쓴 말이 있어요. 「${e.text}」 말고 「${e.fix}」! 맞죠?`
        : e.kind === 'ad' ? `광고에 나온 「${e.text}」, 정말인지 알 수가 없잖아요.`
          : e.kind === 'rec' ? `신문에 난 「${e.text}」, 마을 기록부와 달라서 헷갈렸어요.`
            : `어제 신문의 「${clean(rec.it.title)}」 기사가 이상했어요. 다시 확인해 주세요.`;
    }
    return { text, from: pick(NEWS.readers) };
  }

  // 채점 쪽지
  let slipTimer = 0;
  function showSlip(rec) {
    const E = rec.errs, rows = [];
    if (rec.it.cut) {
      rows.push(rec.stamp === 'cut' ? `<div class="row ok">✔ 빼야 할 기사를 잘 뺐어요.<small>${rec.it.cutWhy || ''}</small></div>`
        : `<div class="row no">✘ 이 기사는 「뺀다」를 찍어야 해요.<small>${rec.it.cutWhy || ''}</small></div>`);
    } else {
      for (const g of rec.found) rows.push(`<div class="row ok">✔ 잘 찾았어요! ${E[g].text} → ${E[g].fix}<small>${E[g].why}</small></div>`);
      for (const g of rec.wrongWhy) rows.push(`<div class="row half">△ 찾았어요! 그런데 까닭은 「${NEWS.kinds[E[g].kind].name}」 쪽이에요.<small>${E[g].why}</small></div>`);
      for (const g of rec.missed) rows.push(`<div class="row no">✘ 놓쳤어요: ${E[g].text} → ${E[g].fix}<small>${E[g].why}</small></div>`);
      for (const i of rec.wrong) {
        const p = rec.parts[i];
        rows.push(`<div class="row no">✘ 「${p.text}」: 틀린 곳이 아니에요.${p.trap ? `<small>${p.trap}</small>` : ''}</div>`);
      }
      if (!E.length && !rec.wrong.length && rec.stamp === 'print') rows.push('<div class="row ok">✔ 틀린 곳 없는 기사를 잘 실었어요.</div>');
      if (rec.stamp !== rec.rightStamp) rows.push(`<div class="row no">✘ 알맞은 도장은 「${STAMP[rec.rightStamp]}」였어요.</div>`);
      if (rec.stamp === 'fix' && rec.it.revised) rows.push('<div class="row">✉ 내일 고친 원고를 다시 가져온대요.</div>');
    }
    const s = $('#slip');
    s.innerHTML = `<h4>채점 쪽지</h4>${rows.join('')}<span class="close">콕 누르면 닫혀요</span>`;
    s.classList.add('show');
    clearTimeout(slipTimer);
    slipTimer = setTimeout(() => s.classList.remove('show'), 7000);
  }
  $('#slip').onclick = () => $('#slip').classList.remove('show');

  // ── 옆 펼침: 편집 수첩, 마을 기록부 (원고를 가리지 않게 책상 왼쪽에 편다) ──
  let sideOpen = '';
  function closeSide() { sideOpen = ''; $('#side').classList.remove('show'); }
  function openSide(kind) {
    if (!S.day) return;
    if (sideOpen === kind) { closeSide(); return; }
    sideOpen = kind;
    const n = S.day.n;
    let html;
    if (kind === 'note') {
      const rules = daysUntil(n).filter((d) => d.short).map((d) => `<li>${d.short}</li>`).join('');
      const cards = daysUntil(n).slice().reverse().flatMap((d) => (d.note || []).map((c) => [c, d.n > S.prevN]))
        .map(([[h, t, e], today]) => `<div class="tipcard${today ? ' today' : ''}"><b>${h}</b>${today ? '<i>오늘</i>' : ''}<br>${t}<em>${e}</em></div>`).join('');
      html = `<h3 class="nbT">편집 수첩</h3><div class="allRules"><b>지켜야 할 규칙</b><ol>${rules}</ol></div>${cards}`;
    } else {
      const rows = ledgerAt(n).map((r) => `<tr${r.isNew && n > NEWS.ledgerFrom ? ' class="new"' : ''}><th>${r.k}</th><td>${r.v}</td></tr>`).join('');
      html = `<h3 class="lgT">마을 기록부</h3><table>${rows}</table>`;
    }
    $('#side').className = `show ${kind}`;
    $('#side').innerHTML = `<button class="x" aria-label="닫기">✕</button>${html}`;
    $('#side').scrollTop = 0;
    $('#side .x').onclick = closeSide;
    SND.play('paper');
  }
  $('#notebook').onclick = () => openSide('note');
  $('#ledger').onclick = () => openSide('ledger');
  $('#ruleNote').onclick = () => openSide('note');
  $('#overlay').onclick = (e) => { if (e.target.id === 'overlay' && S.running) closeSheet(); };

  // ── 마감 ──
  async function endDay(late) {
    if (!S.day || S.busy && !S.running) return;
    S.running = false;
    S.busy = true; setStamps(false);
    dropPending();
    setClock(late ? 1 : Math.min(1, (performance.now() - S.start) / 1000 / S.total));
    $('#clock').classList.remove('hurry');
    if (late) {
      const left = S.queue.slice(S.idx + (S.cur && S.cur.done ? 1 : 0));
      for (const it of left) S.log.push({ it, ...parseItem(it), stamp: null, found: [], wrongWhy: [], missed: [], wrong: [], rightStamp: it.cut ? 'cut' : null });
      if (left.length) bump({ readers: -4 * left.length });
      $('#paperSlot').innerHTML = '';
      $('#reporter').className = 'bye';
      say('');
    }
    S.cur = null;
    tip('');
    closeSide();
    SND.play('bell');
    sheet(`<div class="press">${late ? '마감 시간이에요!<br>' : ''}신문을 찍고 있어요…<div class="rollers"><i></i><i></i><i></i></div></div>`);
    // 막대는 날마다 조금씩 가운데로 돌아온다 (요즘 얼마나 잘했는지가 보이게)
    const drift = {};
    for (const [k] of BARS) drift[k] = Math.round((50 - S.bars[k]) * 0.12);
    bump(drift);
    // 인쇄비를 내고, 독자가 많을수록 신문 판 돈이 들어온다
    bump({ money: -10 + Math.round(S.bars.readers / 20) });
    await sleep(2200);
    document.body.classList.add('evening');
    showResult();
  }

  const clean = (s) => s.replace(/\{(?:\w+:)?([^>}]+)>[^}]*\}/g, '$1').replace(/\[([^|\]]+)\|[^\]]*\]/g, '$1');

  function showResult() {
    const D = S.day, last = !S.practice && S.gi === S.plan.length - 1;
    const yFixed = S.prevFixed;
    S.prevFixed = S.log.filter((r) => r.stamp === 'fix' && !r.it.revised && !r.it.cut)
      .map((r) => ({ title: fixedText(r.parts, r.errs, 't'), body: fixedText(r.parts, r.errs, 'b'), by: r.it.by, ad: !!r.it.ad }));
    const printed = S.log.filter((r) => r.stamp === 'print');
    const zone = (r, z) => r.parts.map((p) => p.z !== z ? '' : p.g !== undefined ? `<span class="bad">${p.text}</span>` : p.text).join('');
    const art = (ad, titleHtml, by, body, note = '') => `<div class="art"><h3>${ad ? '<i class="adtag">광고</i>' : ''}${titleHtml}</h3><div class="who">${NEWS.reporters[by].name}${note}</div><p>${body}</p></div>`;
    const arts = printed.map((r) => art(r.it.ad, zone(r, 't'), r.it.by, (r.it.cut ? '<span class="bad">' : '') + zone(r, 'b') + (r.it.cut ? '</span>' : ''))).join('')
      + yFixed.map((f) => art(f.ad, f.title, f.by, f.body, ' · 어제 고쳐 온 기사')).join('');
    const later = S.log.filter((r) => r.stamp === 'fix' && !r.it.cut).map((r) => `<li>${clean(r.it.title)}</li>`).join('');
    const boxes = (later && !last ? `<div class="art box"><h3>내일 실을 기사</h3><ul>${later}</ul></div>` : '');

    const total = S.log.reduce((n, r) => n + (r.it.cut ? 0 : r.errs.length), 0);
    const foundN = S.log.reduce((n, r) => n + (r.it.cut ? 0 : r.found.length + r.wrongWhy.length), 0);
    const whyN = S.log.reduce((n, r) => n + r.wrongWhy.length, 0);
    const wrongN = S.log.reduce((n, r) => n + r.wrong.length, 0);
    const items = S.log.map((r) => {
      const E = r.errs;
      const tag = r.stamp ? `<span class="tag ${r.stamp}">${STAMP[r.stamp]}</span>` : '<span class="tag none">못 봤어요</span>';
      const lines = [];
      if (r.it.cut) {
        lines.push(r.stamp === 'cut' ? '<div class="ok">✔ 빼야 할 기사를 잘 뺐어요</div>' : '<div class="no">✘ 빼야 할 기사였어요</div>');
      } else {
        if (!r.stamp) E.forEach((e) => lines.push(`<div class="no">✘ 못 봄: ${e.text} → ${e.fix}</div>`));
        r.found.forEach((g) => lines.push(`<div class="ok">✔ ${E[g].text} → ${E[g].fix}</div>`));
        r.wrongWhy.forEach((g) => lines.push(`<div class="half">△ ${E[g].text} → ${E[g].fix} (까닭: ${NEWS.kinds[E[g].kind].name})</div>`));
        r.missed.forEach((g) => lines.push(`<div class="no">✘ 놓침: ${E[g].text} → ${E[g].fix}</div>`));
        r.wrong.forEach((i) => lines.push(`<div class="no">✘ 「${r.parts[i].text}」: 맞는 말이었어요</div>`));
        if (r.stamp && r.stamp !== r.rightStamp) lines.push(`<div class="no">✘ 알맞은 도장: ${STAMP[r.rightStamp]}</div>`);
        if (r.stamp && !lines.length) lines.push('<div class="ok">✔ 완벽해요</div>');
      }
      return `<div class="item"><b>${clean(r.it.title)}</b>${tag}${lines.join('')}</div>`;
    }).join('');
    const perfect = foundN === total && !whyN && !wrongN && S.log.every((r) => r.stamp && r.stamp === r.rightStamp);
    if (perfect) bump({ heart: 4 });

    // 기록
    if (!S.practice) {
      S.stats.found += foundN; S.stats.total += total; S.stats.days += 1;
      if (perfect) S.stats.perfect += 1;
      saveProgress(S.gi + 1);
    }

    const deltas = BARS.map(([k, ic, nm]) => {
      const v = S.delta[k] || 0;
      return `<div>${ic} ${nm} <span class="${v > 0 ? 'p' : v < 0 ? 'm' : ''}">${v > 0 ? '+' + v : v}</span></div>`;
    }).join('');
    let message = perfect ? '완벽한 신문이에요! 마을 사람들이 믿고 읽겠어요.'
      : printed.some((r) => r.errs.length || r.it.cut) ? '실으면 안 될 글이 신문에 나갔어요. 독자 편지가 올지도 몰라요!'
        : '좋은 신문이에요. 더 꼼꼼히 보면 완벽해질 거예요!';
    if (last) message += `<br><b>게임 속 ${modeOf(S.mode).w}주 동안 신문을 다 냈어요!</b>`;
    const letters = last && S.letters.length
      ? `<div class="letters small"><b>✉ 벌써 독자 편지가 왔어요</b>${S.letters.map((l) => `<p>"${l.text}"<span>— ${l.from}</span></p>`).join('')}</div>` : '';
    let btns;
    if (S.practice) btns = '<button class="btn" id="past">다른 날 고르기</button><button class="btn gray" id="home">처음 화면</button>';
    else if (last) btns = '<button class="btn" id="ending">엔딩 보기</button>';
    else btns = `<button class="btn" id="next">${dayName(S.gi + 2)}로</button><button class="btn gray" id="home">쉬었다 하기</button>`;

    sheet(`
      <div class="news">
        <div class="masthead"><h1>책갈피 어린이 신문</h1><div class="sub"><span>${S.practice ? '연습' : `제${S.gi + 1}호`}</span><span>${dateOf(D.n)}</span></div></div>
        ${arts ? '' : '<div class="empty">오늘 실린 기사가 하나도 없어요.</div>'}
        <div class="cols">${arts}${boxes}</div>
      </div>
      <div class="review">
        <h2>오늘의 교정 기록</h2>
        <div class="score">찾은 틀린 곳 <b>${foundN}</b> / ${total}${wrongN ? ` · 잘못 찍은 곳 ${wrongN}` : ''}</div>
        ${items}
        <div class="deltas">${deltas}</div>
        <div class="say">${message}</div>
        ${letters}
        <div class="btnrow">${btns}</div>
        ${!S.practice && !last ? '<p class="saved">여기까지 저장했어요. 다음에 「이어 하기」로 계속해요.</p>' : ''}
      </div>`, 'result');
    if ($('#next')) $('#next').onclick = () => startDay(S.gi + 1);
    if ($('#home')) $('#home').onclick = title;
    if ($('#past')) $('#past').onclick = pastDays;
    if ($('#ending')) $('#ending').onclick = showEnding;
  }

  function showEnding() {
    const acc = S.stats.total ? S.stats.found / S.stats.total : 0;
    const E = NEWS.endings.find((e) => e.test(S.bars, acc));
    const sv = load() || {};
    const got = new Set(sv.endings || []);
    const first = !got.has(E.id);
    got.add(E.id);
    store({ ...sv, endings: [...got] });
    sheet(`
      <div class="ending">
        <div class="masthead"><h1>책갈피 어린이 신문</h1><div class="sub"><span>게임 속 ${modeOf(S.mode).w}주 · 마지막 호</span><span>${dateOf(NEWS.days[NEWS.days.length - 1].n)}</span></div></div>
        <div class="endStamp">${E.name}</div>
        <p class="endText">${E.text}</p>
        <div class="endStats">
          <span>낸 신문 <b>${S.stats.days}</b>호</span>
          <span>찾은 틀린 곳 <b>${S.stats.found}</b> / ${S.stats.total} (${Math.round(acc * 100)}%)</span>
          <span>완벽한 날 <b>${S.stats.perfect}</b>일</span>
        </div>
        <p class="endText small">${first ? '새 엔딩을 찾았어요! ' : ''}엔딩 모음 ${got.size} / ${NEWS.endings.length}</p>
        <div class="center"><button class="btn" id="home">처음 화면으로</button></div>
      </div>`);
    SND.play('bell');
    $('#home').onclick = title;
  }

  // ── 소리 단추 ──
  $('#soundBtn').onclick = () => $('#soundBtn').classList.toggle('off', !SND.toggle());

  // ── 시작 ──
  $('#village').innerHTML = ART.village();
  buildClock(); setClock(0); drawBars(); setStamps(false);
  title();

  // 시험용
  window.__news = { S, parseItem, startDay, dateOf, ledgerAt, KEY };
})();
