#!/usr/bin/env node
// tools/check-page.mjs — docs/index.html・docs/privacy.html の静的検査（本ユニットのテストスイート）
//
// 依存ゼロ（Node 組み込みモジュールのみ）。package.json も node_modules も作らない。
// docs/ の外に置く（GitHub Pages で配信させないため）。
//
// 使い方: node tools/check-page.mjs

import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const docsDir = join(__dirname, '..', 'docs');
const pagePath = join(docsDir, 'index.html');
const privacyPath = join(docsDir, 'privacy.html');
const html = readFileSync(pagePath, 'utf8');

const results = [];
function check(name, ok, detail) {
  results.push({ name, ok, detail: detail || '' });
}

// --- 判定ロジック本体（項目1・3・6・8 で共通利用。二重に書かない） -------------

// <html lang="ja"> がある（BR-DE-44 / BR-DE-58）
function hasLangJa(pageHtml) {
  return /<html[^>]*\blang="ja"/i.test(pageHtml);
}

// 外部リソース参照ゼロ（BR-DE-36 / BR-DE-58）
//   - <link rel=stylesheet> / <script src> / <img src> は0件
//   - href=/src= が http(s) で始まる場合、GitHub / GitHub Pages ドメイン以外は0件
const ALLOWED_HOST_PATTERN = /^https?:\/\/(github\.com|api\.github\.com|ai-eng-dojo\.github\.io)\//i;
const FORBIDDEN_TAG_PATTERNS = [
  { name: '<link rel="stylesheet">', re: /<link[^>]+rel=["']?stylesheet["']?[^>]*>/i },
  { name: '<script src=...>', re: /<script[^>]+src=/i },
  { name: '<img src=...>', re: /<img[^>]+src=/i },
];
function noExternalResources(pageHtml) {
  const forbiddenTagHits = FORBIDDEN_TAG_PATTERNS.filter((p) => p.re.test(pageHtml));
  const hrefSrcMatches = [...pageHtml.matchAll(/(?:href|src)="(https?:\/\/[^"]+)"/gi)].map(
    (m) => m[1]
  );
  const disallowedUrls = hrefSrcMatches.filter((url) => !ALLOWED_HOST_PATTERN.test(url));
  return {
    ok: forbiddenTagHits.length === 0 && disallowedUrls.length === 0,
    detail: [
      forbiddenTagHits.length
        ? `禁止タグ検出: ${forbiddenTagHits.map((h) => h.name).join(', ')}`
        : '',
      disallowedUrls.length ? `許可外URL検出: ${disallowedUrls.join(', ')}` : '',
    ]
      .filter(Boolean)
      .join(' / '),
  };
}

// 秘密パターンが0件（INV-9 / BR-DE-58）
const SECRET_PATTERNS = [
  /AQ\.[A-Za-z0-9_-]{20,}/,
  /AIza[0-9A-Za-z_-]{10,}/,
  /\?key=/,
  /-----BEGIN/,
];
function noSecretPatterns(pageHtml) {
  const secretHits = SECRET_PATTERNS.filter((re) => re.test(pageHtml));
  return {
    ok: secretHits.length === 0,
    detail: secretHits.length ? `検出パターン: ${secretHits.map((r) => r.source).join(', ')}` : '',
  };
}

// --- 項目1〜6（index.html） ------------------------------------------------

// 1. <html lang="ja"> がある（BR-DE-44）
const langJaOk = hasLangJa(html);
check('1. <html lang="ja"> が存在する', langJaOk, langJaOk ? '' : '<html lang="ja"> が見つからない');

// 2. data-testid が 11種すべて存在する。dist-ios-cta は Bolt4 時点で
//    pending のため「存在しないこと」を期待する（BR-DE-45 / BR-DE-40）
//    ※ BR-DE-67: IOS_TESTFLIGHT_URL 投入後も dist-ios-cta は JS が実行時に付与する属性で
//       静的 HTML には現れないため、この期待は反転しない。
const REQUIRED_PRESENT_TESTIDS = [
  'dist-android',
  'dist-android-download',
  'dist-android-notice',
  'dist-android-steps',
  'dist-version',
  'dist-ios',
  'dist-ios-pending',
  'dist-ios-steps',
  'dist-qr',
  'dist-notice',
];
const REQUIRED_ABSENT_TESTIDS = ['dist-ios-cta'];

const missing = REQUIRED_PRESENT_TESTIDS.filter(
  (id) => !html.includes(`data-testid="${id}"`)
);
const unexpectedlyPresent = REQUIRED_ABSENT_TESTIDS.filter((id) =>
  html.includes(`data-testid="${id}"`)
);
check(
  '2. data-testid 11種（dist-ios-cta は不在を期待）',
  missing.length === 0 && unexpectedlyPresent.length === 0,
  [
    missing.length ? `不足: ${missing.join(', ')}` : '',
    unexpectedlyPresent.length
      ? `本来まだ存在してはいけない: ${unexpectedlyPresent.join(', ')}`
      : '',
  ]
    .filter(Boolean)
    .join(' / ')
);

// 3. 外部リソース参照ゼロ（BR-DE-36）
const externalCheck = noExternalResources(html);
check(
  '3. 外部リソース参照ゼロ（GitHub/Pages 以外の外部URL・stylesheet/script src/img src なし）',
  externalCheck.ok,
  externalCheck.detail
);

// 4. Android ボタンの初期 href が Releases latest ページである（INV-10）
const FALLBACK_URL = 'https://github.com/AI-Eng-Dojo/climbai-dist/releases/latest';
const androidHrefMatch =
  html.match(/data-testid="dist-android-download"[^>]*\shref="([^"]+)"/i) ||
  html.match(/href="([^"]+)"[^>]*\sdata-testid="dist-android-download"/i);
check(
  '4. Android ボタンの初期 href = Releases latest ページ（INV-10）',
  !!androidHrefMatch && androidHrefMatch[1] === FALLBACK_URL,
  androidHrefMatch
    ? `実際の href: ${androidHrefMatch[1]}（期待: ${FALLBACK_URL}）`
    : 'dist-android-download の href が見つからない'
);

// 5. QR コメントの payload と、ページ内に表示している公開 URL が一致する（INV-12）
const qrCommentMatch = html.match(/<!--\s*BR-DE-46: QR payload = (\S+)\s*-->/);
const qrSectionMatch = html.match(/<section id="qr"[\s\S]*?<\/section>/i);
let displayedUrl = null;
if (qrSectionMatch) {
  const urlInSection = qrSectionMatch[0].match(
    /https:\/\/ai-eng-dojo\.github\.io\/climbai-dist\/?/
  );
  displayedUrl = urlInSection ? urlInSection[0] : null;
}
check(
  '5. QR payload コメント === ページ内表示 URL（INV-12）',
  !!qrCommentMatch && !!displayedUrl && qrCommentMatch[1] === displayedUrl,
  `コメント: ${qrCommentMatch ? qrCommentMatch[1] : 'なし'} / 表示: ${displayedUrl ?? 'なし'}`
);

// 6. 秘密パターンが0件（INV-9）
const secretCheck = noSecretPatterns(html);
check('6. 秘密パターン0件（INV-9）', secretCheck.ok, secretCheck.detail);

// --- 項目7〜8（BR-DE-59 / BR-DE-58。IOS_TESTFLIGHT_URL の検査はここに含めない — ---
// --- 公開リンク発行後に別途追加する） ---------------------------------------

// 7. index.html から privacy.html への相対リンクが存在する（BR-DE-59）
const hasPrivacyLink = /href="privacy\.html"/.test(html);
check(
  '7. index.html に href="privacy.html" が存在する（BR-DE-59）',
  hasPrivacyLink,
  hasPrivacyLink ? '' : 'href="privacy.html" が見つからない'
);

// 8. privacy.html が存在し、lang="ja" ／ 外部リソース参照ゼロ ／ 秘密パターン0件（BR-DE-58）
//    判定は項目1・3・6 と同じ関数を privacy.html にも適用する（判定ロジックを二重に書かない）
const privacyExists = existsSync(privacyPath);
if (!privacyExists) {
  check('8. privacy.html の検査（存在／lang="ja"／外部リソースゼロ／秘密パターン0件）', false, 'docs/privacy.html が見つからない');
} else {
  const privacyHtml = readFileSync(privacyPath, 'utf8');
  const privacyLangOk = hasLangJa(privacyHtml);
  const privacyExternalCheck = noExternalResources(privacyHtml);
  const privacySecretCheck = noSecretPatterns(privacyHtml);
  const privacyOk = privacyLangOk && privacyExternalCheck.ok && privacySecretCheck.ok;
  check(
    '8. privacy.html の検査（存在／lang="ja"／外部リソースゼロ／秘密パターン0件）',
    privacyOk,
    [
      privacyLangOk ? '' : '<html lang="ja"> が見つからない',
      privacyExternalCheck.ok ? '' : privacyExternalCheck.detail,
      privacySecretCheck.ok ? '' : privacySecretCheck.detail,
    ]
      .filter(Boolean)
      .join(' / ')
  );
}

let allPass = true;
for (const r of results) {
  const mark = r.ok ? 'PASS' : 'FAIL';
  if (!r.ok) { allPass = false; }
  console.log(`[${mark}] ${r.name}${r.detail ? ' — ' + r.detail : ''}`);
}

console.log('');
console.log(
  allPass
    ? `PASS: ${results.length}/${results.length} 全項目パス`
    : `FAIL: ${results.filter((r) => !r.ok).length}件が失敗しました`
);

process.exit(allPass ? 0 : 1);
