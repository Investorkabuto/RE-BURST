// 画面の動作確認：ブラウザで index.html を開き、選択肢を押し続けて、エラーが出ないかを見る（どの章でも使える）
//
// 決まり：選択肢のボタンは .ch（押せないものは disabled）。章の終わりは #again ボタンが出ること
//
// 使い方：
//   node prototype/tools/smoke.js <章のフォルダ> [--clicks 40] [--shot 画像の出力先] [--width 1100]
//   Playwright は、環境に入っているもの（npm の global）を探して使う
'use strict';
const path = require('path');
const { execSync } = require('child_process');

function loadPlaywright() {
  try { return require('playwright'); } catch (e) { /* 次を試す */ }
  const g = execSync('npm root -g').toString().trim();
  return require(path.join(g, 'playwright'));
}

async function smoke(dir, opts) {
  opts = opts || {};
  const { chromium } = loadPlaywright();
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: opts.width || 1100, height: 1300 } });
  const errors = [];
  p.on('pageerror', (e) => errors.push(e.message));
  p.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  await p.goto('file://' + path.join(path.resolve(dir), 'index.html'));
  let clicks = 0, ended = false;
  const max = opts.clicks || 40;
  while (clicks < max) {
    const h = await p.waitForSelector('.ch:not([disabled]), #again', { timeout: 20000 }).catch(() => null);
    if (!h) { errors.push('20秒待っても選択肢が出ない'); break; }
    if (await p.$('#again')) { ended = true; break; }
    const btns = await p.$$('.ch:not([disabled])');
    await btns[clicks % btns.length].click();
    clicks++;
  }
  if (opts.shot) await p.screenshot({ path: opts.shot, fullPage: true });
  await b.close();
  return { clicks, ended, errors };
}

module.exports = { smoke };
if (require.main === module) {
  const argv = process.argv.slice(2); const dir = argv[0];
  if (!dir) { console.log('使い方: node prototype/tools/smoke.js <章のフォルダ> [--clicks 40] [--shot out.png] [--width 1100]'); process.exit(1); }
  const get = (k) => { const i = argv.indexOf('--' + k); return i >= 0 ? argv[i + 1] : undefined; };
  smoke(dir, { clicks: +get('clicks') || 40, shot: get('shot'), width: +get('width') || 1100 }).then((r) => {
    console.log('押した回数', r.clicks, '章の終わりまで', r.ended ? '到達' : '未到達', 'エラー', r.errors.length ? r.errors : 'なし');
    if (r.errors.length) process.exitCode = 1;
  });
}
