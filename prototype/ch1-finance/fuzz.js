const { createGame } = require('./engine.js');
const { events } = require('./events.js');
let seed = 7; const rnd = () => (seed = (seed * 1664525 + 1013904223) % 4294967296) / 4294967296;
const N = 3000; const seen = {}; const ends = {}; let maxEv = 0, bad = 0; const stats = { econ: [], fisc: [], div: [], dmg: [] };
const sigs = {};
for (let k = 0; k < N; k++) {
  const g = createGame(events); let guard = 0; let n = 0;
  while (guard++ < 500) {
    const r = g.tick(); if (r.type === 'end') break;
    if (r.type === 'event') { n++; const cs = g.choices().filter(c => !c.block); const c = cs[Math.floor(rnd() * cs.length)]; seen[r.event.id] = (seen[r.event.id] || 0) + 1; g.choose(c.i); }
  }
  if (guard >= 500) bad++;
  maxEv = Math.max(maxEv, n);
  const v = g.s.v; stats.econ.push(v.economy); stats.fisc.push(v.fiscal); stats.div.push(g.s.div); stats.dmg.push(v.damage);
  const key = g.s.result ? (g.s.result.won ? 'won' : 'lost') : 'none'; ends[key] = (ends[key] || 0) + 1;
}
const q = (a) => { a = a.slice().sort((x, y) => x - y); return [0, 0.1, 0.5, 0.9, 1].map(p => a[Math.min(a.length - 1, Math.floor(p * a.length))].toFixed(0)).join('/'); };
console.log('events seen', seen); console.log('ends', ends, 'stuck', bad, 'maxEvents', maxEv);
for (const k in stats) console.log(k, '(min/10%/50%/90%/max)', q(stats[k]));
