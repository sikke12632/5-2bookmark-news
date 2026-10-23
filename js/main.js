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
  const NUM = ['첫째', '둘째', '셋째', '넷째', '다섯째'];

  const fresh = () => ({ trust: 50, readers: 50, heart: 50, money: 50 });
  const S = {
    level: 'easy', dayN: 0, day: null, queue: [], idx: 0, cur: null, busy: true,
    bars: fresh(), start: 0, total: 0, running: false, lastTick: -1,
    log: [], delta: {},
    carry: [],      // 다음 날 책상에 다시 올 원고 (고쳐 온 광고)
    prevFixed: [],  // 어제 「고쳐 오라」 한 기사 → 오늘 신문에 고쳐서 실림
    letters: [],    // 다음 날 아침에 올 독자 편지
  };

  // ── 무대 크기 맞추기 ──
  function fit() {
    const s = Math.min(innerWidth / 1280, innerHeight / 720);
    document.documentElement.style.setProperty('--s', s);
  }
  addEventListener('resize', fit); fit();

  // ── 본문 해석: 낱말마다 콕 찍을 수 있게 나눈다 ──
  // parts: { w: 낱말인가, text, g: 틀린 곳 번호, trap: 함정 까닭 }
  // errs:  { kind, text, fix, why }
  function parseBody(src) {
    const parts = [], errs = [];
    const plain = (s, extra) => s.split(/([가-힣A-Za-z0-9%]+)/).forEach((x, i) => {
      if (x) parts.push({ w: i % 2 === 1, text: x, ...extra });
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
    return { parts, errs };
  }
  // 고친 글 (틀린 곳을 고친말로 바꿔서)
  function fixedText(parts, errs) {
    let out = '', done = new Set();
    for (const p of parts) {
      if (p.g === undefined) out += p.text;
      else if (!done.has(p.g)) { done.add(p.g); out += errs[p.g].fix; }
    }
    return out;
  }
  const kindsUntil = (n) => Object.entries(NEWS.kinds).filter(([, k]) => k.day <= n).map(([id]) => id);

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
    $('#overlay').classList.remove('hide');
  }
  function closeSheet() { $('#overlay').classList.add('hide'); }

  // ── 첫 화면 ──
  function title() {
    S.running = false;
    Object.assign(S, { bars: fresh(), carry: [], prevFixed: [], letters: [], day: null });
    drawBars();
    document.body.classList.remove('evening');
    $('#ledger').classList.add('hide');
    closeSide();
    const lv = Object.entries(NEWS.levels).map(([k, L]) =>
      `<button class="lv${k === S.level ? ' on' : ''}" data-lv="${k}"><b>${L.name}</b><span>${L.desc}</span></button>`).join('');
    sheet(`
      <div style="width:760px">
        <div class="masthead"><h1>책갈피 어린이 신문</h1><div class="sub"><span>책갈피 마을 소식을 전해요</span><span>편집장 자리가 비어 있어요</span></div></div>
        <p class="intro">편집장님, 어서 오세요!<br>기자들이 가져온 원고를 읽고, <b>틀린 곳을 콕 찍은 다음</b> 도장을 쾅 찍어 주세요.<br>마감 시계가 12시를 가리키면 그날 신문을 찍어요.</p>
        <div class="levels">${lv}</div>
        <div class="center"><button class="btn" id="go">편집장 자리에 앉기</button></div>
      </div>`);
    $$('.lv').forEach((b) => b.onclick = () => {
      S.level = b.dataset.lv;
      $$('.lv').forEach((x) => x.classList.toggle('on', x === b));
    });
    $('#go').onclick = () => startDay(0);
  }

  // ── 하루 시작: 아침 회의 ──
  function startDay(n) {
    const D = NEWS.days[n];
    const letters = S.letters;
    S.letters = [];
    Object.assign(S, { dayN: n, day: D, queue: [...S.carry, ...D.items], idx: 0, log: [], delta: {}, busy: true });
    S.carry = [];
    document.body.classList.remove('evening');
    $('#dayLabel').innerHTML = `${D.name}<small>${D.date}</small>`;
    drawRules();
    $('#paperSlot').innerHTML = '';
    $('#slip').classList.remove('show');
    closeSide();
    setClock(0);
    $('#clock').classList.remove('hurry');
    const newLedger = D.n === NEWS.ledger.from;
    $('#ledger').classList.toggle('hide', D.n < NEWS.ledger.from);

    const letterHtml = letters.length ? `
      <div class="letters"><b>✉ 독자 편지가 왔어요</b>${letters.map((l) => `<p>"${l.text}"<span>— ${l.from}</span></p>`).join('')}</div>` : '';
    sheet(`
      <div class="morning">
        <h2>아침 회의</h2>
        <div class="date">${D.name} · ${D.date}</div>
        ${letterHtml}
        <div class="note"><b>오늘의 새 규칙</b>${D.rule}</div>
        ${newLedger ? '<p class="newtool">책상에 <b>마을 기록부</b>가 생겼어요. 콕 눌러 펼쳐 보세요.</p>' : ''}
        ${n > 0 ? '<p class="newtool">어제까지의 규칙도 그대로 지켜요.</p>' : ''}
        <button class="btn" id="ok">알겠어요!</button>
      </div>`);
    $('#ok').onclick = () => {
      closeSheet();
      if (letters.length) bump({ trust: -2 * letters.length });
      $('#ruleNote').classList.add('fresh');
      setTimeout(() => $('#ruleNote').classList.remove('fresh'), 2600);
      if (newLedger) { $('#ledger').classList.add('fresh'); setTimeout(() => $('#ledger').classList.remove('fresh'), 2600); }
      S.total = NEWS.levels[S.level].per * S.queue.length;
      S.start = performance.now(); S.running = true; S.lastTick = -1;
      requestAnimationFrame(loop);
      nextItem();
    };
  }

  function drawRules() {
    const n = S.day.n;
    $('#ruleText').innerHTML = NEWS.days.filter((d) => d.n <= n)
      .map((d) => `<li${d.n === n ? ' class="new"' : ''}>${d.short}</li>`).join('');
  }

  // ── 기자가 원고를 가져온다 ──
  async function nextItem() {
    if (S.idx >= S.queue.length) { endDay(false); return; }
    const it = S.queue[S.idx];
    const R = NEWS.reporters[it.by];
    S.cur = { it, ...parseBody(it.body), circled: new Map() };
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
    tip('원고를 읽고, 틀린 낱말이 있으면 콕 찍어 동그라미를 쳐요.');
  }

  function drawPaper() {
    const C = S.cur, L = NEWS.levels[S.level], it = C.it;
    const body = C.parts.map((p, i) => p.w ? `<span class="w" data-i="${i}">${p.text}</span>` : p.text).join('');
    const hint = L.hint ? `<span class="hint">틀린 곳 ${C.errs.length}개</span>` : '';
    const by = it.ad ? `${NEWS.reporters[it.by].name}이 가져온 광고` : `${NEWS.reporters[it.by].name}의 원고`;
    const photo = it.photo ? `<figure class="photo">${ART.photo(it.photo)}<figcaption>${it.caption || ''}</figcaption></figure>` : '';
    $('#paperSlot').innerHTML = `
      <div class="paper live${it.ad ? ' ad' : ''}">
        ${hint}
        <div class="byline">${by}</div>
        <h2 class="ptitle${it.title.length > 16 ? ' long' : ''}">${it.title}</h2>
        ${photo}
        <p class="pbody">${body}</p>
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
    const btns = kinds.map((k) => `<button data-k="${k}">${NEWS.kinds[k].name}</button>`).join('');
    const top = el.offsetTop + 48, left = Math.max(10, Math.min(el.offsetLeft - 30, 568 - 230));
    el.closest('.paper').insertAdjacentHTML('beforeend',
      `<div class="why" style="top:${top}px;left:${left}px"><b>왜 틀렸나요?</b>${btns}<button class="del">지우기</button></div>`);
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
    tip(S.cur && S.cur.circled.size ? '다 찾았으면 오른쪽 도장을 골라 찍어요. 동그라미를 지우려면 한 번 더 콕!' : '원고를 읽고, 틀린 낱말이 있으면 콕 찍어 동그라미를 쳐요.');
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
    return { it: C.it, parts, errs, stamp: k, found, wrongWhy, missed, wrong, rightStamp: errs.length ? 'fix' : 'print' };
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
    S.log.push(rec);
    C.done = true;
    const hasErr = rec.errs.length > 0;

    const ch = {};
    const add = (key, v) => ch[key] = (ch[key] || 0) + v;
    if (k === 'print') {
      add('readers', 5); add('heart', 4);
      add('trust', hasErr ? -8 : 3);
      if (C.it.pay) add('money', C.it.pay);
      if (hasErr) S.letters.push(letterFor(rec));
    } else if (k === 'fix') {
      add('heart', -2);
      if (hasErr) add('trust', rec.missed.length ? 2 : rec.wrongWhy.length ? 4 : 6);
      else add('heart', -4);
      if (C.it.revised) S.carry.push(C.it.revised);
    } else {
      add('readers', -4); add('heart', -8);
    }
    if (k !== 'print' && rec.wrong.length) add('heart', -2 * rec.wrong.length);
    bump(ch);

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
    const e = rec.errs[0];
    const text = rec.it.complaint
      || (e.kind === 'sp' ? `어제 신문에 「${e.text}」라고 났던데요, 「${e.fix}」가 맞지 않나요?`
        : e.kind === 'ad' ? `광고에 「${e.text}」라고 해서 믿었는데, 정말인지 알 수가 없잖아요.`
          : `신문에는 「${e.text}」라고 났는데, 마을 기록부와 달라서 헷갈렸어요.`);
    return { text, from: pick(NEWS.readers) };
  }

  // 채점 쪽지
  let slipTimer = 0;
  function showSlip(rec) {
    const E = rec.errs, rows = [];
    for (const g of rec.found) rows.push(`<div class="row ok">✔ 잘 찾았어요! ${E[g].text} → ${E[g].fix}<small>${E[g].why}</small></div>`);
    for (const g of rec.wrongWhy) rows.push(`<div class="row half">△ 찾았어요! 그런데 까닭은 「${NEWS.kinds[E[g].kind].name}」 쪽이에요.<small>${E[g].why}</small></div>`);
    for (const g of rec.missed) rows.push(`<div class="row no">✘ 놓쳤어요: ${E[g].text} → ${E[g].fix}<small>${E[g].why}</small></div>`);
    for (const i of rec.wrong) {
      const p = rec.parts[i];
      rows.push(`<div class="row no">✘ 「${p.text}」: 틀린 곳이 아니에요.${p.trap ? `<small>${p.trap}</small>` : ''}</div>`);
    }
    if (!E.length && !rec.wrong.length && rec.stamp === 'print') rows.push('<div class="row ok">✔ 틀린 곳 없는 기사를 잘 실었어요.</div>');
    if (rec.stamp !== rec.rightStamp) rows.push(`<div class="row no">✘ 알맞은 도장은 「${STAMP[rec.rightStamp]}」였어요.</div>`);
    if (rec.stamp === 'fix' && rec.it.revised) rows.push('<div class="row">✉ 내일 고친 광고를 다시 가져온대요.</div>');
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
    let html;
    if (kind === 'note') {
      const cards = NEWS.days.filter((d) => d.n <= S.day.n).flatMap((d) => d.note)
        .map(([h, t, e]) => `<div class="tipcard"><b>${h}</b><br>${t}<em>${e}</em></div>`).join('');
      html = `<h3 class="nbT">편집 수첩</h3>${cards}`;
    } else {
      html = `<h3 class="lgT">마을 기록부</h3><table>${NEWS.ledger.rows.map(([a, b]) => `<tr><th>${a}</th><td>${b}</td></tr>`).join('')}</table>`;
    }
    $('#side').className = `show ${kind}`;
    $('#side').innerHTML = `<button class="x" aria-label="닫기">✕</button>${html}`;
    $('#side .x').onclick = closeSide;
    SND.play('paper');
  }
  $('#notebook').onclick = () => openSide('note');
  $('#ledger').onclick = () => openSide('ledger');
  $('#ruleNote').onclick = () => {
    if (!S.day || !S.running) return;
    sheet(`<div class="morning"><div class="note"><b>오늘의 새 규칙</b>${S.day.rule}</div><button class="btn" id="rnClose">닫기</button></div>`);
    $('#rnClose').onclick = closeSheet;
  };
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
      for (const it of left) S.log.push({ it, ...parseBody(it.body), stamp: null, found: [], wrongWhy: [], missed: [], wrong: [] });
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
    bump({ money: -5 });
    await sleep(2200);
    document.body.classList.add('evening');
    showResult();
  }

  function showResult() {
    const D = S.day, last = S.dayN === NEWS.days.length - 1;
    const yFixed = S.prevFixed;
    S.prevFixed = S.log.filter((r) => r.stamp === 'fix' && !r.it.revised);
    const printed = S.log.filter((r) => r.stamp === 'print');
    const art = (r, body, note = '') => `<div class="art"><h3>${r.it.ad ? '<i class="adtag">광고</i>' : ''}${r.it.title}</h3><div class="who">${NEWS.reporters[r.it.by].name}${note}</div><p>${body}</p></div>`;
    const arts = printed.map((r) => art(r, r.parts.map((p) => p.g !== undefined ? `<span class="bad">${p.text}</span>` : p.text).join(''))).join('')
      + yFixed.map((r) => art(r, fixedText(r.parts, r.errs), ' · 어제 고쳐 온 기사')).join('');
    const later = S.log.filter((r) => r.stamp === 'fix').map((r) => `<li>${r.it.title}</li>`).join('');
    const boxes = `<div class="art box"><h3>책갈피 마을 날씨</h3><p>☀ 맑음. 오후에는 손오공 씨네 구름 택시가 하늘을 지나가요.</p></div>`
      + (later && !last ? `<div class="art box"><h3>내일 실을 기사</h3><ul>${later}</ul></div>` : '');

    const total = S.log.reduce((n, r) => n + r.errs.length, 0);
    const foundN = S.log.reduce((n, r) => n + r.found.length + r.wrongWhy.length, 0);
    const whyN = S.log.reduce((n, r) => n + r.wrongWhy.length, 0);
    const wrongN = S.log.reduce((n, r) => n + r.wrong.length, 0);
    const items = S.log.map((r) => {
      const E = r.errs;
      const tag = r.stamp ? `<span class="tag ${r.stamp}">${STAMP[r.stamp]}</span>` : '<span class="tag none">못 봤어요</span>';
      const lines = [];
      if (!r.stamp) E.forEach((e) => lines.push(`<div class="no">✘ 못 봄: ${e.text} → ${e.fix}</div>`));
      r.found.forEach((g) => lines.push(`<div class="ok">✔ ${E[g].text} → ${E[g].fix}</div>`));
      r.wrongWhy.forEach((g) => lines.push(`<div class="half">△ ${E[g].text} → ${E[g].fix} (까닭: ${NEWS.kinds[E[g].kind].name})</div>`));
      r.missed.forEach((g) => lines.push(`<div class="no">✘ 놓침: ${E[g].text} → ${E[g].fix}</div>`));
      r.wrong.forEach((i) => lines.push(`<div class="no">✘ 「${r.parts[i].text}」: 맞는 말이었어요</div>`));
      if (r.stamp && r.stamp !== r.rightStamp) lines.push(`<div class="no">✘ 알맞은 도장: ${STAMP[r.rightStamp]}</div>`);
      if (r.stamp && !lines.length) lines.push('<div class="ok">✔ 완벽해요</div>');
      return `<div class="item"><b>${r.it.title}</b>${tag}${lines.join('')}</div>`;
    }).join('');
    const perfect = foundN === total && !whyN && !wrongN && S.log.every((r) => r.stamp && r.stamp === r.rightStamp);

    const deltas = BARS.map(([k, ic, nm]) => {
      const v = S.delta[k] || 0;
      return `<div>${ic} ${nm} <span class="${v > 0 ? 'p' : v < 0 ? 'm' : ''}">${v > 0 ? '+' + v : v}</span></div>`;
    }).join('');
    let message = perfect ? '완벽한 신문이에요! 마을 사람들이 믿고 읽겠어요.'
      : printed.some((r) => r.errs.length) ? '틀린 말이 그대로 신문에 나갔어요. 독자 편지가 올지도 몰라요!'
        : '좋은 신문이에요. 더 꼼꼼히 보면 완벽해질 거예요!';
    if (last) message += '<br><b>셋째 날까지 마쳤어요!</b> 넷째 날부터는 곧 만들어요.';
    const letters = last && S.letters.length
      ? `<div class="letters small"><b>✉ 벌써 독자 편지가 왔어요</b>${S.letters.map((l) => `<p>"${l.text}"<span>— ${l.from}</span></p>`).join('')}</div>` : '';
    const nextBtn = last ? '' : `<button class="btn" id="next">${NUM[S.dayN + 1]} 날로</button>`;

    sheet(`
      <div class="news">
        <div class="masthead"><h1>책갈피 어린이 신문</h1><div class="sub"><span>제${D.n}호</span><span>${D.date}</span></div></div>
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
        <div class="btnrow">${nextBtn}<button class="btn${last ? '' : ' gray'}" id="again">처음부터 다시</button></div>
      </div>`, 'result');
    if (!last) $('#next').onclick = () => startDay(S.dayN + 1);
    $('#again').onclick = title;
  }

  // ── 소리 단추 ──
  $('#soundBtn').onclick = () => $('#soundBtn').classList.toggle('off', !SND.toggle());

  // ── 시작 ──
  $('#village').innerHTML = ART.village();
  buildClock(); setClock(0); drawBars(); setStamps(false);
  title();

  // 시험용
  window.__news = { S, parseBody, startDay };
})();
