# MLBスコアボード日本語版

MLBポストシーズンの試合結果・勝ち上がり・個人成績・順位表を日本語でまとめた非公式ファンサイトです。

## 自動更新のしくみ

- `.github/workflows/update.yml` が1時間ごとに `scripts/update.mjs` を実行します。
- スクリプトはMLB公式データ（statsapi.mlb.com）から日程・スコア・個人成績・順位を取得し、`data.json` と試合ページ `game-<試合ID>.html` を作り直します。
- 変更があればコミットし、GitHub Pagesに公開します。
- 手動で今すぐ更新したいときは、Actionsタブの「スコア自動更新」→「Run workflow」を押します。

## 手で編集するファイル

- `notes.json` … 試合ごとの見出しや「試合の流れ」（試合IDごと）
- `teams.json` … チーム名の日本語表記
- `names.json` … 日本人選手の漢字表記

MLBおよび各球団とは関係のない、個人の非営利サイトです。
