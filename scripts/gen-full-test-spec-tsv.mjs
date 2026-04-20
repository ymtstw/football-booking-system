/**
 * 運用レビュー向けテスト仕様 TSV を生成する（単一の正本出力）。
 *
 * 実行: node scripts/gen-full-test-spec-tsv.mjs
 * 出力: docs/test-spec/full-system-test-spec.tsv（UTF-8 BOM 付き）
 *
 * 旧フォーマット（15 列・TC-* 網羅 400 行超）は git 履歴参照。
 * 移行メモ: docs/test-spec/TEST-SPEC-MIGRATION.md
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { getReviewableSpecRows } from "./test-spec-reviewable-data.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const outPath = join(__dirname, "..", "docs", "test-spec", "full-system-test-spec.tsv");

const headers = [
  "機能",
  "画面/API",
  "ケースID",
  "テストケース名",
  "前提条件",
  "入力",
  "手順",
  "期待結果",
  "観点",
  "種別",
  "優先度",
  "備考",
];

const ALLOWED_SHUBETSU = new Set([
  "正常系",
  "異常系",
  "境界値",
  "権限",
  "状態遷移",
  "冪等性",
  "整合性",
]);

/** TSV セル内の改行・タブを除去 */
function cell(s) {
  return String(s ?? "")
    .replace(/\r\n|\r|\n/g, " ")
    .replace(/\t/g, " ");
}

const rows = getReviewableSpecRows();
const idSet = new Set();
for (const r of rows) {
  const id = r["ケースID"];
  if (!id) throw new Error("ケースID 欠落行あり");
  if (idSet.has(id)) throw new Error(`ケースID 重複: ${id}`);
  idSet.add(id);
  const sh = r["種別"];
  if (!ALLOWED_SHUBETSU.has(sh)) {
    throw new Error(`種別が許容値外: ${id} → ${sh}`);
  }
  for (const h of headers) {
    if (r[h] === undefined || r[h] === null) {
      throw new Error(`列欠落: ${id} → ${h}`);
    }
  }
}

const bom = "\uFEFF";
const lines = [bom + headers.join("\t")];
for (const r of rows) {
  lines.push(headers.map((h) => cell(r[h])).join("\t"));
}
mkdirSync(dirname(outPath), { recursive: true });
writeFileSync(outPath, lines.join("\n") + "\n", "utf8");

console.log(`Wrote ${rows.length} rows (+ header) to ${outPath}`);
