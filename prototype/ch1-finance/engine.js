// RE-BURST 試作：状態とルールで動くエンジン（第1章：金融と政局）
// イベントは「条件が揃ったら起きる部品」。日付で固定せず、値の変化で出る・出ない・繰り返すが決まる。
// 史実の出来事も、条件を満たさなければ起きない。
(function (root) {
  'use strict';

  const END = 28;       // t=28 は 1993年8月。ここで終わる
  const ELECTION = 27;  // 1993年7月

  function ymLabel(t) {
    const m = 3 + t; // t=0 → 1991年4月
    return (1991 + Math.floor(m / 12)) + '年' + (m % 12 + 1) + '月';
  }

  function clamp(x, lo, hi) { return Math.max(lo, Math.min(hi, x)); }

  // 種から決まる乱数。同じ種なら同じ世界になる
  function makeRng(seed) {
    let a = (seed >>> 0) || 1;
    return function () {
      a = (a + 0x6D2B79F5) >>> 0;
      let x = a;
      x = Math.imul(x ^ (x >>> 15), x | 1);
      x ^= x + Math.imul(x ^ (x >>> 7), x | 61);
      return ((x ^ (x >>> 14)) >>> 0) / 4294967296;
    };
  }

  // 対策B：遊ぶたびに世界が少し違う（揺れ幅は小さめ。史実の範囲内）
  function makeWorld(rnd) {
    const r = (c, w) => c + (rnd() * 2 - 1) * w;
    return {
      dmg0: r(25, 4),       // 金融の傷みの初期値
      growth: r(1.7, 0.22), // 傷みの増え方
      crashAt: r(50, 3),    // 株価が底割れする傷みの境目
      donSpeed: r(2.0, 0.3) // ドンの疑惑が膨らむ速さ
    };
  }

  function initialState(world) {
    return {
      t: 0,
      world,
      v: {
        // プレイヤー個人
        local: 55,     // 地元の支持
        lead: 45,      // 求心力
        scandal: 10,   // スキャンダル
        tie: 20,       // しがらみ
        image: 30,     // 改革派の評価
        money: 100,    // 金（億円）
        // 人
        donRel: 70,    // ドンとの関係
        nishina: 70,   // 仁科の忠誠
        // 党
        party: 50,     // 党の支持率
        // 国
        economy: 56,   // 景気
        fiscal: 60,    // 財政（高いほど健全）
        spend: 0,      // 当初の予算を超えた歳出（兆円/年）。経済対策や投入で増え、少しずつ戻る
        life: 56,      // 暮らしの実感
        birth: 50,     // 人口のゲージ（子育てのしやすさ。出生率に反映。ゆっくり動く）
        burdenAdj: 0,  // 国民負担率の政策による上げ下げ（ポイント。増税・減税のイベントが動かす）
        tech: 50,      // 技術力
        // 隠れた値（画面には出さない。予兆から読み取る）
        damage: world.dmg0, // 金融の傷み
        gm: 0,         // 傷みの増え方の補正
        backlash: 0,   // 救済への批判
        funding: 100,  // 資金調達力（企業献金・パーティ収入の倍率）
        chain: 0,      // 連鎖倒産の勢い
        moral: 0,      // モラルハザード（緩み）
        aware: 8,      // 世論の危機認識
        donScandal: 35,// ドンの疑惑（捜査と報道の進み具合）
        reform: 20,    // 政治改革を求める世論
        infl: 30,      // 物価の圧力（景気の過熱と歳出の膨張で高まる）
        bousai: 50     // 防災力（治水への投資で上がり、歳出の削減で下がる）
      },
      // ドンの状態。stance は公的資金への立場、status は立場の変化
      don: { stance: 'oppose', status: 'active' }, // oppose/neutral ・ active/resigned/arrested/shadow
      inj: { count: 0, total: 0, last: -99 },
      flags: {},
      last: {},          // イベントごとの最後に起きた月
      topics: { bailout: 'open' }, // 案件の状態：open（未解決）/ resolved（解決済み）/ relapse（再燃）
      queue: [],         // 遅れて出る効果
      log: [],
      news: [],          // 予兆（情報源からの知らせ）
      shock: {},         // 外からの衝撃が起きた月（語り部が起こす）
      lastTension: 0,    // 最後に大きな波乱が起きた月（語り部が使う）
      hist: [],
      div: 0,            // 乖離度
      over: null
    };
  }

  // 実際の単位の指標（画面と文章に出す）。景気・傷み・連鎖・歳出から作る
  function indicators(s) {
    const v = s.v;
    const growth = v.economy >= 45 ? (v.economy - 45) * 0.3 : (v.economy - 45) * 0.12; // 実質成長率（%）
    const nikkei = Math.round((31000 - v.damage * 200 - (s.flags.crash ? 1500 : 0) + (v.economy - 56) * 40) / 10) * 10; // 日経平均（円）
    const bankrupt = Math.round(800 + v.chain * 12 + Math.max(0, v.damage - 35) * 8 + Math.max(0, 50 - v.economy) * 10); // 企業倒産（件/月）
    const unemp = 2.1 + Math.max(0, 56 - v.economy) * 0.03 + v.chain * 0.008; // 失業率（%）
    const tax = 60 + (v.economy - 56) * 0.5;                     // 税収（兆円/年）
    const balance = -(6.5 - (v.economy - 56) * 0.3 + v.spend);   // 単年度の財政収支（兆円/年。赤字は国債で埋める）
    const cpi = Math.max(-1.5, (v.infl - 30) * 0.12 + 2.0);        // 物価上昇率（%）
    // 人口・暮らし・社会保障（表示用の換算。史実の統計とは一致させない）
    const yr = s.t / 12;                                          // 1991年4月からの経過年
    const pop = Math.round(12410 + yr * 30);                      // 総人口（万人）。この時期はまだ緩やかに増える
    const aging = 12.6 + yr * 0.5;                                // 高齢化率（65歳以上の割合、%）
    const tfr = 1.54 + (v.birth - 50) * 0.01;                     // 合計特殊出生率
    const births = pop * 0.0098 * (tfr / 1.54) * (1 - yr * 0.006); // 出生数（万人/年）。1991年は約120万人
    const ssec = 47 + yr * 2.4 + (aging - 12.6) * 0.8;            // 社会保障費（兆円/年）。高齢化で増える
    const burden = 36.5 + yr * 0.3 + v.burdenAdj;                 // 国民負担率（%）。社会保険料が年々上がる
    const salary = 460 + (v.economy - 56) * 1.5 + (v.life - 56) * 1.0; // 平均年収（万円）
    const takehome = salary * (1 - burden * 0.0065);              // 手取り（万円/年）。負担率が上がると減る
    const assets = Math.round(1700 + (nikkei - 31000) * 0.03 - (v.damage - 25) * 5 + yr * 30); // 家計の資産（兆円。株と土地の値段で動く）
    return { growth, nikkei, bankrupt, unemp, tax, balance, cpi, pop, aging, tfr, births, ssec, burden, salary, takehome, assets };
  }

  // 語り部：大きな波乱のない月が続くほど、外からの衝撃が起きやすくなる（被害の大きさは備えで決まる）
  function calm(s) { return s.t - s.lastTension; }

  // 対策A：世論がまだ危機を感じていないうちに手を打つほど、反発が大きい（0〜1）
  function prematurity(s) { return clamp((45 - s.v.aware) / 45, 0, 1); }
  // 対策C：ドンが健在で、公的資金に反対している
  function donBlocks(s) { return s.don.stance === 'oppose' && (s.don.status === 'active' || s.don.status === 'shadow'); }

  function createGame(events, opts) {
    opts = opts || {};
    const seed = opts.seed != null ? opts.seed : Math.floor(Math.random() * 100000);
    const rnd = makeRng(seed);
    const s = initialState(makeWorld(rnd));
    s.seed = seed;
    s.ind = indicators(s);
    const omens = opts.omens || [];
    let pending = null;

    function log(msg, kind) { s.log.push({ t: s.t, msg, kind: kind || 'info' }); }
    function add(key, d) {
      // 財政を傷める選択は、その分だけ単年度の歳出を増やす（増税や歳出削減は減らす）
      if (key === 'fiscal') s.v.spend = d < 0 ? s.v.spend - d * 0.8 : Math.max(-6, s.v.spend - d * 0.8);
      s.v[key] += d;
      if (key === 'money' || key === 'gm') return;
      s.v[key] = clamp(s.v[key], 0, 100);
    }
    function later(months, msg, fn) { s.queue.push({ at: s.t + months, msg, fn }); }
    const api = { s, add, later, log, inject, prematurity: () => prematurity(s), donBlocks: () => donBlocks(s), rnd };

    // 公的資金の投入。逐次投入は効果が7割になり、批判が加算される
    function inject(S, opts2) {
      const nodisc = opts2 && opts2.nodisc;
      const sequential = s.inj.count >= 1 && !nodisc;
      const eff = S * (sequential ? 0.7 : 1);
      const p = prematurity(s);
      add('damage', -eff * 1.7);
      add('chain', -eff * 2);
      add('fiscal', -S * 0.7);
      add('backlash', S * 2.4 + (sequential ? 8 : 0) + S * 1.6 * p + 6 * p);
      add('moral', S * 0.3);
      add('party', -S * 0.6 - 3 * p);
      add('economy', -S * 0.25);
      if (p > 0.3) {
        add('lead', -5 * p); add('local', -4 * p);
        log('世間はまだ危機を感じていない。「危機を煽った」「銀行のための税金だ」と批判された', 'bad');
      }
      if (donBlocks(s)) {
        add('donRel', -12); add('funding', -8); add('nishina', -5);
        log('ドンの反対を押し切った。権藤派の資金の流れが細った', 'bad');
      }
      add('aware', S * 0.8 + 4); // 投入そのものが、世間に危機を知らせる
      later(6, '投入の効果が景気に出始めた', () => add('economy', eff * 0.8));
      s.inj.count += 1; s.inj.total += S; s.inj.last = s.t;
      s.div += S >= 10 ? 8 : 5;
    }

    // 月ごとの動き（イベントがなくても国は動く）
    function monthly() {
      const v = s.v, w = s.world;
      const growth = Math.max(0, (w.growth + v.gm + v.moral * 0.01) * (1 - v.damage / 130));
      v.damage = clamp(v.damage + growth, 0, 100);
      if (v.damage >= 52) v.chain = clamp(v.chain + (v.damage - 48) * 0.3, 0, 60);
      else v.chain = v.chain * 0.9;
      const et = 66 - v.damage * 0.35 - v.chain * 0.35 + (v.tech - 50) * 0.1;
      v.economy = clamp(v.economy + (et - v.economy) * 0.12, 0, 100);
      const lt = 58 - v.damage * 0.15 - v.chain * 0.45 + (v.economy - 50) * 0.3 - Math.max(0, s.ind.cpi - 3) * 3; // 物価高は暮らしを削る
      v.life = clamp(v.life + (lt - v.life) * 0.08, 0, 100);
      v.fiscal = clamp(v.fiscal - 0.08 - (v.economy < 45 ? 0.1 : 0) + (v.economy > 60 ? 0.05 : 0), 0, 100);
      v.spend = v.spend * 0.97;
      // 物価の圧力：景気の過熱と、膨らんだ歳出で高まる
      const it = 28 + (v.economy - 50) * 2.2 + Math.max(0, v.spend) * (v.economy >= 50 ? 2.5 : 0.75);
      v.infl = clamp(v.infl + (it - v.infl) * 0.08, 0, 100);
      v.backlash = v.backlash * 0.97;
      // 世論の危機認識は、本当の傷みより遅れて追いつく
      const at = clamp((v.damage - 30) * 1.3 + v.chain * 1.2 + (s.flags.crash ? 20 : 0), 0, 100);
      v.aware = clamp(v.aware + (at - v.aware) * 0.07, 0, 100);
      // ドンの疑惑は、何もしなければ膨らむ
      if (s.don.status === 'active') v.donScandal = clamp(v.donScandal + w.donSpeed * (s.flags.defended ? 0.85 : 1), 0, 100);
      if (s.flags.e107) v.reform = clamp(v.reform + 0.6, 0, 100);
      v.reform = clamp(v.reform - 0.15, 0, 100);
      const scandalDrag = s.flags.e107 && s.don.status !== 'arrested' ? Math.max(0, v.donScandal - 50) * 0.08 : 0;
      const pt = 50 + (v.economy - 50) * 0.35 - v.backlash * 0.25 - v.scandal * 0.1 - scandalDrag - Math.max(0, v.reform - 40) * 0.1;
      v.party = clamp(v.party + (pt - v.party) * 0.06, 0, 100);
      const ft = 100 - v.backlash * 1.0 - Math.max(0, 50 - v.party) * 2.2 - v.scandal * 0.2 - (s.flags.donCut ? 12 : 0);
      v.funding = clamp(v.funding + (ft - v.funding) * 0.15, 0, 100);
      v.money += v.funding * 0.12 - 9;
      v.scandal = Math.max(0, v.scandal - 0.25);
      // 地元の支持は、景気と党の支持率に向かってゆっくり戻る（国を良くすれば、地元もいずれ付いてくる）
      const lct = 52 + (v.economy - 50) * 0.5 + (v.party - 50) * 0.4;
      v.local = clamp(v.local + (lct - v.local) * 0.04, 0, 100);
      v.moral = v.moral * 0.99;
      // 人口のゲージは、暮らしの実感に向かってごくゆっくり動く（効果は約20年かけて出る：L-2）
      v.birth = clamp(v.birth + (50 + (v.life - 56) * 0.3 - v.birth) * 0.01, 0, 100);
      s.ind = indicators(s);
      rollShocks();
      s.hist.push({ t: s.t, economy: v.economy, damage: v.damage, fiscal: v.fiscal, party: v.party, life: v.life, aware: v.aware, ind: s.ind });
      omen();
    }

    // 外からの衝撃：chance(s) を持つイベントは、月ごとに確率で起きる（1章に1回まで）
    function rollShocks() {
      events.forEach((e) => {
        if (!e.chance || s.shock[e.id] !== undefined) return;
        if (rnd() < e.chance(s)) s.shock[e.id] = s.t;
      });
    }

    // 対策（予兆）：情報源ごとの偏りがある知らせを流す。状態は変えない
    function omen() {
      if (!omens.length || rnd() > 0.6) return;
      const lastSrc = s.news.length ? s.news[s.news.length - 1].src : null;
      const cands = omens.filter(o => o.src !== lastSrc && (!o.when || o.when(s)));
      for (let k = 0; k < 4 && cands.length; k++) {
        const i = Math.floor(rnd() * cands.length);
        const o = cands.splice(i, 1)[0];
        const m = o.say(s, rnd);
        if (!m) continue;
        const used = s.news.some(n => n.msg === m.text);
        if (used) continue;
        s.news.push({ t: s.t, src: o.src, msg: m.text, tone: m.tone || 'calm' });
        return;
      }
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
        if (pending.tension) s.lastTension = s.t;
        if (pending.onStart) pending.onStart(api); // 選ぶ前に起きてしまう被害など
        return { type: 'event', event: pending };
      }
      monthly();
      s.t += 1;
      return { type: 'month' };
    }

    function textOf(ev) { return typeof ev.text === 'function' ? ev.text(s) : ev.text; }

    function choices() {
      if (!pending) return [];
      return pending.choices.map((c, i) => ({
        i,
        label: typeof c.label === 'function' ? c.label(s) : c.label,
        note: typeof c.note === 'function' ? c.note(s) : (c.note || ''),
        block: c.req ? c.req(s) : null
      }));
    }

    function choose(i) {
      const ev = pending;
      const c = ev.choices[i];
      if (c.req && c.req(s)) return false;
      pending = null;
      // 史実にない出来事（invented）での選択は、乖離度を上げない
      if (!c.hist && !ev.invented) s.div += c.div !== undefined ? c.div : 3;
      const label = typeof c.label === 'function' ? c.label(s) : c.label;
      c.effect(api);
      log('【' + ev.title + '】' + label, 'choice');
      // イベントの直後に時間が進む（同じ月に何度も出続けないように）
      monthly();
      s.t += 1;
      return true;
    }

    return { s, tick, choices, choose, textOf, getPending: () => pending };
  }

  const exported = { createGame, ymLabel, END, ELECTION, clamp, makeRng, prematurity, donBlocks, indicators, calm };
  if (typeof module !== 'undefined' && module.exports) module.exports = exported;
  else root.REB = exported;
})(typeof window !== 'undefined' ? window : globalThis);
