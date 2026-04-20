/**
 * 全システム網羅のテスト仕様TSVを生成（Excel取込前提）。
 * 実行: node scripts/gen-full-test-spec-tsv.mjs
 * 出力: docs/test-spec/full-system-test-spec.tsv（UTF-8 BOM付き）
 */
import { writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const outPath = join(__dirname, "..", "docs", "test-spec", "full-system-test-spec.tsv");

const headers = [
  "テストID",
  "レベル",
  "大分類",
  "中分類",
  "対象ID",
  "テストケース名",
  "観点区分",
  "前提条件",
  "手順",
  "期待結果",
  "確認証跡",
  "優先度",
  "自動化",
  "実装参照",
  "備考",
];

/** TSVセル内の改行・タブを除去 */
function cell(s) {
  return String(s ?? "")
    .replace(/\r\n|\r|\n/g, " ")
    .replace(/\t/g, " ");
}

const rows = [];

function add(r) {
  rows.push(headers.map((h) => cell(r[h] ?? "")));
}

const L1 = "L1システム";
const L2 = "L2画面";
const L3 = "L3API";

// --- メタ・全体 ---
add({
  テストID: "TC-META-001",
  レベル: L1,
  大分類: "メタ",
  中分類: "ドキュメント整合",
  対象ID: "SPEC",
  テストケース名: "正本仕様パスがリポジトリ内に存在する",
  観点区分: "正常",
  前提条件: "リポジトリ取得済み",
  手順: "docs/spec/README.md と implemented-behavior-catalog.md を開く",
  期待結果: "ファイルが存在し、記載の読み順が矛盾しない",
  確認証跡: "ファイルツリー",
  優先度: "P2",
  自動化: "要検討",
  実装参照: "docs/spec/",
  備考: "",
});

add({
  テストID: "TC-META-002",
  レベル: L1,
  大分類: "メタ",
  中分類: "ビルド",
  対象ID: "BUILD",
  テストケース名: "TypeScriptビルドが通る",
  観点区分: "正常",
  前提条件: "依存インストール済み",
  手順: "npm run build を実行",
  期待結果: "exit 0、エラーなし",
  確認証跡: "CIログ",
  優先度: "P0",
  自動化: "可",
  実装参照: "package.json",
  備考: "",
});

// --- 認証・管理境界 ---
const authAdmin = "Supabaseに管理者ユーザーとapp_admins登録あり";
add({
  テストID: "TC-AUTH-001",
  レベル: L3,
  大分類: "認証",
  中分類: "管理API",
  対象ID: "GET /api/admin/event-days/{id}/slots",
  テストケース名: "未ログインは401",
  観点区分: "セキュリティ",
  前提条件: "セッションCookieなし",
  手順: "任意の開催日UUIDでGET",
  期待結果: "HTTP 401、JSON error Unauthorized",
  確認証跡: "HTTPレスポンス",
  優先度: "P0",
  自動化: "可",
  実装参照: "src/lib/auth/require-admin.ts",
  備考: "",
});

add({
  テストID: "TC-AUTH-002",
  レベル: L3,
  大分類: "認証",
  中分類: "管理API",
  対象ID: "POST /api/admin/matching/undo",
  テストケース名: "Cron Bearerのみでは401（管理のみ）",
  観点区分: "セキュリティ",
  前提条件: "CRON_SECRET正しいBearer、管理セッションなし",
  手順: "undoにPOST",
  期待結果: "HTTP 401",
  確認証跡: "HTTP",
  優先度: "P0",
  自動化: "可",
  実装参照: "src/app/api/admin/matching/undo/route.ts",
  備考: "matching/runはAdminまたはCron可",
});

add({
  テストID: "TC-AUTH-003",
  レベル: L2,
  大分類: "認証",
  中分類: "管理画面",
  対象ID: "/admin/dashboard",
  テストケース名: "未認証はログインへ誘導",
  観点区分: "セキュリティ",
  前提条件: "未ログイン",
  手順: "保護ルートにアクセス",
  期待結果: "ログイン画面またはリダイレクト",
  確認証跡: "ブラウザURL",
  優先度: "P0",
  自動化: "可(E2E)",
  実装参照: "src/app/admin/(protected)/",
  備考: "レイアウトのmiddleware要確認",
});

add({
  テストID: "TC-AUTH-004",
  レベル: L3,
  大分類: "認証",
  中分類: "Cron",
  対象ID: "GET /api/cron/lock-event-days",
  テストケース名: "Bearer不正は401",
  観点区分: "セキュリティ",
  前提条件: "CRON_SECRET設定済み",
  手順: "Authorization Bearerを誤った値でGET",
  期待結果: "HTTP 401",
  確認証跡: "HTTP",
  優先度: "P0",
  自動化: "可",
  実装参照: "src/lib/cron/cron-auth.ts",
  備考: "",
});

add({
  テストID: "TC-AUTH-005",
  レベル: L3,
  大分類: "認証",
  中分類: "Cron",
  対象ID: "GET /api/cron/lock-event-days",
  テストケース名: "CRON_SECRET未設定または短すぎると503",
  観点区分: "異常",
  前提条件: "環境変数未設定または15文字以下",
  手順: "GET",
  期待結果: "HTTP 503、JSONに設定案内文言",
  確認証跡: "HTTP",
  優先度: "P1",
  自動化: "不可(環境依存)",
  実装参照: "src/app/api/cron/lock-event-days/route.ts",
  備考: "他Cronも同様",
});

// --- 公開 GET event-days ---
add({
  テストID: "TC-PUB-ED-001",
  レベル: L3,
  大分類: "公開API",
  中分類: "開催日一覧",
  対象ID: "GET /api/event-days",
  テストケース名: "200とeventDays配列",
  観点区分: "正常",
  前提条件: "DB接続可、該当ステータス行が0件以上",
  手順: "GET",
  期待結果: "200、JSONにeventDays、draftは含まれない",
  確認証跡: "JSON",
  優先度: "P0",
  自動化: "可",
  実装参照: "src/app/api/event-days/route.ts",
  備考: "status in open,locked,confirmed,cancelled_*",
});

add({
  テストID: "TC-PUB-ED-002",
  レベル: L3,
  大分類: "公開API",
  中分類: "開催日一覧",
  対象ID: "GET /api/event-days",
  テストケース名: "acceptingReservationsはopenかつ締切未来のみtrue",
  観点区分: "境界",
  前提条件: "openで締切過去の行と、openで締切未来の行が混在",
  手順: "GETして各行を確認",
  期待結果: "締切過去のopenはfalse、未来はtrue",
  確認証跡: "JSON",
  優先度: "P0",
  自動化: "可",
  実装参照: "src/app/api/event-days/route.ts",
  備考: "",
});

add({
  テストID: "TC-PUB-ED-003",
  レベル: L3,
  大分類: "公開API",
  中分類: "開催日一覧",
  対象ID: "GET /api/event-days",
  テストケース名: "morningRemainingVacanciesは受付中のみ数値",
  観点区分: "正常",
  前提条件: "上記",
  手順: "acceptingReservations falseの日はnull",
  期待結果: "nullまたは数値の整合",
  確認証跡: "JSON",
  優先度: "P1",
  自動化: "可",
  実装参照: "src/app/api/event-days/route.ts",
  備考: "",
});

// --- availability ---
add({
  テストID: "TC-PUB-AV-001",
  レベル: L3,
  大分類: "公開API",
  中分類: "空き状況",
  対象ID: "GET /api/event-days/{date}/availability",
  テストケース名: "date形式不正は400",
  観点区分: "異常",
  前提条件: "-",
  手順: "date=not-a-dateでGET",
  期待結果: "400、YYYY-MM-DDメッセージ",
  確認証跡: "HTTP",
  優先度: "P1",
  自動化: "可",
  実装参照: "src/app/api/event-days/[date]/availability/route.ts",
  備考: "",
});

add({
  テストID: "TC-PUB-AV-002",
  レベル: L3,
  大分類: "公開API",
  中分類: "空き状況",
  対象ID: "GET /api/event-days/{date}/availability",
  テストケース名: "該当日が存在しないかdraftのみは404",
  観点区分: "異常",
  前提条件: "DBに該当event_dateなし",
  手順: "GET",
  期待結果: "404",
  確認証跡: "HTTP",
  優先度: "P1",
  自動化: "可",
  実装参照: "同上",
  備考: "",
});

add({
  テストID: "TC-PUB-AV-003",
  レベル: L3,
  大分類: "公開API",
  中分類: "空き状況",
  対象ID: "GET /api/event-days/{date}/availability",
  テストケース名: "中止系statusでも200と集計",
  観点区分: "正常",
  前提条件: "cancelled_weather等の行あり",
  手順: "GET",
  期待結果: "200、枠集計あり",
  確認証跡: "JSON",
  優先度: "P1",
  自動化: "可",
  実装参照: "同上",
  備考: "bookableはopenかつ締切前のみtrue想定（実装確認）",
});

// --- POST reservations 網羅 ---
const rpcMap = [
  ["event_not_found", "404", "対象が見つかりません"],
  ["slot_invalid", "404", "対象が見つかりません"],
  ["event_not_open", "409", "現在は予約を受け付けていません"],
  ["deadline_passed", "409", "現在は予約を受け付けていません"],
  ["slot_locked", "409", "この枠または開催日は予約できません"],
  ["slot_full", "409", "この枠または開催日は予約できません"],
  ["day_full", "409", "この枠または開催日は予約できません"],
  ["team_inactive", "409", "無効化されています"],
  ["invalid_strength", "422", "ハイレベルまたはポテンシャル"],
  ["invalid_input", "400", "入力内容を確認"],
  ["token_collision", "リトライ", "内部リトライ後201または503"],
];

for (const [code, http, msg] of rpcMap) {
  add({
    テストID: `TC-PUB-RSV-RPC-${code}`,
    レベル: L3,
    大分類: "公開API",
    中分類: "予約作成",
    対象ID: "POST /api/reservations",
    テストケース名: `RPCエラー ${code} のHTTPマッピング`,
    観点区分: "異常",
    前提条件: "create_public_reservationが当該errorを返すデータ（スタブまたはDB準備）",
    手順: "有効ボディでPOST",
    期待結果: `HTTP ${http}、メッセージに${msg}を含む（token_collisionはルートが再試行）`,
    確認証跡: "HTTP+JSON",
    優先度: code === "deadline_passed" || code === "event_not_open" ? "P0" : "P1",
    自動化: "要検討",
    実装参照: "src/app/api/reservations/route.ts mapRpcError",
    備考: "",
  });
}

const postVal = [
  ["TC-PUB-RSV-V-001", "JSON壊れ", "Invalid JSON", "400", "body: invalid"],
  ["TC-PUB-RSV-V-002", "オブジェクトでない", "リクエスト形式が不正", "400", "json: null"],
  ["TC-PUB-RSV-V-003", "eventDayId欠落", "eventDayId と selectedMorningSlotId", "400", ""],
  ["TC-PUB-RSV-V-004", "UUID形式不正", "UUID の形式が不正", "422", "v4以外の形式"],
  ["TC-PUB-RSV-V-005", "必須チーム項目欠落", "チーム名・代表者名・メール・電話は必須", "400", ""],
  ["TC-PUB-RSV-V-006", "strength不正", "ハイレベルまたはポテンシャル", "422", "strong/potential以外"],
  ["TC-PUB-RSV-V-007", "代表学年範囲外", "代表学年は1年〜6年", "422", "0 or 7"],
  ["TC-PUB-RSV-V-008", "participantCount不正", "1 以上の整数", "400", "0 or 小数"],
  ["TC-PUB-RSV-V-009", "lunchItems省略", "lunchItems は配列で", "400", "キーなし"],
  ["TC-PUB-RSV-V-010", "昼食全数量0", "昼食は、必ずご予約が必要", "422", "quantity全て0"],
  ["TC-PUB-RSV-V-011", "電話桁不正", "10〜15桁", "422", "短い数字列"],
];

for (const [id, name, exp, st, note] of postVal) {
  add({
    テストID: id,
    レベル: L3,
    大分類: "公開API",
    中分類: "予約作成バリデーション",
    対象ID: "POST /api/reservations",
    テストケース名: name,
    観点区分: "境界",
    前提条件: "レート制限未発火",
    手順: `POST JSON (${note})`,
    期待結果: `HTTP ${st}、エラーメッセージに「${exp}」を含む`,
    確認証跡: "HTTP",
    優先度: "P1",
    自動化: "可",
    実装参照: "src/app/api/reservations/route.ts",
    備考: "",
  });
}

add({
  テストID: "TC-PUB-RSV-RL-001",
  レベル: L3,
  大分類: "公開API",
  中分類: "予約作成",
  対象ID: "POST /api/reservations",
  テストケース名: "同一IP短時間超過で429",
  観点区分: "性能/セキュリティ",
  前提条件: "CREATE_LIMIT超過まで同一IPから連投",
  手順: "15回/分超のPOST",
  期待結果: "429、Retry-Afterヘッダ、集中メッセージ",
  確認証跡: "HTTPヘッダ",
  優先度: "P2",
  自動化: "可",
  実装参照: "src/lib/rate-limit/reservation-public.ts",
  備考: "CREATE_LIMIT=15/60s",
});

add({
  テストID: "TC-PUB-RSV-OK-001",
  レベル: L3,
  大分類: "公開API",
  中分類: "予約作成",
  対象ID: "POST /api/reservations",
  テストケース名: "正常系201とreservationToken返却",
  観点区分: "正常",
  前提条件: "open・締切未来・枠空き・学年帯一致",
  手順: "正しいボディでPOST",
  期待結果: "201、reservationId,teamId,reservationToken",
  確認証跡: "JSON+DB reservations行",
  優先度: "P0",
  自動化: "可",
  実装参照: "src/app/api/reservations/route.ts",
  備考: "メール送信失敗はnotificationsへ（別ケース）",
});

// --- token GET/PATCH/CANCEL ---
add({
  テストID: "TC-PUB-TOK-G-001",
  レベル: L3,
  大分類: "公開API",
  中分類: "予約照会GET",
  対象ID: "GET /api/reservations/{token}",
  テストケース名: "トークン形式不正は404",
  観点区分: "異常",
  前提条件: "-",
  手順: "短い文字列でGET",
  期待結果: "404、形式不正メッセージ",
  確認証跡: "HTTP",
  優先度: "P1",
  自動化: "可",
  実装参照: "src/app/api/reservations/[token]/route.ts",
  備考: "",
});

add({
  テストID: "TC-PUB-TOK-G-002",
  レベル: L3,
  大分類: "公開API",
  中分類: "予約照会GET",
  対象ID: "GET /api/reservations/{token}",
  テストケース名: "開催日経過後は照会404（プライバシー）",
  観点区分: "セキュリティ",
  前提条件: "過去のevent_dateの予約トークン",
  手順: "GET",
  期待結果: "404予約が見つかりません",
  確認証跡: "HTTP",
  優先度: "P0",
  自動化: "可",
  実装参照: "isReservationLookupExpired",
  備考: "",
});

add({
  テストID: "TC-PUB-TOK-G-003",
  レベル: L3,
  大分類: "公開API",
  中分類: "予約照会GET",
  対象ID: "GET /api/reservations/{token}",
  テストケース名: "レート制限429",
  観点区分: "性能",
  前提条件: "40回/分超同一IP",
  手順: "連続GET",
  期待結果: "429",
  確認証跡: "HTTP",
  優先度: "P2",
  自動化: "可",
  実装参照: "reservation-public.ts TOKEN_GET",
  備考: "",
});

const patchCases = [
  ["PATCH-JSON壊れ", "400", "Invalid JSON"],
  ["PATCHパース失敗", "422", "参加人数・昼食・代表者名・電話"],
  ["PATCH昼食全0", "422", "昼食は、必ずご予約が必要"],
  ["PATCH open以外", "409", "受付を終了したため"],
  ["PATCH cancelled予約", "409", "有効な予約のみ"],
  ["PATCH締切後", "409", "締切を過ぎているため"],
];

patchCases.forEach(([name, code, frag], i) => {
  add({
    テストID: `TC-PUB-TOK-P-NG${String(i + 1).padStart(2, "0")}`,
    レベル: L3,
    大分類: "公開API",
    中分類: "予約変更PATCH",
    対象ID: "PATCH /api/reservations/{token}",
    テストケース名: name,
    観点区分: "異常",
    前提条件: "有効トークン（ケースにより状態変更）",
    手順: "PATCH",
    期待結果: `HTTP ${code}、本文に「${frag}」を含む`,
    確認証跡: "HTTP",
    優先度: "P1",
    自動化: "可",
    実装参照: "src/app/api/reservations/[token]/route.ts",
    備考: "",
  });
});

add({
  テストID: "TC-PUB-TOK-P-OK-001",
  レベル: L3,
  大分類: "公開API",
  中分類: "予約変更PATCH",
  対象ID: "PATCH /api/reservations/{token}",
  テストケース名: "正常更新とJSON反映",
  観点区分: "正常",
  前提条件: "open・締切未来・active",
  手順: "participantCount,lunchItems,contactName,contactPhoneをPATCH",
  期待結果: "200、updated true、reservationオブジェクト更新",
  確認証跡: "DB teams,reservations_lunch",
  優先度: "P0",
  自動化: "可",
  実装参照: "replaceReservationLunchItems",
  備考: "lunch_menu_invalidは422",
});

const cancelErr = [
  ["not_found", "404", "予約が見つかりません"],
  ["deadline_passed", "409", "締切を過ぎているためキャンセル"],
  ["event_not_open", "409", "受付を終了したため"],
];

for (const [e, h, m] of cancelErr) {
  add({
    テストID: `TC-PUB-CAN-${e}`,
    レベル: L3,
    大分類: "公開API",
    中分類: "予約取消",
    対象ID: "POST /api/reservations/{token}/cancel",
    テストケース名: `cancel_public_reservation ${e}`,
    観点区分: "異常",
    前提条件: "RPCが当該error",
    手順: "POST",
    期待結果: `HTTP ${h}、${m}`,
    確認証跡: "HTTP",
    優先度: "P1",
    自動化: "要検討",
    実装参照: "src/app/api/reservations/[token]/cancel/route.ts",
    備考: "",
  });
}

add({
  テストID: "TC-PUB-CAN-OK-001",
  レベル: L3,
  大分類: "公開API",
  中分類: "予約取消",
  対象ID: "POST /api/reservations/{token}/cancel",
  テストケース名: "正常取消",
  観点区分: "正常",
  前提条件: "open・締切前・active",
  手順: "POST",
  期待結果: "200 cancelled true",
  確認証跡: "DB status cancelled",
  優先度: "P0",
  自動化: "可",
  実装参照: "cancel/route.ts",
  備考: "alreadyCancelled trueのケースも確認",
});

// --- camp / tournament / lunch ---
add({
  テストID: "TC-PUB-CAMP-001",
  レベル: L3,
  大分類: "公開API",
  中分類: "合宿問い合わせ",
  対象ID: "POST /api/camp-inquiries",
  テストケース名: "バリデーション422 fieldId付き",
  観点区分: "異常",
  前提条件: "必須フィールド欠落",
  手順: "POST",
  期待結果: "422",
  確認証跡: "JSON",
  優先度: "P1",
  自動化: "可",
  実装参照: "src/app/api/camp-inquiries/route.ts",
  備考: "",
});

add({
  テストID: "TC-PUB-CAMP-002",
  レベル: L3,
  大分類: "公開API",
  中分類: "合宿問い合わせ",
  対象ID: "POST /api/camp-inquiries",
  テストケース名: "正常200相当とok true",
  観点区分: "正常",
  前提条件: "正しいanswers",
  手順: "POST",
  期待結果: "200、inquiryId、案内メッセージ",
  確認証跡: "camp_inquiries行",
  優先度: "P1",
  自動化: "可",
  実装参照: "同上",
  備考: "",
});

add({
  テストID: "TC-PUB-TRN-001",
  レベル: L3,
  大分類: "公開API",
  中分類: "大会問い合わせ",
  対象ID: "POST /api/tournament-inquiries",
  テストケース名: "parse失敗400",
  観点区分: "異常",
  前提条件: "名前メール電話メッセージ欠落",
  手順: "POST",
  期待結果: "400",
  確認証跡: "HTTP",
  優先度: "P1",
  自動化: "可",
  実装参照: "src/app/api/tournament-inquiries/route.ts",
  備考: "",
});

add({
  テストID: "TC-PUB-LUNCH-001",
  レベル: L3,
  大分類: "公開API",
  中分類: "昼食メニュー",
  対象ID: "GET /api/lunch-menu",
  テストケース名: "is_active trueのみ返却",
  観点区分: "正常",
  前提条件: "マスタ複数",
  手順: "GET",
  期待結果: "200 items配列、sort_order順",
  確認証跡: "JSON",
  優先度: "P1",
  自動化: "可",
  実装参照: "src/app/api/lunch-menu/route.ts",
  備考: "",
});

// --- Admin event-days PATCH/DELETE/POST ---
const admEdPatch = [
  ["未認証", "401", "Unauthorized", "セッションなし"],
  ["status欠落", "400", "status を指定", ""],
  ["status不正", "422", "draft / open / locked", "confirmed指定"],
  ["locked遷移元不正", "409", "公開中のみ", "draftからlocked"],
  ["draft化元不正", "422", "公開中のみ", "lockedからdraft"],
  ["open化元不正", "422", "公開前のみ", "openからopen"],
];

admEdPatch.forEach(([n, c, f, p], i) => {
  add({
    テストID: `TC-ADM-ED-PATCH-NG${String(i + 1).padStart(2, "0")}`,
    レベル: L3,
    大分類: "管理API",
    中分類: "開催日PATCH",
    対象ID: "PATCH /api/admin/event-days/{id}",
    テストケース名: n,
    観点区分: "異常",
    前提条件: p,
    手順: "PATCH JSON status",
    期待結果: `HTTP ${c}、${f}`,
    確認証跡: "HTTP",
    優先度: "P0",
    自動化: "可",
    実装参照: "src/app/api/admin/event-days/[id]/route.ts",
    備考: "",
  });
});

add({
  テストID: "TC-ADM-ED-PATCH-OK-001",
  レベル: L3,
  大分類: "管理API",
  中分類: "開催日PATCH",
  対象ID: "PATCH /api/admin/event-days/{id}",
  テストケース名: "draft→open",
  観点区分: "正常",
  前提条件: `${authAdmin}。対象開催日はdraft`,
  手順: "status open",
  期待結果: "200 eventDay",
  確認証跡: "DB",
  優先度: "P0",
  自動化: "可",
  実装参照: "同上",
  備考: "",
});

add({
  テストID: "TC-ADM-ED-PATCH-OK-002",
  レベル: L3,
  大分類: "管理API",
  中分類: "開催日PATCH",
  対象ID: "PATCH /api/admin/event-days/{id}",
  テストケース名: "open→locked手動",
  観点区分: "正常",
  前提条件: "open行",
  手順: "status locked",
  期待結果: "200",
  確認証跡: "DB status locked",
  優先度: "P1",
  自動化: "可",
  実装参照: "同上",
  備考: "最少中止はcatchup/cron側",
});

add({
  テストID: "TC-ADM-ED-DEL-001",
  レベル: L3,
  大分類: "管理API",
  中分類: "開催日DELETE",
  対象ID: "DELETE /api/admin/event-days/{id}",
  テストケース名: "draftかつ予約0のみ削除可",
  観点区分: "境界",
  前提条件: "openまたは予約あり",
  手順: "DELETE",
  期待結果: "409またはエラー",
  確認証跡: "HTTP",
  優先度: "P1",
  自動化: "可",
  実装参照: "route.ts DELETE",
  備考: "実装の正確な文言をコード確認",
});

add({
  テストID: "TC-ADM-ED-POST-001",
  レベル: L3,
  大分類: "管理API",
  中分類: "開催日POST作成",
  対象ID: "POST /api/admin/event-days",
  テストケース名: "eventDate形式422",
  観点区分: "異常",
  前提条件: authAdmin,
  手順: "eventDate不正",
  期待結果: "422",
  確認証跡: "HTTP",
  優先度: "P1",
  自動化: "可",
  実装参照: "src/app/api/admin/event-days/route.ts",
  備考: "",
});

add({
  テストID: "TC-ADM-ED-POST-002",
  レベル: L3,
  大分類: "管理API",
  中分類: "開催日POST作成",
  対象ID: "POST /api/admin/event-days",
  テストケース名: "正常作成と既定枠insert",
  観点区分: "正常",
  前提条件: authAdmin,
  手順: "必須フィールド+ISO締切",
  期待結果: "200/201相当、slots行が既定数",
  確認証跡: "DB event_day_slots",
  優先度: "P0",
  自動化: "可",
  実装参照: "default-slots",
  備考: "",
});

// slots
add({
  テストID: "TC-ADM-SLOT-001",
  レベル: L3,
  大分類: "管理API",
  中分類: "枠GET/PATCH",
  対象ID: "/api/admin/event-days/{id}/slots",
  テストケース名: "active予約ありPATCHは409 has_reservations",
  観点区分: "異常",
  前提条件: "open+draft可だが予約1件以上",
  手順: "PATCH",
  期待結果: "409",
  確認証跡: "HTTP",
  優先度: "P0",
  自動化: "可",
  実装参照: "admin-event-day-slot-mutations",
  備考: "",
});

add({
  テストID: "TC-ADM-SLOT-002",
  レベル: L3,
  大分類: "管理API",
  中分類: "枠force",
  対象ID: "/api/admin/event-days/{id}/slots/force",
  テストケース名: "acknowledgeReservationRiskなし422",
  観点区分: "異常",
  前提条件: authAdmin,
  手順: "PATCH without flag",
  期待結果: "422",
  確認証跡: "HTTP",
  優先度: "P0",
  自動化: "可",
  実装参照: "slots/force/route.ts",
  備考: "",
});

// catchup
add({
  テストID: "TC-ADM-CATCH-001",
  レベル: L3,
  大分類: "管理API",
  中分類: "締切catchup",
  対象ID: "POST .../apply-deadline-catchup",
  テストケース名: "acknowledged falseは422",
  観点区分: "異常",
  前提条件: authAdmin,
  手順: "POST {}",
  期待結果: "422",
  確認証跡: "HTTP",
  優先度: "P0",
  自動化: "可",
  実装参照: "apply-deadline-catchup/route.ts",
  備考: "",
});

add({
  テストID: "TC-ADM-CATCH-002",
  レベル: L3,
  大分類: "管理API",
  中分類: "締切catchup",
  対象ID: "POST .../apply-deadline-catchup",
  テストケース名: "締切未到達422 deadline_not_reached",
  観点区分: "境界",
  前提条件: "openかつ締切未来",
  手順: "acknowledged trueでPOST",
  期待結果: "422 code",
  確認証跡: "JSON code",
  優先度: "P1",
  自動化: "可",
  実装参照: "process-reservation-deadline",
  備考: "",
});

add({
  テストID: "TC-ADM-CATCH-003",
  レベル: L3,
  大分類: "管理API",
  中分類: "締切catchup",
  対象ID: "POST .../apply-deadline-catchup",
  テストケース名: "締切経過openはlockedまたは最少中止",
  観点区分: "正常",
  前提条件: "open+締切過去+チーム数分岐",
  手順: "POST acknowledged true",
  期待結果: "200 ok true outcome",
  確認証跡: "DB+notifications",
  優先度: "P0",
  自動化: "可",
  実装参照: "applyReservationDeadlineCatchupForEventDayId",
  備考: "",
});

// matching
add({
  テストID: "TC-ADM-MATCH-001",
  レベル: L3,
  大分類: "管理API",
  中分類: "matching/run",
  対象ID: "POST /api/admin/matching/run",
  テストケース名: "eventDateとeventDayId同時400",
  観点区分: "異常",
  前提条件: "AdminまたはCron",
  手順: "両方指定POST",
  期待結果: "400",
  確認証跡: "HTTP",
  優先度: "P1",
  自動化: "可",
  実装参照: "matching/run/route.ts",
  備考: "",
});

add({
  テストID: "TC-ADM-MATCH-002",
  レベル: L3,
  大分類: "管理API",
  中分類: "matching/run",
  対象ID: "POST /api/admin/matching/run",
  テストケース名: "not_lockedは422",
  観点区分: "異常",
  前提条件: "openの日",
  手順: "POST",
  期待結果: "422 status not_locked",
  確認証跡: "HTTP",
  優先度: "P0",
  自動化: "可",
  実装参照: "run-matching-for-event-day",
  備考: "",
});

add({
  テストID: "TC-ADM-MATCH-003",
  レベル: L3,
  大分類: "管理API",
  中分類: "matching/run",
  対象ID: "POST /api/admin/matching/run",
  テストケース名: "afternoon済み409 already_matched",
  観点区分: "異常",
  前提条件: "confirmed+current run afternoon",
  手順: "POST",
  期待結果: "409",
  確認証跡: "HTTP",
  優先度: "P0",
  自動化: "可",
  実装参照: "同上",
  備考: "",
});

add({
  テストID: "TC-ADM-MATCH-004",
  レベル: L3,
  大分類: "管理API",
  中分類: "matching/run",
  対象ID: "POST /api/admin/matching/run",
  テストケース名: "locked正常200とconfirmed遷移",
  観点区分: "正常",
  前提条件: "locked+active予約適切",
  手順: "POST",
  期待結果: "200 ok、assignmentCount、meta",
  確認証跡: "DB event_days confirmed",
  優先度: "P0",
  自動化: "可",
  実装参照: "admin_apply_matching_run",
  備考: "",
});

add({
  テストID: "TC-ADM-UNDO-001",
  レベル: L3,
  大分類: "管理API",
  中分類: "matching/undo",
  対象ID: "POST /api/admin/matching/undo",
  テストケース名: "confirmedでない422 not_confirmed",
  観点区分: "異常",
  前提条件: "locked",
  手順: "POST",
  期待結果: "422",
  確認証跡: "HTTP",
  優先度: "P1",
  自動化: "可",
  実装参照: "undo/route.ts",
  備考: "",
});

// notifications GET
add({
  テストID: "TC-ADM-NOTIF-001",
  レベル: L3,
  大分類: "管理API",
  中分類: "notifications",
  対象ID: "GET /api/admin/notifications",
  テストケース名: "statusクエリ不正422",
  観点区分: "異常",
  前提条件: authAdmin,
  手順: "?status=foo",
  期待結果: "422",
  確認証跡: "HTTP",
  優先度: "P1",
  自動化: "可",
  実装参照: "notifications/route.ts",
  備考: "",
});

add({
  テストID: "TC-ADM-NOTIF-002",
  レベル: L3,
  大分類: "管理API",
  中分類: "notifications",
  対象ID: "GET /api/admin/notifications",
  テストケース名: "eventDayId非UUID400",
  観点区分: "異常",
  前提条件: authAdmin,
  手順: "?eventDayId=bad&status=failed",
  期待結果: "400",
  確認証跡: "HTTP",
  優先度: "P1",
  自動化: "可",
  実装参照: "同上",
  備考: "",
});

add({
  テストID: "TC-ADM-NOTIF-003",
  レベル: L3,
  大分類: "管理API",
  中分類: "notifications retry",
  対象ID: "POST /api/admin/notifications/{id}/retry",
  テストケース名: "failed→再送でpending化（実装確認）",
  観点区分: "正常",
  前提条件: "failed行",
  手順: "POST",
  期待結果: "成功時200系",
  確認証跡: "DB status",
  優先度: "P1",
  自動化: "要検討",
  実装参照: "retry/route.ts",
  備考: "",
});

// dashboard next-event-day
add({
  テストID: "TC-ADM-DASH-001",
  レベル: L3,
  大分類: "管理API",
  中分類: "dashboard",
  対象ID: "GET /api/admin/dashboard/next-event-day",
  テストケース名: "未認証401",
  観点区分: "セキュリティ",
  前提条件: "-",
  手順: "GET",
  期待結果: "401",
  確認証跡: "HTTP",
  優先度: "P1",
  自動化: "可",
  実装参照: "next-event-day/route.ts",
  備考: "",
});

// admin reservations patch
add({
  テストID: "TC-ADM-RSV-001",
  レベル: L3,
  大分類: "管理API",
  中分類: "予約PATCH",
  対象ID: "PATCH /api/admin/reservations/{id}",
  テストケース名: "未認証401",
  観点区分: "セキュリティ",
  前提条件: "-",
  手順: "PATCH",
  期待結果: "401",
  確認証跡: "HTTP",
  優先度: "P0",
  自動化: "可",
  実装参照: "reservations/[id]/route.ts",
  備考: "枠変更は別API",
});

// lunch-menu-items admin
add({
  テストID: "TC-ADM-LUNCH-001",
  レベル: L3,
  大分類: "管理API",
  中分類: "lunch-menu-items",
  対象ID: "GET/POST /api/admin/lunch-menu-items",
  テストケース名: "CRUD基本（詳細は実装に従う）",
  観点区分: "正常",
  前提条件: authAdmin,
  手順: "POST新規→GET一覧→PATCH→DELETE",
  期待結果: "各HTTP成功",
  確認証跡: "DB",
  優先度: "P2",
  自動化: "可",
  実装参照: "lunch-menu-items/",
  備考: "境界値は別途コード読取で追加",
});

// camp/tournament admin PATCH
add({
  テストID: "TC-ADM-INQ-001",
  レベル: L3,
  大分類: "管理API",
  中分類: "問い合わせ",
  対象ID: "PATCH camp/tournament inquiries",
  テストケース名: "状態更新とメモ（実装準拠）",
  観点区分: "正常",
  前提条件: `${authAdmin}。該当の問い合わせ行が存在`,
  手順: "PATCH",
  期待結果: "200",
  確認証跡: "DB",
  優先度: "P2",
  自動化: "要検討",
  実装参照: "camp-inquiries/[id]/route.ts",
  備考: "",
});

// weather / operational / notification-summary — placeholder rows
for (const [id, path] of [
  ["TC-ADM-WX-001", "weather-decision"],
  ["TC-ADM-OP-001", "operational-cancel"],
  ["TC-ADM-OP-002", "operational-restore"],
  ["TC-ADM-NS-001", "notification-summary"],
]) {
  add({
    テストID: id,
    レベル: L3,
    大分類: "管理API",
    中分類: path,
    対象ID: `POST/GET .../${path}`,
    テストケース名: "認証必須と主要分岐（payload毎に仕様化）",
    観点区分: "正常/異常",
    前提条件: authAdmin,
    手順: "route.tsの分岐表に沿いケース網羅",
    期待結果: "実装のHTTP/副作用と一致",
    確認証跡: "DB notifications event_days",
    優先度: "P0",
    自動化: "要検討",
    実装参照: `src/app/api/admin/event-days/[id]/${path}/route.ts`,
    備考: "詳細ケースは実装grepで子行追加推奨",
  });
}

// matches GET + PATCH assignment
add({
  テストID: "TC-ADM-MCH-001",
  レベル: L3,
  大分類: "管理API",
  中分類: "matches GET",
  対象ID: "GET /api/admin/matches",
  テストケース名: "dateクエリ欠落は400",
  観点区分: "異常",
  前提条件: authAdmin,
  手順: "GET（クエリなし）",
  期待結果: "400、date（YYYY-MM-DD）が必要です",
  確認証跡: "HTTP",
  優先度: "P1",
  自動化: "可",
  実装参照: "matches/route.ts",
  備考: "",
});

add({
  テストID: "TC-ADM-MCH-001B",
  レベル: L3,
  大分類: "管理API",
  中分類: "matches GET",
  対象ID: "GET /api/admin/matches",
  テストケース名: "date形式不正は422",
  観点区分: "異常",
  前提条件: authAdmin,
  手順: "?date=2026-13-40",
  期待結果: "422",
  確認証跡: "HTTP",
  優先度: "P1",
  自動化: "可",
  実装参照: "matches/route.ts",
  備考: "",
});

add({
  テストID: "TC-ADM-MCH-001C",
  レベル: L3,
  大分類: "管理API",
  中分類: "matches GET",
  対象ID: "GET /api/admin/matches",
  テストケース名: "該当日に開催日なしは404",
  観点区分: "異常",
  前提条件: authAdmin,
  手順: "?date=2099-01-01（DBに無い日）",
  期待結果: "404",
  確認証跡: "HTTP",
  優先度: "P1",
  自動化: "可",
  実装参照: "matches/route.ts",
  備考: "",
});

add({
  テストID: "TC-ADM-MCH-002",
  レベル: L3,
  大分類: "管理API",
  中分類: "matches PATCH",
  対象ID: "PATCH /api/admin/matches/{assignmentId}",
  テストケース名: "overrideReason必須等バリデーション",
  観点区分: "異常",
  前提条件: authAdmin,
  手順: "空ボディやUUID不正",
  期待結果: "400/422",
  確認証跡: "HTTP",
  優先度: "P1",
  自動化: "可",
  実装参照: "matches/[id]/route.ts",
  備考: "重複チーム検出overlappingTeamConflict等",
});

// --- Cron 4本（各認証パターン）---
const crons = [
  ["lock-event-days", "GET/POST", "締切処理"],
  ["run-matching-locked", "GET", "locked一括編成"],
  ["send-matching-proposal", "GET", "案内メール"],
  ["send-day-before-final", "GET", "前日最終"],
];

for (const [name, meth, desc] of crons) {
  for (const [suffix, expect] of [
    ["SEC-401", "Bearer不正で401"],
    ["SEC-503", "CRON_SECRET未設定503"],
    ["OK-200", "正常時200とJSONサマリ"],
  ]) {
    add({
      テストID: `TC-CRN-${name}-${suffix}`,
      レベル: L3,
      大分類: "Cron",
      中分類: desc,
      対象ID: `${meth} /api/cron/${name}`,
      テストケース名: expect,
      観点区分: suffix.includes("401") || suffix.includes("503") ? "セキュリティ/異常" : "正常",
      前提条件: "Staging+テストデータ",
      手順: "Authorization付きでリクエスト",
      期待結果: suffix.includes("401") ? "401" : suffix.includes("503") ? "503" : "200 ok構造",
      確認証跡: "HTTP+DB副作用",
      優先度: "P0",
      自動化: "要検討",
      実装参照: `src/app/api/cron/${name}/route.ts`,
      備考: "vercel.jsonスケジュールは別文書",
    });
  }
}

// --- Cron 日付ロジック（run-matching-locked）---
add({
  テストID: "TC-CRN-MATCH-DATE-001",
  レベル: L1,
  大分類: "Cron",
  中分類: "対象日抽出",
  対象ID: "run-matching-locked",
  テストケース名: "東京今日以降のlockedのみ処理",
  観点区分: "境界",
  前提条件: "過去日lockedは対象外",
  手順: "DBに過去locked配置後Cron",
  期待結果: "resultsに含まれない/ skipped",
  確認証跡: "JSON results",
  優先度: "P1",
  自動化: "可",
  実装参照: "run-matching-locked/route.ts",
  備考: "tokyoIsoDateToday使用",
});

// --- 公開画面（主要ルート表示）---
const pubPages = [
  ["/", "トップ"],
  ["/reserve", "予約トップ"],
  ["/reserve/calendar", "カレンダー"],
  ["/reserve/contact", "お問い合わせ"],
  ["/reserve/camp", "合宿案内"],
  ["/reserve/camp/inquiry", "合宿相談フォーム"],
  ["/reserve/manage", "予約管理（トークン入力）"],
  ["/admin/login", "管理ログイン"],
];

for (const [path, label] of pubPages) {
  add({
    テストID: `TC-UI-PUB-${path.replace(/\//g, "-")}`,
    レベル: L2,
    大分類: "公開画面",
    中分類: label,
    対象ID: path,
    テストケース名: "200表示と主要要素存在",
    観点区分: "正常",
    前提条件: "devサーバ起動",
    手順: "ブラウザでGET",
    期待結果: "200、致命的コンソールエラーなし",
    確認証跡: "スクリーンショット",
    優先度: path.includes("reserve") ? "P0" : "P2",
    自動化: "可(Playwright)",
    実装参照: `src/app${path}/page.tsx`,
    備考: "page.tsxパスは実レイアウトに合わせ調整",
  });
}

const admPages = [
  "/admin/dashboard",
  "/admin/event-days",
  "/admin/event-days/{id}",
  "/admin/event-days/{id}/slots",
  "/admin/event-days/{id}/slots/force",
  "/admin/event-days/{id}/weather",
  "/admin/event-days/{id}/operational-cancel",
  "/admin/event-days/{id}/notifications",
  "/admin/pre-day-adjust",
  "/admin/pre-day-results",
  "/admin/reservations",
  "/admin/reservations/{id}",
  "/admin/notifications/failed",
  "/admin/lunch-menu",
  "/admin/camp-inquiries",
  "/admin/camp-inquiries/{id}",
  "/admin/tournament-inquiries",
  "/admin/tournament-inquiries/{id}",
  "/admin/event-day-slots",
];

for (const path of admPages) {
  add({
    テストID: `TC-UI-ADM-${path.replace(/[{}]/g, "").replace(/\//g, "-")}`,
    レベル: L2,
    大分類: "管理画面",
    中分類: "認証後表示",
    対象ID: path,
    テストケース名: "管理者ログイン後200とナビ",
    観点区分: "正常",
    前提条件: authAdmin,
    手順: "ログイン後URLへ遷移",
    期待結果: "200、権限エラーなし",
    確認証跡: "スクリーンショット",
    優先度: "P1",
    自動化: "可(E2E)",
    実装参照: "src/app/admin/(protected)/",
    備考: "{id}は有効UUIDに置換",
  });
}

add({
  テストID: "TC-UI-ADM-LOGIN-001",
  レベル: L2,
  大分類: "管理画面",
  中分類: "ログイン",
  対象ID: "/admin/login",
  テストケース名: "誤パスワードでエラー表示",
  観点区分: "異常",
  前提条件: "存在ユーザー",
  手順: "誤認証情報送信",
  期待結果: "エラーメッセージ、セッション作成されない",
  確認証跡: "UI",
  優先度: "P1",
  自動化: "可",
  実装参照: "src/app/admin/(public)/login/",
  備考: "",
});

// --- E2E フロー（シナリオ）---
const e2e = [
  ["TC-E2E-001", "公開:カレンダー→日付→枠選択→予約→完了画面token表示"],
  ["TC-E2E-002", "公開:manageにtoken→照会→PATCH変更→保存確認"],
  ["TC-E2E-003", "公開:締切後は新規予約不可（UI/API）"],
  ["TC-E2E-004", "管理:開催日作成→公開→予約が入る→枠通常PATCH409→forceで変更"],
  ["TC-E2E-005", "管理:Cron同等catchupでlocked→matching run→confirmed"],
  ["TC-E2E-006", "管理:pre-dayでmatches表示→assignment PATCH補正"],
  ["TC-E2E-007", "管理:notifications failed一覧→retry"],
  ["TC-E2E-008", "合宿フォーム送信→管理で問い合わせ一覧→詳細"],
];

for (const [id, flow] of e2e) {
  add({
    テストID: id,
    レベル: L1,
    大分類: "E2E",
    中分類: "業務シナリオ",
    対象ID: "MULTI",
    テストケース名: flow,
    観点区分: "正常",
    前提条件: "Stagingデータ",
    手順: "手順書通りに画面操作",
    期待結果: "各ステップで仕様通りDB/メール",
    確認証跡: "スクショ+SQL",
    優先度: "P0",
    自動化: "可(一部)",
    実装参照: "docs/spec/implemented-behavior-catalog.md",
    備考: "",
  });
}

// --- DB/RPC（代表）---
add({
  テストID: "TC-DB-001",
  レベル: L1,
  大分類: "DB",
  中分類: "RLS",
  対象ID: "authenticated",
  テストケース名: "匿名で業務テーブル更新不可",
  観点区分: "セキュリティ",
  前提条件: "anon key",
  手順: "Supabaseクライアントから直接UPDATE",
  期待結果: "拒否または0件",
  確認証跡: "Supabase",
  優先度: "P0",
  自動化: "要検討",
  実装参照: "supabase/migrations/*enable_rls*",
  備考: "",
});

add({
  テストID: "TC-DB-002",
  レベル: L3,
  大分類: "DB",
  中分類: "RPC",
  対象ID: "create_public_reservation",
  テストケース名: "同一TXで枠競合時の挙動",
  観点区分: "境界",
  前提条件: "並行2リクエスト",
  手順: "同枠に同時POST",
  期待結果: "一方成功一方slot_full等",
  確認証跡: "DB",
  優先度: "P0",
  自動化: "可",
  実装参照: "supabase/migrations/*create_public_reservation*",
  備考: "",
});

add({
  テストID: "TC-DATA-001",
  レベル: L3,
  大分類: "データ",
  中分類: "締切既定",
  対象ID: "reservation-deadline-default",
  テストケース名: "開催2日前15:00JST算出",
  観点区分: "正常",
  前提条件: "代表日付入力",
  手順: "関数またはUI作成時の既定表示確認",
  期待結果: "仕様どおりtimestamptz",
  確認証跡: "値比較",
  優先度: "P1",
  自動化: "可",
  実装参照: "src/lib/dates/reservation-deadline-default.ts",
  備考: "",
});

add({
  テストID: "TC-DATA-002",
  レベル: L3,
  大分類: "データ",
  中分類: "枠数ポリシー",
  対象ID: "event-day-slot-count-policy",
  テストケース名: "午前=午後で3または4のみ許容",
  観点区分: "境界",
  前提条件: "-",
  手順: "管理APIで5+5等を試行",
  期待結果: "422/拒否（実装準拠）",
  確認証跡: "HTTP",
  優先度: "P1",
  自動化: "可",
  実装参照: "src/lib/event-days/event-day-slot-count-policy.ts",
  備考: "",
});

// --- 補足: auth/update-password, reset-password pages ---
add({
  テストID: "TC-AUTH-PW-001",
  レベル: L2,
  大分類: "認証",
  中分類: "パスワード",
  対象ID: "/reset-password,/auth/update-password",
  テストケース名: "Supabaseフローに沿った表示",
  観点区分: "正常",
  前提条件: "リセットリンク",
  手順: "画面遷移",
  期待結果: "エラーなく表示",
  確認証跡: "UI",
  優先度: "P2",
  自動化: "要検討",
  実装参照: "src/app/reset-password/page.tsx",
  備考: "",
});

// --- 予約完了メール（環境依存）---
add({
  テストID: "TC-MAIL-001",
  レベル: L1,
  大分類: "通知",
  中分類: "Resend",
  対象ID: "reservation created",
  テストケース名: "RESEND未設定時の挙動",
  観点区分: "異常",
  前提条件: "APIキーなし",
  手順: "POST予約成功",
  期待結果: "予約は成功しnotificationsがfailedまたはログ警告（実装確認）",
  確認証跡: "notifications",
  優先度: "P2",
  自動化: "不可",
  実装参照: "src/lib/email/reservation-created-mail.ts",
  備考: "",
});

// 追加: lock-event-days ビジネス結果
add({
  テストID: "TC-CRN-LOCK-BIZ-001",
  レベル: L3,
  大分類: "Cron",
  中分類: "締切分岐",
  対象ID: "lock-event-days",
  テストケース名: "activeチーム3未満はcancelled_minimum",
  観点区分: "正常",
  前提条件: "締切過去open+active2チーム",
  手順: "Cron実行",
  期待結果: "minimumCancelledIdsに含まれる",
  確認証跡: "JSON+DB",
  優先度: "P0",
  自動化: "可",
  実装参照: "processReservationDeadlinePassed",
  備考: "",
});

add({
  テストID: "TC-CRN-LOCK-BIZ-002",
  レベル: L3,
  大分類: "Cron",
  中分類: "締切分岐",
  対象ID: "lock-event-days",
  テストケース名: "activeチーム3以上はlocked",
  観点区分: "正常",
  前提条件: "締切過去open+active3+",
  手順: "Cron実行",
  期待結果: "lockedIdsに含まれる",
  確認証跡: "JSON+DB",
  優先度: "P0",
  自動化: "可",
  実装参照: "同上",
  備考: "",
});

// --- 拡張ブロック（雨天判断・管理予約PATCH・取消追加エラー等）---
add({
  テストID: "TC-PUB-CAN-INV",
  レベル: L3,
  大分類: "公開API",
  中分類: "予約取消",
  対象ID: "POST /api/reservations/{token}/cancel",
  テストケース名: "cancel_public_reservation invalid_input",
  観点区分: "異常",
  前提条件: "RPCがinvalid_input",
  手順: "POST",
  期待結果: "HTTP 400",
  確認証跡: "HTTP",
  優先度: "P2",
  自動化: "要検討",
  実装参照: "cancel/route.ts",
  備考: "",
});

const wxCases = [
  ["WX-NG-01", "decision欠落/不正", "422", "decision は go または cancel"],
  ["WX-NG-02", "sendImmediate+go", "422", "sendImmediateCancelNotice は cancel と併用"],
  ["WX-NG-03", "day_before_17+go", "422", "delivery が day_before_17 のときは cancel"],
  ["WX-NG-04", "day_before_17+即時メール同時", "422", "同時に指定できません"],
  ["WX-NG-05", "draft開催日", "422", "公開前の開催日には雨天判断を登録できません"],
  ["WX-NG-06", "cancelled_minimum", "409", "最少催行中止の開催日には雨天判断"],
  ["WX-NG-07", "cancelled_operational", "409", "運営都合中止の開催日には雨天判断"],
  ["WX-NG-08", "既に雨天cancel再cancel", "409", "すでに雨天中止として登録"],
  ["WX-NG-09", "雨天後goでconfirmed経由", "409", "編成確定後に雨天中止したため取り消せません"],
];
for (const [id, title, code, msg] of wxCases) {
  add({
    テストID: `TC-ADM-${id}`,
    レベル: L3,
    大分類: "管理API",
    中分類: "weather-decision",
    対象ID: "POST /api/admin/event-days/{id}/weather-decision",
    テストケース名: title,
    観点区分: "異常",
    前提条件: authAdmin,
    手順: "該当ステータス/ボディでPOST",
    期待結果: `HTTP ${code}、本文に「${msg}」の一部`,
    確認証跡: "HTTP",
    優先度: "P1",
    自動化: "可",
    実装参照: "weather-decision/route.ts",
    備考: "他分岐は同ファイルgrepで追加",
  });
}

add({
  テストID: "TC-ADM-WX-OK-01",
  レベル: L3,
  大分類: "管理API",
  中分類: "weather-decision",
  対象ID: "POST .../weather-decision",
  テストケース名: "go判断でDB更新（正常系）",
  観点区分: "正常",
  前提条件: "open/locked/confirmed等、実装が許す状態",
  手順: "decision go でPOST",
  期待結果: "200系、weather_decisionsに行",
  確認証跡: "DB",
  優先度: "P0",
  自動化: "要検討",
  実装参照: "weather-decision/route.ts",
  備考: "",
});

add({
  テストID: "TC-ADM-WX-OK-02",
  レベル: L3,
  大分類: "管理API",
  中分類: "weather-decision",
  対象ID: "POST .../weather-decision",
  テストケース名: "cancel+immediate即時メール分岐",
  観点区分: "正常",
  前提条件: "cancel可能なstatus、メールモック可",
  手順: "decision cancel, sendImmediateCancelNotice true",
  期待結果: "notifications生成または送信結果に従う",
  確認証跡: "notifications",
  優先度: "P0",
  自動化: "要検討",
  実装参照: "weather-decision/route.ts",
  備考: "",
});

const admRsvN = [
  ["AR-N01", "UUID不正", "400", "ID が不正", "not-a-uuid"],
  ["AR-N02", "JSON壊れ", "400", "JSON が不正", ""],
  ["AR-N03", "participant_count小数", "422", "1 以上の整数", ""],
  ["AR-N04", "remarks型不正", "422", "remarks は文字列または null", ""],
  ["AR-N05", "remarks2001文字", "422", "2000 文字以内", ""],
  ["AR-N06", "display_name型不正", "422", "display_name は文字列または null", ""],
  ["AR-N07", "display_name121文字", "422", "120 文字以内", ""],
  ["AR-N08", "teamオブジェクトでない", "422", "team はオブジェクトで指定", ""],
  ["AR-N09", "team_name空", "422", "チーム名は空にできません", ""],
  ["AR-N10", "team_name121文字", "422", "120 文字以内", ""],
  ["AR-N11", "contact_name空", "422", "代表者名は空にできません", ""],
  ["AR-N12", "contact_email形式不正", "422", "メールアドレスの形式が不正", ""],
];
for (const [id, title, code, frag, _x] of admRsvN) {
  add({
    テストID: `TC-ADM-RSV-${id}`,
    レベル: L3,
    大分類: "管理API",
    中分類: "予約PATCH",
    対象ID: "PATCH /api/admin/reservations/{id}",
    テストケース名: title,
    観点区分: "異常",
    前提条件: authAdmin,
    手順: "PATCH JSON（該当フィールドのみ不正化）",
    期待結果: `HTTP ${code}、${frag}`,
    確認証跡: "HTTP",
    優先度: "P1",
    自動化: "可",
    実装参照: "reservations/[id]/route.ts",
    備考: "",
  });
}

add({
  テストID: "TC-ADM-RSV-OK-01",
  レベル: L3,
  大分類: "管理API",
  中分類: "予約PATCH",
  対象ID: "PATCH /api/admin/reservations/{id}",
  テストケース名: "参加人数・備考・表示名・チーム連絡先の正常更新",
  観点区分: "正常",
  前提条件: `${authAdmin}。既存予約のUUIDを使用`,
  手順: "許容フィールドのみPATCH",
  期待結果: "200、DB反映",
  確認証跡: "DB",
  優先度: "P0",
  自動化: "可",
  実装参照: "reservations/[id]/route.ts",
  備考: "strength変更可否は実装末尾を確認",
});

add({
  テストID: "TC-ADM-ED-POST-NG-GB",
  レベル: L3,
  大分類: "管理API",
  中分類: "開催日POST",
  対象ID: "POST /api/admin/event-days",
  テストケース名: "gradeBand欠落422",
  観点区分: "異常",
  前提条件: authAdmin,
  手順: "eventDateとreservationDeadlineAtのみ",
  期待結果: "422 gradeBand は必須",
  確認証跡: "HTTP",
  優先度: "P1",
  自動化: "可",
  実装参照: "event-days/route.ts",
  備考: "",
});

add({
  テストID: "TC-ADM-ED-POST-NG-RD",
  レベル: L3,
  大分類: "管理API",
  中分類: "開催日POST",
  対象ID: "POST /api/admin/event-days",
  テストケース名: "reservationDeadlineAt欠落422",
  観点区分: "異常",
  前提条件: authAdmin,
  手順: "締切キー省略",
  期待結果: "422",
  確認証跡: "HTTP",
  優先度: "P1",
  自動化: "可",
  実装参照: "event-days/route.ts",
  備考: "",
});

add({
  テストID: "TC-ADM-ED-POST-NG-RD-PARSE",
  レベル: L3,
  大分類: "管理API",
  中分類: "開催日POST",
  対象ID: "POST /api/admin/event-days",
  テストケース名: "reservationDeadlineAt解釈不能422",
  観点区分: "異常",
  前提条件: authAdmin,
  手順: "不正な日時文字列",
  期待結果: "422",
  確認証跡: "HTTP",
  優先度: "P1",
  自動化: "可",
  実装参照: "event-days/route.ts",
  備考: "",
});

add({
  テストID: "TC-ADM-NOTIF-LIM-001",
  レベル: L3,
  大分類: "管理API",
  中分類: "notifications GET",
  対象ID: "GET /api/admin/notifications",
  テストケース名: "開催日なし一覧はlimit既定150最大300",
  観点区分: "境界",
  前提条件: authAdmin,
  手順: "?status=failed のみ",
  期待結果: "200、件数がlimit以下",
  確認証跡: "JSON length",
  優先度: "P2",
  自動化: "可",
  実装参照: "notifications/route.ts",
  備考: "eventDayId指定時は既定100",
});

add({
  テストID: "TC-ADM-MATCH-CRON-001",
  レベル: L3,
  大分類: "管理API",
  中分類: "matching/run",
  対象ID: "POST /api/admin/matching/run",
  テストケース名: "Cron Bearerで実行可（authorizeAdminOrCron）",
  観点区分: "正常",
  前提条件: "CRON_SECRET設定、locked日あり、管理セッションなし",
  手順: "Authorization BearerでPOST",
  期待結果: "401ではなく200または422 not_locked等ビジネス結果",
  確認証跡: "HTTP",
  優先度: "P0",
  自動化: "可",
  実装参照: "admin-or-cron.ts",
  備考: "undoは不可",
});

const opCan = [
  ["OP-N01", "participantNotice未入力", "422", "participantNotice（参加者向け"],
  ["OP-N02", "notice4001文字", "422", "4000 文字以内"],
  ["OP-N03", "draft開催日", "422", "公開前の開催日には緊急中止"],
  ["OP-N04", "cancelled_minimum", "409", "最少催行中止"],
  ["OP-N05", "cancelled_weather", "409", "雨天中止が登録済み"],
  ["OP-N06", "cancelled_operational再実行", "409", "すでに運営都合中止"],
];
for (const [id, title, code, frag] of opCan) {
  add({
    テストID: `TC-ADM-${id}`,
    レベル: L3,
    大分類: "管理API",
    中分類: "operational-cancel",
    対象ID: "POST /api/admin/event-days/{id}/operational-cancel",
    テストケース名: title,
    観点区分: "異常",
    前提条件: authAdmin,
    手順: "POST JSON",
    期待結果: `HTTP ${code}、${frag}`,
    確認証跡: "HTTP",
    優先度: "P1",
    自動化: "可",
    実装参照: "operational-cancel/route.ts",
    備考: "",
  });
}

add({
  テストID: "TC-ADM-NSUM-001",
  レベル: L3,
  大分類: "管理API",
  中分類: "notification-summary",
  対象ID: "GET /api/admin/event-days/{id}/notification-summary",
  テストケース名: "未認証401",
  観点区分: "セキュリティ",
  前提条件: "セッションなし",
  手順: "GET",
  期待結果: "401",
  確認証跡: "HTTP",
  優先度: "P1",
  自動化: "可",
  実装参照: "notification-summary/route.ts",
  備考: "",
});

add({
  テストID: "TC-ADM-NSUM-002",
  レベル: L3,
  大分類: "管理API",
  中分類: "notification-summary",
  対象ID: "GET .../notification-summary",
  テストケース名: "存在しない開催日404",
  観点区分: "異常",
  前提条件: authAdmin,
  手順: "ランダムUUIDでGET",
  期待結果: "404",
  確認証跡: "HTTP",
  優先度: "P1",
  自動化: "可",
  実装参照: "notification-summary/route.ts",
  備考: "",
});

add({
  テストID: "TC-ADM-NSUM-003",
  レベル: L3,
  大分類: "管理API",
  中分類: "notification-summary",
  対象ID: "GET .../notification-summary",
  テストケース名: "正常200とテンプレ別件数",
  観点区分: "正常",
  前提条件: `${authAdmin}。既存の開催日ID`,
  手順: "GET",
  期待結果: "200、matching_proposal/day_before_final等のカウント",
  確認証跡: "JSON",
  優先度: "P1",
  自動化: "可",
  実装参照: "notification-summary/route.ts",
  備考: "",
});

const statusMatrix = [
  ["draft", "GET /api/event-days", "行なし（一覧に出ない）"],
  ["open+締切前", "POST /api/reservations", "201可能"],
  ["open+締切後", "POST /api/reservations", "409"],
  ["locked", "PATCH /api/reservations/token", "409変更不可"],
  ["confirmed", "PATCH /api/reservations/token", "409"],
  ["cancelled_weather", "POST /api/reservations", "409"],
  ["cancelled_minimum", "POST /api/reservations", "409"],
  ["cancelled_operational", "POST /api/reservations", "409"],
];
let smIdx = 0;
for (const [st, api, exp] of statusMatrix) {
  smIdx += 1;
  add({
    テストID: `TC-MAT-STATUS-${String(smIdx).padStart(2, "0")}`,
    レベル: L1,
    大分類: "回帰マトリクス",
    中分類: "event_days.status×公開操作",
    対象ID: `${st} / ${api}`,
    テストケース名: `${st} のとき ${api} の期待`,
    観点区分: "境界",
    前提条件: "該当statusの開催日とデータを用意",
    手順: "API仕様書implemented-behavior-catalogに沿い実行",
    期待結果: exp,
    確認証跡: "HTTP+DB",
    優先度: "P0",
    自動化: "可",
    実装参照: "docs/spec/implemented-behavior-catalog.md §1",
    備考: "draftは一覧SELECT対象外のため行の見え方に注意",
  });
}

const vitestMap = [
  ["TC-VIT-UT-001", "単体", "tests/unit/reservation-deadline-default.test.ts", "開催2日前15:00JST"],
  ["TC-VIT-UT-002", "単体", "tests/unit/event-day-slot-count-policy.test.ts", "3+3/4+4ポリシー"],
  ["TC-VIT-UT-003", "単体", "tests/unit/match-assignment-patch-validation.test.ts", "時刻重複・同一チーム検出"],
  ["TC-VIT-UT-004", "単体", "tests/unit/build-matching-assignments-target.test.ts", "編成目標試合数シナリオ群"],
  ["TC-VIT-IN-001", "結合", "tests/integration/cron-lock-route.integration.test.ts", "503/401分岐"],
  ["TC-VIT-IN-002", "結合", "tests/integration/public-reservation-rpc.integration.test.ts", "RPC create/cancel境界"],
];

for (const [id, layer, path, title] of vitestMap) {
  add({
    テストID: id,
    レベル: L1,
    大分類: "自動テスト",
    中分類: layer,
    対象ID: path,
    テストケース名: `Vitest ${title}`,
    観点区分: "正常",
    前提条件: "npm ci済み、環境変数・DBは各テストファイル参照",
    手順: `npx vitest run ${path}`,
    期待結果: "全it成功",
    確認証跡: "vitest stdout",
    優先度: "P0",
    自動化: "可",
    実装参照: path,
    備考: "結合テストはSupabaseローカルまたはスタブの前提に注意",
  });
}

mkdirSync(dirname(outPath), { recursive: true });

const idList = rows.map((r) => r[0]);
const dup = idList.filter((id, i) => idList.indexOf(id) !== i);
if (dup.length) {
  throw new Error(`重複テストID: ${[...new Set(dup)].join(", ")}`);
}

const lines = rows.map((cols) => cols.join("\t"));
const body = lines.join("\r\n");
const bom = "\uFEFF";
writeFileSync(outPath, bom + headers.join("\t") + "\r\n" + body, "utf8");

console.log(`Wrote ${rows.length} data rows (+ header) to ${outPath}`);
