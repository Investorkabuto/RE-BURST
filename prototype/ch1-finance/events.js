// イベントの部品。when（起きる条件）と choices（選択肢と状態の変化）だけで書く。
// hist: true は「史実に近い選択」（乖離度が上がらない）。
(function (root) {
  'use strict';

  const needLead = (n) => (s) => s.v.lead >= n ? null : '求心力が足りない（' + n + '以上が必要）';

  const events = [
    // ---- 北陽銀行のメインクエスト ----
    {
      id: 'mq1', title: 'MQ-1 頭取の再訪', once: true, priority: 50,
      when: (s) => s.t >= 2,
      text: '北陽銀行の頭取が執務室に来る。「地価の下落で、融資先の不動産会社が返済できません。このままでは決算が持ちません」。父の代からの後援会の柱だ。',
      choices: [
        { label: '大蔵省に口を利き、追い貸しを認めさせる', hist: true, note: '地元の支持↑ 金↑ しがらみ↑／傷みが隠れたまま膨らむ',
          effect: (g) => { g.add('local', 6); g.add('money', 15); g.add('tie', 8); g.s.v.gm += 0.6; g.s.flags.forbear = true; } },
        { label: '大蔵省の検査を促し、損失を早めに表に出させる', note: '地元の支持↓↓ 献金↓／傷みの増え方が緩む',
          effect: (g) => { g.add('local', -10); g.add('money', -8); g.add('tie', -6); g.add('damage', -10); g.s.v.gm -= 0.5; g.s.flags.inspect = true; } },
        { label: '他の銀行との合併を仲介する', note: '求心力が高ければ傷みが減る（8か月後に判明）',
          effect: (g) => { g.add('lead', -3); g.add('damage', -5); g.s.v.gm -= 0.3; g.s.flags.merge = true;
            g.later(8, null, (h) => { if (h.s.v.lead >= 40) { h.add('damage', -8); h.log('合併が軌道に乗り、傷みが減った', 'delayed'); } else { h.add('damage', 6); h.log('合併先の統合が混乱し、傷みが増えた', 'delayed'); } }); } },
        { label: '（何もしない）', hist: true, effect: () => {} }
      ]
    },
    {
      id: 'semi', title: 'E1-02 半導体協定の更新', once: true, priority: 30,
      when: (s) => s.t >= 2 && s.last.mq1 !== undefined,
      text: '米国が、日本市場での外国製半導体のシェアを引き上げるよう求める。国内メーカーは世界の首位を争っている。半導体の窓は今、開いている。',
      choices: [
        { label: '目標を受け入れる', hist: true, effect: (g) => { g.add('tech', -3); } },
        { label: '受け入れつつ、国内の研究開発に予算を付ける', note: '財政↓ 技術力↑（窓が開いている間の投資は効果が大きい）',
          effect: (g) => { g.add('fiscal', -4); g.add('tech', 6); g.later(12, '半導体への投資が実り、景気を押し上げた', (h) => h.add('economy', 3)); } },
        { label: '受け入れを拒む', note: '技術力↑ しかし報復で景気↓',
          effect: (g) => { g.add('tech', 2); g.later(4, '米国の報復関税で輸出が傷んだ', (h) => h.add('economy', -4)); } }
      ]
    },

    {
      id: 'notebook', title: 'E1-15 未完の手帳', once: true, priority: 40,
      when: (s) => s.t >= 4,
      text: '仁科と父の遺品を整理していると、書きかけの手帳が出てくる。銀行の不良債権を早めに処理する構想が、父の字でびっしり書かれている。日付は倒れる前の週で止まっている。',
      choices: [
        { label: '自分で読み、仁科に預ける', note: '求心力+5／公的資金に必要な求心力が下がる',
          effect: (g) => { g.add('lead', 5); g.s.flags.fundBias = true; g.s.flags.notebook = true; } },
        { label: '封印する', hist: true, effect: () => {} }
      ]
    },

    // ---- 早い段階で手を打てる機会（成功すれば大きなイベントが起きない） ----
    {
      id: 'early', topic: 'bailout', title: '早期処理の機会（地銀再編と限定的な資本注入）', once: true, priority: 45,
      when: (s) => !s.flags.crash && !s.flags.mq2 && s.v.damage >= 35 && s.v.damage < 58 && s.t >= 6,
      text: '大蔵省の若手が小声で言う。「今なら約2兆円と地銀の再編で、傷を小さいうちに塞げます。1年後には桁が変わります」。まだ世間は危機を感じていない。',
      choices: [
        { label: '約2兆円の資本注入と地銀再編を主導する', note: '財政↓ 批判↑（小）／傷みが大きく減り、増え方も緩む', req: needLead(40), div: 4,
          effect: (g) => { g.add('damage', -18); g.add('fiscal', -2.5); g.add('backlash', 6); g.add('lead', 3); g.s.v.gm -= 0.4; g.s.flags.early = true; } },
        { label: '見送る（世論が動いてからにする）', hist: true, effect: () => {} }
      ]
    },
    {
      id: 'boom', title: '景気に余力が出た（国が伸びる局面）', once: true, priority: 20,
      when: (s) => !s.flags.crash && s.t >= 10 && s.v.damage <= 34 && s.v.economy >= 53,
      text: '金融の傷が浅く、景気にも余力がある。財界は設備投資を口にし、役所は「今なら打てる手が多い」と言う。',
      choices: [
        { label: '国内の技術と人材に重点投資する', note: '財政↓ 技術力↑↑／景気が遅れて伸びる',
          effect: (g) => { g.add('fiscal', -3); g.add('tech', 8); g.later(10, '技術投資が実り、景気が伸びた', (h) => h.add('economy', 4)); } },
        { label: '財政を立て直す', note: '財政↑ 景気↓（小）', effect: (g) => { g.add('fiscal', 6); g.add('economy', -1); } },
        { label: '減税で暮らしを支える', note: '暮らし↑ 党の支持率↑ 財政↓',
          effect: (g) => { g.add('life', 5); g.add('party', 3); g.add('fiscal', -4); } }
      ]
    },

    // ---- 大きな事件：傷みが大きくなったときだけ起きる ----
    {
      id: 'crash', title: 'E1-10 株価の底割れと経済対策', once: true, priority: 60,
      when: (s) => !s.flags.crash && s.v.damage >= 50,
      text: '日経平均が急落する。市場は不良債権の処理が遅れていると見ている。党は大型の経済対策を作る。',
      choices: [
        { label: '公共事業を中心にした大型の対策', hist: true, note: '景気↑（短期）財政↓↓',
          effect: (g) => { g.add('economy', -6); g.add('fiscal', -8); g.add('economy', 4); g.add('local', 4); g.add('chain', 20); g.s.flags.crash = true; } },
        { label: '減税を中心にした対策', note: '暮らし↑ 財政↓↓',
          effect: (g) => { g.add('economy', -6); g.add('fiscal', -8); g.add('life', 4); g.add('chain', 20); g.s.flags.crash = true; } },
        { label: '小規模にとどめ、財源を不良債権の処理に回す', note: '景気↓／公的資金の投入に必要な求心力が下がる',
          effect: (g) => { g.add('economy', -9); g.add('money', -5); g.add('chain', 20); g.s.flags.crash = true; g.s.flags.fundBias = true; } }
      ]
    },
    {
      id: 'mq2', topic: 'bailout', title: 'MQ-2 公的資金の早期投入論', cooldown: 1, priority: 58,
      when: (s) => s.flags.crash && !s.flags.mq2,
      text: '総理が「金融機関に公的資金を入れてでも、不良債権を処理すべきだ」と発言するが、銀行業界、財界、大蔵省、世論がそろって反発する。規模を選ぶ。小さすぎれば止まらず、大きすぎれば財政と支持率が先に傷む。',
      choices: [
        { label: '投入する：小規模（約3兆円）', req: (s) => needLead(s.flags.fundBias ? 20 : 30)(s), div: 5,
          note: '傷み↓ 批判↑（小）／取りこぼしが出やすい', effect: (g) => { g.s.flags.mq2 = true; g.inject(3); } },
        { label: '投入する：中規模（約8兆円）', req: (s) => needLead(s.flags.fundBias ? 40 : 50)(s), div: 8,
          note: '傷み↓↓ 財政↓ 批判↑', effect: (g) => { g.s.flags.mq2 = true; g.inject(8); } },
        { label: '投入する：大規模（約16兆円）', req: (s) => needLead(s.flags.fundBias ? 55 : 65)(s), div: 12,
          note: '連鎖倒産はほぼ止まる。財政↓↓↓ 批判↑↑ 支持率↓', effect: (g) => { g.s.flags.mq2 = true; g.inject(16); } },
        { label: '先に党内の根回しに回る（金30億・求心力+12、来月もう一度判断する）', req: (s) => (s.flags.lobby || 0) >= 2 ? '根回しはこれ以上効かない' : (s.v.money < 30 ? '金が足りない' : null),
          note: '時間がかかる。その間も傷みは増える', div: 0,
          effect: (g) => { g.add('money', -30); g.add('lead', 12); g.add('tie', 4); g.s.flags.lobby = (g.s.flags.lobby || 0) + 1; } },
        { label: '反対する（銀行業界と大蔵省の側に付く）', hist: true, note: '献金↑ しがらみ↑／傷みは放置される',
          effect: (g) => { g.s.flags.mq2 = true; g.s.flags.refused = true; g.add('money', 12); g.add('tie', 6); } }
      ]
    },

    // ---- 連鎖と泥沼 ----
    {
      id: 'chain', topic: 'bailout', title: 'E1-18 連鎖倒産', cooldown: 4, priority: 55,
      when: (s) => s.v.chain >= 8 && s.inj.count === 0,
      text: '弱い銀行が倒れると、その銀行から借りていた不動産会社が倒れ、下請けの建設会社や商店が倒れる。取引先の信用不安が次の銀行に飛び火する。頭取が青ざめて来る。「うちの取引先の4社が、同じ週に手形を落とせません」。',
      choices: [
        { label: '連鎖を止めるため、公的資金を入れる（約3兆円）', req: needLead(30), note: '今から入れる。遅れた分、傷みは深い',
          effect: (g) => { g.s.flags.mq2 = true; g.inject(3); } },
        { label: '破綻した銀行を整理し、健全な銀行に営業を引き継がせる', note: '景気↓ 暮らし↓／批判は出ない 求心力↑',
          effect: (g) => { g.add('economy', -6); g.add('life', -4); g.add('damage', -8); g.add('lead', 3); g.s.v.chain *= 0.4; g.s.flags.liquidate = true; } },
        { label: '取引先の中小企業にだけ、つなぎ融資を出す', note: '財政↓ 地元の支持↑',
          effect: (g) => { g.add('fiscal', -3); g.add('local', 4); g.add('chain', -4); g.add('economy', 1); } },
        { label: '（何もしない）', hist: true, note: '景気↓ 暮らし↓ 傷み↑',
          effect: (g) => { g.add('economy', -4); g.add('life', -3); g.add('damage', 4); } }
      ]
    },
    {
      id: 'more', topic: 'bailout', title: 'E1-19 追加投入の判断（泥沼）', cooldown: 3, priority: 56,
      when: (s) => s.inj.count >= 1 && s.inj.count < 3 && s.v.chain >= 5 && s.v.damage >= 45 && s.t - s.inj.last >= 2,
      text: '総理は言う。「あと少しで止まる」。党内は割れる。「ここで止めたら、これまでの金は無駄になる」「いや、もう止めよう」。大蔵省の担当者が示す追加の額は、前回より大きい。逐次投入は効果が7割になり、批判が積み重なる。',
      choices: [
        { label: '追加で投入する（約3兆円）', req: needLead(25), note: '効果は7割・批判が加算される', effect: (g) => { g.inject(3); } },
        { label: '一気に大規模に切り替える（約14兆円）', req: needLead(55), div: 8, note: '割増なし。財政↓↓ 批判↑↑',
          effect: (g) => { g.s.flags.bigbang = true; g.s.flags.media = true; g.inject(14, { nodisc: true }); } },
        { label: '投入を打ち切り、破綻整理に移る', note: '景気↓↓（短期）批判は消える',
          effect: (g) => { g.add('economy', -7); g.add('life', -4); g.add('damage', -6); g.add('backlash', -15); g.add('lead', 2); g.s.v.chain *= 0.4; g.s.flags.liquidate = true; g.s.inj.count = 3; g.s.flags.media = true; } },
        { label: '（何もしない）', effect: (g) => { g.add('damage', 5); } }
      ]
    },
    {
      id: 'media', topic: 'bailout', title: 'E1-20 マスコミバッシングと最後の決断', once: true, priority: 57,
      when: (s) => s.inj.count >= 3 && !s.flags.media,
      text: '週刊誌と夕刊の見出しが一斉に変わる。「泥沼」「見通しの甘さ」「税金の垂れ流し」。国会では野党が追及し、与党の若手が執行部に批判を向ける。仁科が小声で言う。「先生、ここが一番、人の本性が出ます」。',
      choices: [
        { label: '一気に大規模な投入を決断する（やけくそ投入・約16兆円）', req: needLead(35), div: 8,
          note: '連鎖は止まる。財政↓↓↓ 支持率↓↓ 求心力↓ 緩み↑',
          effect: (g) => { g.s.flags.media = true; g.s.flags.desperate = true; g.inject(16, { nodisc: true }); g.add('lead', -8); g.add('moral', 10); } },
        { label: '責任を取り、担当の役職を辞する', note: '求心力↓↓／批判は薄れる',
          effect: (g) => { g.s.flags.media = true; g.s.flags.resigned = true; g.add('lead', -15); g.s.v.backlash *= 0.5; g.add('party', 2); } },
        { label: '破綻整理に切り替え、痛みを引き受ける', note: '景気↓↓ 求心力↑',
          effect: (g) => { g.s.flags.media = true; g.s.flags.liquidate = true; g.add('economy', -8); g.add('life', -5); g.add('damage', -6); g.add('lead', 5); g.add('backlash', -15); g.s.v.chain *= 0.4; } },
        { label: '（何もしない）', effect: (g) => { g.s.flags.media = true; g.add('party', -8); g.add('damage', 5); } }
      ]
    },

    // ---- 世論と資金 ----
    {
      id: 'bash', title: 'E1-17 救済へのバッシング', cooldown: 6, priority: 52,
      when: (s) => s.v.backlash >= 35,
      text: '見出しが「銀行を税金で救うのか」に変わる。住宅ローンに苦しむ人、救済から外れた取引先、経営努力をしてきた同業の他行からも「なぜあの銀行だけ」と不満が出る。党本部の電話が鳴り止まない。',
      choices: [
        { label: '経営陣の責任追及と、給与・配当の制限を条件にする', note: '批判↓ 資金調達力↓（業界が反発）モラル↓',
          effect: (g) => { g.add('backlash', -14); g.add('funding', -10); g.add('moral', -8); g.add('tie', -4); } },
        { label: '条件を付けず、混乱を抑えることを優先する', note: '党の支持率↓ モラル↑',
          effect: (g) => { g.add('party', -5); g.add('moral', 6); } },
        { label: '中小企業向けの資金繰り支援も同時に出す', note: '財政↓ 批判↓ 地元の支持↑',
          effect: (g) => { g.add('fiscal', -3); g.add('backlash', -12); g.add('local', 4); } },
        { label: '自ら党と街頭で説明に立つ', note: '時間と金を使う。批判が少し和らぐ',
          effect: (g) => { g.add('backlash', -7); g.add('lead', 2); g.add('money', -3); } },
        { label: '（何もしない）', hist: true, effect: (g) => { g.add('party', -3); } }
      ]
    },
    {
      id: 'fund', title: 'E1-21 資金の枯渇', once: true, priority: 53,
      when: (s) => s.v.funding <= 70 && s.t >= 6,
      text: '財界の会合から、名前が消える。「銀行を救った政権に出す金はない」「救われなかった側が怒っている」。パーティ券の売れ行きが落ち、企業献金の約束が取り消される。鬼塚が帳簿を持ってくる。「先生、このままでは選挙が持ちません」。',
      choices: [
        { label: '経費を削り、後援会の個人献金と小口のパーティで回す', note: '苦しいがきれいなまま',
          effect: (g) => { g.add('money', 5); g.add('local', 2); g.add('tie', -3); g.s.flags.cleanFund = true; } },
        { label: '派閥の長老に頭を下げ、資金を借りる', note: '金↑ しがらみ↑↑ 求心力↓',
          effect: (g) => { g.add('money', 35); g.add('tie', 12); g.add('lead', -3); } },
        { label: '机の中の裏金リストに手を出す', note: '金↑↑ スキャンダル↑↑（後で響く）',
          effect: (g) => { g.add('money', 50); g.add('scandal', 18); g.s.flags.blackfund = true; } },
        { label: '献金に頼らない政治改革を進める', note: '支持率↑（小）金↓ 求心力↑',
          effect: (g) => { g.add('party', 2); g.add('money', -10); g.add('lead', 3); g.s.flags.reform = true; } },
        { label: '（何もしない）', hist: true, effect: (g) => { g.add('money', -10); } }
      ]
    },

    // ---- 章の終わり ----
    {
      id: 'election', title: 'E1-14 衆議院選挙（1993年7月）', once: true, priority: 100,
      when: (s) => s.t >= 27,
      text: '選挙の費用は約60億円。ここまでの判断が、地元の支持と党の支持率と資金に現れる。',
      choices: [
        { label: '地元に張り付き、選挙区に集中する', effect: (g) => { g.add('local', 5); finishElection(g); } },
        { label: '全国の応援に回り、党の議席を守る', effect: (g) => { g.add('local', -6); g.add('party', 3); finishElection(g); } },
        { label: '（何もしない）', hist: true, effect: (g) => { finishElection(g); } }
      ]
    }
  ];

  function finishElection(g) {
    const s = g.s, v = s.v;
    v.money -= 60;
    if (v.money < 0) { v.local += v.money * 0.3; v.money = 0; g.log('資金が足りず、選挙運動が細った', 'bad'); }
    const exposed = s.flags.blackfund && v.scandal >= 33;
    const score = v.local + (v.party - 50) * 0.3 - Math.max(0, v.scandal - 33) * 0.4 - (exposed ? 8 : 0);
    s.result = {
      score: Math.round(score),
      won: score >= 40,
      exposed: !!exposed,
      partyResult: v.party >= 50 ? '与党が議席を守る' : (v.party >= 42 ? '与党が過半数をぎりぎり維持' : '与党が過半数を割る')
    };
    if (!s.result.won) s.over = 'lost';
  }

  const api = { events, finishElection };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.REB_EVENTS = api;
})(typeof window !== 'undefined' ? window : globalThis);
