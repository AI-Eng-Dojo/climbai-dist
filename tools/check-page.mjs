#!/usr/bin/env node
// tools/check-page.mjs — docs/index.html の静的検査（本ユニットのテストスイート）
//
// 依存ゼロ（Node 組み込みモジュールのみ）。package.json も node_modules も作らない。
// docs/ の外に置く（GitHub Pages で配信させないため）。
//
// 使い方: node tools/check-page.mjs

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const pagePath = join(__dirname, '..', 'docs', 'index.html');
const html = readFileSync(pagePath, 'utf8');

const results = [];
function check(name, ok, detail) {
  results.push({ name, ok, detail: detail || '' });
}

// 1. <html lang="ja"> がある（BR-DE-44）
const hasLangJa = /<html[^>]*\blang="ja"/i.test(html);
check(
  '1. <html lang="ja"> が存在する',
  hasLangJa,
  hasLangJa ? '' : '<html lang="ja"> が見つからない'
);

// 2. data-testid が 11種すべて存在する。dist-ios-cta は Bolt4 時点で
//    pending のため「存在しないこと」を期待する（BR-DE-45 / BR-DE-40）
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
//    - <link rel=stylesheet> / <script src> / <img src> は0件
//    - href=/src= が http(s) で始まる場合、GitHub / GitHub Pages ドメイン以外は0件
const ALLOWED_HOST_PATTERN = /^https?:\/\/(github\.com|api\.github\.com|kei4eva4\.github\.io)\//i;

const forbiddenTagPatterns = [
  { name: '<link rel="stylesheet">', re: /<link[^>]+rel=["']?stylesheet["']?[^>]*>/i },
  { name: '<script src=...>', re: /<script[^>]+src=/i },
  { name: '<img src=...>', re: /<img[^>]+src=/i },
];
const forbiddenTagHits = forbiddenTagPatterns.filter((p) => p.re.test(html));

const hrefSrcMatches = [...html.matchAll(/(?:href|src)="(https?:\/\/[^"]+)"/gi)].map(
  (m) => m[1]
);
const disallowedUrls = hrefSrcMatches.filter((url) => !ALLOWED_HOST_PATTERN.test(url));

check(
  '3. 外部リソース参照ゼロ（GitHub/Pages 以外の外部URL・stylesheet/script src/img src なし）',
  forbiddenTagHits.length === 0 && disallowedUrls.length === 0,
  [
    forbiddenTagHits.length
      ? `禁止タグ検出: ${forbiddenTagHits.map((h) => h.name).join(', ')}`
      : '',
    disallowedUrls.length ? `許可外URL検出: ${disallowedUrls.join(', ')}` : '',
  ]
    .filter(Boolean)
    .join(' / ')
);

// 4. Android ボタンの初期 href が Releases latest ページである（INV-10）
const FALLBACK_URL = 'https://github.com/kei4eva4/climbai-dist/releases/latest';
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
    /https:\/\/kei4eva4\.github\.io\/climbai-dist\/?/
  );
  displayedUrl = urlInSection ? urlInSection[0] : null;
}
check(
  '5. QR payload コメント === ページ内表示 URL（INV-12）',
  !!qrCommentMatch && !!displayedUrl && qrCommentMatch[1] === displayedUrl,
  `コメント: ${qrCommentMatch ? qrCommentMatch[1] : 'なし'} / 表示: ${displayedUrl ?? 'なし'}`
);

// 6. 秘密パターンが0件（INV-9）
const SECRET_PATTERNS = [
  /AQ\.[A-Za-z0-9_-]{20,}/,
  /AIza[0-9A-Za-z_-]{10,}/,
  /\?key=/,
  /-----BEGIN/,
];
const secretHits = SECRET_PATTERNS.filter((re) => re.test(html));
check(
  '6. 秘密パターン0件（INV-9）',
  secretHits.length === 0,
  secretHits.length ? `検出パターン: ${secretHits.map((r) => r.source).join(', ')}` : ''
);

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
