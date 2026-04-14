# 和歌山サッカー交流試合 参加予約・午前確定・午後自動編成システム

**開発設計書（MVP最終版）**


| 項目      | 内容                                                      |
| ------- | ------------------------------------------------------- |
| 版       | MVP最終版 / 2026-04-06                                     |
| 作成      | 鹿島 大和                                                   |
| 更新日     | 2026-04-07                                              |
| 対象      | 小学生サッカーチーム向け日帰り交流試合                                     |
| MVP中心機能 | 午前複数枠予約（初期4枠）、午前試合確定、午後自動編成、前日確定連絡、強制編集（チーム差し替え / 枠変更）、枠無効化    |
| 確定前提    | 芝1面のみ / 1時間1枠 / 1枠2チーム固定 / 午前は予約で確定 / 午後は自動編成 / 土グラ対象外  |
| カテゴリ    | strong / potential の2区分のみ                               |
| 技術構成    | Next.js + Tailwind CSS + Supabase + PostgreSQL + Vercel |
| 文書の位置づけ | 個人開発・外注レビュー・実装着手・見積の起点として使える最終版設計書                      |


---

## 0. エグゼクティブサマリー

本書は、4月末までに和歌山サッカー交流試合のMVPを個人開発で実装し、前日確定から当日受付までを破綻なく運用するための開発設計書である。設計の最優先方針は「午前は予約時点で分かりやすく確定」「午後だけを自動編成」「MVPに不要な複雑さは入れない」の3点とする。

同時に、MVP後に作り直しが発生しないよう、状態遷移・名寄せ・排他制御・再実行・warning体系など、後から揉めやすい論点は先にルール化している。MVPの範囲は絞るが、設計の芯は後続拡張に耐える構造とする。


| 区分     | 採用方針     | 理由 / 実装意図                                                          |
| ------ | -------- | ------------------------------------------------------------------ |
| 午前枠予約 | 採用       | 利用者が選んだ枠に2チームそろった時点で対戦相手が確定するため、理解しやすく問い合わせも減る。                    |
| 午後自動編成 | 採用       | カテゴリ一致と重複回避を優先しつつ、成立優先で柔軟に組める。                                     |
| 枠管理    | 開催日単位で管理 | デフォルト8枠（午前4・午後4）を生成し、必要時は管理者が枠の増減・時刻変更を行える。不要枠は無効化で吸収する。                  |
| 通知     | 最小構成のみ   | 予約完了 / 前日確定 / 雨天 go-cancel のみ送信し、催促や再送自動化はMVP外とする。                 |
| 審判     | 簡易候補表示   | 当事者以外から1候補のみ自動提示し、高度最適化は後続拡張とする。                                   |
| 決済     | 対象外      | 予約の成立・編成・当日運用を先に安定させ、後から payment_status を追加できる構造に留める。              |
| 名寄せ補正  | MVPでは非採用 | MVPでは team 統合UIは持たず、予約成立と簡易同一判定を優先する。将来、重複補正が必要になった場合に追加可能な構造に留める。 |
| 手動調整   | 最低限採用    | 自動編成後の最低限の補正として、チーム差し替えと枠変更を管理UIから実施可能とする。対戦相手の直接組み替えはMVP外とする。     |


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
- 開催成立は「1日3〜6チーム」で判定し、枠成立は「各枠0〜2チーム」で判定する。
- 午前は予約で確定、午後だけを自動編成対象とする。
- カテゴリは strong / potential の2種類のみとし、カテゴリ一致は優先条件、絶対条件にはしない。
- team 名寄せは MVP では既存team候補抽出の簡易キー運用に留め、重複統合UIは持たない。将来 normalized_team_name や external_team_key を追加しやすいよう、teams は独立マスタとして保持する。
- 試合確定状態の真実源は match_assignments とし、午前 fixed は2チームそろった時点で即時作成する。
- MVPで不要な機能は切るが、後続拡張に必要なキー・状態・履歴は先に残す。
- 同メール登録ならなるべくマッチングしないようにする

---

## 2. 業務ルール

### 2-1. 開催日と対象学年

開催対象日は土曜・日曜・祝日・特別開催日（special）とする。対象学年は開催日単位で 1-2年 → 3-4年 → 5-6年 の順に循環させる。祝日判定APIは使わず、管理画面で event_day を登録する。

### 2-2. 開催成立条件


| 項目    | 値                       | 備考                       |
| ----- | ----------------------- | ------------------------ |
| 最低開催数 | 3チーム                    | 締切時点の active 予約が3未満なら不成立 |
| 上限数   | 6チーム                    | 1日最大6チーム。7件目以降は受付不可      |
| 午前枠上限 | 各枠2チーム                  | 1時間の1枠には対戦する2チームまで       |
| 予約締切  | 開催日前日13:00              | 昼食数変更締切も同時刻              |
| 取消締切  | 開催日前日13:00              | 締切後はWeb取消不可              |
| 公開条件  | event_day.status = open | 対象学年が一致していること            |


### 2-3. カテゴリルール


| 論点     | ルール                                          |
| ------ | -------------------------------------------- |
| カテゴリ種別 | strong / potential の2種類のみ                    |
| 午前予約時  | カテゴリは表示情報。カテゴリ不一致でも予約可能                      |
| 午前補完時  | カテゴリ一致優先 → 既存対戦相手とかぶらない優先 → それでも不足ならカテゴリ跨ぎ許容 |
| 午後編成時  | カテゴリ一致優先。ただし成立のためカテゴリ跨ぎを許容                   |
| 運用上の意味 | カテゴリは試合品質を上げる優先条件であり、成立を妨げる制約にはしない           |


### 2-4. 予約ルール

- 予約は team 単位ではなく reservation 単位で管理する。同一チームによる同一開催日の複数予約は制御で禁止せず、運用上許容する。
- 同一チーム名・同一メールアドレス・同一電話番号での登録もブロックしない。MVPでは不正確な排除よりも予約成立を優先し、同一チーム判定は簡易キーによる候補抽出とマッチング時の回避ロジックで吸収する。
- 予約入力項目は、チーム名、代表者名、メールアドレス、電話番号、カテゴリ、参加人数、昼食数、午前枠、備考とする。
- 午前枠は初期値として MORNING_1 / MORNING_2 / MORNING_3 を持つが、管理者は開催日ごとに4枠以上へ増減できる。
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


| 論点      | ルール                                              |
| ------- | ------------------------------------------------ |
| 午前補完    | 締切時点で未充足の午前枠へ同日参加チームを追加割当し、午前試合を可能な限り成立させる       |
| 午前補完優先順 | カテゴリ一致 > その枠に未割当 > 既存対戦相手とかぶらない > 割当回数が少ない       |
| 午後編成    | 全参加チームを対象に午後枠を自動編成し、まず全員に最低1試合機会を与える             |
| 重複割当    | 6チーム未満で枠が余る場合のみ、一部チームに2試合目を割り当てる                 |
| 対戦重複回避  | 午前に当たった相手と午後で再度当てるのは避ける。避けきれない場合は warning を付与    |
| 審判      | 午後各試合について、当事者以外から1チームのみ候補表示する。候補なしなら warning を付与 |


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

雨天判断は原則として前日に行う。管理画面で go / cancel を登録し、対象開催日の参加者へ通知する。cancel の場合、weather_status = cancel かつ event_day.status = cancelled_weather に更新する。go の場合、weather_status = go とし、event_day.status は直前の locked または confirmed の業務状態を維持する。

cancelled_weather 状態に遷移した場合でも、reservations、match_assignments 等のデータは削除せず保持する。  
これにより、運用履歴および分析用途への利用を可能とする。

**weather_status と event_day.status の整合規則**

- weather_status は天候判断の内部状態、event_day.status は開催全体の業務状態である。
- cancel のみ、業務状態を cancelled_weather へ遷移させる。
- go は開催継続の意思決定であり、open / locked / confirmed などの主状態を上書きしない。
- 同一開催日において weather_status と event_day.status が矛盾する更新はAPIで拒否する。

---

## 3. 時間枠（event_day_slots）管理設計

MVPでは全体テンプレートテーブルは持たない。開催日作成時にシステムが初期8枠（午前4・午後4）を生成し、以後は event_day_slots のみを管理する。これにより実装を軽くしつつ、開催日ごとの時刻変更や枠数の増減を許容する。将来、人工芝1面を2分割して同時運用する場合は、display_order ではなく lane（面識別）カラムを追加して対応する。

### 3-1. 初期生成する時間枠


| phase     | slot_code   | 開始    | 終了    | 容量   | 用途    |
| --------- | ----------- | ----- | ----- | ---- | ----- |
| morning   | MORNING_1   | 09:00 | 10:00 | 2チーム | 予約で確定 |
| morning   | MORNING_2   | 10:00 | 11:00 | 2チーム | 予約で確定 |
| morning   | MORNING_3   | 11:00 | 12:00 | 2チーム | 予約で確定 |
| morning   | MORNING_4   | 12:00 | 13:00 | 2チーム | 予約で確定 |
| afternoon | AFTERNOON_1 | 13:00 | 14:00 | 2チーム | 自動編成  |
| afternoon | AFTERNOON_2 | 14:00 | 15:00 | 2チーム | 自動編成  |
| afternoon | AFTERNOON_3 | 15:00 | 16:00 | 2チーム | 自動編成  |
| afternoon | AFTERNOON_4 | 16:00 | 17:00 | 2チーム | 自動編成  |


### 3-2. 管理画面で許可する操作


| 操作        | 許可条件                            | 補足                                    |
| --------- | ------------------------------- | ------------------------------------- |
| 開始終了時刻変更  | 開始 < 終了、同一 phase で重複なし          | duration_minutes は自動再計算               |
| 枠追加       | 締切前であり、重複時間帯がなく、phase 整合が保たれること | 枠本数の増減（例: 午前4→5枠）を許容                      |
| 枠無効化      | 締切前かつ対象枠に active 予約が存在しないこと     | is_active = false とし、公開画面・編成対象から除外する  |
| 時刻変更フラグ付与 | 予約が存在する枠の開始/終了時刻を変更した場合         | is_time_changed = true とし、管理画面で強調表示する |


### 3-3. 変更制御ルール

既存予約が存在する枠の時刻変更を行った場合、変更後の時刻は既存予約にも即時反映される。  
MVPでは変更通知の自動送信は行わないため、必要に応じて管理者が個別連絡を行う運用とする。


| 状態       | 変更可否   | 理由 / 実装方針                                                    |
| -------- | ------ | ------------------------------------------------------------ |
| 予約なし・締切前 | 自由変更可  | 開催日ごとの枠調整を許可する。時刻変更・枠追加・枠無効化を行える。                            |
| 予約あり・締切前 | 制限付き許可 | 枠削除・枠無効化は不可。時刻変更は警告付きで許可し、該当枠の is_time_changed を true に更新する。 |
| 締切後・編成前  | 原則変更不可 | 周知済み前提のため lock する。                                           |
| 確定後      | 変更不可   | 自動編成結果の再生成は行わない。必要時は管理画面の強制編集（チーム差し替え / 枠変更）で補正する。           |


#### 3-3-1. 枠変更フラグ（is_time_changed）

予約が1件以上存在する枠の開始時刻または終了時刻を管理画面から変更した場合、該当 event_day_slot の is_time_changed を true に更新する。  
is_time_changed = true の枠は、管理画面および前日確定画面で強調表示し、運用上の要注意枠として扱う。  
MVPでは自動通知は行わず、必要に応じて管理者が個別連絡を行う。フラグは開催終了後も履歴として残す。

### 3-4. 重要な制約の考え方

「1枠2チーム以下」は『1時間の1枠には対戦する2チームしか入れない』という意味であり、「1日3〜6チーム」の開催成立条件とは別概念である。したがって、日全体では3〜6チーム、各午前枠では0〜2チームという二層で判定する。

予約APIでは selected_morning_slot_id に対して event_day_slots の対象行を `SELECT ... FOR UPDATE` でロックし、そのトランザクション内で active 予約件数を再集計する。2件未満であれば insert、2件以上なら 409 を返し rollback する。これにより同時アクセス時でも3チーム目が同一午前枠に入らないようにする。

**枠数拡張に関する設計判断**

MVPの初期値は午前3枠・午後3枠だが、event_day_slots を開催日単位で持つため、将来4枠運用へ拡張しても reservations や match_assignments の構造変更は不要。拡張時の影響範囲は、管理画面UI・編成ロジックのループ上限・帳票表示の3点に限定される。よって「管理者が4枠へ変更できる」要求は今の設計で吸収できる。  
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
| ジョブ      | 締切ロック、午前補完・午後編成、最小通知送信 | Vercel Cron              |


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


| 順   | 処理内容                                    | 主要データ                            |
| --- | --------------------------------------- | -------------------------------- |
| 1   | 開催日作成。対象学年・締切・初期枠（既定8枠）を作成                   | event_days, event_day_slots      |
| 2   | 公開。open の開催日だけ公開画面に表示                   | event_days                       |
| 3   | 公開予約。team を自動作成または再利用して reservation を作成 | teams, reservations, meal_orders |
| 4   | 必要に応じて開催日枠を調整                           | event_day_slots                  |
| 5   | 締切。前日13:00で予約・取消・昼食変更を停止                | event_days.status = locked       |
| 6   | 午前補完・午後編成を実行し、前日確定を作成                   | matching_runs, match_assignments |
| 7   | 雨天判断。go / cancel を登録し通知                 | weather_decisions                |


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
6. 0チームの午前枠は最後に対象とし、全体3〜6チームの範囲で成立可能な場合のみ埋める。

### 5-3. 午後編成ロジック（MVP確定版）

1. まず全参加チームに午後1試合の機会を与える。
2. 対戦候補の選定順は「カテゴリ一致 > 午前に当たっていない相手 > 同日での対戦重複が少ない相手」とする。
3. 6チーム未満で枠が余る場合のみ、一部チームに2試合目を割り当てる。
4. カテゴリ一致候補が不足する場合はカテゴリ跨ぎを許容する。
5. どうしても重複回避できない場合は warning を付与し、成立優先で確定する。

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


| 画面ID   | 画面名       | 主利用者 | 主機能                         |
| ------ | --------- | ---- | --------------------------- |
| SCR-01 | 開催日一覧・予約  | 利用者  | 開催日表示、午前枠埋まり表示、予約入力         |
| SCR-02 | 予約完了      | 利用者  | reservation_token 表示、入力内容確認 |
| SCR-03 | 予約照会・取消   | 利用者  | token による照会、締切前取消           |
| SCR-10 | 管理ダッシュボード | 管理者  | 本日開催、未判断、予約数、前日確定状況         |
| SCR-11 | 前日確定結果一覧  | 管理者  | 午前試合、午後試合、審判候補、warning      |
| SCR-12 | 前日確定補正    | 管理者  | チーム差し替え、枠変更                 |
| SCR-13 | 開催日管理     | 管理者  | 開催日作成、公開状態、締切、雨天判断          |
| SCR-14 | 開催日枠管理    | 管理者  | event_day_slots 編集、枠追加、枠無効化 |


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
| teams                 | id, team_name, normalized_team_name null, strength_category, contact_name, contact_email, contact_phone, is_active, created_at, updated_at                                                                  | normalized_team_name は将来拡張のため予約                                                           |
| event_days            | id, event_date, grade_band, status, reservation_deadline_at, weather_status, notes                                                                                                                          | weather と業務状態を分離                                                                          |
| event_day_slots       | id, event_day_id, slot_code, phase, start_time, end_time, capacity, is_active, is_time_changed, is_locked                                                                                                   | is_active = false で公開画面・編成対象から除外する。将来、1コート2分割運用を行う場合は lane カラム追加で対応する                     |
| reservations          | id, event_day_id, team_id, selected_morning_slot_id, status, participant_count, reservation_token_hash, remarks, display_name null, created_at, updated_at                                                  | token 平文は保存しない。display_name は運用上の識別名                                                      |
| meal_orders           | id, reservation_id unique, meal_count, notes, created_at, updated_at                                                                                                                                          | reservation と 1:1                                                                         |
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


| API                                     | 用途          | 認証           | 概要                                        |
| --------------------------------------- | ----------- | ------------ | ----------------------------------------- |
| GET /api/event-days                     | 公開中開催日の一覧   | 不要           | 開催日・対象学年・午前埋まり状況を返す                       |
| GET /api/event-days/{date}/availability | 対象日の空き状況    | 不要           | 各午前枠の予約数とカテゴリ内訳を返す                        |
| POST /api/reservations                  | 予約作成        | 不要           | team 自動作成/再利用と reservation 作成を同時実行        |
| GET /api/reservations/{token}           | 予約照会        | token        | 予約内容を返す                                   |
| POST /api/reservations/{token}/cancel   | 予約取消        | token        | 締切前なら cancelled に更新                       |
| POST /api/admin/event-days              | 開催日作成/更新    | admin        | event_day と既定枠（`default-slots` 件数）を保存                        |
| GET /api/admin/event-days/{id}/slots    | 開催日枠取得      | admin        | event_day_slots を返す                       |
| PATCH /api/admin/event-days/{id}/slots  | 開催日枠更新      | admin        | 時刻変更・枠追加・枠無効化を反映し、必要時 is_time_changed を更新 |
| POST /api/admin/matching/run            | 午前補完・午後一括編成 | admin / cron | matching_run と match_assignments を作成      |
| GET /api/admin/matches?date=...         | 前日確定結果取得    | admin        | 午前・午後・審判候補・warning を返す                    |
| POST /api/admin/weather-decisions       | 雨天判断登録      | admin        | go / cancel を保存し通知実行                      |
| PATCH /api/admin/matches/{id}           | 強制編集        | admin        | チーム差し替え / 枠変更を監査ログ付きで保存する                 |


### 8-1. 予約作成API 入力例

```json
{
  "eventDayId": "uuid",
  "team": {
    "teamName": "和歌山FC U-10",
    "strengthCategory": "strong",
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
5. team_name + contact_email を用いて既存 team の再利用候補を検索し、該当があれば再利用、なければ新規作成する。なお、このキーは候補抽出用であり、一意制約には用いない。
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


| HTTP    | ケース     | 例                                   |
| ------- | ------- | ----------------------------------- |
| 400     | 入力不備    | participantCount が0 / mealCount が負数 |
| 401/403 | 権限不足    | 管理APIを非管理者が実行                       |
| 404     | 対象なし    | token不一致 / slot不存在                  |
| 409     | 業務衝突    | 締切後予約、満席枠予約、日上限6超過、同一内容の重複送信疑い      |
| 422     | 業務ルール違反 | カテゴリ値不正、phase不整合                    |
| 500     | 予期しない障害 | DB接続障害                              |


---

## 9. バッチ・通知


| JOB | タイミング   | 処理               | 備考                            |
| --- | ------- | ---------------- | ----------------------------- |
| 01  | 前日13:00 | 予約締切ロック          | reservation / meal update を停止 |
| 02  | 前日13:01 | 午前補完・午後一括編成      | 3〜6チームで実行。結果確定                |
| 03  | 前日13:10 | 前日確定通知送信         | 予約者へ確定内容を送る                   |
| 04  | 雨天判断登録時 | go / cancel 通知送信 | イベント駆動で送る                     |


**MVPで送る通知**

- 予約完了
- 前日確定
- 雨天 go / cancel
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


| 種別          | 対象          | 観点                                                               |
| ----------- | ----------- | ---------------------------------------------------------------- |
| Unit        | 予約作成        | 日上限6、枠上限2、team 自動作成/再利用、同一teamの複数予約許容、morning_fixed 即時作成         |
| Unit        | 締切判定        | 締切前後で予約・取消可否が変わる                                                 |
| Unit        | 午前補完        | カテゴリ一致優先、重複回避、カテゴリ跨ぎ許容                                           |
| Unit        | 午後編成        | 全員1試合優先、重複割当、warning 付与                                          |
| Unit        | 審判候補        | 当事者除外、候補不足時 null + warning                                       |
| Unit        | 状態整合        | weather_status と event_day.status の矛盾防止、matching_runs current 管理 |
| Integration | 予約→締切→補完→編成 | event_day.status 遷移、match_assignments 作成、current 切替              |
| Integration | 雨天判断        | cancelled_weather への遷移と通知送信                                      |
| E2E         | 公開予約UI      | 予約作成・照会・取消                                                       |
| E2E         | 管理UI        | 開催日作成、枠編集、枠無効化、4枠化、編成実行、前日確定結果表示                                 |
| Unit        | 枠変更フラグ      | 予約後の時刻変更で is_time_changed が true になる                             |
| Unit        | 枠無効化        | 予約なし枠のみ is_active = false にでき、公開・編成対象から除外される                     |
| Integration | 強制編集        | manual_override、override_reason、監査ログ保存、チーム差し替え反映                 |


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
5. matching_run を current にし、event_day.status を confirmed に更新し、前日確定通知を送る。

### 14-3. 管理画面での補正

1. 運営担当者が前日確定結果を確認し、必要がある場合のみ管理画面から補正を行う。
2. チーム差し替えは reservation 単位の修正として扱い、誤登録や代理参加に対応する。
3. 枠変更は既存の対戦を別枠へ移す補正とし、対戦相手そのものの直接組み替えはMVP外とする。

---

## 15. 開発着手前の最終確認事項


| 確認項目               | 今回の確定内容                                                                   | 状態  |
| ------------------ | ------------------------------------------------------------------------- | --- |
| 初期slot時刻           | 09-10 / 10-11 / 11-12 / 12-13 / 13-14 / 14-15 / 15-16 / 16-17                             | 確定  |
| 午前枠数               | 初期値4枠。開催日単位で増減可                                                        | 確定  |
| 午後枠数               | 初期値4枠。開催日単位で増減可                                                           | 確定  |
| カテゴリ               | strong / potential のみ                                                     | 確定  |
| team 作成方法          | 公開予約時に自動作成・再利用                                                            | 確定  |
| team 名寄せ           | MVPでは team_name + contact_email を再利用候補抽出に使う暫定方式                           | 確定  |
| reservation.status | active / cancelled                                                        | 確定  |
| event_day.status   | draft / open / locked / confirmed / cancelled_weather / cancelled_minimum | 確定  |
| 午前確定タイミング          | 2チームそろった瞬間に morning_fixed を即作成                                            | 確定  |
| 通知                 | 予約完了 / 前日確定 / 雨天 go-cancel のみ                                             | 確定  |
| matching_runs      | is_current で有効版管理                                                         | 確定  |
| warning            | 固定コード体系を採用                                                                | 確定  |
| meal_count の0許容    | 初期値は不可。settings でのみ許容可                                                    | 確定  |
| team統合機能           | MVPでは非採用（将来拡張候補）                                                          | 確定  |
| 枠無効化               | 予約なし枠のみ is_active = false で無効化可能                                          | 確定  |
| 枠変更フラグ             | 予約後の時刻変更で is_time_changed を付与                                             | 確定  |
| 強制編集               | チーム差し替え / 枠変更を admin のみ許可                                                 | 確定  |
| 予約管理単位             | 同一teamの同日複数予約を許容し、試合編成は reservation 単位で扱う                                 | 確定  |


### 開発判断の結論

- この設計は、4月MVPとして一人開発で着手可能な範囲に収めつつ、後続拡張で揉めやすい論点を先に潰している。
- 特に、午前固定試合の即時作成、排他制御、team 名寄せ方針、天候状態の整合、current run 管理、warning コード体系を定義したことで、設計レビューで突っ込まれやすいポイントは大幅に減っている。
- MVP後は決済、通知高度化、名寄せ強化、詳細編集の順で追加でき、主要テーブルの作り直しは不要な構成である。

---

## 付録A. 実装ルール補足

- 午前枠に1チームしか入っていない場合、その枠は未充足とみなし、締切後に同日参加チームを追加割当して埋める。
- 6チーム未満時に同一チームを複数試合へ割り当てる場合、まず全チームに1試合機会を与えた後に追加割当する。
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

予約が存在する枠の時刻変更を行った場合は is_time_changed = true とし、管理画面で強調表示する。MVPでは自動通知は行わず、個別連絡を前提とする。

### B-3. 管理画面の強制編集

自動編成後の軽微な補正として、チーム差し替えと枠変更を admin のみ実施可能とする。manual_override と監査ログにより、自動結果と手動補正の境界を明確にする。

### 合宿について

■ 合宿プラン導線

本システムの予約画面上において、合宿利用を検討している利用者向けに
別導線を設ける。

「合宿プランについてはこちら」

当該導線は外部の問い合わせフォームまたは連絡手段へ遷移し、
合宿に関する受付・調整は本システム外で対応する。

本システムでは合宿に関するデータ管理・予約処理は行わない。