// アーティファクト用に、章の index.html と読み込んでいる JS を1枚のHTMLにまとめる（どの章でも使える）
//
// index.html の決まり：
//   <!-- BUILD:HEAD --> … <!-- /BUILD:HEAD -->  title・meta・フォント・style（アーティファクトの先頭に置く）
//   <!-- BUILD:BODY --> … <!-- /BUILD:BODY -->  画面の本体
//   <script src="xxx.js"></script>              章のフォルダからの相対パス。書いた順に埋め込む
//   ローカルではそのまま index.html を開けば動く。doctype・html・head・body はアーティファクト側が付ける
//
// 使い方：
//   node prototype/tools/build-artifact.js <章のフォルダ> [出力先]   （出力先の既定は <章のフォルダ>/artifact.html）
'use strict';
const fs = require('fs');
const path = require('path');

function build(dir, out) {
  const abs = path.resolve(dir);
  const html = fs.readFileSync(path.join(abs, 'index.html'), 'utf8');
  const part = (name) => {
    const m = html.match(new RegExp('<!-- BUILD:' + name + ' -->([\\s\\S]*?)<!-- /BUILD:' + name + ' -->'));
    if (!m) throw new Error('index.html に BUILD:' + name + ' の印がありません');
    return m[1].trim();
  };
  const scripts = [...html.matchAll(/<script src="([^"]+)"><\/script>/g)].map((m) => {
    const src = fs.readFileSync(path.join(abs, m[1]), 'utf8');
    // 埋め込んだ JS の中の </script> で、HTML が途中で切れないようにする
    return '<script>\n' + src.replace(/<\/script/gi, '<\\/script') + '\n</script>';
  });
  const result = part('HEAD') + '\n' + part('BODY') + '\n' + scripts.join('\n') + '\n';
  const dest = out ? path.resolve(out) : path.join(abs, 'artifact.html');
  fs.writeFileSync(dest, result);
  return { dest, bytes: Buffer.byteLength(result), scripts: scripts.length };
}

module.exports = { build };
if (require.main === module) {
  const [dir, out] = process.argv.slice(2);
  if (!dir) { console.log('使い方: node prototype/tools/build-artifact.js <章のフォルダ> [出力先]'); process.exit(1); }
  const r = build(dir, out);
  console.log('書き出し', r.dest, (r.bytes / 1024).toFixed(1) + 'KB', 'JS ' + r.scripts + '本');
}
