// 方針ごとに最後まで自動で動かし、結果が分かれるか・止まらないかを確かめる（同じ世界の種で比べる）
const { createGame } = require('./engine.js');
const { events } = require('./events.js');
const { omens } = require('./omens.js');

function run(policy, seed) {
  const g = createGame(events, { seed, omens });
  const trail = [];
  let guard = 0;
  while (guard++ < 2000) {
    const r = g.tick();
    if (r.type === 'end') break;
    if (r.type === 'event') {
      const cs = g.choices();
      let pick = policy(r.event.id, cs, g.s);
      if (pick == null || cs[pick].block) { // 選べなければ史実の選択か、最後の選択肢
        const h = r.event.choices.findIndex((c, i) => c.hist && !cs[i].block);
        pick = h >= 0 ? h : cs.map((c, i) => i).filter(i => !cs[i].block).pop();
      }
      trail.push(r.event.id + '@' + g.s.t + ':' + pick);
      g.choose(pick);
    }
  }
  const s = g.s, v = s.v;
  return {
    trail: trail.join(' '), econ: v.economy.toFixed(0), dmg: v.damage.toFixed(0), fisc: v.fiscal.toFixed(0), party: v.party.toFixed(0),
    lead: v.lead.toFixed(0), scandal: v.scandal.toFixed(0), donRel: v.donRel.toFixed(0), nishina: v.nishina.toFixed(0), div: s.div,
    don: s.don.status + '/' + s.don.stance, split: !!s.flags.partySplit, news: s.news.length,
    res: s.result && (s.result.won ? '当選' : '落選') + '(' + s.result.score + ') ' + s.result.partyResult, inj: s.inj.count + '回/' + s.inj.total + '兆'
  };
}
const by = (map) => (id, cs) => { const re = map[id] || map._; if (!re) return null; const i = cs.findIndex(c => re.test(c.label) && !c.block); return i < 0 ? null : i; };
const policies = {
  '史実(追い貸し・先送り)': () => null,
  '早期検査+早期処理': by({ mq1: /検査/, early: /資本注入/, semi: /研究開発/, boom: /重点投資/, notebook: /読み/ }),
  '手帳でドンを説得→早期処理': by({ notebook: /読み/, persuade: /手帳/, early: /資本注入/, mq2: /中規模|小規模/ }),
  'ドンを脅して早期処理': by({ notebook: /読み/, persuade: /裏金リスト/, early: /資本注入/ }),
  '逐次投入の泥沼': by({ mq1: /追い貸し/, mq2: /小規模/, more: /追加で投入/, media: /やけくそ/ }),
  '大量投入+裏金': by({ mq1: /追い貸し/, notebook: /読み/, mq2: /大規模|根回し/, fund: /裏金/ }),
  '改革派（追及・御堂・公表・離党）': by({ e107: /追及/, e111: /御堂/, e116: /公表/, e112: /政治改革/, e113: /新党/, fund: /政治改革/ }),
  'ドン派（擁護・葛城・院政）': by({ mq1: /追い貸し/, e107: /擁護/, e111: /葛城/, shadow: /受け入れ/, fund: /長老/ }),
};
for (const seed of [1, 2]) {
  console.log('==== 世界の種', seed);
  for (const [name, p] of Object.entries(policies)) console.log(name, JSON.stringify(run(p, seed)), '\n');
}
