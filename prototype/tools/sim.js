// 試作の自動プレイ：方針ごとの通し試験と、ランダムな大量試験（どの章でも使える）
//
// 章のフォルダの決まり：
//   engine.js  … createGame(events, { seed, omens }) を出す
//   events.js  … events を出す
//   omens.js   … omens を出す（なくてもよい）
//   policies.js… 方針の定義（なくてもよい。下の「方針の書き方」）
//
// 使い方：
//   node prototype/tools/sim.js <章のフォルダ>                       方針ごとの通し試験（種 1,2）
//   node prototype/tools/sim.js <章のフォルダ> --seeds 1,2,3         種を指定
//   node prototype/tools/sim.js <章のフォルダ> --policy 史実          名前に含む方針だけ
//   node prototype/tools/sim.js <章のフォルダ> --fuzz 3000           ランダムな選択で大量に回す
//   node prototype/tools/sim.js <章のフォルダ> --trace 早期 --seeds 1 1手ずつ値を表示
//   --json を付けると、結果を JSON で出す
//
// 方針の書き方（policies.js）：
//   module.exports = ({ by, hist, random }) => ({
//     '史実': hist,
//     '早期処理': by({ mq1: /検査/, early: /資本注入/ }),   // イベントIDごとに、選択肢の文言を正規表現で選ぶ
//   });
//   by() で指定のないイベントや、選べない選択肢は、史実の選択（hist）か最後の選べる選択肢になる
//
// プログラムから使う場合：
//   const sim = require('./prototype/tools/sim.js');
//   const ch = sim.load('prototype/ch1-finance');
//   sim.play(ch, sim.helpers.hist, { seed: 1 });  → { s, trail, steps }
//   sim.fuzz(ch, { n: 1000 });                       → 集計
'use strict';
const fs = require('fs');
const path = require('path');

function load(dir) {
  const abs = path.resolve(dir);
  const req = (f) => { const p = path.join(abs, f); return fs.existsSync(p) ? require(p) : null; };
  const engine = req('engine.js'); const ev = req('events.js');
  if (!engine || !ev) throw new Error(abs + ' に engine.js と events.js が必要です');
  const om = req('omens.js');
  const pol = req('policies.js');
  return { dir: abs, engine, events: ev.events, omens: om ? om.omens : [], policies: pol ? pol(helpers) : { '史実': helpers.hist } };
}

// ---- 方針の部品 ----
function fallback(ev, cs) {
  const h = ev.choices.findIndex((c, i) => c.hist && !cs[i].block);
  return h >= 0 ? h : cs.map((c) => c.i).filter((i) => !cs[i].block).pop();
}
const helpers = {
  hist: () => null,
  by: (map) => (id, cs) => {
    const re = map[id] || map._; if (!re) return null;
    const i = cs.findIndex((c) => re.test(c.label) && !c.block); return i < 0 ? null : i;
  },
  random: (rnd) => (id, cs) => { const ok = cs.filter((c) => !c.block); return ok[Math.floor(rnd() * ok.length)].i; },
  lcg: (seed) => () => (seed = (seed * 1664525 + 1013904223) % 4294967296) / 4294967296
};

// 1回通しで遊ぶ。policy(id, choices, state) は選択肢の番号か null を返す
function play(ch, policy, opts) {
  opts = opts || {};
  const g = ch.engine.createGame(ch.events, { seed: opts.seed, omens: opts.omens === false ? [] : ch.omens });
  const trail = []; const steps = [];
  let guard = 0;
  while (guard++ < (opts.maxSteps || 3000)) {
    const r = g.tick();
    if (r.type === 'end') break;
    if (r.type !== 'event') continue;
    const cs = g.choices();
    let pick = policy(r.event.id, cs, g.s);
    if (pick == null || !cs[pick] || cs[pick].block) pick = fallback(r.event, cs);
    if (opts.onStep) opts.onStep({ t: g.s.t, id: r.event.id, title: r.event.title, pick, label: cs[pick].label, s: g.s });
    trail.push(r.event.id + '@' + g.s.t + ':' + pick);
    steps.push({ t: g.s.t, id: r.event.id, pick, label: cs[pick].label });
    g.choose(pick);
  }
  return { s: g.s, trail, steps, stuck: guard >= (opts.maxSteps || 3000) };
}

// 結果の要約（章によって値が違っても動くように、あるものだけ出す）
function summary(run) {
  const s = run.s; const out = { seed: s.seed, trail: run.trail.join(' '), div: s.div };
  if (s.result) out.result = (s.result.won ? '当選' : '落選') + '(' + s.result.score + ') ' + s.result.partyResult;
  if (s.don) out.don = s.don.status + '/' + s.don.stance;
  if (s.inj) out.inj = s.inj.count + '回/' + s.inj.total + '兆';
  if (s.news) out.news = s.news.length;
  out.v = {}; for (const k in s.v) out.v[k] = Math.round(s.v[k]);
  out.flags = Object.keys(s.flags).filter((k) => s.flags[k]);
  if (run.stuck) out.stuck = true;
  return out;
}

const quant = (a) => { if (!a.length) return '-'; a = a.slice().sort((x, y) => x - y); return [0, 0.1, 0.5, 0.9, 1].map((p) => a[Math.min(a.length - 1, Math.floor(p * a.length))].toFixed(0)).join('/'); };

// ランダムな選択で大量に回し、到達・結末・値の散らばりを集計する
function fuzz(ch, opts) {
  opts = opts || {};
  const n = opts.n || 3000; const rnd = helpers.lcg(opts.rngSeed || 7);
  const seen = {}; const ends = {}; const flags = {}; const vals = {}; let stuck = 0, maxEvents = 0, news = 0;
  const allIds = ch.events.map((e) => e.id);
  for (let k = 0; k < n; k++) {
    const run = play(ch, helpers.random(rnd), { seed: k + 1 });
    if (run.stuck) stuck++;
    maxEvents = Math.max(maxEvents, run.steps.length);
    run.steps.forEach((st) => { seen[st.id] = (seen[st.id] || 0) + 1; });
    const s = run.s;
    const end = s.result ? (s.result.won ? 'won' : 'lost') : (s.over || 'none'); ends[end] = (ends[end] || 0) + 1;
    Object.keys(s.flags).forEach((f) => { if (s.flags[f]) flags[f] = (flags[f] || 0) + 1; });
    if (s.don) flags['don:' + s.don.status] = (flags['don:' + s.don.status] || 0) + 1;
    for (const key in s.v) (vals[key] = vals[key] || []).push(s.v[key]);
    (vals.div = vals.div || []).push(s.div);
    if (s.result) (vals.score = vals.score || []).push(s.result.score);
    if (s.news) news += s.news.length;
  }
  const unreached = allIds.filter((id) => !seen[id]);
  const dist = {}; for (const key in vals) dist[key] = quant(vals[key]);
  return { n, stuck, maxEvents, ends, seen, unreached, flags, newsPerRun: +(news / n).toFixed(1), dist };
}

// ---- コマンドライン ----
function main(argv) {
  const args = { _: [] };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith('--')) { const k = a.slice(2); const nx = argv[i + 1]; if (nx && !nx.startsWith('--')) { args[k] = nx; i++; } else args[k] = true; } else args._.push(a);
  }
  if (!args._[0]) { console.log('使い方: node prototype/tools/sim.js <章のフォルダ> [--seeds 1,2] [--policy 名前] [--fuzz N] [--trace 名前] [--json]'); process.exit(1); }
  const ch = load(args._[0]);
  const seeds = String(args.seeds || '1,2').split(',').map(Number);
  const json = !!args.json;

  if (args.fuzz) {
    const r = fuzz(ch, { n: args.fuzz === true ? 3000 : +args.fuzz });
    if (json) { console.log(JSON.stringify(r, null, 2)); return; }
    console.log('回数', r.n, '止まった', r.stuck, '最大イベント数', r.maxEvents, '予兆/回', r.newsPerRun);
    console.log('結末', r.ends);
    console.log('イベントの到達数', r.seen);
    if (r.unreached.length) console.log('一度も出なかったイベント', r.unreached);
    console.log('フラグ', r.flags);
    console.log('値の散らばり（最小/10%/50%/90%/最大）'); for (const k in r.dist) console.log('  ' + k, r.dist[k]);
    if (r.stuck) process.exitCode = 1;
    return;
  }

  const names = Object.keys(ch.policies).filter((n) => !args.policy || n.includes(args.policy) || (args.trace && n.includes(args.trace)));
  const traceName = args.trace && names.find((n) => n.includes(args.trace));
  const out = [];
  if (traceName && !json) console.log('月 イベント 選んだ番号 選択肢 | 選ぶ前の値');
  for (const seed of seeds) {
    for (const name of (traceName ? [traceName] : names)) {
      const onStep = traceName ? (st) => {
        const v = st.s.v; const keys = Object.keys(v).slice(0, 14);
        console.log(st.t, st.id, st.pick, st.label, '|', keys.map((k) => k + ' ' + Math.round(v[k])).join(' '));
      } : null;
      const run = play(ch, ch.policies[name], { seed, onStep });
      const sm = summary(run); sm.policy = name; out.push(sm);
      if (run.stuck) process.exitCode = 1;
      if (!json) {
        console.log('[種 ' + seed + '] ' + name);
        console.log('  ' + (sm.result || '結果なし') + (sm.don ? '  ドン:' + sm.don : '') + (sm.inj ? '  投入:' + sm.inj : '') + '  乖離度:' + sm.div);
        console.log('  ' + sm.trail);
        console.log('  ' + Object.entries(sm.v).map(([k, x]) => k + ' ' + x).join(' '));
      }
    }
  }
  if (json) console.log(JSON.stringify(out, null, 2));
}

module.exports = { load, play, fuzz, summary, helpers };
if (require.main === module) main(process.argv.slice(2));
