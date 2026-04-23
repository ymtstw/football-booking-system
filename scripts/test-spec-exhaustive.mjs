/**
 * Route Handler / ライブラリの分岐をテストケース行に展開（網羅用・旧フォーマット向け）。
 *
 * 現行の `docs/test-spec/full-system-test-spec.tsv` は
 * `scripts/gen-full-test-spec-tsv.mjs` → `test-spec-reviewable-data.mjs` が生成する。
 * 本ファイルの TC-EX / TC-MVP 行を再取り込みする場合は reviewable データへ移植すること。
 */
export function registerExhaustiveRows(ctx) {
  const { add, authAdmin, L3 } = ctx;

  const A = "管理API";

  // ----- POST /api/admin/event-days/{id}/weather-decision（route.ts 全分岐）-----
  const wxPath = "POST /api/admin/event-days/{id}/weather-decision";
  const wxRef = "src/app/api/admin/event-days/[id]/weather-decision/route.ts";
  const wxBase = {
    レベル: L3,
    大分類: A,
    中分類: "weather-decision",
    対象ID: wxPath,
    実装参照: wxRef,
    前提条件: authAdmin,
    手順: "JSON ボディはケースごとに route.ts と同条件で組み立てる",
    確認証跡: "HTTP+DB weather_decisions / event_days",
    優先度: "P0",
    自動化: "可",
  };
  const wxRows = [
    ["TC-EX-WX-401", "未認証", "セキュリティ", "401 Unauthorized", "セッションなし"],
    ["TC-EX-WX-400A", "id 欠落", "異常", "400 id が必要です", "パス上のidが空になる呼び出しはフレームワーク依存・不正ルートで代替検証"],
    ["TC-EX-WX-400J", "JSON 壊れ", "異常", "400 Invalid JSON", "body 不正"],
    ["TC-EX-WX-422D", "decision 不正", "異常", "422 decision は go または cancel", "decision 省略または foo"],
    ["TC-EX-WX-422I1", "即時メール+go", "異常", "422 sendImmediateCancelNotice は cancel と併用", "sendImmediate true & decision go"],
    ["TC-EX-WX-422I2", "day_before_17+go", "異常", "422 delivery が day_before_17 のときは cancel", "delivery day_before_17 & go"],
    ["TC-EX-WX-422I3", "day_before_17+即時同時", "異常", "422 前日一括送信予約と即時メールは同時に指定できません", "両方 true"],
    ["TC-EX-WX-404", "開催日なし", "異常", "404 開催日が見つかりません", "存在しない UUID"],
    ["TC-EX-WX-422DR", "draft", "異常", "422 公開前の開催日には雨天判断を登録できません", "status=draft"],
    ["TC-EX-WX-409MIN", "最少中止", "異常", "409 最少催行中止の開催日には雨天判断", "cancelled_minimum"],
    ["TC-EX-WX-409OP", "運営中止", "異常", "409 運営都合中止の開催日には雨天判断", "cancelled_operational"],
    ["TC-EX-WX-409WD2", "雨天二重 cancel", "異常", "409 すでに雨天中止として登録されています", "cancelled_weather & decision cancel"],
    ["TC-EX-WX-409WDG", "雨天後 go ただし確定経由", "異常", "409 編成確定後に雨天中止したため取り消せません", "status_before_weather_cancel=confirmed"],
    ["TC-EX-WX-409DB17A", "前日17予約+最終通知済", "異常", "409 最終通知が完了しているため、前日一括での雨天中止予約はできません", "final_day_before_notice_completed_at あり"],
    ["TC-EX-WX-409DB17B", "前日17予約+状態不適合", "異常", "409 前日一括での雨天中止予約は、確定または締切済の開催日のみ設定できます", "status=open のみ等"],
    ["TC-EX-WX-200GO", "go 正常", "正常", "200 ok true、event_days / weather_decisions 更新", "許容 status"],
    ["TC-EX-WX-200CIM", "cancel immediate 正常", "正常", "200 ok、status cancelled_weather 等へ更新", "delivery immediate"],
    ["TC-EX-WX-200CDB", "cancel day_before_17 フラグ", "正常", "200 ok、weather_day_before_rain_scheduled true", "locked/confirmed"],
    ["TC-EX-WX-200IM0", "即時メール分岐0件", "正常", "200 immediateNotice に active 0 の hint", "active 予約なし"],
    ["TC-EX-WX-200IMQ", "即時メール分岐取得失敗", "正常", "200 immediateNotice に reservationLoadError", "DB障害シミュレーション"],
    ["TC-EX-WX-500INS", "weather_decisions insert 失敗", "異常", "500 insErr", "DB制約違反等（環境依存）"],
    ["TC-EX-WX-500UPD", "event_days update 失敗", "異常", "500 upErr", "DB障害シミュレーション"],
  ];
  for (const [id, name, kind, exp, pre] of wxRows) {
    add({
      ...wxBase,
      テストID: id,
      テストケース名: name,
      観点区分: kind,
      期待結果: exp,
      前提条件: `${authAdmin}。${pre}`,
      備考: "分岐名は route.ts の if 順に対応",
    });
  }

  // ----- POST operational-cancel -----
  const opPath = "POST /api/admin/event-days/{id}/operational-cancel";
  const opRef = "src/app/api/admin/event-days/[id]/operational-cancel/route.ts";
  const opRows = [
    ["TC-EX-OP-401", "未認証", "セキュリティ", "401", "セッションなし"],
    ["TC-EX-OP-400J", "JSON 壊れ", "異常", "400", "body 不正"],
    ["TC-EX-OP-422E", "participantNotice 空", "異常", "422 participantNotice（参加者向け", "必須"],
    ["TC-EX-OP-422L", "4000文字超", "異常", "422 4000 文字以内", "NOTICE_MAX"],
    ["TC-EX-OP-404", "開催日なし", "異常", "404", "UUID 無し"],
    ["TC-EX-OP-422DR", "draft", "異常", "422 公開前の開催日には緊急中止", "draft"],
    ["TC-EX-OP-409MIN", "最少中止", "異常", "409", "cancelled_minimum"],
    ["TC-EX-OP-409WX", "雨天済", "異常", "409 雨天中止が登録済み", "cancelled_weather"],
    ["TC-EX-OP-409OP2", "運営中止済", "異常", "409 すでに運営都合中止", "重複"],
    ["TC-EX-OP-409ST", "状態不適合", "異常", "409 この状態からは運営都合中止を登録できません", "open/locked/confirmed 以外"],
    ["TC-EX-OP-500", "UPDATE 失敗", "異常", "500", "DBエラー"],
    ["TC-EX-OP-200", "正常中止", "正常", "200 ok true", "notice 有効・対象 status"],
    ["TC-EX-OP-200IM", "即時通知付き", "正常", "200 immediateNotice オブジェクト検証", "sendImmediate true"],
  ];
  for (const [id, name, kind, exp, note] of opRows) {
    add({
      テストID: id,
      レベル: L3,
      大分類: A,
      中分類: "operational-cancel",
      対象ID: opPath,
      テストケース名: name,
      観点区分: kind,
      前提条件: authAdmin,
      手順: "POST JSON（participantNotice / sendImmediateOperationalNotice）",
      期待結果: `HTTP ${exp}。${note}`,
      確認証跡: "HTTP+DB+notifications",
      優先度: "P0",
      自動化: "可",
      実装参照: opRef,
      備考: "",
    });
  }

  // ----- POST operational-restore -----
  const rsPath = "POST /api/admin/event-days/{id}/operational-restore";
  const rsRef = "src/app/api/admin/event-days/[id]/operational-restore/route.ts";
  const rsRows = [
    ["TC-EX-RS-401", "未認証", "401"],
    ["TC-EX-RS-404", "開催日なし", "404"],
    ["TC-EX-RS-409N", "運営中止でない", "409 運営都合中止の開催日だけ取り消せます"],
    ["TC-EX-RS-409C", "prev confirmed", "409 編成確定後に運営中止したため取り消せません"],
    ["TC-EX-RS-409U", "prev 不明", "409 取り消し先の状態が不明です"],
    ["TC-EX-RS-500", "UPDATE 失敗", "500"],
    ["TC-EX-RS-200O", "open に復帰", "200 restoredStatus=open", "status_before_operational_cancel=open"],
    ["TC-EX-RS-200L", "locked に復帰", "200 restoredStatus=locked", "prev=locked"],
  ];
  for (const [id, name, exp] of rsRows) {
    add({
      テストID: id,
      レベル: L3,
      大分類: A,
      中分類: "operational-restore",
      対象ID: rsPath,
      テストケース名: name,
      観点区分: exp.startsWith("200") ? "正常" : "異常",
      前提条件: authAdmin,
      手順: "POST（ボディなし）",
      期待結果: exp,
      確認証跡: "HTTP+DB",
      優先度: "P0",
      自動化: "可",
      実装参照: rsRef,
      備考: "",
    });
  }

  // ----- PATCH /api/admin/matches/[id]（match_assignments 補正）-----
  const mpPath = "PATCH /api/admin/matches/{assignmentId}";
  const mpRef = "src/app/api/admin/matches/[id]/route.ts";
  const mpRows = [
    ["TC-EX-MP-401", "未認証", "401"],
    ["TC-EX-MP-400I", "assignmentId 非UUID", "400 無効な id"],
    ["TC-EX-MP-400J", "JSON 壊れ", "400"],
    ["TC-EX-MP-422OR", "overrideReason 空", "422 補正理由は必須"],
    ["TC-EX-MP-422RB", "ra/rb/slot 欠落", "422 reservationAId / reservationBId / eventDaySlotId は必須"],
    ["TC-EX-MP-422RF", "refereeReservationId 型不正", "422 UUID または null"],
    ["TC-EX-MP-422EQ", "A=B", "422 別の予約である必要があります"],
    ["TC-EX-MP-404", "割当なし", "404 割当が見つかりません"],
    ["TC-EX-MP-409NC", "非 current run", "409 current でない matching_run"],
    ["TC-EX-MP-500M", "run と event_day 不整合", "500 データ不整合です"],
    ["TC-EX-MP-422DS", "開催日 status", "422 locked / confirmed のみ補正"],
    ["TC-EX-MP-400NC", "変更なし", "400 変更内容がありません"],
    ["TC-EX-MP-422MS", "午前の枠移動", "422 午前試合の枠変更は未対応"],
    ["TC-EX-MP-422SL", "枠不存在", "422 指定の枠が開催日に存在しません"],
    ["TC-EX-MP-422SA", "枠無効", "422 無効な枠には移動できません"],
    ["TC-EX-MP-422PH", "午前午後跨ぎ", "422 午前・午後をまたぐ枠移動はできません"],
    ["TC-EX-MP-422NA", "A/B 非active", "422 active な予約のみ"],
    ["TC-EX-MP-422NR", "審判非active", "422 審判には active のみ"],
    ["TC-EX-MP-422TM", "同一 team_id", "422 同一チーム同士の対戦にはできません"],
    ["TC-EX-MP-422RF2", "審判チームが対戦と同一", "422 審判のチームは対戦チームと別"],
    ["TC-EX-MP-409SL", "午後枠競合", "409 移動先の午後枠には既に別の試合割当"],
    ["TC-EX-MP-422DP", "同一予約多重割当", "422 同一予約が複数の試合行に"],
    ["TC-EX-MP-500SL", "枠データ不足", "500 枠データが不足しています"],
    ["TC-EX-MP-422OV", "時間重複", "422 overlappingTeamConflict メッセージ"],
    ["TC-EX-MP-500UP", "UPDATE 失敗", "500 match_assignments"],
    ["TC-EX-MP-500LG", "監査ログ失敗", "500 割当は更新されたが監査ログ失敗メッセージ"],
    ["TC-EX-MP-200", "正常補正", "200 ok true", "overrideReason+変更あり+検証通過"],
    ["TC-EX-MP-422RAB", "審判がA/Bと同一予約", "422 審判の予約は A/B と別"],
  ];
  for (const [id, name, exp] of mpRows) {
    add({
      テストID: id,
      レベル: L3,
      大分類: A,
      中分類: "matches PATCH 補正",
      対象ID: mpPath,
      テストケース名: name,
      観点区分: exp.includes("200") ? "正常" : "異常",
      前提条件: authAdmin,
      手順: "PATCH JSON（overrideReason, reservationAId, reservationBId, eventDaySlotId, refereeReservationId）",
      期待結果: exp,
      確認証跡: "HTTP+DB match_assignments+match_adjustment_logs",
      優先度: "P0",
      自動化: "可",
      実装参照: mpRef,
      備考: "",
    });
  }

  // ----- POST /api/admin/notifications/{id}/retry（notification-retry.ts）-----
  const nrPath = "POST /api/admin/notifications/{id}/retry";
  const nrRef = "src/lib/admin/notification-retry.ts + retry/route.ts";
  const nrRows = [
    ["TC-EX-NR-401", "未認証", "401", "route"],
    ["TC-EX-NR-400", "id 非UUID", "400", "route"],
    ["TC-EX-NR-404", "通知なし", "404 通知が見つかりません", "lib"],
    ["TC-EX-NR-409", "failed 以外", "409 再送できるのは failed のみ", "lib"],
    ["TC-EX-NR-422RC", "reservation_created", "422 セキュリティ上再送不可", "lib"],
    ["TC-EX-NR-422R0", "reservation_id なし", "422", "lib"],
    ["TC-EX-NR-422E0", "event_day_id なし", "422", "lib"],
    ["TC-EX-NR-422EM", "連絡先メール取得不可", "422 予約または連絡先メールが取得できません", "lib"],
    ["TC-EX-NR-500U", "pending 更新失敗", "500", "lib"],
    ["TC-EX-NR-500ED", "day_before ctx null", "500 開催日情報の取得に失敗", "lib day_before"],
    ["TC-EX-NR-422OP", "運営中止文面空", "422 運営中止のお知らせ文が空", "lib operational"],
    ["TC-EX-NR-422UK", "未対応 template", "422 このテンプレートは再送未対応", "lib else"],
    ["TC-EX-NR-500X", "送信例外", "500 catch", "lib"],
    ["TC-EX-NR-200S", "再送結果 sent", "200 ok status sent", "lib"],
    ["TC-EX-NR-200F", "再送結果 failed", "200 ok status failed", "lib"],
    ["TC-EX-NR-200P", "再送結果 pending", "200 ok status pending", "lib"],
  ];
  for (const [id, name, exp, layer] of nrRows) {
    add({
      テストID: id,
      レベル: L3,
      大分類: A,
      中分類: "notifications retry",
      対象ID: nrPath,
      テストケース名: `${name}（${layer}）`,
      観点区分: exp.startsWith("200") ? "正常" : "異常",
      前提条件: authAdmin,
      手順: "POST（ボディなし）該当 notifications 行を用意",
      期待結果: exp,
      確認証跡: "HTTP+notifications 行",
      優先度: "P0",
      自動化: "可",
      実装参照: nrRef,
      備考: "",
    });
  }

  // ----- POST slots（枠追加）-----
  const spPath = "POST /api/admin/event-days/{id}/slots";
  const spRef = "src/app/api/admin/event-days/[id]/slots/route.ts";
  const spRows = [
    ["TC-EX-SP-401", "未認証", "401"],
    ["TC-EX-SP-400J", "JSON 壊れ", "400"],
    ["TC-EX-SP-422PH", "phase 不正", "422 morning/afternoon のみ"],
    ["TC-EX-SP-404", "開催日なし", "404"],
    ["TC-EX-SP-409ST", "status 不適合", "409 枠の追加は draft/open のみ"],
    ["TC-EX-SP-409RS", "予約あり", "409 has_reservations"],
    ["TC-EX-SP-201", "枠追加成功", "201 slot", "appendEventDaySlotRow 成功時"],
  ];
  for (const [id, name, exp] of spRows) {
    add({
      テストID: id,
      レベル: L3,
      大分類: A,
      中分類: "slots POST",
      対象ID: spPath,
      テストケース名: name,
      観点区分: exp.startsWith("201") ? "正常" : "異常",
      前提条件: authAdmin,
      手順: "POST { phase }",
      期待結果: exp,
      確認証跡: "HTTP+DB event_day_slots",
      優先度: "P1",
      自動化: "可",
      実装参照: spRef,
      備考: "append失敗時は inserted.status を確認",
    });
  }

  // ----- POST matching/undo RPC エラー -----
  const unPath = "POST /api/admin/matching/undo";
  const unRef = "src/app/api/admin/matching/undo/route.ts";
  const unRows = [
    ["TC-EX-UN-422NC", "not_confirmed", "422"],
    ["TC-EX-UN-422NR", "no_current_run", "422"],
    ["TC-EX-UN-422NT", "nothing_to_undo", "422"],
    ["TC-EX-UN-404", "event_not_found", "404"],
    ["TC-EX-UN-500", "その他 RPC error", "500"],
    ["TC-EX-UN-200", "成功", "200 deletedAfternoonCount 等"],
  ];
  for (const [id, name, http] of unRows) {
    add({
      テストID: id,
      レベル: L3,
      大分類: A,
      中分類: "matching undo",
      対象ID: unPath,
      テストケース名: `admin_undo_afternoon_matching: ${name}`,
      観点区分: http === "200" ? "正常" : "異常",
      前提条件: authAdmin,
      手順: "POST eventDate または eventDayId",
      期待結果: `HTTP ${http}`,
      確認証跡: "HTTP+DB",
      優先度: "P0",
      自動化: "可",
      実装参照: unRef,
      備考: "",
    });
  }

  // ----- PATCH 管理予約（残り分岐 reservations/[id]/route.ts）-----
  const arPath = "PATCH /api/admin/reservations/{id}";
  const arRef = "src/app/api/admin/reservations/[id]/route.ts";
  const arExtra = [
    ["TC-EX-AR-422CP", "contact_name 81文字", "422 80 文字以内"],
    ["TC-EX-AR-422TP", "電話空", "422 電話番号は空にできません"],
    ["TC-EX-AR-422TL", "電話31文字", "422 30 文字以内"],
    ["TC-EX-AR-422ST", "strength 不正", "422 strong または potential"],
    ["TC-EX-AR-422GY", "代表学年 7", "422 1〜6 の整数または null"],
    ["TC-EX-AR-422EML", "メール255文字超", "422 メールアドレスが長すぎます"],
    ["TC-EX-AR-422NONE", "更新項目なし", "422 更新項目がありません"],
    ["TC-EX-AR-200T", "チーム+予約混在更新", "200 ok", "複数フィールド有効"],
  ];
  for (const [id, name, exp] of arExtra) {
    add({
      テストID: id,
      レベル: L3,
      大分類: A,
      中分類: "予約PATCH",
      対象ID: arPath,
      テストケース名: name,
      観点区分: exp.startsWith("200") ? "正常" : "異常",
      前提条件: authAdmin,
      手順: "PATCH JSON",
      期待結果: exp,
      確認証跡: "HTTP+DB",
      優先度: "P1",
      自動化: "可",
      実装参照: arRef,
      備考: "",
    });
  }

  // ----- PATCH camp / tournament inquiries（同一バリデーション）-----
  for (const [pfx, apiPath, ref] of [
    ["TC-EX-CI", "PATCH /api/admin/camp-inquiries/{id}", "camp-inquiries/[id]/route.ts"],
    ["TC-EX-TI", "PATCH /api/admin/tournament-inquiries/{id}", "tournament-inquiries/[id]/route.ts"],
  ]) {
    const rows = [
      [`${pfx}-401`, "未認証", "401"],
      [`${pfx}-400I`, "ID 不正", "400"],
      [`${pfx}-400J`, "JSON 壊れ", "400"],
      [`${pfx}-422S`, "status 不正", "422 status は次のいずれか"],
      [`${pfx}-500`, "UPDATE 失敗", "500"],
      [`${pfx}-200`, "正常更新", "200 ok"],
    ];
    for (const [id, name, exp] of rows) {
      add({
        テストID: id,
        レベル: L3,
        大分類: A,
        中分類: `問い合わせPATCH ${apiPath}`,
        対象ID: apiPath,
        テストケース名: name,
        観点区分: exp.startsWith("200") ? "正常" : "異常",
        前提条件: authAdmin,
        手順: "PATCH { status }",
        期待結果: exp,
        確認証跡: "HTTP+DB",
        優先度: "P1",
        自動化: "可",
        実装参照: `src/app/api/admin/${ref}`,
        備考: "CAMP_INQUIRY_STATUS_VALUES_HINT に準拠",
      });
    }
  }

  // ----- 結合テスト public-reservation-rpc.integration.test.ts の it 1:1 -----
  const integ = [
    ["TC-EX-IN-RPC-01", "無効 token hash 長 create invalid_input"],
    ["TC-EX-IN-RPC-02", "存在しない event_day_id event_not_found"],
    ["TC-EX-IN-RPC-03", "draft+締切未来 event_not_open"],
    ["TC-EX-IN-RPC-04", "open+締切過去 deadline_passed"],
    ["TC-EX-IN-RPC-05", "open 3+3 で7件目 day_full"],
    ["TC-EX-IN-RPC-06", "成功後 locked に cancel event_not_open"],
    ["TC-EX-IN-RPC-07", "cancel 短い hash invalid_input"],
    ["TC-EX-IN-RPC-08", "cancel 存在しない hash not_found"],
  ];
  for (const [id, title] of integ) {
    add({
      テストID: id,
      レベル: L3,
      大分類: "結合テスト",
      中分類: "Supabase RPC",
      対象ID: "create_public_reservation / cancel_public_reservation",
      テストケース名: title,
      観点区分: "正常/異常",
      前提条件: "tests/integration/public-reservation-rpc.integration.test.ts と同一DB前提",
      手順: "npx vitest run tests/integration/public-reservation-rpc.integration.test.ts -t 該当it",
      期待結果: "it が成功（期待RPCコードはタイトル参照）",
      確認証跡: "vitest",
      優先度: "P0",
      自動化: "可",
      実装参照: "tests/integration/public-reservation-rpc.integration.test.ts",
      備考: "",
    });
  }

  const integCron = [
    ["TC-EX-IN-CR-01", "CRON_SECRET 未設定 503"],
    ["TC-EX-IN-CR-02", "Bearer 不一致 401"],
  ];
  for (const [id, title] of integCron) {
    add({
      テストID: id,
      レベル: L3,
      大分類: "結合テスト",
      中分類: "Cron lock",
      対象ID: "GET /api/cron/lock-event-days",
      テストケース名: title,
      観点区分: "異常",
      前提条件: "tests/integration/cron-lock-route.integration.test.ts",
      手順: "該当 it 実行",
      期待結果: "vitest 成功",
      確認証跡: "vitest",
      優先度: "P0",
      自動化: "可",
      実装参照: "tests/integration/cron-lock-route.integration.test.ts",
      備考: "",
    });
  }

  // ----- 単体テスト describe/it 粒度（build-matching-assignments-target）-----
  const unitBm = [
    "3チーム午後3枠で全員2試合",
    "4チーム午前2+午後4で全員3試合",
    "strong奇数で異カ組み合わせ",
    "午前同カ対戦済み可行性",
    "3チーム午前4+午後2で全枠埋まり",
    "3チーム午前4+午後4でtarget不足なし",
    "4チーム午前2のみ1試合 repeatなし",
    "4チーム午後4のみ全枠・第2巡緩和でない",
  ];
  unitBm.forEach((title, i) => {
    add({
      テストID: `TC-EX-UT-BM-${String(i + 1).padStart(2, "0")}`,
      レベル: L3,
      大分類: "単体テスト",
      中分類: "buildMatchingAssignments",
      対象ID: "tests/unit/build-matching-assignments-target.test.ts",
      テストケース名: title,
      観点区分: "正常",
      前提条件: "vitest unit 環境",
      手順: "npx vitest run tests/unit/build-matching-assignments-target.test.ts",
      期待結果: "該当 it を含む全テスト成功",
      確認証跡: "vitest",
      優先度: "P1",
      自動化: "可",
      実装参照: "src/domains/matching/build-matching-assignments.ts",
      備考: "",
    });
  });

  const unitMa = [
    "timeToMinutes HH:MM:SS",
    "intervalsOverlap 検出",
    "intervalsOverlap 非重複",
    "overlappingTeamConflict 非重複",
    "overlappingTeamConflict 同一チーム重複枠",
  ];
  unitMa.forEach((title, i) => {
    add({
      テストID: `TC-EX-UT-MA-${String(i + 1).padStart(2, "0")}`,
      レベル: L3,
      大分類: "単体テスト",
      中分類: "match-assignment-patch-validation",
      対象ID: "tests/unit/match-assignment-patch-validation.test.ts",
      テストケース名: title,
      観点区分: "正常",
      前提条件: "vitest unit",
      手順: "npx vitest run tests/unit/match-assignment-patch-validation.test.ts",
      期待結果: "全 it 成功",
      確認証跡: "vitest",
      優先度: "P1",
      自動化: "可",
      実装参照: "src/lib/admin/match-assignment-patch-validation.ts",
      備考: "",
    });
  });

  // ----- applyReservationDeadlineCatchupForEventDayId（catchup API の code）-----
  const cuPath = "POST /api/admin/event-days/{id}/apply-deadline-catchup";
  const cuRef = "src/lib/event-days/process-reservation-deadline.ts";
  for (const [id, code, http] of [
    ["TC-EX-CU-NF", "not_found", "404"],
    ["TC-EX-CU-NO", "not_open", "409"],
    ["TC-EX-CU-DNR", "deadline_not_reached", "422"],
    ["TC-EX-CU-NC", "no_change", "409"],
    ["TC-EX-CU-DB", "db", "500"],
    ["TC-EX-CU-OK", "ok locked or minimum", "200"],
  ]) {
    add({
      テストID: id,
      レベル: L3,
      大分類: A,
      中分類: "締切catchup",
      対象ID: cuPath,
      テストケース名: `applyReservationDeadlineCatchup: ${code}`,
      観点区分: http.startsWith("2") ? "正常" : "異常",
      前提条件: `${authAdmin}。acknowledged true。DBを ${code} になるよう準備`,
      手順: "POST JSON { acknowledged: true }",
      期待結果: `HTTP ${http}、JSONに code: ${code}（成功時は outcome）`,
      確認証跡: "HTTP+JSON",
      優先度: "P0",
      自動化: "可",
      実装参照: cuRef,
      備考: "apply-deadline-catchup/route.ts の statusForCode と整合",
    });
  }

  // ----- GET/PATCH slots（認証・404）-----
  for (const [id, method, note, pre] of [
    ["TC-EX-SG-401", "GET", "未認証", "セッションなし"],
    ["TC-EX-SG-404", "GET", "開催日UUID不存在", authAdmin],
    ["TC-EX-SPT-401", "PATCH", "未認証", "セッションなし"],
    ["TC-EX-SF-401", "POST force", "未認証", "セッションなし"],
  ]) {
    add({
      テストID: id,
      レベル: L3,
      大分類: A,
      中分類: "slots",
      対象ID: `/api/admin/event-days/{id}/slots`,
      テストケース名: note,
      観点区分: "セキュリティ/異常",
      前提条件: pre,
      手順: `${method}（401はCookieなし、404は存在しない開催日UUID）`,
      期待結果: "401 または 404",
      確認証跡: "HTTP",
      優先度: "P1",
      自動化: "可",
      実装参照: "src/app/api/admin/event-days/[id]/slots/route.ts",
      備考: "",
    });
  }

  // ----- replaceReservationLunchItems（公開PATCH token 経由）-----
  const lpRef = "src/lib/lunch/replace-reservation-lunch-items.ts";
  for (const [id, code, http] of [
    ["TC-EX-LP-DUP", "lunch_duplicate", "422"],
    ["TC-EX-LP-INV", "lunch_menu_invalid", "422"],
    ["TC-EX-LP-DB", "db_error", "500"],
  ]) {
    add({
      テストID: id,
      レベル: L3,
      大分類: "公開API",
      中分類: "予約PATCH昼食",
      対象ID: "PATCH /api/reservations/{token}",
      テストケース名: `replaceReservationLunchItems: ${code}`,
      観点区分: http === "500" ? "異常" : "境界",
      前提条件: "open・締切前・有効token。メニュー重複または無効ID等でRPC前段を誘発",
      手順: "lunchItems を不正組み立て",
      期待結果: `HTTP ${http}`,
      確認証跡: "HTTP",
      優先度: "P1",
      自動化: "可",
      実装参照: lpRef,
      備考: "reservations/[token]/route.ts が status を振り分け",
    });
  }

  // ----- 昼食メニュー API（admin list/create + [id] patch/delete + 公開GET）-----
  const lmListRef = "src/app/api/admin/lunch-menu-items/route.ts";
  const lmIdRef = "src/app/api/admin/lunch-menu-items/[id]/route.ts";
  const lmPubRef = "src/app/api/lunch-menu/route.ts";
  for (const [id, method, name, exp, ref] of [
    ["TC-EX-LM-AG-401", "GET", "一覧 未認証", "401", lmListRef],
    ["TC-EX-LM-AG-500", "GET", "一覧 DB select 失敗", "500", lmListRef],
    ["TC-EX-LM-AP-401", "POST", "追加 未認証", "401", lmListRef],
    ["TC-EX-LM-AP-400J", "POST", "JSON 壊れ", "400", lmListRef],
    ["TC-EX-LM-AP-422N0", "POST", "name 空", "422", lmListRef],
    ["TC-EX-LM-AP-422N120", "POST", "name 121文字超", "422", lmListRef],
    ["TC-EX-LM-AP-422D2K", "POST", "description 2001文字超", "422", lmListRef],
    ["TC-EX-LM-AP-422P", "POST", "price_tax_included 非整数・0以下", "422", lmListRef],
    ["TC-EX-LM-AP-201", "POST", "正常作成（is_active 省略時 true・sort_order 省略時 0）", "201", lmListRef],
    [
      "TC-EX-LM-AP-201B",
      "POST",
      "description が非文字列→null 正規化（422 にならない）",
      "201",
      lmListRef,
    ],
    ["TC-EX-LM-AP-500", "POST", "insert 失敗", "500", lmListRef],
  ]) {
    add({
      テストID: id,
      レベル: L3,
      大分類: A,
      中分類: "lunch-menu-items",
      対象ID: `${method} /api/admin/lunch-menu-items`,
      テストケース名: name,
      観点区分: exp.startsWith("2") ? "正常" : "異常",
      前提条件: exp === "401" ? "セッションなし" : authAdmin,
      手順: `${method} JSON は route.ts の分岐に合わせる`,
      期待結果: `HTTP ${exp}`,
      確認証跡: "HTTP+JSON",
      優先度: "P1",
      自動化: "可",
      実装参照: ref,
      備考: "",
    });
  }
  for (const [id, name, exp] of [
    ["TC-EX-LM-PCH-401", "PATCH 未認証", "401"],
    ["TC-EX-LM-PCH-400ID", "id が UUID 形式でない", "400"],
    ["TC-EX-LM-PCH-400J", "JSON 壊れ", "400"],
    ["TC-EX-LM-PCH-422NM", "name が文字列でない", "422"],
    ["TC-EX-LM-PCH-422NE", "name 空または 121 文字超", "422"],
    ["TC-EX-LM-PCH-422DT", "description が文字列/null 以外", "422"],
    ["TC-EX-LM-PCH-422DL", "description 2001文字超", "422"],
    ["TC-EX-LM-PCH-422PR", "price_tax_included 不正", "422"],
    ["TC-EX-LM-PCH-422IA", "is_active が boolean でない", "422"],
    ["TC-EX-LM-PCH-422SO", "sort_order が整数でない", "422"],
    ["TC-EX-LM-PCH-422EMP", "更新キーなし", "422"],
    ["TC-EX-LM-PCH-404", "存在しない UUID", "404"],
    ["TC-EX-LM-PCH-500", "update 失敗", "500"],
    ["TC-EX-LM-PCH-200", "部分更新成功", "200"],
    ["TC-EX-LM-DL-401", "DELETE 未認証", "401"],
    ["TC-EX-LM-DL-400ID", "DELETE id 不正", "400"],
    ["TC-EX-LM-DL-500", "DELETE DB 失敗", "500"],
    ["TC-EX-LM-DL-200", "DELETE 成功", "200"],
  ]) {
    add({
      テストID: id,
      レベル: L3,
      大分類: A,
      中分類: "lunch-menu-items/[id]",
      対象ID: "PATCH/DELETE /api/admin/lunch-menu-items/{id}",
      テストケース名: name,
      観点区分: exp.startsWith("2") ? "正常" : "異常",
      前提条件: exp === "401" ? "セッションなし" : authAdmin,
      手順: "PATCH または DELETE（ケース名に応じる）",
      期待結果: `HTTP ${exp}`,
      確認証跡: "HTTP+DB",
      優先度: "P1",
      自動化: "可",
      実装参照: lmIdRef,
      備考: "",
    });
  }
  for (const [id, name, exp] of [
    ["TC-EX-LM-PUB-500", "公開GET select 失敗", "500"],
    ["TC-EX-LM-PUB-200", "公開GET 正常・is_active のみ camelCase", "200"],
  ]) {
    add({
      テストID: id,
      レベル: L3,
      大分類: "公開API",
      中分類: "昼食メニュー",
      対象ID: "GET /api/lunch-menu",
      テストケース名: name,
      観点区分: exp === "200" ? "正常" : "異常",
      前提条件: exp === "500" ? "DB障害シミュレーション" : "マスタ1件以上",
      手順: "GET（認証不要）",
      期待結果: `HTTP ${exp}`,
      確認証跡: "HTTP+JSON",
      優先度: "P1",
      自動化: "可",
      実装参照: lmPubRef,
      備考: "TC-PUB-LUNCH-001 と重複観点なら統合可",
    });
  }

  // ----- reservation-deadline-default（単体ファイルの it 列挙）-----
  add({
    テストID: "TC-EX-UT-RD-01",
    レベル: L3,
    大分類: "単体テスト",
    中分類: "reservation-deadline-default",
    対象ID: "tests/unit/reservation-deadline-default.test.ts",
    テストケース名: "開催2日前15:00 JST を返す",
    観点区分: "正常",
    前提条件: "vitest unit",
    手順: "npx vitest run tests/unit/reservation-deadline-default.test.ts",
    期待結果: "it 成功",
    確認証跡: "vitest",
    優先度: "P1",
    自動化: "可",
    実装参照: "src/lib/dates/reservation-deadline-default.ts",
    備考: "",
  });

  // ----- event-day-slot-count-policy（it 列挙）-----
  const slotPolicyTitles = ["枠数3+3/4+4のみOK", "枠追加は常に不可"];
  slotPolicyTitles.forEach((title, i) => {
    add({
      テストID: `TC-EX-UT-SL-${String(i + 1).padStart(2, "0")}`,
      レベル: L3,
      大分類: "単体テスト",
      中分類: "event-day-slot-count-policy",
      対象ID: "tests/unit/event-day-slot-count-policy.test.ts",
      テストケース名: title,
      観点区分: "正常",
      前提条件: "vitest unit",
      手順: "npx vitest run tests/unit/event-day-slot-count-policy.test.ts",
      期待結果: "it 成功",
      確認証跡: "vitest",
      優先度: "P1",
      自動化: "可",
      実装参照: "src/lib/event-days/event-day-slot-count-policy.ts",
      備考: "",
    });
  });

  // ----- Cron send-day-before-final（route.ts ループ内分岐）-----
  const crDbfPath = "GET/POST /api/cron/send-day-before-final";
  const crDbfRef = "src/app/api/cron/send-day-before-final/route.ts";
  const crDbfPre =
    "CRON_SECRET 有効・Authorization: Bearer 一致。event_days.event_date = 東京「明日」";
  for (const [id, name, exp] of [
    [
      "TC-EX-CR-DBF-01",
      "summary: final_notice_already_completed（final_day_before_notice_completed_at 済）",
      "summary に skippedReason final_notice_already_completed、処理スキップ",
    ],
    [
      "TC-EX-CR-DBF-02",
      "雨天前日予約+最新 cancel で confirmed→cancelled_weather へ更新",
      "UPDATE 成功時 status が cancelled_weather、以降 variant weather_cancel",
    ],
    [
      "TC-EX-CR-DBF-03",
      "reservations 取得エラー",
      "該当 eventDay の summary が sent=skipped=failed=0 で continue",
    ],
    [
      "TC-EX-CR-DBF-04",
      "contact_email 空で skipped++",
      "メール送信ループのみスキップ",
    ],
    [
      "TC-EX-CR-DBF-05",
      "weather_cancel_immediate が sent の予約はスキップ",
      "二重防止分岐",
    ],
    [
      "TC-EX-CR-DBF-06",
      "day_before_final が sent の予約はスキップ",
      "再送しない",
    ],
    [
      "TC-EX-CR-DBF-07",
      "variant=held（status confirmed）",
      "payload variant held・weatherNotes は go 時の文言等",
    ],
    [
      "TC-EX-CR-DBF-08",
      "variant=weather_cancel",
      "雨天確定後の最終案内",
    ],
    [
      "TC-EX-CR-DBF-09",
      "variant=operational_cancel + operational_cancellation_notice",
      "参加者向け文言がメールに載る",
    ],
    [
      "TC-EX-CR-DBF-10",
      "variant=pending_matching（status locked）",
      "編成待ち最終案内",
    ],
    [
      "TC-EX-CR-DBF-11",
      "notifications insert 失敗",
      "failed++、continue",
    ],
    [
      "TC-EX-CR-DBF-12",
      "failed>0 で sendOpsBatchFailureDigestEmail（JOB03）",
      "運用メールまたはログで検証",
    ],
    [
      "TC-EX-CR-DBF-13",
      "failed===0 で final_day_before_notice_completed_at 更新",
      "event_days に時刻が入る",
    ],
    [
      "TC-EX-CR-DBF-14",
      "after が sent/failed 以外は skipped++",
      "pending 等の取りこぼし分岐",
    ],
    [
      "TC-EX-CR-DBF-15",
      "POST が GET に委譲",
      "POST でも 200 と同一ロジック",
    ],
  ]) {
    add({
      テストID: id,
      レベル: L3,
      大分類: "Cron",
      中分類: "前日最終（内部分岐）",
      対象ID: crDbfPath,
      テストケース名: name,
      観点区分: "境界",
      前提条件: crDbfPre,
      手順: "該当データを seed したうえで Cron を1回実行",
      期待結果: exp,
      確認証跡: "HTTP JSON summary + DB notifications/event_days",
      優先度: "P1",
      自動化: "要検討",
      実装参照: crDbfRef,
      備考: "503/401 は TC-CRN-send-day-before-final-* で網羅",
    });
  }

  // ----- Cron send-matching-proposal（route.ts ループ内分岐）-----
  const crMpPath = "GET/POST /api/cron/send-matching-proposal";
  const crMpRef = "src/app/api/cron/send-matching-proposal/route.ts";
  const crMpPre =
    "CRON_SECRET 有効・Bearer 一致。event_date = 東京今日+2日・matching_proposal_notice_sent_at IS NULL・status locked|confirmed";
  for (const [id, name, exp] of [
    [
      "TC-EX-CR-MP-01",
      "reservations 取得エラー",
      "summary で sent=skipped=failed=0 の行が入り continue",
    ],
    [
      "TC-EX-CR-MP-02",
      "contact_email 空",
      "skipped++ のみ",
    ],
    [
      "TC-EX-CR-MP-03",
      "matching_proposal 既に sent",
      "skipped++",
    ],
    [
      "TC-EX-CR-MP-04",
      "notifications insert 失敗",
      "emailFailed++",
    ],
    [
      "TC-EX-CR-MP-05",
      "existing failed→pending へ戻して再送",
      "update 後に送信処理へ",
    ],
    [
      "TC-EX-CR-MP-06",
      "送信後 notifications.status が sent",
      "sent++",
    ],
    [
      "TC-EX-CR-MP-07",
      "送信後 status が failed",
      "emailFailed++・digest（案内メール）",
    ],
    [
      "TC-EX-CR-MP-08",
      "emailFailed===0 で matching_proposal_notice_sent_at スタンプ",
      "event_days 更新成功",
    ],
    [
      "TC-EX-CR-MP-09",
      "スタンプ UPDATE 失敗",
      "stampFailed・digest（フラグ更新）",
    ],
    [
      "TC-EX-CR-MP-10",
      "after が sent/failed 以外",
      "skipped++",
    ],
    [
      "TC-EX-CR-MP-11",
      "POST が GET に委譲",
      "POST でも同一レスポンス",
    ],
  ]) {
    add({
      テストID: id,
      レベル: L3,
      大分類: "Cron",
      中分類: "マッチング案内（内部分岐）",
      対象ID: crMpPath,
      テストケース名: name,
      観点区分: "境界",
      前提条件: crMpPre,
      手順: "該当 seed のあと Cron 実行",
      期待結果: exp,
      確認証跡: "HTTP JSON summary + notifications + event_days",
      優先度: "P1",
      自動化: "要検討",
      実装参照: crMpRef,
      備考: "503/401 は TC-CRN-send-matching-proposal-* で網羅",
    });
  }

  // ----- MVP必須（カレンダー・Hub・問い合わせの抜け補完・TC-MVP-*）-----
  const mvpPub = "公開API";
  const dashPath = "GET /api/admin/dashboard/next-event-day";
  const dashRef = "src/app/api/admin/dashboard/next-event-day/route.ts";

  add({
    テストID: "TC-MVP-PUB-ED-500",
    レベル: L3,
    大分類: mvpPub,
    中分類: "開催日一覧",
    対象ID: "GET /api/event-days",
    テストケース名: "event_days select 失敗時は500",
    観点区分: "異常",
    前提条件: "DB障害または接続拒否を再現できる環境",
    手順: "GET",
    期待結果: "500、JSONに error / code",
    確認証跡: "HTTP",
    優先度: "P1",
    自動化: "要検討",
    実装参照: "src/app/api/event-days/route.ts",
    備考:
      "【分岐】event_days の .select 直後の if (error) で 500。【リスク】トップ／カレンダーが取得不能になり予約導線に入れない・問い合わせ集中。監視・ユーザー向けエラー表示の要否を確認する。",
  });

  add({
    テストID: "TC-MVP-PUB-AV-500",
    レベル: L3,
    大分類: mvpPub,
    中分類: "空き状況",
    対象ID: "GET /api/event-days/{date}/availability",
    テストケース名: "開催日・枠・予約のいずれかの select 失敗で500",
    観点区分: "異常",
    前提条件: "該当日は公開ステータスで存在するが後段クエリを失敗させる",
    手順: "GET（正常な YYYY-MM-DD）",
    期待結果: "500",
    確認証跡: "HTTP",
    優先度: "P1",
    自動化: "要検討",
    実装参照: "src/app/api/event-days/[date]/availability/route.ts",
    備考:
      "【分岐】開催日取得・event_day_slots・reservations の各 if (dayErr|slotsErr|resErr)。【リスク】枠空きが表示されず誤った枠選択や「予約できると思わせる」状態を防ぐ。フロントのリトライ／エラー文言とセットで見る。",
  });

  for (const [id, name, pre, step, exp, bikou] of [
    [
      "TC-MVP-ADM-DASH-400A",
      "クエリ after 欠落は400",
      authAdmin,
      "GET（クエリなし）",
      "400、after（YYYY-MM-DD）が必要です",
      "【分岐】after 取得後 !after で 400。【リスク】基準日なしの広域クエリや誤集計を防ぐ。フロントの必須クエリ漏れを早期検知。",
    ],
    [
      "TC-MVP-ADM-DASH-400B",
      "after が暦日として無効は400",
      authAdmin,
      "GET ?after=2026-02-30",
      "400（isValidIsoDateParam 不一致）",
      "【分岐】isValidIsoDateParam(after) が false。【リスク】形式だけ合っていても存在しない日付で「次の開催日」を誤表示するのを防ぐ。",
    ],
    [
      "TC-MVP-ADM-DASH-200N",
      "after より後に開催日が無いとき day は null",
      authAdmin,
      "GET ?after=2099-12-31",
      "200、JSON.day が null",
      "【分岐】loadNextEventDayHubSummaryAfter が該当なしで null→JSON { day: null }。【リスク】シーズン終了後も UI が壊れず「次がない」状態を運用が把握できる。",
    ],
    [
      "TC-MVP-ADM-DASH-200Y",
      "直近の開催日1件が返る",
      `${authAdmin}。DBに after より後の開催日が1件以上`,
      "GET ?after=過去の既知日付",
      "200、day.id / event_date 等が期待通り",
      "【分岐】認証後 try 内の正常レスポンス。【リスク】昼食・通知確認の起点。ここが取りこぼすと当日オペ（枠・メール）の抜けに直結。TC-ADM-DASH-001（401）とセット。",
    ],
  ]) {
    add({
      テストID: id,
      レベル: L3,
      大分類: A,
      中分類: "dashboard",
      対象ID: dashPath,
      テストケース名: name,
      観点区分: exp.includes("null") || exp.includes("200") ? "正常" : "異常",
      前提条件: pre,
      手順: step,
      期待結果: exp,
      確認証跡: "HTTP+JSON",
      優先度: "P0",
      自動化: "可",
      実装参照: dashRef,
      備考: bikou,
    });
  }

  add({
    テストID: "TC-MVP-ADM-NOTIF-401",
    レベル: L3,
    大分類: A,
    中分類: "notifications",
    対象ID: "GET /api/admin/notifications",
    テストケース名: "未認証401",
    観点区分: "セキュリティ",
    前提条件: "セッションなし",
    手順: "GET ?status=failed",
    期待結果: "401 Unauthorized",
    確認証跡: "HTTP",
    優先度: "P0",
    自動化: "可",
    実装参照: "src/app/api/admin/notifications/route.ts",
    備考:
      "【分岐】getAdminUser() が偽の先頭ガード。【リスク】通知一覧は宛先メール・チーム名・テンプレ種別を含みうる。未認証取得は個人情報漏えいに直結するため必須防御の回帰テスト。",
  });

  for (const [id, name, exp, pre, note, kind, bikou] of [
    [
      "TC-MVP-PUB-CAMP-422",
      "answers バリデーション失敗（必須欠落など）",
      "422、fieldId 付きメッセージ",
      "-",
      "parseCampInquiryAnswers の代表例",
      "異常",
      "【分岐】parseCampInquiryAnswers が ok:false の return。【リスク】不正・不完全入力を DB に載せず説明可能なエラーに留める。返信不能な連絡先ミスを事前に減らす。",
    ],
    [
      "TC-MVP-PUB-CAMP-429",
      "短時間に連投でレート制限",
      "429、Retry-After",
      "-",
      "rateLimitCampInquiryCreate",
      "セキュリティ",
      "【分岐】rateLimitCampInquiryCreate が非 null。【リスク】ボットや誤多重送信で insert／通知メールが洪水になり、正当な相談が埋もれる。運用コストと到達性の両面。",
    ],
    [
      "TC-MVP-PUB-CAMP-500",
      "DB insert 失敗",
      "500",
      "正しい answers",
      "Supabase 障害シミュレーション",
      "異常",
      "【分岐】insert 後 if (error || !row?.id)。【リスク】ユーザーは送信したと認識しうるが保存されていない→クレーム・機会損失。監視と「再試行」UI文言の整合を確認。",
    ],
  ]) {
    add({
      テストID: id,
      レベル: L3,
      大分類: mvpPub,
      中分類: "合宿相談POST",
      対象ID: "POST /api/camp-inquiries",
      テストケース名: name,
      観点区分: kind,
      前提条件: pre,
      手順: `POST JSON（${note}）`,
      期待結果: exp,
      確認証跡: "HTTP",
      優先度: "P1",
      自動化: "要検討",
      実装参照: "src/app/api/camp-inquiries/route.ts",
      備考: bikou,
    });
  }

  for (const [id, name, exp, bikou] of [
    [
      "TC-MVP-PUB-TRN-400J",
      "JSON 壊れ",
      "400",
      "【分岐】request.json() の catch。【リスク】中間プロキシやクライアント不具合で壊れた body が来たとき、500 にしないで切り分けできる。",
    ],
    [
      "TC-MVP-PUB-TRN-422",
      "必須項目欠落またはメール形式不正",
      "422",
      "【分岐】parseBody が null のときの 422。【リスク】連絡不能な問い合わせを DB に積まない。運営の返信工数とユーザー体験の両方。",
    ],
    [
      "TC-MVP-PUB-TRN-429",
      "レート制限超過",
      "429",
      "【分岐】rateLimitTournamentInquiryCreate。【リスク】スパムで問い合わせキューが汚染され、本件対応が遅延。TC-PUB-TRN-001（正常）とセットで往路／制限を確認。",
    ],
  ]) {
    add({
      テストID: id,
      レベル: L3,
      大分類: mvpPub,
      中分類: "大会お問い合わせPOST",
      対象ID: "POST /api/tournament-inquiries",
      テストケース名: name,
      観点区分: id.endsWith("429") ? "セキュリティ" : "異常",
      前提条件: "-",
      手順: "POST（ケースに応じ body または連投）",
      期待結果: exp,
      確認証跡: "HTTP",
      優先度: "P1",
      自動化: "要検討",
      実装参照: "src/app/api/tournament-inquiries/route.ts",
      備考: bikou,
    });
  }

  for (const [id, path, ref, name, exp, pre, bikou] of [
    [
      "TC-MVP-ADM-CAMP-401",
      "PATCH /api/admin/camp-inquiries/{id}",
      "src/app/api/admin/camp-inquiries/[id]/route.ts",
      "未認証401",
      "401",
      "セッションなし",
      "【分岐】getAdminUser() 偽。【リスク】相談ステータスが第三者に改ざんされうる。対応履歴の信頼性崩壊を防ぐ。",
    ],
    [
      "TC-MVP-ADM-CAMP-400",
      "PATCH ...（id が UUID でない）",
      "src/app/api/admin/camp-inquiries/[id]/route.ts",
      "パス id 不正は400",
      "400 ID が不正です",
      authAdmin,
      "【分岐】UUID_RE.test(id) 偽。【リスク】誤パスや旧URLで DB に無意味なクエリを飛ばさない。負荷・ログノイズ削減。",
    ],
    [
      "TC-MVP-ADM-CAMP-400J",
      "PATCH ...",
      "src/app/api/admin/camp-inquiries/[id]/route.ts",
      "JSON 壊れ400",
      "400",
      authAdmin,
      "【分岐】request.json() catch。【リスク】管理画面のバグや拡張で壊れた PATCH が 500 化しないことを確認。",
    ],
    [
      "TC-MVP-ADM-CAMP-422",
      "PATCH ...",
      "src/app/api/admin/camp-inquiries/[id]/route.ts",
      "status が許容値以外422",
      "422",
      authAdmin,
      "【分岐】isCampInquiryStatus が偽。【リスク】手作業ワークフロー用の status が自由文字列だと集計・フィルタが壊れる。",
    ],
    [
      "TC-MVP-ADM-CAMP-500",
      "PATCH ...",
      "src/app/api/admin/camp-inquiries/[id]/route.ts",
      "存在しないUUIDは single 失敗で500",
      "500",
      authAdmin,
      "【分岐】update 後 if (error || !data)（0 行は error になりうる）。【リスク】404 と区別しづらいが、現行実装の挙動として「存在しない ID」の運用ミスを検知し UI／ログを合わせる必要がある。",
    ],
    [
      "TC-MVP-ADM-TRN-401",
      "PATCH /api/admin/tournament-inquiries/{id}",
      "src/app/api/admin/tournament-inquiries/[id]/route.ts",
      "未認証401",
      "401",
      "セッションなし",
      "【分岐】getAdminUser() 偽。【リスク】大会問い合わせの対応状況が第三者に晒される・改ざんされる。",
    ],
    [
      "TC-MVP-ADM-TRN-422",
      "PATCH ...",
      "src/app/api/admin/tournament-inquiries/[id]/route.ts",
      "status 不正422",
      "422",
      authAdmin,
      "【分岐】isCampInquiryStatus（共通ステータス集合）が偽。【リスク】合宿と同様、運用ラベルの乱立で一覧・レポートが壊れる。",
    ],
  ]) {
    add({
      テストID: id,
      レベル: L3,
      大分類: A,
      中分類: path.includes("tournament") ? "大会問い合わせ" : "合宿相談",
      対象ID: path,
      テストケース名: name,
      観点区分: exp === "401" ? "セキュリティ" : "異常",
      前提条件: pre,
      手順: "PATCH JSON または Cookie なし（ケースによる）",
      期待結果: exp,
      確認証跡: "HTTP",
      優先度: "P1",
      自動化: "可",
      実装参照: ref,
      備考: bikou,
    });
  }
}
