// アーティファクト用に、index.html と JS を1枚のHTMLにまとめる（node build.js 出力先）
const fs = require('fs'); const path = require('path');
const dir = __dirname; const out = process.argv[2] || path.join(dir, 'artifact.html');
const html = fs.readFileSync(path.join(dir, 'index.html'), 'utf8');
const part = (name) => { const m = html.match(new RegExp('<!-- BUILD:' + name + ' -->([\\s\\S]*?)<!-- /BUILD:' + name + ' -->')); if (!m) throw new Error(name); return m[1].trim(); };
const scripts = [...html.matchAll(/<script src="([^"]+)"><\/script>/g)].map(m => '<script>\n' + fs.readFileSync(path.join(dir, m[1]), 'utf8') + '\n</script>');
fs.writeFileSync(out, part('HEAD') + '\n' + part('BODY') + '\n' + scripts.join('\n') + '\n');
console.log('wrote', out);
