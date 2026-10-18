# 参照D・Eの観察の反映(実装報告)

PR #40、ブランチ `feat/refd-e-rules`、対象は `origin/main` `126fb47`。Phase 0 の確認は `phase0-report.md`。数値は方向性で、聴感を保証しない。

## 規則ごとの状態

| 規則 | 状態 | コミット | 要点 |
| --- | --- | --- | --- |
| 1. 相対長調のサビの提案 | 新規実装(既存の `relative` と `resolveKeyMove` を使用。新しい `KeyMoveType` なし) | 7d53381 | verse / pre-chorus → chorus に、短調の曲だけの提案を追加(`SectionSuggestion.onlyIn`)。移動は `resolveKeyMove` の `relative` で、全12調が +3半音の長調になることをテスト |
| 2. プレコーラスの終止 | 新規実装 | 3ef003a | verse → pre-chorus に「相対長調のサビへ向かうBメロ」の提案(短調のみ)。選んだときだけ `GenerateParams.approachRelativeMajor` が渡り、末尾を `bVII7` にする候補が出る(確率70%)。スタイルが bVII の根音と 7 の装飾を語彙に持つときだけ。選ばなければ出力は現行と完全に同じ(同seedで一致を確認) |
| 3. susで保留し、V7を1か所だけ決定的に | 新規実装(先の指示の1か所制限の上に追加) | 2843d1e | `contrastWithSus`。短調で決定的なV7がちょうど1か所のとき、素の三和音と add9 の和音をsus2 / sus4にする(確率35%、Vを除く半分以上がsusになる場合のみ)。スタイルの語彙に sus2 または sus4 があるときだけ。スラッシュベース・dim / aug / 7th / 6th の和音には触れない |
| 4. 長調テンプレート | 新規実装(1スタイルのみ) | 6583206 | romanceNostalgia の長調に `Imaj7 – bVIImaj7 – Iadd9 – ii7` を1本。他のスタイルには入れていない |

## 実測(Phase 0 と同条件: seed 17 / 97 / 301 / 1009 / 8191、A短調、mood=melancholic、count=5、4コード、各seed 40回)

`docs/refd-e/distribution-after.json` と `rules-after.json`。

### 他のスタイルの分布への影響
19スタイル × 長短調 = 38条件のうち、骨格種類数と平均点が変わったのは2条件のみ(PR #39 最終の `phase1-after.json` との比較)。他の36条件は一致した。

| Style | Mode | 骨格 | 主スコア平均 | 原因 |
| --- | --- | ---: | ---: | --- |
| finale | minor | 50 → 48 | 7.605 → 7.720 | 規則3 |
| romanceNostalgia | major | 190 → 251 | 6.435 → 6.251 | 規則4 |

規則4は、新しい遷移(I→bVII maj7、bVII→I、I→ii7 など)が増えて骨格が大きく増え、平均点が 0.18 下がった。出力に出る割合は、この並びの回転を含めて 1.8%。平均点の低下が許容できなければ、規則4は任意なので外せる。

### 規則2: プレコーラスの末尾が bVII7 になる割合(選抜後。選ばない場合 → 選んだ場合)
romanticDark 0% → 33.5%、finale 0% → 35.0%、neoclassical 0% → 27.3%、jChanson 0% → 32.8%、hiNRG 3.2% → 28.6%、electronica 0% → 48.1%、frenchPop 0% → 35.6%、kayokyoku 0% → 38.7%、romanceNostalgia 0% → 27.9%。cool(24.1% → 39.4%)と tripHop(24.4% → 53.5%)は、元のテンプレートに bVII7 の終わりがあるため、選ばなくても出る。bVII の根音または 7 の装飾を持たないスタイル(ethereal / cinematic / newWave / sadcorePop / ritual / minimalism / dorian / slowcore)は 0% のまま(足さない)。

### 規則3
- 語彙に sus2 または sus4 と 7 を両方持つ短調のスタイルは **finale のみ**。他は sus だけ(ethereal / cinematic / ritual / minimalism / dorian / slowcore)か、7 だけで、規則は働かない。語彙を広げていない。
- finale の短調(全7セクション、選抜後)で、決定的なV7が1か所かつ他の半分以上がsusの進行は 14.6%。決定的なVが2か所以上の進行は 0 件(全スタイル・全セクションで最大1)。

### 規則4
該当の並びが出力に出る割合は romanceNostalgia の長調で 1.8%。他のスタイルでは 0%(cool の 0.1% は既存のテンプレートによる)。

## 互換性・検証
- 型チェック、build、lint 成功(lint の警告は既存の2件のみ、build は既存のチャンクサイズ警告のみ)。
- テスト: `npx vitest run --exclude '.claude/**'` で 24ファイル成功・3スキップ、329件成功・3スキップ(スキップは環境変数指定時のみの分布測定3件。指定して別途成功)。3回連続で成功。作業前は 287件成功・2スキップで、失敗はなかった。既存テストの期待値は変更していない。
- 追加テスト: 規則1(全12調の移動、提案の出し分け、長調の語彙内、UI)、規則2(提案を選んだときだけ、出力不変、全12調の根音、ストア・UI)、規則3(単体・語彙・選抜後の生存・1か所の上限)、規則4(登録・重複なし・生存・他スタイル不変)。
- `PROGRESSION_SCHEMA_VERSION`、Composer Song Exchange の `format` / `version`、`progression.ts`、保存、MIDI 書き出しのファイルは差分なし。保存再読込・MIDI・小節揃えの既存テストは成功。アレンジアプリのリポジトリは変更していない。
- 採点式・閾値は変更していない。

## 未確認
- ブラウザでの操作・実音確認は未実施(開発サーバーは同期用のログイン画面で止まる)。UIは jsdom のコンポーネントテストで確認した。
- 参照D・Eの度数の推定誤差(maj7 / sus の別は特に不確か)は検証できない。聴感の評価はしていない。曲全体の評価は未実装。
- 規則2は「提案を選んだとき」を verse → pre-chorus の提案として実装した。意図が違えばPRで教えてほしい。
- 規則3は、現状のスタイルでは finale だけに効く。

## 禁止名の確認
自分の差分に実在のアーティスト名・曲名・年代名は追加していない。
