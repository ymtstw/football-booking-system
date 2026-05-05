/**
 * Staging: Vercel の scheduled Cron は動かない前提で、本番と同じルートを手動 GET する。
 *
 * マッチング案内（試合スケジュール・開催に関する案内）= send-matching-proposal。
 * 本番は開催2日前 16:00 JST。Staging では開催日を指定し skipTimeGate で「今が16時」とみなしてテストする。
 *
 * 例: 5/4 開催の「2日前16時」相当（event_date が DB で 2026-05-04 のとき）
 *   npm run cron:staging-matching -- 2026-05-04
 *
 * URL は targetEventDate + skipTimeGate=1（Bearer CRON_SECRET）。最新 API では 16:00 前でも送信フローに入る。
 * 応答が before_ops_confirm_time のままなら Staging が未デプロイ。
 */
import { config } from "dotenv";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
config({ path: resolve(__dirname, "..", ".env.staging") });
config({ path: resolve(__dirname, "..", ".env.local") });

function die(msg) {
  console.error(msg);
  process.exit(1);
}

const baseRaw =
  process.env.STAGING_BASE_URL?.trim() ||
  process.env.STAGING_CRON_BASE_URL?.trim() ||
  "https://stg-rsv-soccer.greenplanet-project.com";
const base = baseRaw.replace(/\/$/, "");
const secret = process.env.CRON_SECRET?.trim();

if (!secret || secret.length < 16) {
  die(
    "CRON_SECRET が未設定か 16 文字未満です。Vercel Staging の値を .env.staging 等に設定してください。"
  );
}

const [mode, dateArg, ...rest] = process.argv.slice(2);
if (rest.length > 0) {
  die("引数が多すぎます。例: npm run cron:staging-matching -- 2026-05-04");
}

if (!mode || !["matching", "final", "help"].includes(mode)) {
  console.log(`使い方:
  node scripts/run-staging-email-crons.mjs matching <YYYY-MM-DD>   # マッチング案内（16:00想定）
  node scripts/run-staging-email-crons.mjs final <YYYY-MM-DD>     # 前日最終（16:30想定）

  日付を省略すると、本番と同じくサーバーの「東京暦」だけで対象が決まります（クエリ付きません）。

  開催日は YYYY-MM-DD で指定。マッチング案内は自動で skipTimeGate=1 を付けます。
  before_ops_confirm_time が返る場合は API が古いか、targetEventDate 省略で 16:00 前に実行した可能性があります。`);
  process.exit(mode === "help" ? 0 : 1);
}

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

function buildUrl(path, eventDate) {
  const u = new URL(path, base);
  if (eventDate) {
    if (!ISO_DATE.test(eventDate)) {
      die("日付は YYYY-MM-DD 形式にしてください。");
    }
    u.searchParams.set("targetEventDate", eventDate);
    if (path.includes("send-matching-proposal")) {
      u.searchParams.set("skipTimeGate", "1");
    }
  }
  return u.toString();
}

async function runOne(name, url) {
  console.log(`\n--- ${name} ---\nGET ${url}`);
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${secret}` },
  });
  const text = await res.text();
  let body;
  try {
    body = JSON.parse(text);
  } catch {
    body = { _parseError: true, raw: text.slice(0, 800) };
  }
  console.log(`HTTP ${res.status}`);
  console.log(JSON.stringify(body, null, 2));
  if (!res.ok) {
    die(`失敗: ${name} (HTTP ${res.status})`);
  }
  return body;
}

async function main() {
  const eventDate = dateArg && ISO_DATE.test(dateArg) ? dateArg : undefined;
  if (dateArg && !eventDate) {
    die("日付は YYYY-MM-DD か、省略してください。");
  }

  if (mode === "matching") {
    const path = "/api/cron/send-matching-proposal";
    const url = buildUrl(path, eventDate);
    const body = await runOne("マッチング案内（send-matching-proposal）", url);
    if (body.skippedReason === "before_ops_confirm_time") {
      console.log(
        "\n※ まだ「16:00前スキップ」です。targetEventDate と skipTimeGate を付ける修正が Staging に載っていない可能性が高いです。main を Staging にデプロイ後に再実行してください。"
      );
    }
  } else {
    const path = "/api/cron/send-day-before-final";
    const url = buildUrl(path, eventDate);
    await runOne("前日最終（send-day-before-final）", url);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
