/**
 * ローカル（または任意のベース URL）で前日フロー相当の Cron を順に実行する。
 * 1) lock-event-days  2) run-matching-locked  3) send-matching-proposal  4) send-day-before-final
 *
 * 前提: .env.local に CRON_SECRET（16文字以上）と Supabase / Resend 等が入っていること。
 * 別ターミナルで `npm run dev` 済みで、LOCAL_CRON_BASE_URL（既定 localhost:3000）が応答すること。
 *
 * 使い方:
 *   node scripts/run-local-day-before-cron.mjs
 *   node scripts/run-local-day-before-cron.mjs --check   # 接続テストのみ（GET ルートに HEAD 相当はせず env のみ検証）
 */
import { config } from "dotenv";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
config({ path: resolve(__dirname, "..", ".env.local") });

const STEPS = [
  { name: "JOB01 締切ロック", path: "/api/cron/lock-event-days" },
  { name: "JOB02 自動編成", path: "/api/cron/run-matching-locked" },
  { name: "マッチング案内メール", path: "/api/cron/send-matching-proposal" },
  { name: "JOB03 前日最終メール", path: "/api/cron/send-day-before-final" },
];

function die(msg) {
  console.error(msg);
  process.exit(1);
}

const args = new Set(process.argv.slice(2));
const checkOnly = args.has("--check");

const baseRaw = process.env.LOCAL_CRON_BASE_URL?.trim() || "http://localhost:3000";
const base = baseRaw.replace(/\/$/, "");
const secret = process.env.CRON_SECRET?.trim();

if (!secret || secret.length < 16) {
  die(
    "CRON_SECRET が未設定か 16 文字未満です。.env.local を確認してください（.env.example 参照）。"
  );
}

if (!process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() || !process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()) {
  die("NEXT_PUBLIC_SUPABASE_URL と SUPABASE_SERVICE_ROLE_KEY が .env.local に必要です。");
}

if (checkOnly) {
  console.log("[check] 環境変数 OK");
  console.log(`[check] ベース URL: ${base}`);
  console.log(`[check] 実行予定: ${STEPS.map((s) => s.path).join(" → ")}`);
  console.log("[check] メール送信には RESEND_API_KEY / RESEND_FROM も必要です（未設定なら案内・JOB03 で送信スキップ）。");
  process.exit(0);
}

async function callStep({ name, path }) {
  const url = `${base}${path}`;
  console.log(`\n--- ${name} ---\nGET ${url}`);
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${secret}` },
  });
  const text = await res.text();
  let body;
  try {
    body = JSON.parse(text);
  } catch {
    body = { _parseError: true, raw: text.slice(0, 500) };
  }
  console.log(`HTTP ${res.status}`);
  console.log(JSON.stringify(body, null, 2));
  if (!res.ok) {
    die(`\n中止: ${name} が失敗しました (HTTP ${res.status})。`);
  }
}

async function main() {
  console.log("ローカル前日 Cron 連続実行（JOB01 → JOB02 → 案内 → JOB03）");
  console.log(`ベース URL: ${base}`);
  for (const step of STEPS) {
    await callStep(step);
  }
  console.log("\n完了。JOB03 後は notifications / 受信トレイを確認してください。");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
