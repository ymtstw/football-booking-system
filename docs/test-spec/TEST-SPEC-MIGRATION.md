# テスト仕様 TSV の移行（レビュー用フォーマット）

## 1. 変更概要

- **旧 15 列・415 行版の退避**: `docs/test-spec/archive/full-system-test-spec-legacy-15col.tsv`（コミット `e983926` 時点の複製）。
- **出力先は従来どおり** `docs/test-spec/full-system-test-spec.tsv`。
- **列構成を 12 列に再定義**し、重複していた Cron 認証ケース等を**統合**したうえで、**運用で事故りやすい領域**（認証・締切・自動編成・公開予約 UI・通知）を厚く記述した。
- 生成エントリポイントは **`node scripts/gen-full-test-spec-tsv.mjs`** のまま（中身を差し替え）。
- データは **`scripts/test-spec-reviewable-data.mjs`** に集約。
- **15 列・TC-* で 400 行超だった旧版**は git 履歴で参照可能。網羅行のソースだった `scripts/test-spec-exhaustive.mjs` は現行ジェネレータから**未参照**（将来、必要な `TC-EX` 行だけを本データへ移植可能）。

## 2. 列定義

| 列名 | 内容 |
|------|------|
| 機能 | 業務まとまり（例: 締切Cron（JOB01）） |
| 画面/API | ファイルパスまたは HTTP パス |
| ケースID | 安定 ID（PX / AL / CK / RM / RSV / …） |
| テストケース名 | 簡潔な日本語 |
| 前提条件 | DB 状態・認証・時刻の前提 |
| 入力 | クエリ・body・操作の入力 |
| 手順 | 実行手順 |
| 期待結果 | **HTTP に加え DB 副作用・画面**まで記載 |
| 観点 | レビュー観点の短いラベル |
| 種別 | 正常系 / 異常系 / 境界値 / 権限 / 状態遷移 / 冪等性 / 整合性 のいずれか |
| 優先度 | P0〜P2 |
| 備考 | **【分岐】**・**【リスク】**・旧 TC 統合メモ |

## 3. 統合・削除した主な重複（旧 ID）

| 新ケース | 統合・代替した旧例 |
|----------|-------------------|
| CK-001 | TC-AUTH-004, TC-CRN-lock-event-days-SEC-401, TC-EX-IN-CR-02 |
| CK-002 | TC-AUTH-005, TC-CRN-lock-event-days-SEC-503, TC-EX-IN-CR-01 |
| CK-003 / CK-021 | TC-CRN-lock-event-days-OK-200 の「空振り／冪等」部分 |
| API-ED-001 | TC-PUB-ED-002, TC-PUB-ED-003 |
| API-AV-001 | TC-PUB-AV-001, TC-PUB-AV-002 |
| MVP-DASH-400 | TC-MVP-ADM-DASH-400A, 400B |
| MVP-DASH-200 | TC-MVP-ADM-DASH-200N, 200Y |

削除したのは「同一分岐・同一期待を別名だけ変えた重複」に限る。細分岐（天候・運営中止の TC-EX 全列）は**未移植**（下記「今後厚く」参照）。

## 4. 追加した高リスク観点（抜け漏れ補強）

- **Next.js 16**: `middleware.ts` は無く **`src/proxy.ts`** がセッション更新・OAuth 着地点補正を担当 → PX-*。
- **管理権限**: `app_admins` 不在ユーザーと保護 layout の組み合わせ → AL-002。
- **JOB01**: `unchanged` 競合・**最少中止後も event_days は cancelled のまま**（メール部分失敗）→ CK-013, CK-031。
- **JOB02**: **HTTP 200 でも results 内に失敗行**が混在しうる点 → RM-013, RM-015。
- **予約 UI**: **二重送信（submitting）**・**sessionStorage 無しの完了ページ**・**429** → RSV-011〜013, RSV-012。
- **前日確定・通知**: NF-010 で Cron 成功時の **DB 副作用**を期待結果に明記。

## 5. 今後さらに厚くできる領域（薄いまま）

- 管理 API の **TC-EX 相当の網羅**（weather-decision / operational-cancel / PATCH matches 全分岐）。
- **結合テスト・Vitest 行**との 1:1 対応表。
- **公開 `/reserve/manage` の編集**・キャンセル UI と API の双方向。
- **camp / tournament** 問い合わせの全バリデーション（旧 TC-MVP の残り）。
- **send-matching-proposal** の skipped / digest 細分岐。
- **RPC の全エラーコード**（create_public_reservation の列挙）。

## 6. 主要リスクとケース ID の対応（要約）

| リスク | 主なケース ID |
|--------|----------------|
| 未認証・非管理者の情報漏えい | AL-001, AL-002, MVP-NOTIF-401 |
| 締切誤処理・二重遷移 | CK-010, CK-013, CK-021 |
| 最少中止の連絡漏れ／部分失敗 | CK-011, CK-031 |
| Cron 不正実行 | CK-001, RM-001 |
| 自動編成の見逃し（200 だが失敗行） | RM-013, RM-015 |
| 予約の二重送信・レート超過 | RSV-011, RSV-012 |
| 画面と DB の不一致（完了ページ） | RSV-010, RSV-013 |
| 前日通知の失敗扱い | NF-010 |
