/**
 * Staging の Vercel Cron JOB01 相当: 締切到達した open 開催日 → 中止 or ロック → 同一リクエスト内で自動編成。
 * GET /api/cron/lock-event-days（認証: Authorization: Bearer CRON_SECRET）
 *
 * 前提:
 * - Vercel Staging の Environment Variables に CRON_SECRET（16文字以上）がある。
 * - 手元では .env.staging または .env.local に CRON_SECRET=... を置く（本リポジトリにコミットしない）。
 * - 対象の event_days は status=open かつ reservation_deadline_at <= 実行時刻。まだ締切が未来だと 0 件。
 *
 * 5/4・5/5 をまとめて処理するときの例（Staging Supabase の SQL、運用判断のうえで）:
 *   UPDATE event_days
 *   SET reservation_deadline_at = NOW() - INTERVAL '1 minute'
 *   WHERE status = 'open'
 *     AND event_date IN ('2026-05-04', '2026-05-05');
 * その後、このスクリプトを 1 回実行。
 *
 * 使い方:
 *   node scripts/run-staging-job01-cron.mjs
 *   STAGING_BASE_URL=https://... CRON_SECRET=... node scripts/run-staging-job01-cron.mjs
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
    "CRON_SECRET が未設定か 16 文字未満です。Vercel Staging の CRON_SECRET を .env.staging 等に設定してください。"
  );
}

const path = "/api/cron/lock-event-days";
const url = `${base}${path}`;

async function main() {
  console.log("Staging JOB01（lock-event-days + 自動編成）");
  console.log(`GET ${url}`);
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
    die(`失敗: HTTP ${res.status}`);
  }
  if (body.lockedCount === 0 && body.minimumCancelledCount === 0) {
    console.log(
      "\n注意: 処理件数 0。open かつ reservation_deadline_at が実行時刻以前の行がありません。上記 SQL で締切を過去に合わせてから再実行してください。"
    );
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
