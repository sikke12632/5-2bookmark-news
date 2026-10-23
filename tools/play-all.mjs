// 서른 날을 끝까지 자동으로 해 본다. node tools/cdp.mjs tools/play-all.mjs <서버주소> <모드> <캡처폴더>
//   모드 perfect: 정답대로 / mixed: 열에 일곱만 정답 / sloppy: 다 「싣는다」 (위기·엔딩 확인용)
export const options = { width: 1366, height: 768 };
const URL = process.argv[3] || 'http://127.0.0.1:8650/';
const MODE = process.argv[4] || 'perfect';
const OUT = process.argv[5] || '';
export default async function (t) {
  await t.goto(URL); await t.sleep(600);
  await t.eval(`localStorage.clear()`);
  await t.goto(URL); await t.sleep(600);
  await t.eval(`document.querySelector('.lv[data-lv=hard]').click(); document.getElementById('go').click()`);
  const crises = [];
  for (let day = 1; day <= 30; day++) {
    await t.waitFor(`document.getElementById('ok') || document.getElementById('ca')`);
    if (await t.eval(`!!document.getElementById('ca')`)) {
      if (OUT && !crises.length) await t.shot(`${OUT}/위기-${MODE}.png`);
      crises.push(day + ':' + await t.eval(`document.querySelector('.crisis h2').textContent`));
      await t.eval(`document.getElementById('ca').click()`);
      await t.waitFor(`document.getElementById('ok')`);
    }
    await t.eval(`document.getElementById('ok').click()`);
    for (;;) {
      await t.waitFor(`document.querySelector('.paper.live') || document.querySelector('.result')`, 20000);
      if (await t.eval(`!!document.querySelector('.result')`)) break;
      await t.sleep(150);
      if (MODE === 'perfect' || (MODE === 'mixed' && Math.random() < 0.7)) {
        // 틀린 곳마다 첫 낱말을 찍고 알맞은 까닭을 고른다
        await t.eval(`(async () => {
          const C = __news.S.cur, seen = new Set();
          for (let i = 0; i < C.parts.length; i++) {
            const p = C.parts[i];
            if (p.g === undefined || !p.w || seen.has(p.g)) continue;
            seen.add(p.g);
            document.querySelector('.w[data-i="' + i + '"]').click();
            const b = document.querySelector('.why button[data-k="' + C.errs[p.g].kind + '"]');
            if (b) b.click();
          }
          const k = C.it.cut ? 'cut' : C.errs.length ? 'fix' : 'print';
          document.querySelector('.stamp[data-k=' + k + ']').click();
        })()`);
      } else {
        await t.eval(`document.querySelector('.stamp[data-k=print]').click()`);
      }
      await t.waitFor(`!document.querySelector('.paper.live')`);
    }
    await t.sleep(300);
    const score = await t.eval(`document.querySelector('.score').textContent`);
    const bars = await t.eval(`JSON.stringify(__news.S.bars)`);
    console.log(`${day}일째 ${score} ${bars}`);
    if (OUT && (day === 16 || day === 30)) await t.shot(`${OUT}/전체-${MODE}-${day}일째.png`);
    if (day < 30) await t.eval(`document.getElementById('next').click()`);
  }
  await t.eval(`document.getElementById('ending').click()`); await t.sleep(800);
  console.log('엔딩:', await t.eval(`document.querySelector('.endStamp').textContent`));
  if (crises.length) console.log('위기:', crises.join(', '));
  if (OUT) await t.shot(`${OUT}/엔딩-${MODE}.png`);
}
