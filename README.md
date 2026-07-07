# Composer OS Chord Generator — v0.1

Style / Key / Section / Mood を選んでコード進行の候補を複数生成し、比較して、
気に入ったものだけを保存する作曲支援ツール。

Mylène Farmer / Laurent Boutonnat 的な「ダーク・ロマンティック・シネマティック」な
美学に影響を受けたオリジナル曲制作を想定(直接のコピーはしない)。

## 起動方法

```sh
export PATH="$HOME/.local/node/bin:$PATH"   # この環境のNode.jsの場所
npm install
npm run dev      # http://localhost:5173(使用中なら自動で別ポート)
npm run build    # 型チェック + 本番ビルド
```

## デスクトップアプリ(macOS)として使う

```sh
npm run electron:dev     # 開発モード(Viteのホットリロード込みでElectronウィンドウを起動)
npm run electron:build   # dist/ をビルドし、release/mac-arm64/ に .app を生成
```

生成された `release/mac-arm64/Composer OS Chord Generator.app` を
`/Applications` に移動すればFinderやSpotlightから直接起動できる。
Node.js のインストールやターミナルは不要(ビルド時にElectron本体が同梱される)。

- ルーティングは `HashRouter`(`#/generator` 形式)。`file://` で配信する
  Electron環境でもページ遷移が壊れないようにするため
- Vite の `base` は `"./"` (相対パス)。パッケージ後の `file://` 読み込みに必要
- 未署名アプリのため、初回起動時にGatekeeperが警告を出す。Finderで
  右クリック→「開く」を選ぶか、システム設定 > プライバシーとセキュリティ
  から許可する
- MIDI書き出し(`.mid`)は `~/Downloads` に自動保存される
  (`electron/main.cjs` の `will-download` ハンドラ)

## v0.1 の機能

- **ルールベースのコードエンジン**(AI不使用)
  - 7スタイル × マイナー/メジャー別テンプレート(CHORD_ENGINE_SPEC 準拠)
  - 10セクション(Intro / Verse / Verse 1〜3 / Pre-Chorus / Chorus / Bridge /
    Final Chorus / Outro)。Verse 1〜3 は Verse ルールを共有、Final Chorus は
    解放感あるトニック終止を優遇(`sectionRule()` で基底ルールへマップ)
  - セクションルール(Intro=未解決 / Pre-Chorus=ドミナント終止 / Outro=反復 等)
  - ムードによるテンプレート抽選と装飾(add9 / maj7 / sus / m9 / m11 / スラッシュベース)の重み付け
  - 実用12マイナー+12メジャーキーへの移調(フラット系キーはフラット表記)
  - ローマ数字表記・ベース動線・説明文・5軸スコア(Mylène / Boutonnat / Melancholy / Darkness / Cinematic、ルールベースで説明可能)
- Generator: 生成 → 比較 → 保存(重複進行は自動排除、「前の結果に戻る」1世代)
- Saved: 保存済み一覧・削除(確認ダイアログ)・詳細でメモ4欄(メモ / 曲アイデア / アレンジ / Logic Pro)を編集
- **フォルダ(曲)管理**: 進行を曲ごとのフォルダにまとめる。フォルダバーで
  絞り込み(すべて / 未分類 / 各フォルダ)、詳細画面で所属フォルダを変更、
  フォルダ削除時は中の進行を消さず未分類へ退避
- **鍵盤表示**: 各コードの押さえる位置を SVG ピアノで表示(コードトーン=赤 /
  ベース=青、C2〜F5 の3オクターブ)。生成カードのトグルと詳細画面に表示
- IndexedDB によるローカル永続化(リロード後も保持、DB v2 でフォルダ対応)
- **試聴機能**: Web Audio API の内蔵シンセ(デチューンsawパッド+サインベース、
  外部音源不要)で進行を1コード=4拍で再生。テンポはスタイル別
  (`src/features/chord-engine/templates.ts` の STYLE_TEMPO で調整可能)
- **SMF (MIDI) 書き出し**: フォルダ(= 1曲)の構成を **SMF Type 1** の `.mid` として
  書き出し、Logic Pro にインポート可能。オーディオは含まずノートのみなので音質劣化ゼロ
  (Logic 側の音源で再生)。曲の構成はフォルダ絞り込み時の「曲の構成」パネルで組む:
  - セクション(=保存進行)の並べ替え、繰り返し回数(×1〜4)、曲全体のテンポ設定
  - 1コード = 1小節(4/4)。Track 0 = コンダクター(テンポ・拍子・セクションマーカー)、
    Track 1 = Chords(コードトーン)、Track 2 = **Bass**(コードのベース音、
    スラッシュコード対応: `Fmaj7/A` なら A)。Logic では Chords / Bass が別トラックに
    読み込まれるので、それぞれに音源を割り当てられる
  - Logic のマーカーにセクション名(例: `Verse 1 (Am)`)が並ぶ
  - 実装: `src/features/midi/`(`smf.ts` = ライブラリ非依存のバイナリエンコーダ、
    `exportSong.ts` = フォルダ→ノート列の組み立て)

## アーキテクチャ

```
UI (pages/components) → Zustand (store/useAppStore)
                          ├── chord-engine   … React非依存の純粋関数パイプライン
                          │     templates → section変形 → decorate → 移調 → scoring/description
                          └── storage        … progressionRepository → IndexedDB (idb)
```

コード生成エンジンは `src/features/chord-engine/` に隔離されており、
将来AIエンジンへ置き換える場合も `generateProgressions(params)` の
シグネチャを維持したまま差し替えられる。

## 仕様書

設計の元になった仕様は `~/Desktop/composer-os-codex-v2/` の各Markdown
(PRODUCT_REQUIREMENTS / CHORD_ENGINE_SPEC / STYLE_PRESETS ほか)を参照。
