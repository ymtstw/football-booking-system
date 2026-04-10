# Staging 用 Supabase を本番と同じ構成にする

本番と**同じスキーマ・同じ挙動**で検証するため、**別の Supabase プロジェクト**（Staging）を用意し、本番と**同じ手順で**初期化します。  
（本番の**個人データをコピーする**話ではありません。空の Staging にマイグレーションを当て、設定だけ本番に揃えます。）

---

## 1. プロジェクトを作る

1. [Supabase Dashboard](https://supabase.com/dashboard) で **New project**（Staging 用の名前、例: `football-booking-staging`）。
2. **Database password** を控える（CLI `link` / `db push` で使用）。
3. 可能なら **本番と同じ Region** にすると差分が出にくいです。

---

## 2. マイグレーション（本番と同一 SQL）

ローカルリポジトリの `supabase/migrations/` が正本です。**本番で一度 `repair` した履歴があっても、新プロジェクトは空なので**、通常は次で足ります。

```powershell
cd （このリポジトリのルート）

# 未ログインなら
npm.cmd run supabase -- login

# Staging の project ref に紐づける（本番とは別 ref）
npm.cmd run supabase -- link --project-ref <STAGING_PROJECT_REF>

# 確認してから適用（PowerShell で npm がブロックされる場合は npm.cmd）
npm.cmd run db:push
```

- エラーなく完了すれば、**本番と同じテーブル・ENUM・RLS・`create_public_reservation` 等**が Staging にあります。
- もし「既に手で触った Staging」で履歴だけずれる場合は、本番で行ったのと同様 **`migration repair`** の要否を判断してください。

**注意:** `supabase link` は **このフォルダでは常に 1 つの project ref** を指します。本番に戻して push するときは、再度 `link` で **本番の ref** に切り替えてください（どちらに繋いでいるかを毎回確認する習慣が安全です）。

---

## 3. Authentication（本番と同じ URL 設計）

本番で設定している内容を **Staging プロジェクトの Authentication → URL Configuration** にも同じ**パターン**で入れます（ホスト名だけ Staging / Preview 用に変える）。

| 設定 | 例（本番と同じルールでホストだけ差し替え） |
|------|--------------------------------------------|
| **Site URL** | 本番: `https://（本番ドメイン）` / ローカル検証: `http://localhost:3000` |
| **Redirect URLs** | `http://localhost:3000/**`、`https://（本番）/**` に加え、**Vercel Preview** なら `https://*.vercel.app/**` など（チーム方針に合わせる） |

パスワードリカバリ・メールリンクの着地点は、本番と同じく **`/auth/callback`** や **`/reset-password`** 等を許可リストに含めます（`src/proxy.ts` のリダイレクトと一致させる）。

---

## 4. 管理者（`app_admins`）

本番と同様、**Staging の Auth でユーザーを作成**し、SQL Editor で:

```sql
INSERT INTO public.app_admins (user_id) VALUES ('<auth.users.id の uuid>');
```

RLS により、**登録したユーザだけ**が管理用の業務テーブルを `authenticated` で触れられる想定です（主経路は引き続き service role 推奨）。

---

## 5. アプリ側の環境変数（変数名は本番と同一）

Next.js は **`NEXT_PUBLIC_SUPABASE_URL` 等の名前は 1 セット**のまま、**接続先の値だけ**環境で切り替えます。

| 置き場所 | 入れる値 |
|----------|-----------|
| **Vercel → Production** | 本番 Supabase の Project URL / anon / service_role |
| **Vercel → Preview**（`staging` ブランチを Preview にする等） | **Staging Supabase** の同じ3つ |
| **ローカル `.env.local`** | 作業中は Staging を向けてもよいし、本番を向けてもよい（**同時に 2 本は持てない**ので、切り替え時は値を差し替え） |

`.env.example` のキー名と揃えてください（追加の変数名は不要です）。

---

## 6. 本番と「同じ」に含めるべきチェックリスト

- [ ] マイグレーション全適用済み（`db push` 成功）
- [ ] Auth の Site URL / Redirect URLs が本番と同じ方針
- [ ] `app_admins` に少なくとも自分の管理ユーザを 1 人入れた
- [ ] Vercel Preview（または Staging デプロイ）の環境変数が **Staging プロジェクト**を指している
- [ ] （メール送信を試す場合）Resend 等の **API キーを Preview 用に**入れる・送信ドメインを Staging からも使えるようにする

---

## 7. データについて

- Staging は **空から始め**、開催日・予約は **テストデータだけ**入れるのが安全です。
- 本番 DB のダンプをそのまま Staging に入れると **個人情報の複製**になるため、**原則おすすめしません**。どうしても必要ならマスキング方針を別途決めてください。

---

## 8. 運用メモ

- **マイグレーション追加後:** 本番と Staging の両方へ `db push`（リンク先を切り替えて 2 回、または CI で ref を分ける）。
- **CLI の向き先:** `npm.cmd run supabase -- projects list` 等で現在の認証状態を確認し、`link` 後に誤って本番へ壊し込まないよう注意してください。
