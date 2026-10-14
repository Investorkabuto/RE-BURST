// 章に関係ない加点（ADD）・減点（SUB）イベント。設計は docs/events/event-items.md、第1章への当てはめは docs/events/chapter1.md の8節。
// 第1章のパラメーターで動くものだけ入れている（対米関係、人口の窓、子、年金、緩和の残高が要るものは入れない）。
// 史実にない出来事なので invented: true（選択は乖離度を上げない）。優先度は主なイベント（45以上）より低い。
(function (root) {
  'use strict';

  // ↑ ↓ の段階（numbers-draft.md の1.1〜1.3）。1=小、2=↑、3=↑↑、4=↑↑↑
  const AMT = [0, 2, 5, 10, 18];
  const MONEY = [0, 3, 10, 40, 150];     // 億円
  const SLACK = [0, 3, 8, 16, 28];       // 緩みは大きめに見積もる（第1章は28か月しかなく、緩みは年に6%しか引かない）
  const MULT = { party: 0.8, economy: 0.5, life: 0.5, tech: 0.5, fiscal: 0.5 }; // パラメーターごとの重み（1.2）
  const NAME = {
    money: '金', lead: '求心力', scandal: 'スキャンダル', tie: 'しがらみ', local: '地元の支持', party: '党の支持率', image: '改革派の評価',
    economy: '景気', life: '暮らしの実感', fiscal: '財政', tech: '技術力', slack: '緩み', reform: '政治改革の世論', funding: '資金調達力',
    staff: '人', bousai: '防災力', infl: '物価の圧力', damage: '金融の傷み', backlash: '救済への批判', chain: '連鎖倒産の勢い',
    aware: '世論の危機認識', nishina: '仁科の忠誠'
  };

  function amount(key, lv) {
    const n = Math.min(4, Math.abs(lv)), sg = lv < 0 ? -1 : 1;
    if (key === 'money') return sg * MONEY[n];
    if (key === 'slack') return sg * SLACK[n];
    if (key === 'staff') return lv;                       // 人は人数そのもの
    return sg * AMT[n] * (MULT[key] || 1);
  }
  // spec = { lead: 2, scandal: -1, ... }。正の数は ↑、負の数は ↓。1が（小）、2が ↑、3が ↑↑、4が ↑↑↑
  function apply(g, spec) { Object.keys(spec).forEach((k) => g.add(k, amount(k, spec[k]))); }
  function arrows(lv) { const n = Math.min(4, Math.abs(lv)); if (n === 1) return (lv > 0 ? '↑' : '↓') + '（小）'; return (lv > 0 ? '↑' : '↓').repeat(n - 1); }
  function noteOf(spec, extra) {
    const p = Object.keys(spec).map((k) => NAME[k] + (k === 'staff' ? (spec[k] > 0 ? '+' : '−') + Math.abs(spec[k]) : arrows(spec[k])));
    return p.join(' ') + (extra ? '／' + extra : '');
  }
  // 選択肢の部品。hist は付けない（史実の選択がない）
  function C(label, spec, extra, after, more) {
    const c = { label, note: noteOf(spec, extra), effect: (g) => { apply(g, spec); if (after) after(g); } };
    if (more) Object.assign(c, more);
    return c;
  }

  // 同じ世界・同じ月・同じイベントなら同じ結果になる乱数（0〜1）
  function roll(s, id) {
    let x = (s.seed * 2654435761) ^ (s.t * 40503);
    for (let i = 0; i < id.length; i++) x = Math.imul(x ^ id.charCodeAt(i), 16777619);
    x ^= x >>> 15; x = Math.imul(x, 2246822519); x ^= x >>> 13;
    return (x >>> 0) / 4294967296;
  }
  const F = (s, k) => s.flags[k];
  const back = (s, m, key) => { const h = s.hist; return h.length > m ? h[h.length - 1 - m].ind[key] : null; };

  // 出方の間隔：加点は4か月、減点は3か月あける。乱数で月ごとに出る確率をかける（連続して出すぎない）
  function addGate(s, id, p) { return s.t >= 4 && s.t - (s.flags.lastAdd === undefined ? -99 : s.flags.lastAdd) >= 4 && roll(s, id) < p; }
  function subGate(s, id, p) { return s.t >= 3 && s.t - (s.flags.lastSub === undefined ? -99 : s.flags.lastSub) >= 3 && roll(s, id) < p; }
  const onAdd = (g) => { g.s.flags.lastAdd = g.s.t; };
  const onSub = (g) => { g.s.flags.lastSub = g.s.t; };

  const items = [
    // ================= 加点 =================
    {
      id: 'add01', role: 'plus', title: 'ADD-01 政治資金パーティーの大盛況とノルマ超過分', invented: true, once: true, priority: 22, onStart: onAdd,
      when: (s) => addGate(s, 'add01', 0.35) && s.v.party >= 50 && s.v.economy >= 50 && s.v.funding >= 80,
      text: '都内の老舗ホテルで開いた政治資金パーティーに業界団体や企業が詰めかけ、会場から人が溢れかえった。企業側は「景気回復の波に乗り遅れたくない」と競って券を購入し、集まった資金は目標の1.5倍に達している。秘書が「ノルマを超えた余剰分をどう処理しますか」と帳簿を持ってきた。',
      choices: [
        C('収支報告書に載せず、派閥の若手への「餅代（裏金）」として配る', { money: 3, lead: 3, scandal: 3, slack: 2 }, '（中期）政治改革の世論↑', (g) => { g.s.flags.blackfund = true; g.later(12, '配った金のことが漏れ、政治改革を求める声が強まった', (h) => h.add('reform', 8)); }),
        C('全額を正式に計上し、自分の選挙区の組織固めに使う', { money: 2, local: 3, lead: -1, slack: 1 }, '他の派閥が嫉妬する', (g) => { g.later(10, '独り占めへの嫉妬が、派閥人事に出た', (h) => h.add('lead', -2)); }),
        C('余剰分は受け取らず、党本部の金庫に納める（何もしない）', { party: 1, image: 1, money: -1 }, '若手の忠誠は育たない', (g) => { g.later(10, '金に困った若手が、別の派閥の世話になり始めた', (h) => h.add('lead', -2)); })
      ]
    },
    {
      id: 'add02', role: 'plus', title: 'ADD-02 税収の上振れと「霞が関の埋蔵金」の発見', invented: true, once: true, priority: 23, onStart: onAdd,
      when: (s) => addGate(s, 'add02', 0.35) && s.v.economy >= 58 && back(s, 6, 'balance') !== null && s.ind.balance > back(s, 6, 'balance'),
      text: '企業業績の好調で法人税収が見込みを数兆円上回り、さらに特別会計の積立金に余剰（いわゆる埋蔵金）があることが判明した。財務官僚は「国債の償還に回すべきだ」と主張し、党内の族議員は「補正予算を組んで地元に配れ」と鼻息が荒い。国民の7割は「好景気の実感がまだ手取りに届いていない」と不満を抱えている。',
      voices: (s) => ({ country: '主計局長：「上振れは一時的です。国債の償還に回さなければ、次の不況で打つ手がなくなります」', people: '会社員：「景気がいいと言われても、手取りは増えていない」', business: '建設業協会：「補正予算を組んでもらえれば、地方の下請けまで潤います」' }),
      choices: [
        C('所得税・住民税の定率減税を行い、家計に直接戻す', { life: 1, party: 3, fiscal: -1, slack: 1 }, '赤字 約+1.6兆円/年／（中期）財政が傷んでいれば、国債の金利が上がり株価が下がる',
          (g) => { g.s.flags.taxCut = true; g.later(10, null, (h) => { if (h.s.v.fiscal < 48) { h.add('economy', -3); h.add('damage', 2); h.log('財政への不安から国債の金利が上がり、株価が下がった', 'bad'); } }); }),
        C('族議員の要求を呑み、地方の公共事業と業界支援に山分けする', { lead: 3, local: 2, tie: 3, fiscal: -1, slack: 3 }, '（中期）物価の圧力↑',
          (g) => { g.s.flags.pubWorks = true; g.add('infl', 4); }),
        C('手を付けず、すべて国債の償還（借金返し）に充てる（何もしない）', { fiscal: 1, lead: -3, life: -1 }, '党内から「財務省の言いなりだ」と反発／（中期）景気↓（小）',
          (g) => { g.later(12, '緊縮が続き、景気の勢いがやや鈍った', (h) => h.add('economy', -2)); })
      ]
    },
    {
      id: 'add03', role: 'plus', title: 'ADD-03 国産技術の世界シェア拡大と業界からの恩返し', invented: true, once: true, priority: 21, onStart: onAdd,
      when: (s) => addGate(s, 'add03', 0.4) && s.flags.semiR && s.v.tech >= 56,
      text: '数年前に支援した国内の先端産業が世界市場でシェア4割を握る大躍進を遂げた。関連企業の株価は急騰し、経営者団体から「先生の先見の明のおかげだ。政治献金の増額か、先生の選挙区への新研究所の建設で恩返しをしたい」と申し出があった。',
      choices: [
        C('選挙区に新研究所と関連工場を誘致してもらう', { local: 3, economy: 1, tie: 2, slack: 1 }, '（中期）技術力↑（小）', (g) => { g.s.flags.pubWorks = true; g.later(12, '誘致した研究所が動き出し、技術力が伸びた', (h) => h.add('tech', 2)); }),
        C('政治献金とパーティー券の購入を大幅に増やしてもらう', { money: 3, funding: 2, tie: 3, scandal: 1, slack: 2 }, '（中期）業界から次の見返りを求められる', (g) => { g.s.flags.industryDeal = true; }),
        C('見返りは辞退し、従業員の賃上げとさらなる研究開発に回すよう促す（何もしない）', { image: 2, money: -1, lead: -1 }, '（中期）暮らしの実感↑（小）、技術力↑（小）', (g) => { g.later(12, '賃上げと研究開発が実り、暮らしと技術力が伸びた', (h) => { h.add('life', 1); h.add('tech', 2); }); })
      ]
    },
    {
      id: 'add04', role: 'plus', title: 'ADD-04 株高による「家計の資産」急増と高額消費ブーム', invented: true, once: true, priority: 20, onStart: onAdd,
      when: (s) => addGate(s, 'add04', 0.4) && s.v.economy >= 58 && back(s, 12, 'assets') !== null && s.ind.assets - back(s, 12, 'assets') >= 40,
      text: '株式市場の活況で個人投資家や年金基金の運用益が膨らみ、家計の金融資産が過去最高を更新した。百貨店では宝飾品や高級車が飛ぶように売れ、経済界からは「この好循環を止めないよう規制緩和を」、福祉団体からは「資産を持たない低所得層との格差が広がっている」との声が上がっている。',
      choices: [
        C('さらなる株高を狙い、投資減税と市場の規制緩和を打ち出す', { economy: 1, funding: 1, slack: 3 }, '家計の資産↑／（中期）物価の圧力↑、金融の傷み↑（バブル化の火種）',
          (g) => { g.s.flags.deregulate = true; g.later(10, '株と土地の値上がりが行き過ぎ、物価と金融の足元が危うくなった', (h) => { h.add('infl', 8); h.add('damage', 3); }); }),
        C('株高の恩恵を福祉に回すため、低所得層・子育て世帯への給付金を配る', { party: 2, life: 1, fiscal: -1, slack: 2 }, '（中期）次の給付を求める声が出る',
          (g) => { g.add('infl', 2); }),
        C('市場の自然な流れに任せ、政府は特別な介入をしない（何もしない）', { fiscal: 1, lead: -1, slack: 1 }, '（中期）資産を持つ人と持たない人の差が広がり、暮らしの実感がばらつく',
          (g) => { g.later(12, '資産の格差が広がり、暮らしの不満が増した', (h) => h.add('life', -2)); })
      ]
    },
    {
      id: 'add05', role: 'plus', title: 'ADD-05 野党第一党の内紛と分裂騒動（敵失のボーナス）', invented: true, once: true, priority: 21, onStart: onAdd,
      when: (s) => addGate(s, 'add05', 0.25) && s.v.party >= 45 && s.v.reform <= 35,
      text: '野党第一党が安全保障と増税の是非をめぐって大ゲンカを始め、有力議員数名が離党届を叩きつけた。テレビのワイドショーは連日野党の泥仕合を報じ、与党にとっては労せずして支持率が上がる絶好の追い風が吹いている。',
      choices: [
        C('離党した野党議員に裏から手を回し、ポストや選挙協力を餌に与党へ引き抜く', { party: 2, lead: 2, tie: 3, image: -2, slack: 3 }, '議席↑（試作では党の支持率に反映）／野党の怨みで国会が荒れる',
          (g) => { g.later(8, null, (h) => { if (h.s.v.tie >= 35) { h.add('scandal', 4); h.log('引き抜いた議員の過去が週刊誌に出た', 'bad'); } }); }),
        C('野党が混乱している隙に、普段なら反発の強い懸案事項（歳出見直しなど）を一気に進める', { image: 2, fiscal: 1, party: -1, local: -1 }, '野党が結束し直すと、強行への反発が表に出る',
          (g) => { g.later(10, '野党が結束し直し、強行への批判が出た', (h) => h.add('party', -2)); }),
        C('高みの見物を決め込み、相手の自滅を待つ（何もしない）', { party: 3, slack: 3 }, '戦わずして勝てる空気で党内がたるむ／野党が再結集すると議席↓',
          (g) => { g.later(12, '野党が再結集し、勢いを取り戻した', (h) => h.add('party', -2)); })
      ]
    },
    {
      id: 'add06', role: 'plus', title: 'ADD-06 地元への大型物流・製造拠点の誘致成功', invented: true, once: true, priority: 21, onStart: onAdd,
      when: (s) => addGate(s, 'add06', 0.4) && s.v.local >= 50 && s.v.economy >= 50,
      text: 'あなたの選挙区に、大手企業グループが3000人規模の雇用を生む大型拠点の建設を決めた。地元の商工会は「これで商店街も生き返る」と沸き立ち、建設業界からは「関連する周辺道路の整備予算もセットで付けてほしい」と陳情が届いている。',
      choices: [
        C('周辺道路や上下水道の整備として、大型の公共事業予算もセットで付ける', { local: 4, fiscal: -1, tie: 2, slack: 2 }, '赤字 約+0.8兆円/年／（中期）工事の遅れや談合の疑いが出る', (g) => { g.s.flags.pubWorks = true; g.later(14, '工事の維持費が膨らみ、財政の重荷になった', (h) => h.add('fiscal', -1)); }),
        C('地元企業への優先発注を条件に、法人事業税の優遇措置を講じる', { local: 3, money: 2, tie: 2, slack: 1 }, '他の地域の首長が不公平だと反発する', (g) => { g.later(8, '優遇への不公平感から、周辺の首長が離れた', (h) => h.add('party', -1)); }),
        C('民間の自主的な投資として歓迎し、特別な税金投入は行わない（何もしない）', { local: 2, image: 1, lead: -1 }, '地元族議員が不満を持つ', null)
      ]
    },
    {
      id: 'add07', role: 'plus', title: 'ADD-07 若手・中堅議員からの「政策勉強会」旗揚げ要請', invented: true, once: true, priority: 21, onStart: onAdd,
      when: (s) => addGate(s, 'add07', 0.4) && s.v.lead >= 50 && s.v.image >= 40,
      text: '党内の派閥の締め付けに不満を持つ若手・中堅議員20名ほどが、「先生を座長にして、派閥横断の政策勉強会を立ち上げたい」と執務室に押しかけてきた。事実上の「自分の手勢（ミニ派閥）」を作る好機だが、既存の長老たちは警戒して目を光らせている。',
      choices: [
        C('座長を引き受け、勉強会メンバーに活動資金を配って事実上の新派閥にする', { lead: 4, money: -3, tie: 2, slack: 2 }, '（中期）資金が尽きると若手が離れる、長老が警戒する', (g) => { g.later(8, null, (h) => { if (h.s.v.money < 30) { h.add('lead', -5); h.log('資金が尽き、若手が勉強会から離れた', 'bad'); } }); }),
        C('純粋な政策研究グループとして発足させ、資金配りやポスト要求は禁じる', { lead: 2, image: 3, money: -1 }, '資金を求める若手は離れ、人数が減る', null),
        C('長老たちとの摩擦を避けるため、座長を固辞する（何もしない）', { tie: 2, lead: -2, image: -2 }, '長老からの覚えはめでたい', null)
      ]
    },
    {
      id: 'add08', role: 'plus', title: 'ADD-08 新興の資産家・経済人からの「タニマチ」申し出', invented: true, once: true, priority: 22, onStart: onAdd,
      when: (s) => addGate(s, 'add08', 0.4) && s.v.lead >= 55 && s.v.money <= 100,
      text: '時代の波に乗って急成長した新興企業のオーナー社長が、「先生のような実行力のある政治家を個人的に応援したい。選挙資金でも秘書の給与でも、必要なだけ用立てます」と申し出てきた。見返りは求めていないと言うが、周囲には危うい噂もある人物だ。',
      choices: [
        C('全面的に支援を受け入れ、資金管理団体や秘書の人件費を肩代わりしてもらう', { money: 4, funding: 2, scandal: 3, tie: 3, slack: 3 }, '（中期）社長の不祥事が発覚するおそれ', (g) => { g.s.flags.blackfund = true; g.later(9, null, (h) => { if (h.s.v.scandal >= 20) { h.add('scandal', 10); h.log('支援者の社長の不祥事が報じられ、名前が出た', 'bad'); } }); }),
        C('法定の上限内の個人献金と、公開の講演会講師料としてのみ受け取る', { money: 2, scandal: 1, slack: 1 }, '社長が見返りを求め続ける', (g) => { g.add('tie', 1); }),
        C('後々の火種になると判断し、丁重に断る（何もしない）', { image: 1, money: -1 }, '資金難が続く', null)
      ]
    },
    {
      id: 'add10', role: 'plus', title: 'ADD-10 「次のリーダーにふさわしい政治家」世論調査で上位に', invented: true, once: true, priority: 21, onStart: onAdd,
      when: (s) => addGate(s, 'add10', 0.5) && s.v.image >= 55 && s.v.scandal <= 20,
      text: '全国紙の世論調査で、あなたが「クリーンで実行力のある次世代リーダー」の上位に選出された。テレビ出演や講演の依頼が殺到し、選挙の顔として全国の若手議員から応援演説の要請が相次いでいる。一方で、党内の実力者たちは出る杭を打とうと身辺調査を始めている。',
      choices: [
        C('メディアに連日出演して党の古い体質を批判し、世論の支持を一気に固める', { party: 3, image: 3, lead: -3, slack: 2 }, '党内長老・族議員の猛反発', null),
        C('全国の接戦区へ応援演説に回り、若手議員たちに恩を売る', { lead: 3, party: 2, money: -2, local: -1 }, '地元を留守にするため地元の支持↓（小）', null),
        C('「今は目の前の仕事に専念する」と露出を控える（何もしない）', { local: 2, lead: 1, image: -1 }, '謙虚さが長老に好感される', null)
      ]
    },
    {
      id: 'add11', role: 'plus', title: 'ADD-11 地方首長・地方議会からの一斉支持と組織票の固まり', invented: true, once: true, priority: 20, onStart: onAdd,
      when: (s) => addGate(s, 'add11', 0.4) && s.v.local >= 62,
      text: '選挙区内の市長・町長と地方議員の8割以上が、次期選挙でのあなたの推薦状と後援会組織の全面稼働を決定した。「先生がいなければ地域のインフラも医療も守れない」と強固な地盤が出来上がっているが、同時に「先生の看板なら何をしても通る」という慢心も陣営内に漂い始めている。',
      choices: [
        C('盤石な地盤に任せ、自分の時間はすべて中央（東京）での政局と派閥工作に注ぎ込む', { lead: 3, local: -1, slack: 3 }, '地元秘書の傲慢な振る舞いが増える', (g) => { g.later(8, null, (h) => { if (h.s.v.slack >= 25) { h.add('scandal', 5); h.log('地元の秘書の傲慢な振る舞いが、地元紙に載った', 'bad'); } }); }),
        C('地方議員たちの見返り要求（補助金や小規模工事）に細かく応え、鉄壁の要塞にする', { local: 3, tie: 3, fiscal: -1, slack: 2 }, '要求が増え続ける', (g) => { g.s.flags.pubWorks = true; }),
        C('これまで通りの地元回りを続け、陣営の手綱を締め直す（何もしない）', { local: 1, money: -1, slack: -1 }, '会合・維持費がかかる', null)
      ]
    },
    {
      id: 'add13', role: 'plus', title: 'ADD-13 有能な官僚・民間スペシャリストからの「逆指名」参画', invented: true, once: true, priority: 20, onStart: onAdd,
      when: (s) => addGate(s, 'add13', 0.4) && (s.v.lead >= 52 || s.v.image >= 50) && s.flags.nishinaGone !== true,
      text: 'あなたの政策手腕に惚れ込んだ現役の若手エリート官僚と民間の著名エコノミストが、「先生の政策ブレーン（または次期選挙の公認候補）として陣営に加わりたい」と志願してきた。迎え入れれば陣営の能力は跳ね上がるが、古参の秘書や既存の陣営スタッフは「外様に美味しいところを奪われる」と警戒している。',
      choices: [
        C('高待遇で迎え入れ、政策立案と選挙戦略の中枢を任せる', { staff: 1, money: -2, nishina: -1, slack: 1 }, '古参の秘書の忠誠が下がる。忠誠が低いままだと、情報が外に漏れる', (g) => { g.later(10, null, (h) => { if (h.s.v.nishina < 45) { h.add('scandal', 6); h.log('古参の秘書が不満から、事務所の内情を週刊誌に漏らした', 'bad'); } }); }),
        C('無報酬の外部アドバイザー（非常勤）としてのみ知恵を借りる', { image: 2, lead: 1, tie: 1 }, '官庁との貸し借りができる', null),
        C('古参スタッフの顔を立て、丁重に断る（何もしない）', { nishina: 1, local: 1, image: -1 }, '陣営の能力は伸びない', null)
      ]
    },
    {
      id: 'add14', role: 'plus', title: 'ADD-14 全国業界団体からの「組織票10万票と献金」の一括パッケージ', invented: true, once: true, priority: 21, onStart: onAdd,
      when: (s) => addGate(s, 'add14', 0.4) && s.v.tie >= 35 && s.v.economy >= 48,
      text: '全国の店舗・事業所を束ねる有力な業界団体の会長が訪ねてきた。「先生が我々の業界の規制緩和（新規参入の阻止）を守ってくれるなら、全国の会員に号令をかけて組織票とパーティー券購入をフル回転させる」と具体的な数字を提示している。',
      choices: [
        C('取引に応じ、新規参入を阻む議員立法（または行政指導）を約束する', { money: 3, party: 2, tie: 4, image: -3, slack: 3 }, '（中期）技術力↓（小）、規制の維持が露見するおそれ', (g) => { g.s.flags.regDeal = true; g.later(14, '新規参入が止まり、産業の新陳代謝が鈍った', (h) => h.add('tech', -2)); }),
        C('規制維持の約束はぼかし、業界向けの補助金予算を付けることで手打ちにする', { money: 2, local: 2, fiscal: -1, tie: 2, slack: 2 }, '補助金は翌年も求められる', (g) => { g.s.flags.pubWorks = true; }),
        C('特定の業界だけを優遇することはできないと断る（何もしない）', { image: 2, tie: -2, funding: -2 }, '業界が野党の支援に回る', null)
      ]
    },

    // ================= 減点 =================
    {
      id: 'sub01', role: 'minus', title: 'SUB-01 派閥の資金の流れの記載漏れと内部告発', invented: true, once: true, priority: 40, onStart: onSub,
      when: (s) => subGate(s, 'sub01', 0.5) && s.v.scandal >= 30 && s.v.tie >= 40,
      text: '退職した元会計担当者が、派閥の資金の流れに記載漏れがあったことを示す内部の帳簿のコピーを週刊誌に持ち込んだ。国民の8割が「自分たちは増税と社会保険料で苦しんでいるのに、政治家は裏でお金をやりとりしているのか」と激怒し、捜査当局も関心を示している。',
      choices: [
        C('会計責任者（秘書）の「事務的なミス」として処理させ、収支報告書を訂正して幕引きを図る', { staff: -1, party: -3, reform: 3, scandal: -1 }, '辞めた秘書が後に暴露するおそれ', (g) => { g.later(10, null, (h) => { if (h.s.v.nishina < 45) { h.add('scandal', 8); h.log('辞めた秘書が、事務所の内情を語り始めた', 'bad'); } }); }),
        C('自らの関与を認めて裏金分を全額国庫（または慈善団体）へ寄付し、派閥の解消と監査導入を宣言する（痛みを伴う処置）', { money: -3, lead: -3, scandal: -3, image: 3, tie: -3 }, '派閥の幹部が離れ、造反が起きやすくなる', (g) => { g.s.flags.blackfund = false; g.s.flags.hush = false; g.later(10, null, (h) => { if (h.s.v.lead < 35) { h.add('party', -3); h.log('離れた派閥の幹部が、党内で足を引っ張り始めた', 'bad'); } }); }),
        C('「法律上の問題はない」と突っぱね、一切の処分を行わない（何もしない）', { party: -4, local: -3, scandal: 3, reform: 4 }, null, null)
      ]
    },
    {
      id: 'sub02', role: 'minus', title: 'SUB-02 非公開会合での「差別・被災地軽視」暴言音声の流出', invented: true, once: true, priority: 40, onStart: onSub,
      when: (s) => subGate(s, 'sub02', 0.5) && s.v.slack >= 35,
      text: '地元の資金集めパーティーの酒席で、配下の有力議員（または大臣）が「あんな地方がどうなろうと知ったことか」「子どもを産まない人間は国賊だ」と放言した録音データがメディアに流出した。野党は一斉に辞任を要求し、スポンサー企業からも「こんな政党には献金できない」と抗議が殺到している。',
      choices: [
        C('発言者を即座に更迭（または離党勧告）し、あなたが記者会見で深々と頭を下げる（痛みを伴う処置）', { staff: -1, lead: -2, scandal: -1, image: 2, slack: -3 }, '更迭した議員が離党して野党に回る', (g) => { g.later(6, '更迭した議員が離党し、野党に回った', (h) => h.add('party', -1)); }),
        C('「前後の文脈を切り取られたものだ」と発言を撤回させ、役職には留任させる', { party: -3, funding: -2, slack: 2 }, null, null),
        C('会見を開かず、ほとぼりが冷めるまで徹底的に無視する（何もしない）', { party: -4, life: -1, scandal: 2 }, '世論の反感', null)
      ]
    },
    {
      id: 'sub03', role: 'minus', title: 'SUB-03 公用車の私的利用と私的な関係への政治資金流用疑惑', invented: true, once: true, priority: 40, onStart: onSub,
      when: (s) => subGate(s, 'sub03', 0.5) && s.v.slack >= 30 && s.v.money >= 80,
      text: '水曜日の夕方、写真週刊誌から取材質問状が届いた。あなた（または側近の幹部）が公務と偽って公用車で私的な訪問を重ね、その費用を資金管理団体の「調査研究費」から支出していた証拠写真があるという。発売は明日だ。',
      choices: [
        C('広告代理店と出版社幹部に裏から手を回し、巨額の工作費で記事を差し止めさせる', { money: -3, tie: 3, scandal: -1 }, '（中期）記事が再燃し、工作費の支出が露見するおそれ', (g) => { g.s.flags.hush = true; g.later(9, null, (h) => { if (roll(h.s, 'sub03r') < 0.6) { h.add('scandal', 12); h.log('差し止めたはずの記事が、別の雑誌から再燃した', 'bad'); } }); }),
        C('事実を認めて公金を全額私費で返還し、役職を辞して家族と共に地元へ謝罪行脚に出る（痛みを伴う処置）', { money: -2, lead: -3, party: -2, local: 1, scandal: -3, image: 1 }, '同情票で地元の下げ止まり', null),
        C('「政策の打ち合わせをしていただけで、私的な関係はない」とコメントを出す（何もしない）', { party: -3, local: -3, scandal: 3 }, '翌月、続報が出る', (g) => { g.later(1, '続報が出て、疑惑がさらに広がった', (h) => h.add('scandal', 4)); })
      ]
    },
    {
      id: 'sub04', role: 'minus', title: 'SUB-04 公共事業の談合と謝礼の包みをめぐる収賄疑惑', invented: true, once: true, priority: 40, onStart: onSub,
      when: (s) => subGate(s, 'sub04', 0.5) && s.v.tie >= 45 && s.flags.pubWorks,
      text: '地方の大型インフラ工事をめぐり、談合で摘発された中堅ゼネコンの社長室から「政界工作メモ」が押収された。そこにあなたの事務所の名前と、謝礼の包みとして数千万円を渡した記録が記されていたと新聞の一面で報じられた。',
      choices: [
        C('「秘書が勝手に受け取り、裏で処理していた」として担当秘書をクビにして検察に突き出す', { staff: -1, local: -3, scandal: -1 }, '秘書の忠誠が30未満なら法廷で暴露され、スキャンダル↑↑↑', (g) => { if (g.s.v.nishina < 30) { g.add('scandal', 18); g.log('秘書が法廷で、事務所の指示だったと語った', 'bad'); } }),
        C('第三者委員会を立ち上げて過去の献金をすべて洗い出し、建設業界との癒着を断ち切る（痛みを伴う処置）', { money: -3, local: -3, scandal: -3, image: 3, tie: -3 }, '建設業界が離れ、地方の景気が冷える', (g) => { g.s.flags.pubWorks = false; g.later(6, '建設業界が離れ、地方の景気が冷えた', (h) => h.add('economy', -1)); }),
        C('「事実無根の怪文書だ」と全面否定し、法廷闘争を宣言する（何もしない）', { money: -2, party: -3, scandal: 3 }, '弁護士費用がかかる', null)
      ]
    },
    {
      id: 'sub07', role: 'minus', title: 'SUB-07 株安・地価下落による「家計の資産」蒸発と消費氷河期', invented: true, once: true, priority: 41, onStart: onSub,
      when: (s) => subGate(s, 'sub07', 0.6) && back(s, 12, 'assets') !== null && s.ind.assets <= back(s, 12, 'assets') - 80 && s.v.damage >= 35,
      text: '株価と土地の下落が止まらず、家計の資産が数十兆円単位で吹き飛んだ。住宅ローンの担保割れに苦しむサラリーマン世帯が財布の紐を固く締め、商店街ではシャッターを下ろす店が相次いでいる。中小企業団体からは「このままでは年末を越せない」と悲鳴が上がっている。',
      choices: [
        C('不良債権を抱える金融機関の破綻処理と公的資金投入を断行し、ウミを出し切る（痛みを伴う処置）', { damage: -3, backlash: 3, party: -3, image: 3 }, '（中期）景気↑、家計の資産↑／公的資金の批判が高まる',
          (g) => { g.s.flags.liquidate = true; g.later(10, '膿を出し切った効果で、景気と資産が持ち直した', (h) => { h.add('economy', 3); h.add('damage', -4); }); }),
        C('中小企業向けの信用保証枠を広げ、大型の公共事業を組んで当面の倒産を防ぐ', { chain: -2, local: 2, fiscal: -2, damage: 1 }, '問題の先送り。数年後に再燃するおそれ', (g) => { g.s.flags.pubWorks = true; g.later(12, '先送りした傷みが、じわじわと戻ってきた', (h) => h.add('damage', 4)); }),
        C('市場の自律的な調整に任せ、財政出動は控える（何もしない）', { economy: -1, life: -1, chain: 3, aware: 2 }, '連鎖倒産が勢いを増す', null)
      ]
    },
    {
      id: 'sub08', role: 'minus', title: 'SUB-08 「税金で銀行員の高給を守るのか」公的資金への大バッシング', invented: true, once: true, priority: 41, onStart: onSub,
      when: (s) => subGate(s, 'sub08', 0.6) && s.v.backlash >= 30 && s.v.life <= 52 && (s.last.bash === undefined || s.t - s.last.bash >= 4),
      text: '金融システムを守るために投入した公的資金に対し、大衆紙やテレビが「庶民がリストラと不況に苦しむ中、平均年収1000万円超の銀行員を税金で救済した」と連日キャンペーンを張っている。金融界は「これ以上叩かれれば貸し渋りをせざるを得ない」と萎縮し、党内からも「次の選挙で戦えない」と悲鳴が上がる。',
      choices: [
        C('救済対象銀行の経営陣の総退陣・私財提供と、行員給与の3割カットを強制する（痛みを伴う処置）', { backlash: -3, image: 3, funding: -3, tie: -1 }, '（中期）金融界が貸し渋りに転じ、景気↓（小）', (g) => { g.later(6, '金融界が貸し渋りに転じ、景気がやや冷えた', (h) => h.add('economy', -2)); }),
        C('批判をかわすため、一般家計向けの住宅ローン減税や商品券配布をセットで打ち出す', { backlash: -2, life: 1, fiscal: -2, slack: 1 }, '赤字 約+1.6兆円/年', null),
        C('「金融恐慌を防ぐためのやむを得ない措置だ」と正面から説明を続ける（何もしない）', { party: -3, local: -2, aware: 1 }, null, null)
      ]
    },
    {
      id: 'sub09', role: 'minus', title: 'SUB-09 特定の友好団体との選挙協力リスト流出', invented: true, once: true, priority: 39, onStart: onSub,
      when: (s) => subGate(s, 'sub09', 0.5) && s.v.tie >= 50 && s.v.reform >= 45,
      text: '活動をめぐるトラブルが社会問題化している「とある団体」の関連イベントに、あなたや党内の多数の議員が祝電を送り、選挙でボランティアや組織票の支援を受けていた内部リストが流出した。世論の8割が「説明が不十分だ」と不信感を募らせている。',
      choices: [
        C('党所属の全議員の関わりを公表して一切の関係断絶を宣言し、被害を受けた人の救済策を成立させる（痛みを伴う処置）', { local: -3, lead: -2, scandal: -3, image: 3, tie: -3 }, '組織票を失った議員が離党する', (g) => { g.later(8, '組織票を失った議員が、党を離れた', (h) => h.add('party', -1)); }),
        C('「社会的な問題があるとは認識していなかった」と釈明し、今後は距離を置くと口頭で述べるにとどめる', { party: -3, reform: 2, tie: -1 }, null, null),
        C('団体の自由と議員の政治活動の自由を理由に、調査を拒否する（何もしない）', { party: -4, scandal: 3, reform: 3 }, null, null)
      ]
    },
    {
      id: 'sub11', role: 'minus', title: 'SUB-11 選挙区での「現金入り封筒」買収リスト発覚', invented: true, once: true, tension: true, priority: 56, onStart: onSub,
      when: (s) => subGate(s, 'sub11', 0.7) && s.v.scandal >= 40 && s.v.tie >= 40,
      text: '前回の接戦選挙で、陣営の幹部が地方議員や首長ら数十名に「陣中見舞い」と称して数十万円ずつの現金入り封筒を配っていた疑いで、捜査当局が関係先の一斉家宅捜索に入った。受け取った地方議員たちが次々と「実は貰った」と自白を始め、陣営崩壊の危機が迫っている。',
      choices: [
        C('買収に関与した陣営幹部と配下議員をすべて切り捨て、自らは全財産を投じて弁護団と和解工作に充てる', { money: -4, staff: -2, local: -3, scandal: -1 }, null, null),
        C('自身の監督責任を認めて党の役職をすべて辞任し、政治資金の完全透明化を受け入れる（痛みを伴う処置）', { lead: -4, funding: -3, scandal: -3, image: 2, tie: -3 }, null, (g) => { g.s.flags.blackfund = false; g.s.flags.hush = false; }),
        C('「陣営の会計には一切関与しておらず、全く知らない」とシラを切り通す（何もしない）', { party: -4, scandal: 4 }, '崖っぷち。さらに悪化するおそれ', null)
      ]
    },
    {
      id: 'sub12', role: 'minus', title: 'SUB-12 「政治とカネ」に愛想を尽かした経済界からの献金凍結通告', invented: true, once: true, priority: 40, onStart: onSub,
      when: (s) => subGate(s, 'sub12', 0.5) && s.v.reform >= 50 && s.v.scandal >= 30,
      text: '相次ぐ不祥事と政治改革の先送りに、最大のスポンサーである経済団体の会長が記者会見で苦言を呈した。「株主への説明がつかない。クリーンな仕組みができるまで、会員企業による政治献金とパーティー券購入の斡旋を凍結する」と通告され、党と派閥の台所が一気に火の車になった。',
      choices: [
        C('企業・団体献金の全面禁止（または厳格な上限設定）に踏み切り、クリーンな政党へ脱皮する（痛みを伴う処置）', { funding: -3, lead: -3, scandal: -3, image: 4, reform: -3 }, '資金が尽きると、地元の支持が下がる', (g) => { g.later(8, null, (h) => { if (h.s.v.money < 40) { h.add('local', -3); h.log('資金が尽き、選挙区の活動が細った', 'bad'); } }); }),
        C('法人税の引き下げや規制緩和を手土産に、経済団体の幹部へ水面下で献金再開を懇願する', { funding: 1, tie: 3, fiscal: -1, image: -3 }, '一部だけ再開', null),
        C('献金減を受け入れ、手元の蓄えを取り崩してしのぐ（何もしない）', { money: -3, funding: -2, lead: -2 }, null, null)
      ]
    },
    {
      id: 'sub13', role: 'minus', title: 'SUB-13 歳出削減のしわ寄せによる「老朽インフラ崩落」事故', invented: true, once: true, tension: true, priority: 55, onStart: onSub,
      when: (s) => subGate(s, 'sub13', 0.6) && s.v.bousai <= 40 && s.flags.spendCut,
      text: '「無駄な公共事業の削減」を優先してきた結果、点検・補修が後回しにされていた幹線道路のトンネル（または橋梁・水道管）が崩落する事故が起きた。物流が寸断され、地方自治体や建設業界から「維持管理費まで一律に削った政府の人災だ」と批判が噴出している。',
      choices: [
        C('財政規律の方針を一部修正して非を認め、全国一斉の緊急インフラ点検・補修予算を組む（痛みを伴う処置）', { bousai: 4, fiscal: -1, image: 2 }, '点検で他の老朽箇所が次々と見つかり、財政の負担が続く', (g) => { g.s.flags.spendCut = false; g.later(10, '点検で老朽箇所が次々と見つかり、補修費がかさんだ', (h) => h.add('fiscal', -1)); }),
        C('事故が起きた選挙区と周辺地域にだけ、特例の復旧補助金を重点配分して火消しする', { local: 2, money: -2, tie: 2 }, '全国の老朽化は放置される', null),
        C('「管理責任は地方自治体と道路会社にある」として国の責任を否定する（何もしない）', { party: -3, local: -3, bousai: -2 }, null, null)
      ]
    }
  ];

  const api = { items, roll };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.REB_ITEMS = api;
})(typeof window !== 'undefined' ? window : globalThis);
