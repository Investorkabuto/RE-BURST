// 方針ごとに最後まで自動で動かし、結果が分かれるか・止まらないかを確かめる
const { createGame } = require('./engine.js');
const { events } = require('./events.js');

function run(policy) {
  const g = createGame(events);
  const trail = [];
  let guard = 0;
  while (guard++ < 2000) {
    const r = g.tick();
    if (r.type === 'end') break;
    if (r.type === 'event') {
      const cs = g.choices();
      let pick = policy(r.event.id, cs, g.s);
      if (pick == null || cs[pick].block) { // 選べなければ「何もしない」系（最後）
        pick = cs.map((c, i) => i).filter(i => !cs[i].block).pop();
      }
      trail.push(r.event.id + '@' + g.s.t + ':' + pick);
      g.choose(pick);
    }
  }
  const v = g.s.v;
  return { trail: trail.join(' '), t: g.s.t, econ: v.economy.toFixed(0), dmg: v.damage.toFixed(0), fisc: v.fiscal.toFixed(0), party: v.party.toFixed(0), fund: v.funding.toFixed(0), money: v.money.toFixed(0), scandal: v.scandal.toFixed(0), tech: v.tech.toFixed(0), div: g.s.div, res: g.s.result && (g.s.result.won ? '当選' : '落選') + ' ' + g.s.result.partyResult, inj: g.s.inj.count + '回/' + g.s.inj.total + '兆', guard };
}
const hist = (id, cs) => { const i = cs.findIndex((c, k) => /何もしない|追い貸し|公共事業|反対する|見送る|受け入れる$|目標を受け入れる/.test(c.label) && !c.block); return i < 0 ? null : i; };
const byLabel = (re) => (id, cs) => { const i = cs.findIndex(c => re.test(c.label) && !c.block); return i < 0 ? null : i; };
const policies = {
  '史実(追い貸し・先送り)': hist,
  '早期検査+早期処理': (id, cs) => { const re = id === 'mq1' ? /検査/ : id === 'early' ? /資本注入/ : id === 'semi' ? /研究開発/ : id === 'boom' ? /重点投資/ : /何もしない|^$/; const i = cs.findIndex(c => re.test(c.label) && !c.block); return i < 0 ? null : i; },
  '逐次投入の泥沼': (id, cs) => { const re = id === 'mq1' ? /追い貸し/ : id === 'mq2' ? /小規模/ : id === 'more' ? /追加で投入/ : id === 'media' ? /やけくそ/ : id === 'bash' ? /何もしない/ : /何もしない/; const i = cs.findIndex(c => re.test(c.label) && !c.block); return i < 0 ? null : i; },
  '大量投入': (id, cs) => { const re = id === 'mq1' ? /追い貸し/ : id === 'mq2' ? /大規模|根回し/ : id === 'bash' ? /何もしない/ : id === 'fund' ? /何もしない/ : /公共事業|何もしない/; const i = cs.findIndex(c => re.test(c.label) && !c.block); return i < 0 ? null : i; },
  '大量投入+裏金': (id, cs) => { const re = id === 'mq1' ? /追い貸し/ : id === 'mq2' ? /大規模/ : id === 'fund' ? /裏金/ : /公共事業|何もしない/; const i = cs.findIndex(c => re.test(c.label) && !c.block); return i < 0 ? null : i; },
  '破綻整理': (id, cs) => { const re = id === 'mq1' ? /追い貸し/ : id === 'mq2' ? /反対/ : id === 'chain' ? /破綻した銀行を整理/ : /公共事業|何もしない/; const i = cs.findIndex(c => re.test(c.label) && !c.block); return i < 0 ? null : i; },
};
for (const [name, p] of Object.entries(policies)) console.log(name, JSON.stringify(run(p), null, 0), '\n');
