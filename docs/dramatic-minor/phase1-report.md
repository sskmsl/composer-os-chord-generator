# ドラマティック・マイナー Phase 1(規則の実装)

Phase 0(`9a61ae7`)の続き。ブランチ `feat/dramatic-minor-rules`、PR #39。規則1項目1コミットで実装した。
転調の移動量は、ユーザーに確認して **3半音下(短3度下)** に確定した。「長3度下げ(4半音)」という言葉は採用せず、参照ループ Ab–Bb–Eb–Cm → F–G–C–Am の間隔に合わせた。

## 規則ごとの状態

| 規則 | 状態 | コミット | 実装の要点 |
| --- | --- | --- | --- |
| 根音判定 | Phase 0 で実装済み | 9a61ae7 | `rootKey` に統一 |
| 度数ベースのループ回転 | 実装 | 494eb93 | `songFlow.ts` の `rotateLoop`。全12調・長短調で、度数を回した和音名が、コード名を回したものと一致することを検証 |
| i-bVI-bVII-bIII テンプレート | 実装 | 6698b42 | cinematic / finale の短調に各1つ追加。他スタイルには入れず、romanticDark のシグネチャーは緩めていない(単体では不成立のままテストで固定) |
| 決定的なメジャーVを1進行1か所に | 実装 | c5f4225 | `limitDefiniteDominants`。sus系は長3度を持たないので数えない。残すのは最後の1か所で、他は未解決形(sus)→語彙内の v / bVII →前後と別根音の語彙内の和音の順に置き換える。Vは足さない。8小節フレーズは後半の出だしが前半と同じ根音になるよう、対応する位置を同じ和音にする |
| intro の3種の終わり方 | 実装 | 57940c6、0f42555 | 反復(2和音を繰り返す)/通常の未解決(従来)/ときどき V→i のターンアラウンド(確率8%)。V→i の V は長3度を持つ決定的なV(susは使わない)。旋法・反復系スタイルは V へ導かない |
| chorus の回転 | 実装 | 8907d60 | 前セクションのループを別の和音から回して使う(確率50%)。先頭は元の先頭とも前セクションの最終和音とも別根音にする。調の性格・長さ・語彙が合わなければ使わない |
| c-melody / bridge の色彩 | 実装 | ae24a58 | 前のループの同型を、そのスタイルの色彩和音を必ず1つ含めて使い回す(確率50%)。転調後なら度数のまま、同じ調なら回して前と変える |
| 転調型 `down`(3半音下)と `home` | 実装 | c753017 | `KeyMoveType` に追加。`resolveKeyMove(key, move, originalKey?)`。chorus→bridge に `down`、c-melody→chorus と grand-chorus→outro に `home`。24調で検証 |
| 同主短調への一時暗転 | 実装 | 5b43f4a | `KeyMoveType` に `parallel`(長調→同じ主音の短調。短調は変化なし)。chorus→落ちサビに `parallel`、落ちサビ→chorus に `home`。暗転中の `up` は原調から全音上げる。生成側は、前が長調で今が同主短調のとき、前ループの度数を同主短調の借用和音(I→i、IV→iv、vi→bVI など。`toParallelMinor`)に置き換えて、落ちサビ・c-melody・bridge で使う。全12調で検証 |
| 原調帰還の bVI–bVII–i | 実装 | b19f54d | `returningHome`(今の調が原調で、前セクションは別の調)のとき、chorus / 大サビ / outro の終わりを bVI → bVII → 主和音にする(確率70%)。`GenerateParams.originalKey` と前セクションで判断する。3つともそのスタイルのテンプレートにあるときだけで、長さは変えない。短調は全12調、長調も検証 |
| 生成経路への接続 | 実装 | 9c6f15d、cb0df0e(テスト) | `GenerateParams.previous`(調・ループ・最終和音)と `originalKey`。ストアの `continueToSection` が先頭の候補を前セクションとして渡し、`NextSectionSuggestion` から呼ぶ。条件を手で変えると文脈を破棄。前セクション文脈なしの従来呼び出しはそのまま動く |
| 採点との整合 | 既存で足りた(採点式は変更なし) | — | 下記「plainDiatonic」 |
| 曲全体の感情最適化 | 見送り(指示どおり) | — | — |

## 実測

条件は Phase 0 と同じ。固定seed 17 / 97 / 301 / 1009 / 8191、A短調(長調も測定)、mood=melancholic、count=5、4コード、各seed 40回。数値は `phase1-after.json`(Phase 0 と同条件の最終分布)と `phase1-rules.json`(規則ごとの生存率)。

### 通常生成(chorus、前セクション文脈なし)の変化

19スタイル × 長短調 = 38条件のうち、骨格種類数と平均点が変わったのは5条件のみ。残りは Phase 0 の値と一致した。

| Style | Mode | 骨格 Phase 0 → Phase 1 | 主スコア平均 |
| --- | --- | ---: | ---: |
| cinematic | minor | 167 → 160 | 6.633 → 6.595 |
| finale | minor | 48 → 50 | 7.412 → 7.605 |
| neoclassical | minor | 49 → 49 | 8.455 → 8.454 |
| frenchPop | minor | 109 → 111 | 7.749 → 7.726 |
| kayokyoku | minor | 82 → 81 | 7.600 → 7.589 |

新ループ(回転を同値とする)の選抜後の出現率は cinematic 0.1% → 1.4%、finale 0.3% → 2.6%。「少数追加」の範囲に収まった。

### 各規則の選抜後の生存率

対照は、文脈(前セクション・原調)を渡さない同条件の生成。数値は「対照 → 文脈あり」。

- **chorus の回転**(前ループ `bVII-i-bIII-bVI`): cinematic 4.3% → 20.6%、finale 8.2% → 30.3%、ethereal 1.7% → 25.2%。romanticDark・neoclassical・kayokyoku・sadcorePop・dorian・slowcore・ritual・tripHop は 0% → 0%。これらはこのループ単体ではスタイルのシグネチャー(V / bII / #iv、iv など)を満たさず、選抜に残らない。シグネチャーを緩めない方針どおりの結果。
- **c-melody / bridge の使い回し**: cinematic で c-melody 3.1% → 10.5%、bridge 3.7% → 22.6%。同型として現れた進行には、そのスタイルの色彩和音が必ず入ることをテストで確認。
- **intro**: V→i で終わる率(根音がVのもの)は、ターンアラウンドを止めた場合が romanticDark 24.0%、finale 16.2%、neoclassical 16.2%、cinematic 0%。確率8%では 33.4%、30.1%、19.8%、11.8%。このうち決定的なV(susを除く)で終わる率は romanticDark 16.3%、finale 30.1%、neoclassical 16.4%、cinematic 2.7%、jChanson 14.4%、kayokyoku 23.3%。V→i を持つ既存テンプレートが元々あるスタイルは、ターンアラウンドを止めても残る。
- **決定的なメジャーV**: 19スタイル × 7セクション × 4/8コードの全条件で、1進行あたり最大1か所(sus を除く)。旋法・反復系(dorian / ritual / electronica / slowcore / tripHop / minimalism)は短調の全セクションで V の根音が出ない。
- **同主短調への一時暗転**(C長調 → C短調の落ちサビ、前ループ I-vi-IV-V): 借用和音の先頭3和音 `i-bVI-iv` の出現率は cinematic 0% → 44.9%、finale 0.4% → 36.6%、ethereal 3.4% → 46.5%、cool 8.9% → 51.9%、jChanson 0% → 15.0%。romanticDark・newWave・ritual・neoclassical・hiNRG・dorian・frenchPop・kayokyoku・romanceNostalgia は 0% → 0%(ループ単体ではシグネチャーか語彙に合わない)。
- **原調帰還の bVI–bVII–i**(前セクションが関係調、今が原調A短調): chorus の終わりの割合は cinematic 9% → 42%、finale 12% → 38%、ethereal 0% → 46%、cool 4% → 53%。大サビ・アウトロも同程度。romanticDark・neoclassical・kayokyoku・dorian・slowcore は 0% → 0%(bVI–bVII–i で終わると、それぞれのシグネチャーまたは語彙に合わない)。

### ターンアラウンドの選抜後の増え方(観察)

intro のターンアラウンドは、生成確率8%に対して、選抜後の V→i(根音がVのもの)の割合が romanticDark で +9、finale で +14、neoclassical で +4、cinematic で +12 ポイント増える(ターンアラウンドなしとの比較)。採点式(既存の主スコア)に完全終止そのものへの直接加点は無い。増える理由は、特徴ごとの内訳(V7の借用・surprise など)を取っていないため未確認で、因果は断定しない。多すぎると判断するなら、確率だけを下げれば調整できる。

### plainDiatonic

`plainDiatonic` は変更していない。選抜後はスタイルを問わず 0%(装飾・スラッシュが付くため)で、選抜後の新ループも 0%。新ループの平均点は cinematic 6.79(全体 6.59)、finale 6.46(全体 7.61)。finale の新ループの平均点は低いが、plainDiatonic の減点が原因ではない。生の遷移(装飾前)の plainDiatonic 割合は `phase1-rules.json` にあるが、装飾前なので選抜後とは比べられない。

## 検証

テスト件数は、リポジトリの未追跡 `.claude/worktrees/` に入っているコピーを除いて数える(vitest が拾って件数が増えるため)。コマンドは次のとおり。

```sh
npx vitest run --exclude '.claude/**'
```

- 型チェック(`tsc -b`)、build、lint 成功。lint の警告は既存の2件(badge.tsx / button.tsx の only-export-components)、build は既存のチャンクサイズ警告のみ。新規警告なし。
- テスト: 24ファイル成功・2ファイルスキップ(環境変数指定時のみ実行する分布測定2件。指定して別途成功)、287件成功・2件スキップ。Phase 0 時点の既存テストの期待値は変更していない。
- 例外: `exportSong.test.ts` のプログラムチェンジ検出は、SMFのバイト列を走査して誤検出していた(下記)。期待値は変えず、SMFの構造を読み進めて数える実装に直した。
- 追加テスト: 回転(全12調)、テンプレート(新ループの選抜後の生存件数が正)、V上限(5 seed × 全スタイル × 全セクション × 4/8コード)、intro(決定的なV→iの選抜後の生存を含む)、chorus / c-melody / bridge、転調・同主短調・原調帰還(全12調)、同じ骨格から装飾・転回・ベースが複数に分かれること、ストアとUIの接続。
- 保存・交換形式、MIDI、小節揃えの既存テストは成功。`PROGRESSION_SCHEMA_VERSION`(5)、Composer Song Exchange の `format` / `version`、`progression.ts`、MIDI 書き出し、保存まわりのファイルは差分なし。アレンジアプリのリポジトリは変更していない。

## 既存の問題・注意

- `exportSong.test.ts` の「楽器番号を入れない」「GM向けは…」の2件は、既存の不安定なテストだった(SMFのバイト列を走査して、生成した進行のバイトに一致すると失敗)。Phase 0 のコミットで40回中4回失敗した。CI もデプロイも `npm test` を通すので、公開を止める恐れがあり、SMFの構造を読み進める実装に直した(60回中0回失敗)。
- 8和音(8小節フレーズ)で同じ根音が3連続する既存の問題が残る。Codex の確認では、5seed × 19スタイル × 長短調 × 全10セクション × 4/8和音で、原main(8ba8c40)16件、Phase 0(9a61ae7)9件で再現する(例: slowcore短調 iv,iv,i,v,iv,iv,iv,bVI)。`buildPeriod` の既存の挙動で、今回は直していない。期待値や基準を緩めずに直すなら、範囲を相談してからにする。
- 環境: `node_modules` が古く vitest が入っていなかったため `npm ci` を実行した。ローカルの Node は `~/.local/node/bin` にあり PATH に入っていない。

## 未確認

- ブラウザでの操作・実音確認は未実施。ローカルの開発サーバーは同期用のログイン画面で止まるため、UIは jsdom のコンポーネントテストで確認した(転調先・同主短調のキー表示、クリックで生成に渡る前セクション・原調)。
- 前セクションとして渡すのは、提案をクリックした時点の先頭の候補。ユーザーが別の候補を選んでいても先頭を使う。
- 聴感の評価はしていない。上の数値は、この条件下での方向性を示すもので、聴感を保証しない。参照ループの度数・装飾は自動分析にもとづく推定で、耳による確認はされていない。音源は探していない。
- 曲全体の評価・感情最適化は実装していない。

## 禁止名の確認

自分の差分に実在のアーティスト名・曲名・年代名は追加していない。差分中に残る人名らしい文字列は、既存のスコアキー(APIの型)を使うコードとテストの固定データのみ。
