# AI 手渡し用ドキュメント一覧（テスト仕様・仕様の元）

別の AI に「テスト仕様を作る／追記する」「挙動を仕様に合わせる」などと依頼するときに、**このリポジトリのどれを正として渡すか**をまとめたものです。

---

## そもそもファイルはどこから取る？

**どこからもダウンロードしません。** 次の **プロジェクトフォルダ（Git のクローン）の中** にあります。

| いま言っている「ルート」 | 例（あなたの PC ではユーザー名が違うことがあります） |
|---------------------------|--------------------------------------------------------|
| リポジトリのトップフォルダ | `C:\Users\kashima_y\football-booking-system` |

このドキュメントに出てくる `docs/...` や `scripts/...` は、**いずれも上のトップからの相対パス**です。

| 表に書いてあるパス | 実際の場所（例） |
|--------------------|------------------|
| `docs/AI-HANDOFF-PACK.md` | `football-booking-system\docs\AI-HANDOFF-PACK.md` |
| `docs/test-spec/full-system-test-spec.tsv` | `football-booking-system\docs\test-spec\full-system-test-spec.tsv` |
| `scripts/test-spec-reviewable-data.mjs` | `football-booking-system\scripts\test-spec-reviewable-data.mjs` |

**Cursor / VS Code で見つけ方:** 左のファイルツリーで **`football-booking-system`** を開いた状態で、フォルダ **`docs`** や **`scripts`** をクリックして開くと、表と同じ名前のファイルが並びます。

**エクスプローラーで見つけ方:** アドレスバーに `C:\Users\kashima_y\football-booking-system\docs` と打って Enter → 中のファイルをコピー。

---

## ChatGPT に投げる手順（詳しい版・ここから読む）

### ゴールを決める

ChatGPT にやってほしいことを **一文**で決めます。

- 例 A:「`test-spec-reviewable-data.mjs` にケースを 10 件追加し、列は今の 12 列のまま」
- 例 B:「`implemented-behavior-catalog.md` に合わせて、予約まわりのテストケースだけ増やす」

---

### STEP 1: パソコンで「渡す用フォルダ」を作る

1. デスクトップにフォルダ `chatgpt-handoff` を新規作成（名前は何でもよい）。

2. 次の **最低セット** を、そのフォルダにコピーする（エクスプローラーで開いて **Ctrl+C → Ctrl+V** でよい）。

| コピー元（リポジトリ内のパス） | 理由 |
|--------------------------------|------|
| `docs/AI-HANDOFF-PACK.md` | この手順書と一覧 |
| `docs/test-spec/TEST-SPEC-MIGRATION.md` | 12 列の意味 |
| `scripts/test-spec-reviewable-data.mjs` | **ここがケースの正本** |
| `docs/test-spec/full-system-test-spec.tsv` | いまの出力例 |
| `docs/spec/README.md` | 仕様書の読み順 |
| `docs/spec/implemented-behavior-catalog.md` | 挙動の根拠（いちばん重要） |
| `docs/spec/implemented-system-overview.md` | 全体像 |
| `docs/spec/mvp-product-intent.md` | MVP の範囲 |
| `docs/spec/implemented-matching-algorithm.md` | 自動編成（触るなら） |

3. **余裕があれば** 同じフォルダに追加（任意）。

| コピー元 | 理由 |
|----------|------|
| `scripts/gen-full-test-spec-tsv.mjs` | 列名・検証ルールを AI に合わせさせる |
| `docs/test-spec/archive/full-system-test-spec-legacy-15col.tsv` | 旧ケースを移植するとき用（**ファイルが大きい**ので未契約プランでは省略してよい） |
| `scripts/test-spec-exhaustive.mjs` | 旧網羅行の材料（長いので省略可） |

**注意:** `.mjs` は ChatGPT によっては「添付できない／中身を見せにくい」ことがあります。そのときは **中身をコピーして `.txt` として保存**するか、**長いファイルは分割して 2 ファイルに貼る**と確実です。

---

### STEP 2: ZIP にまとめる（おすすめ）

ChatGPT は **ファイルを複数まとめて添付**しやすいので、STEP 1 のフォルダごと ZIP にします。

1. エクスプローラーで `chatgpt-handoff` フォルダを **右クリック** → **送る** → **圧縮 (zip 形式) フォルダー**（Windows 11 の表記は環境で多少違います）。
2. できた `chatgpt-handoff.zip` をデスクトップに置く。

（PowerShell でやる場合は、このドキュメント後半の「C. ZIP にまとめる」を、`$STAGE` を `chatgpt-handoff` のパスに合わせて使ってもよいです。）

---

### STEP 3: ChatGPT を開いて添付する

1. ブラウザで [ChatGPT](https://chatgpt.com) を開く。  
2. **新しいチャット**を開始する。  
3. 入力欄の **＋（添付）** から `chatgpt-handoff.zip` をアップロードする。  
   - **展開されない場合**: ZIP の中身をフォルダごと開き、**中の `.md` と `.tsv` だけ**を複数選択して添付する。  
4. **Plus / Team など**でない場合、1 日の添付や長文に制限があることがあります。そのときは **ファイルを分けて 2 回に分けて送る**か、`implemented-behavior-catalog.md` だけ **該当セクションをコピペ**する。

---

### STEP 4: 下の「依頼文」をそのまま貼る（中身だけ直す）

`【ここ】` を STEP 0 で決めた内容に置き換えて、送信します。

```
あなたは当プロジェクトのテスト仕様アシスタントです。
添付の ZIP（またはファイル）をすべて読んでください。

やってほしいこと:
【例: test-spec-reviewable-data.mjs に、予約APIまわりのテストケースを5件追加する】

ルール:
1. テスト仕様の列は TEST-SPEC-MIGRATION.md に書かれた 12 列に合わせる（新しい列を勝手に増やさない）。
2. 期待結果は「HTTP だけ」で終わらせず、DB や画面の状態が分かるように書く。
3. 挙動の優先順位は docs/spec/implemented-behavior-catalog.md。矛盾する場合は「要確認」と書き、推測で断定しない。
4. 出力は次の2つに分けて:
   (A) 追加・変更したケースだけを表形式（タブ区切り）で
   (B) test-spec-reviewable-data.mjs に埋め込むなら、該当の row({ ... }) ブロックを丸ごと提示

ローカルで TSV を再生成するコマンドは:
  node scripts/gen-full-test-spec-tsv.mjs
（こちらで実行するので、スクリプト本体の変更が必要ならその diff も提示）
```

---

### STEP 5: 返答を自分のリポジトリに反映する

1. ChatGPT が出した **`row({ ... })` のコード**を、`scripts/test-spec-reviewable-data.mjs` の適切な位置に **手で貼る**（自動マージはしない）。  
2. ターミナルでリポジトリのルートに移動し、次を実行する。

```bash
node scripts/gen-full-test-spec-tsv.mjs
```

3. `docs/test-spec/full-system-test-spec.tsv` が更新されたか開いて確認する。  
4. 問題なければ git commit する。

---

### うまくいかないとき

| 症状 | 対処 |
|------|------|
| ZIP が読めない | `.md` / `.tsv` だけ個別添付。`.mjs` は `.txt` にリネームして添付。 |
| 長文で途切れる | 「まず implemented-behavior-catalog の §予約だけ要約して」と **段階依頼**する。 |
| 列がズレる | `TEST-SPEC-MIGRATION.md` の表を **コピペで再度貼る**。「この列順で」と明示。 |

---

## 1. テスト仕様（正本 → 生成 TSV）

| 順 | パス | 説明 |
|----|------|------|
| 1 | `docs/test-spec/TEST-SPEC-MIGRATION.md` | 12 列の意味・旧版との関係・今後厚くする領域 |
| 2 | `scripts/test-spec-reviewable-data.mjs` | **ケース行の正本**（編集は基本ここ） |
| 3 | `scripts/gen-full-test-spec-tsv.mjs` | TSV 生成スクリプト（列検証・重複チェック） |
| 4 | `docs/test-spec/full-system-test-spec.tsv` | **生成結果**（`node scripts/gen-full-test-spec-tsv.mjs` で更新） |

### 参考（移植・過去分岐の材料）

| パス | 説明 |
|------|------|
| `docs/test-spec/archive/full-system-test-spec-legacy-15col.tsv` | 移行前の 15 列・大量行版 |
| `scripts/test-spec-exhaustive.mjs` | 旧網羅行（現行ジェネレータでは未使用。ケース拾い用） |

---

## 2. 実装に沿った仕様書（`docs/spec/`・README の読み順）

| 順 | パス | 説明 |
|----|------|------|
| 0 | `docs/spec/README.md` | **読み順の索引**（ここが入口） |
| 1 | `docs/spec/implemented-system-overview.md` | 技術構成・認証・Cron・ルート |
| 2 | `docs/spec/mvp-product-intent.md` | MVP の目的・スコープ |
| 3 | `docs/spec/implemented-behavior-catalog.md` | **挙動カタログ**（API・状態・画面の期待に直結） |
| 4 | `docs/spec/implemented-matching-algorithm.md` | 自動編成アルゴリズム |

---

## 3. 運用・環境（テスト前提・手動シナリオの補助）

必要に応じて同梱。

| パス | 説明 |
|------|------|
| `docs/ops/mvp-day-before-runbook.md` | 前日オペ |
| `docs/ops/local-day-before-cron.md` | ローカル Cron |
| `docs/ops/vercel-production-checklist.md` | 本番チェック |
| `docs/setup-staging-supabase.md` | Staging / Supabase |
| `docs/setup-resend-domain.md` | メール（Resend） |

---

## 4. コードを根拠にさせたいとき（例）

ケースの「期待結果」をコードに合わせる場合、機能ごとに追加で渡す。

- 認証: `src/proxy.ts`, `src/app/admin/(protected)/layout.tsx`, `src/lib/auth/require-admin.ts`
- 締切 Cron: `src/app/api/cron/lock-event-days/route.ts`, `src/lib/event-days/process-reservation-deadline.ts`
- 編成 Cron: `src/app/api/cron/run-matching-locked/route.ts`, `src/lib/matching/run-matching-for-event-day.ts`
- 公開予約: `src/app/reserve/[date]/reserve-date-client.tsx`, `src/app/api/reservations/route.ts`
- DB 真実: `supabase/migrations/` 内の該当 RPC（例: `create_public_reservation`）

---

# ファイルをコピーする方法（Windows）

リポジトリのルートを `C:\Users\kashima_y\football-booking-system` とします。**ご自身のパスに読み替えてください。**

## A. エクスプローラー

1. 上記パスをエクスプローラーのアドレスバーに貼り付けて開く  
2. 該当ファイルを **Ctrl+C** → デスクトップや共有フォルダで **Ctrl+V**

フォルダごとコピーする場合は、`docs\spec` や `docs\test-spec` フォルダをそのまま選択してコピー。

## B. PowerShell（フォルダにまとめてコピー）

```powershell
$ROOT = "C:\Users\kashima_y\football-booking-system"
$OUT  = "$env:USERPROFILE\Desktop\ai-handoff-pack"

New-Item -ItemType Directory -Force -Path $OUT | Out-Null

# テスト仕様まわり
Copy-Item "$ROOT\docs\test-spec\TEST-SPEC-MIGRATION.md" $OUT
Copy-Item "$ROOT\docs\test-spec\full-system-test-spec.tsv" $OUT
Copy-Item "$ROOT\docs\test-spec\archive\full-system-test-spec-legacy-15col.tsv" $OUT -ErrorAction SilentlyContinue
Copy-Item "$ROOT\scripts\test-spec-reviewable-data.mjs" $OUT
Copy-Item "$ROOT\scripts\gen-full-test-spec-tsv.mjs" $OUT
Copy-Item "$ROOT\scripts\test-spec-exhaustive.mjs" $OUT -ErrorAction SilentlyContinue

# 仕様書（spec 一式）
New-Item -ItemType Directory -Force -Path "$OUT\spec" | Out-Null
Copy-Item "$ROOT\docs\spec\*.md" "$OUT\spec"

# 運用（任意）
New-Item -ItemType Directory -Force -Path "$OUT\ops" | Out-Null
Copy-Item "$ROOT\docs\ops\*.md" "$OUT\ops" -ErrorAction SilentlyContinue

Write-Host "Copied to: $OUT"
```

デスクトップに `ai-handoff-pack` フォルダができ、その中にファイルが集まります。

## C. ZIP にまとめる（メール・チャット添付向け）

```powershell
$ROOT = "C:\Users\kashima_y\football-booking-system"
$STAGE = "$env:TEMP\ai-handoff-pack"
Remove-Item $STAGE -Recurse -Force -ErrorAction SilentlyContinue
New-Item -ItemType Directory -Force -Path $STAGE | Out-Null

Copy-Item "$ROOT\docs\AI-HANDOFF-PACK.md" $STAGE
Copy-Item "$ROOT\docs\test-spec\TEST-SPEC-MIGRATION.md" $STAGE
Copy-Item "$ROOT\docs\test-spec\full-system-test-spec.tsv" $STAGE
Copy-Item "$ROOT\scripts\test-spec-reviewable-data.mjs" $STAGE
Copy-Item "$ROOT\scripts\gen-full-test-spec-tsv.mjs" $STAGE
Copy-Item "$ROOT\docs\spec" $STAGE\spec -Recurse

$ZIP = "$env:USERPROFILE\Desktop\ai-handoff-pack.zip"
if (Test-Path $ZIP) { Remove-Item $ZIP }
Compress-Archive -Path "$STAGE\*" -DestinationPath $ZIP
Write-Host "ZIP: $ZIP"
```

## D. Cursor / VS Code 上で選んでコピー

1. 左のツリーでファイルを **Ctrl+クリック** で複数選択  
2. 右クリック → **Reveal in File Explorer**（エクスプローラーで表示）  
3. まとめてコピーするか、ZIP 化は B/C と同様

---

## 5. AI に渡すときの短文例

```
次のファイルを正として、12列のテスト仕様TSVを追記・修正してください。
- docs/AI-HANDOFF-PACK.md（この一覧）
- docs/test-spec/TEST-SPEC-MIGRATION.md
- scripts/test-spec-reviewable-data.mjs
- docs/spec/README.md の読み順の implemented-*.md
挙動は implemented-behavior-catalog.md を優先し、矛盾時はコードまたは supabase/migrations を正と書いてください。
```

---

*このファイル自身も手渡しパックに含めてよいです。*
