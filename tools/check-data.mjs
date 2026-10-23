// 원고 데이터 검사. node tools/check-data.mjs
// 표시 꼴, 종류가 열린 날, 길이, 기자 이름, 글꼴에 없는 글자를 본다.
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';

const HERE = join(dirname(fileURLToPath(import.meta.url)), '..');
const ctx = { window: {} };
ctx.window = ctx;
vm.createContext(ctx);
const files = ['js/data.js', ...(existsSync(join(HERE, 'js/days')) ? readdirSync(join(HERE, 'js/days')) : []).filter((f) => f.endsWith('.js')).sort().map((f) => 'js/days/' + f)];
for (const f of files) vm.runInContext(readFileSync(join(HERE, f), 'utf8'), ctx, { filename: f });
const N = ctx.NEWS;

const errors = [], warns = [];
const E = (w, m) => errors.push(`${w}: ${m}`);
const W = (w, m) => warns.push(`${w}: ${m}`);

const re = /\{(?:(\w+):)?([^>}]+)>([^|}]+)\|([^}]+)\}|\[([^|\]]+)\|([^\]]+)\]/g;
function scan(src, where, zone, day, out) {
  let rest = src, m;
  re.lastIndex = 0;
  while ((m = re.exec(src))) {
    if (m[2] !== undefined) {
      const kind = m[1] || 'sp';
      if (!N.kinds[kind]) E(where, `모르는 종류 '${kind}'`);
      else if (N.kinds[kind].day > day) E(where, `'${kind}'는 ${N.kinds[kind].day}일째에 열리는데 ${day}일째에 씀`);
      if (kind === 'head' && zone !== 't') E(where, 'head 종류는 제목 안에만');
      if (kind === 'pic' && zone !== 'c') E(where, 'pic 종류는 사진 설명 안에만');
      if (zone === 'c' && kind !== 'pic' && kind !== 'sp' && kind !== 'space') W(where, `사진 설명 안에 '${kind}'`);
      if (zone === 't' && !['head', 'sp', 'space'].includes(kind)) W(where, `제목 안에 '${kind}'`);
      if (m[2] === m[3]) E(where, `틀린말과 고친말이 같음: ${m[2]}`);
      if (m[2].trim() !== m[2]) E(where, `틀린말 앞뒤에 빈칸: "${m[2]}"`);
      out.push(kind);
    }
  }
  rest = src.replace(re, '');
  if (/[{}[\]|>]/.test(rest)) E(where, `표시 꼴이 깨짐: ${rest.match(/.{0,8}[{}[\]|>].{0,8}/)[0]}`);
}
const wrongText = (s) => s.replace(re, (a, k, w, f, why, tw) => w !== undefined ? w : tw);

const need = (n) => n <= 3 ? 3 : n <= 5 ? 5 : n <= 10 ? 6 : n <= 20 ? 7 : 8;
const allText = [];
const table = [];
N.days.forEach((d, di) => {
  if (d.n !== di + 1) E(`${d.n}일째`, `날 번호가 순서대로가 아님 (자리 ${di + 1})`);
  const kinds = {}, cnt = { print: 0, fix: 0, cut: 0, ad: 0 };
  if (!d.rule) E(`${d.n}일째`, 'rule 없음');
  allText.push(d.rule || '', d.short || '', JSON.stringify(d.note || []), JSON.stringify(d.ledger || []));
  if (d.items.length < need(d.n)) W(`${d.n}일째`, `원고 ${d.items.length}장 (기준 ${need(d.n)}장)`);
  const check = (it, w, isRevised) => {
    if (!N.reporters[it.by]) E(w, `모르는 기자 '${it.by}'`);
    if (!it.title || !it.body) E(w, '제목이나 본문 없음');
    const out = [];
    scan(it.title || '', w + ' 제목', 't', d.n, out);
    scan(it.body || '', w + ' 본문', 'b', d.n, out);
    if (it.caption) scan(it.caption, w + ' 사진 설명', 'c', d.n, out);
    if (it.caption && !it.photo) E(w, '사진 없이 사진 설명');
    if (it.photo && typeof it.photo === 'object' && !it.photo.e) E(w, '사진 이모지(e) 없음');
    if (isRevised && out.length) E(w, '고쳐 온 원고에 틀린 곳이 있음');
    if (it.cut && !it.cutWhy) E(w, '뺄 기사인데 cutWhy 없음');
    if (it.cut && d.n < 6) E(w, '뺄 기사는 6일째부터');
    if (it.cut && out.length) W(w, '뺄 기사에 틀린 곳 표시도 있음');
    if (it.ad && !it.pay) W(w, '광고인데 pay 없음');
    const body = wrongText(it.body || ''), title = wrongText(it.title || '');
    const lim = it.ad ? 60 : it.photo ? 70 : 95;
    if (body.length > lim) W(w, `본문 ${body.length}자 (기준 ${lim})`);
    if (title.length > 24) W(w, `제목 ${title.length}자`);
    if (it.caption && wrongText(it.caption).length > 22) W(w, `사진 설명 ${wrongText(it.caption).length}자`);
    allText.push(it.title, it.body, it.caption || '', it.ask || '', it.complaint || '', it.cutWhy || '', typeof it.photo === 'object' ? '' : '');
    return out;
  };
  d.items.forEach((it, i) => {
    const w = `${d.n}일째 ${i + 1}번 「${wrongText(it.title || '').slice(0, 14)}」`;
    const out = check(it, w, false);
    out.forEach((k) => kinds[k] = (kinds[k] || 0) + 1);
    if (it.cut) cnt.cut++; else if (out.length) cnt.fix++; else cnt.print++;
    if (it.ad) cnt.ad++;
    if (it.revised) check(it.revised, w + ' (고쳐 온 원고)', true);
  });
  table.push(`${String(d.n).padStart(2)}일째  원고 ${d.items.length}  싣기 ${cnt.print} 고치기 ${cnt.fix} 빼기 ${cnt.cut} 광고 ${cnt.ad}  | ${Object.entries(kinds).map(([k, v]) => k + v).join(' ')}${d.speed ? '  speed ' + d.speed : ''}`);
});

// 기록부 이름이 겹치는지 (바뀌는 줄은 일부러)
const seen = new Map();
for (const d of N.days) for (const [k] of d.ledger || []) {
  if (seen.has(k)) W(`기록부`, `'${k}' 줄이 ${seen.get(k)}일째에 이어 ${d.n}일째에 다시 적힘 (바뀌는 줄이면 괜찮음)`);
  seen.set(k, d.n);
}

// 글꼴에 없는 글자
const cs = join(HERE, 'fonts/charset.txt');
if (existsSync(cs)) {
  const have = new Set(readFileSync(cs, 'utf8'));
  const miss = new Set([...allText.join('')].filter((c) => /[가-힣]/.test(c) && !have.has(c)));
  if (miss.size) W('글꼴', `글꼴에 없는 글자 ${miss.size}개 → python tools/subset-fonts.py ../fonts-src 를 다시 돌려요`);
}

console.log(table.join('\n'));
console.log(`\n날 ${N.days.length}개, 원고 ${N.days.reduce((s, d) => s + d.items.length, 0)}장`);
if (warns.length) console.log(`\n주의 ${warns.length}개\n` + warns.map((x) => '  · ' + x).join('\n'));
if (errors.length) { console.log(`\n오류 ${errors.length}개\n` + errors.map((x) => '  ✘ ' + x).join('\n')); process.exitCode = 1; }
else console.log('\n오류 없음');
