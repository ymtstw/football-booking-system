/**
 * unit → integration → staging を順に実行し、終了コードに応じて
 * docs/qa/MVP_TestSpec_Execution_Report.csv を再生成する。
 *
 * 実行: npm run qa:tests-and-report
 *
 * 前提:
 *   - integration: ローカル Supabase + .env.test（従来どおり）
 *   - staging: .env.staging.example または .env.staging（STAGING_BASE_URL）
 */
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..");
process.chdir(root);

/** Windows で PowerShell の Execution Policy により npm.ps1 が拒否される場合があるため cmd 側を使う */
const npmCli = process.platform === "win32" ? "npm.cmd" : "npm";

const runDate = new Date().toISOString().slice(0, 10);

function runNpm(scriptName) {
  const r = spawnSync(npmCli, ["run", scriptName], {
    encoding: "utf-8",
    shell: true,
    stdio: ["inherit", "pipe", "pipe"],
  });
  const out = `${r.stdout ?? ""}\n${r.stderr ?? ""}`;
  return { ok: r.status === 0, status: r.status ?? -1, out };
}

console.log("=== npm run test:unit ===\n");
const unit = runNpm("test:unit");
process.stdout.write(unit.out);
console.log(unit.ok ? "\n[unit] OK\n" : "\n[unit] NG\n");

console.log("=== npm run test:integration ===\n");
const integ = runNpm("test:integration");
process.stdout.write(integ.out);
console.log(integ.ok ? "\n[integration] OK\n" : "\n[integration] NG\n");

console.log("=== npm run test:staging ===\n");
const staging = runNpm("test:staging");
process.stdout.write(staging.out);
console.log(staging.ok ? "\n[staging] OK\n" : "\n[staging] NG\n");

// staging サマリ（Vitest の Tests 行を拾う）
let stagingSummary = "npm run test:staging 未実行または失敗";
if (staging.ok) {
  const line = staging.out.split(/\n/).find((l) => /Tests\s+\d+/.test(l));
  stagingSummary = line
    ? `npm run test:staging: ${line.replace(/\s+/g, " ").trim()}`
    : "npm run test:staging: OK（件数行は未検出）";
}

process.env.REPORT_RUN_DATE = runDate;
process.env.REPORT_UNIT_OK = unit.ok ? "1" : "0";
process.env.REPORT_INTEGRATION_OK = integ.ok ? "1" : "0";
process.env.REPORT_STAGING_RAN = staging.ok ? "1" : "0";
process.env.REPORT_STAGING_SUMMARY = stagingSummary;

console.log("=== npm run qa:execution-report ===\n");
const report = spawnSync("node", ["scripts/generate-mvp-testspec-execution-report.mjs"], {
  encoding: "utf-8",
  shell: true,
  cwd: root,
  stdio: ["inherit", "pipe", "inherit"],
});
if (report.stdout) process.stdout.write(report.stdout);
if (report.status !== 0) {
  console.error("レポート生成に失敗しました");
  process.exit(report.status ?? 1);
}

const outPath = path.join(root, "docs", "qa", "MVP_TestSpec_Execution_Report.csv");
console.log(`\n更新: ${outPath}`);
console.log(
  `\nサマリ: unit=${unit.ok ? "OK" : "NG"} integration=${integ.ok ? "OK" : "NG"} staging=${staging.ok ? "OK" : "NG"}`
);

if (!unit.ok || !integ.ok || !staging.ok) {
  process.exit(1);
}
