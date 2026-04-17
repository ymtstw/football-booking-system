# 和歌山サッカー交流試合 参加予約・午前確定・午後自動編成システム

**開発設計書（MVP最終版）**


| 項目      | 内容                                                                                |
| ------- | --------------------------------------------------------------------------------- |
| 版       | MVP最終版 / 2026-04-06（枠数・代表学年・午後編成を 2026-04-15 追記。枠編集の予約ガード・強制 API を 2026-04-15 追記。同日予約上限を枠 capacity 合計に 2026-04-16 追記。本番/ステージング/メール送信のホスト分離を §1-5 に 2026-04-16 追記。予約締切・Cron・通知スケジュールを運用正に 2026-04-16 文書同期。§1-6 DB バックアップ方針を 2026-04-17 追記） |
| 作成      | 鹿島 大和                                                                             |
| 更新日     | 2026-04-17（§1-6 データベースバックアップ方針を追記）／2026-04-16（§2-2 締切・§5 フロー・§9 Cron/通知を「2日前15:00／案内16:30／最終17:00」に更新。§1-5 ホスト方針・枠上限は従来どおり）                                                             |
| 対象      | 小学生サッカーチーム向け日帰り交流試合                                                               |
| MVP中心機能 | 午前複数枠予約（既定 **3+3**、最大 **4+4**）、午前試合確定、午後自動編成、前日確定連絡、強制編集（チーム差し替え / 枠変更）、枠無効化      |
| 確定前提    | 芝1面のみ / 1時間1枠 / 1枠2チーム固定 / 午前は予約で確定 / 午後は自動編成 / 土グラ対象外                            |
| カテゴリ    | strong / potential の2区分のみ                                                         |
| 技術構成    | Next.js + Tailwind CSS + Supabase + PostgreSQL + Vercel                           |
| 文書の位置づけ | 個人開発・外注レビュー・実装着手・見積の起点として使える最終版設計書                                                |


---

## 0. エグゼクティブサマリー

本書は、4月末までに和歌山サッカー交流試合のMVPを個人開発で実装し、前日確定から当日受付までを破綻なく運用するための開発設計書である。設計の最優先方針は「午前は予約時点で分かりやすく確定」「午後だけを自動編成」「MVPに不要な複雑さは入れない」の3点とする。

同時に、MVP後に作り直しが発生しないよう、状態遷移・名寄せ・排他制御・再実行・warning体系など、後から揉めやすい論点は先にルール化している。MVPの範囲は絞るが、設計の芯は後続拡張に耐える構造とする。


| 区分     | 採用方針     | 理由 / 実装意図                                                                                 |
| ------ | -------- | ----------------------------------------------------------------------------------------- |
| 午前枠予約  | 採用       | 利用者が選んだ枠に2チームそろった時点で対戦相手が確定するため、理解しやすく問い合わせも減る。                                           |
| 午後自動編成 | 採用       | カテゴリ一致と重複回避を優先しつつ、成立優先で柔軟に組める。                                                            |
| 枠管理    | 開催日単位で管理 | 新規開催日は既定で **午前3・午後3（計6枠）** を生成する。**枠数は午前=午後で 3+3 または 4+4 のみ**（管理 API・画面で強制）。不要枠は無効化で吸収する。 |
| 通知     | 最小構成のみ   | 予約完了 / **マッチング案内メール**（編成直後・**16:30 JST** 想定の Cron）／**前日17:00の最終版メール**（開催確定＋対戦予定＋雨天判断を1通）／**例外時**雨天中止の即時メール・「前日17:00雨天文面」の予約送信。催促や再送自動化はMVP外とする。   |
| 審判     | 簡易候補表示   | 当事者以外から1候補のみ自動提示し、高度最適化は後続拡張とする。                                                          |
| 決済     | 対象外      | 予約の成立・編成・当日運用を先に安定させ、後から payment_status を追加できる構造に留める。                                     |
| 名寄せ補正  | MVPでは非採用 | MVPでは team 統合UIは持たず、予約成立と簡易同一判定を優先する。将来、重複補正が必要になった場合に追加可能な構造に留める。                        |
| 手動調整   | 最低限採用    | 自動編成後の最低限の補正として、チーム差し替えと枠変更を管理UIから実施可能とする。対戦相手の直接組み替えはMVP外とする。                            |


### MVPの成功条件

- 公開画面で午前枠の埋まり状況が直感的に分かること。
- 締切後に午前補完・午後編成・前日確定通知が1回で処理できること。
- 管理画面で午前・午後・審判候補・warning を確認できること。
- 管理画面で枠追加・枠無効化・時刻変更・チーム差し替え・枠変更が迷わず行えること。

---

## 1. 文書の位置づけと設計原則

### 1-1. 文書の位置づけ

本書は要件定義書ではなく、DB migration、API、ドメインサービス、管理画面、Cron、テストへ直接落とし込むための開発設計書である。個人開発で実装着手する際の基準であると同時に、外部レビューや見積提示のベースとしても利用できる完成度を目標とする。

### 1-2. システムの役割

- 開催日、対象学年、締切、時間枠を管理する。
- 利用者が午前枠を選択して予約し、その枠に2チームそろった時点で午前対戦を確定する。
- 締切後、未充足の午前枠を補完し、午後枠を自動編成する。
- 前日確定内容を管理画面へ表示する。
- 当日運用はシステム対象外とし、現場判断で進行する。

### 1-3. システムがやらないこと

- 土グラウンドの予約・割当・利用管理
- 宿泊、交通、決済、返金
- 勝敗記録、順位表、大会運営機能
- 当日受付・チェックイン、当日の複雑な差し替え編集、リアルタイムチャット、運営間連携の自動化
- 通知再送管理や督促フローの高度化

### 1-4. 設計原則

- 芝1面・1時間1枠・1枠2チーム固定を絶対前提とする。
- 開催日の枠本数は **午前・午後が同数で、いずれも3または4**（`docs/spec` の実装は `src/lib/event-days/event-day-slot-count-policy.ts` と管理 API `POST .../slots` に準拠）。
- 開催成立は「1日3チーム以上」で判定し、**同日の予約（active）上限**は有効な午前枠の `capacity` 合計（通常 **3+3 で最大6**、**4+4 で最大8**）。各午前枠では 0〜`capacity` チーム（既定 `capacity=2`）。
- 午前は予約で確定、午後だけを自動編成対象とする。
- カテゴリは strong / potential の2種類のみとし、カテゴリ一致は優先条件、絶対条件にはしない。
- team 名寄せは MVP では既存team候補抽出の簡易キー運用に留め、重複統合UIは持たない。将来 normalized_team_name や external_team_key を追加しやすいよう、teams は独立マスタとして保持する。
- 試合確定状態の真実源は match_assignments とし、午前 fixed は2チームそろった時点で即時作成する。
- MVPで不要な機能は切るが、後続拡張に必要なキー・状態・履歴は先に残す。
- 同メール登録ならなるべくマッチングしないようにする

### 1-5. ホスト名・環境分離（本番 Web / ステージング Web / メール送信）

MVP では **Supabase を本番プロジェクトとステージングプロジェクトで分離**している前提とし、Vercel 側も **環境ごとに固定の Web ホスト**を割り当てる（Preview の可変 URL のみに依存しない運用を推奨する）。加えて **メール送信用ドメインを Web 用ホストと別サブドメインに分ける**。Resend は送信用にルートではなく **サブドメイン**（評判の分離・用途の明確化）を推奨しており、本設計に合わせる。

**採用するホスト構成（合計 3 本・例: apex `greenplanet-project.com`）**

| 用途 | サブドメイン例 | 備考 |
|------|----------------|------|
| 本番 Web（利用者向け画面および管理 `/admin` は同一 Next アプリ） | `football-booking.greenplanet-project.com` | 本番 `NEXT_PUBLIC_SITE_URL` の正。**末尾スラッシュなし**。 |
| ステージング Web | `staging-football-booking.greenplanet-project.com` | ステージング用 Supabase・Vercel（Preview または Staging 割当）と **1:1 で対応**させる。Supabase Auth の **Site URL / Redirect URLs** に明示登録し、本番 URL との取り違えを防ぐ。 |
| メール送信（Resend の From に使うドメイン） | `updates.greenplanet-project.com`（代替候補: `notify.greenplanet-project.com`） | Web の本番・ステージングとは **別サブドメイン**。SPF/DKIM は Resend の案内に従い DNS に追加する。 |

**環境変数・運用上の対応**

- **`NEXT_PUBLIC_SITE_URL`**: デプロイ先ごとに **その環境の Web ホスト**（本番 URL / ステージング URL）を設定する。メール内の予約リンク・合宿相談の管理画面 URL 等のベースになる。値を変えたら **Redeploy**（`NEXT_PUBLIC_*` はビルド時埋め込みのため）。
- **`RESEND_FROM` / 通知先メール**（例: `CAMP_INQUIRY_NOTIFY_EMAIL`）: ステージングでは **テスト用の宛先**、本番では **本番の運営宛**とする。**送信ドメイン（`updates.*` 等）は Resend で 1 回検証し、本番・ステージングの両方の `RESEND_FROM` で共有してよい**（表記やローカルパートで区別してもよい）。Staging 専用に送信用サブドメインをもう 1 本増やすのは MVP では必須としない。

**Supabase Auth**

- **Site URL** は環境ごとに **その Web ホスト**（本番・ステージングで別）。
- **Redirect URLs** に本番・ステージングの双方およびローカル（例: `http://localhost:3000/**`）を登録する。手順の型は `docs/setup-staging-supabase.md` を参照。

**関連ドキュメント**

- Vercel 環境変数・Cron: `docs/ops/vercel-production-checklist.md`
- Resend ドメイン検証: `docs/setup-resend-domain.md`

### 1-6. データベースバックアップ（Supabase）

本システムの正本データは **Supabase（PostgreSQL）** にある。アプリ（Vercel）だけデプロイしても、DB を失うと予約・編成・通知履歴が復元できないため、**プロジェクト単位でバックアップ方針を決めて運用する**。

**1）Supabase が提供するバックアップ（まずここを使う）**

- Supabase Dashboard → 対象プロジェクト → **Database**（または **Settings → Database**）周辺で、**自動バックアップ・復元・PITR（ポイントインタイムリカバリ）**の有無と保持期間を確認する。
- **プランによって機能が異なる**（無料枠は日次スナップショットのみ／Pro 以上で PITR 等）。本番で採用するプランの公式ドキュメントに従い、**「何日前まで戻せるか」「手動ダウンロードはあるか」**を把握しておく。
- **本番とステージングは別プロジェクト**（§1-5）のため、それぞれで上記を確認する。

**2）大きなマイグレーションや本番変更の直前（推奨の追加策）**

- ダッシュボード上で **手動バックアップやスナップショットが取れる**なら、そのタイミングで取得する。
- または **論理バックアップ（pg_dump）** をローカル／CI から実行し、ファイルを **暗号化ストレージ**など安全な場所に保存する（接続文字列・パスワードはチャットやリポジトリに入れない）。
  - 接続情報は Supabase の **Project Settings → Database** の Connection string（**Session mode** 推奨、`psql` / `pg_dump` 用）を参照する。
  - 例（形式のイメージ。実際のホスト・ポート・ユーザーはプロジェクトごとに異なる）:  
    `pg_dump "postgresql://postgres.[PROJECT_REF]:[PASSWORD]@aws-0-[REGION].pooler.supabase.com:5432/postgres" -Fc -f backup_YYYYMMDD.dump`
  - 復元は運用時に `pg_restore` または Supabase / PostgreSQL の手順に従う（**空のプロジェクトへリストア**など、既存プロジェクトへの上書きは事故りやすいので手順を事前に読む）。

**3）バックアップで「しない」ことの認識**

- アプリの `public/` や Vercel のファイルだけバックアップしても、**予約データは復元できない**。
- 設計上、予約確認コードの**平文**は DB に保存しないため、バックアップから行を復元しても **利用者に再通知できないトークンは復元できない**（運用はマイグレーション前の影響範囲を狭くすることが重要）。

**4）運用ルール（MVP 推奨）**

- **本番**に `supabase/migrations` を適用する前に、可能なら **ステージングで同一マイグレーションを先に適用**し、その後本番で **§1-6 の 1）または 2）** を実施する。
- バックアップファイルのアクセス権は **必要最小限の人員**に限定する（個人情報・チーム連絡先を含む）。

---

## 2. 業務ルール

### 2-1. 開催日と対象学年

開催対象日は土曜・日曜・祝日・特別開催日（special）とする。対象学年は開催日単位で 1-2年 → 3-4年 → 5-6年 の順に循環させる。祝日判定APIは使わず、管理画面で event_day を登録する。

**代表学年（予約時）:** 各 `teams` に `**representative_grade_year`（1〜6）** を持たせ、公開予約フォームで利用者が選択する。開催日の `grade_band`（`1-2` / `3-4` / `5-6` 等）と整合しない学年は `create_public_reservation` RPC で拒否する。複数学年が混在するチームは **人数が多い側の学年**で登録する旨を画面で案内する。自動編成では強さに続き **学年が近い相手**を優先する（詳細は `matching-algorithm-impl.md`）。

### 2-2. 開催成立条件


| 項目    | 値                       | 備考                       |
| ----- | ----------------------- | ------------------------ |
| 最低開催数 | 3チーム                    | 締切時点の active 予約が3未満なら不成立 |
| 上限数   | 枠に連動（通常6または8）           | 有効な午前枠の `capacity` 合計まで（3+3 で6、4+4 で8）。それを超える件は受付不可      |
| 午前枠上限 | 各枠2チーム                  | 1時間の1枠には対戦する2チームまで       |
| 予約締切  | **開催2日前15:00（JST）** を既定（`reservation_deadline_at` で個別変更可） | 昼食数変更締切も同一 `reservation_deadline_at` |
| 取消締切  | 上に同じ                    | 締切後はWeb取消不可              |
| 公開条件  | event_day.status = open | 対象学年が一致していること            |


### 2-3. カテゴリルール


| 論点     | ルール                                                                                                                                         |
| ------ | ------------------------------------------------------------------------------------------------------------------------------------------- |
| カテゴリ種別 | strong / potential の2種類のみ                                                                                                                   |
| 午前予約時  | カテゴリは表示情報。カテゴリ不一致でも予約可能                                                                                                                     |
| 午前補完時  | カテゴリ一致優先 → 既存対戦相手とかぶらない優先 → それでも不足ならカテゴリ跨ぎ許容                                                                                                |
| 午後編成時  | 空き枠解消・全日試合数の平準化（目標回数）・全員午前1・午後1を優先し、そのうえで **強さが近い相手**、**学年が近い相手**、重複回避、gap 等の順でソフト比較（実装詳細は `matching-algorithm-impl.md`）。カテゴリ跨ぎは成立のため許容し得る。 |
| 運用上の意味 | カテゴリは試合品質を上げる優先条件であり、成立を妨げる制約にはしない                                                                                                          |


### 2-4. 予約ルール

- 予約は team 単位ではなく reservation 単位で管理する。同一チームによる同一開催日の複数予約は制御で禁止せず、運用上許容する。
- 同一チーム名・同一メールアドレス・同一電話番号での登録もブロックしない。MVPでは不正確な排除よりも予約成立を優先し、同一チーム判定は簡易キーによる候補抽出とマッチング時の回避ロジックで吸収する。
- 予約入力項目は、チーム名、代表者名、メールアドレス、電話番号、カテゴリ、**代表学年（1〜6）**、参加人数、昼食数、午前枠、備考とする。
- 午前枠の **本数** は開催日ごとに **3または4**（午後と同数）。既定作成は3枠。4枠運用は管理画面から **午前1枠・午後1枠を同数になるよう順に追加**する（§3-2-1）。
- 午前枠に2チームが入った時点で、その枠の morning_fixed 試合を即時作成する。
- 昼食数は初期値では 1 以上を必須とし、特例時のみ settings で0を許容する。

### 2-5. team 自動作成・再利用ルール


| 論点        | 採用ルール                                                                                       |
| --------- | ------------------------------------------------------------------------------------------- |
| 初回予約      | 公開予約フォーム送信時に teams を自動作成する                                                                  |
| 再利用キー     | MVPでは team_name + contact_email を既存team再利用の暫定候補キーとして用いる                                     |
| 暫定キーの位置づけ | このキーは既存team候補を絞るための簡易キーであり、一意制約には使わない。将来 normalized_team_name や external_team_key の追加を前提とする |
| 既存team更新  | contact_name / contact_phone / strength_category は最新値で更新可。team_name は原則上書きしない               |
| 停止中team   | is_active = false の team は予約不可                                                              |
| 取消時のteam  | 予約取消でも reservation は cancelled とし、team は削除しない。team は将来再利用を考慮したマスタとして残し、停止は管理画面のみで行う         |
| 簡易マージ     | MVPでは非採用。将来、重複補正の必要性が高まった場合に、管理画面から source / target を統合する機能を追加できる余地を残す                      |
| 同日複数予約    | 同一teamによる同一開催日の複数 reservation は許容し、試合編成・枠管理・当日受付は reservation 単位で扱う                         |


**名寄せに関する設計判断**

MVPでは過度な名寄せUIや統合処理は持たない。  
既存team候補の抽出には暫定キーを用いるが、一意制約には使わず、予約成立を優先する。  
また、team_name の自動上書きを抑制することで、予約ごとにマスタ名が揺れる事故を防ぐ。  
将来拡張時に normalized_team_name や external_team_key、必要に応じた team 統合機能を追加しても、reservations や match_assignments の作り直しが不要な構造にしている。

#### 2-5-1. 将来拡張としての team 統合機能

MVPでは team 統合機能は実装しない。ただし、将来の運用で重複補正の必要性が高まった場合に備え、統合機能を追加しやすいよう teams を独立マスタとして保持する。

- 将来追加する場合は、source team を target team へ統合し、source team は削除せず停止状態で残す方針を想定する。
- 参照更新の対象は reservations.team_id を基本とし、match_assignments は reservation 単位管理のため直接の付け替え対象にはしない想定とする。
- source と target が同一、target が停止中、開催日確定処理と競合する場合は実行不可とする想定とする。
- 監査が必要な場合は、merged_from_team_id、merged_to_team_id、reason、merged_by、merged_at を保持するログテーブル追加を想定する。
- なお、同一チームの複数参加は MVP では reservations を分けて表現し、試合編成・審判候補・当日受付は reservation 単位で扱う。

### 2-6. 午前補完・午後編成ルール


| 論点      | ルール                                                                                                                       |
| ------- | ------------------------------------------------------------------------------------------------------------------------- |
| 午前補完    | 締切時点で未充足の午前枠へ同日参加チームを追加割当し、午前試合を可能な限り成立させる                                                                                |
| 午前補完優先順 | カテゴリ一致 > その枠に未割当 > 既存対戦相手とかぶらない > 割当回数が少ない                                                                                |
| 午後編成    | 全参加チームを対象に午後枠を自動編成し、目標出場回数と可行性を満たしつつ **まず全員に午後1試合**を優先し、空枠が残る場合は **全日目標まで**午後の追加試合を許可する（旧仕様の「午後最大2試合固定」は廃止。多枠時は3試合目以降も可）。 |
| 重複割当    | 全日の定員未満で枠が余る場合のみ、一部チームに2試合目を割り当てる                                                                                          |
| 対戦重複回避  | 午前に当たった相手と午後で再度当てるのは避ける。避けきれない場合は warning を付与                                                                             |
| 審判      | 午後各試合について、当事者以外から1チームのみ候補表示する。候補なしなら warning を付与                                                                          |


### 2-7. 当日運用とシステムの境界


| 論点   | システムで扱う     | 現場運用で扱う        |
| ---- | ----------- | -------------- |
| 参加可否 | 締切前までの予約・取消 | 当日の欠席・遅刻への最終対応 |
| 午前試合 | 前日確定結果の表示   | 当日の進行判断        |
| 午後試合 | 前日確定結果の表示   | 当日の進行判断        |
| 出欠確認 | 扱わない        | 現地で口頭確認        |
| 昼食   | 前日確定数の表示のみ  | 配布順・不足時対応      |
| 土グラ  | 扱わない        | 必要なら自由利用       |


### 2-8. 雨天判断

雨天判断は**原則として前日に行い**、管理画面で go / cancel を**事前登録**できる。参加者向けの標準通知は **前日 17:00（JST）の「最終版」1通**（Cron JOB03）に、開催確定／雨天中止の文面・直近の判断メモ・（確定済みなら）対戦予定をまとめて送る。**荒天・雷・グラウンド不可など**は、中止登録で **即時に `cancelled_weather` 確定＋即時メール**（`weather_cancel_immediate`）を選べる。通常どおり翌日まで判断を延ばす場合は **「前日17:00に雨天中止文面を送る」予約**（`delivery: day_before_17`・即時確定しない）も選べる。即時送信済みや最少中止済みと二重にならないよう API・JOB03 側で抑止する。cancel（即時確定）の場合、weather_status = cancel かつ event_day.status = cancelled_weather に更新する。go の場合、weather_status = go とし、event_day.status は中止から戻すときは confirmed に復帰させ、それ以外は locked / confirmed 等の直前状態を維持する。

cancelled_weather 状態に遷移した場合でも、reservations、match_assignments 等のデータは削除せず保持する。  
これにより、運用履歴および分析用途への利用を可能とする。

**weather_status と event_day.status の整合規則**

- weather_status は天候判断の内部状態、event_day.status は開催全体の業務状態である。
- cancel のみ、業務状態を cancelled_weather へ遷移させる。
- go は開催継続の意思決定であり、open / locked / confirmed などの主状態を上書きしない。
- 同一開催日において weather_status と event_day.status が矛盾する更新はAPIで拒否する。

---

## 3. 時間枠（event_day_slots）管理設計

MVPでは全体テンプレートテーブルは持たない。開催日作成時にシステムが **既定6枠（午前3・午後3）** を生成し（`src/domains/event-days/default-slots.ts`）、以後は `event_day_slots` のみを管理する。**運用で許す枠数は午前・午後が同数の 3 または 4 のみ**（§3-2-1）。4枠運用にするときは管理画面から **MORNING_4 / AFTERNOON_4** を追加する。将来、人工芝1面を2分割して同時運用する場合は、display_order ではなく lane（面識別）カラムを追加して対応する。

### 3-1. 初期生成する時間枠（新規開催日の既定）


| phase     | slot_code   | 開始    | 終了    | 容量   | 用途    |
| --------- | ----------- | ----- | ----- | ---- | ----- |
| morning   | MORNING_1   | 09:00 | 10:00 | 2チーム | 予約で確定 |
| morning   | MORNING_2   | 10:00 | 11:00 | 2チーム | 予約で確定 |
| morning   | MORNING_3   | 11:00 | 12:00 | 2チーム | 予約で確定 |
| afternoon | AFTERNOON_1 | 13:00 | 14:00 | 2チーム | 自動編成  |
| afternoon | AFTERNOON_2 | 14:00 | 15:00 | 2チーム | 自動編成  |
| afternoon | AFTERNOON_3 | 15:00 | 16:00 | 2チーム | 自動編成  |


**4枠運用にするとき:** 上表に加え、`MORNING_4`（12:00–13:00）と `AFTERNOON_4`（16:00–17:00）を **枠追加 API** で挿入する（時刻は実装の採番ルールに従い調整可）。追加は **午前1本・午後1本の順で同数になるよう**行う（§3-2-1）。

### 3-2. 管理画面で許可する操作

**正本（実装）:** `PATCH` / `POST` `/api/admin/event-days/{id}/slots`（通常）および `/api/admin/event-days/{id}/slots/force`（強制）。共通ライブラリは `src/lib/event-days/admin-event-day-slot-mutations.ts`。


| 操作                        | 許可条件（通常 API）                                                                                                                                   | 補足                                                        |
| ------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------- |
| 開始終了時刻変更・`is_active` 更新   | `event_days.status` が `draft` または `open` かつ、**当該開催日に `reservations.status = active` が 0 件**であること。開始 < 終了（同一 phase の時間重複チェックは MVP では未実装・運用で避ける） | 保存時は `is_time_changed = true` を付与（実装一括。枠ごとの差分判定は未）        |
| 枠追加                       | 上記に加え **§3-2-1 の枠数ポリシー**を満たすこと                                                                                                                 | **午前=午後で 3 または 4 のみ**。API は違反時 422。行削除 APIは MVP では持たない。   |
| 枠無効化（`is_active = false`） | 通常 API では **開催日に active 予約が 1 件でもある間は不可**（枠単位ではなく開催日単位でブロック）                                                                                   | 公開画面・編成対象から除外する効果は従来どおり。強制 API でのみ予約残存下でも変更可（下記 §3-2-2）。  |
| 強制経路                      | `draft` / `open` のみ。リクエスト JSON に `**acknowledgeReservationRisk: true`** を含むこと                                                                  | 別画面（`/admin/event-days/{id}/slots/force`）で同意チェック後にのみ呼び出す。 |


#### 3-2-2. 強制枠変更 API（予約が残っている場合）

- **目的:** 誤設定の是正など、やむを得ず **active 予約が残ったまま** 枠の時刻・有効フラグを変える場合に限り、通常 API とは別経路で許可する。
- **エンドポイント:** `PATCH /api/admin/event-days/{id}/slots/force`（一括更新）、`POST /api/admin/event-days/{id}/slots/force`（枠1本追加）。本文に `acknowledgeReservationRisk: true` が必須（無ければ 422）。
- **前提:** `event_days.status` は `draft` / `open` のみ（`locked` / `confirmed` 等では 409）。**監査ログ（`slot_change_logs`）への自動記録は未実装**（Phase 3 チェックリスト参照）。

設計書 §3-3 の旧表「予約あり・締切前は時刻変更のみ許可」は、**データ不整合防止のため実装では「通常 API は予約ゼロのみ」に寄せた**。時刻変更が必要で予約がある場合は **強制 API ＋運用連絡** とする。

### 3-2-1. 枠数ポリシー（追加仕様）

- **許容される枠数の組み合わせ:** 午前 **3** ・午後 **3**（計6枠）、または 午前 **4** ・午後 **4**（計8枠）**のみ**。
- **禁止の例:** 午前と午後の本数が一致しないまま確定させること（合計 **7** など）、合計 **5以下** や **9以上**、片方だけ **5枠以上** にすること。
- **追加の進め方:** 3+3 から 4+4 にする場合、**一時的に (4,3) または (3,4)** となってよいが、**最終的に 4+4 に揃える**こと（API は「追加1本後もルール内か」で判定。実装: `canAppendEventDaySlotForPhase`）。
- **参照実装:** `src/lib/event-days/event-day-slot-count-policy.ts`、`POST /api/admin/event-days/{id}/slots`、管理 UI `slots-editor-client.tsx`。

### 3-3. 変更制御ルール

**通常の枠 API:** 開催日に **active 予約が 1 件でもある** あいだ、`PATCH` / `POST` `/slots` は **409** で拒否する（`draft` / `open` でも同様）。予約ゼロのときのみ時刻・有効・枠追加が可能。

**強制枠 API:** §3-2-2。予約が残っていても `acknowledgeReservationRisk: true` で更新・追加可。変更後の時刻は DB 上は即時反映されるが、**利用者への自動通知は行わない**（必要なら管理者が個別連絡）。


| 状態                           | 通常 `/slots` | `/slots/force` | 理由 / 実装方針                                                             |
| ---------------------------- | ----------- | -------------- | --------------------------------------------------------------------- |
| 予約なし・`draft`/`open`          | 可           | 可（ack 必須）      | 開催日ごとの枠調整。                                                            |
| 予約あり・`draft`/`open`          | 不可（409）     | 可（ack 必須）      | 通常経路での取り違え防止。強制は別 UI のみ。                                              |
| `locked` / `confirmed` / 中止系 | 不可          | 不可             | `status` 非 `draft`/`open` は 409。                                      |
| 確定後の試合割当の補正                  | —           | —              | 枠マスタではなく **§8 の強制編集（`PATCH /api/admin/matches/{id}`）** を想定（MVP 未実装可）。 |


#### 3-3-1. 枠変更フラグ（is_time_changed）

予約が1件以上存在する枠の開始時刻または終了時刻を管理画面から変更した場合、該当 event_day_slot の is_time_changed を true に更新する。  
is_time_changed = true の枠は、管理画面および前日確定画面で強調表示し、運用上の要注意枠として扱う。  
MVPでは自動通知は行わず、必要に応じて管理者が個別連絡を行う。フラグは開催終了後も履歴として残す。

### 3-4. 重要な制約の考え方

「1枠2チーム以下」は『1時間の1枠には対戦する2チームしか入れない』（`capacity` 既定値）という意味であり、「1日3チーム以上」の開催成立条件とは別概念である。したがって、日全体では3〜（有効午前枠の capacity 合計）チーム、各午前枠では0〜`capacity` チームという二層で判定する。

予約APIでは selected_morning_slot_id に対して event_day_slots の対象行を `SELECT ... FOR UPDATE` でロックし、そのトランザクション内で active 予約件数を再集計する。2件未満であれば insert、2件以上なら 409 を返し rollback する。これにより同時アクセス時でも3チーム目が同一午前枠に入らないようにする。

**枠数拡張に関する設計判断**

MVPの初期値は **午前3枠・午後3枠** とし、**4枠運用は 4+4 のみ** 許可する（上記 §3-2-1）。`event_day_slots` を開催日単位で持つため、reservations や match_assignments の構造変更は不要。影響範囲は、管理画面UI・編成ロジック（枠数可変）・帳票表示に限定される。  
また、将来人工芝1面を2分割して同時運用する場合は、表示順制御ではなく lane（面識別）カラムを event_day_slots または match_assignments に追加して対応する想定とする。

---

## 4. システム構成と責務分割


| レイヤ      | 責務                     | 主実装                      |
| -------- | ---------------------- | ------------------------ |
| 公開UI     | 開催日一覧、予約、予約照会・取消       | Next.js App Router       |
| 管理UI     | 開催日管理、枠管理、前日確定表示、雨天判断  | Next.js App Router       |
| API      | 公開API、管理API、cron受口     | Next.js Route Handlers   |
| ドメインサービス | 予約、締切、午前補完、午後編成、通知     | TypeScript (server-side) |
| DB       | 状態管理、監査、通知履歴、設定        | Supabase PostgreSQL      |
| ジョブ      | 締切ロック（最少中止含む）、午前補完・午後編成、案内メール、前日最終メール | Vercel Cron              |


### 4-1. 推奨ディレクトリ構成

- `app/(public)/event-days`
- `app/(public)/reservations`
- `app/(admin)/dashboard`
- `app/(admin)/event-days`
- `app/(admin)/matches`
- `app/api/`
- `domains/reservations/`
- `domains/matching/`
- `domains/notifications/`
- `domains/weather/`
- `lib/db/`
- `lib/auth/`
- `lib/validators/`
- `supabase/migrations/`
- `tests/unit/`
- `tests/integration/`
- `tests/e2e/`

### 4-2. 非機能要件

- 管理系更新処理はすべてサーバー側で行い、クライアントから直接テーブル更新させない。
- 予約作成・締切処理・午前補完・午後編成・雨天判断はトランザクションで実行する。
- 公開APIにはレート制限を入れる。特に予約照会・取消APIは強めに制限する。
- 個人情報は管理画面以外に表示しない。
- 障害原因と予約履歴を追える最低限のログは残すが、MVPで過度な分析ログは持たない。

---

## 5. 業務フローとマッチングロジック


| 順   | 処理内容                                                 | 主要データ                            |
| --- | ---------------------------------------------------- | -------------------------------- |
| 1   | 開催日作成。対象学年・締切・初期枠（既定 **6枠＝午前3+午後3**）を作成              | event_days, event_day_slots      |
| 2   | 公開。open の開催日だけ公開画面に表示                                | event_days                       |
| 3   | 公開予約。team を自動作成または再利用して reservation を作成              | teams, reservations, meal_orders |
| 4   | 必要に応じて開催日枠を調整                                        | event_day_slots                  |
| 5   | 締切（**既定: 開催2日前15:00 JST**）。Cron で `open` を処理：active が3未満なら `cancelled_minimum`＋最少中止メール、3以上なら `locked` | event_days, notifications |
| 6   | 午前補完・午後編成（**締切1分後**想定の Cron）し前日確定データを作成              | matching_runs, match_assignments |
| 7   | **マッチング案内メール**（**16:30 JST** 想定）。以降、SCR-11/12 で対戦・審判を確認・微修正 | notifications（`matching_proposal`） |
| 8   | 雨天判断。go / cancel。**標準は前日17:00最終1通**／即時雨天・前日17:00雨天予約は API の `delivery` で制御 | weather_decisions, event_days |
| 9   | **前日17:00** 最終メール（Cron JOB03）。開催／雨天中止を1通で送る        | notifications（`day_before_final`） |


### 5-1. 午前 fixed の確定タイミング

午前・午後ともに試合編成の主語は team ではなく reservation とする。同一teamが同日に複数参加する場合でも、各 reservation を別参加として扱う。

午前は「2チームそろった瞬間」に固定試合レコードを作成する。具体的には、予約APIのトランザクション内で対象枠に active 予約が2件目として入る場合、同枠の2チームを参照した match_assignments.assignment_type = morning_fixed を即時作成する。

これにより、UI上だけ確定してDBにはまだ試合がない、というねじれを排除する。取消が発生した場合は、関連する morning_fixed の状態を cancelled に変更し、必要に応じて締切後補完の対象へ戻す。

### 5-2. 午前補完ロジック（MVP確定版）

1. 対象は、締切時点で active な同日参加チーム全体とする。
2. まず、既に morning_fixed として作成済みの枠を確定済みとして扱う。
3. 次に、1チームだけ入っている午前枠を優先して埋める。
4. 相手候補の選定順は「カテゴリ一致 > その枠に未割当 > 既存対戦相手とかぶらない > 割当回数が少ない」とする。
5. カテゴリ一致候補がいなければ、カテゴリ不一致でも割り当てる。
6. 0チームの午前枠は最後に対象とし、全体が有効午前枠の定員の範囲で成立可能な場合のみ埋める。

### 5-3. 午後編成ロジック（MVP確定版）

実装の正本は `**matching-algorithm-impl.md`**。概要のみ以下に記す。

1. 全日の **目標出場回数**（試合行数×2を active 人数で割り、最大1試合差の配分）を先に決める。
2. 有効な **午後枠を時間順**に処理し、各枠で **目標超過なし**かつ **残り枠を理論上埋め切れる辺**（可行性）のみ採用する。
3. **第1段階:** まだ午後0試合の人を優先する **eligible** でペアを選ぶ。
4. **第2段階:** 空枠が残るとき、目標未到達の人は **午後3試合目以降も可**（旧「午後最大2試合」固定は廃止。実効上限は目標との差分）。
5. 候補のソフト優先は **初午後を付けられる人数 → 強さが近い → 学年が近い → 同カ完結の残り可行性（加点）→ 重複 → gap 等**（`build-matching-assignments.ts`）。
6. カテゴリ跨ぎ・同日再対戦は成立のため許容し得る（warning 付与）。

### 5-4. 審判候補ロジック（簡易版）

午後各試合について、team_a / team_b 以外の同日参加チームから1チームを候補表示する。優先順は「その日まだ審判候補になっていないチーム > 割当回数が少ないチーム」とする。候補が存在しない場合は referee_team_id を null とし、warning_json に referee_unassigned を入れる。

### 5-5. warning コード体系


| warning_code                | 意味              |
| --------------------------- | --------------- |
| cross_category_match        | カテゴリ跨ぎで成立させた対戦  |
| duplicate_opponent          | 同日内で対戦相手が重複した   |
| double_assigned_reservation | 同一予約に追加割当が発生した  |
| referee_unassigned          | 審判候補を割り当てられなかった |
| unfilled_slot               | 成立できなかった枠が残った   |


### 5-6. matching_runs の current 管理

編成ジョブは再実行履歴を `matching_runs` に残す。開催日ごとに **参照・表示・帳票の対象とするのは `is_current = true` の run に紐づく `match_assignments` のみ** とする。運用上の詳細ルールは 5-7 に従う。

### 5-7. 管理画面の強制編集（MVP採用）

MVPでは自動編成を基本とするが、入力揺れや予約内容の補正に対応するため、管理者が最低限の強制編集を行えるようにする。対象は「チーム差し替え」と「枠変更」の2種類とし、いずれも管理者のみ実行可能とする。チーム差し替えは reservation 単位の補正として扱い、誤登録や代理参加に対応する。枠変更は既存対戦を別枠へ移す補正とし、対戦相手そのものの直接組み替えはMVP外とする。

強制編集を行った match_assignments には manual_override = true を付与し、override_reason を必須入力とする。変更前後の内容は match_adjustment_logs に before_json / after_json / changed_by / changed_at / reason として保存する。

強制編集時も「同一試合で同一 team を対戦させない」「同一時刻帯で同一 team を重複配置しない」「芝1面のため同一時刻に複数試合を置かない」の制約は必ず維持する。

matching_runs は再実行履歴を残すためのテーブルであり、is_current を持つ。新規 run が success で完了した場合、同一 event_day の旧 current run は false に更新し、新 run のみ true とする。管理画面・前日確定結果・帳票は current run の match_assignments のみを表示対象とする。

---

## 6. 画面設計


| 画面ID   | 画面名       | 主利用者 | 主機能                                                                                              |
| ------ | --------- | ---- | ------------------------------------------------------------------------------------------------ |
| SCR-01 | 開催日一覧・予約  | 利用者  | 開催日表示、午前枠埋まり表示、予約入力                                                                              |
| SCR-02 | 予約完了      | 利用者  | reservation_token 表示、入力内容確認                                                                      |
| SCR-03 | 予約照会・取消   | 利用者  | token による照会、締切前取消                                                                                |
| SCR-10 | 管理ダッシュボード | 管理者  | 明日開催サマリー（昼食・参加人数・状態・通知 failed→前日確定）（`/admin/dashboard`）                                      |
| SCR-11 | 前日確定      | 管理者  | 試合一覧・自動編成・巻き戻し（`/admin/pre-day-results`・タブ「試合一覧」）                                                |
| SCR-12 | 前日確定補正    | 管理者  | チーム差し替え、枠変更（同一 URL のタブ「確定の補正」・`/admin/pre-day-adjust` はリダイレクト）                                   |
| SCR-13 | 開催日管理     | 管理者  | 開催日作成、公開状態、締切、雨天判断、**通知・送信状況**（`/admin/event-days/{id}/notifications`）                                                                               |
| SCR-14 | 開催日枠管理    | 管理者  | event_day_slots の時刻・有効・枠追加（通常は予約ゼロ時のみ編集可）。**予約あり時は強制変更画面**（`/admin/event-days/{id}/slots/force`） |


### 6-1. 公開予約画面の表示ルール

- 各午前枠は 0/2、1/2、2/2 の埋まり状況を表示する。
- 2/2 の枠は満席表示にし、予約不可とする。
- 「午前は予約で対戦相手が確定」「午後は前日に自動確定」を明記する。
- カテゴリは表示するが、カテゴリ不一致でも予約をブロックしない。
- 予約フォーム内で team の初回作成 / 再利用が完結するため、ログインは不要とする。

---

## 7. データモデル・ER設計

### 7-1. テーブル一覧


| テーブル                  | 用途          | MVP使用 | 備考                         |
| --------------------- | ----------- | ----- | -------------------------- |
| users                 | 管理者・運営担当者   | 使用    | Supabase Auth と連携          |
| teams                 | チーム属性・代表者情報 | 使用    | 公開予約時に自動作成 / 再利用           |
| event_days            | 開催日・締切・状態   | 使用    | MVPの中心テーブル                 |
| event_day_slots       | 開催日個別の時間枠   | 使用    | 4枠以上への拡張を許容。不要枠は無効化で吸収する   |
| reservations          | 参加予約本体      | 使用    | 同一teamの同日複数予約を許容           |
| meal_orders           | 昼食数         | 使用    | reservation と 1:1          |
| matching_runs         | 補完・編成実行単位   | 使用    | is_current を持つ             |
| match_assignments     | 午前・午後の確定試合  | 使用    | 確定状態の真実源                   |
| weather_decisions     | 雨天判断履歴      | 使用    | go / cancel の履歴            |
| notifications         | 通知履歴        | 使用    | MVPでは送信履歴中心                |
| reservation_events    | 予約監査        | 使用    | 作成・取消・将来の token 再送等に拡張可能   |
| settings              | 運用設定        | 使用    | meal_count 0許容など           |
| slot_change_logs      | 枠変更監査       | 使用    | is_time_changed 更新と変更履歴を保持 |
| match_adjustment_logs | 強制編集監査      | 使用    | チーム差し替え / 枠変更の履歴を保持        |


### 7-2. 状態遷移（統一定義）


| 対象                | 状態一覧                                                                      | 説明               |
| ----------------- | ------------------------------------------------------------------------- | ---------------- |
| event_days        | draft / open / locked / confirmed / cancelled_weather / cancelled_minimum | 開催日全体の状態         |
| reservations      | active / cancelled                                                        | 予約そのものの有効 / 無効のみ |
| matching_runs     | success / failed                                                          | 補完・編成ジョブの結果      |
| match_assignments | scheduled / cancelled                                                     | 個別試合の状態          |


### 7-3. MVPにおける終了状態の扱い

MVPでは event_day.status に completed は採用しない。当日運用はシステム対象外とするため、状態管理は draft / open / locked / confirmed / cancelled_weather / cancelled_minimum までとし、開催終了後の追加状態は持たない。将来、当日実績や試合結果をシステムで管理する場合に completed の追加を検討する。

### 7-4. 主要テーブル定義（抜粋）


| テーブル                  | 主要カラム                                                                                                                                                                                                       | 補足                                                                                        |
| --------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| teams                 | id, team_name, normalized_team_name null, strength_category, **representative_grade_year**（1〜6、NULL可だが予約経路では必須）, contact_name, contact_email, contact_phone, is_active, created_at, updated_at              | normalized_team_name は将来拡張のため予約。代表学年は予約時に選択し、開催日の学年帯と RPC で整合検証する。                        |
| event_days            | id, event_date, grade_band, status, reservation_deadline_at, weather_status, notes                                                                                                                          | weather と業務状態を分離                                                                          |
| event_day_slots       | id, event_day_id, slot_code, phase, start_time, end_time, capacity, is_active, is_time_changed, is_locked                                                                                                   | is_active = false で公開画面・編成対象から除外する。将来、1コート2分割運用を行う場合は lane カラム追加で対応する                     |
| reservations          | id, event_day_id, team_id, selected_morning_slot_id, status, participant_count, reservation_token_hash, remarks, display_name null, created_at, updated_at                                                  | token 平文は保存しない。display_name は運用上の識別名                                                      |
| meal_orders           | id, reservation_id unique, meal_count, notes, created_at, updated_at                                                                                                                                        | reservation と 1:1                                                                         |
| matching_runs         | id, event_day_id, status, is_current, warning_count, started_at, finished_at                                                                                                                                | current run を1つだけ持つ                                                                       |
| match_assignments     | id, matching_run_id, event_day_id, event_day_slot_id, match_phase, assignment_type, reservation_a_id, reservation_b_id, referee_reservation_id null, status, warning_json, manual_override, override_reason | morning_fixed / morning_fill / afternoon_auto。試合の主語は reservation。manual_override で強制編集を識別 |
| slot_change_logs      | id, event_day_slot_id, before_json, after_json, changed_by, changed_at, reason                                                                                                                              | 枠時刻変更監査。is_time_changed 更新の根拠を保持                                                          |
| match_adjustment_logs | id, match_assignment_id, action_type, before_json, after_json, changed_by, changed_at, reason                                                                                                               | 強制編集監査。team差し替え / 枠変更を保持                                                                  |


### 7-5. 制約・インデックス


| 対象                    | 内容                                                   | 目的                 |
| --------------------- | ---------------------------------------------------- | ------------------ |
| teams                 | INDEX(team_name, contact_email)                      | 再利用候補検索を高速化        |
| event_days            | UNIQUE(event_date)                                   | 同日の重複開催防止          |
| event_day_slots       | UNIQUE(event_day_id, slot_code)                      | 開催日内の枠識別重複防止       |
| event_day_slots       | CHECK(start_time < end_time)                         | 時間整合性担保            |
| event_day_slots       | INDEX(event_day_id, phase, is_active)                | 有効枠の取得を高速化         |
| reservations          | INDEX(event_day_id, team_id)                         | team別集計・検索用        |
| reservations          | INDEX(selected_morning_slot_id, status)              | 午前枠埋まり確認用          |
| reservations          | CHECK(participant_count > 0)                         | 人数0防止              |
| meal_orders           | CHECK(meal_count >= 0)                               | 昼食数異常値防止           |
| match_assignments     | CHECK(reservation_a_id <> reservation_b_id)          | 同一予約対戦防止           |
| matching_runs         | PARTIAL UNIQUE(event_day_id) WHERE is_current = true | current run を一意に保つ |
| event_day_slots       | INDEX(event_day_id, phase, is_time_changed)          | 変更注意枠の一覧取得         |
| match_adjustment_logs | INDEX(match_assignment_id, changed_at DESC)          | 強制編集履歴追跡           |


### 7-6. participant_count と meal_count の意味

participant_count は「当日参加するチーム関係者の総人数」とする。選手のみではなく、指導者・帯同者を含めた総人数として入力する。meal_count は昼食提供対象人数であり、participant_count より多くても少なくてもエラーにしない。これにより帯同人数や持参昼食の差異を現場運用で吸収できる。

---

## 8. API設計


| API                                              | 用途           | 認証           | 概要                                                                                                                                      |
| ------------------------------------------------ | ------------ | ------------ | --------------------------------------------------------------------------------------------------------------------------------------- |
| GET /api/event-days                              | 公開中開催日の一覧    | 不要           | 開催日・対象学年・午前埋まり状況を返す                                                                                                                     |
| GET /api/event-days/{date}/availability          | 対象日の空き状況     | 不要           | 各午前枠の予約数とカテゴリ内訳を返す                                                                                                                      |
| POST /api/reservations                           | 予約作成         | 不要           | team 自動作成/再利用と reservation 作成を同時実行                                                                                                      |
| GET /api/reservations/{token}                    | 予約照会         | token        | 予約内容を返す                                                                                                                                 |
| POST /api/reservations/{token}/cancel            | 予約取消         | token        | 締切前なら cancelled に更新                                                                                                                     |
| POST /api/admin/event-days                       | 開催日作成/更新     | admin        | event_day と既定枠（`default-slots` 件数）を保存                                                                                                   |
| GET /api/admin/event-days/{id}/slots             | 開催日枠取得       | admin        | event_day_slots を返す                                                                                                                     |
| PATCH /api/admin/event-days/{id}/slots           | 開催日枠一括更新（通常） | admin        | **active 予約 0 件**かつ `draft`/`open` のときのみ。時刻・`is_active` を更新し `is_time_changed = true`（枠本数は変えない）。予約ありは **409**（`code: has_reservations`） |
| POST /api/admin/event-days/{id}/slots            | 開催日枠1本追加（通常） | admin        | 上記と同条件。`phase` 指定で1行 INSERT。**枠数ポリシー**（§3-2-1）違反時は 422                                                                                  |
| PATCH /api/admin/event-days/{id}/slots/force     | 開催日枠一括更新（強制） | admin        | `draft`/`open` のみ。本文に `**acknowledgeReservationRisk: true`** 必須。active 予約があっても可（§3-2-2）                                                 |
| POST /api/admin/event-days/{id}/slots/force      | 開催日枠1本追加（強制） | admin        | 同上＋`phase`。予約残存下の追加用                                                                                                                    |
| POST /api/admin/matching/run                     | 午前補完・午後一括編成  | admin / cron | matching_run と match_assignments を作成                                                                                                    |
| GET /api/admin/matches?date=...                  | 前日確定結果取得     | admin        | 午前・午後・審判候補・warning を返す                                                                                                                  |
| POST /api/admin/event-days/{id}/weather-decision | 雨天判断登録       | admin        | go / cancel。`delivery`: 即時確定＋任意即時メール / **前日17:00雨天予約**（`day_before_17`）。**標準文面**は JOB03（17:00） |
| GET /api/admin/event-days/{id}/notification-summary | 通知・送信状況   | admin        | 締切時刻・各テンプレの送信件数・雨天予約フラグ等のサマリー（`/admin/event-days/{id}/notifications`） |
| PATCH /api/admin/matches/{id}                    | 強制編集         | admin        | チーム差し替え / 枠変更を監査ログ付きで保存する                                                                                                               |


### 8-1. 予約作成API 入力例

```json
{
  "eventDayId": "uuid",
  "team": {
    "teamName": "和歌山FC U-10",
    "strengthCategory": "strong",
    "representativeGradeYear": 4,
    "contactName": "山田太郎",
    "contactEmail": "sample@example.com",
    "contactPhone": "090-0000-0000"
  },
  "selectedMorningSlotId": "uuid",
  "participantCount": 18,
  "mealCount": 16,
  "remarks": "女子帯同あり"
}
```

### 8-2. 予約作成API の業務処理順

1. event_day が open で締切前か確認する。
2. selected_morning_slot_id が morning phase に属することを確認する。
3. event_day 単位の active 予約数が 6 未満か確認する。
4. 対象 event_day_slots 行を FOR UPDATE でロックし、対象午前枠の active 予約数が 2 未満かトランザクション内で再確認する。
5. team_name + contact_email を用いて既存 team の再利用候補を検索し、該当があれば再利用、なければ新規作成する。なお、このキーは候補抽出用であり、一意制約には用いない。**representative_grade_year** を team に保存する（開催日の学年帯と RPC で整合）。
6. reservations と meal_orders を保存する。
7. 予約が2件目の場合は、そのトランザクション内で morning_fixed の match_assignments を即時作成する。
8. reservation_token を生成し、DB にはハッシュ保存、利用者には平文を返す。
9. 予約完了通知を送る。

### 8-3. token 照会・取消のルール

- token は推測困難なランダム値を発行し、DB にはハッシュのみを保存する。
- 照会・取消 API は強いレート制限をかける。
- cancelled 後も照会は可能とし、状態のみ cancelled 表示する。
- 開催日（event_date）から30日経過後の token 照会は無効として 404 を返す。
- MVPでは token を新規発行する再発行機能は持たない。

#### 8-3-1. reservation_token 再送ポリシー（将来拡張候補）

- MVPでは token 再送機能は実装しない。token 紛失時の再送は将来拡張候補とし、時間的余裕がある場合のみ追加実装を検討する。
- 再送機能を追加する場合は、token を新規発行せず、既存の token をメールで再送する方針を想定する。
- また、再送を実装する場合でも token は画面上には表示せず、必ずメール送信のみで通知する。

**将来再送機能を実装する場合のセキュリティ制御**

- 同一IPおよび同一メールアドレスに対する再送リクエストにはレート制限をかける。
- token の有効期限は、個人情報保持最小化の観点から開催日から30日とする。

### 8-4. エラー方針


| HTTP    | ケース     | 例                                                                           |
| ------- | ------- | --------------------------------------------------------------------------- |
| 400     | 入力不備    | participantCount が0 / mealCount が負数                                         |
| 401/403 | 権限不足    | 管理APIを非管理者が実行                                                               |
| 404     | 対象なし    | token不一致 / slot不存在                                                          |
| 409     | 業務衝突    | 締切後予約、満席枠予約、日上限6超過、同一内容の重複送信疑い、**active 予約ありの通常枠 `PATCH`/`POST`**（`/slots`） |
| 422     | 業務ルール違反 | カテゴリ値不正、**代表学年不正／学年帯不一致**、**枠追加ポリシー違反**（`POST .../slots`）                   |
| 500     | 予期しない障害 | DB接続障害                                                                      |


---

## 9. バッチ・通知


| JOB | タイミング（JST・目安） | 処理                         | 備考                                                        |
| --- | ------------- | -------------------------- | --------------------------------------------------------- |
| 01  | **毎日 15:00** | 締切到達分をロック／最少中止 | `reservation_deadline_at <= now()` の `open` を処理。3未満→`cancelled_minimum`＋メール。Cron: UTC **`0 6 * * *`** |
| 02  | **15:01**     | 午前補完・午後一括編成                | `locked` を対象。3チーム以上で実行（上限は枠定員に連動）。Cron: UTC **`1 6 * * *`**                      |
| 案内 | **16:30**     | **マッチング案内メール**            | 編成案を参加者へ（`matching_proposal`）。運営確認の前段。Cron: UTC **`30 7 * * *`** |
| 03  | **前日 17:00** | **最終版メール**（確定＋雨天を1通） | 予約者へ。開催／雨天中止の出し分け。雨天予約フラグの消化。Cron: UTC **`0 8 * * *`** |
| 04  | （例外時）     | 雨天中止の**即時**通知              | 管理画面 `weather-decision` で明示時のみ（`weather_cancel_immediate`）。標準文面は JOB03 |


**MVPで送る通知**

- 予約完了（`reservation_created`）
- 最少催行不足の中止連絡（`minimum_cancel_notice`・締切 Cron 内）
- **マッチング案内**（`matching_proposal`・**16:30 JST** 想定 Cron）
- 前日 **17:00** の最終版（`day_before_final`・対戦予定＋雨天判断の統合。中止日も同一テンプレで出し分け）
- 雨天中止の **緊急即時**（`weather_cancel_immediate`・管理者オプション）
- 再送管理、未判断催促、当日朝リマインドはMVP対象外

### 9-1. 当日運用はシステム対象外

MVPでは当日チェックイン機能は実装しない。当日の到着確認、人数確認、進行判断は現場運用で行う。システムは前日確定結果の提示までを担当し、当日の記録系機能は将来拡張とする。

### 9-2. メール送信失敗時の取り扱い

メール送信処理に失敗した場合は、notifications.status = failed として記録する。  
失敗理由および関連IDはログとして保持し、後から追跡可能とする。  
MVPでは自動再送は行わず、必要に応じて管理者による手動対応とする。  
再送制御（リトライ処理・キューイング）は将来拡張として扱う。

---

## 10. 認証・権限・セキュリティ


| 利用者区分 | 認証                    | できること                      | できないこと       |
| ----- | --------------------- | -------------------------- | ------------ |
| 公開利用者 | 不要                    | 開催日閲覧、予約、token照会・取消        | 管理画面、他人の予約参照 |
| 管理者   | Supabase Auth / admin | 開催日管理、枠管理、編成実行、雨天判断、前日確定補正 | 直接SQL更新      |


### 10-1. セキュリティ実装ルール

- reservation_token は推測困難なランダム値を発行し、DB にはハッシュ保存する。
- 予約照会・取消 API にはレート制限を設定する。
- 公開APIはすべてサーバー側バリデーションを必須とする。
- 電話番号・メールアドレス等の個人情報は管理画面以外に露出させない。
- ログには個人情報全文や token 平文を残さない。

---

## 11. ログ設計


| ログ種別               | 保存先         | 目的         | 最低限残す値                                           |
| ------------------ | ----------- | ---------- | ------------------------------------------------ |
| reservation_events | DB          | 予約作成・取消の監査 | event_day_id / reservation_id / action           |
| notifications      | DB          | 送信履歴確認     | event_day_id / reservation_id / channel / status |
| error_logs         | DB + サーバーログ | 障害解析       | error_type / message / related IDs               |
| matching_runs      | DB          | 補完・編成結果の保存 | event_day_id / status / warnings / is_current    |


MVPでは api_logs や分析ログを作り込みすぎない。まずは障害原因と予約履歴を追えることを優先する。

---

## 12. テスト計画


| 種別          | 対象          | 観点                                                                                           |
| ----------- | ----------- | -------------------------------------------------------------------------------------------- |
| Unit        | 予約作成        | 日上限6、枠上限2、team 自動作成/再利用、同一teamの複数予約許容、morning_fixed 即時作成                                     |
| Unit        | 締切判定        | 締切前後で予約・取消可否が変わる                                                                             |
| Unit        | 午前補完        | カテゴリ一致優先、重複回避、カテゴリ跨ぎ許容                                                                       |
| Unit        | 午後編成        | 目標出場・空枠解消、多枠時の午後3試合目以降、全員午後1優先、強さ/学年、warning 付与（`build-matching-assignments-target.test.ts`） |
| Unit        | 枠数ポリシー      | 3+3 / 4+4 のみ・追加可否（`event-day-slot-count-policy.test.ts`）                                     |
| Unit        | 審判候補        | 当事者除外、候補不足時 null + warning                                                                   |
| Unit        | 状態整合        | weather_status と event_day.status の矛盾防止、matching_runs current 管理                             |
| Integration | 予約→締切→補完→編成 | event_day.status 遷移、match_assignments 作成、current 切替                                          |
| Integration | 雨天判断        | cancelled_weather への遷移と通知送信                                                                  |
| E2E         | 公開予約UI      | 予約作成・照会・取消                                                                                   |
| E2E         | 管理UI        | 開催日作成、枠編集、枠無効化、**4+4 への枠追加（ポリシー順守）**、編成実行、前日確定結果表示                                           |
| Unit        | 枠変更フラグ      | 枠 `PATCH` で `is_time_changed` が true になる（現実装は一括付与）                                           |
| Unit        | 枠無効化・予約ガード  | 通常 API は開催日に active 予約があるとき 409。予約ゼロで `is_active` 更新可。強制 API は別テスト                           |
| Integration | 強制編集        | manual_override、override_reason、監査ログ保存、チーム差し替え反映                                             |


---

## 13. 実装優先順位


| Phase   | 実装内容                                                             | 完了条件        |
| ------- | ---------------------------------------------------------------- | ----------- |
| Phase 1 | DB migration、開催日管理、枠管理、公開予約、予約照会/取消、team 自動作成、morning_fixed 即時作成 | 午前枠予約ができる   |
| Phase 2 | 締切ロック、午前補完、午後編成、前日確定表示、通知、matching_runs current 管理               | 前日運用が回る     |
| Phase 3 | 雨天判断、チーム差し替え、枠変更、枠無効化、最低限ログ、テスト強化                                | 前日までの補正ができる |
| Phase 4 | 将来拡張（決済、対戦相手の直接組み替え、通知高度化、名寄せ強化）                                 | MVP安定後に判断   |


---

## 14. 実装フロー要約

### 14-1. 予約作成

1. 利用者が開催日と午前枠を選び、チーム情報・人数・昼食数を入力する。
2. APIが締切、日上限6、枠上限2、選択枠の妥当性を検証する。同一teamの同日複数予約は許容する。
3. team を自動作成または再利用し、reservation と meal_order を保存する。
4. 対象枠の2件目予約であれば morning_fixed を即時作成する。
5. reservation_token を返し、予約完了通知を送る。

### 14-2. 締切後処理

1. Cron が event_day.status を locked に更新する。
2. 既存の morning_fixed を読み込み、未充足枠があれば午前補完を行う。
3. 午後枠をカテゴリ一致優先・重複回避優先で編成する。
4. 審判候補を付けて match_assignments を保存する。
5. matching_run を current にし、event_day.status を confirmed に更新する（**参加者向けの案内は Cron 案内メール（16:30 想定）、最終メールは原則 JOB03・前日 17:00** で送る）。

### 14-3. 管理画面での補正

1. 運営担当者が前日確定結果を確認し、必要がある場合のみ管理画面から補正を行う。
2. チーム差し替えは reservation 単位の修正として扱い、誤登録や代理参加に対応する。
3. 枠変更は既存の対戦を別枠へ移す補正とし、対戦相手そのものの直接組み替えはMVP外とする。

---

## 15. 開発着手前の最終確認事項


| 確認項目               | 今回の確定内容                                                                         | 状態                      |
| ------------------ | ------------------------------------------------------------------------------- | ----------------------- |
| 初期slot時刻           | 既定6枠: 09–12 午前3本、13–16 午後3本。4+4 時は 12–13 午前4本目・16–17 午後4本目を追加                   | 確定                      |
| 午前枠数               | **3 または 4**（午後と同数のみ）。初期3。追加は API ポリシーに従う                                        | 確定                      |
| 午後枠数               | **3 または 4**（午前と同数のみ）。初期3                                                        | 確定                      |
| 代表学年               | 予約時に 1〜6 を選択。`teams.representative_grade_year`、RPC で学年帯と整合                      | 確定                      |
| カテゴリ               | strong / potential のみ                                                           | 確定                      |
| team 作成方法          | 公開予約時に自動作成・再利用                                                                  | 確定                      |
| team 名寄せ           | MVPでは team_name + contact_email を再利用候補抽出に使う暫定方式                                 | 確定                      |
| reservation.status | active / cancelled                                                              | 確定                      |
| event_day.status   | draft / open / locked / confirmed / cancelled_weather / cancelled_minimum       | 確定                      |
| 午前確定タイミング          | 2チームそろった瞬間に morning_fixed を即作成                                                  | 確定                      |
| 通知                 | 予約完了 / 最少中止 / 案内（matching_proposal）/ 前日17:00最終版（雨天含む）／緊急時のみ即時雨天メール                                            | 確定                      |
| matching_runs      | is_current で有効版管理                                                               | 確定                      |
| warning            | 固定コード体系を採用                                                                      | 確定                      |
| meal_count の0許容    | 初期値は不可。settings でのみ許容可                                                          | 確定                      |
| team統合機能           | MVPでは非採用（将来拡張候補）                                                                | 確定                      |
| 枠無効化・時刻変更（通常 API）  | **当該開催日に active 予約が 0 件**のときのみ `PATCH/POST /slots` で可。予約残存時は **強制 API**（§3-2-2） | 実装確定（旧「枠単位で予約なしのみ」から変更） |
| 枠変更フラグ             | 枠 `PATCH` 保存時に `is_time_changed = true` を付与（枠ごとの差分判定は未）                         | 実装メモ                    |
| 強制編集               | チーム差し替え / 枠変更を admin のみ許可                                                       | 確定                      |
| 予約管理単位             | 同一teamの同日複数予約を許容し、試合編成は reservation 単位で扱う                                       | 確定                      |


### 開発判断の結論

- この設計は、4月MVPとして一人開発で着手可能な範囲に収めつつ、後続拡張で揉めやすい論点を先に潰している。
- 特に、午前固定試合の即時作成、排他制御、team 名寄せ方針、天候状態の整合、current run 管理、warning コード体系を定義したことで、設計レビューで突っ込まれやすいポイントは大幅に減っている。
- MVP後は決済、通知高度化、名寄せ強化、詳細編集の順で追加でき、主要テーブルの作り直しは不要な構成である。

---

## 付録A. 実装ルール補足

- 午前枠に1チームしか入っていない場合、その枠は未充足とみなし、締切後に同日参加チームを追加割当して埋める。
- 全日の定員未満で余枠があるときに同一チームを複数試合へ割り当てる場合、まず全チームに1試合機会を与えた後に追加割当する。
- カテゴリは絶対制約ではない。成立を優先し、必要時はカテゴリ跨ぎでも試合を組む。
- 土グラウンドはデータモデル・画面・API・バッチのすべてから外す。
- 将来決済を入れる場合は reservations に payment_status / payment_id を追加する方針とし、MVPでは未使用とする。
- 将来 team 名寄せを強化する場合は teams に external_team_key または normalized_team_name の本格運用を追加し、既存 team_id は維持する。
- 将来、人工芝1面を2分割して同時運用する場合は、表示順制御ではなく lane（面識別）を追加して同時刻の試合を識別する。

---

## 付録B. 追加運用機能（MVP採用）

### B-1. 将来拡張候補：team統合機能

MVPでは実装しないが、将来、重複 team の補正が必要になった場合に管理画面から source / target を統合できるよう拡張可能な構造とする。実装時は source team を削除せず停止状態で残し、監査ログを必須とする。

### B-2. 枠変更フラグ（is_time_changed）

通常の枠一括 `PATCH` では保存時に `is_time_changed = true` を付与する（実装一括）。管理画面での強調表示は任意。MVPでは変更の自動通知は行わず、個別連絡を前提とする。

### B-3. 管理画面の強制編集

自動編成後の軽微な補正として、チーム差し替えと枠変更を admin のみ実施可能とする。manual_override と監査ログにより、自動結果と手動補正の境界を明確にする。

### 合宿について

■ 合宿・宿泊の相談導線（予約確定ではない）

**対象とする範囲（MVP）:** 合宿・宿泊についての **相談の受付**、運営の **受入可否判断に必要な情報の取得**、および **事前のご案内**（メール等）までとする。

**システム化しない（MVP 外）:** 合宿開催が決定したあとの **当日運用**（試合順の細かい調整、チーム間の進行調整、当日運営の詳細）、**合宿当日の進行管理**、**合宿用の対戦表作成**、**当日運営の管理機能** は本システムでは扱わない。これらは **各チーム・現場での対応** を前提とする。

**案内ページ**（`/reserve/camp`）で上記の役割と非対象をユーザー向けに示し、宿泊プラン一覧と方針を掲載する。**かんたん相談フォーム**（`/reserve/camp/inquiry`）で日程・プラン・概算人数など初回に必要な最小項目のみ受け付ける。送信内容は DB の `camp_inquiries` に保存し、運営が管理画面（`/admin/camp-inquiries`）および任意で `CAMP_INQUIRY_NOTIFY_EMAIL` 宛のメールで確認する。詳細調整は **メール返信** を主とし、スレッド管理 UI は持たない。

宿泊プランの表示名・本数・掲載可否は `src/lib/camp-inquiry/camp-lodging-plans.ts` で管理する。フォーム項目は `src/lib/camp-inquiry/camp-inquiry-field-registry.ts`（`schema_version` と `answers`）で管理し、即時予約・在庫・空き状況の厳密突合・自動確定は行わない。