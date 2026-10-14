// 画面：計器、イベント、届いた知らせ（予兆）、経過、章の終わりの答え合わせ
(function () {
  'use strict';
  const { createGame, ymLabel, END } = REB; const EV = REB_EVENTS.events; const OM = REB_OMENS.omens;
  let g, token = 0, seenNews = 0, seed = newSeed();

  function newSeed() { return 1 + Math.floor(Math.random() * 9999); }

  const NAMES = {
    economy: '景気', fiscal: '財政', life: '暮らしの実感', tech: '技術力',
    party: '党の支持率', local: '地元の支持', lead: '求心力', scandal: 'スキャンダル', tie: 'しがらみ', image: '改革派の評価',
    donRel: 'ドンとの関係', nishina: '仁科の忠誠'
  };
  const HIDDEN = { damage: '金融の傷み', chain: '連鎖倒産の勢い', aware: '世論の危機認識', backlash: '救済への批判', funding: '資金調達力', moral: 'モラルハザード', donScandal: 'ドンの疑惑', reform: '政治改革の世論', infl: '物価の圧力', bousai: '防災力' };
  const SERIES = [['economy', '景気', 'var(--s1)'], ['fiscal', '財政', 'var(--s3)'], ['party', '党の支持率', 'var(--s4)'], ['life', '暮らしの実感', 'var(--s2)']];
  const DEBUG_SERIES = [['damage', '金融の傷み（内部）', 'var(--s5)'], ['aware', '世論の危機認識（内部）', 'var(--sub)']];
  const DON_STATUS = { active: '健在', resigned: '議員辞職', arrested: '逮捕', shadow: '院政' };

  const $ = (id) => document.getElementById(id);
  const esc = (x) => String(x).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

  function newGame(sameWorld) {
    if (!sameWorld) seed = newSeed();
    g = createGame(EV, { seed, omens: OM }); token++; seenNews = 0;
    render(); step();
  }

  function gaugeRow(name, val, cls) {
    return '<div class="g"><span>' + name + '</span><div class="bar ' + (cls || '') + '"><i style="width:' + Math.max(0, Math.min(100, val)) + '%"></i></div><b>' + Math.round(val) + '</b></div>';
  }

  function donChip(s) {
    const st = DON_STATUS[s.don.status];
    let cls = s.don.status === 'active' ? 'warn' : (s.don.status === 'arrested' ? 'bad' : '');
    let txt = 'ドン：' + st;
    if (s.don.status === 'active' || s.don.status === 'shadow') {
      txt += s.don.stance === 'oppose' ? '・公的資金に反対' : '・反対をやめた';
      if (s.don.stance !== 'oppose') cls = 'good';
    }
    return '<span class="chip ' + cls + '">' + txt + '</span>';
  }

  function render() {
    const s = g.s, v = s.v;
    $('date').textContent = ymLabel(Math.min(s.t, END));
    $('world').textContent = '世界 #' + s.seed;
    const x = s.ind;
    let h = '<h2>主な指標</h2><div class="kpi">' +
      [['成長率', sign(x.growth, '%')], ['財政収支', sign(x.balance, '兆円')], ['失業率', x.unemp.toFixed(1) + '%'], ['倒産', '月' + x.bankrupt.toLocaleString() + '件'], ['日経平均', x.nikkei.toLocaleString() + '円'], ['物価上昇率', sign(x.cpi, '%')]]
        .map(([k, val]) => '<div><span>' + k + '</span><b>' + val + '</b></div>').join('') + '</div>';
    h += '<h2 class="sp">国</h2>';
    ['economy', 'fiscal', 'life', 'tech'].forEach(k => h += gaugeRow(NAMES[k], v[k], 'good'));
    h += '<h2 class="sp">党・自分</h2>';
    ['party', 'local', 'lead', 'image', 'scandal', 'tie'].forEach(k => h += gaugeRow(NAMES[k], v[k], k !== 'scandal' && k !== 'tie' ? 'good' : ''));
    h += '<div class="g"><span>金（億円）</span><div></div><b>' + Math.round(v.money) + '</b></div>';
    h += '<div class="g"><span>乖離度</span><div class="bar"><i style="width:' + Math.min(100, s.div) + '%"></i></div><b>' + Math.round(s.div) + '</b></div>';
    h += '<h2 class="sp">人</h2>';
    h += gaugeRow(NAMES.donRel, v.donRel, 'good');
    h += s.flags.nishinaGone ? '<div class="g"><span>仁科の忠誠</span><div class="note">辞めて地元に帰った</div><b>―</b></div>' : gaugeRow(NAMES.nishina, v.nishina, 'good');
    const TS = { open: '未解決', resolved: '解決済み', relapse: '再燃' };
    const tcls = { open: 'warn', resolved: 'good', relapse: 'bad' };
    h += '<div class="status">' + donChip(s) + '<span class="chip ' + tcls[s.topics.bailout] + '">金融不安：' + TS[s.topics.bailout] + '</span>' +
      (s.flags.donDebt && !s.flags.debtPaid && (s.don.status === 'active' || s.don.status === 'shadow') ? '<span class="chip warn">ドンへの借り</span>' : '') + '</div>';
    $('gauges').innerHTML = h;

    const dbg = $('hidden').checked;
    let hb = '<h2 class="sp">内部の値（本番では見えない）</h2>';
    Object.keys(HIDDEN).forEach(k => hb += gaugeRow(HIDDEN[k], v[k], 'dbg'));
    hb += '<div class="note">投入：' + s.inj.count + '回 / 計' + s.inj.total + '兆円。時期尚早の度合い：' + Math.round(REB.prematurity(s) * 100) + '%。底割れの境目：' + s.world.crashAt.toFixed(0) + '。平穏の月数（語り部）：' + REB.calm(s) + (s.shock.flood !== undefined ? '。水害：' + ymLabel(s.shock.flood) : '') + '</div>';
    $('hiddenBox').innerHTML = hb;
    $('hiddenBox').hidden = !dbg;
    drawChart(dbg);
    renderNews();
    $('log').innerHTML = s.log.slice().reverse().map(l => '<div class="' + l.kind + '">' + ymLabel(l.t) + ' ' + esc(l.msg) + '</div>').join('') || '<div class="empty">まだ何も起きていない。</div>';
  }

  function renderNews() {
    const n = g.s.news;
    if (!n.length) { $('news').innerHTML = '<div class="empty">まだ知らせは届いていない。月が進むと、役所、頭取、新聞、秘書たちから話が入る。</div>'; return; }
    $('news').innerHTML = n.slice().reverse().map((x, i) => {
      const fresh = n.length - 1 - i >= seenNews ? ' fresh' : '';
      return '<div class="nw ' + x.tone + fresh + '"><span class="src">' + esc(x.src) + '</span><span class="msg">' + esc(x.msg) + '<span class="when">' + ymLabel(x.t) + '</span></span></div>';
    }).join('');
    seenNews = n.length;
  }

  function drawChart(dbg) {
    const h = g.s.hist; const svg = $('chart');
    const series = dbg ? SERIES.concat(DEBUG_SERIES) : SERIES;
    let out = '<line x1="0" y1="75" x2="300" y2="75" style="stroke:var(--line)"/>';
    series.forEach(([k, , c], idx) => {
      if (h.length < 2) return;
      const pts = h.map((p, i) => (i / END * 300).toFixed(1) + ',' + (150 - p[k] * 1.5).toFixed(1)).join(' ');
      out += '<polyline fill="none" style="stroke:' + c + '" stroke-width="2"' + (idx >= SERIES.length ? ' stroke-dasharray="4 3"' : '') + ' vector-effect="non-scaling-stroke" points="' + pts + '"/>';
    });
    svg.innerHTML = out;
    $('legend').innerHTML = series.map(([, n, c]) => '<span style="color:' + c + '">' + n + '</span>').join('');
  }

  // 3か月前と比べた向き
  function trend(key, better) {
    const h = g.s.hist; if (h.length < 4) return '';
    const d = g.s.ind[key] - h[h.length - 4].ind[key];
    const eps = key === 'nikkei' ? 300 : (key === 'bankrupt' ? 30 : 0.15);
    if (Math.abs(d) < eps) return '<span class="tr">→</span>';
    const good = (d > 0) === better;
    return '<span class="tr ' + (good ? 'up' : 'down') + '">' + (d > 0 ? '↑' : '↓') + '</span>';
  }
  const sign = (x, u) => (x >= 0 ? '+' : '−') + Math.abs(x).toFixed(1) + u;

  // 国・国民・企業の事情：数字と、その立場の言い分（イベントが voices を持たなければ、数字から作る）
  function situation(ev) {
    const s = g.s, x = s.ind, v = s.v;
    const vo = ev.voices ? ev.voices(s) : {};
    const rows = [
      ['国', '財政収支 ' + sign(x.balance, '兆円/年') + trend('balance', true) + '・税収 ' + x.tax.toFixed(0) + '兆円・成長率 ' + sign(x.growth, '%') + trend('growth', true),
        vo.country || (x.balance <= -12 ? '国債の発行が膨らみ、大蔵省が増税か歳出削減を求めている。' : x.balance <= -9 ? '赤字が広がり始めている。' : '財政はまだ持ちこたえている。')],
      ['国民', '失業率 ' + x.unemp.toFixed(1) + '%' + trend('unemp', false) + '・物価上昇率 ' + sign(x.cpi, '%') + trend('cpi', false) + '・暮らしの実感 ' + Math.round(v.life),
        vo.people || (x.cpi >= 4 ? '値上げが続き、給料が追いつかない。' : v.life < 40 ? '暮らしの不安が広がり、街の空気が重い。' : x.unemp >= 3 ? '職を失う人が目に見えて増えた。' : '生活はまだ落ち着いている。')],
      ['企業', '倒産 月' + x.bankrupt.toLocaleString() + '件' + trend('bankrupt', false) + '・日経平均 ' + x.nikkei.toLocaleString() + '円' + trend('nikkei', true),
        vo.business || (x.bankrupt >= 1500 ? '連鎖倒産が地方に広がっている。' : x.bankrupt >= 1000 ? '中小企業の資金繰りが苦しくなっている。' : '設備投資の話が出ている。')]
    ];
    return '<div class="sit">' + rows.map(([k, num, say]) => '<div class="sr"><span class="sk">' + k + '</span><span><span class="sn">' + num + '</span><span class="sv">' + esc(say) + '</span></span></div>').join('') + '</div>';
  }

  function showEvent(ev) {
    const cs = g.choices();
    let h = '<h2>' + ymLabel(g.s.t) + '</h2><h3>' + esc(ev.title) + '</h3><p>' + esc(g.textOf(ev)) + '</p>' + situation(ev);
    cs.forEach(c => {
      h += '<button class="ch" data-i="' + c.i + '"' + (c.block ? ' disabled' : '') + '>' + esc(c.label) +
        (c.note ? '<small>' + esc(c.note) + '</small>' : '') + (c.block ? '<small>選べない：' + esc(c.block) + '</small>' : '') + '</button>';
    });
    $('evcard').innerHTML = h;
    $('evcard').querySelectorAll('.ch').forEach(b => b.onclick = () => { g.choose(+b.dataset.i); render(); step(); });
  }

  function step() {
    const my = token;
    const r = g.tick();
    if (r.type === 'month') { render(); $('evcard').innerHTML = '<h2>' + ymLabel(g.s.t) + '</h2><p class="note">時間が進んでいます…</p>'; setTimeout(() => { if (my === token) step(); }, 140); return; }
    if (r.type === 'event') { render(); showEvent(r.event); return; }
    if (r.type === 'end') { render(); showEnd(); }
  }

  // 史実の基準線：同じ世界で、史実に近い選択（hist）を選び続けた場合
  function baseline(seedOf) {
    const b = createGame(EV, { seed: seedOf, omens: [] }); let n = 0;
    while (n++ < 500) {
      const r = b.tick(); if (r.type === 'end') break;
      if (r.type === 'event') {
        const cs = b.choices(); let i = r.event.choices.findIndex((c, k) => c.hist && !cs[k].block);
        if (i < 0) i = cs.map(c => c.i).filter(k => !cs[k].block).pop(); b.choose(i);
      }
    }
    return b.s;
  }

  function routeTags(s) {
    const f = s.flags, t = [];
    if (f.inspect) t.push('早期に検査を促した'); if (f.forbear) t.push('追い貸しを認めた'); if (f.merge) t.push('合併を仲介した');
    if (f.notebook) t.push('父の手帳を読んだ');
    if (f.blackmail) t.push('裏金リストでドンを脅した'); else if (f.donDebt) t.push('手帳でドンを説得した'); else if (f.persuadeFailed) t.push('ドンの説得に失敗した');
    if (f.early) t.push('早期処理（資本注入）'); if (f.refused) t.push('公的資金に反対');
    if (s.inj.count >= 1 && !f.bigbang && !f.desperate) t.push(s.inj.count >= 3 ? '逐次投入の泥沼' : '公的資金を投入');
    if (f.bigbang) t.push('途中から一気に大規模投入'); if (f.desperate) t.push('やけくそ投入');
    if (f.liquidate) t.push('破綻整理'); if (f.resigned) t.push('責任を取って役職を辞した');
    if (f.blackfund) t.push('裏金に手を出した'); if (f.cleanFund) t.push('きれいな資金で回した'); if (f.reform) t.push('献金に頼らない改革');
    if (f.defended) t.push('献金疑惑でドンを擁護'); if (f.distanced) t.push('献金疑惑でドンと距離を置いた'); if (f.pursued) t.push('ドンを追及した');
    if (f.factionHead) t.push('派閥の会長になった'); else if (f.katsuragi) t.push('跡目は葛城に付いた'); else if (f.mido) t.push('跡目は御堂に付いた');
    if (f.publish) t.push('父の死の夜を公表した'); else if (f.hush) t.push('口止めの金を受け取った'); else if (f.asked) t.push('父の死の夜をドンに問いただした');
    t.push('ドンは' + { active: '最後まで健在', resigned: '議員辞職', arrested: '逮捕された', shadow: '院政を敷いた' }[s.don.status]);
    if (f.nishinaGone) t.push('仁科が去った');
    if (f.partySplit) t.push('党が割れた'); if (f.newParty) t.push('新党を作った');
    if (s.last.inflation !== undefined) t.push('物価が高騰した'); if (s.last.riot !== undefined) t.push('物価の暴動が起きた');
    if (f.levee) t.push('首都の治水に投資した'); if (s.last.flood !== undefined) t.push(s.v.bousai >= 65 ? '水害を堤防が防いだ' : '首都が水害で止まった');
    if (f.boom) t.push('余力を活かした'); if (!f.crash) t.push('株価の底割れは起きなかった');
    return t;
  }

  // 対策B：遊んだ世界の条件を明かす（答え合わせ）
  function worldNote(w) {
    const lv = (x, c, d, hi, lo) => x > c + d ? hi : (x < c - d ? lo : '標準的');
    return '今回の世界：金融の傷みの初期値は' + lv(w.dmg0, 25, 1.5, '深め', '浅め') + '、傷みの増え方は' + lv(w.growth, 1.7, 0.08, '速め', '遅め') +
      '、株価が底割れする境目は' + lv(w.crashAt, 50, 1, '高め（持ちこたえやすい）', '低め（崩れやすい）') + '、ドンの疑惑が膨らむ速さは' + lv(w.donSpeed, 2.0, 0.1, '速め', '遅め') + 'でした。';
  }

  function showEnd() {
    const s = g.s, v = s.v, b = baseline(s.seed), bv = b.v;
    const row = (n, a, c, hi) => '<tr><td>' + n + '</td><td>' + Math.round(a) + '</td><td>' + Math.round(c) + '</td><td style="color:' + ((a - c) * (hi ? 1 : -1) >= 0 ? 'var(--good)' : 'var(--bad)') + '">' + (a - c >= 0 ? '+' : '') + Math.round(a - c) + '</td></tr>';
    const res = s.result;
    let h = '<h2>1993年8月 第1章の終わり</h2><h3>' + (res ? (res.won ? '当選：' : '落選：') + esc(res.partyResult) : '終了') + '</h3>';
    if (res && !res.won) h += '<p>選挙区で敗れた。ここでゲームオーバーになる。</p>';
    h += '<p>' + routeTags(s).map(x => '<span class="tag">' + esc(x) + '</span>').join('') + '</p>';
    h += '<div class="tw"><table><tr><th>あなた / 史実の基準線</th><th>あなた</th><th>史実</th><th>差</th></tr>' +
      row('景気', v.economy, bv.economy, true) + row('財政', v.fiscal, bv.fiscal, true) + row('暮らしの実感', v.life, bv.life, true) +
      row('技術力', v.tech, bv.tech, true) + row('金融の傷み', v.damage, bv.damage, false) + row('党の支持率', v.party, bv.party, true) +
      row('地元の支持', v.local, bv.local, true) + row('改革派の評価', v.image, bv.image, true) + '</table></div>';
    h += '<p class="note">乖離度 ' + Math.round(s.div) + '。「史実」は、同じ世界で史実に近い選択を選び続けた場合の結果です。<br>' + worldNote(s.world);
    if (!s.flags.crash && v.economy > bv.economy + 8) h += '<br>大きな事件を起こさず、国が史実より伸びました。';
    else if (v.economy > bv.economy + 8) h += '<br>痛みを引き受けた結果、史実より国が持ち直しました。';
    else if (v.economy < bv.economy - 3) h += '<br>手を打ったのに、悪い事態が重なって、史実より悪い状況になりました。';
    h += '</p><div class="ctl"><button class="btn" id="again">新しい世界で遊ぶ</button><button class="btn alt" id="same">同じ世界でもう一度</button></div>';
    $('evcard').innerHTML = h; $('again').onclick = () => newGame(false); $('same').onclick = () => newGame(true);
  }

  $('hidden').onchange = render;
  newGame(true);
})();
