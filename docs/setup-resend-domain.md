# Resend 独自ドメイン（本番・Staging 共通の考え方）

予約完了メールは `RESEND_API_KEY` と `RESEND_FROM` が揃っているときだけ送信されます（`src/lib/email/reservation-created-mail.ts`）。  
`onboarding@resend.dev` でも動きますが、**受信トレイに届きにくい**ことがあるため、運用前に **自分が管理するドメイン**を Resend で検証して From を差し替えるのがおすすめです。

公式の概要: [Managing Domains](https://resend.com/docs/dashboard/domains/introduction)  
DNS が通らないとき: [What if my domain is not verifying?](https://resend.com/knowledge-base/what-if-my-domain-is-not-verifying)

---

## 1. 方針（どのドメインで送るか）

- Resend は **サブドメイン**（例: `updates.example.com`）での送信を推奨しています（評価の分離・意図の明示）。ルート `example.com` でも可能です。
- **From に使うメールアドレスのドメイン**は、Resend に追加したドメイン（またはそのサブドメイン）と一致させます。
- 例: Resend に `updates.example.com` を追加した場合  
  `RESEND_FROM=和歌山サッカー交流試合 <noreply@updates.example.com>`

---

## 2. Resend ダッシュボード

1. [Resend Domains](https://resend.com/domains) を開く。
2. **Add domain** でドメイン名を入力（サブドメインなら `updates.example.com` のようにフルで）。
3. 表示された **DNS レコード**（SPF 用 TXT、Return-Path 用 MX、DKIM 用 TXT など）をメモする。  
   **表示どおり** DNS に入れる（値はアカウントごとに異なるため、ここには書かない）。
4. DNS 反映後、Resend で **Verify DNS Records** を実行し、ステータスが **verified** になるまで待つ（反映に時間がかかることがある）。

**注意:** 既に同じホストに **別用途の SPF（TXT）** がある場合は、Resend の指示と **既存レコードのマージ**が必要になることがあります。迷ったら Resend の KB または DNS 業者のサポートを参照。

---

## 3. DNS（ドメイン管理画面）

- レコードの **ホスト名** は、お名前.com / Cloudflare / Route 53 などで **`send`** や **`resend._domainkey`** のように短く入れるのか、**FQDN** で入れるのかが業者ごとに違います。Resend の画面に出ている **Name / Host** に合わせる。
- 検証用ツール: Resend が案内する [dns.email](https://dns.email/) などで外部から見えているか確認できる。

---

## 4. API キー

1. [API Keys](https://resend.com/api-keys) でキーを作成（本番用と検証用で分けてもよい）。
2. **ローカル:** `.env.local` の `RESEND_API_KEY` に設定（コミットしない）。
3. **Vercel:** Production / Preview それぞれに、向け先環境に合わせて登録。キーを変えたら **Redeploy** が必要な場合があります。

---

## 5. アプリ側の環境変数

| 変数 | 内容 |
|------|------|
| `RESEND_API_KEY` | Resend の API キー（`re_...`） |
| `RESEND_FROM` | 検証済みドメイン上の送信元。例: `名称 <noreply@updates.example.com>`（Resend の形式に沿う） |
| `NEXT_PUBLIC_SITE_URL` | メール内リンク用。本番 URL や Preview URL（末尾スラッシュなし推奨） |

`.env.example` にキー名の一覧あり。

---

## 6. 動作確認

1. ステージングまたは本番で、**実在する自分のメール**で予約を1件通す。
2. 受信トレイ／迷惑メールフォルダの両方を確認。
3. Supabase の `notifications` が `sent` になっているか、失敗時は `failed` と `error_message` を確認。

---

## 7. Staging と本番

- **ドメイン検証**は Resend 側で **1 回**（そのドメインを使う全環境で共通）。
- **API キー**や **From の表記**、**`NEXT_PUBLIC_SITE_URL`** は Vercel の Production / Preview で別値にしてよい（Preview は Staging のサイト URL を指すなど）。  
  Staging 用 Supabase 手順: `docs/setup-staging-supabase.md`
