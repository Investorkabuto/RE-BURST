// イベントの部品。when（起きる条件）と choices（選択肢と状態の変化）だけで書く。
// hist: true は「史実に近い選択」（乖離度が上がらない）。
// 史実の出来事（ドンの辞職・逮捕、内閣不信任案、株価の底割れ）も、条件を満たさなければ起きない。
(function (root) {
  'use strict';

  const donBlocks = (s) => s.don.stance === 'oppose' && (s.don.status === 'active' || s.don.status === 'shadow');
  const needLead = (n) => (s) => s.v.lead >= n ? null : '求心力が足りない（' + n + '以上が必要）';
  // 公的資金に必要な求心力：父の手帳などで下がり、ドンが反対していると上がる
  const needFund = (base) => (s) => {
    const n = base - (s.flags.fundBias ? 10 : 0) + (donBlocks(s) ? 10 : 0);
    return s.v.lead >= n ? null : '求心力が足りない（' + n + '以上が必要' + (donBlocks(s) ? '。ドンが反対している' : '') + '）';
  };
  const tri = (x) => Math.abs(x).toFixed(1) + '兆円';
  const bal = (s) => '単年度の赤字は年' + tri(s.ind.balance);
  const donNote = (s) => donBlocks(s) ? '／ドンの反対を押し切ることになる（ドンとの関係↓ 資金↓）' : '';

  const events = [
    // ---- 北陽銀行のメインクエスト ----
    {
      id: 'mq1', title: 'MQ-1 頭取の再訪', once: true, priority: 50,
      when: (s) => s.t >= 2,
      text: '北陽銀行の頭取が執務室に来る。「地価の下落で、融資先の不動産会社が返済できません。このままでは決算が持ちません」。父の代からの後援会の柱で、権藤派の金庫にもつながっている。',
      choices: [
        { label: '大蔵省に口を利き、追い貸しを認めさせる', hist: true, note: '地元の支持↑ 金↑ しがらみ↑ ドンとの関係↑／傷みが隠れたまま膨らむ',
          effect: (g) => { g.add('local', 6); g.add('money', 15); g.add('tie', 8); g.add('donRel', 4); g.s.v.gm += 0.6; g.s.flags.forbear = true; } },
        { label: '大蔵省の検査を促し、損失を早めに表に出させる', note: '地元の支持↓↓ 献金↓ ドンとの関係↓／傷みの増え方が緩む。世間が危機に気づき始める',
          effect: (g) => { g.add('local', -10); g.add('money', -8); g.add('tie', -6); g.add('donRel', -8); g.add('image', 6); g.add('damage', -10); g.add('aware', 8); g.s.v.gm -= 0.5; g.s.flags.inspect = true; } },
        { label: '他の銀行との合併を仲介する', note: '求心力が高ければ傷みが減る（8か月後に判明）',
          effect: (g) => { g.add('lead', -3); g.add('damage', -5); g.add('aware', 3); g.s.v.gm -= 0.3; g.s.flags.merge = true;
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
      text: '仁科と父の遺品を整理していると、書きかけの手帳が出てくる。銀行の不良債権を早めに処理する構想が、父の字でびっしり書かれている。日付は倒れる前の週で止まっている。余白に一行だけ、「権藤さんを説得できるか」。',
      choices: [
        { label: '自分で読み、仁科に預ける', note: '求心力+5 仁科の忠誠↑／公的資金に必要な求心力が下がる。ドンを説得する材料になる',
          effect: (g) => { g.add('lead', 5); g.add('nishina', 5); g.s.flags.fundBias = true; g.s.flags.notebook = true; } },
        { label: '封印する', hist: true, effect: () => {} }
      ]
    },

    // ---- 対策C：ドンを説得する（大きな代償付き） ----
    {
      id: 'persuade', topic: 'bailout', title: 'ドンの屋敷にて（公的資金をめぐる説得）', cooldown: 6, priority: 46,
      when: (s) => s.don.status === 'active' && s.don.stance === 'oppose' && !s.flags.crash && s.t >= 5 &&
        (s.flags.notebook || s.v.aware >= 25) && s.v.damage >= 33 && (s.flags.persuadeTries || 0) < 2,
      text: (s) => '目白の屋敷で、権藤 嘉平は鯉に餌をやりながら言う。「銀行に税金を入れる？　龍三郎の倅が、何を青いことを。銀行はな、わしらの金庫だ。金庫に穴を開けて誰が得をする」。' +
        (s.flags.persuadeFailed ? '前に来たときより、笑顔が薄い。' : '好々爺の笑顔は崩れない。'),
      choices: [
        { label: '父の手帳を見せ、父の遺志として頼む', req: (s) => s.flags.notebook ? null : '父の手帳を読んでいない',
          note: (s) => 'ドンとの関係と仁科の忠誠しだいで成否が分かれる。成功すれば、ドンは反対をやめるが「借り」が残る（しがらみ↑↑ 改革派の評価↓）',
          effect: (g) => {
            const s = g.s; s.flags.persuadeTries = (s.flags.persuadeTries || 0) + 1;
            const power = s.v.donRel + (s.v.nishina >= 60 ? 10 : 0);
            if (power >= 70) {
              s.don.stance = 'neutral'; s.flags.donDebt = true;
              g.add('tie', 12); g.add('image', -8); g.add('donRel', 5); g.add('lead', 3);
              g.log('ドンは手帳を長く眺め、「好きにせえ。ただし、この借りは返してもらう」と言った', 'delayed');
            } else {
              s.flags.persuadeFailed = true; g.add('donRel', -10);
              g.log('ドンは手帳を閉じた。「龍三郎も、あの夜、同じことを言った」', 'bad');
            }
          } },
        { label: '裏金リストを持ち出し、取引を迫る', note: '必ず反対をやめさせる。ドンとの関係↓↓ 仁科の忠誠↓↓ スキャンダル↑（脅しは記録に残る）', div: 6,
          effect: (g) => { const s = g.s; s.flags.persuadeTries = (s.flags.persuadeTries || 0) + 1; s.don.stance = 'neutral'; s.flags.blackmail = true;
            g.add('donRel', -25); g.add('nishina', -15); g.add('scandal', 10); g.add('lead', 4);
            g.log('ドンは笑ったまま言った。「お前の父親も同じ穴の狢だったな」', 'bad'); } },
        { label: '今日は引き下がる', hist: true, effect: () => {} }
      ]
    },

    // ---- 早い段階で手を打てる機会（成功すれば大きなイベントが起きない） ----
    {
      id: 'early', topic: 'bailout', title: '早期処理の機会（地銀再編と限定的な資本注入）', once: true, priority: 45,
      when: (s) => !s.flags.crash && !s.flags.mq2 && s.v.damage >= 35 && s.v.damage < 58 && s.t >= 6,
      voices: (s) => ({
        country: '大蔵省の若手：「今なら約2兆円で済みます。財政への影響は、赤字が年1.6兆円ほど増えるだけです」',
        people: s.v.aware < 25 ? '街の声：「銀行が危ない？　景気はいいじゃないか。なんで税金を入れるんだ」' : '街の声：「うちのメインバンクは大丈夫なのか」',
        business: '北陽銀行の頭取：「資本を入れていただけるなら……ただ、経営責任を問われるのは困ります」'
      }),
      text: (s) => '大蔵省の若手が小声で言う。「今なら約2兆円と地銀の再編で、傷を小さいうちに塞げます。1年後には桁が変わります」。' +
        (s.v.aware < 25 ? 'ただ、世間はまだ危機を感じていない。今動けば「危機を煽る」と言われるだろう。' : '世間も、ようやく銀行の話をし始めている。'),
      choices: [
        { label: '約2兆円の資本注入と地銀再編を主導する', req: needFund(50), div: 4,
          note: (s) => '財政↓ 批判↑／傷みが大きく減り、増え方も緩む' + (s.v.aware < 25 ? '。世間の危機認識が低いほど、反発と求心力の損失が大きい' : '') + donNote(s),
          effect: (g) => {
            const s = g.s, p = g.prematurity();
            g.add('damage', -18); g.add('fiscal', -2.5); g.add('backlash', 6 + 22 * p); g.add('lead', 3 - 10 * p); g.add('party', -4 * p); g.add('local', -6 * p);
            g.add('image', 6); g.add('aware', 10); s.v.gm -= 0.4; s.flags.early = true;
            if (p > 0.3) g.log('「なぜ今、銀行に税金を」。危機を知らない世間から、強い反発が出た', 'bad');
            if (donBlocks(s)) { g.add('donRel', -15); g.add('nishina', -5); s.flags.donCut = true; g.log('ドンの反対を押し切った。権藤派の資金の流れが細った', 'bad'); }
          } },
        { label: '見送る（世論が動いてからにする）', hist: true, effect: () => {} }
      ]
    },
    {
      id: 'boom', title: '景気の分かれ目（余力をどう使うか）', once: true, priority: 20,
      when: (s) => !s.flags.crash && s.t >= 10 && s.v.damage <= 34,
      text: (s) => {
        let t = '金融の傷は浅く済んだ。株価の底割れも、銀行の連鎖倒産も起きていない。';
        if (s.ind.growth < 2.5) t += 'しかし、金融不安の余波で企業は投資を手控え、景気の勢いは鈍っている。';
        else t += '景気にはまだ勢いがあり、財界は設備投資を口にしている。';
        if (s.ind.balance <= -9) t += 'その一方で、' + bal(s) + 'に広がった。大蔵省は、増税か歳出の削減を迫ってくる。';
        return t + '何に使い、何を削るか。';
      },
      voices: (s) => ({
        country: '大蔵省の主計局長：「' + (s.ind.balance <= -9 ? '国債の発行がかさんでいます。今のうちに財政を締めなければ、次の不況で打つ手がなくなります' : '財政に余裕があるうちに、将来の負担を減らしておくべきです') + '」',
        people: s.ind.growth < 2.5 ? '商店街の会長：「お客さんの財布が固くなった。減税でもしてくれないと、年を越せない店が出る」' : '会社員：「ボーナスは出たが、家はもう買えない値段のままだ」',
        business: '電機メーカーの社長：「半導体と液晶は今が勝負です。国が研究に金を付けてくれれば、10年先まで食える」'
      }),
      choices: [
        { label: '国内の技術と人材に重点投資する', note: '赤字 約+3.2兆円/年 技術力↑↑／10か月後に成長率 約+1.2%',
          effect: (g) => { g.add('fiscal', -4); g.add('tech', 8); g.s.flags.boom = true; g.later(10, '技術投資が実り、景気が伸びた', (h) => h.add('economy', 4)); } },
        { label: '増税して財政を立て直す（所得税・法人税）', note: '赤字 約−4.8兆円/年 成長率 約−0.6% 党の支持率↓ 暮らし↓',
          effect: (g) => { g.add('fiscal', 6); g.add('economy', -2); g.add('party', -3); g.add('life', -2); g.s.flags.boom = true; g.s.flags.taxUp = true; } },
        { label: '歳出を絞る（公共事業を削る）', note: '赤字 約−3.2兆円/年 地元の支持↓ 暮らし↓（小） 業界の献金↓／治水などの工事も止まる',
          effect: (g) => { g.add('fiscal', 4); g.add('local', -4); g.add('life', -2); g.add('economy', -1); g.add('funding', -5); g.add('bousai', -10); g.s.flags.boom = true; g.s.flags.spendCut = true; } },
        { label: '減税で暮らしを支える', note: '赤字 約+3.2兆円/年 暮らし↑ 党の支持率↑ 成長率 約+0.3%',
          effect: (g) => { g.add('life', 5); g.add('party', 3); g.add('fiscal', -4); g.add('economy', 1); g.s.flags.boom = true; } }
      ]
    },
    {
      id: 'mofPress', title: '大蔵省の財政再建要求', cooldown: 9, priority: 35,
      when: (s) => s.t >= 6 && s.ind.balance <= -12,
      text: (s) => '大蔵省の主計局長が、資料を抱えて来る。「' + bal(s) + 'です。税収は年' + s.ind.tax.toFixed(0) + '兆円まで落ちました。このままでは、国債の利払いが予算を食い始めます」。' +
        (s.ind.growth < 0 ? '景気は後退している。今締めれば、景気はさらに冷える。' : '景気はまだ持ちこたえている。'),
      voices: (s) => ({
        country: '主計局長：「増税か、歳出の削減か。どちらもしないなら、せめて来年度の予算で枠をはめさせてください」',
        people: s.ind.unemp >= 2.8 ? '失業した元工員：「増税なんかされたら、本当に食えなくなる」' : '主婦：「税金が上がるなら、その分はちゃんと使い道を見せてほしい」',
        business: s.ind.bankrupt >= 1100 ? '建設業協会：「公共事業を削られたら、地方の下請けから潰れます」' : '経済団体：「法人税を上げるなら、工場は海外に出ていくだけですよ」'
      }),
      choices: [
        { label: '増税を受け入れる（所得税・法人税）', note: (s) => '赤字 約−4.8兆円/年 党の支持率↓' + (s.ind.growth < 0 ? ' 景気が悪い時の増税は効きすぎる（成長率 約−1.8%）' : ' 成長率 約−0.9%'),
          effect: (g) => { const bad = g.s.ind.growth < 0; g.add('fiscal', 6); g.add('economy', bad ? -6 : -3); g.add('party', -4); g.add('life', -3); g.s.flags.taxUp = true; } },
        { label: '歳出を絞る（公共事業を削る）', note: '赤字 約−3.2兆円/年 地元の支持↓ 業界の献金↓ 成長率 約−0.6%／治水などの工事も止まる',
          effect: (g) => { g.add('fiscal', 4); g.add('local', -5); g.add('economy', -2); g.add('life', -2); g.add('tie', -3); g.add('funding', -5); g.add('bousai', -8); g.s.flags.spendCut = true; } },
        { label: '突っぱね、国債で景気を支え続ける', hist: true, note: '赤字 約+1.6兆円/年 成長率 約+0.3%／次の要求はもっと厳しくなる',
          effect: (g) => { g.add('fiscal', -2); g.add('economy', 1); g.s.flags.mofRefused = (g.s.flags.mofRefused || 0) + 1; } }
      ]
    },

    // ---- 大きな事件：傷みが大きくなったときだけ起きる ----
    {
      id: 'crash', title: 'E1-10 株価の底割れと経済対策', once: true, tension: true, priority: 60,
      when: (s) => !s.flags.crash && s.v.damage >= s.world.crashAt,
      voices: (s) => ({
        country: '主計局長：「経済対策を打てば、赤字はさらに年10兆円近く膨らみます」',
        people: '会社員：「財形で買った株が半分になった。家のローンはそのままだ」',
        business: s.ind.bankrupt >= 1000 ? '建設会社の社長：「手形が落ちない。公共事業を出してくれないと、年を越せない」' : '不動産会社の社長：「担保の土地が値下がりして、銀行が貸してくれない」'
      }),
      text: '日経平均が急落する。市場は不良債権の処理が遅れていると見ている。新聞の一面が初めて「銀行」の二文字で埋まる。党は大型の経済対策を作る。',
      choices: [
        { label: '公共事業を中心にした大型の対策', hist: true, note: '景気↓（小）財政↓↓ 地元の支持↑',
          effect: (g) => { g.add('economy', -2); g.add('fiscal', -8); g.add('local', 4); g.add('chain', 20); g.add('aware', 25); g.s.flags.crash = true; } },
        { label: '減税を中心にした対策', note: '景気↓ 暮らし↑ 財政↓↓',
          effect: (g) => { g.add('economy', -6); g.add('fiscal', -8); g.add('life', 4); g.add('chain', 20); g.add('aware', 25); g.s.flags.crash = true; } },
        { label: '小規模にとどめ、財源を不良債権の処理に回す', note: '景気↓↓／公的資金の投入に必要な求心力が下がる',
          effect: (g) => { g.add('economy', -9); g.add('money', -5); g.add('chain', 20); g.add('aware', 25); g.add('image', 4); g.s.flags.crash = true; g.s.flags.fundBias = true; } }
      ]
    },
    {
      id: 'mq2', topic: 'bailout', title: 'MQ-2 公的資金の早期投入論', cooldown: 1, priority: 58,
      when: (s) => s.flags.crash && !s.flags.mq2,
      voices: (s) => ({
        country: '大蔵省の銀行局長：「投入は前例がありません。銀行の自主的な処理に任せるべきです」',
        people: '世論調査：「銀行に税金を使うことに反対」が7割',
        business: s.ind.bankrupt >= 1100 ? '中小企業の団体：「貸し渋りで、黒字なのに潰れる会社が出ている。銀行を何とかしてくれ」' : '銀行協会：「公的資金を受ければ、経営責任を問われる。受けたくない」'
      }),
      text: (s) => '総理が「金融機関に公的資金を入れてでも、不良債権を処理すべきだ」と発言するが、銀行業界、財界、大蔵省、世論がそろって反発する。規模を選ぶ。小さすぎれば止まらず、大きすぎれば財政と支持率が先に傷む。' +
        (donBlocks(s) ? '派閥の会合では、ドンが「銀行に税金を入れる話は、わしは聞いとらん」と釘を刺した。' : ''),
      choices: [
        { label: '投入する：小規模（約3兆円）', req: needFund(30), div: 5,
          note: (s) => '傷み↓ 批判↑（小）／取りこぼしが出やすい' + donNote(s), effect: (g) => { g.s.flags.mq2 = true; g.inject(3); } },
        { label: '投入する：中規模（約8兆円）', req: needFund(50), div: 8,
          note: (s) => '傷み↓↓ 財政↓ 批判↑' + donNote(s), effect: (g) => { g.s.flags.mq2 = true; g.inject(8); } },
        { label: '投入する：大規模（約16兆円）', req: needFund(65), div: 12,
          note: (s) => '連鎖倒産はほぼ止まる。財政↓↓↓ 批判↑↑ 支持率↓' + donNote(s), effect: (g) => { g.s.flags.mq2 = true; g.inject(16); } },
        { label: '先に党内の根回しに回る（金30億・求心力+12、来月もう一度判断する）', req: (s) => (s.flags.lobby || 0) >= 2 ? '根回しはこれ以上効かない' : (s.v.money < 30 ? '金が足りない' : null),
          note: '時間がかかる。その間も傷みは増える', div: 0,
          effect: (g) => { g.add('money', -30); g.add('lead', 12); g.add('tie', 4); g.s.flags.lobby = (g.s.flags.lobby || 0) + 1; } },
        { label: '反対する（銀行業界と大蔵省の側に付く）', hist: true, note: '献金↑ しがらみ↑ ドンとの関係↑／傷みは放置される',
          effect: (g) => { g.s.flags.mq2 = true; g.s.flags.refused = true; g.add('money', 12); g.add('tie', 6); g.add('donRel', 5); } }
      ]
    },

    // ---- 連鎖と泥沼 ----
    {
      id: 'chain', topic: 'bailout', title: 'E1-18 連鎖倒産', cooldown: 4, tension: true, priority: 55,
      when: (s) => s.v.chain >= 8 && s.inj.count === 0,
      voices: (s) => ({
        country: '主計局長：「破綻の処理には、預金保険の資金が足りません」',
        people: '地元の工務店の妻：「主人の会社が、取引先の倒産に巻き込まれました」',
        business: '商工会議所：「月' + s.ind.bankrupt + '件の倒産です。次はどこか、みんな怯えています」'
      }),
      text: '弱い銀行が倒れると、その銀行から借りていた不動産会社が倒れ、下請けの建設会社や商店が倒れる。取引先の信用不安が次の銀行に飛び火する。頭取が青ざめて来る。「うちの取引先の4社が、同じ週に手形を落とせません」。',
      choices: [
        { label: '連鎖を止めるため、公的資金を入れる（約3兆円）', req: needFund(30), note: (s) => '今から入れる。遅れた分、傷みは深い' + donNote(s),
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
      id: 'more', topic: 'bailout', title: 'E1-19 追加投入の判断（泥沼）', cooldown: 3, tension: true, priority: 56,
      when: (s) => s.inj.count >= 1 && s.inj.count < 3 && s.v.chain >= 5 && s.v.damage >= 45 && s.t - s.inj.last >= 2,
      text: '総理は言う。「あと少しで止まる」。党内は割れる。「ここで止めたら、これまでの金は無駄になる」「いや、もう止めよう」。大蔵省の担当者が示す追加の額は、前回より大きい。逐次投入は効果が7割になり、批判が積み重なる。',
      choices: [
        { label: '追加で投入する（約3兆円）', req: needLead(25), note: '効果は7割・批判が加算される', effect: (g) => { g.inject(3); } },
        { label: '一気に大規模に切り替える（約14兆円）', req: needFund(55), div: 8, note: '割増なし。財政↓↓ 批判↑↑',
          effect: (g) => { g.s.flags.bigbang = true; g.s.flags.media = true; g.inject(14, { nodisc: true }); } },
        { label: '投入を打ち切り、破綻整理に移る', note: '景気↓↓（短期）批判は消える',
          effect: (g) => { g.add('economy', -7); g.add('life', -4); g.add('damage', -6); g.add('backlash', -15); g.add('lead', 2); g.s.v.chain *= 0.4; g.s.flags.liquidate = true; g.s.inj.count = 3; g.s.flags.media = true; } },
        { label: '（何もしない）', effect: (g) => { g.add('damage', 5); } }
      ]
    },
    {
      id: 'media', topic: 'bailout', title: 'E1-20 マスコミバッシングと最後の決断', once: true, tension: true, priority: 57,
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
      id: 'bash', title: 'E1-17 救済へのバッシング', cooldown: 6, tension: true, priority: 52,
      when: (s) => s.v.backlash >= 35,
      text: '見出しが「銀行を税金で救うのか」に変わる。住宅ローンに苦しむ人、救済から外れた取引先、経営努力をしてきた同業の他行からも「なぜあの銀行だけ」と不満が出る。党本部の電話が鳴り止まない。',
      choices: [
        { label: '経営陣の責任追及と、給与・配当の制限を条件にする', note: '批判↓ 資金調達力↓（業界が反発）モラル↓',
          effect: (g) => { g.add('backlash', -14); g.add('funding', -10); g.add('moral', -8); g.add('tie', -4); g.add('image', 4); } },
        { label: '条件を付けず、混乱を抑えることを優先する', note: '党の支持率↓ モラル↑',
          effect: (g) => { g.add('party', -5); g.add('moral', 6); } },
        { label: '中小企業向けの資金繰り支援も同時に出す', note: '財政↓ 批判↓ 地元の支持↑',
          effect: (g) => { g.add('fiscal', -3); g.add('backlash', -12); g.add('local', 4); } },
        { label: '自ら党と街頭で説明に立つ', note: '時間と金を使う。批判が少し和らぐ。世間の危機認識↑',
          effect: (g) => { g.add('backlash', -7); g.add('lead', 2); g.add('money', -3); g.add('aware', 6); } },
        { label: '（何もしない）', hist: true, effect: (g) => { g.add('party', -3); } }
      ]
    },
    {
      id: 'fund', title: 'E1-21 資金の枯渇', once: true, priority: 53,
      when: (s) => s.v.funding <= 70 && s.t >= 6,
      text: (s) => '財界の会合から、名前が消える。' + (s.flags.donCut ? '「権藤先生に逆らった人には、ちょっと」。' : '「銀行を救った政権に出す金はない」「救われなかった側が怒っている」。') +
        'パーティ券の売れ行きが落ち、企業献金の約束が取り消される。鬼塚が帳簿を持ってくる。「先生、このままでは選挙が持ちません」。',
      choices: [
        { label: '経費を削り、後援会の個人献金と小口のパーティで回す', note: '苦しいがきれいなまま',
          effect: (g) => { g.add('money', 5); g.add('local', 2); g.add('tie', -3); g.add('image', 3); g.s.flags.cleanFund = true; } },
        { label: '派閥の長老に頭を下げ、資金を借りる', note: '金↑ しがらみ↑↑ 求心力↓ ドンとの関係↑',
          effect: (g) => { g.add('money', 35); g.add('tie', 12); g.add('lead', -3); g.add('donRel', 6); } },
        { label: '机の中の裏金リストに手を出す', note: '金↑↑ スキャンダル↑↑（後で響く） 仁科の忠誠↑',
          effect: (g) => { g.add('money', 50); g.add('scandal', 18); g.add('nishina', 5); g.s.flags.blackfund = true; } },
        { label: '献金に頼らない政治改革を進める', note: '支持率↑（小）金↓ 求心力↑ 改革派の評価↑',
          effect: (g) => { g.add('party', 2); g.add('money', -10); g.add('lead', 3); g.add('image', 8); g.add('reform', 4); g.s.flags.reform = true; } },
        { label: '（何もしない）', hist: true, effect: (g) => { g.add('money', -10); } }
      ]
    },

    // ---- ドンをめぐる政局（第1章の縦糸） ----
    {
      id: 'e107', title: 'E1-07 ドンの献金疑惑', once: true, priority: 62,
      when: (s) => s.don.status === 'active' && s.v.donScandal >= 55,
      text: (s) => '大手運送会社から権藤 嘉平への巨額の献金が、新聞の一面に載る。父もこの会社と付き合いがあった。派閥の会合で、ドンは「知らん。秘書が勝手にやったことだ」と笑う。仁科がこちらの顔を見ている。' +
        (s.flags.blackmail ? '屋敷での脅しを、ドンは忘れていない。' : ''),
      choices: [
        { label: 'ドンを擁護する', hist: true, note: '求心力↑（派閥内） ドンとの関係↑ 仁科の忠誠↑ 党の支持率↓ 改革派の評価↓／疑惑の膨らみが遅くなる。逮捕されれば巻き込まれる',
          effect: (g) => { const s = g.s; s.flags.e107 = true; s.flags.defended = true; g.add('lead', 4); g.add('donRel', 10); g.add('nishina', 10); g.add('party', -3); g.add('image', -6); g.add('donScandal', -4); g.add('reform', 8); } },
        { label: '距離を置く', note: '変化は小さい。ドンとの関係↓',
          effect: (g) => { g.s.flags.e107 = true; g.s.flags.distanced = true; g.add('donRel', -8); g.add('image', 3); g.add('reform', 10); } },
        { label: '捜査への協力や、党内での追及に回る', note: '改革派の評価↑↑ 求心力↓↓ ドンとの関係↓↓↓ 仁科の忠誠↓↓／疑惑が一気に進む',
          effect: (g) => { const s = g.s; s.flags.e107 = true; s.flags.pursued = true; g.add('image', 15); g.add('lead', -10); g.add('donRel', -30); g.add('nishina', -20); g.add('donScandal', 12); g.add('reform', 14); g.add('party', 2);
            g.log('ドンが電話口で言った。「お前の父親も同じ穴の狢だった。忘れるな」', 'bad'); g.add('scandal', 5); } }
      ]
    },
    {
      id: 'e111', title: 'E1-11 ドンの議員辞職と派閥の跡目争い', once: true, priority: 63,
      when: (s) => s.don.status === 'active' && s.v.donScandal >= 72,
      text: (s) => '世論に押され、権藤 嘉平が議員を辞める。会見で頭を下げたのは一度だけだった。派閥の会長の座をめぐって、古参の葛城 恒雄と、改革派の若手リーダー御堂 隆一が争う。' +
        (s.flags.donDebt ? 'ドンからは短い電話があった。「借りは、葛城を推すことで返してもらう」。' : ''),
      choices: [
        { label: '葛城に付く', hist: true, note: 'しがらみ↑ 求心力↑（派閥内） 仁科の忠誠↑／派閥は保守派が握る。党は割れにくい',
          effect: (g) => { const s = g.s; s.don.status = 'resigned'; s.flags.katsuragi = true; g.add('tie', 8); g.add('lead', 6); g.add('nishina', 10); g.add('image', -5); g.add('reform', 6); if (s.flags.donDebt) { s.flags.debtPaid = true; g.add('donRel', 10); } } },
        { label: '御堂に付く', note: '党の支持率↑ 改革派の評価↑ 古参からの評価↓／派閥が割れる。党が割れる確率が上がる',
          effect: (g) => { const s = g.s; s.don.status = 'resigned'; s.flags.mido = true; g.add('party', 2); g.add('image', 10); g.add('nishina', -5); g.add('reform', 8);
            if (s.flags.donDebt) { g.add('donRel', -20); g.add('tie', 6); g.log('ドンへの借りを踏み倒した。権藤派の古参が冷たくなった', 'bad'); } } },
        { label: '自ら跡目に名乗りを上げる（金40億）', req: (s) => s.v.lead < 58 ? '求心力が足りない（58以上が必要）' : (s.v.money < 40 ? '金が足りない' : null), div: 8,
          note: '求心力と改革派の評価しだいで成否が分かれる。成功すれば派閥の会長（第1章の最大の出世）、失敗すれば求心力↓↓',
          effect: (g) => { const s = g.s; s.don.status = 'resigned'; g.add('money', -40);
            if (s.v.lead + s.v.image * 0.4 + (s.v.nishina >= 60 ? 6 : 0) >= 80) { s.flags.factionHead = true; g.add('lead', 15); g.add('tie', 6); g.log('派閥の会長に選ばれた。38歳の会長は派閥の歴史で初めてだ', 'delayed'); }
            else { g.add('lead', -15); g.add('donRel', -10); g.log('名乗りは数が足りずに潰れた。「若すぎる」と笑われた', 'bad'); } } }
      ]
    },
    {
      id: 'e116', title: 'E1-16 父の死の夜の真相', once: true, priority: 61,
      when: (s) => (s.don.status === 'resigned' && s.t - s.last.e111 >= 2) || (s.don.status === 'active' && s.t >= 25),
      text: (s) => {
        const heard = s.v.nishina >= 50;
        const base = heard
          ? '仁科が、ようやく口を開く。「先生。お父上が倒れた夜、赤坂の料亭でお会いになっていたのは、権藤先生です。お父上は、あの手帳のとおり、銀行の傷を今のうちに表に出そうと頼んでおられた。権藤先生は首を縦に振らなかった。お父上は、その帰りの車で倒れられたのです」。'
          : '週刊誌の見出しに父の名前がある。「故・真壁龍三郎、死の直前に権藤氏と密談」。記事は、父が不良債権の早期処理を持ちかけ、ドンが拒んだと書いている。仁科は何も言わなかった。';
        return base + (s.flags.persuadeFailed ? '屋敷でドンが漏らした「あの夜」の意味が、今わかる。' : '');
      },
      choices: [
        { label: (s) => s.don.status === 'arrested' ? 'ドンに面会し、問いただす' : 'ドンに問いただす', note: (s) => s.don.status === 'arrested' ? '本音を聞くだけ' : 'ドンとの関係が残っていれば、ドンは父に詫び、反対をやめる。関係が冷えていれば、口止めの取引を持ちかけられる（受ける：金↑ しがらみ↑）',
          effect: (g) => { magazine(g); const s = g.s; s.flags.asked = true;
            if (s.don.status === 'arrested') { g.log('面会室のドンは小さく見えた。「龍三郎が正しかった。言えるのはそれだけだ」', 'delayed'); return; }
            if (s.v.donRel >= 45) { s.don.stance = 'neutral'; g.add('donRel', 5); g.log('ドンは長く黙ってから言った。「あいつに詫びる。銀行の件は、もう止めん」', 'delayed'); }
            else { g.add('money', 30); g.add('tie', 10); s.flags.hush = true; g.log('ドンは封筒を差し出した。「昔の話だ。墓まで持っていけ」。受け取った', 'bad'); } } },
        { label: '胸にしまう', hist: true, note: '仁科の忠誠↑', effect: (g) => { magazine(g); g.add('nishina', 10); } },
        { label: '公表する', req: (s) => s.v.nishina >= 50 ? null : '仁科から聞いていないので、裏付けがない', div: 6,
          note: '党の支持率↑ 改革派の評価↑ 求心力↓↓（ドン派から） 仁科の忠誠↓／政治改革の世論が高まる',
          effect: (g) => { const s = g.s; s.flags.publish = true; g.add('party', 3); g.add('image', 10); g.add('lead', -12); g.add('nishina', -10); g.add('reform', 12); g.add('donScandal', 10); g.add('donRel', -25); } }
      ]
    },
    {
      id: 'e112', title: 'E1-12 ドンの逮捕', once: true, tension: true, priority: 60,
      when: (s) => s.don.status === 'resigned' && s.t - s.last.e111 >= 3 &&
        (s.flags.pursued || s.flags.publish || s.v.nishina <= 10 || s.v.party <= 42 || s.v.donScandal >= 88),
      text: (s) => '権藤 嘉平が脱税の容疑で逮捕される。自宅の金庫から金の延べ棒が見つかったと、テレビが繰り返し流す。世論が激しく怒り、選挙制度と政治資金の「政治改革」を求める声が一気に高まる。' +
        (s.flags.defended ? '献金疑惑のとき、あなたがドンを擁護した映像も流れている。' : ''),
      choices: [
        { label: '政治改革の法案を党内で推し進める', note: '党の支持率↑ 改革派の評価↑ 長老からの評価↓↓／党内で改革がまとまれば、党は割れにくい',
          effect: (g) => { arrest(g); g.s.flags.reformInside = true; g.add('party', 4); g.add('image', 10); g.add('lead', -6); g.add('reform', -8); } },
        { label: '党の結束を優先し、改革は先送りする', hist: true, note: '求心力↑（長老から） 党の支持率↓↓／党が割れる確率が上がる',
          effect: (g) => { arrest(g); g.add('lead', 5); g.add('party', -6); g.add('image', -6); g.add('reform', 6); } },
        { label: '（何もしない）', note: '党の支持率↓', effect: (g) => { arrest(g); g.add('party', -3); } }
      ]
    },
    {
      id: 'shadow', title: 'E1-12 ドンの院政', once: true, priority: 59,
      when: (s) => s.don.status === 'resigned' && s.t - s.last.e111 >= 4 && s.last.e112 === undefined,
      text: '検察は動かなかった。議員を辞めた権藤 嘉平は、目白の屋敷から派閥を動かし続ける。「辞めたのは議員だけだ」。政治改革の声は、少しずつ萎んでいく。',
      choices: [
        { label: '院政を受け入れ、ドンの後ろ盾を得る', note: '金↑ しがらみ↑↑ 求心力↑ ドンとの関係↑',
          effect: (g) => { g.s.don.status = 'shadow'; g.add('money', 30); g.add('tie', 12); g.add('lead', 5); g.add('donRel', 10); g.add('reform', -10); g.add('image', -6); } },
        { label: '院政から距離を置く', note: 'ドンとの関係↓ 改革派の評価↑',
          effect: (g) => { g.s.don.status = 'shadow'; g.add('donRel', -10); g.add('image', 5); g.add('reform', -6); } }
      ]
    },
    {
      id: 'nishinaLeaves', title: '仁科の辞表', once: true, priority: 64,
      when: (s) => s.v.nishina <= 30,
      text: '朝、机の上に仁科の辞表が置いてある。「お父上への御恩は、もう返し終えたと思っております」。地元の後援会長たちが、仁科の顔で集まっていたことを、あなたは知っている。',
      choices: [
        { label: '地元まで追いかけ、頭を下げて引き止める', note: '仁科の忠誠↑ 求心力↓（小）', req: (s) => s.v.money < 10 ? '金が足りない' : null,
          effect: (g) => { g.add('nishina', 20); g.add('lead', -2); g.add('money', -10); } },
        { label: '辞表を受け取る', note: '地元の支持↓↓ 資金↓／仁科からの知らせが届かなくなる',
          effect: (g) => { g.s.flags.nishinaGone = true; g.add('local', -10); g.add('funding', -8); } }
      ]
    },

    // ---- 史実にない出来事（invented：乖離度を上げない） ----
    // 型1：成功が自分で生む問題。景気の過熱と歳出の膨張で物価が上がる
    {
      id: 'inflation', title: '物価の高騰', invented: true, cooldown: 6, priority: 48,
      when: (s) => s.ind.cpi >= 4.5,
      text: (s) => '物価上昇率が年' + s.ind.cpi.toFixed(1) + '%に達した。好景気と大型の予算で、金が市中にあふれている。賃上げは追いつかず、家計は値上げの分だけ苦しくなる。',
      voices: (s) => ({
        country: '日銀の理事：「このままでは物価が止まりません。金利を上げさせていただきたい」',
        people: '主婦：「スーパーの値札が毎月変わる。給料は去年と同じなのに」',
        business: '経営者：「金利を上げられたら、設備投資の計画は全部止まる」'
      }),
      choices: [
        { label: '日銀の利上げを容認する', note: '物価↓↓ 成長率 約−1.2% 株価↓ 倒産↑（小）',
          effect: (g) => { g.add('infl', -18); g.add('economy', -4); g.add('damage', 2); } },
        { label: '歳出を絞って景気を冷ます', note: '物価↓ 赤字 約−2.4兆円/年 地元の支持↓／治水などの工事も止まる',
          effect: (g) => { g.add('infl', -10); g.add('fiscal', 3); g.add('local', -3); g.add('bousai', -6); } },
        { label: '公共料金を凍結し、生活必需品に補助を出す', note: '暮らし↑ 党の支持率↑ 赤字 約+2.4兆円/年／物価の圧力はかえって残る',
          effect: (g) => { g.add('life', 4); g.add('party', 2); g.add('fiscal', -3); g.add('infl', 2); } },
        { label: '（何もしない）', note: '暮らし↓ 物価はさらに上がる', effect: (g) => { g.add('life', -3); g.add('infl', 4); } }
      ]
    },
    {
      id: 'riot', title: '物価高騰への抗議が暴動に', invented: true, tension: true, once: true, priority: 66,
      when: (s) => s.ind.cpi >= 6 || (s.ind.cpi >= 5 && s.v.life < 45),
      text: (s) => '灯油と米の値上がりに抗議するデモが、大阪で暴徒化した。商店のシャッターが壊され、機動隊が出動する。物価上昇率は年' + s.ind.cpi.toFixed(1) + '%。テレビは「好景気の陰で」と繰り返す。',
      voices: (s) => ({
        country: '警察庁：「首都圏に広がる前に、強い姿勢を見せるべきです」',
        people: '日雇いの労働者：「景気がいいのは株を持ってる連中だけだ」',
        business: '商店会：「店を壊された。補償はどうなるんだ」'
      }),
      choices: [
        { label: '機動隊で鎮め、物価対策を約束する', note: '求心力↑（小） 党の支持率↓ 物価↓（小）',
          effect: (g) => { g.add('lead', 2); g.add('party', -4); g.add('infl', -5); g.add('image', -3); } },
        { label: '緊急の生活支援金を配る', note: '暮らし↑ 党の支持率↑ 赤字 約+4.8兆円/年／物価の圧力は増す',
          effect: (g) => { g.add('life', 6); g.add('party', 2); g.add('fiscal', -6); g.add('infl', 4); } },
        { label: '日銀に大幅な利上げを求め、物価を力ずくで抑える', note: '物価↓↓↓ 成長率 約−2.4% 倒産↑',
          effect: (g) => { g.add('infl', -30); g.add('economy', -8); g.add('damage', 4); g.add('party', -2); } },
        { label: '（何もしない）', note: '党の支持率↓↓ 地元の支持↓ 暮らし↓', effect: (g) => { g.add('party', -8); g.add('local', -5); g.add('life', -4); } }
      ]
    },

    // 型2：外からの衝撃。起きるかどうかは語り部（chance）が決め、被害の大きさは防災力で決まる
    {
      id: 'levee', title: '首都の治水計画', invented: true, once: true, priority: 25,
      when: (s) => s.t >= 7,
      text: '建設省の河川局長が来る。「荒川と隅田川の堤防の補強が、予算不足で計画の6割で止まっています。地下に巨大な放水路を掘る構想もありますが、10年がかりで、1兆円を超えます」。地元の道路の陳情と、同じ予算の取り合いになる。',
      voices: (s) => ({
        country: '河川局長：「大雨は毎年来るわけではありません。だから予算が付かないのです」',
        people: '江東区の町会長：「この辺りは海抜ゼロメートルだ。一度溢れたら、二階まで水が来る」',
        business: '地元の建設業者：「放水路より、うちの県の道路を先にお願いしますよ」'
      }),
      choices: [
        { label: '堤防の補強と地下放水路に予算を付ける', note: '防災力↑↑ 赤字 約+2.4兆円/年 地元の支持↓（小）',
          effect: (g) => { g.add('bousai', 28); g.add('fiscal', -3); g.add('local', -2); g.s.flags.levee = true; } },
        { label: '堤防の補強だけ進める', note: '防災力↑ 赤字 約+0.8兆円/年',
          effect: (g) => { g.add('bousai', 12); g.add('fiscal', -1); } },
        { label: 'その予算を地元の道路に回す', note: '地元の支持↑ しがらみ↑ 防災力↓',
          effect: (g) => { g.add('local', 4); g.add('tie', 3); g.add('bousai', -8); g.add('money', 5); } }
      ]
    },
    {
      id: 'flood', title: '首都の大水害', invented: true, tension: true, once: true, priority: 70,
      // 語り部：9か月目以降、波乱のない月が8か月を超えると、月ごとの確率が上がっていく
      chance: (s) => s.t < 9 ? 0 : 0.004 + Math.max(0, (s.t - s.lastTension) - 8) * 0.004,
      when: (s) => s.shock.flood !== undefined,
      // 被害は選ぶ前に出る。大きさは防災力で決まる
      onStart: (g) => {
        const b = g.s.v.bousai;
        if (b >= 65) { g.add('economy', -1); return; }
        if (b >= 45) { g.add('economy', -4); g.add('life', -3); g.add('fiscal', -2); return; }
        g.add('economy', -9); g.add('life', -7); g.add('fiscal', -4); g.add('damage', 4); g.add('aware', 8);
        g.log('首都の機能が麻痺した。株式市場も止まった', 'bad');
      },
      text: (s) => {
        const b = s.v.bousai;
        if (b >= 65) return '大型の台風が関東を直撃した。荒川は計画高水位を超えたが、補強した堤防と地下の放水路が持ちこたえた。浸水は一部の低地にとどまり、首都の機能は1日で戻った。河川局長が電話で言う。「間に合いました」。';
        if (b >= 45) return '大型の台風が関東を直撃した。隅田川沿いの低地が浸水し、地下鉄の一部の駅に水が流れ込んだ。都心の交通は3日止まり、企業の本社機能も混乱している。';
        return '大型の台風が関東を直撃した。荒川の堤防が決壊し、江東・墨田・江戸川の低地が水に沈んだ。地下鉄は水没し、霞が関と大手町の機能が麻痺した。証券取引所も閉まり、首都が止まった。';
      },
      voices: (s) => ({
        country: s.v.bousai >= 65 ? '河川局長：「放水路がなければ、都心が沈んでいました」' : '主計局長：「復旧には' + (s.v.bousai >= 45 ? '数兆円' : '10兆円を超える額') + 'が要ります。補正予算を組むしかありません」',
        people: s.v.bousai >= 65 ? '下町の住民：「床下で済んだ。堤防に感謝だ」' : '避難所の住民：「家も車も水の下だ。いつ帰れるのか」',
        business: s.v.bousai >= 65 ? '経済団体：「首都の備えが、海外の投資家の評価を上げた」' : '大手企業の総務部長：「本社機能を大阪に移す検討を始めました」'
      }),
      choices: [
        { label: '補正予算で復旧を急ぐ', note: (s) => s.v.bousai >= 65 ? '被害は小さい。赤字 約+1.6兆円/年 党の支持率↑（小）' : '赤字 約+6.4兆円/年 党の支持率↑／半年後に復旧の需要で景気が戻る',
          effect: (g) => { const big = g.s.v.bousai < 65; g.add('fiscal', big ? -8 : -2); g.add('party', big ? 3 : 1); if (big) g.later(6, '復旧の工事が進み、景気が戻り始めた', (h) => h.add('economy', 4)); } },
        { label: '首都機能の分散を打ち出す', note: '改革派の評価↑ 赤字 約+3.2兆円/年 技術力↑（小）／地元の支持↑（地方への移転を期待される）',
          effect: (g) => { g.add('image', 6); g.add('fiscal', -4); g.add('tech', 2); g.add('local', 3); g.s.flags.decentral = true; } },
        { label: '被災者の生活支援を最優先する', note: '暮らし↑ 党の支持率↑ 赤字 約+3.2兆円/年',
          effect: (g) => { g.add('life', 4); g.add('party', 4); g.add('fiscal', -4); } },
        { label: '（何もしない）', note: '党の支持率↓↓ 暮らし↓', effect: (g) => { g.add('party', -8); g.add('life', -5); } }
      ]
    },

    // ---- 章の終わり ----
    {
      id: 'e113', title: 'E1-13 内閣不信任案', once: true, priority: 90,
      when: (s) => s.t >= 26 && splitPressure(s) >= 15,
      text: (s) => '野党が内閣不信任案を出す。与党の中から「政治改革を先送りする内閣は信任できない」という声が上がり、御堂 隆一が造反を口にし始めた。' +
        (splitPressure(s) >= 35 ? '造反の数は、可決に届きそうだ。' : '可決に届くかどうかは、まだ分からない。あなたの一票と、あなたが連れていける議員の数が、党の行方を左右する。'),
      choices: [
        { label: '不信任案に反対し、党に残る', hist: true, note: '求心力↑（党内）',
          effect: (g) => { g.add('lead', 4); settleSplit(g, 0); } },
        { label: '不信任案に賛成し、離党して新党を作る（金40億）', req: (s) => s.v.money < 40 ? '金が足りない' : null, div: 12,
          note: '党首になる。金と人を大量に使う。選挙は改革派の評価と地元の支持で戦う',
          effect: (g) => { g.add('money', -40); g.s.flags.newParty = true; settleSplit(g, g.s.v.lead * 0.35 + 6); } },
        { label: '採決を欠席する', note: '両方から信用されない（求心力↓）',
          effect: (g) => { g.add('lead', -6); settleSplit(g, 0); } }
      ]
    },
    {
      id: 'election', title: 'E1-14 衆議院選挙（1993年7月）', once: true, priority: 100,
      when: (s) => s.t >= 27,
      text: (s) => (s.flags.partySplit ? '不信任案が可決され、解散。党が割れたままの選挙になる。' : '党は一体のまま、選挙を迎える。') +
        '選挙の費用は約60億円。ここまでの判断が、地元の支持と党の支持率と資金に現れる。',
      choices: [
        { label: '地元に張り付き、選挙区に集中する', effect: (g) => { g.add('local', 5); finishElection(g); } },
        { label: '全国の応援に回り、党の議席を守る', effect: (g) => { g.add('local', -6); g.add('party', 3); finishElection(g); } },
        { label: '（何もしない）', hist: true, effect: (g) => { finishElection(g); } }
      ]
    }
  ];

  // 父の死の夜を週刊誌で知った場合は、父の名前が出る
  function magazine(g) {
    if (g.s.v.nishina >= 50) return;
    g.add('scandal', 6); g.add('local', -4); g.log('父の名前が週刊誌に出た。地元の後援会がざわついている', 'bad');
  }

  // ドンの逮捕。巻き込まれ方は、E1-07の選択と裏金で決まる
  function arrest(g) {
    const s = g.s; s.don.status = 'arrested'; s.don.stance = 'neutral';
    g.add('reform', 25);
    let hit = 0;
    if (s.flags.defended) hit = 12 + (s.flags.blackfund || s.flags.hush ? 10 : 0);
    else if (s.flags.distanced) hit = s.flags.blackfund || s.flags.hush ? 10 : 4;
    if (s.flags.blackmail) hit += 6;
    if (hit) { g.add('scandal', hit); g.log('捜査の過程で、あなたの名前も報じられた', 'bad'); }
    if (s.flags.pursued) { g.add('party', 3); g.add('lead', -4); }
  }

  // 党が割れる圧力（W-11の簡易版）
  function splitPressure(s) {
    const f = s.flags, v = s.v;
    return v.reform * 0.5 + Math.max(0, 50 - v.party) * 0.8 + (f.mido ? 10 : 0) - (f.katsuragi ? 8 : 0) - (f.reformInside ? 15 : 0) +
      (f.publish ? 8 : 0) + (s.don.status === 'arrested' ? 6 : 0) - (s.don.status === 'shadow' ? 6 : 0);
  }
  function settleSplit(g, push) {
    const s = g.s; const p = splitPressure(s) + push;
    if (p >= 35) { s.flags.partySplit = true; g.add('party', -8); g.log('不信任案が可決された。造反組が離党し、党が割れた', 'bad'); }
    else { g.log('不信任案は否決された。党は一体のまま選挙へ向かう', 'delayed'); if (s.flags.newParty) { g.add('lead', -8); g.log('造反は数が足りなかった。少数の新党で戦うことになる', 'bad'); } }
  }

  function finishElection(g) {
    const s = g.s, v = s.v;
    v.money -= 60;
    if (v.money < 0) { v.local += v.money * 0.3; v.money = 0; g.log('資金が足りず、選挙運動が細った', 'bad'); }
    const exposed = (s.flags.blackfund || s.flags.hush) && v.scandal >= 30;
    const base = s.flags.newParty
      ? v.local * 0.85 + (v.image - 40) * 0.5 + (v.reform - 40) * 0.2 + (s.flags.partySplit ? 4 : -6)
      : v.local + (v.party - 50) * 0.5 - (s.flags.partySplit ? 5 : 0) + (v.reform >= 55 && v.image < 30 ? -4 : 0);
    const score = base - Math.max(0, v.scandal - 28) * 0.6 - (exposed ? 10 : 0);
    let partyResult;
    if (s.flags.partySplit) partyResult = v.party >= 46 ? '与党は割れたが、過半数をぎりぎり維持' : '与党が過半数を割り、政権交代へ';
    else partyResult = v.party >= 48 ? '与党が議席を守る' : (v.party >= 42 ? '与党が過半数をぎりぎり維持' : '与党が過半数を割る');
    if (s.flags.newParty) partyResult = '新党の党首として：' + partyResult;
    s.result = { score: Math.round(score), won: score >= 45, exposed: !!exposed, partyResult };
    if (exposed) g.log('裏の金の流れが選挙中に報じられた', 'bad');
    if (!s.result.won) s.over = 'lost';
  }

  const api = { events, finishElection, splitPressure };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.REB_EVENTS = api;
})(typeof window !== 'undefined' ? window : globalThis);
