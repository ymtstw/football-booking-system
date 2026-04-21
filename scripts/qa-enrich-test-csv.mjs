/**
 * MVP_Minimum_Run / Master_TestSpec に「実施方式・環境・自動化対象・前提・備考」を付与する。
 * 入力: docs/qa/*.source.csv → 出力: docs/qa/MVP_Minimum_Run.csv, docs/qa/Master_TestSpec.csv
 */
import fs from "node:fs";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..");
const qaDir = path.join(root, "docs", "qa");

/** @type {Record<string, { way: string; env: string; auto: string; prereq: string; note: string; stagingUrlOnly?: boolean; stagingSmokeItImplemented?: boolean }>} */
const BY_CASE_ID = {
  "AL-001": {
    way: "manual",
    env: "staging",
    auto: "no",
    prereq: "なし",
    note: "未ログインCookieで保護URL。staging-smoke は fetch のみのため未カバー。Playwright 等で将来自動化可",
  },
  "AL-002": {
    way: "manual",
    env: "staging",
    auto: "no",
    prereq: "非adminのログイン済みアカウント",
    note: "403/リダイレクトはブラウザ確認が主",
  },
  "AL-003": {
    way: "manual",
    env: "staging",
    auto: "no",
    prereq: "app_admins ユーザーのログイン済みセッション",
    note: "管理画面表示の目視確認",
  },
  "MVP-DASH-400": {
    way: "staging-smoke",
    env: "staging",
    auto: "partial",
    prereq: "admin cookie必要（STAGING_ADMIN_COOKIE）",
    note: "tests/staging/staging-smoke.staging.test.ts。Cookie 未設定時は it skip",
  },
  "MVP-DASH-200": {
    way: "staging-smoke",
    env: "staging",
    auto: "partial",
    prereq: "admin cookie必要",
    note: "同上。after=2099-12-31 で day:null を検証。別分岐（開催日あり）はデータ依存のため未網羅",
  },
  "API-ED-001": {
    way: "staging-smoke",
    env: "staging",
    auto: "yes",
    prereq: "なし",
    note: "staging-smoke.staging.test.ts（acceptingReservations 整合）",
    stagingUrlOnly: true,
  },
  "API-AV-001": {
    way: "staging-smoke",
    env: "staging",
    auto: "yes",
    prereq: "なし",
    note: "400 と 404 の2ケースを同一IDで自動化",
    stagingUrlOnly: true,
  },
  "RSV-001": {
    way: "manual",
    env: "local",
    auto: "partial",
    prereq: "なし（UI）",
    note:
      "【MVP・将来の最優先自動化候補】公開予約の必須バリデーション（枠未選択で止まる）。現状は manual（目視）。自動化の候補レイヤー: ①component test（フォーム・バリデーション最短）②local-integration（必要なら MSW 等で submit 前まで）③Playwright/E2E（実ブラウザの最終確認）。①→②の順で効果が大きい想定。",
  },
  "RSV-002": {
    way: "manual",
    env: "local",
    auto: "partial",
    prereq: "なし（UI）",
    note:
      "【MVP・将来の最優先自動化候補】参加人数の境界バリデーション。現状は manual。候補: ①component test ②local-integration ③Playwright/E2E。RSV-001 と同方針で統一しやすい。",
  },
  "RSV-003": {
    way: "manual",
    env: "local",
    auto: "partial",
    prereq: "なし（UI）",
    note:
      "【MVP・将来の最優先自動化候補】昼食合計0の必須ルール。現状は manual。候補: ①component test ②local-integration ③Playwright/E2E。RSV-001 と同方針で統一しやすい。",
  },
  "RSV-006": {
    way: "local-integration",
    env: "local",
    auto: "partial",
    prereq: "開催日・枠・締切前の seed / テストDB",
    note: "POST /api/reservations と DB 整合。Staging はデータ汚染リスクのため local 推奨",
  },
  "RSV-010": {
    way: "local-integration",
    env: "both",
    auto: "partial",
    prereq: "受付可能な開催日seed・枠空き（API/DB 側）。sessionStorage・画面遷移は別途 manual/E2E",
    note:
      "【切り分け】①HTTP 201・レスポンス body・DB 整合（予約行・関連テーブル）→ local-integration（API route / integration テスト）で自動化するのが第一。②sessionStorage への保存・/reserve/complete への画面遷移・表示確認 → manual または Playwright 等の E2E で別スイートとして扱う。①のみではケース完了扱いにしない運用推奨。",
  },
  "RSV-011": {
    way: "manual",
    env: "local",
    auto: "partial",
    prereq: "DevTools Network 推奨",
    note: "連打時の fetch 重複抑止はブラウザ操作が主",
  },
  "RSV-020": {
    way: "local-integration",
    env: "local",
    auto: "partial",
    prereq: "締切後の open 開催日 seed",
    note: "409 とメッセージの確認",
  },
  "RSV-021": {
    way: "local-integration",
    env: "local",
    auto: "partial",
    prereq: "満枠・ロック状態の seed",
    note: "Staging では再現コストが高い",
  },
  "RSV-022": {
    way: "local-integration",
    env: "local",
    auto: "yes",
    prereq: "なし（不正UUID）",
    note: "API のみなら local の route テストで可",
  },
  "RSV-023": {
    way: "local-integration",
    env: "local",
    auto: "partial",
    prereq: "draft 等ステータスの開催日 seed",
    note: "非公開日の拒否",
  },
  "TK-001": {
    way: "staging-smoke",
    env: "staging",
    auto: "yes",
    prereq: "なし",
    note: "staging-smoke.staging.test.ts",
    stagingUrlOnly: true,
  },
  "TK-002": {
    way: "local-integration",
    env: "local",
    auto: "partial",
    prereq: "締切後の active 予約トークン・DB読取",
    note: "PATCH と DB 不変。Staging ではデータ準備が重い",
  },
  "CK-001": {
    way: "staging-smoke",
    env: "staging",
    auto: "partial",
    prereq: "なし（Bearer誤り）／本仕様の再実行検証は別途",
    note: "401 または 503（CRON_SECRET 未設定時）を許容。staging-smoke に実装",
    stagingUrlOnly: true,
  },
  "CK-002": {
    way: "local-integration",
    env: "local",
    auto: "partial",
    prereq: "CRON_SECRET 未設定または短い値のプロセス起動",
    note: "Staging の環境変数は操作不可のため local-integration",
  },
  "CK-003": {
    way: "local-integration",
    env: "local",
    auto: "partial",
    prereq: "該当0件のDB状態",
    note: "Cron 本体の戻り配列検証",
  },
  "CK-010": {
    way: "local-integration",
    env: "local",
    auto: "partial",
    prereq: "締切前 open の seed",
    note: "",
  },
  "CK-011": {
    way: "local-integration",
    env: "local",
    auto: "partial",
    prereq: "締切後・active<3・通知モック等",
    note: "最少催行分岐はデータ依存が強い",
  },
  "CK-012": {
    way: "local-integration",
    env: "local",
    auto: "partial",
    prereq: "締切後・active>=3 の seed",
    note: "",
  },
  "CK-021": {
    way: "local-integration",
    env: "local",
    auto: "partial",
    prereq: "同一状態で2回叩ける seed",
    note: "冪等性",
  },
  "TC-EX-CU-OK": {
    way: "manual",
    env: "both",
    auto: "partial",
    prereq: "admin 認証・対象イベント状態",
    note:
      "【現時点】救済オペ寄りのため manual 優先でよい。【将来】apply-deadline-catchup の成功系は local-integration（管理 API + DB seed + モック）での自動化候補。運用フローと分けてテストファイルに切り出すと再現しやすい。",
  },
  "RM-001": {
    way: "local-integration",
    env: "local",
    auto: "partial",
    prereq: "cron secret・Bearer 検証用",
    note: "lock-event-days と同系の認証",
  },
  "RM-010": {
    way: "local-integration",
    env: "local",
    auto: "partial",
    prereq: "対象0件の locked 日なし状態",
    note: "",
  },
  "RM-011": {
    way: "local-integration",
    env: "local",
    auto: "partial",
    prereq: "locked 日・編成可能データ seed",
    note: "JOB02 主経路",
  },
  "RM-012": {
    way: "local-integration",
    env: "local",
    auto: "partial",
    prereq: "skipped 分岐用 seed",
    note: "",
  },
  "RM-013": {
    way: "local-integration",
    env: "local",
    auto: "partial",
    prereq: "失敗系 seed",
    note: "",
  },
  "TC-EX-CR-MP-06": {
    way: "local-integration",
    env: "local",
    auto: "partial",
    prereq: "通知送信モック・notifications seed",
    note: "内部分岐",
  },
  "TC-EX-CR-MP-07": {
    way: "local-integration",
    env: "local",
    auto: "partial",
    prereq: "同上",
    note: "failed 反映",
  },
  "NF-010": {
    way: "local-integration",
    env: "local",
    auto: "partial",
    prereq: "cron secret・メール送信モック",
    note: "JOB03",
  },
  "TC-EX-CR-DBF-07": {
    way: "local-integration",
    env: "local",
    auto: "partial",
    prereq: "confirmed 系 seed・通知",
    note: "",
  },
  "TC-EX-CR-DBF-10": {
    way: "local-integration",
    env: "local",
    auto: "partial",
    prereq: "locked 系 seed",
    note: "",
  },
  "NF-001": {
    way: "local-integration",
    env: "local",
    auto: "partial",
    prereq: "failed 通知・再送用 seed",
    note: "Resend モック推奨",
  },
  "MVP-NOTIF-401": {
    way: "staging-smoke",
    env: "staging",
    auto: "partial",
    prereq: "なし（未認証GET）",
    note:
      "通知一覧の未認証 401 は fetch のみで staging でも検証可能。staging-smoke.test.ts への追加が最短（現状は未収載のため partial）。追加 it 例: Cookie なしで GET /api/admin/notifications → 401",
    stagingUrlOnly: true,
    stagingSmokeItImplemented: false,
  },
  "TC-EX-NR-200S": {
    way: "local-integration",
    env: "local",
    auto: "partial",
    prereq: "admin cookie または service role・failed→sent 用 seed",
    note: "管理API",
  },
  "CHK-001": {
    way: "local-integration",
    env: "local",
    auto: "partial",
    prereq: "当日開催・チーム seed・admin",
    note: "",
  },
  "CHK-002": {
    way: "local-integration",
    env: "local",
    auto: "partial",
    prereq: "同一開催日・チームの既存行",
    note: "upsert 検証",
  },
  "MRG-001": {
    way: "local-integration",
    env: "local",
    auto: "partial",
    prereq: "2チーム・関連テーブル seed",
    note: "データ破壊的のため staging 非推奨",
  },
  "TC-EX-WX-200GO": {
    way: "local-integration",
    env: "local",
    auto: "partial",
    prereq: "開催日・admin",
    note: "",
  },
  "TC-EX-WX-200CIM": {
    way: "local-integration",
    env: "local",
    auto: "partial",
    prereq: "同上",
    note: "",
  },
  "TC-EX-WX-200CDB": {
    way: "local-integration",
    env: "local",
    auto: "partial",
    prereq: "同上",
    note: "",
  },
  "TC-EX-OP-200": {
    way: "local-integration",
    env: "local",
    auto: "partial",
    prereq: "運営中止対象 seed・admin",
    note: "",
  },
  "TC-EX-OP-200IM": {
    way: "local-integration",
    env: "local",
    auto: "partial",
    prereq: "同上＋即時通知モック",
    note: "",
  },
  "TC-EX-UN-200": {
    way: "local-integration",
    env: "local",
    auto: "partial",
    prereq: "編成済みデータ・admin",
    note: "",
  },
  P0: {
    way: "manual",
    env: "both",
    auto: "no",
    prereq: "Release_Gate シート連携",
    note: "チェックリスト全体。自動化対象外",
  },
};

/**
 * @param {string} text
 * @returns {string[][]}
 */
function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = "";
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += c;
      }
      continue;
    }
    if (c === '"') {
      inQuotes = true;
      continue;
    }
    if (c === ",") {
      row.push(field);
      field = "";
      continue;
    }
    if (c === "\n" || (c === "\r" && text[i + 1] === "\n")) {
      if (c === "\r") i++;
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
      continue;
    }
    if (c === "\r") {
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
      continue;
    }
    field += c;
  }
  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  return rows;
}

/**
 * @param {string[]} fields
 */
function stringifyRow(fields) {
  return fields
    .map((f) => {
      const s = f == null ? "" : String(f);
      if (/[",\r\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
      return s;
    })
    .join(",");
}

/**
 * Master 専用: BY_CASE_ID に無いケースID向けの簡易推定
 * @param {string} id
 * @param {string} screenApi
 * @param {string} implRef
 */
function inferMaster(id, screenApi, implRef) {
  if (!id || id === "—") {
    return {
      way: "manual",
      env: "both",
      auto: "no",
      prereq: "個別確認",
      note: "ケースIDなし行",
    };
  }
  if (BY_CASE_ID[id]) return null;

  const impl = implRef ?? "";
  if (/tests\/integration\//i.test(impl)) {
    return {
      way: "local-integration",
      env: "local",
      auto: "partial",
      prereq: ".env.test・テスト用DB（実装参照の vitest 前提）",
      note: "既存 integration テストに追従（ヒューリスティック）",
    };
  }

  const api = screenApi ?? "";
  if (/^GET \/$|^GET \/reserve|^画面:/.test(api) || /ログイン|リダイレクト|Cookie/.test(api)) {
    return { way: "manual", env: "staging", auto: "no", prereq: "ブラウザセッション", note: "画面・遷移中心（ヒューリスティック）" };
  }
  if (id.startsWith("AL-")) {
    return { way: "manual", env: "staging", auto: "no", prereq: "なし〜adminアカウント", note: "Master 行: AL 系ヒューリスティック" };
  }
  if (/cron|Cron|\/api\/cron/i.test(api) || id.startsWith("CK-") || id.startsWith("RM-") || id.startsWith("NF-")) {
    return {
      way: "local-integration",
      env: "local",
      auto: "partial",
      prereq: "cron secret・seed・モック",
      note: "Staging で環境操作が難しい前提（ヒューリスティック）",
    };
  }
  if (/^GET \/api\/|^PATCH \/api\/|^POST \/api\//.test(api)) {
    if (/\/api\/admin\//.test(api)) {
      return {
        way: "local-integration",
        env: "local",
        auto: "partial",
        prereq: "admin cookie または service role・seed",
        note: "管理API（ヒューリスティック）",
      };
    }
    return {
      way: "local-integration",
      env: "local",
      auto: "partial",
      prereq: "seed により異なる",
      note: "公開APIの状態依存ケース（ヒューリスティック）",
    };
  }
  return {
    way: "manual",
    env: "both",
    auto: "no",
    prereq: "個別確認",
    note: "デフォルト分類（必要なら BY_CASE_ID に追加）",
  };
}

function enrichMvp() {
  const srcPath = path.join(qaDir, "MVP_Minimum_Run.source.csv");
  const raw = fs.readFileSync(srcPath, "utf8");
  /** @type {string[][]} */
  const rows = parseCsv(raw.replace(/^\uFEFF/, ""));
  const newHeaders = ["実施方式", "実施環境", "自動化対象", "前提データ", "備考"];
  const out = [];
  for (let r = 0; r < rows.length; r++) {
    const line = rows[r];
    if (r === 0) {
      out.push([...line, ...newHeaders]);
      continue;
    }
    const id = (line[2] ?? "").trim();
    const phase = (line[0] ?? "").trim();
    if (!id || phase === "実施方針" || phase === "目安時間") {
      out.push([...line, "", "", "", "", ""]);
      continue;
    }
    const meta = BY_CASE_ID[id];
    if (meta) {
      out.push([...line, meta.way, meta.env, meta.auto, meta.prereq, meta.note]);
    } else {
      out.push([...line, "", "", "", "", "未定義ID:" + id]);
    }
  }
  const outPath = path.join(qaDir, "MVP_Minimum_Run.csv");
  fs.writeFileSync(outPath, out.map(stringifyRow).join("\n") + "\n", "utf8");

  // サマリ: テストケース行（区分がテストケースまたはリリースゲートで ID あり）
  let nStagingUrlOnly = 0;
  let nStagingSmoke = 0;
  let nStagingSmokeItInRepo = 0;
  let nManual = 0;
  let nUnautomated = 0;
  for (let r = 1; r < rows.length; r++) {
    const line = rows[r];
    const id = (line[2] ?? "").trim();
    const phase = (line[0] ?? "").trim();
    if (!id || phase === "実施方針" || phase === "目安時間") continue;
    const m = BY_CASE_ID[id];
    if (!m) continue;
    if (m.way === "manual") {
      nManual++;
      continue;
    }
    if (m.way === "staging-smoke") {
      nStagingSmoke++;
      if (m.stagingUrlOnly) nStagingUrlOnly++;
      if (m.stagingSmokeItImplemented !== false) nStagingSmokeItInRepo++;
      continue;
    }
    nUnautomated++;
  }

  const nTotalCases = nManual + nStagingSmoke + nUnautomated;
  const summary = {
    MVP_テストケース行数: nTotalCases,
    今の自動化で実行可能_STAGING_BASE_URLのみでstaging_smoke分類: nStagingUrlOnly,
    実施方式_staging_smoke_件数: nStagingSmoke,
    staging_smoke_test_tsにit実装済_件数: nStagingSmokeItInRepo,
    うちadmin_cookie要: nStagingSmoke - nStagingUrlOnly,
    手動実施: nManual,
    未自動化_local_integration等: nUnautomated,
  };
  return summary;
}

function enrichMaster() {
  const srcPath = path.join(qaDir, "Master_TestSpec.source.csv");
  const raw = fs.readFileSync(srcPath, "utf8");
  const rows = parseCsv(raw.replace(/^\uFEFF/, ""));
  if (rows.length < 2) throw new Error("Master empty");
  const header = rows[0];
  const idIdx = header.indexOf("ケースID");
  if (idIdx < 0) throw new Error("ケースID column missing");
  const screenIdx = header.indexOf("画面/API");
  const implIdx = header.indexOf("実装参照");
  const newHeaders = ["実施方式", "実施環境", "自動化対象", "前提データ", "実行備考"];
  const out = [[...header, ...newHeaders]];
  for (let r = 1; r < rows.length; r++) {
    const line = rows[r];
    while (line.length < header.length) line.push("");
    const id = (line[idIdx] ?? "").trim();
    let pack = BY_CASE_ID[id] ? { ...BY_CASE_ID[id] } : null;
    if (!pack) {
      pack = inferMaster(id, line[screenIdx] ?? "", implIdx >= 0 ? line[implIdx] ?? "" : "");
    }
    const { stagingUrlOnly: _u, ...rest } = pack;
    out.push([
      ...line.slice(0, header.length),
      rest.way,
      rest.env,
      rest.auto,
      rest.prereq,
      rest.note ?? "",
    ]);
  }
  const outPath = path.join(qaDir, "Master_TestSpec.csv");
  fs.writeFileSync(outPath, out.map(stringifyRow).join("\n") + "\n", "utf8");
}

const summary = enrichMvp();
enrichMaster();
console.log(JSON.stringify(summary, null, 2));
console.log(`
MVP_Minimum_Run（テストケース行 ${summary.MVP_テストケース行数} 件）件数サマリ:
・実施方式 staging-smoke: ${summary.実施方式_staging_smoke_件数} 件（うち staging-smoke.test.ts に it 実装済: ${summary.staging_smoke_test_tsにit実装済_件数} 件。MVP-NOTIF-401 は追加候補で未収載）
・STAGING_BASE_URL のみで足りる分類（Cookie 不要）: ${summary.今の自動化で実行可能_STAGING_BASE_URLのみでstaging_smoke分類} 件
・STAGING_ADMIN_COOKIE 要（未設定時は skip）: ${summary.うちadmin_cookie要} 件（MVP-DASH-400 / MVP-DASH-200）
・未自動化（local-integration 等・別途テスト整備）: ${summary.未自動化_local_integration等} 件
・手動実施（実施方式=manual）: ${summary.手動実施} 件
出力: docs/qa/MVP_Minimum_Run.csv / docs/qa/Master_TestSpec.csv
`);
