# 試作の共通の道具

どの章の試作でも使えるように、章のフォルダを引数に取ります。リポジトリの一番上で実行します。

| 道具 | 何をするか | 例 |
|---|---|---|
| `sim.js` | 自動プレイ。方針ごとの通し試験、ランダムな大量試験、1手ずつの値の表示 | `node prototype/tools/sim.js prototype/ch1-finance` |
| `build-artifact.js` | `index.html` と読み込んでいる JS を、アーティファクト用の1枚のHTMLにまとめる | `node prototype/tools/build-artifact.js prototype/ch1-finance out.html` |
| `smoke.js` | ブラウザで `index.html` を開き、選択肢を押し続けて、エラーが出ないかを見る | `node prototype/tools/smoke.js prototype/ch1-finance --shot shot.png` |

`npm test`、`npm run sim -- …`、`npm run build -- …`、`npm run smoke -- …` でも呼べます（`package.json`）。

## sim.js の選択肢
| 選択肢 | 意味 |
|---|---|
| `--seeds 1,2,3` | 世界の種（既定は 1,2）。同じ種なら同じ世界 |
| `--policy 名前` | 名前に含む方針だけを動かす |
| `--trace 名前` | その方針を1手ずつ、選ぶ前の値と一緒に表示する |
| `--fuzz 3000` | ランダムな選択で回し、止まった回数、結末、イベントの到達数、一度も出なかったイベント、フラグ、値の散らばりを出す |
| `--json` | 結果を JSON で出す（別のスクリプトで集計するとき） |

止まったケースがあると、終了コードが1になります。

プログラムから使う場合：

```js
const sim = require('./prototype/tools/sim.js');
const ch = sim.load('prototype/ch1-finance');
const run = sim.play(ch, sim.helpers.by({ mq1: /検査/ }), { seed: 1 }); // run.s が最後の状態
const stats = sim.fuzz(ch, { n: 1000 });
```

## 章のフォルダの決まり
| ファイル | 必須 | 中身 |
|---|---|---|
| `engine.js` | 必須 | `createGame(events, { seed, omens })` を出す。返すゲームは `tick()`、`choices()`、`choose(i)`、`s`（状態）を持つ |
| `events.js` | 必須 | `events` を出す。各イベントは `id`、`title`、`choices`（`label`、`hist`、`req`） |
| `omens.js` | 任意 | `omens` を出す（予兆） |
| `policies.js` | 任意 | 方針の定義。`module.exports = ({ by, hist, random }) => ({ '名前': 方針, … })` |
| `index.html` | 画面を作る場合 | `<!-- BUILD:HEAD -->` と `<!-- BUILD:BODY -->` の印で、アーティファクトに入れる範囲を示す。JS は `<script src>` で読む |

方針は `(イベントID, 選択肢の一覧, 状態) => 番号 | null`。`by({ ID: 正規表現 })` は選択肢の文言で選び、指定のないイベントや選べない選択肢は、史実の選択（`hist`）か最後の選べる選択肢になります。

画面の決まり（`smoke.js`）：選択肢のボタンは `.ch`、章の終わりには `#again` のボタンが出ること。
