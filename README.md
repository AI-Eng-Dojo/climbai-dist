# climbai-dist

ClimbAI の配布用リポジトリ（Releases に Android APK を添付・公開ページを配信）。

<!-- BR-DE-34: 配布の正はこのリポジトリ（AI-Eng-Dojo/climbai-dist）に確定する -->

## 公開ページ

正の配布 URL は **https://ai-eng-dojo.github.io/climbai-dist/** （このリポジトリの `docs/index.html`
を GitHub Pages で配信。Source = `main` ブランチの `/docs`）。

Android の APK は、このページのボタンから直接、または本リポジトリの
[Releases](https://github.com/AI-Eng-Dojo/climbai-dist/releases) から入手できる。

> 2026-07-27: `kei4eva4/climbai-dist`（個人アカウント）から org 側のリリースアップロード権限が
> 取得できたため、本リポジトリへ transfer 済み。旧 Pages URL `https://kei4eva4.github.io/climbai-dist/`
> は github.io ドメインの性質上リダイレクトされず 404 になる（`github.com/kei4eva4/climbai-dist` への
> リポジトリパスは自動リダイレクトされるが、Pages の配信ドメインは対象外）。

## このリポジトリに置いてよいもの

<!-- BR-DE-35: 秘密を一切置かない -->

- 公開ページ（`docs/` 配下）
- この README
- Release asset（署名済み APK など）

本体ソース・`.env`・keystore・配布トークン・Worker URL・その他の秘密情報は**一切置かない**
（NFR-DE-3 / INV-9）。本体ソースは `AI-Eng-Dojo/ClimbAI`（private）で管理する。
