# climbai-dist

ClimbAI の配布用リポジトリ（Releases に Android APK を添付・公開ページを配信）。

<!-- BR-DE-34: 配布の正はこのリポジトリ（kei4eva4/climbai-dist）に確定する -->

## 公開ページ

正の配布 URL は **https://kei4eva4.github.io/climbai-dist/** （このリポジトリの `docs/index.html`
を GitHub Pages で配信。Source = `main` ブランチの `/docs`）。

Android の APK は、このページのボタンから直接、または本リポジトリの
[Releases](https://github.com/kei4eva4/climbai-dist/releases) から入手できる。

## org 側リポジトリについて

<!-- BR-DE-34: org 側の空リポは配布経路として使わない（誤配布防止） -->

`AI-Eng-Dojo/climbai-dist`（org 側）は配布には**使わない**。配布の正は常にこの個人アカウント配下の
`kei4eva4/climbai-dist` である。

## このリポジトリに置いてよいもの

<!-- BR-DE-35: 秘密を一切置かない -->

- 公開ページ（`docs/` 配下）
- この README
- Release asset（署名済み APK など）

本体ソース・`.env`・keystore・配布トークン・Worker URL・その他の秘密情報は**一切置かない**
（NFR-DE-3 / INV-9）。本体ソースは `AI-Eng-Dojo/ClimbAI`（private）で管理する。
