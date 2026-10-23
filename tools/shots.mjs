// 첫째~셋째 날을 돌며 화면을 찍는다. node tools/cdp.mjs tools/shots.mjs <서버주소> <저장폴더>
export const options = { width: 1366, height: 768 };
const URL = process.argv[3] || 'http://127.0.0.1:8650/';
const OUT = process.argv[4] || '.';
export default async function (t) {
  const word = (x) => t.eval(`[...document.querySelectorAll('.paper .w')].find(e => e.textContent === ${JSON.stringify(x)}).click()`);
  const why = (k) => t.eval(`document.querySelector('.why button[data-k=${k}]').click()`);
  const stamp = (k) => t.eval(`document.querySelector('.stamp[data-k=${k}]').click()`);
  const live = async () => { await t.waitFor(`document.querySelector('.paper.live')`); await t.sleep(700); };
  const result = async () => { await t.waitFor(`document.querySelector('.result')`, 15000); await t.sleep(1200); };
  const shot = (n) => t.shot(`${OUT}/${n}.png`);

  await t.goto(URL);
  await t.waitFor(`document.fonts.status === 'loaded'`);
  await t.sleep(400);
  await shot('1-첫화면');
  await t.eval(`document.getElementById('go').click()`); await t.sleep(600);
  await shot('2-아침회의');
  await t.eval(`document.getElementById('ok').click()`); await live();
  await shot('3-책상');

  // 첫째 날: 되요 찾기, 함정 잘못 찍기, 않 놓치고 싣기
  await word('되요'); await t.sleep(400);
  await shot('4-동그라미');
  await stamp('fix'); await t.sleep(450);
  await shot('5-도장');
  await live();
  await word('않게'); await stamp('fix'); await t.sleep(700);
  await shot('6-잘못찍음');
  await live();
  await stamp('print');
  await result();
  await shot('7-하루끝');

  // 둘째 날: 독자 편지, 광고, 까닭 고르기, 레모네이드 고쳐 오라
  await t.eval(`document.getElementById('next').click()`); await t.sleep(600);
  await shot('8-둘째날-아침');
  await t.eval(`document.getElementById('ok').click()`); await live();
  await word('최고'); await t.sleep(300);
  await shot('9-까닭고르기');
  await why('ad');
  await word('키가'); await why('sp'); await t.sleep(300);
  await shot('10-광고');
  await stamp('fix'); await t.sleep(700);
  await shot('11-까닭다름');
  await live();
  await word('제일'); await why('ad'); await stamp('fix'); await live();
  await word('됀다'); await why('sp'); await stamp('fix');
  await result();
  await shot('12-둘째날-끝');

  // 셋째 날: 고쳐 온 레모네이드, 기록부, 사진
  await t.eval(`document.getElementById('next').click()`); await t.sleep(600);
  await shot('13-셋째날-아침');
  await t.eval(`document.getElementById('ok').click()`); await live();
  await shot('14-고쳐온광고');
  await stamp('print'); await live();
  await t.eval(`document.getElementById('ledger').click()`); await t.sleep(500);
  await shot('15-기록부');
  await word('일요일'); await why('rec'); await stamp('fix'); await live();
  await shot('16-사진');
  await stamp('print'); await live();
  await stamp('print');
  await result();
  await shot('17-셋째날-끝');
}
