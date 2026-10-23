// 책갈피 어린이 신문 — 책상 화면 (하루 한 판)
(() => {
  const $ = (s) => document.querySelector(s);
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const pick = (a) => a[Math.floor(Math.random() * a.length)];

  const BARS = [
    ['trust', '📰', '믿음'],
    ['readers', '👀', '독자'],
    ['heart', '✍️', '기자 마음'],
    ['money', '💰', '살림'],
  ];
  const STAMP = { print: '싣는다', fix: '고쳐 오라', cut: '뺀다' };

  const S = {
    level: 'easy', day: null, idx: 0, cur: null, busy: true,
    bars: { trust: 50, readers: 50, heart: 50, money: 50 },
    start: 0, total: 0, paused: 0, pausedAt: 0, running: false, lastTick: -1,
    log: [], delta: {},
  };

  // ── 무대 크기 맞추기 ──
  function fit() {
    const s = Math.min(innerWidth / 1280, innerHeight / 720);
    document.documentElement.style.setProperty('--s', s);
  }
  addEventListener('resize', fit); fit();

  // ── 본문 해석: 낱말마다 콕 찍을 수 있게 나눈다 ──
  function parseBody(src) {
    const parts = [];
    const plain = (s) => s.split(/([가-힣A-Za-z0-9]+)/).forEach((x, i) => {
      if (x) parts.push(i % 2 ? { w: true, text: x } : { w: false, text: x });
    });
    const re = /\{([^>}]+)>([^|}]+)\|([^}]+)\}|\[([^|\]]+)\|([^\]]+)\]/g;
    let last = 0, m;
    while ((m = re.exec(src))) {
      if (m.index > last) plain(src.slice(last, m.index));
      if (m[1]) parts.push({ w: true, text: m[1], err: { fix: m[2], why: m[3] } });
      else parts.push({ w: true, text: m[4], trap: m[5] });
      last = re.lastIndex;
    }
    plain(src.slice(last));
    return parts;
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
  function elapsed() {
    return (performance.now() - S.start - S.paused) / 1000;
  }
  function loop() {
    if (!S.running) return;
    if (!S.pausedAt) {
      const frac = Math.min(1, elapsed() / S.total);
      setClock(frac);
      const left = S.total * (1 - frac);
      $('#clock').classList.toggle('hurry', left < Math.min(30, S.total * 0.2));
      if (left < 30) {
        const sec = Math.floor(left);
        if (sec !== S.lastTick) { S.lastTick = sec; SND.play('tick'); }
      }
      if (frac >= 1) { timeUp(); return; }
    }
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
    const lv = Object.entries(NEWS.levels).map(([k, L]) =>
      `<button class="lv${k === S.level ? ' on' : ''}" data-lv="${k}"><b>${L.name}</b><span>${L.desc}</span></button>`).join('');
    sheet(`
      <div style="width:760px">
        <div class="masthead"><h1>책갈피 어린이 신문</h1><div class="sub"><span>책갈피 마을 소식을 전해요</span><span>편집장 자리가 비어 있어요</span></div></div>
        <p class="intro">편집장님, 어서 오세요!<br>기자들이 가져온 원고를 읽고, <b>틀린 곳을 콕 찍은 다음</b> 도장을 쾅 찍어 주세요.<br>마감 시계가 12시를 가리키면 그날 신문을 찍어요.</p>
        <div class="levels">${lv}</div>
        <div class="center"><button class="btn" id="go">편집장 자리에 앉기</button></div>
      </div>`);
    document.querySelectorAll('.lv').forEach((b) => b.onclick = () => {
      S.level = b.dataset.lv;
      document.querySelectorAll('.lv').forEach((x) => x.classList.toggle('on', x === b));
    });
    $('#go').onclick = () => startDay(0);
  }

  // ── 하루 시작: 아침 회의 ──
  function startDay(n) {
    const D = NEWS.days[n];
    Object.assign(S, { day: D, idx: 0, log: [], delta: {}, busy: true });
    document.body.classList.remove('evening');
    $('#dayLabel').innerHTML = `${D.name}<small>${D.date}</small>`;
    $('#ruleText').textContent = D.rule;
    $('#paperSlot').innerHTML = '';
    setClock(0);
    $('#clock').classList.remove('hurry');
    sheet(`
      <div class="morning">
        <h2>아침 회의</h2>
        <div class="date">${D.name} · ${D.date}</div>
        <div class="note"><b>오늘의 새 규칙</b>${D.rule}</div>
        <button class="btn" id="ok">알겠어요!</button>
      </div>`);
    $('#ok').onclick = async () => {
      closeSheet();
      $('#ruleNote').classList.add('fresh');
      setTimeout(() => $('#ruleNote').classList.remove('fresh'), 2600);
      S.total = NEWS.levels[S.level].sec;
      S.start = performance.now(); S.paused = 0; S.pausedAt = 0; S.running = true; S.lastTick = -1;
      requestAnimationFrame(loop);
      nextItem();
    };
  }

  // ── 기자가 원고를 가져온다 ──
  async function nextItem() {
    const D = S.day;
    if (S.idx >= D.items.length) { endDay(false); return; }
    const it = D.items[S.idx];
    const R = NEWS.reporters[it.by];
    S.cur = { it, parts: parseBody(it.body), circled: new Set() };
    $('#face').innerHTML = ART.reporter(it.by);
    $('#nameTag').textContent = R.name;
    const rep = $('#reporter');
    rep.className = '';
    void rep.offsetWidth;
    rep.className = 'here';
    tip('');
    await sleep(500);
    say(pick(R.hello));
    SND.play('paper');
    drawPaper();
    S.busy = false;
    setStamps(true);
    tip('원고를 읽고, 틀린 낱말이 있으면 콕 찍어 동그라미를 쳐요.');
  }

  function drawPaper() {
    const C = S.cur, L = NEWS.levels[S.level];
    const errN = C.parts.filter((p) => p.err).length;
    const body = C.parts.map((p, i) => p.w ? `<span class="w" data-i="${i}">${p.text}</span>` : p.text).join('');
    const hint = L.hint ? `<span class="hint">틀린 곳 ${errN}개</span>` : '';
    $('#paperSlot').innerHTML = `
      <div class="paper live">
        ${hint}
        <div class="byline">${NEWS.reporters[C.it.by].name}의 원고</div>
        <h2 class="ptitle">${C.it.title}</h2>
        <p class="pbody">${body}</p>
      </div>`;
    document.querySelectorAll('.paper .w').forEach((el) => el.onclick = () => toggleCircle(el));
  }

  function toggleCircle(el) {
    if (S.busy) return;
    const i = +el.dataset.i, C = S.cur;
    if (C.circled.has(i)) {
      C.circled.delete(i);
      el.querySelector('svg.ring')?.remove();
    } else {
      C.circled.add(i);
      const rot = (Math.random() * 8 - 4).toFixed(1);
      el.insertAdjacentHTML('beforeend', `<svg class="ring" viewBox="0 0 100 42" preserveAspectRatio="none"><ellipse cx="50" cy="21" rx="47" ry="17" pathLength="120" transform="rotate(${rot} 50 21)"/></svg>`);
      SND.play('pen');
    }
    tip(C.circled.size ? '다 찾았으면 오른쪽 도장을 골라 찍어요. 동그라미를 지우려면 한 번 더 콕!' : '원고를 읽고, 틀린 낱말이 있으면 콕 찍어 동그라미를 쳐요.');
  }

  function say(text) {
    const b = $('#bubble');
    b.classList.remove('show'); void b.offsetWidth;
    b.textContent = text;
    b.classList.add('show');
  }
  function tip(t) { $('#tip').textContent = t; }
  function setStamps(on) { document.querySelectorAll('.stamp').forEach((b) => b.disabled = !on); }

  // ── 도장 ──
  document.querySelectorAll('.stamp').forEach((b) => b.onclick = () => stamp(b.dataset.k, b));

  async function stamp(k, btn) {
    if (S.busy || !S.cur) return;
    const C = S.cur, R = NEWS.reporters[C.it.by];
    const errs = C.parts.map((p, i) => p.err ? i : -1).filter((i) => i >= 0);
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

    // 채점
    const found = errs.filter((i) => C.circled.has(i));
    const missed = errs.filter((i) => !C.circled.has(i));
    const wrong = [...C.circled].filter((i) => !C.parts[i].err);
    const rightStamp = errs.length ? 'fix' : 'print';
    const rec = { it: C.it, parts: C.parts, stamp: k, found, missed, wrong, rightStamp };
    S.log.push(rec);

    const ch = {};
    const add = (key, v) => ch[key] = (ch[key] || 0) + v;
    if (k === 'print') {
      add('readers', 5); add('heart', 4);
      if (errs.length) add('trust', -8); else add('trust', 3);
    } else if (k === 'fix') {
      add('heart', -2);
      if (errs.length) add('trust', found.length === errs.length ? 6 : 2);
      else add('heart', -4);
    } else {
      add('readers', -4); add('heart', -8);
    }
    if (k !== 'print' && wrong.length) add('heart', -2 * wrong.length);
    bump(ch);

    // 기자 반응
    const ok = k === rightStamp && (k !== 'fix' || (missed.length === 0 && wrong.length === 0));
    if (k === 'print') say(R.print);
    else if (k === 'cut') say(R.cut);
    else say(errs.length && found.length ? R.fix : R.oops);
    SND.play(ok ? 'good' : 'bad');
    showSlip(rec);

    await sleep(900);
    paper.classList.add(k === 'print' ? 'goPrint' : k === 'fix' ? 'goBack' : 'goCut');
    await sleep(700);
    $('#paperSlot').innerHTML = '';
    $('#reporter').className = 'bye';
    $('#bubble').classList.remove('show');
    S.cur = null;
    S.idx++;
    tip('다음 기자가 와요…');
    await sleep(900);
    if (S.running) nextItem();
  }

  // 채점 쪽지
  let slipTimer = 0;
  function showSlip(rec) {
    const P = rec.parts, rows = [];
    for (const i of rec.found) rows.push(`<div class="row ok">✔ 잘 찾았어요! ${P[i].text} → ${P[i].err.fix}<small>${P[i].err.why}</small></div>`);
    for (const i of rec.missed) rows.push(`<div class="row no">✘ 놓쳤어요: ${P[i].text} → ${P[i].err.fix}<small>${P[i].err.why}</small></div>`);
    for (const i of rec.wrong) rows.push(`<div class="row no">✘ 「${P[i].text}」: 틀린 곳이 아니에요.${P[i].trap ? `<small>${P[i].trap}</small>` : ''}</div>`);
    if (!rec.found.length && !rec.missed.length && !rec.wrong.length && rec.stamp === 'print') rows.push('<div class="row ok">✔ 틀린 곳 없는 기사를 잘 실었어요.</div>');
    if (rec.stamp !== rec.rightStamp) rows.push(`<div class="row no">✘ 알맞은 도장은 「${STAMP[rec.rightStamp]}」였어요.</div>`);
    const s = $('#slip');
    s.innerHTML = `<h4>채점 쪽지</h4>${rows.join('')}<span class="close">콕 누르면 닫혀요</span>`;
    s.classList.add('show');
    clearTimeout(slipTimer);
    slipTimer = setTimeout(() => s.classList.remove('show'), 7000);
  }
  $('#slip').onclick = () => $('#slip').classList.remove('show');

  // ── 맞춤법 수첩, 규칙 쪽지 크게 보기 (보는 동안에도 시계는 간다) ──
  $('#notebook').onclick = () => {
    if (!S.day) return;
    const cards = S.day.note.map(([h, t, e]) => `<div class="tipcard"><b>${h}</b><br>${t}<em>${e}</em></div>`).join('');
    sheet(`<div class="nbOpen"><h2>맞춤법 수첩</h2>${cards}<div class="center"><button class="btn" id="nbClose">덮기</button></div></div>`);
    $('#nbClose').onclick = closeSheet;
    SND.play('paper');
  };
  $('#ruleNote').onclick = () => {
    if (!S.day) return;
    sheet(`<div class="morning"><div class="note"><b>오늘의 규칙</b>${S.day.rule}</div><button class="btn" id="rnClose">닫기</button></div>`);
    $('#rnClose').onclick = closeSheet;
  };
  $('#overlay').onclick = (e) => { if (e.target.id === 'overlay' && S.running) closeSheet(); };

  // ── 마감 ──
  function timeUp() {
    S.running = false;
    setClock(1);
    endDay(true);
  }

  async function endDay(late) {
    S.running = false;
    S.busy = true; setStamps(false);
    $('#clock').classList.remove('hurry');
    // 못 본 원고
    const left = S.day.items.slice(S.idx);
    if (late) {
      for (const it of left) S.log.push({ it, parts: parseBody(it.body), stamp: null, found: [], missed: [], wrong: [] });
      if (left.length) bump({ readers: -4 * left.length });
      $('#paperSlot').innerHTML = '';
      $('#reporter').className = 'bye';
      say('');
      $('#bubble').classList.remove('show');
    }
    S.cur = null;
    tip('');
    SND.play('bell');
    sheet(`<div class="press">${late ? '마감 시간이에요!<br>' : ''}신문을 찍고 있어요…<div class="rollers"><i></i><i></i><i></i></div></div>`);
    bump({ money: -5 });
    await sleep(2200);
    document.body.classList.add('evening');
    showResult();
  }

  function showResult() {
    const D = S.day;
    const printed = S.log.filter((r) => r.stamp === 'print');
    const arts = printed.map((r) => {
      const body = r.parts.map((p) => p.err ? `<span class="bad">${p.text}</span>` : p.text).join('');
      return `<div class="art"><h3>${r.it.title}</h3><div class="who">${NEWS.reporters[r.it.by].name}</div><p>${body}</p></div>`;
    }).join('');
    const later = S.log.filter((r) => r.stamp === 'fix').map((r) => `<li>${r.it.title}</li>`).join('');
    const boxes = `<div class="art box"><h3>책갈피 마을 날씨</h3><p>☀ 맑음. 오후에는 손오공 씨네 구름 택시가 하늘을 지나가요.</p></div>`
      + (later ? `<div class="art box"><h3>내일 실을 기사</h3><ul>${later}</ul></div>` : '');

    const allErr = S.log.reduce((n, r) => n + r.found.length + r.missed.length, 0);
    const foundN = S.log.reduce((n, r) => n + r.found.length, 0);
    const wrongN = S.log.reduce((n, r) => n + r.wrong.length, 0);
    const items = S.log.map((r) => {
      const P = r.parts;
      const tag = r.stamp ? `<span class="tag ${r.stamp}">${STAMP[r.stamp]}</span>` : '<span class="tag none">못 봤어요</span>';
      const lines = [];
      r.found.forEach((i) => lines.push(`<div class="ok">✔ ${P[i].text} → ${P[i].err.fix}</div>`));
      r.missed.forEach((i) => lines.push(`<div class="no">✘ 놓침: ${P[i].text} → ${P[i].err.fix}</div>`));
      if (!r.stamp) P.forEach((p) => { if (p.err) lines.push(`<div class="no">✘ 못 봄: ${p.text} → ${p.err.fix}</div>`); });
      r.wrong.forEach((i) => lines.push(`<div class="no">✘ 「${P[i].text}」: 맞는 말이었어요</div>`));
      if (r.stamp && r.stamp !== r.rightStamp) lines.push(`<div class="no">✘ 알맞은 도장: ${STAMP[r.rightStamp]}</div>`);
      if (r.stamp && !lines.length) lines.push('<div class="ok">✔ 완벽해요</div>');
      return `<div class="item"><b>${r.it.title}</b>${tag}${lines.join('')}</div>`;
    }).join('');
    const missAll = allErr + S.log.filter((r) => !r.stamp).reduce((n, r) => n + r.parts.filter((p) => p.err).length, 0);
    const perfect = foundN === missAll && wrongN === 0 && S.log.every((r) => r.stamp && r.stamp === r.rightStamp);

    const deltas = BARS.map(([k, ic, nm]) => {
      const v = S.delta[k] || 0;
      return `<div>${ic} ${nm} <span class="${v > 0 ? 'p' : v < 0 ? 'm' : ''}">${v > 0 ? '+' + v : v}</span></div>`;
    }).join('');
    const message = perfect ? '완벽한 신문이에요! 마을 사람들이 믿고 읽겠어요.'
      : printed.some((r) => r.missed.length) ? '틀린 말이 그대로 신문에 나갔어요. 내일은 더 꼼꼼히 봐요!'
      : '좋은 출발이에요. 내일은 더 꼼꼼히 봐요!';

    sheet(`
      <div class="news">
        <div class="masthead"><h1>책갈피 어린이 신문</h1><div class="sub"><span>제1호</span><span>${D.date}</span></div></div>
        ${arts ? '' : '<div class="empty">오늘 실린 기사가 하나도 없어요.</div>'}
        <div class="cols">${arts}${boxes}</div>
      </div>
      <div class="review">
        <h2>오늘의 교정 기록</h2>
        <div class="score">찾은 틀린 곳 <b>${foundN}</b> / ${missAll}${wrongN ? ` · 잘못 찍은 곳 ${wrongN}` : ''}</div>
        ${items}
        <div class="deltas">${deltas}</div>
        <div class="say">${message}</div>
        <div class="btnrow"><button class="btn" id="again">처음부터 다시</button><button class="btn" disabled>둘째 날은 곧 만들어요</button></div>
      </div>`, 'result');
    $('#again').onclick = () => {
      S.bars = { trust: 50, readers: 50, heart: 50, money: 50 };
      drawBars();
      document.body.classList.remove('evening');
      title();
    };
  }

  // ── 소리 단추 ──
  $('#soundBtn').onclick = () => $('#soundBtn').classList.toggle('off', !SND.toggle());

  // ── 시작 ──
  $('#village').innerHTML = ART.village();
  buildClock(); setClock(0); drawBars(); setStamps(false);
  title();

  // 시험용
  window.__news = { S, stamp, parseBody };
})();
