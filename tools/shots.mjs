// 첫째 날 한 판을 돌며 화면을 찍는다. node tools/shots.mjs <서버주소> <저장폴더>
export const options = { width: 1366, height: 768 };
const URL = process.argv[3] || 'http://127.0.0.1:8650/';
const OUT = process.argv[4] || '.';
export default async function (t) {
  await t.goto(URL);
  await t.waitFor(`document.fonts.status === 'loaded'`);
  await t.sleep(400);
  await t.shot(`${OUT}/1-첫화면.png`);
  await t.eval(`document.getElementById('go').click()`);
  await t.sleep(600);
  await t.shot(`${OUT}/2-아침회의.png`);
  await t.eval(`document.getElementById('ok').click()`);
  await t.sleep(1800);
  await t.shot(`${OUT}/3-책상.png`);
  const clickWord = (txt) => t.eval(`[...document.querySelectorAll('.paper .w')].find(e => e.textContent === ${JSON.stringify(txt)}).click()`);
  // 원고 1: 되요 찾아서 고쳐 오라
  await clickWord('되요');
  await t.sleep(500);
  await t.shot(`${OUT}/4-동그라미.png`);
  await t.eval(`document.querySelector('.stamp[data-k=fix]').click()`);
  await t.sleep(450);
  await t.shot(`${OUT}/5-도장.png`);
  await t.waitFor(`document.querySelector('.paper.live')`);
  await t.sleep(900);
  // 원고 2: 함정 '않게'를 잘못 찍고 고쳐 오라 → 오답 보기
  await clickWord('않게');
  await t.eval(`document.querySelector('.stamp[data-k=fix]').click()`);
  await t.sleep(700);
  await t.shot(`${OUT}/6-잘못찍음.png`);
  await t.waitFor(`document.querySelector('.paper.live')`);
  await t.sleep(900);
  // 원고 3: 그냥 싣는다 → 놓침
  await t.eval(`document.querySelector('.stamp[data-k=print]').click()`);
  await t.waitFor(`document.querySelector('.result')`, 15000);
  await t.sleep(1500);
  await t.shot(`${OUT}/7-하루끝.png`);
}
