# リリース前・漏れチェック手順（翌日実行用）

**目的:** 本番・Staging・ローカル・Git の整合と、試合表・手動調整まわりのリグレを防ぐ。  
**所要目安:** 30〜90 分（DB / デプロイの待ち時間を除く）

---

## 0. 事前確認（1 分）

- [ ] 今日の作業で **意図したコミットが `origin/main` に載っているか**（GitHub の `main` の最新コミットと一致するか）。
- [ ] **まだコミットしていない変更**を本番に含めるか決める（含めるなら先にコミット・push）。

---

## 1. Git：`staging` ブランチを `main` と揃える

**状況:** `origin/staging` が `main` と fast-forward できない場合は、次のどちらかで揃える。

### A. マージで揃える（staging 独自のコミットを残したいとき）

```powershell
cd （リポジトリのルート）
git fetch origin
git checkout staging
git merge origin/main
# コンフリクトがあれば解消してから
git push origin staging
git checkout main
```

### B. `main` と完全一致させる（staging 専用コミットを捨ててよいとき）

```powershell
git fetch origin
git push origin main:staging --force-with-lease
```

**注意:** `--force-with-lease` はリモートの `staging` を上書きする。チームで staging を共有している場合は A を優先。

---

## 2. Supabase：マイグレーションを環境ごとに当てる

**正本:** `supabase/migrations/`。  
**原則:** アプリをデプロイする**前に**、対象環境の DB に **未適用マイグレーションが無い**状態にする。

詳細は [setup-staging-supabase.md](../setup-staging-supabase.md)。ここでは手順だけ列挙する。

### 2.1 Staging 用プロジェクト

1. [ ] CLI でログイン済みか確認：`npm run supabase -- login`
2. [ ] **Staging の project ref** にリンク（本番と混同しない）  
   `npm run supabase -- link --project-ref <STAGING_REF>`
3. [ ] 適用予定の確認：`npm run supabase -- migration list`（または Dashboard で Migration 履歴）
4. [ ] 問題なければ：`npm run db:push`
5. [ ] 終わったら **どちらの環境に link しているかメモ**（次に本番へ push するときに誤リンクしない）

### 2.2 本番（Production）用プロジェクト

1. [ ] **本番の project ref** に `link` を切り替え（Staging と同じフォルダでは **必ず ref を確認してから**）
2. [ ] `migration list` で Staging と同じ差分になることを確認できるとよい
3. [ ] メンテ時間・影響を踏まえて `npm run db:push`
4. [ ] 運用ポリシーにより **バックアップや読み取り専用ウィンドウ**がある場合はそれに従う

### 2.3 ローカル（Docker）

```powershell
npm run db:push:local
```

- [ ] `Remote database is up to date.` であれば当日は追加作業なしでよいことが多い

---

## 3. アプリのデプロイ（Vercel 等）

1. [ ] **Production:** `main` のデプロイが完了しているか（GitHub 連携なら main push 後のビルド）
2. [ ] **Preview / Staging URL:** `staging` ブランチが追従しているか（ブランチ設定はプロジェクトにより異なる）。必要なら **手動 Redeploy**
3. [ ] 環境変数：`NEXT_PUBLIC_SUPABASE_URL` 等が **Staging／本番でそれぞれ正しいプロジェクト**を指しているか（混線だけは防ぐ）

---

## 4. 自動テスト（ローカル・可能なら CI）

リポジトリルートで：

```powershell
npm run test:unit
npm run test:integration
npm run build
```

任意（Staging URL がネットワークから届くとき）：

```powershell
npm run test:staging
```

- [ ] すべて成功すること（既知の skip は記録しておく）

---

## 5. 手動スモーク（試合表・手動調整まわり）

**管理画面にログインできる管理者で実施。**

### Staging（または本番リリース直後は本番）

1. [ ] `/admin/pre-day-results` を開く
2. [ ] **自動作成**タブ：試合一覧が表示される／**昼休憩行**が午前→午後の間に出る（データがある日）
3. [ ] **手動調整**タブ：一覧から試合を選べる／**時刻は表示のみ**（セレクト無し）／チーム A・B・審判を変更できる
4. [ ] **今回の変更理由**を入れて **変更を保存** → 成功メッセージまたは一覧の反映
5. [ ] 予約受付中の日は編集できない旨のメッセージが期待どおりか（該当日があれば）

---

## 6. ドキュメント・運用メモ

- [ ] `docs/ops/admin-match-batch-patch-policy.md` の方針（API に `eventDaySlotId` は残す・UI は触らない）がチームで共有されているか

---

## 7. 漏れやすいポイント（チェックリスト）

| 項目 | 確認 |
|------|------|
| DB は Staging と本番の **両方**に push したか | □ |
| `supabase link` が **本番・Staging で取り違えていないか** | □ |
| `origin/main` に載せたいコードが **未コミットのまま**残っていないか | □ |
| Vercel の **Production が旧コミット**のままになっていないか | □ |

---

## トラブル時

- **DB push でエラー:** マイグレーション順序・既存 DB の手編集・別ブランチの SQL。ログを保存し、`migration repair` の要否は Supabase のガイドに従う。
- **401 / 管理画面に入れない:** Staging の `app_admins`・Auth URL 設定を [setup-staging-supabase.md](../setup-staging-supabase.md) と照合。
