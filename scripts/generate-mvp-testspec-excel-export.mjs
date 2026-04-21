/**
 * docs/qa/MVP_TestSpec_Source.csv を読み、Excel 取込用に実施記録列を付与した
 * docs/qa/MVP_TestSpec_Excel_Export.csv を生成する（UTF-8 BOM）。
 * 実行: node scripts/generate-mvp-testspec-excel-export.mjs
 */
import fs from "node:fs";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..");
const srcPath = path.join(root, "docs", "qa", "MVP_TestSpec_Source.csv");
const outPath = path.join(root, "docs", "qa", "MVP_TestSpec_Excel_Export.csv");

const extraHeader =
  "実施者,実施日,試験結果,証跡URLまたはログ要約,不備・差戻し内容,自動実行ログ参照,備考（実施時）";

const raw = fs.readFileSync(srcPath, "utf8");
const lines = raw.split(/\r?\n/).filter((l) => l.length > 0);

const header = lines[0];
const outLines = [`\uFEFF${header},${extraHeader}`];

for (let i = 1; i < lines.length; i++) {
  outLines.push(`${lines[i]},,,,,,`);
}

fs.writeFileSync(outPath, outLines.join("\n"), "utf8");
console.log("Wrote", outPath, "lines", outLines.length);
