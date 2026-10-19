# 参照D・Eの観察の反映 Phase 0(作業前の確認)

対象: `origin/main` `126fb47`(PR #39 のマージ後)。作業ブランチ `feat/refd-e-rules`。未追跡の `.claude/` には触れていない。

## 先の指示の実装状況(PR #39 でマージ済み)
根音の判定修正、ループの回転(`rotateLoop`)、i-bVI-bVII-bIII テンプレート(cinematic / finale)、短調の決定的なメジャーVの上限(`limitDefiniteDominants`)、`KeyMoveType`(`down` / `parallel` / `home`)、原調帰還、前セクション文脈(`GenerateParams.previous` / `originalKey`)は実装済み。未実装の項目はないので、この追加分に進む。

## 作業前の状態(記録)
| 項目 | 結果 |
| --- | --- |
| 型チェック(`tsc -b`) | 成功 |
| テスト(`npx vitest run --exclude '.claude/**'`) | 24ファイル成功・2スキップ、287件成功・2スキップ(スキップは環境変数指定時のみの分布測定) |
| build | 成功(既存のチャンクサイズ警告のみ) |
| lint | 警告2件のみ(既存: badge.tsx / button.tsx の only-export-components) |
| 作業前から失敗しているもの | なし |

## 規則ごとの重複調査
| 規則 | 状態 | 現状と先の指示との重複 |
| --- | --- | --- |
| 1. 相対長調のサビの提案 | 部分的 | `NEXT_SECTIONS` で `keyMove: { type: "relative" }` を持つのは chorus → c-melody だけ。verse / pre-chorus → chorus には無い。`resolveKeyMove` の `relative` は既存で、新しい `KeyMoveType` は不要。先の指示の `home`(c-melody → chorus)とは別の提案 |
| 2. プレコーラスの終止 | 未実装 | `adaptToSection` の `preChorus` は `replaceLast(tensionTokens(style, mode))` のみ(スタイルのテンプレートの終わり方に置換) |
| 3. susで保留し、V7を1か所だけ決定的に | 部分的 | 先の指示で、短調のメジャーVを1進行1か所に制限済み(`limitDefiniteDominants`)。sus化は、超過したVの未解決形・intro・verse・落ちサビの `unresolveToken` に限られ、「他の和音をsusにしてV7と対比させる」候補は無い |
| 4. 長調テンプレート `I – bVII – I – ii` | 未実装 | 長調のテンプレートに該当の並びは無い。romanceNostalgia の長調に bVII を含むものは `Imaj7 – bVII – vi7 – IVmaj7` など(骨格は別) |

## 各スタイルの短調の語彙(sus / 7 の許容、`styleVocabulary` の suffixes)
- sus2 を許容: ethereal / ritual / minimalism / dorian / slowcore
- sus4 を許容: ethereal / cinematic / ritual / finale
- 7 を許容(V7を置ける): romanticDark / finale / cool / tripHop / neoclassical / jChanson / hiNRG / electronica / frenchPop / kayokyoku / romanceNostalgia
- **sus2 または sus4 と 7 を両方許容: finale のみ**(短調)。規則3は「スタイルの suffixes に sus2 / sus4 があるスタイルだけ」で、スタイル外の響きを足さないため、現状では finale だけに効く。romanticDark は `7sus4` を持つが `sus4` 単体は持たない。語彙を広げる必要があれば、別途相談する。

## 規則2の解釈(相談したい点)
プレコーラスは、サビより前に作る。規則2の「規則1の相対長調の提案が選ばれた場合」を、次のように実装する予定。
- verse → pre-chorus に「相対長調のサビへ向かうBメロ」の提案を追加する(短調のみ)。これを選ぶと、生成条件に「相対長調のサビへ向かう」を渡し、プレコーラスの末尾を bVII7(相対長調のV7)にする候補を出す。スタイルが bVII の根音と7の装飾を持つときだけ。
- pre-chorus → chorus に、`relative` の提案を置く(規則1)。
- この提案を選ばなければ、プレコーラスの出力は現行と同じ。
違う意図なら、このPRで教えてほしい。

## その他の確認
- 参照音源は手元に無く、探していない。観察は方向性として扱う。
- 先の指示の 主スコアの採点式、`PROGRESSION_SCHEMA_VERSION`、Composer Song Exchange の `format` / `version` は変更しない。
