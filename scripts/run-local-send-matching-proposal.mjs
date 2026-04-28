/**
 * ローカル（または任意のベース URL）で「マッチング案内メール」Cron を単体実行する。
 *
 * 前提: .env.local に CRON_SECRET（16文字以上）と Supabase / Resend 等が入っていること。
 * 別ターミナルで `npm run dev` 済みで、LOCAL_CRON_BASE_URL（既定 localhost:3000）が応答すること。
 *
 * 使い方:
 *   node scripts/run-local-send-matching-proposal.mjs --target 2026-05-01
 */
import { config } from "dotenv";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import process from "process";

const __dirname = dirname(fileURLToPath(import.meta.url));
config({ path: resolve(__dirname, "..", ".env.local") });

function die(msg) {
  console.error(msg);
  process.exit(1);
}

const baseRaw = process.env.LOCAL_CRON_BASE_URL?.trim() || "http://localhost:3000";
const base = baseRaw.replace(/\/$/, "");
const secret = process.env.CRON_SECRET?.trim();
if (!secret || secret.length < 16) {
  die("CRON_SECRET が未設定か 16 文字未満です。.env.local を確認してください。");
}

const args = process.argv.slice(2);
const idx = args.findIndex((a) => a === "--target");
const target = idx >= 0 ? String(args[idx + 1] ?? "").trim() : "";
if (!/^\d{4}-\d{2}-\d{2}$/.test(target)) {
  die("引数 --target YYYY-MM-DD が必要です（例: --target 2026-05-01）。");
}

async function main() {
  const url = `${base}/api/cron/send-matching-proposal?targetEventDate=${encodeURIComponent(target)}`;
  console.log(`\n--- マッチング案内メール（単体実行） ---\nGET ${url}`);
  const res = await fetch(url, { headers: { Authorization: `Bearer ${secret}` } });
  const text = await res.text();
  let body;
  try {
    body = JSON.parse(text);
  } catch {
    body = { _parseError: true, raw: text.slice(0, 500) };
  }
  console.log(`HTTP ${res.status}`);
  console.log(JSON.stringify(body, null, 2));
  if (!res.ok) process.exit(1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

