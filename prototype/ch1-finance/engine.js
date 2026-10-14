// RE-BURST 試作：状態とルールで動くエンジン（第1章の金融の部分）
// イベントは「条件が揃ったら起きる部品」。日付で固定せず、値の変化で出る・出ない・繰り返すが決まる。
(function (root) {
  'use strict';

  const END = 28;       // t=28 は 1993年8月。ここで終わる
  const ELECTION = 27;  // 1993年7月

  const GAUGES = ['local', 'lead', 'scandal', 'tie', 'party', 'economy', 'fiscal', 'life', 'tech', 'damage', 'backlash', 'funding', 'chain', 'moral'];

  function ymLabel(t) {
    const m = 3 + t; // t=0 → 1991年4月
    return (1991 + Math.floor(m / 12)) + '年' + (m % 12 + 1) + '月';
  }

  function clamp(x, lo, hi) { return Math.max(lo, Math.min(hi, x)); }

  function initialState() {
    return {
      t: 0,
      v: {
        // プレイヤー個人
        local: 55,     // 地元の支持
        lead: 45,      // 求心力
        scandal: 10,   // スキャンダル
        tie: 20,       // しがらみ
        money: 100,    // 金（億円）
        // 党
        party: 50,     // 党の支持率
        // 国
        economy: 56,   // 景気
        fiscal: 60,    // 財政（高いほど健全）
        life: 56,      // 暮らしの実感
        tech: 50,      // 技術力
        // 隠れた値
        damage: 25,    // 金融の傷み
        gm: 0,         // 傷みの増え方の補正
        backlash: 0,   // 救済への批判
        funding: 100,  // 資金調達力（企業献金・パーティ収入の倍率）
        chain: 0,      // 連鎖倒産の勢い
        moral: 0       // モラルハザード（緩み）
      },
      inj: { count: 0, total: 0, last: -99 },
      flags: {},
      last: {},          // イベントごとの最後に起きた月
      topics: { bailout: 'open' }, // 案件の状態：open（未解決）/ resolved（解決済み）/ relapse（再燃）
      queue: [],         // 遅れて出る効果
      log: [],
      hist: [],
      div: 0,            // 乖離度
      over: null
    };
  }

  function createGame(events) {
    const s = initialState();
    let pending = null;

    function log(msg, kind) { s.log.push({ t: s.t, msg, kind: kind || 'info' }); }
    function add(key, d) {
      s.v[key] += d;
      if (key === 'money' || key === 'gm') return;
      s.v[key] = clamp(s.v[key], 0, 100);
    }
    function later(months, msg, fn) { s.queue.push({ at: s.t + months, msg, fn }); }
    const api = { s, add, later, log, inject };

    // 公的資金の投入。逐次投入は効果が7割になり、批判が加算される
    function inject(S, opts) {
      const nodisc = opts && opts.nodisc;
      const sequential = s.inj.count >= 1 && !nodisc;
      const eff = S * (sequential ? 0.7 : 1);
      add('damage', -eff * 1.7);
      add('chain', -eff * 2);
      add('fiscal', -S * 0.7);
      add('backlash', S * 2.4 + (sequential ? 8 : 0));
      add('moral', S * 0.3);
      add('party', -S * 0.6);
      add('economy', -S * 0.25);
      later(6, '投入の効果が景気に出始めた', () => add('economy', eff * 0.8));
      s.inj.count += 1; s.inj.total += S; s.inj.last = s.t;
      s.div += S >= 10 ? 8 : 5;
    }

    // 月ごとの動き（イベントがなくても国は動く）
    function monthly() {
      const v = s.v;
      const growth = Math.max(0, (1.7 + v.gm + v.moral * 0.01) * (1 - v.damage / 130));
      v.damage = clamp(v.damage + growth, 0, 100);
      if (v.damage >= 52) v.chain = clamp(v.chain + (v.damage - 48) * 0.3, 0, 60);
      else v.chain = v.chain * 0.9;
      const et = 66 - v.damage * 0.35 - v.chain * 0.35 + (v.tech - 50) * 0.1;
      v.economy = clamp(v.economy + (et - v.economy) * 0.12, 0, 100);
      const lt = 58 - v.damage * 0.15 - v.chain * 0.45 + (v.economy - 50) * 0.3;
      v.life = clamp(v.life + (lt - v.life) * 0.08, 0, 100);
      v.fiscal = clamp(v.fiscal - 0.08 - (v.economy < 45 ? 0.1 : 0) + (v.economy > 60 ? 0.05 : 0), 0, 100);
      v.backlash = v.backlash * 0.97;
      const pt = 50 + (v.economy - 50) * 0.35 - v.backlash * 0.25 - v.scandal * 0.1;
      v.party = clamp(v.party + (pt - v.party) * 0.06, 0, 100);
      const ft = 100 - v.backlash * 1.0 - Math.max(0, 50 - v.party) * 2.2 - v.scandal * 0.2;
      v.funding = clamp(v.funding + (ft - v.funding) * 0.15, 0, 100);
      v.money += v.funding * 0.12 - 9;
      v.scandal = Math.max(0, v.scandal - 0.25);
      v.local = clamp(v.local + (v.party - 50) * 0.02 - Math.max(0, 45 - v.economy) * 0.04, 0, 100);
      v.moral = v.moral * 0.99;
      s.hist.push({ t: s.t, economy: v.economy, damage: v.damage, fiscal: v.fiscal, party: v.party, funding: v.funding, chain: v.chain });
    }

    function runQueue() {
      const due = s.queue.filter(q => q.at <= s.t);
      s.queue = s.queue.filter(q => q.at > s.t);
      due.forEach(q => { q.fn(api); if (q.msg) log(q.msg, 'delayed'); });
    }

    // 案件の状態を更新する。解決済みの案件の関連イベントは出ない。悪化すると再燃する
    function updateTopics() {
      const v = s.v, t = s.topics;
      if (t.bailout !== 'resolved') {
        const acted = s.inj.total >= 3 || s.flags.early || s.flags.liquidate;
        if (acted && v.damage <= 40 && v.chain < 5) { t.bailout = 'resolved'; log('金融不安は収まった（公的資金・再編の案件は解決済み）', 'delayed'); }
      } else if (v.damage >= 55 || v.chain >= 10) {
        t.bailout = 'relapse'; log('金融不安が再燃した', 'bad');
      }
      if (t.bailout === 'relapse' && v.damage <= 40 && v.chain < 5) t.bailout = 'resolved';
    }

    function eligible() {
      updateTopics();
      return events
        .filter(e => {
          if (e.topic && s.topics[e.topic] === 'resolved') return false;
          if (e.once && s.last[e.id] !== undefined) return false;
          if (e.cooldown && s.last[e.id] !== undefined && s.t - s.last[e.id] < e.cooldown) return false;
          return e.when(s);
        })
        .sort((a, b) => (b.priority || 0) - (a.priority || 0));
    }

    // 1歩進める。イベントが出たら止まり、choose() を待つ
    function tick() {
      if (pending) return { type: 'event', event: pending };
      if (s.over) return { type: 'end' };
      if (s.t >= END) { s.over = s.over || 'end'; return { type: 'end' }; }
      runQueue();
      const list = eligible();
      if (list.length) {
        pending = list[0];
        s.last[pending.id] = s.t;
        return { type: 'event', event: pending };
      }
      monthly();
      s.t += 1;
      return { type: 'month' };
    }

    function choices() {
      if (!pending) return [];
      return pending.choices.map((c, i) => ({ i, label: c.label, note: c.note || '', block: c.req ? c.req(s) : null }));
    }

    function choose(i) {
      const ev = pending;
      const c = ev.choices[i];
      if (c.req && c.req(s)) return false;
      pending = null;
      if (!c.hist) s.div += c.div !== undefined ? c.div : 3;
      c.effect(api);
      log('【' + ev.title + '】' + c.label, 'choice');
      // イベントの直後に時間が進む（同じ月に何度も出続けないように）
      monthly();
      s.t += 1;
      return true;
    }

    return { s, tick, choices, choose, getPending: () => pending };
  }

  const exported = { createGame, ymLabel, GAUGES, END, ELECTION, clamp };
  if (typeof module !== 'undefined' && module.exports) module.exports = exported;
  else root.REB = exported;
})(typeof window !== 'undefined' ? window : globalThis);
